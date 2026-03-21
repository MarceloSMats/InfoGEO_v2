# -*- coding: utf-8 -*-
"""
InfoGEO – Exportação KML (genérico/extensível)
===============================================
Vetoriza pixels de um recorte raster em polígonos agrupados por classe
e gera arquivo KML usando simplekml.

Design extensível: aceita qualquer combinação de raster_path + nomes/cores
de classes, portanto funciona para análises existentes e futuras.
"""

import logging
from pathlib import Path

import numpy as np
import geopandas as gpd
import rasterio
from rasterio.crs import CRS
from rasterio.windows import from_bounds
from rasterio.features import rasterize, shapes
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely.validation import make_valid
from pyproj import Transformer

import simplekml

logger = logging.getLogger("lulc-analyzer")


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def _hex_to_kml_color(hex_color: str, alpha_int: int = 255) -> str:
    """Converte cor hex #RRGGBB para formato KML usando simplekml."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        hex_color = "CCCCCC"
    
    kml_base = simplekml.Color.hex(hex_color)
    return simplekml.Color.changealphaint(alpha_int, kml_base)


# ------------------------------------------------------------------------------
# Função principal — genérica e extensível
# ------------------------------------------------------------------------------
def gerar_kml(
    raster_path: str,
    polygon_geojson: dict,
    classes_nomes: dict,
    classes_cores: dict,
    nome_documento: str = "InfoGEO - Exportação",
    include_zero_class: bool = False,
) -> str:
    """Vetoriza o raster recortado pelo polígono e gera KML.

    Args:
        raster_path:      Caminho absoluto para o arquivo raster (TIFF/COG).
        polygon_geojson:  GeoJSON do polígono de recorte (FeatureCollection).
        classes_nomes:    Dict {int_classe: "Nome da classe"}.
        classes_cores:    Dict {int_classe: "#RRGGBB"}.
        nome_documento:   Nome do documento raiz no KML.
        include_zero_class: Se True, inclui a classe 0 (NoData).

    Returns:
        String com o conteúdo KML completo.
    """
    logger.info(f"[KML Export] Iniciando exportação: {nome_documento}")
    logger.info(f"[KML Export] Raster: {raster_path}")

    # --- 1. Carregar polígono e preparar geometria ---
    gdf = gpd.GeoDataFrame.from_features(
        polygon_geojson["features"], crs="EPSG:4326"
    )

    with rasterio.open(raster_path) as src:
        tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)

        # Converter polígono para CRS do raster
        gdf_raster_crs = gdf.to_crs(tiff_crs)
        geom_union = unary_union(gdf_raster_crs.geometry)
        geom_union = make_valid(geom_union)

        # --- 2. Recortar e ler raster por POLÍGONO individual ---
        # Garantir que não carregamos bounding boxes gigantes se houver
        # múltiplos polígonos distantes entre si na mesma exportação.
        
        # Obter todas as geometrias (separando multipolígonos se houver)
        geoms_list = []
        for raw_geom in gdf_raster_crs.geometry:
            valid_geom = make_valid(raw_geom)
            if isinstance(valid_geom, MultiPolygon):
                geoms_list.extend(list(valid_geom.geoms))
            elif isinstance(valid_geom, Polygon):
                geoms_list.append(valid_geom)
            elif isinstance(valid_geom, GeometryCollection):
                geoms_list.extend([g for g in valid_geom.geoms if isinstance(g, (Polygon, MultiPolygon))])
                
        vetores_por_classe = {}
        for poly_geom in geoms_list:
            if poly_geom.is_empty:
                continue

            res_x = src.transform.a
            res_y = abs(src.transform.e)
            buffer_dist = max(res_x, res_y)
            
            buffered_geom = poly_geom.buffer(buffer_dist)
            bounds = buffered_geom.bounds
            
            try:
                window = from_bounds(*bounds, transform=src.transform)
                window = window.round_offsets().round_lengths()
                window = window.crop(height=src.height, width=src.width)
            except Exception as e:
                logger.warning(f"Erro ao calcular window para o polígono: {e}")
                continue

            if window.width <= 0 or window.height <= 0:
                continue # Polígono fora do raster

            data = src.read(1, window=window, masked=True)
            data_arr = np.asarray(data.filled(0), dtype=np.int32)
            window_transform = rasterio.windows.transform(window, src.transform)

            valid_mask = data_arr > 0

            # --- 3. Vetorizar pixels e Recortar bordas ---
            for geom_dict, value in shapes(
                data_arr,
                mask=valid_mask,
                transform=window_transform,
                connectivity=4,
            ):
                cls_id = int(value)
                if cls_id == 0 and not include_zero_class:
                    continue
                    
                pixel_poly = shape(geom_dict)
                if not pixel_poly.is_valid:
                    pixel_poly = make_valid(pixel_poly)
                    
                if not pixel_poly.intersects(poly_geom):
                    continue
                    
                intersection_poly = pixel_poly.intersection(poly_geom)
                if intersection_poly.is_empty:
                    continue

                valid_polys = []
                if isinstance(intersection_poly, (Polygon, MultiPolygon)):
                    valid_polys.append(intersection_poly)
                elif hasattr(intersection_poly, "geoms"):
                    for g in intersection_poly.geoms:
                        if isinstance(g, (Polygon, MultiPolygon)):
                            valid_polys.append(g)
                
                if not valid_polys:
                    continue

                if cls_id not in vetores_por_classe:
                    vetores_por_classe[cls_id] = []
                vetores_por_classe[cls_id].extend(valid_polys)

        logger.info(
            f"[KML Export] Vetorizado: {sum(len(v) for v in vetores_por_classe.values())} polígonos em {len(vetores_por_classe)} classes"
        )

        # --- 4. Converter coordenadas para WGS84 se necessário ---
        need_transform = tiff_crs and str(tiff_crs) != "EPSG:4326"
        transformer = None
        if need_transform:
            transformer = Transformer.from_crs(
                tiff_crs, "EPSG:4326", always_xy=True
            )

    # --- 5. Construir KML ---
    kml = simplekml.Kml()
    kml.document.name = nome_documento

    for cls_id, polys in sorted(vetores_por_classe.items()):
        if not polys:
            continue

        nome_classe = classes_nomes.get(cls_id, f"Classe {cls_id}")
        cor_hex = classes_cores.get(cls_id, "#CCCCCC")
        cor_kml = _hex_to_kml_color(cor_hex, 255) # 255 = 100% opacity

        # Unificar polígonos adjacentes da mesma classe para KML mais limpo
        merged = unary_union(polys)
        merged = make_valid(merged)

        # Normalizar para lista de polígonos
        if isinstance(merged, Polygon):
            poly_list = [merged]
        elif isinstance(merged, MultiPolygon):
            poly_list = list(merged.geoms)
        else:
            # GeometryCollection ou outro tipo
            poly_list = [
                g for g in merged.geoms
                if isinstance(g, (Polygon, MultiPolygon))
            ]

        if not poly_list:
            continue

        # Criar MultiGeometry para agrupar polígonos da mesma classe
        multi_geom = kml.newmultigeometry(name=nome_classe)

        for poly in poly_list:
            if isinstance(poly, MultiPolygon):
                for sub in poly.geoms:
                    _add_polygon_to_multi(multi_geom, sub, transformer)
            else:
                _add_polygon_to_multi(multi_geom, poly, transformer)

        # Estilo
        multi_geom.style.polystyle.color = cor_kml
        multi_geom.style.polystyle.fill = 1
        multi_geom.style.polystyle.outline = 0

    logger.info(f"[KML Export] KML gerado com sucesso: {nome_documento}")
    return kml.kml()


def _add_polygon_to_multi(multi_geom, polygon, transformer=None):
    """Adiciona um polígono Shapely ao MultiGeometry do simplekml,
    convertendo coordenadas para WGS84 se um Transformer for fornecido."""
    if polygon.is_empty:
        return

    coords = list(polygon.exterior.coords)

    if transformer:
        coords = [transformer.transform(pt[0], pt[1]) for pt in coords]

    # simplekml espera (lon, lat) — que é (x, y) em WGS84, ignorando Z se existir
    kml_coords = [(pt[0], pt[1]) for pt in coords]
    
    # Processar buracos (interiors) se existirem
    inner_boundaries = []
    for interior in polygon.interiors:
        int_coords = list(interior.coords)
        if transformer:
            int_coords = [transformer.transform(pt[0], pt[1]) for pt in int_coords]
        inner_boundaries.append([(pt[0], pt[1]) for pt in int_coords])

    poly_kml = multi_geom.newpolygon(outerboundaryis=kml_coords)
    if inner_boundaries:
        poly_kml.innerboundaryis = inner_boundaries
