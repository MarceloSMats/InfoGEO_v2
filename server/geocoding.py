# -*- coding: utf-8 -*-
"""
InfoGEO – Geocodificação reversa
=================================
Obtém município e UF a partir de coordenadas.

Estratégia:
  1. Lookup local via shapefile IBGE BR_Municipios_2024 (point-in-polygon)
     → Rápido, offline, preciso.
  2. Fallback: Nominatim (geopy) via internet caso o ponto não caia em
     nenhum polígono municipal (bordas, áreas offshore, etc.).
"""

import logging
from pathlib import Path

logger = logging.getLogger("lulc-analyzer")

# ---------------------------------------------------------------------------
# Caminho do shapefile IBGE
# ---------------------------------------------------------------------------
_BASE_DIR = Path(__file__).parent.parent
_SHP_PATH = _BASE_DIR / "data" / "BR_Municipios_IBGE" / "BR_Municipios_2024.shp"

# Cache do GeoDataFrame municipal (carregado uma única vez)
_municipios_gdf = None
_shp_loaded: bool = False   # True após tentativa de carga (mesmo se falhar)

# Cache de resultados por coordenada arredondada
_location_cache: dict = {}


def _load_municipios():
    """Carrega o shapefile IBGE em memória (apenas na primeira chamada)."""
    global _municipios_gdf, _shp_loaded
    if _shp_loaded:
        return _municipios_gdf

    _shp_loaded = True
    try:
        import geopandas as gpd
        if not _SHP_PATH.exists():
            logger.warning(f"Shapefile municipal não encontrado: {_SHP_PATH}")
            return None

        logger.info(f"Carregando shapefile municipal IBGE: {_SHP_PATH}")
        gdf = gpd.read_file(str(_SHP_PATH))

        # Garantir CRS WGS-84 para comparação com centroide (ponto em EPSG:4326)
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4674")
        gdf = gdf.to_crs("EPSG:4326")

        # Manter apenas as colunas necessárias para reduzir uso de memória
        _municipios_gdf = gdf[["NM_MUN", "SIGLA_UF", "NM_UF", "geometry"]].copy()
        logger.info(f"Shapefile municipal carregado: {len(_municipios_gdf)} municípios")
        return _municipios_gdf

    except Exception as exc:
        logger.error(f"Falha ao carregar shapefile municipal: {exc}")
        return None


def _lookup_ibge(lat: float, lon: float):
    """Faz ponto-em-polígono no shapefile IBGE. Retorna (municipio, uf) ou (None, None)."""
    gdf = _load_municipios()
    if gdf is None:
        return None, None

    try:
        from shapely.geometry import Point
        import geopandas as gpd

        pt = gpd.GeoDataFrame(geometry=[Point(lon, lat)], crs="EPSG:4326")
        joined = gpd.sjoin(pt, gdf, how="left", predicate="within")

        if not joined.empty and not joined["NM_MUN"].isna().all():
            row = joined.iloc[0]
            municipio = str(row["NM_MUN"]) if row["NM_MUN"] else None
            uf = str(row["SIGLA_UF"]) if row["SIGLA_UF"] else None
            if municipio and uf:
                return municipio, uf

        # Ponto não caiu dentro de nenhum polígono (bordas, etc.) →
        # usar nearest (distância mínima ao centroide)
        gdf_copy = gdf.copy()
        gdf_copy["_dist"] = gdf_copy.geometry.distance(Point(lon, lat))
        nearest = gdf_copy.nsmallest(1, "_dist").iloc[0]
        municipio = str(nearest["NM_MUN"]) if nearest["NM_MUN"] else None
        uf = str(nearest["SIGLA_UF"]) if nearest["SIGLA_UF"] else None
        if municipio and uf:
            logger.info(f"Município obtido por proximidade: {municipio}/{uf}")
            return municipio, uf

    except Exception as exc:
        logger.warning(f"Erro no lookup IBGE: {exc}")

    return None, None


# Mapeamento UF extenso → sigla (mantido para fallback Nominatim)
_UF_MAP = {
    'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
    'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF',
    'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA',
    'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
    'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE',
    'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR',
    'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE',
    'Tocantins': 'TO'
}


def _lookup_nominatim(lat: float, lon: float):
    """Fallback: geocodificação reversa via Nominatim. Retorna (municipio, uf)."""
    try:
        from geopy.geocoders import Nominatim
        from geopy.exc import GeocoderTimedOut, GeocoderServiceError

        geolocator = Nominatim(user_agent="infogeo_analyzer_v2", timeout=10)
        location = geolocator.reverse(f"{lat}, {lon}", language='pt', exactly_one=True, zoom=10)

        if location and location.raw:
            address = location.raw.get('address', {})
            municipio = (
                address.get('city') or address.get('town') or
                address.get('village') or address.get('municipality') or
                address.get('county') or None
            )
            uf_raw = address.get('state') or address.get('region') or None
            uf = _UF_MAP.get(uf_raw, uf_raw) if uf_raw else None

            if municipio and uf:
                return municipio, uf

    except Exception as exc:
        logger.warning(f"Nominatim falhou: {exc}")

    return None, None


def _get_location_from_coords(lat: float, lon: float):
    """
    Retorna (municipio, uf) para as coordenadas fornecidas.

    Estratégia:
      1. Cache em memória
      2. Lookup local no shapefile IBGE (point-in-polygon → nearest)
      3. Fallback: Nominatim
      4. Fallback final: 'Não identificado'
    """
    cache_key = f"{lat:.5f},{lon:.5f}"
    if cache_key in _location_cache:
        return _location_cache[cache_key]

    # 1) Shapefile IBGE local
    municipio, uf = _lookup_ibge(lat, lon)

    # 2) Nominatim como fallback
    if not municipio or not uf:
        logger.info(f"IBGE lookup falhou para ({lat:.5f}, {lon:.5f}), tentando Nominatim...")
        municipio, uf = _lookup_nominatim(lat, lon)

    # 3) Último recurso
    municipio = municipio or 'Não identificado'
    uf = uf or 'Não identificado'

    result = (municipio, uf)
    _location_cache[cache_key] = result
    logger.info(f"Localização: {municipio} - {uf} (lat={lat:.5f}, lon={lon:.5f})")
    return result
