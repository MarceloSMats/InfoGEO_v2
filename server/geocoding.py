# -*- coding: utf-8 -*-
"""
InfoGEO – Geocodificação reversa
=================================
Obtém município e UF a partir de coordenadas usando geopy/Nominatim.
"""

import logging

try:
    from geopy.geocoders import Nominatim
    from geopy.exc import GeocoderTimedOut, GeocoderServiceError
except ImportError:
    Nominatim = None
    GeocoderTimedOut = Exception
    GeocoderServiceError = Exception

logger = logging.getLogger("lulc-analyzer")

# UF por extenso → sigla
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

# Cache simples baseado em atributo da própria função
_location_cache: dict = {}


def _get_location_from_coords(lat, lon):
    """Obtém município e UF a partir de coordenadas."""
    if Nominatim is None:
        logger.warning("Biblioteca geopy não está instalada. Retorno padrão.")
        return 'Não identificado', 'Não identificado'

    cache_key = f"{lat:.6f},{lon:.6f}"
    if cache_key in _location_cache:
        return _location_cache[cache_key]

    try:
        geolocator = Nominatim(user_agent="infogeo_analyzer_v2", timeout=15)
        location = geolocator.reverse(f"{lat}, {lon}", language='pt', exactly_one=True, zoom=10)

        if location and location.raw:
            address = location.raw.get('address', {})

            municipio = (
                address.get('city') or
                address.get('town') or
                address.get('village') or
                address.get('municipality') or
                address.get('county') or
                address.get('suburb') or
                address.get('city_district') or
                address.get('locality') or
                None
            )

            if not municipio or municipio == 'Não identificado':
                display_name = location.raw.get('display_name', '')
                parts = [p.strip() for p in display_name.split(',')]
                if len(parts) >= 2:
                    municipio = parts[1] if parts[1] else parts[0]

            uf = (
                address.get('state') or
                address.get('region') or
                address.get('state_district') or
                None
            )
            if uf:
                uf = _UF_MAP.get(uf, uf)

            municipio = municipio or 'Não identificado'
            uf = uf or 'Não identificado'

            result = (municipio, uf)
            _location_cache[cache_key] = result
            logger.info(f"Localização identificada: {municipio} - {uf}")
            return result

        logger.warning(f"Nenhuma localização encontrada para {lat}, {lon}")
        result = ('Não identificado', 'Não identificado')
        _location_cache[cache_key] = result
        return result

    except (GeocoderTimedOut, GeocoderServiceError) as e:
        logger.warning(f"Erro ao buscar localização (timeout/serviço): {e}")
        result = ('Não identificado', 'Não identificado')
        _location_cache[cache_key] = result
        return result
    except Exception as e:
        logger.error(f"Erro inesperado ao buscar localização: {e}")
        result = ('Não identificado', 'Não identificado')
        _location_cache[cache_key] = result
        return result
