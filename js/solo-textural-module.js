// Módulo de Análise de Classe Textural do Solo (MapBiomas)
const SoloTextural = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        rasterLayers: []
    },

    // Cores das classes de solo textural
    CORES_SOLO_TEXTURAL: {
        0:  "#CCCCCC",
        1:  "#a83800",  // Muito Argilosa
        2:  "#aa8686",  // Argilosa
        3:  "#3481a7",  // Argilo siltosa
        4:  "#e9a9a9",  // Franco argilosa
        5:  "#80b1d3",  // Franco argilo siltosa
        6:  "#c994c7",  // Argilo arenosa
        7:  "#f4a582",  // Franco argilo arenosa
        8:  "#d7c5a5",  // Franca
        9:  "#f8d488",  // Franco arenosa
        10: "#fffe73",  // Areia
        11: "#e4b074",  // Areia franca
        12: "#b5d6ae",  // Silte
        13: "#abba7c",  // Franco siltosa
    },

    // Nomes das classes de solo textural
    NOMES_SOLO_TEXTURAL: {
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
    },

    /**
     * Inicialização do módulo
     */
    init: function () {
        this.setupEventListeners();
        console.log('Módulo de Textura do Solo inicializado');
    },

    /**
     * Configurar event listeners
     */
    setupEventListeners: function () {
        const btnAnalyze = document.getElementById('btnAnalyzeSoloTextural');
        if (btnAnalyze) {
            btnAnalyze.addEventListener('click', () => this.analyzeSoloTextural());
        }

        const btnClear = document.getElementById('btnClearSoloTextural');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearAnalysis());
        }
    },

    /**
     * Executar análise de textura do solo
     */
    analyzeSoloTextural: async function () {
        if (this.state.isAnalyzing) {
            APP.showStatus('Análise de textura do solo já em andamento...', 'warn');
            return;
        }

        const hasFiles = APP.state.currentFiles && APP.state.currentFiles.length > 0;
        const hasDrawnPolygon = APP.state.drawnPolygon !== null;

        if (!hasFiles && !hasDrawnPolygon) {
            APP.showStatus('Nenhum arquivo carregado ou polígono desenhado. Por favor, carregue um arquivo KML/GeoJSON ou desenhe um polígono no mapa.', 'error');
            return;
        }

        this.state.isAnalyzing = true;
        this.updateUIState(true);

        try {
            let results = [];

            if (hasDrawnPolygon) {
                APP.showProgress('Textura do Solo: polígono desenhado', 1, 1);
                const result = await this.analyzeDrawnPolygon();
                if (result) {
                    results.push(result);
                }
            } else if (hasFiles) {
                for (let i = 0; i < APP.state.currentFiles.length; i++) {
                    const file = APP.state.currentFiles[i];
                    APP.showProgress(`Textura do Solo: ${file.name}`, i + 1, APP.state.currentFiles.length);

                    const result = await this.analyzeFile(file, i);
                    if (result) {
                        results.push(result);
                    }
                }
            }

            APP.hideProgress();

            if (results.length > 0) {
                this.state.analysisResults = results;
                this.displayResults(results);
                APP.showStatus(`Análise de textura do solo concluída para ${results.length} polígono(s)!`, 'success');
            } else {
                APP.showStatus('Nenhum resultado de textura do solo obtido.', 'error');
            }

        } catch (error) {
            console.error('Erro na análise de textura do solo:', error);
            APP.showStatus(`Erro na análise de textura do solo: ${error.message}`, 'error');
        } finally {
            this.state.isAnalyzing = false;
            this.updateUIState(false);
        }
    },

    /**
     * Analisar arquivo individual
     */
    analyzeFile: async function (file, index) {
        const formData = new FormData();
        const fileToAnalyze = file.originalFile || file;
        formData.append('kml', fileToAnalyze);

        try {
            const response = await fetch('/analisar-solo-textural', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.status === 'sucesso') {
                return {
                    ...data,
                    fileName: file.name,
                    fileIndex: index
                };
            } else {
                APP.showStatus(`Erro no arquivo ${file.name}: ${data.mensagem}`, 'error');
                return null;
            }
        } catch (error) {
            console.error(`Erro ao analisar arquivo ${file.name}:`, error);
            APP.showStatus(`Erro ao processar ${file.name}`, 'error');
            return null;
        }
    },

    /**
     * Analisar polígono desenhado
     */
    analyzeDrawnPolygon: async function () {
        if (!APP.state.drawnPolygon) {
            return null;
        }

        try {
            const geojson = APP.state.drawnPolygon.toGeoJSON();
            const geojsonStr = JSON.stringify(geojson);
            const blob = new Blob([geojsonStr], { type: 'application/json' });
            const file = new File([blob], 'poligono_desenhado.geojson', { type: 'application/json' });

            const formData = new FormData();
            formData.append('kml', file);

            const response = await fetch('/analisar-solo-textural', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.status === 'sucesso') {
                return {
                    ...data,
                    fileName: 'Polígono Desenhado',
                    fileIndex: -1
                };
            } else {
                APP.showStatus(`Erro no polígono desenhado: ${data.mensagem}`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Erro ao analisar polígono desenhado:', error);
            APP.showStatus('Erro ao processar polígono desenhado', 'error');
            return null;
        }
    },

    /**
     * Exibir resultados da análise
     */
    displayResults: function (results) {
        if (typeof APP === 'undefined') return;
        if (!APP.state.analysisOrder.includes('soloTextural')) APP.state.analysisOrder.push('soloTextural');

        const panel = document.getElementById('floatingPanel');
        if (panel) {
            panel.style.display = 'block';
            if (!panel.classList.contains('maximized')) {
                panel.classList.add('compact');
            }
        }

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);

        if (APP.state.analysisResults && APP.state.analysisResults.length > 0) {
            APP.setupVisualizationToggle(polygonIndex);
        } else {
            APP.showPolygonResult(polygonIndex, { skipZoom: true });
        }

        // Forçar ativação da aba de Textura do Solo independentemente de outras análises
        setTimeout(() => {
            const tabStx = document.getElementById('tabSoloTextural');
            if (tabStx) tabStx.style.display = 'flex';
            if (typeof FloatingPanel !== 'undefined') {
                FloatingPanel.switchChartTab('soloTextural');
            }
        }, 150);

        const opacityControl = document.getElementById('opacityControl');
        if (opacityControl) {
            opacityControl.style.display = 'flex';
        }
    },

    /**
     * Criar card de resultado
     */
    createResultCard: function (result, index) {
        const card = document.createElement('div');
        card.className = 'result-card solo-textural-card';
        card.innerHTML = `
            <div class="result-header">
                <h3>🪨 ${result.fileName || `Polígono ${index + 1}`}</h3>
                <button class="btn-close" onclick="SoloTextural.removeResult(${index})">&times;</button>
            </div>
            <div class="result-body">
                ${this.createSummaryHTML(result)}
                ${this.createClassesTableHTML(result)}
                ${this.createImageHTML(result)}
                ${this.createMetadataHTML(result)}
            </div>
        `;
        return card;
    },

    /**
     * Criar HTML do resumo
     */
    createSummaryHTML: function (result) {
        const relatorio = result.relatorio || {};
        return `
            <div class="summary-section">
                <h4>Resumo da Análise</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">Área Total:</span>
                        <span class="value">${relatorio.area_total_poligono_ha_formatado || 'N/D'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Classes Encontradas:</span>
                        <span class="value">${relatorio.numero_classes_encontradas || 0}</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Criar HTML da tabela de classes
     */
    createClassesTableHTML: function (result) {
        const classes = result.relatorio?.classes || {};
        const classesArray = Object.entries(classes).map(([key, value]) => ({
            key,
            ...value
        }));

        classesArray.sort((a, b) => b.area_ha - a.area_ha);

        let tableHTML = `
            <div class="classes-section">
                <h4>Classes de Textura do Solo</h4>
                <table class="classes-table">
                    <thead>
                        <tr>
                            <th>Classe</th>
                            <th>Área (ha)</th>
                            <th>Percentual</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        classesArray.forEach(cls => {
            const classeNum = parseInt(cls.key.replace('Classe ', ''));
            const cor = this.CORES_SOLO_TEXTURAL[classeNum] || '#CCCCCC';

            tableHTML += `
                <tr>
                    <td>
                        <span class="color-indicator" style="background-color: ${cor}"></span>
                        ${cls.descricao}
                    </td>
                    <td>${cls.area_ha_formatado}</td>
                    <td>${cls.percentual_formatado}</td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        return tableHTML;
    },

    /**
     * Criar HTML da imagem
     */
    createImageHTML: function (result) {
        if (!result.imagem_recortada || !result.imagem_recortada.base64) {
            return '';
        }

        return `
            <div class="image-section">
                <h4>Mapa de Textura do Solo</h4>
                <img src="data:image/png;base64,${result.imagem_recortada.base64}"
                     alt="Mapa de Textura do Solo"
                     class="result-image">
            </div>
        `;
    },

    /**
     * Criar HTML dos metadados
     */
    createMetadataHTML: function (result) {
        const meta = result.metadados || {};
        return `
            <div class="metadata-section">
                <h4>Metadados</h4>
                <div class="metadata-grid">
                    <div class="meta-item">
                        <span class="label">Centroide:</span>
                        <span class="value">${meta.centroide_display || 'N/D'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Município:</span>
                        <span class="value">${meta.municipio || 'N/D'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">UF:</span>
                        <span class="value">${meta.uf || 'N/D'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">CRS:</span>
                        <span class="value">${meta.crs || 'N/D'}</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Remover resultado específico
     */
    removeResult: function (index) {
        if (this.state.analysisResults && this.state.analysisResults.length > index) {
            this.state.analysisResults.splice(index, 1);

            if (this.state.analysisResults.length > 0) {
                this.displayResults(this.state.analysisResults);
            } else {
                this.clearAnalysis();
            }
        }
    },

    /**
     * Limpar análise
     */
    clearAnalysis: function () {
        this.hideSoloTexturalImageOnMap();
        this.state.analysisResults = null;

        const container = document.getElementById('soloTexturalResults');
        if (container) {
            container.innerHTML = '';
        }

        const section = document.getElementById('soloTexturalSection');
        if (section) {
            section.style.display = 'none';
        }

        APP.showStatus('Análise de textura do solo limpa', 'info');
    },

    /**
     * Atualizar estado da UI
     */
    updateUIState: function (isAnalyzing) {
        const btnAnalyze = document.getElementById('btnAnalyzeSoloTextural');
        if (btnAnalyze) {
            btnAnalyze.disabled = isAnalyzing;
            btnAnalyze.textContent = isAnalyzing ? 'Analisando...' : 'Analisar Textura do Solo';
        }
    },

    /**
     * Mostrar imagem de textura do solo no mapa com opacidade atual
     */
    showSoloTexturalImageOnMap: function () {
        console.log('🟢 showSoloTexturalImageOnMap chamado');

        if (!this.state.analysisResults || this.state.analysisResults.length === 0) {
            console.warn('⚠️ Nenhum resultado de análise disponível');
            return;
        }

        this.hideSoloTexturalImageOnMap();

        const opacitySlider = document.getElementById('opacitySlider');
        const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.7;

        if (!MAP.state.leafletMap) {
            console.error('❌ MAP.state.leafletMap não disponível');
            return;
        }

        for (let i = 0; i < this.state.analysisResults.length; i++) {
            const result = this.state.analysisResults[i];
            if (!result) continue;

            let imagemRecortada = null;

            if (result.relatorio && result.relatorio.imagem_recortada) {
                imagemRecortada = result.relatorio.imagem_recortada;
            } else if (result.imagem_recortada) {
                imagemRecortada = result.imagem_recortada;
            }

            if (!imagemRecortada) {
                console.warn(`⚠️ imagem_recortada não encontrada para resultado ${i}`);
                continue;
            }

            let imageUrl;

            if (typeof imagemRecortada === 'string') {
                imageUrl = imagemRecortada.startsWith('data:') ? imagemRecortada : 'data:image/png;base64,' + imagemRecortada;
            } else if (imagemRecortada && imagemRecortada.base64) {
                imageUrl = 'data:image/png;base64,' + imagemRecortada.base64;
            } else {
                console.warn(`⚠️ Formato de imagem_recortada inválido para resultado ${i}`);
                continue;
            }

            let bounds = MAP.getPolygonBounds(i);

            if (!bounds && APP.state.drawnPolygon) {
                try { bounds = APP.state.drawnPolygon.getBounds(); } catch (e) { }
            }

            if (bounds) {
                const layer = L.imageOverlay(
                    imageUrl,
                    bounds,
                    { opacity: opacity }
                ).addTo(MAP.state.leafletMap);
                this.state.rasterLayers[i] = layer;
                console.log(`✅ Camada de textura do solo ${i} adicionada ao mapa`);
            } else {
                console.warn(`⚠️ Bounds não encontrados para o polígono de índice: ${i}`);
            }
        }
    },

    /**
     * Esconder imagem de textura do solo no mapa
     */
    hideSoloTexturalImageOnMap: function () {
        if (MAP.state.leafletMap) {
            this.state.rasterLayers.forEach(layer => {
                if (layer && MAP.state.leafletMap.hasLayer(layer)) {
                    MAP.state.leafletMap.removeLayer(layer);
                }
            });
        }
        this.state.rasterLayers = [];
    }
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SoloTextural.init());
} else {
    SoloTextural.init();
}
