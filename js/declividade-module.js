// Módulo de Análise de Declividade
const DecliviDADE = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        rasterLayers: []
    },

    // Cores das classes de declividade
    CORES_DECLIVIDADE: {
        0: "#CCCCCC",
        1: "#2E7D32",  // Verde escuro       - Plano
        2: "#66BB6A",  // Verde claro         - Suave Ondulado
        3: "#C8E6C9",  // Verde muito claro   - Moderadamente Ondulado
        4: "#FDD835",  // Amarelo             - Ondulado
        5: "#FB8C00",  // Laranja             - Forte Ondulado
        6: "#E53935",  // Vermelho            - Montanhoso
        7: "#8E24AA",  // Roxo               - Escarpado
        8: "#4A148C",  // Roxo escuro         - APP Legal
    },

    // Nomes das classes de declividade
    NOMES_DECLIVIDADE: {
        0: "Sem classe (NoData/fora do raster)",
        1: "0-3% (Plano)",
        2: "3-8% (Suave Ondulado)",
        3: "8-13% (Moderadamente Ondulado)",
        4: "13-20% (Ondulado)",
        5: "20-45% (Forte Ondulado)",
        6: "45-75% (Montanhoso)",
        7: "75-<100% (Escarpado)",
        8: "≥100% (APP Legal)",
    },

    /**
     * Inicialização do módulo
     */
    init: function () {
        this.setupEventListeners();
        console.log('Módulo de Declividade inicializado');
    },

    /**
     * Configurar event listeners
     */
    setupEventListeners: function () {
        const btnAnalyze = document.getElementById('btnAnalyzeDeclividade');
        if (btnAnalyze) {
            btnAnalyze.addEventListener('click', () => this.analyzeDeclividade());
        }

        const btnClearDeclividade = document.getElementById('btnClearDeclividade');
        if (btnClearDeclividade) {
            btnClearDeclividade.addEventListener('click', () => this.clearAnalysis());
        }
    },

    /**
     * Executar análise de declividade
     */
    analyzeDeclividade: async function () {
        if (this.state.isAnalyzing) {
            APP.showStatus('Análise de declividade já em andamento...', 'warn');
            return;
        }

        // Verificar se há arquivos carregados ou polígono desenhado
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

            // Mudar a prioridade: se há polígono desenhado, analisar ele primeiro
            if (hasDrawnPolygon) {
                APP.showProgress('Declividade: polígono desenhado', 1, 1);
                const result = await this.analyzeDrawnPolygon();
                if (result) {
                    results.push(result);
                }
            }
            // Se não há polígono desenhado, mas há arquivos carregados, analisar arquivos
            else if (hasFiles) {
                
                let filesToAnalyze = APP.state.currentFiles;
                const indexOffset = (APP.state.selectedPolygonIndex >= 0 && APP.state.selectedPolygonIndex < APP.state.currentFiles.length)
                    ? APP.state.selectedPolygonIndex : 0;
                if (APP.state.selectedPolygonIndex >= 0 && APP.state.selectedPolygonIndex < APP.state.currentFiles.length) {
                    filesToAnalyze = [APP.state.currentFiles[APP.state.selectedPolygonIndex]];
                }

                for (let i = 0; i < filesToAnalyze.length; i++) {
                    const file = filesToAnalyze[i];
                    const originalIndex = indexOffset + i;
                    APP.showProgress(`Declividade: ${file.name}`, i + 1, filesToAnalyze.length);

                    const result = await this.analyzeFile(file, originalIndex);
                    if (result) {
                        results.push(result);
                    }
                }
            }

            APP.hideProgress();

            if (results.length > 0) {
                if (APP.state.selectedPolygonIndex === -1 && !hasDrawnPolygon) {
                    this.state.analysisResults = results;
                } else {
                    this.state.analysisResults = this.state.analysisResults || [];
                    results.forEach(newRes => {
                        const existingIdx = this.state.analysisResults.findIndex(r => r.fileIndex === newRes.fileIndex);
                        if (existingIdx >= 0) {
                            this.state.analysisResults[existingIdx] = newRes;
                        } else {
                            this.state.analysisResults.push(newRes);
                        }
                    });
                    this.state.analysisResults.sort((a,b) => a.fileIndex - b.fileIndex);
                }
                this.displayResults(this.state.analysisResults);
                APP.showStatus(`Análise de declividade concluída para ${results.length} polígono(s)!`, 'success');
            } else {
                APP.showStatus('Nenhum resultado de declividade obtido.', 'error');
            }

        } catch (error) {
            console.error('Erro na análise de declividade:', error);
            APP.showStatus(`Erro na análise de declividade: ${error.message}`, 'error');
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
            const response = await fetch('/analisar-declividade', {
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
            // Converter layer para GeoJSON
            const geojson = APP.state.drawnPolygon.toGeoJSON();
            const geojsonStr = JSON.stringify(geojson);
            const blob = new Blob([geojsonStr], { type: 'application/json' });
            const file = new File([blob], 'poligono_desenhado.geojson', { type: 'application/json' });

            const formData = new FormData();
            formData.append('kml', file);

            const response = await fetch('/analisar-declividade', {
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
        if (!APP.state.analysisOrder.includes('declividade')) APP.state.analysisOrder.push('declividade');

        // Mostrar o painel flutuante no mesmo estilo que uso do solo
        const panel = document.getElementById('floatingPanel');
        if (panel) {
            panel.style.display = 'block';
            if (!panel.classList.contains('maximized')) {
                panel.classList.add('compact');
            }
        }

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);

        // Se já existe análise de Solo, apenas atualizar as abas
        if (APP.state.analysisResults && APP.state.analysisResults.length > 0) {
            APP.setupVisualizationToggle(polygonIndex);
        } else {
            // Sem Solo: inicializar o painel com dados da declividade
            APP.showPolygonResult(polygonIndex, { skipZoom: true });
        }

        // Se for a única aba de análise habilitada, força o clique nela
        setTimeout(() => {
            const hasSolo = APP.state.analysisResults && APP.state.analysisResults.length > 0;

            if (!hasSolo) {
                const btnDecliv = document.getElementById('btnViewDeclividade');
                if (btnDecliv) btnDecliv.click();
            }
        }, 100);

        // Mostrar controle de opacidade
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
        card.className = 'result-card declividade-card';
        card.innerHTML = `
            <div class="result-header">
                <h3>📊 ${result.fileName || `Polígono ${index + 1}`}</h3>
                <button class="btn-close" onclick="DecliviDADE.removeResult(${index})">&times;</button>
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

        // Ordenar por área decrescente
        classesArray.sort((a, b) => b.area_ha - a.area_ha);

        let tableHTML = `
            <div class="classes-section">
                <h4>Classes de Declividade</h4>
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
            const cor = this.CORES_DECLIVIDADE[classeNum] || '#CCCCCC';

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
                <h4>Mapa de Declividade</h4>
                <img src="data:image/png;base64,${result.imagem_recortada.base64}" 
                     alt="Mapa de Declividade" 
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
        this.hideDecliviDADEImageOnMap();
        this.state.analysisResults = null;

        const container = document.getElementById('decliviDADEResults');
        if (container) {
            container.innerHTML = '';
        }

        const section = document.getElementById('decliviDADESection');
        if (section) {
            section.style.display = 'none';
        }

        APP.showStatus('Análise de declividade limpa', 'info');
    },

    /**
     * Atualizar estado da UI
     */
    updateUIState: function (isAnalyzing) {
        const btnAnalyze = document.getElementById('btnAnalyzeDeclividade');
        if (btnAnalyze) {
            btnAnalyze.disabled = isAnalyzing;
            btnAnalyze.textContent = isAnalyzing ? 'Analisando...' : 'Analisar Declividade';
        }
    },

    /**
     * Mostrar imagem de declividade no mapa com opacidade atual
     * Exibe todos os recortes para todos os polígonos simultaneamente
     */
    showDecliviDADEImageOnMap: function () {
        console.log('🟢 showDecliviDADEImageOnMap chamado');

        if (!this.state.analysisResults || this.state.analysisResults.length === 0) {
            console.warn('⚠️ Nenhum resultado de análise disponível');
            return;
        }

        // Remover layers anteriores se existirem
        this.hideDecliviDADEImageOnMap();

        // Obter opacidade atual do controle
        const opacitySlider = document.getElementById('opacitySlider');
        const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.7;

        if (!MAP.state.leafletMap) {
            console.error('❌ MAP.state.leafletMap não disponível');
            return;
        }

        // Iterar todos os resultados e criar um overlay para cada
        for (let i = 0; i < this.state.analysisResults.length; i++) {
            const result = this.state.analysisResults[i];
            if (!result) continue;

            const polyIdx = (result.fileIndex !== undefined) ? result.fileIndex : i;

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

            // Extrair a string base64 da imagem
            let imageUrl;

            if (typeof imagemRecortada === 'string') {
                imageUrl = imagemRecortada.startsWith('data:') ? imagemRecortada : 'data:image/png;base64,' + imagemRecortada;
            } else if (imagemRecortada && imagemRecortada.base64) {
                imageUrl = 'data:image/png;base64,' + imagemRecortada.base64;
            } else {
                console.warn(`⚠️ Formato de imagem_recortada inválido para resultado ${i}`);
                continue;
            }

            // Obter bounds do polígono correspondente
            let bounds = MAP.getPolygonBounds(polyIdx);

            // Fallback: polígono desenhado não está em MAP.state.polygonLayers
            if (!bounds && APP.state.drawnPolygon) {
                try { bounds = APP.state.drawnPolygon.getBounds(); } catch (e) { }
            }

            if (bounds) {
                const layer = L.imageOverlay(
                    imageUrl,
                    bounds,
                    { opacity: opacity }
                ).addTo(MAP.state.leafletMap);
                this.state.rasterLayers[polyIdx] = layer;
                console.log(`✅ Camada de declividade ${i} adicionada ao mapa`);
            } else {
                console.warn(`⚠️ Bounds não encontrados para o polígono de índice: ${i}`);
            }
        }
    },

    /**
     * Esconder imagem de declividade no mapa
     */
    hideDecliviDADEImageOnMap: function () {
        if (MAP.state.leafletMap) {
            Object.values(this.state.rasterLayers).forEach(layer => {
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
    document.addEventListener('DOMContentLoaded', () => DecliviDADE.init());
} else {
    DecliviDADE.init();
}
