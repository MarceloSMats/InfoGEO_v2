# servidor.py (versão corrigida)
import os
import json
import logging
import zipfile
import re
import base64
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory

from functools import lru_cache
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

import math
import numpy as np
import pandas as pd

import rasterio
from rasterio.mask import mask
from rasterio.windows import from_bounds
from rasterio.features import rasterize
from rasterio.transform import xy
from rasterio.crs import CRS
from rasterio.enums import Resampling

import geopandas as gpd
import fiona

from shapely.geometry import box, Polygon, Point
from shapely.ops import unary_union, transform as shapely_transform
from shapely.validation import make_valid

from pyproj import Transformer
from datetime import datetime

try:
    from geopy.geocoders import Nominatim
    from geopy.exc import GeocoderTimedOut, GeocoderServiceError
except ImportError:
    Nominatim = None
    GeocoderTimedOut = Exception
    GeocoderServiceError = Exception

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

import base64
from io import BytesIO

import pandas as pd
from openpyxl import load_workbook


# ------------------------------------------------------------------------------
# JSON sanitization helpers
# ------------------------------------------------------------------------------
def _make_json_friendly(obj):
    """Recursively convert numpy / pandas / other non-serializable types to native Python types."""
    try:
        # None
        if obj is None:
            return None

        # Basic native types
        if isinstance(obj, (str, bool, int, float)):
            return obj

        # Numpy scalar
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)

        # pandas Timestamp
        try:
            import pandas as _pd
            if isinstance(obj, _pd.Timestamp):
                return obj.isoformat()
        except Exception:
            pass

        # dict
        if isinstance(obj, dict):
            return {str(k): _make_json_friendly(v) for k, v in obj.items()}

        # list/tuple/set
        if isinstance(obj, (list, tuple, set)):
            return [_make_json_friendly(v) for v in obj]

        # pandas Series
        try:
            import pandas as _pd
            if isinstance(obj, _pd.Series):
                return {str(k): _make_json_friendly(v) for k, v in obj.to_dict().items()}
        except Exception:
            pass

        # numpy array
        if isinstance(obj, (np.ndarray,)):
            return [_make_json_friendly(v) for v in obj.tolist()]

        # fallback: try to convert to string for unknown types
        return str(obj)
    except Exception:
        try:
            return str(obj)
        except Exception:
            return None


def _sanitize_response(resp: dict) -> dict:
    """Sanitize a top-level response dict recursively to make it JSON-serializable."""
    if not isinstance(resp, dict):
        return _make_json_friendly(resp)
    out = {}
    for k, v in resp.items():
        out[str(k)] = _make_json_friendly(v)
    return out


def _format_number_ptbr(x, decimals=2, currency=False):
    """Format number using pt-BR conventions: thousands '.' and decimal ','.
    If currency=True, prefix with 'R$ '. Returns string or None if x is None."""
    try:
        if x is None:
            return None
        val = float(x)
        # Use Python formatting to get grouping then replace
        int_part = int(abs(val))
        frac = abs(val) - int_part
        int_str = f"{int_part:,}".replace(',', '.')
        frac_str = f"{frac:.{decimals}f}"[1:].replace('.', ',')
        sign = '-' if val < 0 else ''
        s = f"{sign}{int_str}{frac_str}"
        if currency:
            return f"R$ {s}"
        return s
    except Exception:
        try:
            return str(x)
        except Exception:
            return None


def _format_area_ha(x, decimals=2):
    if x is None:
        return None
    s = _format_number_ptbr(x, decimals)
    return f"{s} ha" if s is not None else None


def _format_percent(x, decimals=2):
    if x is None:
        return None
    s = _format_number_ptbr(x, decimals)
    return f"{s}%" if s is not None else None

# === NOVAS IMPORTAÇÕES ===




# ------------------------------------------------------------------------------
# Configurações
# ------------------------------------------------------------------------------

# Adicione após as importações, antes das configurações
def decimal_to_gms(decimal, is_latitude):
    """Converte decimal para graus, minutos, segundos"""
    abs_decimal = abs(decimal)
    degrees = int(abs_decimal)
    minutes_float = (abs_decimal - degrees) * 60
    minutes = int(minutes_float)
    seconds = round((minutes_float - minutes) * 60, 2)
    
    direction = 'N' if (is_latitude and decimal >= 0) else 'S' if (is_latitude and decimal < 0) else 'E' if (not is_latitude and decimal >= 0) else 'W'
    
    return f"{degrees}° {minutes}' {seconds}\" {direction}"

def _get_location_from_coords(lat, lon):
    """Obtém município e UF a partir de coordenadas."""
    if Nominatim is None:
        logger.warning("Biblioteca geopy não está instalada. Instalando retorno padrão.")
        return 'Não identificado', 'Não identificado'
    
    try:
        geolocator = Nominatim(user_agent="infogeo_analyzer")
        location = geolocator.reverse(f"{lat}, {lon}", language='pt', timeout=10)
        
        if location and location.raw:
            address = location.raw.get('address', {})
            
            # Tentar extrair município
            municipio = (
                address.get('city') or 
                address.get('town') or 
                address.get('village') or 
                address.get('municipality') or
                address.get('county') or
                'Não identificado'
            )
            
            # Tentar extrair UF
            uf = address.get('state') or address.get('region') or 'Não identificado'
            
            return municipio, uf
        
        return 'Não identificado', 'Não identificado'
        
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        logger.warning(f"Erro ao buscar localização: {e}")
        return 'Não identificado', 'Não identificado'
    except Exception as e:
        logger.error(f"Erro inesperado ao buscar localização: {e}")
        return 'Não identificado', 'Não identificado'

BASE_DIR = Path(__file__).parent.parent

app = Flask(__name__, 
           static_folder=str(BASE_DIR),
           static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

app.config["MAX_CONTENT_LENGTH"] = 5000 * 1024 * 1024

TIFF_PATH = os.getenv(
    "LULC_TIFF_PATH",
    str(BASE_DIR / "data" / "LULC_VALORACAO_10m_com_mosaico.cog.tif")
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("lulc-analyzer")

# Cache para o shapefile SIGEF (evita reabrir a cada requisição)
SIGEF_GDF = None
SIGEF_PATH = BASE_DIR / 'data' / 'SIGEF_AMOSTRA' / 'SIGEF_APENAS_AMOSTRAS_062025.shp'

@lru_cache(maxsize=1)
def _load_sigef_gdf():
    global SIGEF_GDF
    if SIGEF_GDF is not None:
        return SIGEF_GDF

    if not SIGEF_PATH.exists():
        logger.warning(f"Shapefile SIGEF não encontrado: {SIGEF_PATH}")
        SIGEF_GDF = None
        return None

    try:
        gdf = gpd.read_file(str(SIGEF_PATH))
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        SIGEF_GDF = gdf
        logger.info(f"SIGEF shapefile carregado. Registros: {len(gdf)}")
        return SIGEF_GDF
    except Exception as e:
        logger.error(f"Falha ao carregar shapefile SIGEF: {e}")
        SIGEF_GDF = None
        return None


def _find_codigo_column(gdf: gpd.GeoDataFrame):
    """Tenta identificar a coluna que contém o código do imóvel (flexível a variações)."""
    if gdf is None or gdf.shape[1] == 0:
        return None
    candidates = [c for c in gdf.columns if 'codigo' in c.lower() and 'imo' in c.lower()]
    if not candidates:
        candidates = [c for c in gdf.columns if 'codigo' in c.lower() or 'imo' in c.lower()]
    return candidates[0] if candidates else None


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
                # Garantir que valores não-serializáveis se tornem strings (ou None)
                g[col] = ser.apply(lambda x: None if pd.isna(x) else str(x))
        except Exception:
            # Fallback: converter tudo para string
            g[col] = g[col].apply(lambda x: None if pd.isna(x) else str(x))
    return g

SIGEF_EXCEL_PATH = BASE_DIR / 'data' / 'SIGEF_AMOSTRA.xlsx'
SIGEF_EXCEL_DATA = None

@lru_cache(maxsize=1)
def _load_sigef_excel():
    global SIGEF_EXCEL_DATA
    
    if SIGEF_EXCEL_DATA is not None:
        return SIGEF_EXCEL_DATA
    
    if not SIGEF_EXCEL_PATH.exists():
        logger.warning(f"Planilha Excel SIGEF não encontrada: {SIGEF_EXCEL_PATH}")
        SIGEF_EXCEL_DATA = None
        return None
    
    try:
        df = pd.read_excel(SIGEF_EXCEL_PATH)
        logger.info(f"Planilha Excel SIGEF carregada. Registros: {len(df)}")
        SIGEF_EXCEL_DATA = df
        return df
    except Exception as e:
        logger.error(f"Falha ao carregar planilha Excel SIGEF: {e}")
        SIGEF_EXCEL_DATA = None
        return None

def _get_sigef_excel_info(codigo_imo):
    """Busca informações do SIGEF Excel pelo código do imóvel - RETORNA TODAS AS LINHAS"""
    df = _load_sigef_excel()
    if df is None:
        return None
    
    try:
        # Converter para string e remover espaços para comparação
        codigo_str = str(codigo_imo).strip()
        
        # PROIRIZAR COLUNA DN_BB QUE TEM O MESMO CÓDIGO DO RASTER
        colunas_codigo = ['DN_BB', 'codigo_imo', 'COD_NMRO_ICRA', 'CÓDIGO', 'CODIGO', 'Código']
        
        todas_linhas = []
        
        for coluna in colunas_codigo:
            if coluna in df.columns:
                # Buscar TODAS as linhas que correspondem
                matches = df[df[coluna].astype(str).str.strip() == codigo_str]
                if not matches.empty:
                    # Converter todas as linhas para dicionários
                    for _, row in matches.iterrows():
                        todas_linhas.append(row.to_dict())
        
        # Se não encontrou com busca exata, tentar busca parcial
        if not todas_linhas:
            for coluna in colunas_codigo:
                if coluna in df.columns:
                    matches = df[df[coluna].astype(str).str.contains(codigo_str, na=False)]
                    if not matches.empty:
                        for _, row in matches.iterrows():
                            todas_linhas.append(row.to_dict())
        
        return todas_linhas if todas_linhas else None
                    
    except Exception as e:
        logger.error(f"Erro ao buscar no Excel SIGEF: {e}")
    
    return None


# ------------------------------------------------------------------------------
# Centroides (Quadrantes) e Valoração
# ------------------------------------------------------------------------------
CENTROIDES_PATH = BASE_DIR / 'data' / 'Centroides_NtAgr_Valor' / 'Centroides_NtAgr_Valor.shp'
MICRO_CLASSES_EXCEL_PATH = BASE_DIR / 'data' / 'CD_MICRO_CLASSES.xlsx'

@lru_cache(maxsize=1)
def _load_centroides_gdf():
    """Carrega o shapefile de centroides/quadantes com caching.
    Retorna GeoDataFrame ou None."""
    if not CENTROIDES_PATH.exists():
        logger.warning(f"Shapefile Centroides não encontrado: {CENTROIDES_PATH}")
        return None
    try:
        gdf = gpd.read_file(str(CENTROIDES_PATH))
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        logger.info(f"Centroides shapefile carregado. Registros: {len(gdf)}")
        return gdf
    except Exception as e:
        logger.error(f"Falha ao carregar shapefile Centroides: {e}")
        return None


@lru_cache(maxsize=1)
def _load_micro_classes_df():
    """Carrega o Excel CD_MICRO_CLASSES.xlsx com caching.
    Retorna DataFrame ou None."""
    if not MICRO_CLASSES_EXCEL_PATH.exists():
        logger.warning(f"Excel CD_MICRO_CLASSES não encontrado: {MICRO_CLASSES_EXCEL_PATH}")
        return None
    try:
        df = pd.read_excel(str(MICRO_CLASSES_EXCEL_PATH))
        logger.info(f"CD_MICRO_CLASSES Excel carregado. Registros: {len(df)}")
        return df
    except Exception as e:
        logger.error(f"Falha ao carregar CD_MICRO_CLASSES Excel: {e}")
        return None


def _get_quadrante_info_from_centroid(centroid_point_wgs84: Point):
    """Dado um Point em WGS84, retorna (codigo_quadrante, valor_quadrante, atributos) ou (None,1.0,{})"""
    gdf = _load_centroides_gdf()
    if gdf is None or gdf.empty:
        return None, None, {}, "Centroide sem valor"

    # Garantir mesmo CRS
    try:
        if gdf.crs is None:
            gdf = gdf.set_crs('EPSG:4326')
        if gdf.crs.to_string() != 'EPSG:4326':
            gdf_wgs = gdf.to_crs('EPSG:4326')
        else:
            gdf_wgs = gdf
    except Exception:
        gdf_wgs = gdf

    # Encontrar a feição que contém o ponto
    try:
        matches = gdf_wgs[gdf_wgs.geometry.contains(centroid_point_wgs84)]
        if matches.empty:
            matches = gdf_wgs[gdf_wgs.geometry.intersects(centroid_point_wgs84)]
        if matches.empty:
            return None, None, {}, "Centroide sem valor"

        feat = matches.iloc[0]
        # Procurar colunas candidatas
        col_code = None
        col_value = None

        # Priorizar nomes exatos conhecidos (usar o nome curto fornecido pelo usuário)
        known_code_names = ['CD_VL_CEND', 'CD_VL_CEND_IMV_RRL', 'CD_VL_CEND_IMV_RRL'.upper()]
        # aceitar tanto VL_CEND_AV (mais curta) quanto VL_CEND_AVLC_IMVL (mais longa)
        known_value_names = ['VL_CEND_AV', 'VL_CEND_AVLC_IMVL']

        for c in feat.index:
            uc = str(c).upper()
            # Coluna do código do quadrante
            if uc in known_code_names and col_code is None:
                col_code = c
            # Coluna do valor do quadrante (prioritária)
            if uc in known_value_names and col_value is None:
                col_value = c

        # Se não encontrou pelos nomes exatos, usar heurísticas anteriores
        if col_code is None:
            for c in feat.index:
                uc = str(c).upper()
                if ('CD_VL' in uc) or ('CD' in uc and 'CEND' in uc) or ('COD' in uc and 'CEND' in uc):
                    col_code = c
                    break

        if col_value is None:
            for c in feat.index:
                uc = str(c).upper()
                if 'VL_CEND' in uc or 'AVLC' in uc or 'VAL' in uc or 'VALOR' in uc:
                    col_value = c
                    break

        code_val = feat.get(col_code) if (col_code is not None and col_code in feat.index) else None
        val_raw = feat.get(col_value) if (col_value is not None and col_value in feat.index) else None

        # Parse numeric value robustly for PT-BR formatted numbers
        try:
            def _parse_number_ptbr(v):
                if v is None:
                    return None
                # If already numeric
                if isinstance(v, (int, float, np.integer, np.floating)):
                    return float(v)
                s = str(v).strip()
                # Remove currency symbol and spaces
                s = s.replace('R$', '').replace('\xa0', '').strip()
                # Handle parentheses for negative
                neg = False
                if s.startswith('(') and s.endswith(')'):
                    neg = True
                    s = s[1:-1]
                # If both '.' and ',' exist assume '.' thousands and ',' decimal (pt-BR)
                if '.' in s and ',' in s:
                    s = s.replace('.', '').replace(',', '.')
                else:
                    # If only comma exists, it's the decimal separator
                    if ',' in s and '.' not in s:
                        s = s.replace(',', '.')
                    # If only dot exists, leave as is (assume standard decimal)
                # Remove any non numeric characters except dot and minus
                import re
                s = re.sub(r'[^0-9\.-]', '', s)
                if s == '' or s == '.' or s == '-':
                    return None
                try:
                    num = float(s)
                    return -num if neg else num
                except Exception:
                    return None

            parsed_val = _parse_number_ptbr(val_raw)
            val = parsed_val if parsed_val is not None else 1.0
        except Exception:
            val = 1.0

        attrs = {k: (None if pd.isna(v) else v) for k, v in feat.items() if k != 'geometry'}
        # Padronizar campos esperados pela UI/backend
        try:
            attrs['codigo_quadrante'] = code_val
        except Exception:
            attrs['codigo_quadrante'] = None

        try:
            attrs['valor_quadrante_raw'] = val_raw
        except Exception:
            attrs['valor_quadrante_raw'] = None
        
        # Extrair CD_MICR_GE (microregião) - pode estar como CD_MICR_GE ou CD_MICR__1
        try:
            cd_micr_ge = None
            for k in ['CD_MICR_GE', 'CD_MICR_GEO', 'CD_MICR__1']:
                if k in feat.index:
                    cd_micr_ge = feat.get(k)
                    if cd_micr_ge is not None:
                        break
            if cd_micr_ge is not None:
                try:
                    cd_micr_ge = int(cd_micr_ge)
                except Exception:
                    pass
            attrs['cd_micr_ge'] = cd_micr_ge
            attrs['CD_MICR_GE'] = cd_micr_ge
        except Exception:
            attrs['cd_micr_ge'] = None
            attrs['CD_MICR_GE'] = None
        # Add formatted version for UI convenience
        try:
            def _format_number_ptbr(x, decimals=2):
                if x is None:
                    return None
                try:
                    x = float(x)
                except Exception:
                    return str(x)
                # Format with thousands '.' and decimal ','
                int_part = int(abs(x))
                frac = abs(x) - int_part
                int_str = f"{int_part:,}".replace(',', '.')
                frac_str = f"{frac:.{decimals}f}"[1:].replace('.', ',')
                sign = '-' if x < 0 else ''
                return f"{sign}{int_str}{frac_str}"

            attrs['valor_quadrante'] = val
            attrs['valor_quadrante_formatado'] = _format_number_ptbr(val, 2)
            # também manter nome com o campo original para compatibilidade
            attrs['VL_CEND_AVLC_IMVL_formatted'] = _format_number_ptbr(val, 2)
            # Tentar extrair cod_dn e nota agronômica em campos padronizados
            try:
                # cod_dn heurístico (mantém versões normalizadas em várias chaves)
                cod_dn = None
                for k, v in list(attrs.items()):
                    ku = str(k).upper()
                    if cod_dn is None and (ku == 'COD_DN' or ku == 'CODDN' or ku.startswith('DN_') or ('COD' in ku and 'DN' in ku) or ('CD_' in ku and 'DN' in ku)):
                        cod_dn = v
                # fallback: qualquer campo com 'DN' e dígito
                if cod_dn is None:
                    for k, v in list(attrs.items()):
                        ku = str(k).upper()
                        if cod_dn is None and 'DN' in ku and any(ch.isdigit() for ch in str(v)):
                            cod_dn = v
                attrs['cod_dn'] = cod_dn
                # manter versão maiúscula para compatibilidade direta
                attrs['COD_DN'] = cod_dn
            except Exception:
                attrs['cod_dn'] = None
                attrs['COD_DN'] = None
            try:
                nota_val = None
                if 'NOTA_AGRONOMICA' in attrs:
                    nota_val = attrs.get('NOTA_AGRONOMICA')
                else:
                    # procurar colunas que contenham NOTA
                    for k, v in list(attrs.items()):
                        if 'NOTA' in str(k).upper():
                            nota_val = v
                            break
                attrs['nota_agronomica'] = nota_val
            except Exception:
                attrs['nota_agronomica'] = None
        except Exception:
            attrs['VL_CEND_AVLC_IMVL_formatted'] = str(val)

        logger.info(f"Quadrante raw value: {val_raw} -> parsed: {val}")

        return code_val, val, attrs, None
    except Exception as e:
        logger.warning(f"Erro ao buscar quadrante por centroide: {e}")
        return None, None, {}, "Centroide sem valor"


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
            logger.debug(f"DataFrame de micro_classes vazio para microregião {cd_micr_geo}, classe {cls_num}")
            return None
        
        # Filtrar linhas que correspondem à microregião E à classe
        matches = df[(df['CD_MICR_GEO'] == cd_micr_geo) & (df['COD_DN'] == cls_num)]
        
        if matches.empty:
            logger.debug(f"Nenhuma linha encontrada para microregião {cd_micr_geo}, classe {cls_num}")
            return None
        
        # Pegar a primeira linha
        nota_val = matches.iloc[0]['NOTA_AGRONOMICA']
        
        if nota_val is None or (isinstance(nota_val, float) and nota_val != nota_val):  # NaN check
            logger.debug(f"NOTA_AGRONOMICA é None/NaN para microregião {cd_micr_geo}, classe {cls_num}")
            return None
        
        # Parse robustamente
        try:
            nota_float = float(str(nota_val).replace(',', '.'))
            logger.info(f"Nota encontrada: microregião={cd_micr_geo}, classe={cls_num}, nota={nota_float}")
            return nota_float
        except Exception as e:
            logger.warning(f"Erro ao parsear NOTA_AGRONOMICA '{nota_val}': {e}")
            return None
            
    except Exception as e:
        logger.warning(f"Erro ao buscar nota: {e}")
        return None




# ------------------------------------------------------------------------------
# Dicionário de classes
# ------------------------------------------------------------------------------
CLASSES_NOMES = {
    0: "Sem classe (NoData/fora do raster)",
    1: "Lavoura Anual",
    2: "Lavoura Perene",
    3: "Pastagem Cultivada",
    4: "Pastagem Nativa",
    5: "Pastagem Degradada",
    6: "Silvicultura (Comercial)",
    8: "Área de preservação (RL,APP)",
    9: "Lagos, lagoas",
    10: "Construções e Benfeitorias (+ servidão)",
    100: "Uso Agropecuário não Definido",
}
CLASSES_CORES = {
    0: "#CCCCCC",
    1: "#c27ba0", 2: "#9932cc", 3: "#edde8e", 4: "#d6bc74", 5: "#d4271e",
    6: "#7a5900", 8: "#1f8d49", 9: "#2532e4", 10: "#5e5e5e", 100: "#000000"
}

# ------------------------------------------------------------------------------
# Utilitários
# ------------------------------------------------------------------------------
def _calc_utm_epsg(lon: float, lat: float) -> int:
    zone = int((lon + 180) / 6) + 1
    return (32600 + zone) if lat >= 0 else (32700 + zone)

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

def _parse_kml_manually(kml_path: str) -> gpd.GeoDataFrame:
    try:
        import xml.etree.ElementTree as ET
        from shapely.geometry import Polygon, MultiPolygon
        
        gdfs = []  # Initialize list for storing GeoDataFrames
        
        with open(kml_path, 'r', encoding='utf-8') as f:
            kml_content = f.read()
        
        ns = {'kml': 'http://www.opengis.net/kml/2.2'}
        ET.register_namespace('', ns['kml'])
        
        try:
            root = ET.fromstring(kml_content)
        except ET.ParseError:
            import re
            kml_content = re.sub(r'\s+xmlns="[^"]+"', '', kml_content, count=1)
            root = ET.fromstring(kml_content)
        
        polygons = []
        coord_elements = root.findall('.//{http://www.opengis.net/kml/2.2}coordinates')
        if not coord_elements:
            coord_elements = root.findall('.//coordinates')
        
        for coords_elem in coord_elements:
            if coords_elem.text:
                try:
                    coord_text = coords_elem.text.strip()
                    coordinates = []
                    for coord_pair in coord_text.split():
                        parts = coord_pair.split(',')
                        if len(parts) >= 2:
                            coordinates.append((float(parts[0]), float(parts[1])))
                    if coordinates:
                        polygons.append(coordinates)
                except (ValueError, IndexError):
                    continue
        
        try:
            gdf = gpd.read_file(kml_path)
            if not gdf.empty:
                gdfs.append(gdf)
                logger.info("KML lido diretamente com geopandas")
        except Exception as e:
            logger.warning(f"Leitura direta falhou: {e}")

        if not gdfs:
            try:
                layers = fiona.listlayers(kml_path)
                logger.info(f"Camadas encontradas no KML: {layers}")
                
                for layer in layers:
                    try:
                        g = gpd.read_file(kml_path, driver="KML", layer=layer)
                        if not g.empty:
                            gdfs.append(g)
                            logger.info(f"Camada '{layer}' lida com sucesso")
                    except Exception as e:
                        logger.warning(f"Falha ao ler camada '{layer}': {e}")
            except Exception as e:
                logger.warning(f"Falha ao listar camadas: {e}")

        if not gdfs:
            try:
                gdf = gpd.read_file(kml_path, driver='KML')
                if not gdf.empty:
                    gdfs.append(gdf)
                    logger.info("KML lido com driver explícito")
            except Exception as e:
                logger.warning(f"Driver KML explícito falhou: {e}")

        # Fallback manual: use coordinates extraídas previamente (se houver)
        if not gdfs and polygons:
            try:
                poly_geoms = [Polygon(coords) for coords in polygons if len(coords) >= 3]
                if poly_geoms:
                    g_manual = gpd.GeoDataFrame(geometry=poly_geoms, crs="EPSG:4326")
                    gdfs.append(g_manual)
                    logger.info("KML lido com parser manual via extração de coordenadas")
            except Exception as e:
                logger.warning(f"Parser manual fallback falhou: {e}")

    except Exception as e:
        logger.error(f"Erro geral na leitura do KML: {e}")
        raise ValueError(f"Não foi possível ler o arquivo KML: {str(e)}")

    if not gdfs:
        raise ValueError("O KML não contém polígonos válidos ou não pôde ser lido.")

    gdf_final = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=gdfs[0].crs)
    
    if gdf_final.crs is None:
        gdf_final = gdf_final.set_crs("EPSG:4326")
        logger.info("CRS definido como EPSG:4326 (padrão para KML)")
    
    gdf_final = gdf_final[gdf_final.geometry.notnull()]
    valid_geom_types = ["Polygon", "MultiPolygon", "GeometryCollection"]
    gdf_final = gdf_final[gdf_final.geometry.geom_type.isin(valid_geom_types)]
    
    if gdf_final.empty:
        raise ValueError("O KML não contém polígonos válidos após filtragem.")
    
    gdf_final.geometry = gdf_final.geometry.apply(make_valid)
    
    if len(gdf_final) > 1:
        gdf_final = gdf_final.dissolve().explode(index_parts=False).reset_index(drop=True)
    
    logger.info(f"KML processado com sucesso. {len(gdf_final)} geometria(s) válida(s)")
    return gdf_final

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
                base_res = src.res[0] * src.res[1]
                
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
        # Garantir que a janela está dentro dos limites do raster
        # Usar ceil e floor para garantir cobertura total da área
        window = window.round_offsets('ceil')  # Arredondar para cima
        window = window.round_lengths('floor')  # Arredondar para baixo
        window = window.crop(height=src.height, width=src.width)
        logger.info(f"Window ajustada para limites do raster: {window}")
        
        if window.width <= 0 or window.height <= 0:
            logger.error("Window inválida após ajuste aos limites")
            return None
            
        # Calcular a transformação da janela
        window_transform = rasterio.windows.transform(window, src.transform)
        target_resolution = src.res  # Manter a resolução original do raster
        
        # Calcular dimensões ideais em pixels mantendo a resolução original
        target_width = max(1, int(round((window.width * src.transform[0]) / target_resolution[0])))
        target_height = max(1, int(round((window.height * abs(src.transform[4])) / target_resolution[1])))
        
        # Ajustar escala baseada na resolução desejada
        scale_width = target_width / window.width if window.width > 0 else 1.0
        scale_height = target_height / window.height if window.height > 0 else 1.0
        scale_factor = min(scale_width, scale_height)
        
        if overview_level > 0 and src.overviews(1) and len(src.overviews(1)) >= overview_level:
            ovr_factor = src.overviews(1)[overview_level-1]
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
            # Se precisar redimensionar
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
            # Fallback: tentar leitura simples
            return src.read(1, window=window, masked=True)
        except Exception as e2:
            logger.error(f"Falha também no fallback: {e2}")
            return None

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

    # Bounds and window
    try:
        bounds = geom_union.bounds
        # Use a safe padded bounds to ensure we capture border pixels
        left, bottom, right, top = bounds[0], bounds[1], bounds[2], bounds[3]
        window = from_bounds(left, bottom, right, top, transform=src.transform)
        src_window = window.crop(height=src.height, width=src.width)
        if src_window.width <= 0 or src_window.height <= 0:
            logger.error("Window inválida após ajustes")
            return 0.0, {}, None, {"dimensoes_recorte": "0 x 0", "area_por_pixel_ha": 0.0, "area_por_pixel_ha_formatado": _format_area_ha(0.0, 6)}
    except Exception as e:
        logger.warning(f"Erro ao calcular window para fractional stats: {e}")
        return 0.0, {}, None, {"dimensoes_recorte": "0 x 0", "area_por_pixel_ha": 0.0, "area_por_pixel_ha_formatado": _format_area_ha(0.0, 6)}

    # Read data (optimized when possible)
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

    # Affine for rasterize
    try:
        window_affine = rasterio.Affine(
            window_transform[0], window_transform[1], window_transform[2],
            window_transform[3], window_transform[4], window_transform[5]
        )
    except Exception:
        window_affine = src.transform

    # Rasterize polygon mask
    try:
        interior = rasterize([(geom_union, 1)], out_shape=data_arr.shape, transform=window_affine, fill=0, all_touched=False).astype(bool)
        touched = rasterize([(geom_union, 1)], out_shape=data_arr.shape, transform=window_affine, fill=0, all_touched=True).astype(bool)
    except Exception as e:
        logger.warning(f"Falha ao rasterizar polígono: {e}")
        interior = np.zeros_like(data_arr, dtype=bool)
        touched = interior.copy()

    # Fraction approximation: interior=1, touched (edges)=1 as approximation
    frac = np.zeros_like(data_arr, dtype=np.float32)
    frac[interior] = 1.0
    frac[touched & (~interior)] = 1.0  # conservative approximation

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

def _create_visual_image(img_data, classes_nomes, classes_cores):
    try:
        if img_data is None or getattr(img_data, 'size', 0) == 0:
            logger.warning("Dados da imagem vazios ou inválidos")
            return None, [], {"width": 0, "height": 0, "non_transparent_pixels": 0, "total_pixels": 0, "png_bytes_len": 0, "unique_values": []}

        height, width = img_data.shape
        img_rgba = np.zeros((height, width, 4), dtype=np.uint8)
            
        # Encontrar classes únicas
        unique_classes = np.unique(img_data)
        logger.info(f"Classes encontradas: {unique_classes}")
        
        # Máscara: apenas valores de classe > 0 são considerados dentro do polígono
        valid_pixels_mask = img_data > 0

        # Inicializar fundo como transparente
        img_rgba[:, :, 3] = 0  # Alpha = 0 (transparente)

        # Processar todas as classes encontradas
        for cls in unique_classes:
            cls_int = int(cls)
            # Pular valores que representam áreas externas ou fundo (<=0)
            if cls_int <= 0:
                continue
            color_hex = classes_cores.get(cls_int, "#CCCCCC")
            color_rgb = tuple(int(color_hex[i:i+2], 16) for i in (1, 3, 5))
            mask = (img_data == cls_int)
            if mask.any():
                # Aplicar cor apenas onde a máscara é verdadeira
                img_rgba[mask, 0] = color_rgb[0]  # R
                img_rgba[mask, 1] = color_rgb[1]  # G
                img_rgba[mask, 2] = color_rgb[2]  # B
                img_rgba[mask, 3] = 0  # Alpha = 255 (opaco)
                logger.info(f"Classe {cls_int}: {mask.sum()} pixels")

        # ✅ CORREÇÃO ADICIONAL: Garantir que áreas dentro do polígono sejam visíveis
        # Se ainda não houver pixels opacos, verificar se temos dados válidos
        non_transparent_pixels = int(np.sum(img_rgba[:, :, 3] > 0))
        if non_transparent_pixels == 0:
            logger.warning("Nenhum pixel opaco encontrado, verificando dados...")
            # Tentar fallback: qualquer valor > 0 deve ser mostrado
            valid_mask = img_data > 0
            if valid_mask.any():
                for cls in unique_classes:
                    cls_int = int(cls)
                    if cls_int > 0:  # Apenas classes válidas
                        color_hex = classes_cores.get(cls_int, "#CCCCCC")
                        color_rgb = tuple(int(color_hex[i:i+2], 16) for i in (1, 3, 5))
                        mask = (img_data == cls_int)
                        if mask.any():
                            img_rgba[mask, 0] = color_rgb[0]
                            img_rgba[mask, 1] = color_rgb[1]
                            img_rgba[mask, 2] = color_rgb[2]
                            img_rgba[mask, 3] = 255

        # Recalcular estatísticas após possíveis correções
        non_transparent_pixels = int(np.sum(img_rgba[:, :, 3] > 0))
        total_pixels = int(img_rgba.shape[0] * img_rgba.shape[1])
        logger.info(f"Pixels não-transparentes após processamento: {non_transparent_pixels} / {total_pixels}")

        # Criar figura
        dpi = 100
        fig = plt.figure(figsize=(width/dpi, height/dpi), dpi=dpi, frameon=False)
        ax = plt.Axes(fig, [0., 0., 1., 1.])
        ax.set_axis_off()
        fig.add_axes(ax)

        # Renderizar
        ax.imshow(img_rgba, interpolation='none', aspect='equal')

        # Salvar
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

        # ✅ CORREÇÃO: Legend info - incluir todas as classes exceto 0 e -9999
        legend_info = []
        for cls in sorted(unique_classes):
            cls_int = int(cls)
            # Pular classe 0 e valores de fundo
            if cls_int <= 0 or cls_int == -9999:
                continue
            color = classes_cores.get(cls_int, "#CCCCCC")
            desc = classes_nomes.get(cls_int, f"Classe {cls_int}")
            legend_info.append({"classe": cls_int, "cor": color, "descricao": desc})

        # Diagnostics
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

def _allowed_file(filename: str) -> bool:
    # Accept .kml, .kmz, .geojson, .json (GeoJSON) and .shp (Shapefile)
    return "." in filename and filename.lower().endswith((".kml", ".kmz", ".geojson", ".json", ".shp", ".zip"))

def _process_kmz(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo KMZ (KML compactado) e retorna GeoDataFrame."""
    try:
        with TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            
            # Salvar arquivo KMZ temporariamente
            kmz_path = tmpdir_path / "input.kmz"
            input_file.save(str(kmz_path))
            
            # Extrair conteúdo do KMZ (é um arquivo ZIP)
            with zipfile.ZipFile(str(kmz_path), 'r') as zip_ref:
                zip_ref.extractall(str(tmpdir_path))
            
            # Procurar arquivo .kml dentro do diretório extraído
            kml_files = list(tmpdir_path.glob('**/*.kml'))
            
            if not kml_files:
                raise ValueError("Nenhum arquivo KML encontrado dentro do KMZ")
            
            # Usar o primeiro arquivo KML encontrado
            kml_path = str(kml_files[0])
            logger.info(f"Arquivo KML encontrado no KMZ: {kml_files[0].name}")
            
            # Processar o KML extraído
            gdf = _parse_kml_manually(kml_path)
            return gdf
            
    except zipfile.BadZipFile:
        raise ValueError("Arquivo KMZ inválido ou corrompido")
    except Exception as e:
        logger.error(f"Erro ao processar KMZ: {e}")
        raise ValueError(f"Não foi possível processar o arquivo KMZ: {str(e)}")

def _process_shapefile(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo Shapefile e retorna GeoDataFrame.
    
    Aceita tanto arquivo .shp individual (requer arquivos auxiliares)
    quanto arquivo .zip contendo todos os arquivos do shapefile.
    """
    try:
        # Configurar GDAL para aceitar shapefiles sem .shx
        import os as _os_mod
        _os_mod.environ['SHAPE_RESTORE_SHX'] = 'YES'
        
        filename = getattr(input_file, 'filename', '') or ''
        
        if filename.lower().endswith('.zip'):
            # Processar ZIP contendo shapefile
            with TemporaryDirectory() as tmpdir:
                tmpdir_path = Path(tmpdir)
                
                # Salvar e extrair ZIP
                zip_path = tmpdir_path / "shapefile.zip"
                
                # Resetar ponteiro do arquivo antes de salvar
                try:
                    input_file.seek(0)
                except:
                    pass
                    
                input_file.save(str(zip_path))
                
                # Verificar se é um arquivo ZIP válido
                try:
                    with zipfile.ZipFile(str(zip_path), 'r') as zip_ref:
                        zip_ref.extractall(str(tmpdir_path))
                except zipfile.BadZipFile:
                    raise ValueError("Arquivo ZIP inválido ou corrompido")
                
                # Procurar arquivo .shp
                shp_files = list(tmpdir_path.glob('**/*.shp'))
                
                if not shp_files:
                    raise ValueError("Nenhum arquivo .shp encontrado dentro do ZIP. Verifique se é um Shapefile válido.")
                
                shp_path = str(shp_files[0])
                logger.info(f"Shapefile encontrado no ZIP: {shp_files[0].name}")
                
                # Ler shapefile com GDAL configurado
                gdf = gpd.read_file(shp_path)
        else:
            # Processar arquivo .shp direto (salvar temporariamente)
            with TemporaryDirectory() as tmpdir:
                tmpdir_path = Path(tmpdir)
                shp_path = tmpdir_path / filename
                input_file.save(str(shp_path))
                
                # Tentar ler o shapefile com GDAL configurado
                gdf = gpd.read_file(str(shp_path))
        
        if gdf.empty:
            raise ValueError("Shapefile não contém geometrias válidas")
        
        # Definir CRS se não estiver definido
        if gdf.crs is None:
            logger.warning("Shapefile sem CRS definido, assumindo EPSG:4326")
            gdf = gdf.set_crs("EPSG:4326")
        
        # Validar geometrias
        gdf.geometry = gdf.geometry.apply(make_valid)
        
        # Filtrar apenas geometrias válidas
        valid_geom_types = ["Polygon", "MultiPolygon", "GeometryCollection"]
        gdf = gdf[gdf.geometry.notnull()]
        gdf = gdf[gdf.geometry.geom_type.isin(valid_geom_types)]
        
        if gdf.empty:
            raise ValueError("Shapefile não contém polígonos válidos")
        
        # Dissolver múltiplas geometrias se necessário
        if len(gdf) > 1:
            gdf = gdf.dissolve().explode(index_parts=False).reset_index(drop=True)
        
        logger.info(f"Shapefile processado com sucesso: {len(gdf)} geometria(s)")
        return gdf
        
    except zipfile.BadZipFile:
        logger.error("Arquivo ZIP inválido ou corrompido")
        raise ValueError("Arquivo ZIP inválido. Para Shapefiles, comprima todos os arquivos (.shp, .dbf, .shx, .prj) em um arquivo .zip")
    except Exception as e:
        logger.error(f"Erro ao processar Shapefile: {e}")
        error_msg = str(e)
        
        # Mensagens mais amigáveis para erros comuns
        if 'shx' in error_msg.lower() or 'shp' in error_msg.lower():
            raise ValueError(
                "Erro ao processar Shapefile. Para melhor compatibilidade, "
                "comprima todos os arquivos do shapefile (.shp, .dbf, .shx, .prj, etc.) "
                "em um único arquivo .zip e envie o arquivo .zip."
            )
        else:
            raise ValueError(f"Não foi possível processar o Shapefile: {error_msg}")

def _process_geojson(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo GeoJSON e retorna GeoDataFrame ou tupla de erro."""
    # Ler bytes e tentar decodificar com fallback para lidar com BOMs ou encodings variados
    raw = input_file.read()
    logger.info(f"_process_geojson: raw_bytes_len={len(raw)} preview={raw[:200]!r}")
    try:
        geojson_str = raw.decode('utf-8')
    except UnicodeDecodeError:
        try:
            geojson_str = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            geojson_str = raw.decode('latin-1')
    try:
        input_file.seek(0)
    except Exception:
        pass

    geojson_data = json.loads(geojson_str)
    # Some payloads wrap the GeoJSON under a 'geojson' key (e.g. sample files). Handle that.
    if "type" not in geojson_data:
        if 'geojson' in geojson_data and isinstance(geojson_data['geojson'], dict):
            geojson_data = geojson_data['geojson']
        else:
            raise ValueError("GeoJSON inválido: falta 'type'")

    if geojson_data.get("type") == "Feature":
        # Converter Feature única para FeatureCollection
        geojson_data = {
            "type": "FeatureCollection",
            "features": [geojson_data]
        }
    elif geojson_data.get("type") != "FeatureCollection":
        raise ValueError(f"Tipo GeoJSON não suportado: {geojson_data.get('type')}")

    # Criar GeoDataFrame
    gdf = gpd.GeoDataFrame.from_features(geojson_data["features"])
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")

    logger.info(f"GeoJSON carregado com sucesso: {len(gdf)} feição(ões)")

    # Garantir que o GDF tenha geometrias válidas
    gdf.geometry = gdf.geometry.apply(make_valid)

    return gdf
    
def _get_sigef_excel_info(codigo_imo):
    """Busca informações do SIGEF: prefere a planilha Excel; se não existir, faz fallback para o shapefile.

    Retorna uma lista de dicionários (sem geometria) com todas as linhas encontradas para o código.
    """
    try:
        codigo_str = str(codigo_imo).strip()

        # 1) Tentar Excel
        df = _load_sigef_excel()
        todas_linhas = []
        if df is not None:
            # Colunas candidatas
            colunas_codigo = ['DN_BB', 'codigo_imo', 'COD_NMRO_ICRA', 'CÓDIGO', 'CODIGO', 'Código']
            for coluna in colunas_codigo:
                if coluna in df.columns:
                    matches = df[df[coluna].astype(str).str.strip() == codigo_str]
                    if not matches.empty:
                        for _, row in matches.iterrows():
                            todas_linhas.append(row.to_dict())

            if not todas_linhas:
                # tentativa parcial
                for coluna in colunas_codigo:
                    if coluna in df.columns:
                        matches = df[df[coluna].astype(str).str.contains(codigo_str, na=False)]
                        if not matches.empty:
                            for _, row in matches.iterrows():
                                todas_linhas.append(row.to_dict())

            if todas_linhas:
                return todas_linhas

        # 2) Fallback para shapefile SIGEF (retornar atributos)
        gdf = _load_sigef_gdf()
        if gdf is None or gdf.empty:
            return None

        codigo_col = _find_codigo_column(gdf)
        if codigo_col is None:
            return None

        matches = gdf[gdf[codigo_col].astype(str).str.strip() == codigo_str]
        if matches.empty:
            matches = gdf[gdf[codigo_col].astype(str).str.contains(codigo_str, na=False)]

        if matches.empty:
            return None

        matches_s = _sanitize_gdf_for_json(matches.drop(columns=[matches.geometry.name], errors='ignore'))
        # converter para lista de dicts
        records = [ {k: (None if v is None else v) for k, v in rec.items()} for rec in json.loads(matches_s.to_json())['features'] ]

        # The to_json above returns GeoJSON features; instead produce attribute dicts
        attr_list = []
        for idx, row in matches_s.iterrows():
            d = row.to_dict()
            # remover geometry se presente
            d.pop('geometry', None)
            attr_list.append({k: (None if pd.isna(v) else v) for k, v in d.items()})

        return attr_list if attr_list else None

    except Exception as e:
        logger.error(f"Erro ao buscar informações do SIGEF: {e}")
        return None

# ------------------------------------------------------------------------------
# Rotas / Erros
# ------------------------------------------------------------------------------
@app.errorhandler(RequestEntityTooLarge)
def handle_large_file(e):
    return jsonify({"status": "erro", "mensagem": "Arquivo excede o limite de 5000 MB."}), 413

@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({"status": "erro", "mensagem": "Endpoint não encontrado"}), 404
    try:
        return send_from_directory(BASE_DIR, "index.html")
    except:
        return jsonify({"status": "erro", "mensagem": "Arquivo não encontrado"}), 404

@app.errorhandler(500)
def handle_500(e):
    logger.error(f"Erro interno do servidor: {e}")
    return jsonify({"status": "erro", "mensagem": "Erro interno do servidor"}), 500

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
    except Exception as e:
        logger.warning(f"Arquivo estático não encontrado: {filename}")
        return jsonify({"status": "erro", "mensagem": "Arquivo não encontrado"}), 404


@app.route('/api/imovel', methods=['GET'])
def api_imovel():
    """Retorna GeoJSON do imóvel encontrado no shapefile SIGEF pelo código fornecido.
    Se o shapefile não existir, retorna vazio ou mensagem apropriada.
    """
    try:
        codigo = request.args.get('codigo', None)
        if not codigo:
            return jsonify({"status": "erro", "mensagem": "Parâmetro 'codigo' é obrigatório"}), 400

        gdf = _load_sigef_gdf()
        if gdf is None or gdf.empty:
            return jsonify({"status": "vazio", "mensagem": "Shapefile SIGEF não disponível no servidor"}), 404

        codigo_col = _find_codigo_column(gdf)
        if codigo_col is None:
            return jsonify({"status": "erro", "mensagem": "Coluna de código não encontrada no shapefile SIGEF"}), 500

        codigo_str = str(codigo).strip()
        # buscar exato primeiro
        matches = gdf[gdf[codigo_col].astype(str).str.strip() == codigo_str]
        if matches.empty:
            # tentativa parcial
            matches = gdf[gdf[codigo_col].astype(str).str.contains(codigo_str, na=False)]

        if matches.empty:
            return jsonify({"status": "vazio", "mensagem": f"Nenhum imóvel encontrado para código {codigo}"}), 404

        # Validar geometrias antes de converter
        matches = matches[matches.geometry.notnull()]
        if matches.empty:
            return jsonify({"status": "erro", "mensagem": f"Imóvel {codigo} encontrado mas sem geometria válida"}), 404
        
        # Garantir que geometrias são válidas
        matches.geometry = matches.geometry.apply(make_valid)
        
        # Sanitizar antes de converter para geojson
        matches_s = _sanitize_gdf_for_json(matches)
        
        # Converter para GeoJSON com validação
        try:
            geojson_dict = json.loads(matches_s.to_json())
            
            # Validar que todas as features têm geometry válida
            if 'features' in geojson_dict:
                valid_features = []
                for feature in geojson_dict['features']:
                    if feature.get('geometry') and feature['geometry'].get('coordinates'):
                        valid_features.append(feature)
                
                if not valid_features:
                    return jsonify({"status": "erro", "mensagem": f"Imóvel {codigo} sem geometria válida"}), 404
                
                geojson_dict['features'] = valid_features
            
            return jsonify({"status": "sucesso", "total": len(valid_features), "geojson": geojson_dict})
        except Exception as e:
            logger.error(f"Erro ao converter GeoDataFrame para GeoJSON: {e}")
            return jsonify({"status": "erro", "mensagem": f"Erro ao processar geometria do imóvel"}), 500
    except Exception as e:
        logger.exception(f"Erro em /api/imovel: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500


def _process_analysis_sync(kml_file, raster_path, enable_valoracao=True):
    """Processamento síncrono para executor - VERSÃO SIMPLIFICADA"""
    try:
        # Resetar ponteiro do arquivo
        kml_file.seek(0)
        
        # Processar arquivo baseado no formato
        filename = getattr(kml_file, 'filename', '') or ''
        content_type = getattr(kml_file, 'content_type', '') or ''
        filename_lower = filename.lower()

        # Detectar formato do arquivo
        is_geojson = filename_lower.endswith('.geojson') or filename_lower.endswith('.json') or 'geo+json' in content_type or 'application/json' in content_type
        is_kmz = filename_lower.endswith('.kmz')
        # Melhor detecção de shapefile: .zip pode conter shapefile OU kmz
        is_shapefile = filename_lower.endswith('.shp') or (filename_lower.endswith('.zip') and not is_kmz)
        is_kml = filename_lower.endswith('.kml')

        logger.info(f"Processando arquivo: {filename} (GeoJSON={is_geojson}, KMZ={is_kmz}, SHP={is_shapefile}, KML={is_kml})")

        if is_geojson:
            # Processar GeoJSON
            try:
                kml_file.seek(0)
            except Exception:
                pass
            gdf = _process_geojson(kml_file)
            if isinstance(gdf, tuple):  # Se retornou erro
                return gdf
        elif is_kmz:
            # Processar KMZ
            try:
                kml_file.seek(0)
            except Exception:
                pass
            gdf = _process_kmz(kml_file)
        elif is_shapefile:
            # Processar Shapefile
            try:
                kml_file.seek(0)
            except Exception:
                pass
            gdf = _process_shapefile(kml_file)
        elif is_kml:
            # Processar KML
            with NamedTemporaryFile(delete=False, suffix=".kml", prefix="upload_", dir=".") as tmp:
                kml_file.save(tmp.name)
                tmp_kml = tmp.name
            
            try:
                gdf = _parse_kml_manually(tmp_kml)
            finally:
                if tmp_kml and os.path.exists(tmp_kml):
                    try:
                        os.unlink(tmp_kml)
                    except:
                        pass
        else:
            # Formato não reconhecido - tentar KML como fallback
            logger.warning(f"Formato de arquivo não reconhecido: {filename}. Tentando processar como KML...")
            with NamedTemporaryFile(delete=False, suffix=".kml", prefix="upload_", dir=".") as tmp:
                kml_file.save(tmp.name)
                tmp_kml = tmp.name
            
            try:
                gdf = _parse_kml_manually(tmp_kml)
            finally:
                if tmp_kml and os.path.exists(tmp_kml):
                    try:
                        os.unlink(tmp_kml)
                    except:
                        pass

        # Processar com raster
        with rasterio.open(raster_path) as src:
            tiff_crs = src.crs if src.crs else CRS.from_epsg(4674)
            
            # Converter para CRS do raster
            gdf_tiff, crs_info = _convert_gdf_to_raster_crs(gdf, tiff_crs)
            geom_union = unary_union(gdf_tiff.geometry)
            
            if geom_union.is_empty:
                return {
                    "status": "erro", 
                    "mensagem": "Polígono inválido após processamento."
                }

            # Calcular áreas
            area_poligono_ha = _polygon_area_ha(gdf_tiff, tiff_crs)
            area_intersec_raster_ha = _intersect_area_ha(geom_union, tiff_crs, src)

            if area_intersec_raster_ha == 0:
                return {
                    "status": "erro",
                    "mensagem": "Polígono não possui interseção com a área do raster."
                }

            # Otimizações COG
            cog_optimizations = _optimize_cog_reading(src, gdf_tiff.total_bounds)

            # Calcular estatísticas
            area_classes_total_ha, areas_por_classe_ha, img_data_visual, meta_aux = _fractional_stats(
                src, gdf_tiff, cog_optimizations
            )

            # Ajustar diferenças de área
            dif_ha = area_poligono_ha - area_classes_total_ha
            tol = 1e-4
            if dif_ha > tol:
                areas_por_classe_ha[0] = areas_por_classe_ha.get(0, 0.0) + dif_ha
            elif dif_ha < -tol:
                fator = area_poligono_ha / (area_classes_total_ha if area_classes_total_ha > 0 else 1.0)
                for k in list(areas_por_classe_ha.keys()):
                    areas_por_classe_ha[k] *= fator

            # Preparar relatório
            total_ref = area_poligono_ha if area_poligono_ha > 0 else 1.0
            relatorio = {
                "area_total_poligono_ha": round(area_poligono_ha, 4),
                "area_total_poligono_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "area_analisada_ha": round(area_poligono_ha, 4),
                "area_analisada_ha_formatado": _format_area_ha(area_poligono_ha, 4),
                "numero_classes_encontradas": len([c for c in areas_por_classe_ha if c != 0]),
                "classes": {},
                "metodo_utilizado": "pixel_parcial_otimizado"
            }

            for cls, area_ha in sorted(areas_por_classe_ha.items(), key=lambda k: -k[1]):
                percent = round((area_ha / total_ref) * 100, 4)
                relatorio["classes"][f"Classe {int(cls)}"] = {
                    "descricao": CLASSES_NOMES.get(int(cls), f"Classe {int(cls)}"),
                    "area_ha": round(area_ha, 4),
                    "area_ha_formatado": _format_area_ha(round(area_ha, 4), 4),
                    "percentual": percent,
                    "percentual_formatado": _format_percent(percent, 2)
                }

            # Gerar imagem
            img_base64, legenda, img_diag = _create_visual_image(img_data_visual, CLASSES_NOMES, CLASSES_CORES)

            # ✅ SEMPRE gerar GeoJSON do polígono processado para visualização (especialmente importante para shapefiles)
            polygon_geojson = None
            try:
                gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                gdf_sanitized = _sanitize_gdf_for_json(gdf_wgs84)
                polygon_geojson = json.loads(gdf_sanitized.to_json())
                logger.info(f"GeoJSON do polígono gerado com sucesso: {len(polygon_geojson.get('features', []))} features")
            except Exception as e:
                logger.error(f"Erro ao gerar GeoJSON do polígono: {e}")
                polygon_geojson = None

            # Calcular centroide
            try:
                if 'gdf_wgs84' not in locals():
                    gdf_wgs84 = gdf_tiff.to_crs("EPSG:4326")
                centroid = gdf_wgs84.unary_union.centroid
                centroid_coords = [centroid.y, centroid.x]
                lat_gms = decimal_to_gms(centroid.y, True)
                lon_gms = decimal_to_gms(centroid.x, False)
                centroid_display = f"{lat_gms}, {lon_gms}"
                
                # Buscar município e UF
                municipio, uf = _get_location_from_coords(centroid.y, centroid.x)
            except Exception as e:
                logger.warning(f"Erro ao calcular centroide: {e}")
                centroid_coords = None
                centroid_display = "Não disponível"
                municipio, uf = 'Não identificado', 'Não identificado'

            # -----------------------------
            # Cálculo de valoração agronômica por classe
            # -----------------------------
            # ✅ CONDICIONAL: Apenas executar se módulo de valoração estiver habilitado
            if enable_valoracao:
                try:
                    # Não usamos mais o CSV; obter info do quadrante via shapefile
                    centroid_point = Point(centroid.x, centroid.y) if centroid is not None else None
                    quadrante_code, valor_quadrante, quad_attrs, quad_msg = _get_quadrante_info_from_centroid(centroid_point) if centroid_point is not None else (None, None, {}, "Centroide sem valor")

                    # Se o quadrante não foi encontrado, retornar a mensagem pedida e não calcular valores
                    if quad_msg == "Centroide sem valor" or quadrante_code is None or valor_quadrante is None:
                        relatorio["valor_total_calculado"] = None
                        # preparar retorno com mensagem específica
                        return {
                            "status": "sucesso",
                            "mensagem_centroide": "Centroide sem valor",
                            "relatorio": relatorio,
                            "polygon_geojson": polygon_geojson,  # ✅ ADICIONAR GeoJSON
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
                                "quadrante": {
                                    "codigo": None,
                                    "valor_quadrante": None,
                                    "valor_quadrante_formatado": None,
                                    "atributos": {}
                                },
                            },
                            "imagem_recortada": {
                                "base64": img_base64,
                                "legenda": legenda,
                                "diagnostics": img_diag
                            } if img_base64 else None,
                            "crs_info": crs_info
                        }

                    # Extrair CD_MICR_GE do quadrante para buscar a nota no Excel
                    cd_micr_geo = None
                    if isinstance(quad_attrs, dict):
                        cd_micr_geo = quad_attrs.get('cd_micr_ge') or quad_attrs.get('CD_MICR_GE')
                    
                    if cd_micr_geo is None:
                        logger.warning(f"CD_MICR_GE não encontrado nos atributos do quadrante")
                        cd_micr_geo = None

                    total_valor_poligono = 0.0
                    # Para cada classe registrada no relatório, calcular valor = area_ha * nota_agronomica_por_classe * valor_quadrante
                    # IMPORTANTE: Buscar sempre a nota ESPECÍFICA por classe (NOTA_1, NOTA_2, etc), nunca usar média ou geral
                    for cls_key, cls_info in relatorio["classes"].items():
                        try:
                            # extrair número da classe do texto "Classe X"
                            cls_num = int(str(cls_key).split()[-1])
                            area_ha = float(cls_info.get('area_ha', 0.0))

                            # Buscar APENAS a nota específica para esta classe na microregião
                            # Usar a função que busca no Excel CD_MICRO_CLASSES pela microregião e classe
                            nota = None
                            if cd_micr_geo is not None:
                                nota = _get_nota_from_micro_classe(cd_micr_geo, cls_num)
                            
                            if nota is None:
                                nota = 1.0

                            # Log para auditoria (não expor dados sensíveis)
                            logger.info(f"Classe {cls_num}: área={area_ha:.4f} ha, nota={nota}, valor_quadrante={valor_quadrante}")

                            valor_calc = area_ha * float(nota) * float(valor_quadrante)
                            valor_calc_rounded = round(valor_calc, 4)
                            # formatted for pt-BR
                            try:
                                def _format_number_ptbr(x, decimals=2):
                                    if x is None:
                                        return None
                                    try:
                                        x = float(x)
                                    except Exception:
                                        return str(x)
                                    int_part = int(abs(x))
                                    frac = abs(x) - int_part
                                    int_str = f"{int_part:,}".replace(',', '.')
                                    frac_str = f"{frac:.{decimals}f}"[1:].replace('.', ',')
                                    sign = '-' if x < 0 else ''
                                    return f"{sign}{int_str}{frac_str}"
                            except Exception:
                                def _format_number_ptbr(x, decimals=2):
                                    try:
                                        return str(round(float(x), decimals))
                                    except Exception:
                                        return str(x)

                            relatorio["classes"][cls_key]["valor_calculado"] = valor_calc_rounded
                            relatorio["classes"][cls_key]["valor_calculado_formatado"] = _format_number_ptbr(valor_calc_rounded, 2)
                            total_valor_poligono += valor_calc
                        except Exception as e:
                            logger.warning(f"Falha ao calcular valor para classe {cls_key}: {e}")

                    total_rounded = round(total_valor_poligono, 4)
                    try:
                        relatorio["valor_total_calculado"] = total_rounded
                        relatorio["valor_total_calculado_formatado"] = _format_number_ptbr(total_rounded, 2)
                    except Exception:
                        relatorio["valor_total_calculado"] = total_rounded
                        
                except Exception as e:
                    logger.warning(f"Erro no cálculo de valoração agronômica: {e}")
                    relatorio.setdefault("valor_total_calculado", 0.0)
            else:
                # Valoração desabilitada - não calcular valores
                logger.info("Módulo de valoração desabilitado - pulando cálculos")
                relatorio["valor_total_calculado"] = None
                relatorio["valor_total_calculado_formatado"] = None

            return {
                "status": "sucesso",
                "relatorio": relatorio,
                "polygon_geojson": polygon_geojson,  # ✅ ADICIONAR GeoJSON do polígono processado
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
                    "quadrante": {
                        "codigo": (quadrante_code if 'quadrante_code' in locals() else None),
                        "valor_quadrante": (valor_quadrante if 'valor_quadrante' in locals() else None),
                        "valor_quadrante_formatado": (quad_attrs.get('VL_CEND_AVLC_IMVL_formatted') if 'quad_attrs' in locals() and isinstance(quad_attrs, dict) and 'VL_CEND_AVLC_IMVL_formatted' in quad_attrs else None),
                        "atributos": (quad_attrs if 'quad_attrs' in locals() else {})
                    },
                },
                "imagem_recortada": {
                    "base64": img_base64, 
                    "legenda": legenda, 
                    "diagnostics": img_diag
                } if img_base64 else None,
                "crs_info": crs_info
            }

    except Exception as e:
        logger.error(f"Erro no processamento síncrono: {e}")
        return {
            "status": "erro",
            "mensagem": f"Erro no processamento: {str(e)}"
        }

# Rota /analisar: versão totalmente síncrona
@app.route("/convert_to_geojson", methods=["POST"])
def convert_to_geojson():
    """Converte Shapefile ou KMZ para GeoJSON para visualização no mapa.
    Não faz análise, apenas conversão de formato."""
    logger.info("=== CONVERSÃO PARA GEOJSON ===")
    
    if "file" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400
    
    input_file = request.files["file"]
    if input_file.filename == "":
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo selecionado"}), 400
    
    filename = getattr(input_file, 'filename', '') or ''
    filename_lower = filename.lower()
    
    try:
        # Processar baseado no formato
        if filename_lower.endswith('.kmz'):
            gdf = _process_kmz(input_file)
        elif filename_lower.endswith('.zip'):
            gdf = _process_shapefile(input_file)
        else:
            return jsonify({"status": "erro", "mensagem": "Formato não suportado para conversão. Use .kmz ou .zip (shapefile)"}), 400
        
        # Converter para WGS84 (padrão para web)
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        elif gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
        
        # Sanitizar e converter para GeoJSON
        gdf_sanitized = _sanitize_gdf_for_json(gdf)
        geojson = json.loads(gdf_sanitized.to_json())
        
        logger.info(f"Conversão bem-sucedida: {filename} -> GeoJSON com {len(geojson.get('features', []))} features")
        
        return jsonify({
            "status": "sucesso",
            "geojson": geojson,
            "filename": filename
        }), 200
        
    except Exception as e:
        logger.error(f"Erro na conversão: {e}")
        return jsonify({
            "status": "erro",
            "mensagem": f"Erro ao converter arquivo: {str(e)}"
        }), 400


@app.route("/analisar", methods=["POST"])
def analisar_imagem():
    logger.info("=== INICIANDO ANÁLISE SÍNCRONA ===")

    if "kml" not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo enviado"}), 400

    input_file = request.files["kml"]
    if input_file.filename == "":
        return jsonify({"status": "erro", "mensagem": "Nenhum arquivo selecionado"}), 400

    if not _allowed_file(input_file.filename):
        return jsonify({"status": "erro", "mensagem": "Extensão inválida. Envie um arquivo .kml ou .geojson"}), 400

    # Obter o tipo de raster solicitado
    raster_type = request.form.get('raster_type', 'com_mosaico')
    
    # ✅ NOVO: Parâmetro para habilitar/desabilitar valoração
    enable_valoracao = request.form.get('enable_valoracao', 'true').lower() == 'true'
    logger.info(f"Módulo de valoração: {'habilitado' if enable_valoracao else 'desabilitado'}")
    
    # Mapear tipo de raster para arquivo
    if raster_type == 'sem_mosaico':
        raster_path = str(BASE_DIR / "data" / "Brasil_LULC_10m_sem_mosaico_DW.tif")
    else:  # 'com_mosaico' ou padrão
        raster_path = str(BASE_DIR / "data" / "LULC_VALORACAO_10m_com_mosaico.cog.tif")
    
    # Verificar se o arquivo existe, senão usar TIFF_PATH padrão
    if not os.path.exists(raster_path):
        logger.warning(f"Arquivo raster {raster_path} não encontrado, usando padrão")
        raster_path = TIFF_PATH
    
    logger.info(f"Usando raster: {raster_path}")

    try:
        logger.info(f"Arquivo recebido para análise: filename={input_file.filename}, content_type={input_file.content_type}")

        # Chamar o processador síncrono que já lida com KML e GeoJSON
        result = _process_analysis_sync(input_file, raster_path, enable_valoracao)

        # Se o retorno já for um dicionário com 'status', repassar como JSON
        if isinstance(result, dict):
            status = result.get("status", "erro")
            if status == "sucesso":
                try:
                    safe = _sanitize_response(result)
                except Exception:
                    safe = result
                return jsonify(safe), 200
            else:
                # Mensagem de erro retornada pelo processamento
                try:
                    safe = _sanitize_response(result)
                except Exception:
                    safe = result
                return jsonify(safe), 400
        else:
            # Caso inesperado
            return jsonify({"status": "erro", "mensagem": "Resposta do processamento inválida"}), 500

    except Exception as e:
        logger.exception(f"Exceção em analisar_imagem: {e}")
        return jsonify({"status": "erro", "mensagem": f"Erro ao processar o arquivo: {str(e)}"}), 500



@app.route("/api/sigef_excel_info", methods=["GET"])
def get_sigef_excel_info():
    """Retorna informações do SIGEF Excel para um código de imóvel"""
    try:
        codigo = request.args.get('codigo', None)
        if not codigo:
            return jsonify({"status": "erro", "mensagem": "Parâmetro 'codigo' é obrigatório"}), 400
        
        info = _get_sigef_excel_info(codigo)
        if info:
            return jsonify({
                "status": "sucesso",
                "dados": info
            })
        else:
            return jsonify({
                "status": "vazio",
                "mensagem": f"Nenhuma informação encontrada para código '{codigo}'"
            })
            
    except Exception as e:
        logger.error(f"Erro ao buscar informações do Excel SIGEF: {e}")
        return jsonify({
            "status": "erro",
            "mensagem": f"Erro ao buscar informações: {str(e)}"
        }), 500


if __name__ == "__main__":
    logger.info("=== INICIANDO SERVIDOR ===")
    logger.info(f"Diretório base: {BASE_DIR}")
    logger.info(f"Verificando TIFF: {TIFF_PATH}")
    logger.info(f"TIFF existe: {os.path.exists(TIFF_PATH)}")
    logger.info(f"Index.html existe: {os.path.exists(BASE_DIR / 'index.html')}")
    logger.info("Abra http://localhost:5000 no navegador.")
    debug_mode = True
    app.run(debug=debug_mode, host="0.0.0.0", port=5000, use_reloader=False)