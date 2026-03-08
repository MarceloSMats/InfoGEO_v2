# 🔗 Guia de Vinculação de Novos Módulos - InfoGEO

Este guia descreve o processo para adicionar um novo módulo de análise ao InfoGEO, seguindo o padrão estabelecido pelo módulo de **Uso do Solo** (referência principal) e replicado em **Declividade**, **Aptidão**, **Textura do Solo** e **Embargo IBAMA**.

---

## 1. ⚙️ Backend (`config.py` e `servidor.py`)

### 1.1 Definir constantes em `config.py`
```python
NOVO_MODULO_CLASSES_NOMES = {
    1: "Classe A",
    2: "Classe B",
}

NOVO_MODULO_CLASSES_CORES = {
    1: "#FF0000",
    2: "#00FF00",
}

RASTER_NOVO_PATH = DATA_DIR / 'seu_raster.tif'
```

### 1.2 Criar função de processamento em `servidor.py`
Reutilize `server.geocoding`, `server.geo_utils` e `server.utils`.
```python
def _process_novo_modulo_sync(kml_file, raster_path):
    # Siga o exemplo de _process_declividade_sync
    # 1. Carregar GDF
    # 2. Processar raster (fractions/stats)
    # 3. Retornar dict com: status, relatorio, imagem_recortada, metadados
```

### 1.3 Criar endpoint Flask
```python
@app.route("/analisar-novo", methods=["POST"])
def analisar_novo():
    # Validar entrada e chamar _process_novo_modulo_sync
```

---

## 2. 🎨 Frontend HTML (`index.html`)

### 2.1 Checkbox no dropdown de análises
A sidebar utiliza um **dropdown colapsável** com checkboxes (`#analysisDropdown`). Para adicionar um novo módulo, insira um novo `<label>` dentro de `#analysisDropdownItems`:
```html
<label class="analysis-check-item">
    <input type="checkbox" id="chkSidebarNovo" />
    <span>✨ Nome do Módulo</span>
</label>
```

> **Nota:** Não é necessário criar um botão individual. O botão **"🔍 Realizar Análise"** (`#btnRunAnalysis`) executa todas as análises selecionadas no dropdown via `APP.runSelectedAnalyses()`.

### 2.2 Registrar no `runSelectedAnalyses` (`app.js`)
Adicionar a chamada ao novo módulo no método `runSelectedAnalyses` de `app.js`:
```javascript
// Novo Módulo
if (chkNovo.checked && typeof NovoModulo !== 'undefined') {
    await NovoModulo.analyzeNovo();
}
```

### 2.3 Aba no painel flutuante
Adicionar em `.chart-tabs` dentro de `#floatingPanel`:
```html
<button class="chart-tab" data-chart="novo" id="tabNovo" style="display: none;">
    <span class="tab-icon">✨</span>
    <span class="tab-label">Novo</span>
</button>
```

---

## 3. 🧠 Módulo JavaScript (`js/novo-module.js`)

### 3.1 Estrutura obrigatória
Todo módulo **deve** seguir esta estrutura:

> **Importante:** O módulo NÃO precisa ter listener de botão na sidebar. A análise é acionada pelo `APP.runSelectedAnalyses()` que lê os checkboxes do dropdown. O `setupEventListeners` é usado apenas para botões internos (ex: limpar análise).

```javascript
const NovoModulo = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        rasterLayers: []           // ← ARRAY de layers, não layer único
    },

    // Cores e nomes das classes
    CORES_NOVO: { /* ... */ },
    NOMES_NOVO: { /* ... */ },

    init: function () {
        this.setupEventListeners();
        console.log('Módulo Novo inicializado');
    },
    setupEventListeners: function () {
        // Apenas botões internos do módulo (ex: limpar)
        const btnClear = document.getElementById('btnClearNovo');
        if (btnClear) btnClear.addEventListener('click', () => this.clearAnalysis());
    },

    // ===== ANÁLISE =====

    analyzeNovo: async function () {
        // Loop principal com barra de progresso:
        for (let i = 0; i < APP.state.currentFiles.length; i++) {
            const file = APP.state.currentFiles[i];
            APP.showProgress(`Novo: ${file.name}`, i + 1, total);
            const result = await this.analyzeFile(file, i);
            if (result) results.push(result);
        }
        APP.hideProgress();

        if (results.length > 0) {
            this.state.analysisResults = results;
            this.displayResults(results);
            APP.showStatus(`Análise concluída para ${results.length} polígono(s)!`, 'success');
        }
    },

    analyzeFile: async function (file, index) { /* fetch /analisar-novo */ },
    analyzeDrawnPolygon: async function () { /* fetch com GeoJSON do polígono desenhado */ },

    // ===== EXIBIÇÃO DE RESULTADOS =====

    displayResults: function (results) {
        if (typeof APP === 'undefined') return;

        // Mostrar painel flutuante minimizado (compact)
        const panel = document.getElementById('floatingPanel');
        if (panel) {
            panel.style.display = 'block';
            if (!panel.classList.contains('maximized')) {
                panel.classList.add('compact');
            }
        }

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);

        // Se já existe Uso do Solo, apenas atualizar abas
        if (APP.state.analysisResults && APP.state.analysisResults.length > 0) {
            FloatingPanel.setupVisualizationToggle(polygonIndex);
        } else {
            // Sem Solo: inicializar painel SEM zoom
            APP.showPolygonResult(polygonIndex, { skipZoom: true });
        }

        // Mostrar controle de opacidade
        const opacityControl = document.getElementById('opacityControl');
        if (opacityControl) opacityControl.style.display = 'flex';
    },

    // ===== CAMADAS RASTER NO MAPA =====

    showNovoImageOnMap: function () {
        if (!this.state.analysisResults || this.state.analysisResults.length === 0) return;
        this.hideNovoImageOnMap(); // Limpar anteriores

        const opacitySlider = document.getElementById('opacitySlider');
        const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.7;
        if (!MAP.state.leafletMap) return;

        // Itera TODOS os resultados — cria overlay para cada polígono
        for (let i = 0; i < this.state.analysisResults.length; i++) {
            const result = this.state.analysisResults[i];
            if (!result) continue;

            let imagemRecortada = result.relatorio?.imagem_recortada || result.imagem_recortada;
            if (!imagemRecortada) continue;

            let imageUrl;
            if (typeof imagemRecortada === 'string') {
                imageUrl = imagemRecortada.startsWith('data:') ? imagemRecortada : 'data:image/png;base64,' + imagemRecortada;
            } else if (imagemRecortada.base64) {
                imageUrl = 'data:image/png;base64,' + imagemRecortada.base64;
            } else continue;

            const bounds = MAP.getPolygonBounds(i);
            if (bounds) {
                this.state.rasterLayers[i] = L.imageOverlay(imageUrl, bounds, { opacity }).addTo(MAP.state.leafletMap);
            }
        }
    },

    hideNovoImageOnMap: function () {
        if (MAP.state.leafletMap) {
            this.state.rasterLayers.forEach(layer => {
                if (layer && MAP.state.leafletMap.hasLayer(layer)) {
                    MAP.state.leafletMap.removeLayer(layer);
                }
            });
        }
        this.state.rasterLayers = [];
    },

    clearAnalysis: function () {
        this.hideNovoImageOnMap();
        this.state.analysisResults = null;
    },
};
```

### 3.2 Registrar no `index.html`
O script deve ser carregado **após** `floating-panel.js` e `app.js`:
```html
<script src="js/floating-panel.js"></script>
<script src="js/app.js"></script>
<script src="js/novo-module.js"></script>
```

---

## 4. 🔌 Integração com o Painel Flutuante e Outros Módulos

> **Nota:** Após a refatoração, as funções de controle do painel flutuante foram movidas de `app.js` para o módulo `FloatingPanel` em `js/floating-panel.js`. As integrações abaixo devem ser feitas nos arquivos correspondentes.

### 4.1 `FloatingPanel.setupVisualizationToggle` (em `floating-panel.js`)
Adicionar verificação do novo módulo e controle de visibilidade da aba:
```javascript
const hasNovo = typeof NovoModulo !== 'undefined' && NovoModulo.state?.analysisResults?.length > 0;
if (tabNovo) tabNovo.style.display = hasNovo ? 'flex' : 'none';
```

### 4.2 `FloatingPanel.switchChartTab` (em `floating-panel.js`)
Adicionar caso para o novo tipo de gráfico:
```javascript
else if (chartType === 'novo') {
    MAP.hideRasters();
    if (typeof DecliviDADE !== 'undefined') DecliviDADE.hideDecliviDADEImageOnMap();
    if (typeof Aptidao !== 'undefined') Aptidao.hideAptidaoImageOnMap();
    if (typeof NovoModulo !== 'undefined') NovoModulo.showNovoImageOnMap();
    // Renderizar gráfico do novo módulo
}
```

### 4.3 `MAP.setRasterOpacity` (em `map.js`)
Adicionar iteração dos rasterLayers do novo módulo:
```javascript
if (typeof NovoModulo !== 'undefined' && NovoModulo.state?.rasterLayers) {
    NovoModulo.state.rasterLayers.forEach(layer => {
        if (layer) layer.setOpacity(opacity);
    });
}
```

### 4.4 `FloatingPanel.updateCenter` (em `floating-panel.js`)
Adicionar seção de tabela para o novo módulo, seguindo o mesmo padrão de Declividade/Aptidão.

### 4.5 `pdf-generator.js`
Incluir dados do novo módulo no relatório PDF.

---

## ⚠️ Padrões obrigatórios

| Padrão | Correto | Incorreto |
|---|---|---|
| Ativação da análise | Checkbox no dropdown + `runSelectedAnalyses` | Botão individual na sidebar |
| Armazenamento de rasters | `state.rasterLayers: []` (array) | `state.currentLayer` (único) |
| Exibição no mapa | `for` iterando todos os resultados | Apenas `results[currentIndex]` |
| Progresso de análise | `APP.showProgress()` + `APP.hideProgress()` | `APP.showStatus()` com contagem |
| Exibição do painel | `panel.classList.add('compact')` | `APP.restorePanel()` |
| Zoom após análise | `showPolygonResult(i, { skipZoom: true })` | `showPolygonResult(i)` (faz zoom) |
| Limpeza | `hideNovoImageOnMap()` dentro de `clearAnalysis()` | Apenas `null` no state |

## ✅ Checklist de Integração
- [ ] Raster na pasta `/data`, registrado em `config.py`
- [ ] Endpoint retornando JSON com `status`, `relatorio`, `imagem_recortada`, `metadados`
- [ ] Checkbox adicionado no dropdown `#analysisDropdownItems` em `index.html`
- [ ] Chamada registrada em `APP.runSelectedAnalyses()` em `app.js`
- [ ] Módulo JS com `rasterLayers: []` no state
- [ ] `showImageOnMap` itera todos os resultados
- [ ] `hideImageOnMap` itera e limpa `rasterLayers`
- [ ] `displayResults` mostra painel em modo `compact` e usa `skipZoom: true`
- [ ] Análise usa `APP.showProgress()` / `APP.hideProgress()`
- [ ] Aba registrada em `FloatingPanel.setupVisualizationToggle` e `FloatingPanel.switchChartTab` (em `floating-panel.js`)
- [ ] Opacidade registrada em `MAP.setRasterOpacity`
- [ ] Tabela adicionada em `FloatingPanel.updateCenter` (em `floating-panel.js`)
- [ ] PDF atualizado em `pdf-generator.js`
- [ ] Gráfico respeita o tema (Claro/Escuro)

---
**Dica:** Use `js/utils.js` (frontend) e `server/utils.py` (backend) para cores, formatação de áreas e mensagens.
