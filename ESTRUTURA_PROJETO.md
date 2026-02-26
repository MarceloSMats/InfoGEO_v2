# 📐 Estrutura do Projeto InfoGEO

Documentação da organização e arquitetura do projeto.

---

## 🌳 Árvore de Diretórios

```
InfoGEO/
│
├── 📄 index.html                    # Página principal da aplicação
├── 📄 readme.md                     # Documentação completa
├── 📄 INICIO_RAPIDO.md             # Guia de 5 minutos
├── 📄 COMPARTILHAMENTO.md          # Guia para distribuição
├── 📄 config.py                     # Configurações centralizadas
├── 📄 .env.example                  # Exemplo de variáveis de ambiente
├── 📄 .gitignore                    # Arquivos ignorados pelo Git
│
├── 🔧 instalar.bat                  # Script de instalação (Windows)
├── 🔧 iniciar.bat                   # Script para iniciar servidor (Windows)
│
├── 📁 css/                          # Estilos da aplicação
│   └── style.css                    # CSS principal
│
├── 📁 js/                           # Scripts JavaScript
│   ├── app.js                       # Lógica principal da UI
│   ├── map.js                       # Gerenciamento do mapa Leaflet
│   ├── valoracao.js                 # Módulo de valoração agronômica
│   ├── declividade-module.js        # Módulo de análise de declividade
│   ├── utils.js                     # Funções utilitárias
│   └── pdf-generator.js             # Geração de relatórios PDF
│
├── 📁 server/                       # Backend Python/Flask
│   ├── servidor.py                  # API Flask principal
│   ├── geo_utils.py                 # Processamento raster e geometrias
│   ├── file_parsers.py              # Leitura de variados formatos geoespaciais
│   └── requirements.txt             # Dependências Python
│
├── 📁 data/                         # Dados geoespaciais (usuário adiciona)
│   ├── *.tif                        # Rasters (Uso do Solo e Declividade)
│   ├── Centroides_BR.geojson       # GeoJSON Valoração
│   └── *.xlsx                       # Planilhas complementares
│
├── 📁 images/                       # Imagens e ícones
│
└── 📁 .venv/                        # Ambiente virtual (criado na instalação)
```

---

## 🏗️ Arquitetura da Aplicação

### Frontend (Cliente)

```
┌─────────────────────────────────────────────────┐
│           index.html (Interface)                │
├─────────────────────────────────────────────────┤
│  app.js          │  Gerencia UI e upload        │
│  map.js          │  Controla mapa Leaflet       │
│  valoracao.js    │  Módulo de valoração         │
│  declividade-js  │  Módulo de declividade       │
│  utils.js        │  Funções auxiliares          │
│  pdf-generator.js│  Exportação PDF              │
└─────────────────────────────────────────────────┘
                      ↓ HTTP/AJAX
┌─────────────────────────────────────────────────┐
│         servidor.py (API Flask)                 │
├─────────────────────────────────────────────────┤
│  /analisar       │  Analisa Uso do Solo         │
│  /analisar-declivid│ Analisa Declividade        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│        Bibliotecas Geoespaciais                 │
├─────────────────────────────────────────────────┤
│  rasterio        │  Leitura de rasters          │
│  geopandas       │  Manipulação de shapefiles   │
│  shapely         │  Geometrias                  │
│  fiona           │  I/O geoespacial             │
│  pyproj          │  Projeções                   │
└─────────────────────────────────────────────────┘
```

---

## 📋 Fluxo de Dados Principal

### 1. Upload e Validação
```
Usuário → Upload arquivo (KML/KMZ/GeoJSON/SHP)
         ↓
app.js → Validação de formato
         ↓
FormData → Envio para /analisar
```

### 2. Processamento Backend
```
servidor.py → Recebe arquivo
            ↓
validar_geometrias() → Converte para GeoDataFrame
                      ↓
            ┌─────────────────┐
            │ Valoração ativa? │
            └────────┬─────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
        SIM                     NÃO
         │                       │
         ↓                       ↓
processar_valoracao()    analisar_uso_solo()
         │                       │
         └───────────┬───────────┘
                     ↓
              Retorna JSON
```

### 3. Visualização
```
JSON response → app.js
              ↓
       ┌──────┴──────┐
       │             │
   map.js      Tabelas HTML
       │             │
  Camadas      Estatísticas
  GeoJSON      Classes
  Centroides   Área (ha/m²)
```

---

## 🔧 Módulos Principais

### `servidor.py` (2084 linhas)

**Funções-chave:**

| Função | Linha aproximada | Descrição |
|--------|----------|-----------|
| `validar_geometrias()` | ~200 | Converte upload para GeoDataFrame |
| `analisar_uso_solo()` | ~500 | Extrai valores do raster |
| `processar_valoracao()` | ~800 | Calcula valoração agronômica |
| `rota_analisar()` | ~1500 | Endpoint principal |

**Endpoints:**

| Rota | Método | Parâmetros | Retorno |
|------|--------|-----------|---------|
| `/analisar` | POST | arquivo, valoracao | JSON com análise |

### `app.js`

**Responsabilidades:**
- Upload de arquivos
- Validação de formatos
- Comunicação com API
- Renderização de tabelas
- Controle de loading states
- Integração com módulos

### `map.js`

**Funções principais:**
- Inicialização do Leaflet
- Adição de camadas GeoJSON
- Popup de informações
- Controle de zoom/pan
- Marcadores de centroides

### `valoracao.js`

**Módulo independente para:**
- Gerenciar checkbox de valoração
- Exibir tabela de valoração
- Mostrar informações de centroides
- Integrar com mapa

---

## 📦 Dependências Críticas

### Python (Backend)

```python
Flask==3.1.0           # Framework web
rasterio==1.4.3        # Leitura de rasters
geopandas==1.0.1       # Manipulação geoespacial
shapely==2.0.6         # Geometrias
fiona==1.10.2          # I/O de shapefiles
pyproj==3.7.0          # Projeções cartográficas
numpy==2.2.2           # Arrays numéricos
pandas==2.2.3          # DataFrames
openpyxl==3.1.5        # Leitura de Excel
geopy==2.4.1           # Geocodificação
```

### JavaScript (Frontend)

```javascript
Leaflet 1.9.4          // Mapas interativos
jsPDF                  // Geração de PDFs
```

---

## 🎨 Padrões de Código

### Convenções Python

```python
# Funções usam snake_case
def processar_geometria(geom):
    pass

# Constantes em MAIÚSCULAS
CLASSES_NOMES = {...}

# Comentários descritivos
# Extrai valores do raster para cada pixel da geometria
```

### Convenções JavaScript

```javascript
// Funções usam camelCase
function processarResultados(data) {}

// Constantes descritivas
const API_BASE_URL = '/api';

// Event handlers nomeados
function handleUploadClick(event) {}
```

---

## 🔒 Segurança

### Validações Implementadas

1. **Upload de arquivos:**
   - Tamanho máximo (5GB padrão)
   - Formatos permitidos (KML, KMZ, GeoJSON, SHP)
   - Validação de estrutura GeoJSON

2. **Geometrias:**
   - Validação de polígonos (Shapely)
   - Reprojeção para EPSG:4326
   - Sanitização de dados

3. **CORS:**
   - Configurado para aceitar origens permitidas
   - Headers apropriados

### ⚠️ Melhorias Recomendadas

- [ ] Adicionar rate limiting
- [ ] Validar tamanho de polígonos
- [ ] Sanitizar nomes de arquivos
- [ ] Implementar autenticação (se necessário)
- [ ] HTTPS em produção

---

## 🚀 Performance

### Otimizações Atuais

1. **Raster COG (Cloud Optimized GeoTIFF):**
   - Leitura eficiente de tiles
   - Menor uso de memória

2. **Caching:**
   - Shapefiles carregados uma vez
   - GeoDataFrames mantidos em memória

3. **Frontend:**
   - Leaflet otimizado para muitos pontos
   - Lazy loading de camadas

### 📊 Métricas Esperadas

| Operação | Tempo Médio |
|----------|-------------|
| Upload 1MB | ~500ms |
| Análise simples | 1-3s |
| Análise com valoração | 3-8s |
| Renderização mapa | <2s |

---

## 🧪 Testando Modificações

### Teste Básico

```bash
# 1. Verificar sintaxe Python
python -m py_compile server/servidor.py

# 2. Testar importações
python -c "import servidor"

# 3. Iniciar servidor
python server/servidor.py

# 4. Testar endpoint
curl http://localhost:5000
```

### Teste de Análise

```bash
# Usar arquivo de exemplo
curl -X POST http://localhost:5000/analisar \
  -F "arquivo=@sample_geo.json" \
  -F "valoracao=false"
```

---

## 📝 Adicionando Novas Funcionalidades

### Checklist

1. **Backend:**
   - [ ] Adicionar função em `servidor.py`
   - [ ] Criar rota Flask
   - [ ] Atualizar `requirements.txt` se necessário
   - [ ] Documentar no docstring

2. **Frontend:**
   - [ ] Adicionar lógica em `app.js` ou módulo específico
   - [ ] Atualizar UI em `index.html`
   - [ ] Adicionar estilos em `style.css`
   - [ ] Testar responsividade

3. **Documentação:**
   - [ ] Atualizar `README.md`
   - [ ] Adicionar exemplos de uso
   - [ ] Documentar limitações

4. **Testes:**
   - [ ] Testar localmente
   - [ ] Verificar console do navegador
   - [ ] Testar diferentes browsers
   - [ ] Validar com dados reais

---

## 🆘 Debugging

### Logs do Servidor

```python
# servidor.py já tem logs informativos
print(f"Geometrias válidas: {len(gdf)}")
print(f"Raster existe: {os.path.exists(tif_path)}")
```

### Console do Navegador

```javascript
// Adicionar logs temporários
console.log('Dados recebidos:', data);
console.log('Estado atual:', state);
```

### Ferramentas Úteis

- **Python:** `pdb` para debug interativo
- **JavaScript:** Chrome DevTools
- **Rede:** Inspecionar requests no Network tab
- **Geodados:** QGIS para validar shapefiles

---

## 📚 Recursos Adicionais

### Documentação de Bibliotecas

- [Rasterio Docs](https://rasterio.readthedocs.io/)
- [GeoPandas Docs](https://geopandas.org/)
- [Leaflet Docs](https://leafletjs.com/)
- [Flask Docs](https://flask.palletsprojects.com/)

### Tutoriais Relacionados

- GeoJSON format: [geojson.org](https://geojson.org/)
- EPSG codes: [epsg.io](https://epsg.io/)
- KML reference: [Google KML](https://developers.google.com/kml/documentation)

---

**Última atualização:** 2026-02-21  
**Versão:** 2.1.1
