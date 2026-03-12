# -*- coding: utf-8 -*-
"""
InfoGEO – Servidor Flask (Refatorado)
=======================================
Ponto de entrada da aplicação. Contém apenas:
- Criação do Flask app e configuração
- Error handlers
- Rotas HTTP (endpoints da API)
# - Orquestração de análise (chama módulos especializados)
# Reload triggered at 2026-02-22 15:10

Módulos:
  - server.utils          → formatação pt-BR, sanitização JSON
  - server.geocoding      → geocodificação reversa
  - server.geo_utils      → operações GIS/raster/CRS
  - server.file_parsers   → leitura KML/KMZ/SHP/GeoJSON
  - server.valoracao      → valoração agronômica
"""

import io
import os
import json
import logging
from pathlib import Path
from datetime import datetime
import pandas as pd
import rasterio
from rasterio.crs import CRS

from shapely.geometry import Point
from shapely.ops import unary_union

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

# Garantir que o diretório InfoGEO esteja no path (necessário
# para que 'from server.*' e 'from config' funcionem ao executar
# este arquivo diretamente com "python server/servidor.py")
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

# Importações dos módulos refatorados
from server.utils import (
    _sanitize_response,
    _format_area_ha,
    _format_percent,
    decimal_to_gms,
)
from server.geocoding import _get_location_from_coords, _get_rta_from_coords
from server.geo_utils import (
    _convert_gdf_to_raster_crs,
    _polygon_area_ha,
    _intersect_area_ha,
    _optimize_cog_reading,
    _fractional_stats,
    _create_visual_image,
    _sanitize_gdf_for_json,
    _pixel_area_ha,
)
from server.file_parsers import _allowed_file, parse_upload_file

from server.valoracao import (
    _get_quadrante_info_from_centroid,
    calculate_valoracao,
)

# Importações de configuração — fonte única de verdade para constantes
from config import (
    CLASSES_NOMES,
    CLASSES_CORES,
    DECLIVIDADE_CLASSES_NOMES,
    DECLIVIDADE_CLASSES_CORES,
    APTIDAO_CLASSES_NOMES,
    APTIDAO_CLASSES_CORES,
    APTIDAO_CLASSES_DESCRICOES,
    RASTER_APTIDAO_PATH,
    SOLO_TEXTURAL_CLASSES_NOMES,
    SOLO_TEXTURAL_CLASSES_CORES,
    RASTER_SOLO_TEXTURAL_PATH,
    CAR_GPKG_PATH,
    EMBARGO_SHAPEFILE_PATH,
    ICMBIO_SHAPEFILE_PATH,
)

# ------------------------------------------------------------------------------
# Flask app setup
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

app.config["MAX_CONTENT_LENGTH"] = 5000 * 1024 * 1024

TIFF_PATH = os.getenv(
    "LULC_TIFF_PATH", str(BASE_DIR / "data" / "LULC_VALORACAO_10m_com_mosaico.tif")
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("lulc-analyzer")

# Para rastreamento de progresso de tarefas longas
progress_tasks = {}


# ==============================================================================
# Error Handlers
# ==============================================================================
@app.errorhandler(RequestEntityTooLarge)
def handle_large_file(e):
    return jsonify(
        {"status": "erro", "mensagem": "Arquivo excede o limite de 5000 MB."}
    ), 413


@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith("/api/"):
        return jsonify({"status": "erro", "mensagem": "Endpoint não encontrado"}), 404
    try:
        return send_from_directory(BASE_DIR, "index.html")
    except Exception:
        return jsonify({"status": "erro", "mensagem": "Arquivo não encontrado"}), 404


@app.errorhandler(500)
def handle_500(e):
    logger.error(f"Erro interno do servidor: {e}")
    return jsonify({"status": "erro", "mensagem": "Erro interno do servidor"}), 500


# ==============================================================================
# Rotas estáticas
# ==============================================================================
@app.route("/", methods=["GET"])
def index():
    try:
        return send_from_directory(BASE_DIR, "index.html")
    except Exception as e:
        logger.error(f"Erro ao servir index.html: {e}")
        return """
        <h1>Servidor Funcionando</h1>
        <p>O servidor está rodando, mas o index.html não foi encontrado na raiz do projeto.</p>
        <p><a href="/teste">Testar API</a></p>
        <p>Diretório base: {} </p>
        """.format(BASE_DIR)


@app.route("/<path:filename>")
def serve_static(filename):
    try:
        return send_from_directory(BASE_DIR, filename)
    except Exception:
        logger.warning(f"Arquivo estático não encontrado: {filename}")
        return jsonify({"status": "erro", "mensagem": "Arquivo não encontrado"}), 404


# ==============================================================================
# Processamento síncrono: Análise de Uso do Solo
# ==============================================================================
def _process_analysis_sync(kml_file, raster_path, enable_valoracao=True):
    """Processamento síncrono para análise de uso do solo."""
    try:
        gdf = parse_upload_file(kml_file)
        if isinstance(gdf, tuple):
            return gdf

        with rasterio.open(raster_path) as src:
            tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)

            gdf_tiff, crs_info = _convert_gdf_to_raster_crs(gdf, tiff_crs)
            geom_union = unary_union(gdf_tiff.geometry)

            if geom_union.is_empty:
                return {
                    "status": "erro",
                    "mensagem": "Polígono inválido após processamento.",
                }

            area_poligono_ha = _polygon_area_ha(gdf_tiff, tiff_crs)
            area_intersec_raster_ha = _intersect_area_ha(geom_union, tiff_crs, src)

            if area_intersec_raster_ha == 0:
                return {
                    "status": "erro",
                    "mensagem": "Polígono não possui interseção com a área do raster.",
                }

            cog_optimizations = _optimize_cog_reading(src, gdf_tiff.total_bounds)

            area_classes_total_ha, areas_por_classe_ha, img_data_visual, meta_aux = (
                _fractional_stats(src, gdf_tiff, cog_optimizations)
            )

            # Ajustar diferenças de área
            dif_ha = area_poligono_ha - area_classes_total_ha
            tol = 1e-4
            if dif_ha > tol:
                areas_por_classe_ha[0] = areas_por_classe_ha.get(0, 0.0) + dif_ha
            elif dif_ha < -tol:
                fator = area_poligono_ha / (
                    area_classes_total_ha if area_classes_total_ha > 0 else 1.0
                )
                for k in list(areas_por_classe_ha.keys()):
                    areas_por_classe_ha[k] *= fator

            # Preparar relatório
            total_ref = area_poligono_ha if area_poligono_ha > 0 else 1.0
            relatorio = {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(
                    area_poligono_ha, 4
                ),
                "area_analisada_ha": round(area_poligono_ha, 4),
                "area_analisada_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "numero_classes_encontradas": len(
                    [c for c in areas_por_classe_ha if c != 0]
                ),
                "classes": {},
                "metodo_utilizado": "pixel_parcial_otimizado",
            }

            for cls, area_ha in sorted(
                areas_por_classe_ha.items(), key=lambda k: -k[1]
            ):
                percent = round((area_ha / total_ref) * 100, 4)
                relatorio["classes"][f"Classe {int(cls)}"] = {
                    "descricao": CLASSES_NOMES.get(int(cls), f"Classe {int(cls)}"),
                    "area_ha": round(area_ha, 4),
                    "area_ha_formatado": _format_area_ha(round(area_ha, 4), 4),
                    "percentual": percent,
                    "percentual_formatado": _format_percent(percent, 2),
                }

            # Gerar imagem
            img_base64, legenda, img_diag = _create_visual_image(
                img_data_visual, CLASSES_NOMES, CLASSES_CORES
            )

            # GeoJSON do polígono processado para visualização
            polygon_geojson = None
            try:
                gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                gdf_sanitized = _sanitize_gdf_for_json(gdf_wgs84)
                polygon_geojson = json.loads(gdf_sanitized.to_json())
                logger.info(
                    f"GeoJSON do polígono gerado com sucesso: {len(polygon_geojson.get('features', []))} features"
                )
            except Exception as e:
                logger.error(f"Erro ao gerar GeoJSON do polígono: {e}")

            # Calcular centroide
            centroid = None
            try:
                if "gdf_wgs84" not in locals():
                    gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                centroid = gdf_wgs84.union_all().centroid
                centroid_coords = [centroid.y, centroid.x]
                lat_gms = decimal_to_gms(centroid.y, True)
                lon_gms = decimal_to_gms(centroid.x, False)
                centroid_display = f"{lat_gms}, {lon_gms}"
                municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
                cd_rta, nm_rta = _get_rta_from_coords(centroid.y, centroid.x)
            except Exception as e:
                logger.warning(f"Erro ao calcular centroide: {e}")
                centroid_coords = None
                centroid_display = "Não disponível"
                municipio, uf = "Não identificado", "Não identificado"
                cd_rta, nm_rta = None, "Não identificado"

            # ---------------------
            # Valoração agronômica
            # ---------------------
            if enable_valoracao:
                try:
                    centroid_point = (
                        Point(centroid.x, centroid.y) if centroid is not None else None
                    )
                    valor_quadrante_result = (
                        _get_quadrante_info_from_centroid(centroid_point)
                        if centroid_point is not None
                        else (None, None, {}, "Centroide sem valor")
                    )

                    quadrante_code, valor_quadrante, quad_attrs, quad_msg = (
                        valor_quadrante_result
                    )

                    if (
                        quad_msg == "Centroide sem valor"
                        or quadrante_code is None
                        or valor_quadrante is None
                    ):
                        relatorio["valor_total_calculado"] = None
                        return {
                            "status": "sucesso",
                            "mensagem_centroide": "Centroide sem valor",
                            "relatorio": relatorio,
                            "polygon_geojson": polygon_geojson,
                            "metadados": {
                                "crs": str(tiff_crs),
                                "resolucao_espacial": f"{src.res[0]:.2f} x {src.res[1]:.2f}",
                                "dimensoes_recorte": meta_aux.get(
                                    "dimensoes_recorte", "N/D"
                                ),
                                "area_por_pixel_ha": meta_aux.get(
                                    "area_por_pixel_ha", None
                                ),
                                "area_por_pixel_ha_formatado": meta_aux.get(
                                    "area_por_pixel_ha_formatado", None
                                ),
                                "area_poligono_intersect_raster_ha": round(
                                    area_intersec_raster_ha, 4
                                ),
                                "data_imagem": datetime.now().strftime("%d/%m/%Y"),
                                "centroide": centroid_coords,
                                "centroide_display": centroid_display,
                                "municipio": municipio,
                                "uf": uf,
                                "cd_rta": cd_rta,
                                "nm_rta": nm_rta,
                                "quadrante": {
                                    "codigo": None,
                                    "valor_quadrante": None,
                                    "valor_quadrante_formatado": None,
                                    "atributos": {},
                                },
                            },
                            "imagem_recortada": {
                                "base64": img_base64,
                                "legenda": legenda,
                                "diagnostics": img_diag,
                            }
                            if img_base64
                            else None,
                            "crs_info": crs_info,
                        }

                    # Cálculo de valoração delegado ao módulo
                    relatorio, quadrante_code, valor_quadrante, quad_attrs, quad_msg = (
                        calculate_valoracao(
                            relatorio, centroid_point, valor_quadrante_result
                        )
                    )

                except Exception as e:
                    logger.warning(f"Erro no cálculo de valoração agronômica: {e}")
                    relatorio.setdefault("valor_total_calculado", 0.0)
            else:
                logger.info("Módulo de valoração desabilitado - pulando cálculos")
                relatorio["valor_total_calculado"] = None
                relatorio["valor_total_calculado_formatado"] = None

            return {
                "status": "sucesso",
                "relatorio": relatorio,
                "polygon_geojson": polygon_geojson,
                "metadados": {
                    "crs": str(tiff_crs),
                    "resolucao_espacial": f"{src.res[0]:.2f} x {src.res[1]:.2f}",
                    "dimensoes_recorte": meta_aux.get("dimensoes_recorte", "N/D"),
                    "area_por_pixel_ha": meta_aux.get("area_por_pixel_ha", None),
                    "area_por_pixel_ha_formatado": meta_aux.get(
                        "area_por_pixel_ha_formatado", None
                    ),
                    "area_poligono_intersect_raster_ha": round(
                        area_intersec_raster_ha, 4
                    ),
                    "data_imagem": datetime.now().strftime("%d/%m/%Y"),
                    "centroide": centroid_coords,
                    "centroide_display": centroid_display,
                    "municipio": municipio,
                    "uf": uf,
                    "cd_rta": cd_rta,
                    "nm_rta": nm_rta,
                    "quadrante": {
                        "codigo": (
                            quadrante_code if "quadrante_code" in locals() else None
                        ),
                        "valor_quadrante": (
                            valor_quadrante if "valor_quadrante" in locals() else None
                        ),
                        "valor_quadrante_formatado": (
                            quad_attrs.get("VL_CEND_AVLC_IMVL_formatted")
                            if "quad_attrs" in locals()
                            and isinstance(quad_attrs, dict)
                            and "VL_CEND_AVLC_IMVL_formatted" in quad_attrs
                            else None
                        ),
                        "atributos": (quad_attrs if "quad_attrs" in locals() else {}),
                    },
                },
                "imagem_recortada": {
                    "base64": img_base64,
                    "legenda": legenda,
                    "diagnostics": img_diag,
                }
                if img_base64
                else None,
                "crs_info": crs_info,
            }

    except Exception as e:
        logger.error(f"Erro no processamento síncrono: {e}")
        return {"status": "erro", "mensagem": f"Erro no processamento: {str(e)}"}


# ==============================================================================
# Processamento síncrono: Análise de Declividade
# ==============================================================================
def _process_declividade_sync(kml_file, raster_path):
    """Processamento síncrono para análise de declividade."""
    try:
        gdf = parse_upload_file(kml_file)
        if isinstance(gdf, tuple):
            return gdf

        with rasterio.open(raster_path) as src:
            tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)

            logger.info(
                f"📊 Raster ALOS Declividade - Resolução: {src.res[0]}m x {src.res[1]}m"
            )
            pixel_area = _pixel_area_ha(src)
            logger.info(
                f"📐 Área por pixel: {pixel_area:.4f} ha ({pixel_area * 10000:.0f} m²)"
            )

            gdf_tiff, crs_info = _convert_gdf_to_raster_crs(gdf, tiff_crs)
            geom_union = unary_union(gdf_tiff.geometry)

            if geom_union.is_empty:
                return {
                    "status": "erro",
                    "mensagem": "Polígono inválido após processamento.",
                }

            area_poligono_ha = _polygon_area_ha(gdf_tiff, tiff_crs)
            area_intersec_raster_ha = _intersect_area_ha(geom_union, tiff_crs, src)

            if area_intersec_raster_ha == 0:
                return {
                    "status": "erro",
                    "mensagem": "Polígono não possui interseção com a área do raster de declividade.",
                }

            cog_optimizations = _optimize_cog_reading(src, gdf_tiff.total_bounds)

            area_classes_total_ha, areas_por_classe_ha, img_data_visual, meta_aux = (
                _fractional_stats(src, gdf_tiff, cog_optimizations)
            )

            # Filtrar apenas classes válidas de declividade (1-8)
            classes_validas_declividade = {1, 2, 3, 4, 5, 6, 7, 8}
            areas_filtradas = {}
            area_invalida = 0.0

            for cls, area_ha in areas_por_classe_ha.items():
                if cls in classes_validas_declividade:
                    areas_filtradas[cls] = area_ha
                else:
                    logger.warning(
                        f"⚠️ Classe inválida {cls} encontrada no raster de declividade com {area_ha:.4f} ha - será ignorada"
                    )
                    area_invalida += area_ha

            areas_por_classe_ha = areas_filtradas
            area_classes_total_ha = sum(areas_por_classe_ha.values())

            if area_invalida > 0:
                logger.info(
                    f"📊 Área com classes inválidas: {area_invalida:.4f} ha ({(area_invalida / area_poligono_ha * 100):.2f}%)"
                )

            # Ajustar diferenças de área
            dif_ha = area_poligono_ha - area_classes_total_ha
            tol = 1e-4
            if dif_ha > tol:
                areas_por_classe_ha[0] = areas_por_classe_ha.get(0, 0.0) + dif_ha
            elif dif_ha < -tol:
                fator = area_poligono_ha / (
                    area_classes_total_ha if area_classes_total_ha > 0 else 1.0
                )
                for k in list(areas_por_classe_ha.keys()):
                    areas_por_classe_ha[k] *= fator

            # Preparar relatório
            total_ref = area_poligono_ha if area_poligono_ha > 0 else 1.0
            relatorio = {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(
                    area_poligono_ha, 4
                ),
                "area_analisada_ha": round(area_poligono_ha, 4),
                "area_analisada_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "numero_classes_encontradas": len(
                    [
                        c
                        for c in areas_por_classe_ha
                        if c != 0 and c in classes_validas_declividade
                    ]
                ),
                "classes": {},
                "metodo_utilizado": "pixel_parcial_otimizado",
            }

            for cls, area_ha in sorted(
                areas_por_classe_ha.items(), key=lambda k: -k[1]
            ):
                if cls == 0 or cls not in classes_validas_declividade:
                    continue
                percent = round((area_ha / total_ref) * 100, 4)
                relatorio["classes"][f"Classe {int(cls)}"] = {
                    "descricao": DECLIVIDADE_CLASSES_NOMES.get(
                        int(cls), f"Classe {int(cls)}"
                    ),
                    "area_ha": round(area_ha, 4),
                    "area_ha_formatado": _format_area_ha(round(area_ha, 4), 4),
                    "percentual": percent,
                    "percentual_formatado": _format_percent(percent, 2),
                }

            # Gerar imagem com cores de declividade
            img_base64, legenda, img_diag = _create_visual_image(
                img_data_visual, DECLIVIDADE_CLASSES_NOMES, DECLIVIDADE_CLASSES_CORES
            )

            # GeoJSON do polígono
            polygon_geojson = None
            try:
                gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                gdf_sanitized = _sanitize_gdf_for_json(gdf_wgs84)
                polygon_geojson = json.loads(gdf_sanitized.to_json())
                logger.info(
                    f"GeoJSON do polígono gerado: {len(polygon_geojson.get('features', []))} features"
                )
            except Exception as e:
                logger.error(f"Erro ao gerar GeoJSON do polígono: {e}")

            # Centroide
            try:
                if "gdf_wgs84" not in locals():
                    gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                centroid = gdf_wgs84.union_all().centroid
                centroid_coords = [centroid.y, centroid.x]
                lat_gms = decimal_to_gms(centroid.y, True)
                lon_gms = decimal_to_gms(centroid.x, False)
                centroid_display = f"{lat_gms}, {lon_gms}"
                municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
                cd_rta, nm_rta = _get_rta_from_coords(centroid.y, centroid.x)
            except Exception as e:
                logger.warning(f"Erro ao calcular centroide: {e}")
                centroid_coords = None
                centroid_display = "Não disponível"
                municipio, uf = "Não identificado", "Não identificado"
                cd_rta, nm_rta = None, "Não identificado"
            return {
                "status": "sucesso",
                "relatorio": relatorio,
                "polygon_geojson": polygon_geojson,
                "metadados": {
                    "crs": str(tiff_crs),
                    "resolucao_espacial": f"{src.res[0]:.2f} x {src.res[1]:.2f}",
                    "dimensoes_recorte": meta_aux.get("dimensoes_recorte", "N/D"),
                    "area_por_pixel_ha": meta_aux.get("area_por_pixel_ha", None),
                    "area_por_pixel_ha_formatado": meta_aux.get(
                        "area_por_pixel_ha_formatado", None
                    ),
                    "area_poligono_intersect_raster_ha": round(
                        area_intersec_raster_ha, 4
                    ),
                    "data_imagem": datetime.now().strftime("%d/%m/%Y"),
                    "centroide": centroid_coords,
                    "centroide_display": centroid_display,
                    "municipio": municipio,
                    "uf": uf,
                    "cd_rta": cd_rta,
                    "nm_rta": nm_rta,
                },
                "imagem_recortada": {
                    "base64": img_base64,
                    "legenda": legenda,
                    "diagnostics": img_diag,
                }
                if img_base64
                else None,
                "crs_info": crs_info,
            }

    except Exception as e:
        logger.exception(f"Erro em _process_declividade_sync: {e}")
        return {
            "status": "erro",
            "mensagem": f"Erro ao processar análise de declividade: {str(e)}",
        }


# ==============================================================================
# Processamento síncrono: Análise de Classe Textural do Solo (MapBiomas)
# ==============================================================================

def _process_solo_textural_sync(kml_file, raster_path):
    """Processamento síncrono para análise de classe textural do solo."""
    try:
        gdf = parse_upload_file(kml_file)
        if isinstance(gdf, tuple):
            return gdf

        with rasterio.open(raster_path) as src:
            tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)

            logger.info(
                f"📊 Raster Solo Textural - Resolução: {src.res[0]:.2f}m x {src.res[1]:.2f}m"
            )
            pixel_area = _pixel_area_ha(src)
            logger.info(
                f"📐 Área por pixel: {pixel_area:.4f} ha ({pixel_area * 10000:.0f} m²)"
            )

            gdf_tiff, crs_info = _convert_gdf_to_raster_crs(gdf, tiff_crs)
            geom_union = unary_union(gdf_tiff.geometry)

            if geom_union.is_empty:
                return {
                    "status": "erro",
                    "mensagem": "Polígono inválido após processamento.",
                }

            area_poligono_ha = _polygon_area_ha(gdf_tiff, tiff_crs)
            area_intersec_raster_ha = _intersect_area_ha(geom_union, tiff_crs, src)

            if area_intersec_raster_ha == 0:
                return {
                    "status": "erro",
                    "mensagem": "Polígono não possui interseção com a área do raster de textura do solo.",
                }

            cog_optimizations = _optimize_cog_reading(src, gdf_tiff.total_bounds)

            area_classes_total_ha, areas_por_classe_ha, img_data_visual, meta_aux = (
                _fractional_stats(src, gdf_tiff, cog_optimizations)
            )

            # Filtrar apenas classes válidas de textura do solo (1-13)
            classes_validas_solo = set(range(1, 14))
            areas_filtradas = {}
            area_invalida = 0.0

            for cls, area_ha in areas_por_classe_ha.items():
                if cls in classes_validas_solo:
                    areas_filtradas[cls] = area_ha
                else:
                    logger.warning(
                        f"⚠️ Classe inválida {cls} encontrada no raster de solo textural com {area_ha:.4f} ha - será ignorada"
                    )
                    area_invalida += area_ha

            areas_por_classe_ha = areas_filtradas
            area_classes_total_ha = sum(areas_por_classe_ha.values())

            if area_invalida > 0:
                logger.info(
                    f"📊 Área com classes inválidas: {area_invalida:.4f} ha ({(area_invalida / area_poligono_ha * 100):.2f}%)"
                )

            # Ajustar diferenças de área
            dif_ha = area_poligono_ha - area_classes_total_ha
            tol = 1e-4
            if dif_ha > tol:
                areas_por_classe_ha[0] = areas_por_classe_ha.get(0, 0.0) + dif_ha
            elif dif_ha < -tol:
                fator = area_poligono_ha / (
                    area_classes_total_ha if area_classes_total_ha > 0 else 1.0
                )
                for k in list(areas_por_classe_ha.keys()):
                    areas_por_classe_ha[k] *= fator

            # Preparar relatório
            total_ref = area_poligono_ha if area_poligono_ha > 0 else 1.0
            relatorio = {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "area_analisada_ha": round(area_poligono_ha, 4),
                "area_analisada_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "numero_classes_encontradas": len(
                    [c for c in areas_por_classe_ha if c != 0 and c in classes_validas_solo]
                ),
                "classes": {},
                "metodo_utilizado": "pixel_parcial_otimizado",
            }

            for cls, area_ha in sorted(areas_por_classe_ha.items(), key=lambda k: -k[1]):
                if cls == 0 or cls not in classes_validas_solo:
                    continue
                percent = round((area_ha / total_ref) * 100, 4)
                relatorio["classes"][f"Classe {int(cls)}"] = {
                    "descricao": SOLO_TEXTURAL_CLASSES_NOMES.get(int(cls), f"Classe {int(cls)}"),
                    "area_ha": round(area_ha, 4),
                    "area_ha_formatado": _format_area_ha(round(area_ha, 4), 4),
                    "percentual": percent,
                    "percentual_formatado": _format_percent(percent, 2),
                }

            # Gerar imagem com cores de solo textural
            img_base64, legenda, img_diag = _create_visual_image(
                img_data_visual, SOLO_TEXTURAL_CLASSES_NOMES, SOLO_TEXTURAL_CLASSES_CORES
            )

            # GeoJSON do polígono
            polygon_geojson = None
            try:
                gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                gdf_sanitized = _sanitize_gdf_for_json(gdf_wgs84)
                polygon_geojson = json.loads(gdf_sanitized.to_json())
                logger.info(
                    f"GeoJSON do polígono gerado: {len(polygon_geojson.get('features', []))} features"
                )
            except Exception as e:
                logger.error(f"Erro ao gerar GeoJSON do polígono: {e}")

            # Centroide
            try:
                if "gdf_wgs84" not in locals():
                    gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                centroid = gdf_wgs84.union_all().centroid
                centroid_coords = [centroid.y, centroid.x]
                lat_gms = decimal_to_gms(centroid.y, True)
                lon_gms = decimal_to_gms(centroid.x, False)
                centroid_display = f"{lat_gms}, {lon_gms}"
                municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
                cd_rta, nm_rta = _get_rta_from_coords(centroid.y, centroid.x)
            except Exception as e:
                logger.warning(f"Erro ao calcular centroide: {e}")
                centroid_coords = None
                centroid_display = "Não disponível"
                municipio, uf = "Não identificado", "Não identificado"
                cd_rta, nm_rta = None, "Não identificado"

            return {
                "status": "sucesso",
                "relatorio": relatorio,
                "polygon_geojson": polygon_geojson,
                "metadados": {
                    "crs": str(tiff_crs),
                    "resolucao_espacial": f"{src.res[0]:.2f} x {src.res[1]:.2f}",
                    "dimensoes_recorte": meta_aux.get("dimensoes_recorte", "N/D"),
                    "area_por_pixel_ha": meta_aux.get("area_por_pixel_ha", None),
                    "area_por_pixel_ha_formatado": meta_aux.get("area_por_pixel_ha_formatado", None),
                    "area_poligono_intersect_raster_ha": round(area_intersec_raster_ha, 4),
                    "data_imagem": datetime.now().strftime("%d/%m/%Y"),
                    "centroide": centroid_coords,
                    "centroide_display": centroid_display,
                    "municipio": municipio,
                    "uf": uf,
                    "cd_rta": cd_rta,
                    "nm_rta": nm_rta,
                },
                "imagem_recortada": {
                    "base64": img_base64,
                    "legenda": legenda,
                    "diagnostics": img_diag,
                }
                if img_base64
                else None,
                "crs_info": crs_info,
            }

    except Exception as e:
        logger.exception(f"Erro em _process_solo_textural_sync: {e}")
        return {
            "status": "erro",
            "mensagem": f"Erro ao processar análise de textura do solo: {str(e)}",
        }


# ==============================================================================
# Processamento síncrono: Análise de Embargo IBAMA
# ==============================================================================
_embargo_gdf = None


def _get_embargo_gdf():
    """Carrega e armazena em cache o shapefile de embargos IBAMA."""
    import geopandas as gpd
    global _embargo_gdf
    if _embargo_gdf is None:
        logger.info(f"Carregando shapefile de embargos: {EMBARGO_SHAPEFILE_PATH}")
        _embargo_gdf = gpd.read_file(str(EMBARGO_SHAPEFILE_PATH))
        logger.info(f"Shapefile de embargos carregado: {len(_embargo_gdf)} registros, CRS={_embargo_gdf.crs}")
    return _embargo_gdf


def _process_embargo_sync(kml_file):
    """Processamento síncrono para verificação de sobreposição com embargos IBAMA."""
    import geopandas as gpd
    try:
        # 1. Parse do arquivo do usuário
        gdf = parse_upload_file(kml_file)
        if isinstance(gdf, tuple):
            gdf, _ = gdf
        if gdf is None or gdf.empty:
            return {"status": "erro", "mensagem": "Arquivo não contém geometrias válidas"}

        # 2. Converter para EPSG:4674 (CRS do shapefile de embargos)
        gdf_wgs84 = gdf.to_crs("EPSG:4674") if gdf.crs and str(gdf.crs) != "EPSG:4674" else gdf.copy()
        geom_union = gdf_wgs84.union_all()

        # 3. Área total do polígono em hectares (via projeção UTM)
        area_poligono_ha = _polygon_area_ha(gdf_wgs84, gdf_wgs84.crs)

        # 4. Carregar embargos (cache) e filtrar pela bbox do polígono
        embargo_gdf_all = _get_embargo_gdf()
        bounds = geom_union.bounds  # (minx, miny, maxx, maxy)
        embargo_bbox = embargo_gdf_all.cx[bounds[0]:bounds[2], bounds[1]:bounds[3]]
        if embargo_bbox.crs and str(embargo_bbox.crs) != "EPSG:4674":
            embargo_bbox = embargo_bbox.to_crs("EPSG:4674")

        # 5. Filtrar apenas os que de fato intersectam
        embargo_intersect = embargo_bbox[embargo_bbox.geometry.intersects(geom_union)].copy()

        # 6. Calcular sobreposições por embargo individual
        embargo_records = []
        geoms_sobrepostas = []

        for _, emb_row in embargo_intersect.iterrows():
            try:
                inter_geom = emb_row.geometry.intersection(geom_union)
                if inter_geom.is_empty:
                    continue

                inter_gdf_tmp = gpd.GeoDataFrame(geometry=[inter_geom], crs="EPSG:4674")
                area_sob_ha = _polygon_area_ha(inter_gdf_tmp, inter_gdf_tmp.crs)
                if area_sob_ha <= 0:
                    continue

                geoms_sobrepostas.append(inter_geom)
                pct = round((area_sob_ha / area_poligono_ha) * 100, 4) if area_poligono_ha > 0 else 0.0

                dat_raw = emb_row.get("dat_embarg", None)
                dat_fmt = dat_raw.strftime("%d/%m/%Y") if dat_raw is not None and hasattr(dat_raw, "strftime") else (str(dat_raw)[:10] if dat_raw else "—")

                embargo_records.append({
                    "num_tad": str(emb_row.get("num_tad", "") or "—"),
                    "dat_embarg": dat_fmt,
                    "des_infrac": str(emb_row.get("des_infrac", "") or "—"),
                    "des_tad": str(emb_row.get("des_tad", "") or "—"),
                    "qtd_area_e": round(float(emb_row.get("qtd_area_e", 0) or 0), 4),
                    "municipio": str(emb_row.get("municipio", "") or "—"),
                    "uf": str(emb_row.get("uf", "") or "—"),
                    "area_sobreposta_ha": round(area_sob_ha, 4),
                    "area_sobreposta_ha_formatado": _format_area_ha(area_sob_ha, 4),
                    "percentual_sobreposicao": pct,
                    "percentual_sobreposicao_formatado": _format_percent(pct, 2),
                })
            except Exception as e:
                logger.warning(f"Erro ao calcular sobreposição de embargo: {e}")
                continue

        # 7. Totais de área embargada
        area_embargada_ha = 0.0
        if geoms_sobrepostas:
            from shapely.ops import unary_union as _unary_union
            geom_total_emb = _unary_union(geoms_sobrepostas)
            area_emb_gdf = gpd.GeoDataFrame(geometry=[geom_total_emb], crs="EPSG:4674")
            area_embargada_ha = _polygon_area_ha(area_emb_gdf, area_emb_gdf.crs)

        pct_emb = round((area_embargada_ha / area_poligono_ha) * 100, 4) if area_poligono_ha > 0 else 0.0
        possui_embargo = len(embargo_records) > 0

        # 8. GeoJSON das áreas de interseção (para Leaflet) — gerado a partir das
        #    geometrias já calculadas no loop, com atributos mínimos conhecidos.
        embargo_geojson = None
        try:
            if geoms_sobrepostas and embargo_records:
                inter_gdf = gpd.GeoDataFrame(
                    [
                        {
                            "num_tad": r["num_tad"],
                            "dat_embarg": r["dat_embarg"],
                            "des_infrac": r["des_infrac"],
                            "area_ha": r["area_sobreposta_ha_formatado"],
                        }
                        for r in embargo_records
                    ],
                    geometry=geoms_sobrepostas,
                    crs="EPSG:4674",
                ).to_crs("EPSG:4326")
                embargo_geojson = json.loads(inter_gdf.to_json())
        except Exception as e:
            logger.warning(f"Erro ao gerar GeoJSON de embargos: {e}")

        # 9. GeoJSON do polígono do usuário
        polygon_geojson = None
        try:
            gdf_san = _sanitize_gdf_for_json(gdf_wgs84)
            polygon_geojson = json.loads(gdf_san.to_json())
        except Exception as e:
            logger.warning(f"Erro ao gerar GeoJSON do polígono: {e}")

        # 10. Metadados
        try:
            centroid = geom_union.centroid
            lat_gms = decimal_to_gms(centroid.y, True)
            lon_gms = decimal_to_gms(centroid.x, False)
            centroid_display = f"{lat_gms}, {lon_gms}"
            municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
            cd_rta, nm_rta = _get_rta_from_coords(centroid.y, centroid.x)
            centroid_coords = [centroid.y, centroid.x]
        except Exception as e:
            logger.warning(f"Erro ao calcular metadados: {e}")
            centroid_coords = None
            centroid_display = "Não disponível"
            municipio, uf = "Não identificado", "Não identificado"
            cd_rta, nm_rta = None, "Não identificado"

        return {
            "status": "sucesso",
            "relatorio": {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "possui_embargo": possui_embargo,
                "numero_embargoes": len(embargo_records),
                "area_embargada_ha": round(area_embargada_ha, 4),
                "area_embargada_ha_formatado": _format_area_ha(area_embargada_ha, 4),
                "area_embargada_percentual": pct_emb,
                "area_embargada_percentual_formatado": _format_percent(pct_emb, 2),
            },
            "embargoes": embargo_records,
            "embargo_geojson": embargo_geojson,
            "polygon_geojson": polygon_geojson,
            "metadados": {
                "centroide": centroid_coords,
                "centroide_display": centroid_display,
                "municipio": municipio,
                "uf": uf,
                "cd_rta": cd_rta,
                "nm_rta": nm_rta,
                "data_analise": datetime.now().strftime("%d/%m/%Y"),
            },
        }

    except Exception as e:
        logger.exception(f"Erro em _process_embargo_sync: {e}")
        return {"status": "erro", "mensagem": f"Erro ao processar análise de embargo: {str(e)}"}


# ==============================================================================
# Processamento síncrono: Análise de Embargo ICMBio
# ==============================================================================
_icmbio_gdf = None


def _get_icmbio_gdf():
    """Carrega e armazena em cache o shapefile de embargos ICMBio."""
    import geopandas as gpd
    global _icmbio_gdf
    if _icmbio_gdf is None:
        logger.info(f"Carregando shapefile ICMBio: {ICMBIO_SHAPEFILE_PATH}")
        _icmbio_gdf = gpd.read_file(str(ICMBIO_SHAPEFILE_PATH), engine='fiona', encoding='latin-1')
        # O shapefile é UTF-8 lido como latin-1 (limitação do pyogrio); corrigir mojibake
        def _fix_enc(val):
            if not isinstance(val, str):
                return val
            try:
                return val.encode('latin-1').decode('utf-8', errors='replace')
            except (UnicodeDecodeError, UnicodeEncodeError):
                return val
        for col in ['desc_infra', 'tipo_infra', 'numero_emb', 'autuado', 'municipio']:
            if col in _icmbio_gdf.columns:
                _icmbio_gdf[col] = _icmbio_gdf[col].apply(_fix_enc)
        logger.info(f"Shapefile ICMBio carregado: {len(_icmbio_gdf)} registros, CRS={_icmbio_gdf.crs}")
    return _icmbio_gdf


def _process_icmbio_sync(kml_file):
    """Processamento síncrono para verificação de sobreposição com embargos ICMBio."""
    import geopandas as gpd
    try:
        # 1. Parse do arquivo do usuário
        gdf = parse_upload_file(kml_file)
        if isinstance(gdf, tuple):
            gdf, _ = gdf
        if gdf is None or gdf.empty:
            return {"status": "erro", "mensagem": "Arquivo não contém geometrias válidas"}

        # 2. Converter para EPSG:4674 (CRS do shapefile ICMBio)
        gdf_wgs84 = gdf.to_crs("EPSG:4674") if gdf.crs and str(gdf.crs) != "EPSG:4674" else gdf.copy()
        geom_union = gdf_wgs84.union_all()

        # 3. Área total do polígono em hectares
        area_poligono_ha = _polygon_area_ha(gdf_wgs84, gdf_wgs84.crs)

        # 4. Carregar ICMBio (cache) e filtrar pela bbox do polígono
        icmbio_gdf_all = _get_icmbio_gdf()
        bounds = geom_union.bounds
        icmbio_bbox = icmbio_gdf_all.cx[bounds[0]:bounds[2], bounds[1]:bounds[3]]
        if icmbio_bbox.crs and str(icmbio_bbox.crs) != "EPSG:4674":
            icmbio_bbox = icmbio_bbox.to_crs("EPSG:4674")

        # 5. Filtrar apenas os que de fato intersectam
        icmbio_intersect = icmbio_bbox[icmbio_bbox.geometry.intersects(geom_union)].copy()

        # 6. Calcular sobreposições por embargo individual
        embargo_records = []
        geoms_sobrepostas = []

        for _, emb_row in icmbio_intersect.iterrows():
            try:
                inter_geom = emb_row.geometry.intersection(geom_union)
                if inter_geom.is_empty:
                    continue

                inter_gdf_tmp = gpd.GeoDataFrame(geometry=[inter_geom], crs="EPSG:4674")
                area_sob_ha = _polygon_area_ha(inter_gdf_tmp, inter_gdf_tmp.crs)
                if area_sob_ha <= 0:
                    continue

                geoms_sobrepostas.append(inter_geom)
                pct = round((area_sob_ha / area_poligono_ha) * 100, 4) if area_poligono_ha > 0 else 0.0

                dat_raw = emb_row.get("data", None)
                dat_fmt = dat_raw.strftime("%d/%m/%Y") if dat_raw is not None and hasattr(dat_raw, "strftime") else (str(dat_raw)[:10] if dat_raw else "—")

                embargo_records.append({
                    "numero_emb": str(emb_row.get("numero_emb", "") or "—"),
                    "data_embargo": dat_fmt,
                    "desc_infra": str(emb_row.get("desc_infra", "") or "—"),
                    "tipo_infra": str(emb_row.get("tipo_infra", "") or "—"),
                    "area_sobreposta_ha": round(area_sob_ha, 4),
                    "area_sobreposta_ha_formatado": _format_area_ha(area_sob_ha, 4),
                    "percentual_sobreposicao": pct,
                    "percentual_sobreposicao_formatado": _format_percent(pct, 2),
                })
            except Exception as e:
                logger.warning(f"Erro ao calcular sobreposição ICMBio: {e}")
                continue

        # 7. Totais de área embargada
        area_embargada_ha = 0.0
        if geoms_sobrepostas:
            from shapely.ops import unary_union as _unary_union
            geom_total_emb = _unary_union(geoms_sobrepostas)
            area_emb_gdf = gpd.GeoDataFrame(geometry=[geom_total_emb], crs="EPSG:4674")
            area_embargada_ha = _polygon_area_ha(area_emb_gdf, area_emb_gdf.crs)

        pct_emb = round((area_embargada_ha / area_poligono_ha) * 100, 4) if area_poligono_ha > 0 else 0.0
        possui_embargo = len(embargo_records) > 0

        # 8. GeoJSON das áreas de interseção (para Leaflet)
        embargo_geojson = None
        try:
            if geoms_sobrepostas and embargo_records:
                inter_gdf = gpd.GeoDataFrame(
                    [
                        {
                            "numero_emb": r["numero_emb"],
                            "data_embargo": r["data_embargo"],
                            "desc_infra": r["desc_infra"],
                            "tipo_infra": r["tipo_infra"],
                            "area_ha": r["area_sobreposta_ha_formatado"],
                        }
                        for r in embargo_records
                    ],
                    geometry=geoms_sobrepostas,
                    crs="EPSG:4674",
                ).to_crs("EPSG:4326")
                embargo_geojson = json.loads(inter_gdf.to_json())
        except Exception as e:
            logger.warning(f"Erro ao gerar GeoJSON ICMBio: {e}")

        # 9. GeoJSON do polígono do usuário
        polygon_geojson = None
        try:
            gdf_san = _sanitize_gdf_for_json(gdf_wgs84)
            polygon_geojson = json.loads(gdf_san.to_json())
        except Exception as e:
            logger.warning(f"Erro ao gerar GeoJSON do polígono: {e}")

        # 10. Metadados
        try:
            centroid = geom_union.centroid
            lat_gms = decimal_to_gms(centroid.y, True)
            lon_gms = decimal_to_gms(centroid.x, False)
            centroid_display = f"{lat_gms}, {lon_gms}"
            municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
            cd_rta, nm_rta = _get_rta_from_coords(centroid.y, centroid.x)
            centroid_coords = [centroid.y, centroid.x]
        except Exception as e:
            logger.warning(f"Erro ao calcular metadados ICMBio: {e}")
            centroid_coords = None
            centroid_display = "Não disponível"
            municipio, uf = "Não identificado", "Não identificado"
            cd_rta, nm_rta = None, "Não identificado"

        return {
            "status": "sucesso",
            "relatorio": {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "possui_embargo": possui_embargo,
                "numero_embargoes": len(embargo_records),
                "area_embargada_ha": round(area_embargada_ha, 4),
                "area_embargada_ha_formatado": _format_area_ha(area_embargada_ha, 4),
                "area_embargada_percentual": pct_emb,
                "area_embargada_percentual_formatado": _format_percent(pct_emb, 2),
            },
            "embargoes": embargo_records,
            "embargo_geojson": embargo_geojson,
            "polygon_geojson": polygon_geojson,
            "metadados": {
                "centroide": centroid_coords,
                "centroide_display": centroid_display,
                "municipio": municipio,
                "uf": uf,
                "cd_rta": cd_rta,
                "nm_rta": nm_rta,
                "data_analise": datetime.now().strftime("%d/%m/%Y"),
            },
        }

    except Exception as e:
        logger.exception(f"Erro em _process_icmbio_sync: {e}")
        return {"status": "erro", "mensagem": f"Erro ao processar análise ICMBio: {str(e)}"}


# ==============================================================================
# Rota: Análise de Embargo ICMBio
# ==============================================================================
@app.route("/analisar-icmbio", methods=["POST"])
def analisar_icmbio():
    """Endpoint para verificação de sobreposição com embargos ICMBio."""
    logger.info("=== INICIANDO ANÁLISE DE EMBARGO ICMBio ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo selecionado"}), 400

    if not _allowed_file(input_file.filename):
        return jsonify({
            "status": "erro",
            "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .geojson, .shp ou .gpkg",
        }), 400

    if not os.path.exists(str(ICMBIO_SHAPEFILE_PATH)):
        logger.error(f"Shapefile ICMBio não encontrado: {ICMBIO_SHAPEFILE_PATH}")
        return jsonify({"status": "erro", "mensagem": "Base de embargos ICMBio não disponível no servidor"}), 500

    try:
        logger.info(f"Arquivo recebido: filename={input_file.filename}")
        result = _process_icmbio_sync(input_file)

        if isinstance(result, dict):
            status = result.get("status", "erro")
            try:
                safe = _sanitize_response(result)
            except Exception:
                safe = result
            return jsonify(safe), (200 if status == "sucesso" else 400)
        else:
            return jsonify({"status": "erro", "mensagem": "Resposta do processamento inválida"}), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_icmbio: {e}")
        return jsonify({"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}), 500


# ==============================================================================
# Rota: Análise de Classe Textural do Solo (MapBiomas)
# ==============================================================================
@app.route("/analisar-solo-textural", methods=["POST"])
def analisar_solo_textural():
    """Endpoint para análise de classe textural do solo (MapBiomas)."""
    logger.info("=== INICIANDO ANÁLISE DE TEXTURA DO SOLO ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo selecionado"}), 400

    if not _allowed_file(input_file.filename):
        return jsonify({
            "status": "erro",
            "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .geojson, .shp ou .gpkg",
        }), 400

    raster_path = RASTER_SOLO_TEXTURAL_PATH

    if not os.path.exists(raster_path):
        logger.error(f"Raster de textura do solo não encontrado: {raster_path}")
        return jsonify({
            "status": "erro",
            "mensagem": "Raster de textura do solo não disponível no servidor",
        }), 500

    logger.info(f"Usando raster de textura do solo: {raster_path}")

    try:
        logger.info(
            f"Arquivo recebido: filename={input_file.filename}, content_type={input_file.content_type}"
        )
        result = _process_solo_textural_sync(input_file, raster_path)

        if isinstance(result, dict):
            status = result.get("status", "erro")
            try:
                safe = _sanitize_response(result)
            except Exception:
                safe = result
            return jsonify(safe), (200 if status == "sucesso" else 400)
        else:
            return jsonify(
                {"status": "erro", "mensagem": "Resposta do processamento inválida"}
            ), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_solo_textural: {e}")
        return jsonify(
            {"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}
        ), 500


# ==============================================================================
# Rota: Análise de Embargo IBAMA
# ==============================================================================
@app.route("/analisar-embargo", methods=["POST"])
def analisar_embargo():
    """Endpoint para verificação de sobreposição com embargos IBAMA."""
    logger.info("=== INICIANDO ANÁLISE DE EMBARGO IBAMA ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo selecionado"}), 400

    if not _allowed_file(input_file.filename):
        return jsonify({
            "status": "erro",
            "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .geojson, .shp ou .gpkg",
        }), 400

    if not os.path.exists(str(EMBARGO_SHAPEFILE_PATH)):
        logger.error(f"Shapefile de embargos não encontrado: {EMBARGO_SHAPEFILE_PATH}")
        return jsonify({"status": "erro", "mensagem": "Base de embargos não disponível no servidor"}), 500

    try:
        logger.info(f"Arquivo recebido: filename={input_file.filename}")
        result = _process_embargo_sync(input_file)

        if isinstance(result, dict):
            status = result.get("status", "erro")
            try:
                safe = _sanitize_response(result)
            except Exception:
                safe = result
            return jsonify(safe), (200 if status == "sucesso" else 400)
        else:
            return jsonify({"status": "erro", "mensagem": "Resposta do processamento inválida"}), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_embargo: {e}")
        return jsonify({"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}), 500


# ==============================================================================
# Processamento síncrono: Análise de Aptidão Agronômica
# ==============================================================================
def _process_aptidao_sync(kml_file, raster_path):
    """Processamento síncrono para análise de aptidão agronômica."""
    try:
        gdf = parse_upload_file(kml_file)
        if isinstance(gdf, tuple):
            return gdf

        with rasterio.open(raster_path) as src:
            tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)

            logger.info(f"📊 Raster Aptidão - Resolução: {src.res[0]}m x {src.res[1]}m")
            pixel_area = _pixel_area_ha(src)
            logger.info(
                f"📐 Área por pixel: {pixel_area:.4f} ha ({pixel_area * 10000:.0f} m²)"
            )

            gdf_tiff, crs_info = _convert_gdf_to_raster_crs(gdf, tiff_crs)
            geom_union = unary_union(gdf_tiff.geometry)

            if geom_union.is_empty:
                return {
                    "status": "erro",
                    "mensagem": "Polígono inválido após processamento.",
                }

            area_poligono_ha = _polygon_area_ha(gdf_tiff, tiff_crs)
            area_intersec_raster_ha = _intersect_area_ha(geom_union, tiff_crs, src)

            if area_intersec_raster_ha == 0:
                return {
                    "status": "erro",
                    "mensagem": "Polígono não possui interseção com a área do raster de aptidão.",
                }

            cog_optimizations = _optimize_cog_reading(src, gdf_tiff.total_bounds)

            area_classes_total_ha, areas_por_classe_ha, img_data_visual, meta_aux = (
                _fractional_stats(src, gdf_tiff, cog_optimizations)
            )

            # Filtrar apenas classes válidas (1-5)
            classes_validas = {1, 2, 3, 4, 5}
            areas_filtradas = {}
            area_invalida = 0.0

            for cls, area_ha in areas_por_classe_ha.items():
                if cls in classes_validas:
                    areas_filtradas[cls] = area_ha
                else:
                    logger.warning(
                        f"⚠️ Classe inválida {cls} encontrada no raster com {area_ha:.4f} ha - será ignorada"
                    )
                    area_invalida += area_ha

            areas_por_classe_ha = areas_filtradas
            area_classes_total_ha = sum(areas_por_classe_ha.values())

            if area_invalida > 0:
                logger.info(
                    f"📊 Área com classes inválidas: {area_invalida:.4f} ha ({(area_invalida / area_poligono_ha * 100):.2f}%)"
                )

            # Ajustar diferenças de área
            dif_ha = area_poligono_ha - area_classes_total_ha
            tol = 1e-4
            if dif_ha > tol:
                areas_por_classe_ha[0] = areas_por_classe_ha.get(0, 0.0) + dif_ha
            elif dif_ha < -tol:
                fator = area_poligono_ha / (
                    area_classes_total_ha if area_classes_total_ha > 0 else 1.0
                )
                for k in list(areas_por_classe_ha.keys()):
                    areas_por_classe_ha[k] *= fator

            # Preparar relatório
            total_ref = area_poligono_ha if area_poligono_ha > 0 else 1.0
            relatorio = {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(
                    area_poligono_ha, 4
                ),
                "area_analisada_ha": round(area_poligono_ha, 4),
                "area_analisada_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "numero_classes_encontradas": len(
                    [c for c in areas_por_classe_ha if c != 0 and c in classes_validas]
                ),
                "classes": {},
                "metodo_utilizado": "pixel_parcial_otimizado",
            }

            for cls, area_ha in sorted(
                areas_por_classe_ha.items(), key=lambda k: -k[1]
            ):
                if cls == 0 or cls not in classes_validas:
                    continue
                percent = round((area_ha / total_ref) * 100, 4)
                relatorio["classes"][f"Classe {int(cls)}"] = {
                    "descricao": APTIDAO_CLASSES_NOMES.get(
                        int(cls), f"Classe {int(cls)}"
                    ),
                    "descricao_completa": APTIDAO_CLASSES_DESCRICOES.get(int(cls), ""),
                    "area_ha": round(area_ha, 4),
                    "area_ha_formatado": _format_area_ha(round(area_ha, 4), 4),
                    "percentual": percent,
                    "percentual_formatado": _format_percent(percent, 2),
                }

            # Gerar imagem com cores de aptidão
            img_base64, legenda, img_diag = _create_visual_image(
                img_data_visual, APTIDAO_CLASSES_NOMES, APTIDAO_CLASSES_CORES
            )

            # GeoJSON do polígono
            polygon_geojson = None
            try:
                gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                gdf_sanitized = _sanitize_gdf_for_json(gdf_wgs84)
                polygon_geojson = json.loads(gdf_sanitized.to_json())
            except Exception as e:
                logger.error(f"Erro ao gerar GeoJSON do polígono: {e}")

            # Centroide
            try:
                if "gdf_wgs84" not in locals():
                    gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                centroid = gdf_wgs84.union_all().centroid
                centroid_coords = [centroid.y, centroid.x]
                lat_gms = decimal_to_gms(centroid.y, True)
                lon_gms = decimal_to_gms(centroid.x, False)
                centroid_display = f"{lat_gms}, {lon_gms}"
                municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
                cd_rta, nm_rta = _get_rta_from_coords(centroid.y, centroid.x)
            except Exception as e:
                logger.warning(f"Erro ao calcular centroide: {e}")
                centroid_coords = None
                centroid_display = "Não disponível"
                municipio, uf = "Não identificado", "Não identificado"
                cd_rta, nm_rta = None, "Não identificado"

            return {
                "status": "sucesso",
                "relatorio": relatorio,
                "polygon_geojson": polygon_geojson,
                "metadados": {
                    "crs": str(tiff_crs),
                    "resolucao_espacial": f"{src.res[0]:.2f} x {src.res[1]:.2f}",
                    "dimensoes_recorte": meta_aux.get("dimensoes_recorte", "N/D"),
                    "area_por_pixel_ha": meta_aux.get("area_por_pixel_ha", None),
                    "area_por_pixel_ha_formatado": meta_aux.get(
                        "area_por_pixel_ha_formatado", None
                    ),
                    "area_poligono_intersect_raster_ha": round(
                        area_intersec_raster_ha, 4
                    ),
                    "data_imagem": datetime.now().strftime("%d/%m/%Y"),
                    "centroide": centroid_coords,
                    "centroide_display": centroid_display,
                    "municipio": municipio,
                    "uf": uf,
                    "cd_rta": cd_rta,
                    "nm_rta": nm_rta,
                },
                "imagem_recortada": {
                    "base64": img_base64,
                    "legenda": legenda,
                    "diagnostics": img_diag,
                }
                if img_base64
                else None,
                "crs_info": crs_info,
            }

    except Exception as e:
        logger.exception(f"Erro em _process_aptidao_sync: {e}")
        return {
            "status": "erro",
            "mensagem": f"Erro ao processar análise de aptidão: {str(e)}",
        }


# ==============================================================================
# Rota: Conversão para GeoJSON
# ==============================================================================
@app.route("/convert_to_geojson", methods=["POST"])
def convert_to_geojson():
    """Converte Shapefile ou KMZ para GeoJSON para visualização no mapa."""
    logger.info("=== CONVERSÃO PARA GEOJSON ===")

    if "file" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["file"]
    if input_file.filename == "":
        return jsonify(
            {"status": "erro", "mensagem": "Nenhum arquivo selecionado"}
        ), 400

    filename = getattr(input_file, "filename", "") or ""
    filename.lower()

    try:
        # Tentar processar qualquer extensão aceita pelo frontend via dispatch
        gdf = parse_upload_file(input_file)

        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        elif gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        gdf_sanitized = _sanitize_gdf_for_json(gdf)
        geojson = json.loads(gdf_sanitized.to_json())

        logger.info(
            f"Conversão bem-sucedida: {filename} -> GeoJSON com {len(geojson.get('features', []))} features"
        )

        return jsonify(
            {"status": "sucesso", "geojson": geojson, "filename": filename}
        ), 200

    except Exception as e:
        logger.error(f"Erro na conversão: {e}")
        return jsonify(
            {"status": "erro", "mensagem": f"Erro ao converter arquivo: {str(e)}"}
        ), 400


# ==============================================================================
# Rota: Análise de Uso do Solo
# ==============================================================================
@app.route("/analisar", methods=["POST"])
def analisar_imagem():
    logger.info("=== INICIANDO ANÁLISE SÍNCRONA ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify(
            {"status": "erro", "mensagem": "Nenhum arquivo selecionado"}
        ), 400

    if not _allowed_file(input_file.filename):
        return jsonify(
            {
                "status": "erro",
                "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .geojson, .shp ou .gpkg",
            }
        ), 400

    raster_type = request.form.get("raster_type", "com_mosaico")
    enable_valoracao = request.form.get("enable_valoracao", "true").lower() == "true"
    logger.info(
        f"Módulo de valoração: {'habilitado' if enable_valoracao else 'desabilitado'}"
    )

    if raster_type == "sem_mosaico":
        raster_path = str(BASE_DIR / "data" / "LULC_Alpha_Biomas_radius_10.tif")
    else:
        raster_path = str(BASE_DIR / "data" / "LULC_VALORACAO_10m_com_mosaico.tif")

    if not os.path.exists(raster_path):
        logger.warning(f"Arquivo raster {raster_path} não encontrado, usando padrão")
        raster_path = TIFF_PATH

    logger.info(f"Usando raster: {raster_path}")

    try:
        logger.info(
            f"Arquivo recebido para análise: filename={input_file.filename}, content_type={input_file.content_type}"
        )
        result = _process_analysis_sync(input_file, raster_path, enable_valoracao)

        if isinstance(result, dict):
            status = result.get("status", "erro")
            try:
                safe = _sanitize_response(result)
            except Exception:
                safe = result
            return jsonify(safe), (200 if status == "sucesso" else 400)
        else:
            return jsonify(
                {"status": "erro", "mensagem": "Resposta do processamento inválida"}
            ), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_imagem: {e}")
        return jsonify(
            {"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}
        ), 500


# ==============================================================================
# Rota: Análise de Declividade
# ==============================================================================
@app.route("/analisar-declividade", methods=["POST"])
def analisar_declividade():
    """Endpoint para análise de declividade usando raster ALOS."""
    logger.info("=== INICIANDO ANÁLISE DE DECLIVIDADE ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify(
            {"status": "erro", "mensagem": "Nenhum arquivo selecionado"}
        ), 400

    if not _allowed_file(input_file.filename):
        return jsonify(
            {
                "status": "erro",
                "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .geojson, .shp ou .gpkg",
            }
        ), 400

    raster_path = str(BASE_DIR / "data" / "ALOS_Declividade_Class_BR_majority_r2.tif")

    if not os.path.exists(raster_path):
        logger.error(f"Raster de declividade não encontrado: {raster_path}")
        return jsonify(
            {
                "status": "erro",
                "mensagem": "Raster de declividade não disponível no servidor",
            }
        ), 500

    logger.info(f"Usando raster de declividade: {raster_path}")

    try:
        logger.info(
            f"Arquivo recebido: filename={input_file.filename}, content_type={input_file.content_type}"
        )
        result = _process_declividade_sync(input_file, raster_path)

        if isinstance(result, dict):
            status = result.get("status", "erro")
            try:
                safe = _sanitize_response(result)
            except Exception:
                safe = result
            return jsonify(safe), (200 if status == "sucesso" else 400)
        else:
            return jsonify(
                {"status": "erro", "mensagem": "Resposta do processamento inválida"}
            ), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_declividade: {e}")
        return jsonify(
            {"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}
        ), 500


# ==============================================================================
# Rota: Análise de Aptidão Agronômica
# ==============================================================================
@app.route("/analisar-aptidao", methods=["POST"])
def analisar_aptidao():
    """Endpoint para análise de aptidão usando o raster correspondente."""
    logger.info("=== INICIANDO ANÁLISE DE APTIDAO ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify(
            {"status": "erro", "mensagem": "Nenhum arquivo selecionado"}
        ), 400

    if not _allowed_file(input_file.filename):
        return jsonify(
            {
                "status": "erro",
                "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .geojson, .shp ou .gpkg",
            }
        ), 400

    raster_path = RASTER_APTIDAO_PATH

    if not os.path.exists(raster_path):
        logger.error(f"Raster de aptidão não encontrado: {raster_path}")
        return jsonify(
            {
                "status": "erro",
                "mensagem": "Raster de aptidão não disponível no servidor",
            }
        ), 500

    logger.info(f"Usando raster de aptidão: {raster_path}")

    try:
        logger.info(
            f"Arquivo recebido: filename={input_file.filename}, content_type={input_file.content_type}"
        )
        result = _process_aptidao_sync(input_file, raster_path)

        if isinstance(result, dict):
            status = result.get("status", "erro")
            try:
                safe = _sanitize_response(result)
            except Exception:
                safe = result
            return jsonify(safe), (200 if status == "sucesso" else 400)
        else:
            return jsonify(
                {"status": "erro", "mensagem": "Resposta do processamento inválida"}
            ), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_aptidao: {e}")
        return jsonify(
            {"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}
        ), 500


# ==============================================================================
# Rota: Acompanhamento de Progresso
# ==============================================================================
@app.route("/analisar-lote-progresso/<task_id>", methods=["GET"])
def analisar_lote_progresso(task_id):
    prog = progress_tasks.get(
        task_id, {"current": 0, "total": 0, "label": "Aguardando..."}
    )
    return jsonify(prog)


# ==============================================================================
# Rota: Análise de Lote Completo (Uso do Solo, Declividade, Aptidão)
# ==============================================================================
@app.route("/analisar-lote-completo", methods=["POST"])
def analisar_lote_completo():
    logger.info("=== INICIANDO ANÁLISE DE LOTE COMPLETO ===")

    if "file" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["file"]
    if input_file.filename == "":
        return jsonify(
            {"status": "erro", "mensagem": "Nenhum arquivo selecionado"}
        ), 400

    if not _allowed_file(input_file.filename):
        return jsonify({"status": "erro", "mensagem": "Extensão inválida."}), 400

    analises_str = request.form.get("analises", '["uso_solo"]')
    try:
        analises = json.loads(analises_str)
    except (json.JSONDecodeError, TypeError):
        analises = ["uso_solo"]

    task_id = request.form.get("task_id", None)
    include_centroid = request.form.get("include_centroid", "false").lower() == "true"
    include_wkt = request.form.get("include_wkt", "false").lower() == "true"

    raster_type = request.form.get("raster_type", "com_mosaico")

    # Paths
    raster_usosolo_path = (
        str(BASE_DIR / "data" / "LULC_VALORACAO_10m_com_mosaico.tif")
        if raster_type == "com_mosaico"
        else str(BASE_DIR / "data" / "LULC_Alpha_Biomas_radius_10.tif")
    )
    if not os.path.exists(raster_usosolo_path):
        raster_usosolo_path = TIFF_PATH

    raster_declividade_path = str(
        BASE_DIR / "data" / "ALOS_Declividade_Class_BR_majority_r2.tif"
    )
    raster_aptidao_path = RASTER_APTIDAO_PATH
    raster_solo_textural_path = RASTER_SOLO_TEXTURAL_PATH

    try:
        import geopandas as gpd

        gdf = parse_upload_file(input_file)
        if isinstance(gdf, tuple):
            return jsonify(
                {"status": "erro", "mensagem": "Erro no parse do arquivo"}
            ), 400

        resultados = []
        total_polygons = len(gdf)

        if task_id:
            progress_tasks[task_id] = {
                "current": 0,
                "total": total_polygons,
                "label": f"Preparando {total_polygons} polígonos...",
            }

        # Abrir rasters necessários (dependendo do que foi selecionado)
        src_uso = rasterio.open(raster_usosolo_path) if "uso_solo" in analises else None
        src_dec = (
            rasterio.open(raster_declividade_path)
            if "declividade" in analises
            else None
        )
        src_apt = rasterio.open(raster_aptidao_path) if "aptidao" in analises else None
        src_stx = (
            rasterio.open(raster_solo_textural_path)
            if "soloTextural" in analises and os.path.exists(raster_solo_textural_path)
            else None
        )

        # Pré-carregar embargos em cache se necessário
        embargo_gdf_lote = None
        if "embargo" in analises and os.path.exists(str(EMBARGO_SHAPEFILE_PATH)):
            embargo_gdf_lote = _get_embargo_gdf()

        icmbio_gdf_lote = None
        if "icmbio" in analises and os.path.exists(str(ICMBIO_SHAPEFILE_PATH)):
            icmbio_gdf_lote = _get_icmbio_gdf()

        # Vamos usar um CRS de referência. O uso do solo é epsg:4674.
        ref_crs = src_uso.crs if src_uso and src_uso.crs else CRS.from_epsg(4674)
        gdf_proj, _ = _convert_gdf_to_raster_crs(gdf, ref_crs)

        for _i, (idx, row) in enumerate(gdf_proj.iterrows()):
            logger.info(f"Processando polígono {_i + 1} de {total_polygons}...")
            if task_id:
                progress_tasks[task_id] = {
                    "current": _i + 1,
                    "total": total_polygons,
                    "label": f"Analisando polígono {_i + 1} de {total_polygons}...",
                }

            geom = row.geometry
            if geom.is_empty:
                continue

            base_dict = {
                str(k): v
                for k, v in row.to_dict().items()
                if k != "geometry" and not str(k).startswith("_")
            }
            single_gdf = gpd.GeoDataFrame([row], crs=gdf_proj.crs)
            area_poligono_ha = _polygon_area_ha(single_gdf, ref_crs)
            base_record = base_dict.copy()
            base_record["área_imovel_ha"] = round(area_poligono_ha, 4)

            # Calcular centroide se solicitado
            if include_centroid or include_wkt:
                try:
                    single_wgs84 = single_gdf.to_crs("EPSG:4326")
                    if include_centroid:
                        centroid = single_wgs84.union_all().centroid
                        base_record["Centroide_Lat"] = round(centroid.y, 6)
                        base_record["Centroide_Lon"] = round(centroid.x, 6)
                    if include_wkt:
                        base_record["Geometria_WKT"] = single_wgs84.union_all().wkt
                except Exception as e:
                    logger.warning(
                        f"Erro ao calcular centroide/WKT do polígono {idx}: {e}"
                    )
                    if include_centroid:
                        base_record["Centroide_Lat"] = ""
                        base_record["Centroide_Lon"] = ""
                    if include_wkt:
                        base_record["Geometria_WKT"] = ""

            has_results = False

            # --- USO DO SOLO ---
            if "uso_solo" in analises and src_uso:
                try:
                    cog_uso = _optimize_cog_reading(src_uso, single_gdf.total_bounds)
                    area_tot_uso, areas_uso, _, _ = _fractional_stats(
                        src_uso, single_gdf, cog_uso
                    )
                    # Ajuste do total
                    dif_ha = area_poligono_ha - area_tot_uso
                    if dif_ha > 1e-4:
                        areas_uso[0] = areas_uso.get(0, 0.0) + dif_ha
                    elif dif_ha < -1e-4:
                        fator = area_poligono_ha / (
                            area_tot_uso if area_tot_uso > 0 else 1.0
                        )
                        for k in list(areas_uso.keys()):
                            areas_uso[k] *= fator

                    for cls_id, area_ha in areas_uso.items():
                        if area_ha > 0:
                            record = base_record.copy()
                            record["Tipo Análise"] = "Uso do Solo"
                            record["DN"] = int(cls_id)
                            record["Descrição"] = CLASSES_NOMES.get(
                                int(cls_id), f"Classe {int(cls_id)}"
                            )
                            record["área_classe_ha"] = round(area_ha, 4)
                            resultados.append(record)
                            has_results = True
                    logger.info(f"  - Uso do Solo concluído para polígono {_i + 1}.")
                except Exception as e:
                    logger.warning(f"Erro em uso do solo {idx}: {e}")

            # --- DECLIVIDADE ---
            if "declividade" in analises and src_dec:
                try:
                    crs_dec = src_dec.crs if src_dec.crs else CRS.from_epsg(4674)
                    gdf_dec, _ = _convert_gdf_to_raster_crs(single_gdf, crs_dec)
                    cog_dec = _optimize_cog_reading(src_dec, gdf_dec.total_bounds)
                    area_tot_dec, areas_dec, _, _ = _fractional_stats(
                        src_dec, gdf_dec, cog_dec
                    )

                    # Filtra classes validas declividade (1-8)
                    areas_validas = {
                        k: v
                        for k, v in areas_dec.items()
                        if k in {1, 2, 3, 4, 5, 6, 7, 8}
                    }
                    area_tot_valida = sum(areas_validas.values())

                    dif_ha = area_poligono_ha - area_tot_valida
                    if dif_ha > 1e-4:
                        areas_validas[0] = areas_validas.get(0, 0.0) + dif_ha
                    elif dif_ha < -1e-4:
                        fator = area_poligono_ha / (
                            area_tot_valida if area_tot_valida > 0 else 1.0
                        )
                        for k in list(areas_validas.keys()):
                            areas_validas[k] *= fator

                    for cls_id, area_ha in areas_validas.items():
                        if area_ha > 0 and cls_id != 0:
                            record = base_record.copy()
                            record["Tipo Análise"] = "Declividade"
                            record["DN"] = int(cls_id)
                            record["Descrição"] = DECLIVIDADE_CLASSES_NOMES.get(
                                int(cls_id), f"Classe {int(cls_id)}"
                            )
                            record["área_classe_ha"] = round(area_ha, 4)
                            resultados.append(record)
                            has_results = True
                    logger.info(f"  - Declividade concluída para polígono {_i + 1}.")
                except Exception as e:
                    logger.warning(f"Erro em declividade {idx}: {e}")

            # --- APTIDAO ---
            if "aptidao" in analises and src_apt:
                try:
                    crs_apt = src_apt.crs if src_apt.crs else CRS.from_epsg(4674)
                    gdf_apt, _ = _convert_gdf_to_raster_crs(single_gdf, crs_apt)
                    cog_apt = _optimize_cog_reading(src_apt, gdf_apt.total_bounds)
                    area_tot_apt, areas_apt, _, _ = _fractional_stats(
                        src_apt, gdf_apt, cog_apt
                    )

                    # Filtra turmas validas aptidao (1-5)
                    areas_validas = {
                        k: v for k, v in areas_apt.items() if k in {1, 2, 3, 4, 5}
                    }
                    area_tot_valida = sum(areas_validas.values())

                    dif_ha = area_poligono_ha - area_tot_valida
                    if dif_ha > 1e-4:
                        areas_validas[0] = areas_validas.get(0, 0.0) + dif_ha
                    elif dif_ha < -1e-4:
                        fator = area_poligono_ha / (
                            area_tot_valida if area_tot_valida > 0 else 1.0
                        )
                        for k in list(areas_validas.keys()):
                            areas_validas[k] *= fator

                    for cls_id, area_ha in areas_validas.items():
                        if area_ha > 0 and cls_id != 0:
                            record = base_record.copy()
                            record["Tipo Análise"] = "Aptidão"
                            record["DN"] = int(cls_id)
                            record["Descrição"] = APTIDAO_CLASSES_NOMES.get(
                                int(cls_id), f"Classe {int(cls_id)}"
                            )
                            record["área_classe_ha"] = round(area_ha, 4)
                            resultados.append(record)
                            has_results = True
                    logger.info(f"  - Aptidão concluída para polígono {_i + 1}.")
                except Exception as e:
                    logger.warning(f"Erro em aptidao {idx}: {e}")

            # --- SOLO TEXTURAL ---
            if "soloTextural" in analises and src_stx:
                try:
                    crs_stx = src_stx.crs if src_stx.crs else CRS.from_epsg(4674)
                    gdf_stx, _ = _convert_gdf_to_raster_crs(single_gdf, crs_stx)
                    cog_stx = _optimize_cog_reading(src_stx, gdf_stx.total_bounds)
                    area_tot_stx, areas_stx, _, _ = _fractional_stats(
                        src_stx, gdf_stx, cog_stx
                    )

                    areas_validas = {
                        k: v for k, v in areas_stx.items() if k in set(range(1, 14))
                    }
                    area_tot_valida = sum(areas_validas.values())

                    dif_ha = area_poligono_ha - area_tot_valida
                    if dif_ha > 1e-4:
                        areas_validas[0] = areas_validas.get(0, 0.0) + dif_ha
                    elif dif_ha < -1e-4:
                        fator = area_poligono_ha / (
                            area_tot_valida if area_tot_valida > 0 else 1.0
                        )
                        for k in list(areas_validas.keys()):
                            areas_validas[k] *= fator

                    for cls_id, area_ha in areas_validas.items():
                        if area_ha > 0 and cls_id != 0:
                            record = base_record.copy()
                            record["Tipo Análise"] = "Solo Textural"
                            record["DN"] = int(cls_id)
                            record["Descrição"] = SOLO_TEXTURAL_CLASSES_NOMES.get(
                                int(cls_id), f"Classe {int(cls_id)}"
                            )
                            record["área_classe_ha"] = round(area_ha, 4)
                            resultados.append(record)
                            has_results = True
                    logger.info(f"  - Solo Textural concluído para polígono {_i + 1}.")
                except Exception as e:
                    logger.warning(f"Erro em solo textural {idx}: {e}")

            # --- ANÁLISE DE EMBARGO IBAMA ---
            if "embargo" in analises and embargo_gdf_lote is not None:
                try:
                    import geopandas as gpd
                    single_wgs84 = single_gdf.to_crs("EPSG:4674") if str(single_gdf.crs) != "EPSG:4674" else single_gdf
                    geom_u = single_wgs84.union_all()
                    bnds = geom_u.bounds
                    emb_bbox = embargo_gdf_lote.cx[bnds[0]:bnds[2], bnds[1]:bnds[3]]
                    emb_bbox = emb_bbox.to_crs("EPSG:4674") if emb_bbox.crs and str(emb_bbox.crs) != "EPSG:4674" else emb_bbox
                    emb_inter = emb_bbox[emb_bbox.geometry.intersects(geom_u)]

                    if emb_inter.empty:
                        record = base_record.copy()
                        record["Tipo Análise"] = "Embargo IBAMA"
                        record["DN"] = 0
                        record["Descrição"] = "Sem embargo"
                        record["área_classe_ha"] = 0.0
                        record["num_tad"] = ""
                        record["dat_embarg"] = ""
                        record["des_infrac"] = ""
                        resultados.append(record)
                    else:
                        for emb_dn, (_, emb_row) in enumerate(emb_inter.iterrows(), start=1):
                            inter_g = emb_row.geometry.intersection(geom_u)
                            if inter_g.is_empty:
                                continue
                            inter_tmp = gpd.GeoDataFrame(geometry=[inter_g], crs="EPSG:4674")
                            area_sob = _polygon_area_ha(inter_tmp, inter_tmp.crs)
                            if area_sob <= 0:
                                continue
                            dat_r = emb_row.get("dat_embarg", None)
                            dat_s = dat_r.strftime("%d/%m/%Y") if dat_r is not None and hasattr(dat_r, "strftime") else (str(dat_r)[:10] if dat_r else "")
                            record = base_record.copy()
                            record["Tipo Análise"] = "Embargo IBAMA"
                            record["DN"] = emb_dn
                            record["Descrição"] = str(emb_row.get("des_infrac", "") or "—")
                            record["área_classe_ha"] = round(area_sob, 4)
                            record["num_tad"] = str(emb_row.get("num_tad", "") or "")
                            record["dat_embarg"] = dat_s
                            record["des_infrac"] = str(emb_row.get("des_infrac", "") or "")
                            resultados.append(record)
                            has_results = True
                    logger.info(f"  - Embargo concluído para polígono {_i + 1}.")
                except Exception as e:
                    logger.warning(f"Erro em embargo {idx}: {e}")

            # --- ANÁLISE DE EMBARGO ICMBio ---
            if "icmbio" in analises and icmbio_gdf_lote is not None:
                try:
                    import geopandas as gpd
                    single_wgs84 = single_gdf.to_crs("EPSG:4674") if str(single_gdf.crs) != "EPSG:4674" else single_gdf
                    geom_u = single_wgs84.union_all()
                    bnds = geom_u.bounds
                    icm_bbox = icmbio_gdf_lote.cx[bnds[0]:bnds[2], bnds[1]:bnds[3]]
                    icm_bbox = icm_bbox.to_crs("EPSG:4674") if icm_bbox.crs and str(icm_bbox.crs) != "EPSG:4674" else icm_bbox
                    icm_inter = icm_bbox[icm_bbox.geometry.intersects(geom_u)]

                    if icm_inter.empty:
                        record = base_record.copy()
                        record["Tipo Análise"] = "Embargo ICMBio"
                        record["DN"] = 0
                        record["Descrição"] = "Sem embargo"
                        record["área_classe_ha"] = 0.0
                        record["numero_emb"] = ""
                        record["data_embargo"] = ""
                        record["desc_infra"] = ""
                        record["tipo_infra"] = ""
                        resultados.append(record)
                    else:
                        for icm_dn, (_, icm_row) in enumerate(icm_inter.iterrows(), start=1):
                            inter_g = icm_row.geometry.intersection(geom_u)
                            if inter_g.is_empty:
                                continue
                            inter_tmp = gpd.GeoDataFrame(geometry=[inter_g], crs="EPSG:4674")
                            area_sob = _polygon_area_ha(inter_tmp, inter_tmp.crs)
                            if area_sob <= 0:
                                continue
                            dat_r = icm_row.get("data", None)
                            dat_s = dat_r.strftime("%d/%m/%Y") if dat_r is not None and hasattr(dat_r, "strftime") else (str(dat_r)[:10] if dat_r else "")
                            record = base_record.copy()
                            record["Tipo Análise"] = "Embargo ICMBio"
                            record["DN"] = icm_dn
                            record["Descrição"] = str(icm_row.get("desc_infra", "") or "—")
                            record["área_classe_ha"] = round(area_sob, 4)
                            record["numero_emb"] = str(icm_row.get("numero_emb", "") or "")
                            record["data_embargo"] = dat_s
                            record["desc_infra"] = str(icm_row.get("desc_infra", "") or "")
                            record["tipo_infra"] = str(icm_row.get("tipo_infra", "") or "")
                            resultados.append(record)
                            has_results = True
                    logger.info(f"  - ICMBio concluído para polígono {_i + 1}.")
                except Exception as e:
                    logger.warning(f"Erro em icmbio {idx}: {e}")

            if not has_results:
                record = base_record.copy()
                record["Tipo Análise"] = "Sem Análise"
                record["DN"] = ""
                record["Descrição"] = "-"
                record["área_classe_ha"] = 0.0
                resultados.append(record)

        # Fechar rasters
        if src_uso:
            src_uso.close()
        if src_dec:
            src_dec.close()
        if src_apt:
            src_apt.close()

        if task_id and task_id in progress_tasks:
            del progress_tasks[task_id]

        if not resultados:
            return jsonify(
                {"status": "erro", "mensagem": "Nenhum resultado processado"}
            ), 400

        df_resultados = pd.DataFrame(resultados).fillna(0)

        csv_buffer = io.StringIO()
        df_resultados.to_csv(csv_buffer, index=False, sep=";", decimal=",")
        csv_buffer.seek(0)

        return send_file(
            io.BytesIO(csv_buffer.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name="analise_lote_completa.csv",
        )

    except Exception as e:
        logger.exception("Erro em analisar_lote_completo")
        if task_id and task_id in progress_tasks:
            del progress_tasks[task_id]
        return jsonify(
            {"status": "erro", "mensagem": f"Erro fatal ao processar lote: {str(e)}"}
        ), 500


# ==============================================================================
# Rota: Análise de Uso do Solo em Lote e CSV
# ==============================================================================
@app.route("/analisar-multiplos-csv", methods=["POST"])
def analisar_multiplos_csv():
    logger.info("=== INICIANDO ANÁLISE DE MÚLTIPLOS POLÍGONOS (CSV) ===")

    if "file" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["file"]
    if input_file.filename == "":
        return jsonify(
            {"status": "erro", "mensagem": "Nenhum arquivo selecionado"}
        ), 400

    if not _allowed_file(input_file.filename):
        return jsonify(
            {
                "status": "erro",
                "mensagem": "Extensão inválida. Envie um arquivo .kml, .kmz, .shp, .geojson ou .gpkg",
            }
        ), 400

    raster_type = request.form.get("raster_type", "com_mosaico")
    include_centroid = request.form.get("include_centroid", "false").lower() == "true"
    include_wkt = request.form.get("include_wkt", "false").lower() == "true"

    if raster_type == "sem_mosaico":
        raster_path = str(BASE_DIR / "data" / "LULC_Alpha_Biomas_radius_10.tif")
    else:
        raster_path = str(BASE_DIR / "data" / "LULC_VALORACAO_10m_com_mosaico.tif")

    if not os.path.exists(raster_path):
        logger.warning(f"Arquivo raster {raster_path} não encontrado, usando padrão")
        raster_path = TIFF_PATH

    logger.info(f"Usando raster: {raster_path}")

    try:
        logger.info(
            f"Arquivo recebido para análise em lote: filename={input_file.filename}"
        )

        # 1. Carregar GeoDataFrame
        gdf = parse_upload_file(input_file)
        if isinstance(gdf, tuple):
            return jsonify({"status": "erro", "mensagem": "Erro no parse"}), 400

        with rasterio.open(raster_path) as src:
            tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)

            # Converter para o CRS do raster para calcular áreas corretamente
            import geopandas as gpd

            gdf_tiff, _ = _convert_gdf_to_raster_crs(gdf, tiff_crs)

            resultados = []

            # 2. Iterar cada polígono/linha do GeoDataFrame individualmente
            for idx, row in gdf_tiff.iterrows():
                geom = row.geometry

                # Criar dicionário base ignorando a geometria e os indexers padrões do geopandas
                base_dict = {
                    str(k): v
                    for k, v in row.to_dict().items()
                    if k != "geometry" and not str(k).startswith("_")
                }

                if geom.is_empty:
                    continue

                # O processamento fractional necessita de um gdf
                single_gdf = gpd.GeoDataFrame([row], crs=gdf_tiff.crs)

                # Calcular área total do polígono em hectares
                area_poligono_ha = _polygon_area_ha(single_gdf, tiff_crs)

                # 3. Realizar `_fractional_stats` para o polígono individual
                try:
                    cog_optimizations = _optimize_cog_reading(
                        src, single_gdf.total_bounds
                    )
                    area_classes_total_ha, areas_por_classe_ha, _, _ = (
                        _fractional_stats(src, single_gdf, cog_optimizations)
                    )

                    if area_classes_total_ha == 0:
                        continue

                    # Ajustar diferenças de área (Adiciona áreas não mapeadas do raster na Classe 0)
                    dif_ha = area_poligono_ha - area_classes_total_ha
                    tol = 1e-4
                    if dif_ha > tol:
                        areas_por_classe_ha[0] = (
                            areas_por_classe_ha.get(0, 0.0) + dif_ha
                        )
                    elif dif_ha < -tol:
                        fator = area_poligono_ha / (
                            area_classes_total_ha if area_classes_total_ha > 0 else 1.0
                        )
                        for k in list(areas_por_classe_ha.keys()):
                            areas_por_classe_ha[k] *= fator

                    # Pré-calcular centroide e WKT uma vez por polígono
                    centroid_lat = ""
                    centroid_lon = ""
                    wkt_geom = ""
                    if include_centroid or include_wkt:
                        try:
                            single_wgs84 = single_gdf.to_crs("EPSG:4326")
                            if include_centroid:
                                centroid = single_wgs84.union_all().centroid
                                centroid_lat = round(centroid.y, 6)
                                centroid_lon = round(centroid.x, 6)
                            if include_wkt:
                                wkt_geom = single_wgs84.union_all().wkt
                        except Exception as e:
                            logger.warning(
                                f"Erro ao calcular centroide/WKT do polígono {idx}: {e}"
                            )

                    # 4. Criar registro de resultado para CADA classe encontrada no polígono atual
                    for cls, area_ha in areas_por_classe_ha.items():
                        if area_ha > 0:
                            record = base_dict.copy()
                            record["área_imovel_ha"] = round(area_poligono_ha, 4)
                            if include_centroid:
                                record["Centroide_Lat"] = centroid_lat
                                record["Centroide_Lon"] = centroid_lon
                            if include_wkt:
                                record["Geometria_WKT"] = wkt_geom
                            record["DN"] = int(cls)
                            record["Descrição"] = CLASSES_NOMES.get(
                                int(cls), f"Classe {int(cls)}"
                            )
                            record["área_classe_ha"] = round(area_ha, 4)
                            resultados.append(record)

                except Exception as e:
                    logger.warning(f"Erro ao processar a feição {idx}: {e}")

            if not resultados:
                return jsonify(
                    {
                        "status": "erro",
                        "mensagem": "Nenhuma intersecção útil encontrada para gerar o arquivo CSV",
                    }
                ), 400

            # 5. Converter de volta usando pandas e gerar Buffer
            df_resultados = pd.DataFrame(resultados)

            csv_buffer = io.StringIO()
            # Usando decimal=',' para garantir suporte a Excel em pt-BR
            df_resultados.to_csv(csv_buffer, index=False, sep=";", decimal=",")
            csv_buffer.seek(0)

            # 6. Preparar envio do arquivo
            return send_file(
                io.BytesIO(csv_buffer.getvalue().encode("utf-8-sig")),
                mimetype="text/csv",
                as_attachment=True,
                download_name="analise_multiplos_poligonos.csv",
            )

    except Exception as e:
        logger.exception(f"Exceção em analisar_multiplos_csv: {e}")
        return jsonify(
            {
                "status": "erro",
                "mensagem": f"Erro ao processar as métricas do arquivo: {str(e)}",
            }
        ), 500


# ==============================================================================
# Rota: Buscar CAR por cod_imovel
# ==============================================================================
@app.route("/buscar-car", methods=["GET"])
def buscar_car():
    """Busca CARs pelo código do imóvel no GeoPackage."""
    query = request.args.get("q", "").strip()
    if not query or len(query) < 3:
        return jsonify({"status": "erro", "mensagem": "Digite pelo menos 3 caracteres"}), 400

    car_path = str(CAR_GPKG_PATH)
    if not os.path.exists(car_path):
        logger.warning(f"Arquivo CAR GPKG não encontrado: {car_path}")
        return jsonify({"status": "erro", "mensagem": "Base de dados CAR não disponível"}), 500

    try:
        import geopandas as gpd
        import fiona

        # Descobrir o nome da camada
        layers = fiona.listlayers(car_path)
        layer_name = layers[0] if layers else None

        if not layer_name:
            return jsonify({"status": "erro", "mensagem": "Nenhuma camada encontrada no GPKG"}), 500

        # Busca via SQL para eficiência (evita carregar tudo em memória)
        safe_query = query.replace("'", "''")
        query_normalized = safe_query.replace('-', '')  # aceita input com ou sem hífens
        sql = f"SELECT * FROM \"{layer_name}\" WHERE UPPER(REPLACE(cod_imovel, '-', '')) LIKE UPPER('%{query_normalized}%') LIMIT 10"

        logger.info(f"[CAR] Buscando: {query}")
        gdf = gpd.read_file(car_path, sql=sql)

        if gdf.empty:
            return jsonify({"status": "sucesso", "resultados": []}), 200

        # Converter para WGS84 para exibir no mapa
        if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        resultados = []
        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue

            centroid = geom.centroid
            # Extrair campos relevantes
            attrs = {}
            for col in gdf.columns:
                if col != 'geometry':
                    val = row[col]
                    if pd.isna(val):
                        attrs[col] = None
                    else:
                        attrs[col] = str(val) if not isinstance(val, (int, float, str, bool)) else val

            resultados.append({
                "cod_imovel": str(row.get("cod_imovel", "")),
                "atributos": attrs,
                "centroid": [centroid.y, centroid.x],
                "geojson": json.loads(gpd.GeoDataFrame([row], crs=gdf.crs).to_json())
            })

        logger.info(f"[CAR] Encontrados {len(resultados)} resultados para '{query}'")
        return jsonify({"status": "sucesso", "resultados": resultados}), 200

    except Exception as e:
        logger.exception(f"Erro ao buscar CAR: {e}")
        return jsonify({"status": "erro", "mensagem": f"Erro na busca: {str(e)}"}), 500


# ==============================================================================
# Rota: Buscar CAR por coordenada (point-in-polygon)
# ==============================================================================
@app.route("/buscar-car-por-coordenada", methods=["GET"])
def buscar_car_por_coordenada():
    """Busca CARs que contêm um ponto geográfico específico."""
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"results": []}), 400

    car_path = str(CAR_GPKG_PATH)
    if not os.path.exists(car_path):
        logger.warning(f"Arquivo CAR GPKG não encontrado: {car_path}")
        return jsonify({"results": []}), 500

    try:
        import geopandas as gpd
        import fiona
        from shapely.geometry import Point

        # Descobrir o nome da camada
        layers = fiona.listlayers(car_path)
        layer_name = layers[0] if layers else None

        if not layer_name:
            return jsonify({"results": []}), 500

        # Usar mask para eficiência: gpd.read_file com mask usa o índice espacial do GPKG
        point_geom = Point(lon, lat)  # lon, lat é a ordem do Shapely
        gdf = gpd.read_file(car_path, mask=point_geom)

        if gdf.empty:
            return jsonify({"results": []}), 200

        # Converter para WGS84 se necessário
        if gdf.crs and gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        # Filtro exato: ponto deve estar dentro do polígono
        gdf = gdf[gdf.geometry.contains(point_geom)]

        resultados = []
        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue

            centroid = geom.centroid
            resultados.append({
                "cod_imovel": str(row.get("cod_imovel", "")),
                "centroid": [centroid.y, centroid.x],
                "geojson": json.loads(gpd.GeoDataFrame([row], crs=gdf.crs).to_json())
            })

        logger.info(f"[CAR] Encontrados {len(resultados)} imóvel(is) na coordenada ({lat}, {lon})")
        return jsonify({"results": resultados}), 200

    except Exception as e:
        logger.exception(f"Erro ao buscar CAR por coordenada: {e}")
        return jsonify({"results": []}), 500


# ==============================================================================
# Main
# ==============================================================================
if __name__ == "__main__":
    logger.info("=== INICIANDO SERVIDOR ===")
    logger.info(f"Diretório base: {BASE_DIR}")
    logger.info(f"Verificando TIFF: {TIFF_PATH}")
    logger.info(f"TIFF existe: {os.path.exists(TIFF_PATH)}")
    logger.info(f"Index.html existe: {os.path.exists(BASE_DIR / 'index.html')}")
    logger.info("Abra http://localhost:5000 no navegador.")
    debug_mode = True
    app.run(debug=debug_mode, host="0.0.0.0", port=5000, use_reloader=False)
