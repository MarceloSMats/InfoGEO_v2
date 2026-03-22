"""
Arquivo de Configuração do InfoGEO
===================================

Este arquivo centraliza todas as configurações da aplicação.
Edite aqui para personalizar caminhos, portas e outras opções.
"""

import os
from pathlib import Path

# =============================================================================
# CONFIGURAÇÕES DO SERVIDOR
# =============================================================================

# Porta do servidor (padrão: 5000)
SERVER_PORT = int(os.getenv("INFOGEO_PORT", 5000))

# Host do servidor (0.0.0.0 = aceita conexões externas)
SERVER_HOST = os.getenv("INFOGEO_HOST", "0.0.0.0")

# Modo debug (True = desenvolvimento, False = produção)
DEBUG_MODE = os.getenv("INFOGEO_DEBUG", "True").lower() == "true"

# Tamanho máximo de upload (em MB)
MAX_UPLOAD_SIZE_MB = int(os.getenv("INFOGEO_MAX_UPLOAD_MB", 5000))

# =============================================================================
# CAMINHOS DE ARQUIVOS
# =============================================================================

# Diretório base do projeto
BASE_DIR = Path(__file__).parent

# Diretório de dados
DATA_DIR = BASE_DIR / "data"

# Arquivo raster principal (COG)
RASTER_DEFAULT_PATH = os.getenv(
    "INFOGEO_RASTER_PATH", str(DATA_DIR / "LULC_VALORACAO_10m_com_mosaico.cog.tif")
)

# Raster alternativo (sem mosaico)
RASTER_SEM_MOSAICO_PATH = str(DATA_DIR / "Brasil_LULC_10m_sem_mosaico_DW.tif")

# Raster Aptidão Agronômica
RASTER_APTIDAO_PATH = str(DATA_DIR / "Aptidao_5Classes_majorado_r2.tif")

# =============================================================================
# SHAPEFILES E DADOS COMPLEMENTARES
# =============================================================================

# Shapefile SIGEF (desativado nesta versão — sem dados disponíveis)
# SIGEF_SHAPEFILE_DIR = DATA_DIR / "SIGEF_AMOSTRA"
# SIGEF_SHAPEFILE_PATH = SIGEF_SHAPEFILE_DIR / "SIGEF_APENAS_AMOSTRAS_062025.shp"

# Excel complementar SIGEF (desativado nesta versão)
# SIGEF_EXCEL_PATH = DATA_DIR / "SIGEF_AMOSTRA.xlsx"

# GeoJSON de Centroides (Valoração)
CENTROIDES_GEOJSON_PATH = DATA_DIR / "Centroides_BR.geojson"

# GeoPackage de CAR (Cadastro Ambiental Rural)
CAR_GPKG_PATH = DATA_DIR / 'CAR_BR_BB_simplificado.gpkg'

# Excel de Micro Classes (Notas Agronômicas)
MICRO_CLASSES_EXCEL_PATH = DATA_DIR / "CD_MICRO_CLASSES.xlsx"

# =============================================================================
# CONFIGURAÇÕES DE VALORAÇÃO
# =============================================================================

# Habilitar módulo de valoração por padrão
VALORACAO_ENABLED_DEFAULT = (
    os.getenv("INFOGEO_VALORACAO_DEFAULT", "True").lower() == "true"
)

# Usar geolocalização reversa (requer internet)
GEOLOCATION_ENABLED = os.getenv("INFOGEO_GEOLOCATION", "True").lower() == "true"

# User agent para geopy
GEOPY_USER_AGENT = "InfoGEO_Analyzer_v2.0"

# Timeout para geocoding (segundos)
GEOCODING_TIMEOUT = 10

# =============================================================================
# CLASSES DE USO DO SOLO
# =============================================================================

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
    1: "#c27ba0",
    2: "#9932cc",
    3: "#edde8e",
    4: "#d6bc74",
    5: "#d4271e",
    6: "#7a5900",
    8: "#1f8d49",
    9: "#2532e4",
    10: "#5e5e5e",
    100: "#000000",
}

# =============================================================================
# CLASSES DE DECLIVIDADE
# =============================================================================

DECLIVIDADE_CLASSES_NOMES = {
    0: "Sem classe (NoData/fora do raster)",
    1: "0-3% (Plano)",
    2: "3-8% (Suave Ondulado)",
    3: "8-13% (Moderadamente Ondulado)",
    4: "13-20% (Ondulado)",
    5: "20-45% (Forte Ondulado)",
    6: "45-75% (Montanhoso)",
    7: "75-<100% (Escarpado)",
    8: "≥100% (APP Legal)",
}

DECLIVIDADE_CLASSES_CORES = {
    0: "#CCCCCC",
    1: "#2E7D32",  # Verde escuro  - Plano
    2: "#66BB6A",  # Verde claro   - Suave Ondulado
    3: "#C8E6C9",  # Verde muito claro - Moderadamente Ondulado
    4: "#FDD835",  # Amarelo       - Ondulado
    5: "#FB8C00",  # Laranja       - Forte Ondulado
    6: "#E53935",  # Vermelho      - Montanhoso
    7: "#8E24AA",  # Roxo          - Escarpado
    8: "#4A148C",  # Roxo escuro   - APP Legal
}

# =============================================================================
# CLASSES DE APTIDÃO AGRONÔMICA
# =============================================================================

APTIDAO_CLASSES_NOMES = {
    0: "Sem classe (NoData/fora do raster)",
    1: "Apta (0–20%)",
    2: "Restrita (20–45%)",
    3: "Manual (45–75%)",
    4: "Extrema (75–<100%)",
    5: "APP Legal (≥100%)",
}

APTIDAO_CLASSES_DESCRICOES = {
    0: "",
    1: "Apta para todas as culturas (Grãos, Cana, etc.). Risco agronômico mínimo.",
    2: "Atenção: apta para Café/Perenes, Pecuária e Silvicultura. Inapta para commodities (Soja/Milho).",
    3: "Apta com restrições. Foco em Agricultura Familiar (Pronaf), Café de Montanha e Fruticultura. Inviável para agricultura intensiva.",
    4: "Recusa Técnica. Alto risco de inadimplência por quebra de safra/custo operacional e risco à segurança do trabalho.",
    5: "Bloqueio Jurídico. Financiamento vedado. Área de Preservação Permanente de Encosta.",
}

APTIDAO_CLASSES_CORES = {
    0: "#CCCCCC",
    1: "#028b00",
    2: "#f9f647",
    3: "#ea96b0",
    4: "#de0004",
    5: "#94187f",
}

# =============================================================================
# CLASSES DE SOLO TEXTURAL (MapBiomas)
# =============================================================================

# Raster de Classe Textural do Solo
RASTER_SOLO_TEXTURAL_PATH = str(DATA_DIR / "SOLO_CLASSE_TEXTURAL_MAPBIOMAS.tif")

SOLO_TEXTURAL_CLASSES_NOMES = {
    0:  "Sem classe (NoData/fora do raster)",
    1:  "Muito Argilosa",
    2:  "Argilosa",
    3:  "Argilo siltosa",
    4:  "Franco argilosa",
    5:  "Franco argilo siltosa",
    6:  "Argilo arenosa",
    7:  "Franco argilo arenosa",
    8:  "Franca",
    9:  "Franco arenosa",
    10: "Areia",
    11: "Areia franca",
    12: "Silte",
    13: "Franco siltosa",
}

SOLO_TEXTURAL_CLASSES_CORES = {
    0:  "#CCCCCC",
    1:  "#a83800",
    2:  "#aa8686",
    3:  "#3481a7",
    4:  "#e9a9a9",
    5:  "#80b1d3",
    6:  "#c994c7",
    7:  "#f4a582",
    8:  "#d7c5a5",
    9:  "#f8d488",
    10: "#fffe73",
    11: "#e4b074",
    12: "#b5d6ae",
    13: "#abba7c",
}

# =============================================================================
# CLASSES DE CLIMA KÖPPEN-GEIGER
# =============================================================================

# Raster de Classificação Climática Köppen-Geiger
RASTER_KOPPEN_PATH = str(DATA_DIR / "Koppen_Brasil.tif")

# Excel de Dados Climáticos Köppen (temperatura, precipitação, altitude por município)
KOPPEN_EXCEL_PATH = DATA_DIR / "Koppen_Brasil.xls"

KOPPEN_CLASSES_NOMES = {
    0:  "Sem classe (NoData/fora do raster)",
    1:  "Cwa — Subtropical com inverno seco e verão quente",
    2:  "Am — Monçônico tropical",
    3:  "Af — Tropical úmido sem estação seca (equatorial)",
    4:  "Cfa — Subtropical úmido com verão quente",
    5:  "Cwb — Subtropical com inverno seco e verão temperado",
    6:  "Csb — Mediterrâneo com verão seco e temperado",
    7:  "Csa — Mediterrâneo com verão seco e quente",
    8:  "Cfb — Oceânico temperado úmido",
    9:  "BSh — Semiárido quente",
    10: "As — Tropical com estação seca de verão",
    11: "Cwc — Subtropical com inverno seco e verão frio",
    12: "Aw — Tropical de savana",
}

KOPPEN_CLASSES_CORES = {
    0:  "#CCCCCC",
    1:  "#7bae65",
    2:  "#314999",
    3:  "#221f65",
    4:  "#aac31b",
    5:  "#549a48",
    6:  "#b9c116",
    7:  "#e6e40a",
    8:  "#45922a",
    9:  "#d39525",
    10: "#8ec0e1",
    11: "#275c26",
    12: "#3a7bc7",
}

# =============================================================================
# CLASSES PRODES / EUDR (Desmatamento INPE)
# =============================================================================

# Raster PRODES — COG preferido, fallback para TIF original
_prodes_cog = DATA_DIR / "prodes_brasil" / "prodes_brasil_cog.tif"
_prodes_tif = DATA_DIR / "prodes_brasil" / "prodes_brasil.tif"
RASTER_PRODES_PATH = str(_prodes_cog if _prodes_cog.exists() else _prodes_tif)

PRODES_CLASSES_NOMES = {
    0:   "d2000 — Desmatamento acumulado ate 2000",
    2:   "d2002 — Desmatamento 2002",
    4:   "d2004 — Desmatamento 2004",
    6:   "d2006 — Desmatamento 2006",
    7:   "d2007 — Desmatamento 2007",
    8:   "d2008 — Desmatamento 2008",
    9:   "d2009 — Desmatamento 2009",
    10:  "d2010 — Desmatamento 2010",
    11:  "d2011 — Desmatamento 2011",
    12:  "d2012 — Desmatamento 2012",
    13:  "d2013 — Desmatamento 2013",
    14:  "d2014 — Desmatamento 2014",
    15:  "d2015 — Desmatamento 2015",
    16:  "d2016 — Desmatamento 2016",
    17:  "d2017 — Desmatamento 2017",
    18:  "d2018 — Desmatamento 2018",
    19:  "d2019 — Desmatamento 2019",
    20:  "d2020 — Desmatamento 2020 (Marco EUDR)",
    21:  "d2021 — Desmatamento 2021",
    22:  "d2022 — Desmatamento 2022",
    23:  "d2023 — Desmatamento 2023",
    24:  "d2024 — Desmatamento 2024",
    50:  "r2010 — Residuo/Regeneracao 2010",
    51:  "r2011 — Residuo/Regeneracao 2011",
    52:  "r2012 — Residuo/Regeneracao 2012",
    53:  "r2013 — Residuo/Regeneracao 2013",
    54:  "r2014 — Residuo/Regeneracao 2014",
    55:  "r2015 — Residuo/Regeneracao 2015",
    56:  "r2016 — Residuo/Regeneracao 2016",
    57:  "r2017 — Residuo/Regeneracao 2017",
    58:  "r2018 — Residuo/Regeneracao 2018",
    59:  "r2019 — Residuo/Regeneracao 2019",
    60:  "r2020 — Residuo/Regeneracao 2020",
    61:  "r2021 — Residuo/Regeneracao 2021",
    62:  "r2022 — Residuo/Regeneracao 2022",
    63:  "r2023 — Residuo/Regeneracao 2023",
    64:  "r2024 — Residuo/Regeneracao 2024",
    91:  "Hidrografia",
    100: "Vegetacao Nativa Florestal",
}

PRODES_CLASSES_CORES = {
    0:   "#ffff00",
    2:   "#ffc300",
    4:   "#ffc300",
    6:   "#ffc30f",
    7:   "#ffff00",
    8:   "#ffc31e",
    9:   "#ffc30f",
    10:  "#ffc82d",
    11:  "#ffc83c",
    12:  "#ffc84b",
    13:  "#ffc84b",
    14:  "#ffcd5a",
    15:  "#ffcd78",
    16:  "#ffcd69",
    17:  "#ffcd78",
    18:  "#ffd287",
    19:  "#ffd296",
    20:  "#ffd2a5",
    21:  "#ffd700",
    22:  "#ffd70f",
    23:  "#ffdc1e",
    24:  "#ffdc2d",
    50:  "#ff9600",
    51:  "#ff960f",
    52:  "#ff871e",
    53:  "#f0872d",
    54:  "#f0783c",
    55:  "#f0783c",
    56:  "#f0784b",
    57:  "#e16900",
    58:  "#ff9600",
    59:  "#ff5a1e",
    60:  "#ff960f",
    61:  "#ff871e",
    62:  "#f0872d",
    63:  "#f0783c",
    64:  "#f0784b",
    91:  "#0513b1",
    100: "#308703",
}

# Mapeamento de pixel ID -> nivel de risco EUDR
PRODES_EUDR_RISK = {
    # SAFE: vegetacao nativa e hidrografia
    100: "SAFE",
    91:  "SAFE",
    # CONSOLIDATED: desmatamento pre-2020
    0:   "CONSOLIDATED",
    2:   "CONSOLIDATED",
    4:   "CONSOLIDATED",
    6:   "CONSOLIDATED",
    7:   "CONSOLIDATED",
    8:   "CONSOLIDATED",
    9:   "CONSOLIDATED",
    10:  "CONSOLIDATED",
    11:  "CONSOLIDATED",
    12:  "CONSOLIDATED",
    13:  "CONSOLIDATED",
    14:  "CONSOLIDATED",
    15:  "CONSOLIDATED",
    16:  "CONSOLIDATED",
    17:  "CONSOLIDATED",
    18:  "CONSOLIDATED",
    19:  "CONSOLIDATED",
    # EUDR_MARKER: ano de corte 2020
    20:  "EUDR_MARKER",
    # HIGH_RISK: pos-2020
    21:  "HIGH_RISK",
    22:  "HIGH_RISK",
    23:  "HIGH_RISK",
    24:  "HIGH_RISK",
    # ATTENTION: residuo/regeneracao
    50:  "ATTENTION",
    51:  "ATTENTION",
    52:  "ATTENTION",
    53:  "ATTENTION",
    54:  "ATTENTION",
    55:  "ATTENTION",
    56:  "ATTENTION",
    57:  "ATTENTION",
    58:  "ATTENTION",
    59:  "ATTENTION",
    60:  "ATTENTION",
    61:  "ATTENTION",
    62:  "ATTENTION",
    63:  "ATTENTION",
    64:  "ATTENTION",
}

PRODES_EUDR_RISK_COLORS = {
    "SAFE":          "#308703",
    "CONSOLIDATED":  "#66BB6A",
    "EUDR_MARKER":   "#FF9800",
    "HIGH_RISK":     "#de0004",
    "ATTENTION":     "#FFC107",
}

PRODES_EUDR_RISK_LABELS = {
    "SAFE":          "Seguro — Vegetacao nativa intacta",
    "CONSOLIDATED":  "Consolidado — Desmatamento anterior a 2020",
    "EUDR_MARKER":   "Marco EUDR — Desmatamento no ano de corte (2020)",
    "HIGH_RISK":     "ALTO RISCO — Desmatamento pos-2020 (nao conforme EUDR)",
    "ATTENTION":     "Atencao — Residuo/Regeneracao (requer analise adicional)",
}

# Mapeamento pixel ID -> ano de desmatamento (para timeline)
PRODES_YEAR_MAP = {
    0: 2000, 2: 2002, 4: 2004,
    6: 2006, 7: 2007, 8: 2008, 9: 2009,
    10: 2010, 11: 2011, 12: 2012, 13: 2013,
    14: 2014, 15: 2015, 16: 2016, 17: 2017,
    18: 2018, 19: 2019, 20: 2020,
    21: 2021, 22: 2022, 23: 2023, 24: 2024,
}

# Shapefile MACRO_RTA (Microregiões)
MACRO_RTA_PATH = DATA_DIR / "MACRO_RTA_2025" / "MACRO_RTA.shp"

# Shapefile de Embargos IBAMA
EMBARGO_SHAPEFILE_PATH = DATA_DIR / "Embargos" / "adm_embargos_ibama_a.shp"

# Shapefile de Embargos ICMBio
ICMBIO_SHAPEFILE_PATH = DATA_DIR / "Embargos" / "embargos_icmbio.shp"

# =============================================================================
# SOLOS EMBRAPA — Classificação SiBCS 1:5.000.000 (2020)
# =============================================================================

# Vetor de Solos — GPKG preferido, fallback para Shapefile original
_solos_gpkg = DATA_DIR / "embrapa_solos" / "brasil_solos.gpkg"
_solos_shp  = DATA_DIR / "embrapa_solos" / "brasil_solos_5m_20201104.shp"
SOLOS_VECTOR_PATH = str(_solos_gpkg if _solos_gpkg.exists() else _solos_shp)
SOLOS_LAYER_NAME  = "solos_brasil"   # Layer name dentro do GPKG

# Cores por LEG_DESC — carregadas dinamicamente do JSON gerado pelo parse_qml_solos.py
import json as _json
_solos_cores_json = DATA_DIR / "embrapa_solos" / "solos_cores.json"
SOLOS_CORES: dict = (
    _json.loads(_solos_cores_json.read_text(encoding="utf-8"))
    if _solos_cores_json.exists()
    else {}
)

# Cores de fallback por Ordem SiBCS (quando LEG_DESC não encontrado no JSON)
SOLOS_ORDEM_CORES = {
    "Latossolos":                "#D4A76A",
    "Argissolos":                "#E8A87C",
    "Cambissolos":               "#C4B59B",
    "Gleissolos":                "#A8C8A0",
    "Espodossolos":              "#E8D5B0",
    "Plintossolos":              "#D4956A",
    "Vertissolos":               "#B8A89A",
    "Neossolos":                 "#D4C4A0",
    "Luvissolos":                "#E8B87C",
    "Planossolos":               "#C8D4A0",
    "Chernossolos":              "#9A8070",
    "Nitossolos":                "#C47050",
    "Afloramentos de Rochas":    "#BEBEBE",
    "Dunas":                     "#F5E6C0",
    "Agua":                      "#A8D4E8",
    "Outros":                    "#CCCCCC",
}

# =============================================================================
# CONFIGURAÇÕES DE LOGGING
# =============================================================================

# Nível de log (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL = os.getenv("INFOGEO_LOG_LEVEL", "INFO")

# Formato do log
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

# Salvar logs em arquivo
LOG_TO_FILE = os.getenv("INFOGEO_LOG_FILE", "False").lower() == "true"
LOG_FILE_PATH = BASE_DIR / "logs" / "infogeo.log"

# =============================================================================
# VALIDAÇÕES
# =============================================================================


def validate_configuration():
    """Valida se os arquivos necessários existem e cria estrutura de diretórios."""

    # Criar diretório de dados se não existir
    DATA_DIR.mkdir(exist_ok=True)

    # Criar diretório de logs se necessário
    if LOG_TO_FILE:
        LOG_FILE_PATH.parent.mkdir(exist_ok=True)

    # Avisos para arquivos opcionais faltantes
    warnings = []

    if not Path(RASTER_DEFAULT_PATH).exists():
        warnings.append(f"⚠️  Raster principal não encontrado: {RASTER_DEFAULT_PATH}")

    # SIGEF desativado nesta versão
    # if not SIGEF_SHAPEFILE_PATH.exists():
    #     warnings.append(f"⚠️  Shapefile SIGEF não encontrado: {SIGEF_SHAPEFILE_PATH}")
    #     warnings.append("   → Funcionalidade de busca SIGEF desabilitada")

    if not CENTROIDES_GEOJSON_PATH.exists():
        warnings.append(
            f"⚠️  GeoJSON de Centroides não encontrado: {CENTROIDES_GEOJSON_PATH}"
        )
        warnings.append("   → Módulo de valoração desabilitado")

    if not MICRO_CLASSES_EXCEL_PATH.exists():
        warnings.append(
            f"⚠️  Excel de Micro Classes não encontrado: {MICRO_CLASSES_EXCEL_PATH}"
        )
        warnings.append("   → Notas agronômicas não disponíveis")

    if not Path(RASTER_SOLO_TEXTURAL_PATH).exists():
        warnings.append(
            f"⚠️  Raster de Solo Textural não encontrado: {RASTER_SOLO_TEXTURAL_PATH}"
        )
        warnings.append("   → Análise de classe textural do solo desabilitada")

    if not Path(RASTER_KOPPEN_PATH).exists():
        warnings.append(f"⚠️  Raster Köppen não encontrado: {RASTER_KOPPEN_PATH}")
        warnings.append("   → Análise climática Köppen-Geiger desabilitada")

    if not KOPPEN_EXCEL_PATH.exists():
        warnings.append(f"⚠️  Excel Köppen não encontrado: {KOPPEN_EXCEL_PATH}")
        warnings.append("   → Dados climáticos municipais (temperatura/precipitação) indisponíveis")

    if not Path(RASTER_PRODES_PATH).exists():
        warnings.append(f"⚠️  Raster PRODES não encontrado: {RASTER_PRODES_PATH}")
        warnings.append("   → Análise PRODES/EUDR desabilitada")

    if not Path(SOLOS_VECTOR_PATH).exists():
        warnings.append(f"⚠️  Vetor de Solos Embrapa não encontrado: {SOLOS_VECTOR_PATH}")
        warnings.append("   → Análise pedológica SiBCS desabilitada")
    elif not SOLOS_CORES:
        warnings.append("⚠️  JSON de cores dos solos (solos_cores.json) não encontrado")
        warnings.append("   → Execute: python server/parse_qml_solos.py")

    return warnings


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_config_summary():
    """Retorna resumo da configuração atual."""
    return {
        "servidor": {
            "porta": SERVER_PORT,
            "host": SERVER_HOST,
            "debug": DEBUG_MODE,
            "max_upload_mb": MAX_UPLOAD_SIZE_MB,
        },
        "arquivos": {
            "raster_principal": str(RASTER_DEFAULT_PATH),
            "raster_existe": Path(RASTER_DEFAULT_PATH).exists(),
            # "sigef_disponivel": SIGEF_SHAPEFILE_PATH.exists(),  # SIGEF desativado
            "valoracao_disponivel": CENTROIDES_GEOJSON_PATH.exists(),
        },
        "modulos": {
            "valoracao_padrao": VALORACAO_ENABLED_DEFAULT,
            "geolocalizacao": GEOLOCATION_ENABLED,
        },
    }
