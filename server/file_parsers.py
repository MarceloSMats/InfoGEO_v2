# -*- coding: utf-8 -*-
"""
InfoGEO – Parsers de arquivos geoespaciais
============================================
Leitura unificada de KML, KMZ, Shapefile e GeoJSON.
Fornece `parse_upload_file()` como ponto de entrada genérico.
"""

import os
import json
import logging
import zipfile
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory

import pandas as pd
import geopandas as gpd
import fiona
from shapely.validation import make_valid

logger = logging.getLogger("lulc-analyzer")


# ------------------------------------------------------------------------------
# Verificação de extensão
# ------------------------------------------------------------------------------
def _allowed_file(filename: str) -> bool:
    """Accept .kml, .kmz, .geojson, .json (GeoJSON), .shp, .gpkg and .zip (shapefile)."""
    return "." in filename and filename.lower().endswith(
        (".kml", ".kmz", ".geojson", ".json", ".shp", ".gpkg", ".zip")
    )


# ------------------------------------------------------------------------------
# KML (manual + fallbacks)
# ------------------------------------------------------------------------------
def _parse_kml_manually(kml_path: str) -> gpd.GeoDataFrame:
    try:
        import xml.etree.ElementTree as ET
        from shapely.geometry import Polygon, MultiPolygon

        gdfs = []

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

    if not gdf_final.empty:
        gdf_final = gdf_final.explode(index_parts=False).reset_index(drop=True)

    logger.info(f"KML processado com sucesso. {len(gdf_final)} geometria(s) válida(s)")
    return gdf_final


# ------------------------------------------------------------------------------
# KMZ
# ------------------------------------------------------------------------------
def _process_kmz(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo KMZ (KML compactado) e retorna GeoDataFrame."""
    try:
        with TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            kmz_path = tmpdir_path / "input.kmz"
            input_file.save(str(kmz_path))

            with zipfile.ZipFile(str(kmz_path), 'r') as zip_ref:
                zip_ref.extractall(str(tmpdir_path))

            kml_files = list(tmpdir_path.glob('**/*.kml'))
            if not kml_files:
                raise ValueError("Nenhum arquivo KML encontrado dentro do KMZ")

            kml_path = str(kml_files[0])
            logger.info(f"Arquivo KML encontrado no KMZ: {kml_files[0].name}")

            gdf = _parse_kml_manually(kml_path)
            return gdf

    except zipfile.BadZipFile:
        raise ValueError("Arquivo KMZ inválido ou corrompido")
    except Exception as e:
        logger.error(f"Erro ao processar KMZ: {e}")
        raise ValueError(f"Não foi possível processar o arquivo KMZ: {str(e)}")


# ------------------------------------------------------------------------------
# Shapefile
# ------------------------------------------------------------------------------
def _process_shapefile(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo Shapefile e retorna GeoDataFrame.

    Aceita tanto arquivo .shp individual (requer arquivos auxiliares)
    quanto arquivo .zip contendo todos os arquivos do shapefile.
    """
    try:
        os.environ['SHAPE_RESTORE_SHX'] = 'YES'
        filename = getattr(input_file, 'filename', '') or ''

        if filename.lower().endswith('.zip'):
            with TemporaryDirectory() as tmpdir:
                tmpdir_path = Path(tmpdir)
                zip_path = tmpdir_path / "shapefile.zip"
                try:
                    input_file.seek(0)
                except Exception:
                    pass
                input_file.save(str(zip_path))

                try:
                    with zipfile.ZipFile(str(zip_path), 'r') as zip_ref:
                        zip_ref.extractall(str(tmpdir_path))
                except zipfile.BadZipFile:
                    raise ValueError("Arquivo ZIP inválido ou corrompido")

                shp_files = list(tmpdir_path.glob('**/*.shp'))
                if not shp_files:
                    raise ValueError("Nenhum arquivo .shp encontrado dentro do ZIP. Verifique se é um Shapefile válido.")

                shp_path = str(shp_files[0])
                logger.info(f"Shapefile encontrado no ZIP: {shp_files[0].name}")
                gdf = gpd.read_file(shp_path)
        else:
            with TemporaryDirectory() as tmpdir:
                tmpdir_path = Path(tmpdir)
                shp_path = tmpdir_path / filename
                input_file.save(str(shp_path))
                gdf = gpd.read_file(str(shp_path))

        if gdf.empty:
            raise ValueError("Shapefile não contém geometrias válidas")

        if gdf.crs is None:
            logger.warning("Shapefile sem CRS definido, assumindo EPSG:4326")
            gdf = gdf.set_crs("EPSG:4326")

        gdf.geometry = gdf.geometry.apply(make_valid)

        valid_geom_types = ["Polygon", "MultiPolygon", "GeometryCollection"]
        gdf = gdf[gdf.geometry.notnull()]
        gdf = gdf[gdf.geometry.geom_type.isin(valid_geom_types)]

        if gdf.empty:
            raise ValueError("Shapefile não contém polígonos válidos")

        if not gdf.empty:
            gdf = gdf.explode(index_parts=False).reset_index(drop=True)

        logger.info(f"Shapefile processado com sucesso: {len(gdf)} geometria(s)")
        return gdf

    except zipfile.BadZipFile:
        logger.error("Arquivo ZIP inválido ou corrompido")
        raise ValueError("Arquivo ZIP inválido. Para Shapefiles, comprima todos os arquivos (.shp, .dbf, .shx, .prj) em um arquivo .zip")
    except Exception as e:
        logger.error(f"Erro ao processar Shapefile: {e}")
        error_msg = str(e)
        if 'shx' in error_msg.lower() or 'shp' in error_msg.lower():
            raise ValueError(
                "Erro ao processar Shapefile. Para melhor compatibilidade, "
                "comprima todos os arquivos do shapefile (.shp, .dbf, .shx, .prj, etc.) "
                "em um único arquivo .zip e envie o arquivo .zip."
            )
        else:
            raise ValueError(f"Não foi possível processar o Shapefile: {error_msg}")


# ------------------------------------------------------------------------------
# GeoJSON
# ------------------------------------------------------------------------------
def _process_geojson(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo GeoJSON e retorna GeoDataFrame ou tupla de erro."""
    try:
        input_file.seek(0)
    except Exception:
        pass

    raw = input_file.read()
    try:
        geojson_str = raw.decode('utf-8')
    except UnicodeDecodeError:
        try:
            geojson_str = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            geojson_str = raw.decode('latin-1')

    geojson_data = json.loads(geojson_str)
    if "type" not in geojson_data:
        if 'geojson' in geojson_data and isinstance(geojson_data['geojson'], dict):
            geojson_data = geojson_data['geojson']
        else:
            raise ValueError("GeoJSON inválido: falta 'type'")

    if geojson_data.get("type") == "Feature":
        geojson_data = {
            "type": "FeatureCollection",
            "features": [geojson_data]
        }
    elif geojson_data.get("type") != "FeatureCollection":
        raise ValueError(f"Tipo GeoJSON não suportado: {geojson_data.get('type')}")

    gdf = gpd.GeoDataFrame.from_features(geojson_data["features"])
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")

    logger.info(f"GeoJSON carregado com sucesso: {len(gdf)} feição(ões)")
    gdf.geometry = gdf.geometry.apply(make_valid)

    if not gdf.empty:
        gdf = gdf.explode(index_parts=False).reset_index(drop=True)

    return gdf


# ------------------------------------------------------------------------------
# GeoPackage (.gpkg)
# ------------------------------------------------------------------------------
def _process_gpkg(input_file) -> gpd.GeoDataFrame:
    """Processa arquivo GeoPackage e retorna GeoDataFrame."""
    filename = getattr(input_file, 'filename', 'temp.gpkg') or 'temp.gpkg'
    try:
        with TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            gpkg_path = tmpdir_path / filename
            try:
                input_file.seek(0)
            except:
                pass
            input_file.save(str(gpkg_path))

            layers = fiona.listlayers(str(gpkg_path))
            if not layers:
                raise ValueError("O arquivo Geopackage não contém camadas.")
            
            # Lê a primeira camada disponível
            layer_name = layers[0]
            logger.info(f"Lendo camada '{layer_name}' do Geopackage.")
            gdf = gpd.read_file(str(gpkg_path), layer=layer_name)

            if gdf.empty:
                raise ValueError("A camada do Geopackage está vazia ou não contém geometrias válidas.")

            if gdf.crs is None:
                logger.warning("Geopackage sem CRS definido, assumindo EPSG:4326")
                gdf = gdf.set_crs("EPSG:4326")

            gdf.geometry = gdf.geometry.apply(make_valid)

            valid_geom_types = ["Polygon", "MultiPolygon", "GeometryCollection"]
            gdf = gdf[gdf.geometry.notnull()]
            gdf = gdf[gdf.geometry.geom_type.isin(valid_geom_types)]

            if gdf.empty:
                raise ValueError("Geopackage não contém polígonos válidos")

            if not gdf.empty:
                gdf = gdf.explode(index_parts=False).reset_index(drop=True)

            logger.info(f"Geopackage processado com sucesso: {len(gdf)} geometria(s)")
            return gdf

    except Exception as e:
        logger.error(f"Erro ao processar Geopackage: {e}")
        raise ValueError(f"Não foi possível processar o Geopackage: {str(e)}")


# ------------------------------------------------------------------------------
# Dispatcher genérico
# ------------------------------------------------------------------------------
def parse_upload_file(input_file):
    """Detecta formato do arquivo enviado e retorna um GeoDataFrame.

    Suporta: GeoJSON, KMZ, Shapefile (.shp/.zip), KML.
    Raises ValueError se o formato não for reconhecido ou o conteúdo for inválido.
    """
    input_file.seek(0)

    filename = getattr(input_file, 'filename', '') or ''
    content_type = getattr(input_file, 'content_type', '') or ''
    filename_lower = filename.lower()

    is_geojson = (
        filename_lower.endswith('.geojson') or
        filename_lower.endswith('.json') or
        'geo+json' in content_type or
        'application/json' in content_type
    )
    is_kmz = filename_lower.endswith('.kmz')
    is_shapefile = filename_lower.endswith('.shp') or (filename_lower.endswith('.zip') and not is_kmz)
    is_kml = filename_lower.endswith('.kml')
    is_gpkg = filename_lower.endswith('.gpkg')

    logger.info(f"Processando arquivo: {filename} (GeoJSON={is_geojson}, KMZ={is_kmz}, SHP={is_shapefile}, KML={is_kml}, GPKG={is_gpkg})")

    if is_geojson:
        try:
            input_file.seek(0)
        except Exception:
            pass
        gdf = _process_geojson(input_file)
        if isinstance(gdf, tuple):
            return gdf
        return gdf

    elif is_kmz:
        try:
            input_file.seek(0)
        except Exception:
            pass
        return _process_kmz(input_file)

    elif is_shapefile:
        try:
            input_file.seek(0)
        except Exception:
            pass
        return _process_shapefile(input_file)

    elif is_gpkg:
        try:
            input_file.seek(0)
        except Exception:
            pass
        return _process_gpkg(input_file)

    elif is_kml:
        with NamedTemporaryFile(delete=False, suffix=".kml", prefix="upload_", dir=".") as tmp:
            input_file.save(tmp.name)
            tmp_kml = tmp.name

        try:
            return _parse_kml_manually(tmp_kml)
        finally:
            if tmp_kml and os.path.exists(tmp_kml):
                try:
                    os.unlink(tmp_kml)
                except Exception:
                    pass

    else:
        logger.warning(f"Formato de arquivo não reconhecido: {filename}. Tentando processar como KML...")
        with NamedTemporaryFile(delete=False, suffix=".kml", prefix="upload_", dir=".") as tmp:
            input_file.save(tmp.name)
            tmp_kml = tmp.name

        try:
            return _parse_kml_manually(tmp_kml)
        finally:
            if tmp_kml and os.path.exists(tmp_kml):
                try:
                    os.unlink(tmp_kml)
                except Exception:
                    pass
