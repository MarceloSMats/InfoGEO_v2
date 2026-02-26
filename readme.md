# InfoGEO - Sistema Avançado de Análise Geoespacial

Sistema web completo para análise de uso do solo e declividade baseado em arquivos KML/GeoJSON/Shapefile e imagens raster, com suporte a múltiplos polígonos, processamento individualizado e módulo de valoração agronômica.

---

## 📚 Documentação

- **[Início Rápido (5 minutos)](INICIO_RAPIDO.md)** - Instalação e uso básico
- **[Guia de Compartilhamento](COMPARTILHAMENTO.md)** - Como distribuir o projeto
- **[Estrutura do Projeto](ESTRUTURA_PROJETO.md)** - Arquitetura e organização
- **[README Completo](#)** - Este arquivo (documentação detalhada)

---

## 🚀 Funcionalidades Principais

### 📂 Importação de Dados Geoespaciais
- ✅ Upload de arquivos **KML** (com suporte a KMZ compactado)
- ✅ Upload de arquivos **GeoJSON**
- ✅ Upload de arquivos **Shapefile** (.shp ou .zip com todos os componentes)
- ✅ Processamento individual de cada polígono em arquivos multi-feature
- ✅ Validação e correção automática de geometrias
- ✅ Suporte a múltiplos sistemas de coordenadas (conversão automática)

### 🗺️ Visualização e Interação
- ✅ Visualização interativa no mapa com **Leaflet**
- ✅ **Desenho de polígonos diretamente no mapa** com ferramenta dedicada
- ✅ Controle de transparência da camada raster
- ✅ Zoom automático para área de interesse
- ✅ Popups informativos com coordenadas e dados do polígono
- ✅ Suporte a camadas base (OpenStreetMap, Satélite)

### 📊 Análise de Uso do Solo
- ✅ Análise detalhada com recorte preciso por polígono
- ✅ Cálculo de área total e por classe de uso
- ✅ Distribuição percentual automática
- ✅ **Método de pixel parcial otimizado** para maior precisão
- ✅ Suporte a raster padrão do sistema ou personalizado
- ✅ Processamento otimizado com **Cloud Optimized GeoTIFF (COG)**
- ✅ Detecção automática de overviews para grandes áreas

### 📈 Análise de Declividade
- ✅ Análise baseada no raster **ALOS_Declividade_Class_BR.tif**
- ✅ Classificação em 7 níveis (Plano até Escarpado)
- ✅ Retorno de área (ha) e percentual por classe
- ✅ Visualização colorida no mapa sincronizada com o polígono
- ✅ Gráficos de distribuição específicos para declividade

### 💰 Módulo de Valoração Agronômica
- ✅ **Cálculo automático de valor por hectare** baseado em quadrantes (GeoJSON Centroides_BR)
- ✅ **Cruzamento espacial com shapefile MACRO_RTA** para identificação da microregião
- ✅ **Nota agronômica específica por classe** usando CD_RTA (código da microregião)
- ✅ **Fórmula de valoração**: `Valor = Área (ha) × Nota Agronômica × Valor do Quadrante`
- ✅ **Valor total da propriedade** consolidado por classe e geral
- ✅ Formatação de valores em padrão brasileiro (R$)

### 📄 Geração de Relatórios
- ✅ **Relatórios PDF profissionais** com branding personalizado
- ✅ Relatórios individuais por polígono
- ✅ **Relatório consolidado** com todos os polígonos
- ✅ Gráficos para distribuição de classes (Uso e Declividade)
- ✅ Tabelas formatadas com dados de valoração
- ✅ Mapa de localização incluído
- ✅ Informações de geolocalização (município, UF)

### 🎨 Interface Moderna
- ✅ Design responsivo com **tema escuro/claro**
- ✅ **Painel flutuante de resultados** (maximizado/minimizado)
- ✅ Atalhos de teclado para operações comuns
- ✅ Histórico de análises recentes
- ✅ Suporte mobile e desktop

## 📋 Pré-requisitos

- **Python 3.8+**
- **GDAL/OGR** (com suporte a Shapefile)
- Navegador web moderno (Chrome, Firefox, Edge)

### Instalação do GDAL (Windows)

```bash
conda install -c conda-forge gdal
# ou
pip install GDAL
```

## 🛠️ Instalação

1. **Clone o repositório e acesse a pasta:**
```bash
git clone <url-do-repositorio>
cd InfoGEO
```

2. **Crie um ambiente virtual e instale dependências:**
```bash
python -m venv venv
venv\Scripts\activate     # Windows
pip install -r server/requirements.txt
```

3. **Configure os dados necessários na pasta `data/`** (conforme listado em `ESTRUTURA_PROJETO.md`).

4. **Execute o servidor:**
```bash
python server/servidor.py
```

## 📁 Estrutura do Projeto (Resumo)

```
InfoGEO/
├── server/             # Backend Flask (servidor.py, geo_utils.py)
├── data/               # Dados geoespaciais (*.tif, *.geojson, *.shp)
├── js/                 # Lógica Frontend (app.js, map.js, declividade-module.js)
├── css/                # Estilos (style.css)
└── index.html          # Interface principal
```

## 🎯 Como Usar

1. **Carregamento**: Use o upload de arquivos ou desenhe diretamente no mapa.
2. **Configuração**: Acesse o ícone de engrenagem (⚙️) para habilitar valoração ou trocar rasters.
3. **Análise**: Clique em "Analisar Uso do Solo" ou "Analisar Declividade".
4. **Resultados**: Visualize os dados no painel flutuante e gere o PDF se necessário.

## 🎨 Classes de Uso do Solo e Declividade

O sistema utiliza padrões de cores internacionais e brasileiros para representação (MapBiomas para uso, ALOS for declividade).

---

## 🆕 Histórico de Versões

### v2.1.1 (Atual) - Fevereiro 2026
- ✨ **Integração total do Módulo de Declividade**.
- ✨ **Novo Painel Flutuante de Resultados** com suporte a múltiplos gráficos.
- ✨ **Documentação atualizada** e guia de vinculação de módulos.

### v2.1.0 - Dezembro 2025
- 🔧 **CORREÇÃO CRÍTICA:** Fluxo de valoração completamente refeito.
- ✨ **Cruzamento espacial com MACRO_RTA**: Identificação automática da microregião.

### v2.0.0 - Novembro 2025
- ✨ Versão base com Valoração e suporte a Shapefiles.

---

**InfoGEO - Análise Geoespacial de Uso do Solo e Declividade** © 2024-2026