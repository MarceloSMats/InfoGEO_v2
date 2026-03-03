# -*- coding: utf-8 -*-
"""
InfoGEO – Valoração agronômica
================================
Centroides, quadrantes, MACRO_RTA, notas agronômicas e cálculo
de valor por classe.
"""

import logging
import traceback
from pathlib import Path
from functools import lru_cache

import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import transform as shapely_transform
from pyproj import Transformer

from .utils import _format_number_ptbr, _parse_number_ptbr

logger = logging.getLogger("lulc-analyzer")

BASE_DIR = Path(__file__).parent.parent

# Caminhos
CENTROIDES_PATH = BASE_DIR / "data" / "Centroides_BR.geojson"
#MICRO_CLASSES_EXCEL_PATH = BASE_DIR / "data" / "CD_MICRO_CLASSES.xlsx"
MICRO_CLASSES_EXCEL_PATH = BASE_DIR / "data" / "nota_agronomica_por_tipo_microrregiao.csv"
MACRO_RTA_PATH = BASE_DIR / "data" / "MACRO_RTA" / "MACRO_RTA.shp"

# Caches globais
MACRO_RTA_GDF = None


# ------------------------------------------------------------------------------
# Carregamento de dados
# ------------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _load_centroides_gdf():
    """Carrega o GeoJSON de centroides/quadrantes com caching.
    Retorna GeoDataFrame ou None."""
    if not CENTROIDES_PATH.exists():
        logger.warning(f"GeoJSON Centroides não encontrado: {CENTROIDES_PATH}")
        return None
    try:
        gdf = gpd.read_file(str(CENTROIDES_PATH))
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        logger.info(f"Centroides GeoJSON carregado. Registros: {len(gdf)}")
        return gdf
    except Exception as e:
        logger.error(f"Falha ao carregar GeoJSON Centroides: {e}")
        return None


@lru_cache(maxsize=1)
def _load_micro_classes_df():
    """Carrega o Excel CD_MICRO_CLASSES.xlsx com caching.
    Retorna DataFrame ou None."""
    if not MICRO_CLASSES_EXCEL_PATH.exists():
        logger.warning(
            f"Excel CD_MICRO_CLASSES não encontrado: {MICRO_CLASSES_EXCEL_PATH}"
        )
        return None
    try:
        df = pd.read_excel(str(MICRO_CLASSES_EXCEL_PATH))
        logger.info(f"CD_MICRO_CLASSES Excel carregado. Registros: {len(df)}")
        return df
    except Exception as e:
        logger.error(f"Falha ao carregar CD_MICRO_CLASSES Excel: {e}")
        return None


@lru_cache(maxsize=1)
def _load_macro_rta_gdf():
    """Carrega o shapefile MACRO_RTA_2025 com as microregiões.

    IMPORTANTE: CD_RTA (campo do shapefile) = CD_MICR_GEO (campo do Excel)
    São códigos idênticos para identificar as microrregiões geográficas.
    """
    global MACRO_RTA_GDF
    if MACRO_RTA_GDF is not None:
        logger.info("📦 Usando MACRO_RTA em cache")
        return MACRO_RTA_GDF

    if not MACRO_RTA_PATH.exists():
        logger.error(f"❌ Shapefile MACRO_RTA não encontrado: {MACRO_RTA_PATH}")
        MACRO_RTA_GDF = None
        return None

    try:
        logger.info(f"📂 Carregando MACRO_RTA de: {MACRO_RTA_PATH}")
        gdf = gpd.read_file(str(MACRO_RTA_PATH))
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        elif gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        MACRO_RTA_GDF = gdf
        logger.info(
            f"✅ MACRO_RTA shapefile carregado: {len(gdf)} regiões, CRS: {gdf.crs}"
        )
        logger.info(f"   Colunas: {gdf.columns.tolist()}")

        if "CD_RTA" in gdf.columns:
            sample_cd = sorted(gdf["CD_RTA"].unique())[:10]
            logger.info(f"   Amostra CD_RTA: {sample_cd}")
            logger.info("   ℹ️ CD_RTA será usado como CD_MICR_GEO no Excel")
        else:
            logger.error(
                f"   ❌ Campo CD_RTA não encontrado! Colunas: {gdf.columns.tolist()}"
            )

        return MACRO_RTA_GDF
    except Exception as e:
        logger.error(f"❌ Falha ao carregar shapefile MACRO_RTA: {e}")
        logger.error(traceback.format_exc())
        MACRO_RTA_GDF = None
        return None


# ------------------------------------------------------------------------------
# Busca de CD_RTA (microregião)
# ------------------------------------------------------------------------------
def _get_cd_rta_from_centroid(centroid_point_wgs84: Point):
    """Busca o CD_RTA (código de microregião) através de cruzamento espacial com MACRO_RTA.

    Args:
        centroid_point_wgs84: Ponto do centroide em WGS84 (EPSG:4326)

    Returns:
        int: CD_RTA encontrado ou None se não encontrado
    """
    try:
        logger.info(
            f"🌍 Centroide recebido: Lat={centroid_point_wgs84.y:.6f}, Lon={centroid_point_wgs84.x:.6f}"
        )

        gdf_macro = _load_macro_rta_gdf()
        if gdf_macro is None or gdf_macro.empty:
            logger.error("❌ Shapefile MACRO_RTA não carregado ou vazio!")
            return None

        logger.info(
            f"📍 MACRO_RTA carregado: {len(gdf_macro)} regiões, CRS: {gdf_macro.crs}"
        )

        if gdf_macro.crs.to_string() != "EPSG:4326":
            logger.info(f"🔄 Transformando centroide de EPSG:4326 para {gdf_macro.crs}")
            transformer = Transformer.from_crs(
                "EPSG:4326", gdf_macro.crs, always_xy=True
            )
            centroid_transformed = shapely_transform(
                transformer.transform, centroid_point_wgs84
            )
            logger.info(f"   Centroide transformado para: {centroid_transformed}")
        else:
            centroid_transformed = centroid_point_wgs84
            logger.info("✅ CRS já é EPSG:4326, sem necessidade de transformação")

        logger.info("🔍 Buscando região que contém o centroide...")
        matches = gdf_macro[gdf_macro.geometry.contains(centroid_transformed)]

        if matches.empty:
            logger.warning(
                "⚠️ Nenhuma região contém exatamente o ponto. Tentando intersects..."
            )
            matches = gdf_macro[gdf_macro.geometry.intersects(centroid_transformed)]

        if matches.empty:
            logger.error(
                f"❌ Centroide ({centroid_point_wgs84.x:.6f}, {centroid_point_wgs84.y:.6f}) não encontrado em nenhuma região MACRO_RTA"
            )
            logger.error(f"   Total de regiões no shapefile: {len(gdf_macro)}")
            logger.error(f"   Bounds do shapefile: {gdf_macro.total_bounds}")
            return None

        cd_rta = matches.iloc[0]["CD_RTA"]
        nm_rta = matches.iloc[0].get("NM_RTA", "Desconhecido")
        uf_rta = matches.iloc[0].get("UF", "N/A")

        logger.info(f"✅ CD_RTA encontrado: {cd_rta} ({nm_rta} - {uf_rta})")
        logger.info(
            "   Este valor será usado como CD_MICR_GEO para buscar as notas agronômicas"
        )

        return int(cd_rta)

    except Exception as e:
        logger.error(f"❌ Erro ao buscar CD_RTA por cruzamento espacial: {e}")
        logger.error(traceback.format_exc())
        return None


# ------------------------------------------------------------------------------
# Notas agronômicas
# ------------------------------------------------------------------------------
def _get_nota_from_micro_classe(cd_micr_geo: int, cls_num: int):
    """Extrai a NOTA_AGRONOMICA para uma classe numa microregião usando o Excel.

    O arquivo CD_MICRO_CLASSES.xlsx contém:
    - CD_MICR_GEO: código da microregião
    - COD_DN: código da classe de uso do solo
    - NOTA_AGRONOMICA: nota agronômica para essa combinação

    Args:
        cd_micr_geo: Código da microregião (extraído do shapefile)
        cls_num: Número da classe de uso do solo (COD_DN)

    Returns:
        float: Nota agronômica ou None se não encontrado
    """
    try:
        df = _load_micro_classes_df()
        if df is None or df.empty:
            logger.warning("⚠️ DataFrame de micro_classes vazio ou não carregado")
            return None

        logger.info(
            f"🔍 Buscando nota: CD_MICR_GEO={cd_micr_geo} (tipo: {type(cd_micr_geo).__name__}), COD_DN={cls_num}"
        )

        try:
            cd_micr_geo_int = int(cd_micr_geo)
            cls_num_int = int(cls_num)
        except (ValueError, TypeError) as e:
            logger.error(f"❌ Erro ao converter parâmetros para int: {e}")
            return None

        matches = df[
            (df["CD_MICR_GEO"] == cd_micr_geo_int) & (df["COD_DN"] == cls_num_int)
        ]

        if matches.empty:
            logger.warning(
                f"⚠️ Nenhuma linha encontrada para CD_MICR_GEO={cd_micr_geo_int}, COD_DN={cls_num_int}"
            )
            logger.info(
                f"   Valores únicos de CD_MICR_GEO no Excel: {sorted(df['CD_MICR_GEO'].unique())[:20]}"
            )
            logger.info(
                f"   Valores únicos de COD_DN no Excel: {sorted(df['COD_DN'].unique())}"
            )
            return None

        nota_val = matches.iloc[0]["NOTA_AGRONOMICA"]

        if nota_val is None or (isinstance(nota_val, float) and nota_val != nota_val):
            logger.warning(
                f"⚠️ NOTA_AGRONOMICA é None/NaN para CD_MICR_GEO={cd_micr_geo_int}, COD_DN={cls_num_int}"
            )
            return None

        try:
            nota_float = float(str(nota_val).replace(",", "."))
            logger.info(
                f"✅ Nota encontrada: CD_MICR_GEO={cd_micr_geo_int}, COD_DN={cls_num_int}, NOTA={nota_float}"
            )
            return nota_float
        except Exception as e:
            logger.warning(f"❌ Erro ao parsear NOTA_AGRONOMICA '{nota_val}': {e}")
            return None

    except Exception as e:
        logger.error(f"❌ Erro geral ao buscar nota: {e}")
        logger.error(traceback.format_exc())
        return None


# ------------------------------------------------------------------------------
# Informações do quadrante
# ------------------------------------------------------------------------------
def _get_quadrante_info_from_centroid(centroid_point_wgs84: Point):
    """Dado um Point em WGS84, retorna (codigo_quadrante, valor_quadrante, atributos, mensagem)
    ou (None, None, {}, 'Centroide sem valor')"""
    gdf = _load_centroides_gdf()
    if gdf is None or gdf.empty:
        return None, None, {}, "Centroide sem valor"

    try:
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        if gdf.crs.to_string() != "EPSG:4326":
            gdf_wgs = gdf.to_crs("EPSG:4326")
        else:
            gdf_wgs = gdf
    except Exception:
        gdf_wgs = gdf

    try:
        matches = gdf_wgs[gdf_wgs.geometry.contains(centroid_point_wgs84)]
        if matches.empty:
            matches = gdf_wgs[gdf_wgs.geometry.intersects(centroid_point_wgs84)]
        if matches.empty:
            return None, None, {}, "Centroide sem valor"

        feat = matches.iloc[0]
        col_code = None
        col_value = None

        known_code_names = ["CD_VL_CEND_IMV_RRL"]
        known_value_names = ["VL_CEND_AVLC_IMV"]

        for c in feat.index:
            uc = str(c).upper()
            if uc in known_code_names and col_code is None:
                col_code = c
            if uc in known_value_names and col_value is None:
                col_value = c

        if col_code is None:
            for c in feat.index:
                uc = str(c).upper()
                if (
                    ("CD_VL" in uc)
                    or ("CD" in uc and "CEND" in uc)
                    or ("COD" in uc and "CEND" in uc)
                ):
                    col_code = c
                    break

        if col_value is None:
            for c in feat.index:
                uc = str(c).upper()
                if "VL_CEND" in uc or "AVLC" in uc or "VAL" in uc or "VALOR" in uc:
                    col_value = c
                    break

        code_val = (
            feat.get(col_code)
            if (col_code is not None and col_code in feat.index)
            else None
        )
        val_raw = (
            feat.get(col_value)
            if (col_value is not None and col_value in feat.index)
            else None
        )

        try:
            parsed_val = _parse_number_ptbr(val_raw)
            val = parsed_val if parsed_val is not None else 1.0
        except Exception:
            val = 1.0

        attrs = {
            k: (None if pd.isna(v) else v) for k, v in feat.items() if k != "geometry"
        }
        try:
            attrs["codigo_quadrante"] = code_val
        except Exception:
            attrs["codigo_quadrante"] = None
        try:
            attrs["valor_quadrante_raw"] = val_raw
        except Exception:
            attrs["valor_quadrante_raw"] = None

        # Etapa 2: Buscar CD_RTA
        try:
            logger.info(f"\n{'─' * 80}")
            logger.info("🔍 ETAPA 2/3: BUSCANDO CD_RTA (Código da Microregião)")
            logger.info(f"{'─' * 80}")
            logger.info("   Método: Cruzamento espacial do centroide com MACRO_RTA.shp")
            logger.info(
                f"   Centroide: Lat={centroid_point_wgs84.y:.6f}, Lon={centroid_point_wgs84.x:.6f}"
            )

            cd_rta = _get_cd_rta_from_centroid(centroid_point_wgs84)

            if cd_rta is not None:
                attrs["CD_RTA"] = cd_rta
                attrs["CD_MICR_GEO"] = cd_rta
                attrs["cd_micr_geo"] = cd_rta
                attrs["CD_MICR_GE"] = cd_rta

                logger.info(f"✅ CD_RTA obtido com sucesso: {cd_rta}")
                logger.info("   ℹ️ CD_RTA = CD_MICR_GEO (mesmo código de microregião)")
                logger.info(
                    "   Será usado para buscar notas no Excel CD_MICRO_CLASSES.xlsx"
                )
                logger.info(f"{'─' * 80}\n")
            else:
                logger.error("❌ FALHA CRÍTICA: CD_RTA não foi encontrado!")
                logger.error("   CONSEQUÊNCIA: Notas agronômicas usarão fallback 1.0")
                logger.error(f"{'─' * 80}\n")
                attrs["CD_MICR_GEO"] = None
                attrs["cd_micr_geo"] = None
                attrs["CD_RTA"] = None
        except Exception as e:
            logger.error(f"❌ EXCEÇÃO ao buscar CD_RTA: {e}")
            logger.error(traceback.format_exc())
            attrs["CD_MICR_GEO"] = None
            attrs["cd_micr_geo"] = None
            attrs["CD_RTA"] = None

        # Campos formatados para UI
        try:
            attrs["valor_quadrante"] = val
            attrs["valor_quadrante_formatado"] = _format_number_ptbr(val, 2)
            attrs["VL_CEND_AVLC_IMVL_formatted"] = _format_number_ptbr(val, 2)

            # cod_dn heurístico
            try:
                cod_dn = None
                for k, v in list(attrs.items()):
                    ku = str(k).upper()
                    if cod_dn is None and (
                        ku == "COD_DN"
                        or ku == "CODDN"
                        or ku.startswith("DN_")
                        or ("COD" in ku and "DN" in ku)
                        or ("CD_" in ku and "DN" in ku)
                    ):
                        cod_dn = v
                if cod_dn is None:
                    for k, v in list(attrs.items()):
                        ku = str(k).upper()
                        if (
                            cod_dn is None
                            and "DN" in ku
                            and any(ch.isdigit() for ch in str(v))
                        ):
                            cod_dn = v
                attrs["cod_dn"] = cod_dn
                attrs["COD_DN"] = cod_dn
            except Exception:
                attrs["cod_dn"] = None
                attrs["COD_DN"] = None

            try:
                nota_val = None
                if "NOTA_AGRONOMICA" in attrs:
                    nota_val = attrs.get("NOTA_AGRONOMICA")
                else:
                    for k, v in list(attrs.items()):
                        if "NOTA" in str(k).upper():
                            nota_val = v
                            break
                attrs["nota_agronomica"] = nota_val
            except Exception:
                attrs["nota_agronomica"] = None
        except Exception:
            attrs["VL_CEND_AVLC_IMVL_formatted"] = str(val)

        logger.info(f"Quadrante raw value: {val_raw} -> parsed: {val}")

        return code_val, val, attrs, None
    except Exception as e:
        logger.warning(f"Erro ao buscar quadrante por centroide: {e}")
        return None, None, {}, "Centroide sem valor"


# ------------------------------------------------------------------------------
# Cálculo de valoração por classe (extraído de _process_analysis_sync)
# ------------------------------------------------------------------------------
def calculate_valoracao(relatorio, centroid_point, valor_quadrante_result):
    """Calcula a valoração agronômica para cada classe do relatório.

    Args:
        relatorio: dict com chave 'classes' contendo as classes analisadas
        centroid_point: shapely.geometry.Point do centroide (WGS84)
        valor_quadrante_result: tuple (quadrante_code, valor_quadrante, quad_attrs, quad_msg)

    Returns:
        tuple: (relatorio_atualizado, quadrante_code, valor_quadrante, quad_attrs, quad_msg)
    """
    quadrante_code, valor_quadrante, quad_attrs, quad_msg = valor_quadrante_result

    # Se o quadrante não foi encontrado
    if (
        quad_msg == "Centroide sem valor"
        or quadrante_code is None
        or valor_quadrante is None
    ):
        relatorio["valor_total_calculado"] = None
        return relatorio, quadrante_code, valor_quadrante, quad_attrs, quad_msg

    # Extrair CD_MICR_GEO
    logger.info(f"\n{'=' * 80}")
    logger.info("🔍 ETAPA 3/3: PREPARANDO DADOS PARA CÁLCULO DE VALORAÇÃO")
    logger.info(f"{'=' * 80}")

    cd_micr_geo = None
    if isinstance(quad_attrs, dict):
        cd_micr_geo = (
            quad_attrs.get("CD_RTA")
            or quad_attrs.get("CD_MICR_GEO")
            or quad_attrs.get("cd_micr_geo")
            or quad_attrs.get("CD_MICR_GE")
            or quad_attrs.get("cd_micr_ge")
            or quad_attrs.get("CD_MICR__1")
        )

    logger.info(
        f"📊 Atributos disponíveis no quadrante: {list(quad_attrs.keys()) if isinstance(quad_attrs, dict) else 'N/A'}"
    )
    logger.info(f"🎯 CD_MICR_GEO extraído: {cd_micr_geo}")
    logger.info(f"💰 Valor do quadrante: R$ {valor_quadrante:,.2f}")

    if cd_micr_geo is None:
        logger.error(f"\n{'!' * 80}")
        logger.error("❌ ERRO CRÍTICO: CD_MICR_GEO NÃO ENCONTRADO!")
        logger.error(f"{'!' * 80}")
        logger.error(
            "   ⚠️ CONSEQUÊNCIA: Notas agronômicas = 1.0 (CÁLCULOS INCORRETOS!)"
        )
        logger.error(f"{'!' * 80}\n")
    else:
        logger.info(f"✅ CD_MICR_GEO pronto para uso: {cd_micr_geo}")
        logger.info(f"   Busca: WHERE CD_MICR_GEO={cd_micr_geo} AND COD_DN=<classe>")

    logger.info(f"{'=' * 80}\n")

    total_valor_poligono = 0.0
    logger.info(f"\n{'=' * 80}")
    logger.info("🧮 CÁLCULOS DE VALORAÇÃO POR CLASSE")
    logger.info(f"{'=' * 80}")
    logger.info("   Fórmula: Valor = Área (ha) × Nota Agronômica × Valor do Quadrante")
    logger.info(f"{'=' * 80}\n")

    for cls_key, cls_info in relatorio["classes"].items():
        try:
            cls_num = int(str(cls_key).split()[-1])
            area_ha = float(cls_info.get("area_ha", 0.0))

            nota = None
            if cd_micr_geo is not None:
                logger.info(
                    f"🔍 Buscando nota para: CD_MICR_GEO={cd_micr_geo}, Classe={cls_num}"
                )
                nota = _get_nota_from_micro_classe(cd_micr_geo, cls_num)
            else:
                logger.warning(
                    f"⚠️ Classe {cls_num}: CD_MICR_GEO é None, pulando busca de nota"
                )

            if nota is None:
                logger.error(
                    f"❌ Classe {cls_num}: Nota não encontrada (arquivos base ausentes ou classe não mapeada)."
                )
                relatorio["classes"][cls_key]["valor_calculado"] = None
                relatorio["classes"][cls_key]["valor_calculado_formatado"] = (
                    "Erro: Sem Índice Agronômico"
                )
                # Não adiciona ao total da propriedade, pois o valor é desconhecido
            else:
                logger.info(f"📈 Classe {cls_num}:")
                logger.info(f"   Área: {area_ha:.4f} ha")
                logger.info(f"   Nota agronômica: {nota}")
                logger.info(f"   Valor quadrante: R$ {valor_quadrante:,.2f}")
                logger.info(
                    f"   💰 Cálculo: {area_ha:.4f} × {nota} × {valor_quadrante:,.2f} = R$ {area_ha * nota * valor_quadrante:,.2f}\n"
                )

                valor_calc = area_ha * float(nota) * float(valor_quadrante)
                valor_calc_rounded = round(valor_calc, 4)

                relatorio["classes"][cls_key]["valor_calculado"] = valor_calc_rounded
                relatorio["classes"][cls_key]["valor_calculado_formatado"] = (
                    _format_number_ptbr(valor_calc_rounded, 2)
                )
                total_valor_poligono += valor_calc
        except Exception as e:
            logger.warning(f"Falha ao calcular valor para classe {cls_key}: {e}")

    total_rounded = round(total_valor_poligono, 4)
    try:
        relatorio["valor_total_calculado"] = total_rounded
        relatorio["valor_total_calculado_formatado"] = _format_number_ptbr(
            total_rounded, 2
        )
    except Exception:
        relatorio["valor_total_calculado"] = total_rounded

    return relatorio, quadrante_code, valor_quadrante, quad_attrs, quad_msg
