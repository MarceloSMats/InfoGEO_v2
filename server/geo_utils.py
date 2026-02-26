# -*- coding: utf-8 -*-
"""
InfoGEO – Operações geoespaciais e raster
==========================================
Funções para CRS, áreas, leitura COG otimizada, estatísticas fracionais
e geração de imagem visual de classes.
"""

import logging
import base64
from io import BytesIO

import numpy as np
import pandas as pd
import geopandas as gpd

import rasterio
from rasterio.windows import from_bounds
from rasterio.features import rasterize
from rasterio.transform import xy
from rasterio.crs import CRS
from rasterio.enums import Resampling

from shapely.geometry import box, Polygon
from shapely.ops import unary_union, transform as shapely_transform
from shapely.validation import make_valid

from pyproj import Transformer

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .utils import _format_area_ha

logger = logging.getLogger("lulc-analyzer")


# ------------------------------------------------------------------------------
# CRS / UTM
# ------------------------------------------------------------------------------
def _calc_utm_epsg(lon: float, lat: float) -> int:
    zone = int((lon + 180) / 6) + 1
    return (32600 + zone) if lat >= 0 else (32700 + zone)


# ------------------------------------------------------------------------------
# Área do pixel
# ------------------------------------------------------------------------------
def _pixel_area_ha(src: rasterio.io.DatasetReader) -> float:
    try:
        if src.crs and src.crs.is_geographic:
            bounds = src.bounds
            center_lon = (bounds.left + bounds.right) / 2
            center_lat = (bounds.bottom + bounds.top) / 2
            utm_epsg = _calc_utm_epsg(center_lon, center_lat)
            transformer = Transformer.from_crs(src.crs, f"EPSG:{utm_epsg}", always_xy=True)

            x1, y1 = xy(src.transform, 0, 0, offset="ul")
            x2, y2 = xy(src.transform, 1, 1, offset="ul")
            x1u, y1u = transformer.transform(x1, y1)
            x2u, y2u = transformer.transform(x2, y2)
            width_m = abs(x2u - x1u)
            height_m = abs(y2u - y1u)
            area_m2 = width_m * height_m
        else:
            res_x, res_y = src.res
            area_m2 = abs(res_x * res_y)
        return area_m2 / 10000.0
    except Exception as e:
        logger.warning(f"Falha ao calcular área do pixel: {e}")
        return 0.01


# ------------------------------------------------------------------------------
# Conversão de CRS do GeoDataFrame para o CRS do raster
# ------------------------------------------------------------------------------
def _convert_gdf_to_raster_crs(gdf: gpd.GeoDataFrame, tiff_crs: CRS):
    crs_info = {
        "kml_crs_original": str(gdf.crs) if gdf.crs else "Não definido",
        "tiff_crs": str(tiff_crs) if tiff_crs else "Não definido",
        "conversao_necessaria": False,
        "kml_crs_convertido": None
    }

    gdf_out = gdf.copy()

    try:
        if gdf_out.crs is None:
            gdf_out = gdf_out.set_crs("EPSG:4326")
            crs_info["conversao_necessaria"] = True
            logger.info("CRS do KML definido como EPSG:4326")

        if tiff_crs and gdf_out.crs != tiff_crs:
            logger.info(f"Convertendo KML de {gdf_out.crs} para {tiff_crs}")
            gdf_out = gdf_out.to_crs(tiff_crs)
            crs_info["conversao_necessaria"] = True
            crs_info["kml_crs_convertido"] = str(tiff_crs)
        else:
            crs_info["kml_crs_convertido"] = str(gdf_out.crs)

        gdf_out.geometry = gdf_out.geometry.apply(make_valid)

        valid_geoms = gdf_out[gdf_out.geometry.notnull() & gdf_out.geometry.is_valid]
        if len(valid_geoms) < len(gdf_out):
            logger.warning("Algumas geometrias ficaram inválidas após conversão de CRS")
            gdf_out = valid_geoms

        if gdf_out.empty:
            raise ValueError("Todas as geometrias ficaram inválidas após conversão de CRS")

    except Exception as e:
        logger.error(f"Erro na conversão de CRS: {e}")
        crs_info["conversao_necessaria"] = False
        crs_info["kml_crs_convertido"] = str(gdf.crs) if gdf.crs else "EPSG:4326"

    return gdf_out, crs_info


# ------------------------------------------------------------------------------
# Cálculo de área do polígono
# ------------------------------------------------------------------------------
def _polygon_area_ha(gdf: gpd.GeoDataFrame, crs: CRS) -> float:
    if gdf is None or gdf.empty:
        return 0.0
    if crs and crs.is_geographic:
        centroid = gdf.unary_union.centroid
        lon, lat = centroid.x, centroid.y
        utm_epsg = _calc_utm_epsg(lon, lat)
        gdf_utm = gdf.to_crs(f"EPSG:{utm_epsg}")
        area_m2 = gdf_utm.geometry.area.sum()
    else:
        area_m2 = gdf.geometry.area.sum()
    return float(area_m2 / 10000.0)


def _intersect_area_ha(geom: Polygon, crs_src: CRS, src: rasterio.io.DatasetReader) -> float:
    bounds = src.bounds
    raster_poly = box(bounds.left, bounds.bottom, bounds.right, bounds.top)
    inter = geom.intersection(raster_poly)
    if inter.is_empty:
        return 0.0

    if src.crs and src.crs.is_geographic:
        center_lon = (bounds.left + bounds.right) / 2
        center_lat = (bounds.bottom + bounds.top) / 2
        utm_epsg = _calc_utm_epsg(center_lon, center_lat)
        to_utm = lambda g: shapely_transform(
            Transformer.from_crs(src.crs, f"EPSG:{utm_epsg}", always_xy=True).transform, g
        )
        inter_u = to_utm(inter)
        area_m2 = inter_u.area
    else:
        area_m2 = inter.area
    return float(area_m2 / 10000.0)


# ------------------------------------------------------------------------------
# Sanitização de GeoDataFrame para JSON
# ------------------------------------------------------------------------------
def _sanitize_gdf_for_json(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Converte colunas problemáticas para strings para evitar erros de serialização JSON.

    - Mantém a coluna 'geometry' intacta.
    - Converte timestamps e objetos pandas para strings legíveis.
    """
    if gdf is None or gdf.empty:
        return gdf

    g = gdf.copy()
    for col in g.columns:
        if col == g.geometry.name:
            continue
        try:
            ser = g[col]
            if pd.api.types.is_datetime64_any_dtype(ser) or pd.api.types.is_datetime64_ns_dtype(ser):
                g[col] = ser.dt.strftime('%Y-%m-%dT%H:%M:%S')
            else:
                g[col] = ser.apply(lambda x: None if pd.isna(x) else str(x))
        except Exception:
            g[col] = g[col].apply(lambda x: None if pd.isna(x) else str(x))
    return g


# ------------------------------------------------------------------------------
# Funções COG Otimizadas
# ------------------------------------------------------------------------------
def _optimize_cog_reading(src: rasterio.io.DatasetReader, geometry_bounds):
    """
    Otimiza a leitura para arquivos COG detectando e usando overviews.
    """
    optimizations = {
        'use_overviews': False,
        'overview_level': 0,
        'optimized_window': None,
        'optimized_transform': src.transform
    }

    try:
        if hasattr(src, 'overviews') and src.overviews(1):
            overviews = src.overviews(1)
            if overviews and len(overviews) > 0:
                left, bottom, right, top = geometry_bounds

                area = (right - left) * (top - bottom)

                if area > 1.0:
                    overview_level = min(2, len(overviews))
                elif area > 0.1:
                    overview_level = min(1, len(overviews))
                else:
                    overview_level = 0

                if overview_level > 0:
                    optimizations['use_overviews'] = True
                    optimizations['overview_level'] = overview_level
                    logger.info(f"COG detectado: usando overview level {overview_level}")

        try:
            window = from_bounds(*geometry_bounds, transform=src.transform)
            optimizations['optimized_window'] = window
        except Exception as e:
            logger.warning(f"Erro ao otimizar window: {e}")

    except Exception as e:
        logger.warning(f"Otimização COG falhou: {e}")

    return optimizations


def _read_optimized_data(src, window, overview_level=0):
    """
    Leitura otimizada de dados raster com suporte a COG overviews.
    """
    try:
        window = window.round_offsets('ceil')
        window = window.round_lengths('floor')
        window = window.crop(height=src.height, width=src.width)
        logger.info(f"Window ajustada para limites do raster: {window}")

        if window.width <= 0 or window.height <= 0:
            logger.error("Window inválida após ajuste aos limites")
            return None

        window_transform = rasterio.windows.transform(window, src.transform)
        target_resolution = src.res

        target_width = max(1, int(round((window.width * src.transform[0]) / target_resolution[0])))
        target_height = max(1, int(round((window.height * abs(src.transform[4])) / target_resolution[1])))

        scale_width = target_width / window.width if window.width > 0 else 1.0
        scale_height = target_height / window.height if window.height > 0 else 1.0
        scale_factor = min(scale_width, scale_height)

        if overview_level > 0 and src.overviews(1) and len(src.overviews(1)) >= overview_level:
            out_shape = (
                max(1, target_height),
                max(1, target_width)
            )

            data = src.read(
                1,
                window=window,
                out_shape=out_shape,
                resampling=Resampling.average,
                masked=True
            )
            logger.info(f"Leitura otimizada com overview: level={overview_level}, shape={out_shape}")
        else:
            if scale_factor != 1.0:
                out_shape = (
                    max(1, target_height),
                    max(1, target_width)
                )
                data = src.read(
                    1,
                    window=window,
                    out_shape=out_shape,
                    resampling=Resampling.average,
                    masked=True
                )
                logger.info(f"Leitura redimensionada: shape={out_shape}, scale_factor={scale_factor:.3f}")
            else:
                data = src.read(1, window=window, masked=True)
                logger.info(f"Leitura sem redimensionamento: shape={data.shape}")

        if data is not None:
            logger.info(f"Dados lidos com sucesso: shape={data.shape}, dtype={data.dtype}")
            logger.info(f"Valores únicos encontrados: {np.unique(data)}")
            return data

    except Exception as e:
        logger.error(f"Erro na leitura otimizada: {e}")
        try:
            return src.read(1, window=window, masked=True)
        except Exception as e2:
            logger.error(f"Falha também no fallback: {e2}")
            return None


# ------------------------------------------------------------------------------
# Estatísticas fracionais por classe
# ------------------------------------------------------------------------------
def _fractional_stats(src: rasterio.io.DatasetReader, gdf_tiff_crs: gpd.GeoDataFrame, cog_optimizations=None):
    """Compute fractional class areas for the given geometry in the raster.

    Returns: (area_total_classes_ha, areas_por_classe_ha, img_visual, meta_dict)
    """
    if cog_optimizations is None:
        cog_optimizations = {
            'use_overviews': False,
            'overview_level': 0,
            'optimized_window': None
        }

    geom_union = unary_union(gdf_tiff_crs.geometry)
    try:
        centroid = geom_union.centroid
        logger.info(f"Centroide do polígono: ({centroid.x}, {centroid.y})")
    except Exception:
        centroid = None

    try:
        bounds = geom_union.bounds
        left, bottom, right, top = bounds[0], bounds[1], bounds[2], bounds[3]
        window = from_bounds(left, bottom, right, top, transform=src.transform)
        src_window = window.crop(height=src.height, width=src.width)
        if src_window.width <= 0 or src_window.height <= 0:
            logger.error("Window inválida após ajustes")
            return 0.0, {}, None, {"dimensoes_recorte": "0 x 0", "area_por_pixel_ha": 0.0, "area_por_pixel_ha_formatado": _format_area_ha(0.0, 6)}
    except Exception as e:
        logger.warning(f"Erro ao calcular window para fractional stats: {e}")
        return 0.0, {}, None, {"dimensoes_recorte": "0 x 0", "area_por_pixel_ha": 0.0, "area_por_pixel_ha_formatado": _format_area_ha(0.0, 6)}

    overview_level = cog_optimizations.get('overview_level', 0) if cog_optimizations.get('use_overviews', False) else 0
    data = _read_optimized_data(src, src_window, overview_level) if overview_level > 0 else None
    if data is None:
        try:
            data = src.read(1, window=src_window, masked=True)
            logger.info(f"Leitura padrão, shape: {data.shape}")
        except Exception as e:
            logger.error(f"Falha ao ler dados do raster: {e}")
            return 0.0, {}, None, {"dimensoes_recorte": "0 x 0", "area_por_pixel_ha": 0.0, "area_por_pixel_ha_formatado": _format_area_ha(0.0, 6)}

    if data is None or getattr(data, 'size', 0) == 0:
        return 0.0, {}, None, {"dimensoes_recorte": "0 x 0", "area_por_pixel_ha": 0.0, "area_por_pixel_ha_formatado": _format_area_ha(0.0, 6)}

    data_arr = np.asarray(data.filled(0), dtype=np.int32)
    try:
        window_transform = rasterio.windows.transform(src_window, src.transform)
    except Exception:
        window_transform = src.transform

    try:
        window_affine = rasterio.Affine(
            window_transform[0], window_transform[1], window_transform[2],
            window_transform[3], window_transform[4], window_transform[5]
        )
    except Exception:
        window_affine = src.transform

    try:
        interior = rasterize([(geom_union, 1)], out_shape=data_arr.shape, transform=window_affine, fill=0, all_touched=False).astype(bool)
        touched = rasterize([(geom_union, 1)], out_shape=data_arr.shape, transform=window_affine, fill=0, all_touched=True).astype(bool)
    except Exception as e:
        logger.warning(f"Falha ao rasterizar polígono: {e}")
        interior = np.zeros_like(data_arr, dtype=bool)
        touched = interior.copy()

    frac = np.zeros_like(data_arr, dtype=np.float32)
    frac[interior] = 1.0
    frac[touched & (~interior)] = 1.0

    area_pixel_ha = _pixel_area_ha(src)
    areas_por_classe_ha = {}

    unique_classes = np.unique(data_arr)
    unique_classes = unique_classes[unique_classes > 0]
    for cls in unique_classes:
        cls_mask = (data_arr == cls) & (frac > 0)
        area_cls_ha = float((frac[cls_mask].sum()) * area_pixel_ha)
        if area_cls_ha > 0:
            areas_por_classe_ha[int(cls)] = area_cls_ha

    img_visual = np.where(touched, data_arr, -9999).astype(np.int32)
    img_visual[img_visual == -9999] = 0

    area_total_classes_ha = float(sum(areas_por_classe_ha.values()))

    meta = {
        "dimensoes_recorte": f"{data_arr.shape[0]} x {data_arr.shape[1]} pixels",
        "area_por_pixel_ha": round(area_pixel_ha, 6),
        "area_por_pixel_ha_formatado": _format_area_ha(round(area_pixel_ha, 6), 6),
        "crs_para_area": str(src.crs) if src.crs else "Indefinido"
    }

    return area_total_classes_ha, areas_por_classe_ha, img_visual, meta


# ------------------------------------------------------------------------------
# Imagem visual de classes
# ------------------------------------------------------------------------------
def _create_visual_image(img_data, classes_nomes, classes_cores):
    try:
        if img_data is None or getattr(img_data, 'size', 0) == 0:
            logger.warning("Dados da imagem vazios ou inválidos")
            return None, [], {"width": 0, "height": 0, "non_transparent_pixels": 0, "total_pixels": 0, "png_bytes_len": 0, "unique_values": []}

        height, width = img_data.shape
        img_rgba = np.zeros((height, width, 4), dtype=np.uint8)

        unique_classes = np.unique(img_data)
        logger.info(f"Classes encontradas: {unique_classes}")

        img_rgba[:, :, 3] = 0

        for cls in unique_classes:
            cls_int = int(cls)
            if cls_int <= 0:
                continue
            color_hex = classes_cores.get(cls_int, "#CCCCCC")
            color_rgb = tuple(int(color_hex[i:i+2], 16) for i in (1, 3, 5))
            mask = (img_data == cls_int)
            if mask.any():
                img_rgba[mask, 0] = color_rgb[0]
                img_rgba[mask, 1] = color_rgb[1]
                img_rgba[mask, 2] = color_rgb[2]
                img_rgba[mask, 3] = 0
                logger.info(f"Classe {cls_int}: {mask.sum()} pixels")

        non_transparent_pixels = int(np.sum(img_rgba[:, :, 3] > 0))
        if non_transparent_pixels == 0:
            logger.warning("Nenhum pixel opaco encontrado, verificando dados...")
            valid_mask = img_data > 0
            if valid_mask.any():
                for cls in unique_classes:
                    cls_int = int(cls)
                    if cls_int > 0:
                        color_hex = classes_cores.get(cls_int, "#CCCCCC")
                        color_rgb = tuple(int(color_hex[i:i+2], 16) for i in (1, 3, 5))
                        mask = (img_data == cls_int)
                        if mask.any():
                            img_rgba[mask, 0] = color_rgb[0]
                            img_rgba[mask, 1] = color_rgb[1]
                            img_rgba[mask, 2] = color_rgb[2]
                            img_rgba[mask, 3] = 255

        non_transparent_pixels = int(np.sum(img_rgba[:, :, 3] > 0))
        total_pixels = int(img_rgba.shape[0] * img_rgba.shape[1])
        logger.info(f"Pixels não-transparentes após processamento: {non_transparent_pixels} / {total_pixels}")

        dpi = 100
        fig = plt.figure(figsize=(width/dpi, height/dpi), dpi=dpi, frameon=False)
        ax = plt.Axes(fig, [0., 0., 1., 1.])
        ax.set_axis_off()
        fig.add_axes(ax)

        ax.imshow(img_rgba, interpolation='none', aspect='equal')

        buf = BytesIO()
        plt.savefig(buf,
                    format='png',
                    dpi=dpi,
                    bbox_inches='tight',
                    pad_inches=0,
                    transparent=True,
                    facecolor='none',
                    edgecolor='none',
                    metadata={'Software': 'LULC Analyzer'})
        buf.seek(0)
        img_bytes = buf.getvalue()
        plt.close(fig)

        logger.info(f"PNG gerado, tamanho (bytes): {len(img_bytes)}")

        img_base64 = base64.b64encode(img_bytes).decode('utf-8')

        legend_info = []
        for cls in sorted(unique_classes):
            cls_int = int(cls)
            if cls_int <= 0 or cls_int == -9999:
                continue
            color = classes_cores.get(cls_int, "#CCCCCC")
            desc = classes_nomes.get(cls_int, f"Classe {cls_int}")
            legend_info.append({"classe": cls_int, "cor": color, "descricao": desc})

        unique_vals = np.unique(img_data)
        try:
            unique_list = [int(x) for x in unique_vals.tolist()]
        except Exception:
            unique_list = [int(x) for x in list(unique_vals)]

        diagnostics = {
            "width": int(width),
            "height": int(height),
            "non_transparent_pixels": int(non_transparent_pixels),
            "total_pixels": int(total_pixels),
            "png_bytes_len": int(len(img_bytes)),
            "unique_values": unique_list
        }

        return img_base64, legend_info, diagnostics

    except Exception as e:
        logger.warning(f"Falha ao criar imagem: {e}")
        return None, [], {"width": 0, "height": 0, "non_transparent_pixels": 0, "total_pixels": 0, "png_bytes_len": 0, "unique_values": []}
