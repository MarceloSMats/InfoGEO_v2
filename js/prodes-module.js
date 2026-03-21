// Modulo de Analise PRODES / EUDR (Desmatamento e Conformidade)
const Prodes = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        rasterLayers: []
    },

    // Cores de risco EUDR (para badges e charts)
    RISK_COLORS: {
        SAFE:          '#308703',
        CONSOLIDATED:  '#66BB6A',
        EUDR_MARKER:   '#FF9800',
        HIGH_RISK:     '#de0004',
        ATTENTION:     '#FFC107',
    },

    RISK_LABELS: {
        SAFE:          'Seguro \u2014 Vegeta\u00e7\u00e3o nativa intacta',
        CONSOLIDATED:  'Consolidado \u2014 Desmatamento anterior a 2020',
        EUDR_MARKER:   'Marco EUDR \u2014 Desmatamento no ano de corte (2020)',
        HIGH_RISK:     'ALTO RISCO \u2014 Desmatamento p\u00f3s-2020 (n\u00e3o conforme EUDR)',
        ATTENTION:     'Aten\u00e7\u00e3o \u2014 Res\u00edduo/Regenera\u00e7\u00e3o (requer an\u00e1lise adicional)',
    },

    // Cores PRODES por pixel (do QML)
    CORES_PRODES: {
        0: '#ffff00', 2: '#ffc300', 4: '#ffc300', 6: '#ffc30f',
        7: '#ffff00', 8: '#ffc31e', 9: '#ffc30f', 10: '#ffc82d',
        11: '#ffc83c', 12: '#ffc84b', 13: '#ffc84b', 14: '#ffcd5a',
        15: '#ffcd78', 16: '#ffcd69', 17: '#ffcd78', 18: '#ffd287',
        19: '#ffd296', 20: '#ffd2a5', 21: '#ffd700', 22: '#ffd70f',
        23: '#ffdc1e', 24: '#ffdc2d',
        50: '#ff9600', 51: '#ff960f', 52: '#ff871e', 53: '#f0872d',
        54: '#f0783c', 55: '#f0783c', 56: '#f0784b', 57: '#e16900',
        58: '#ff9600', 59: '#ff5a1e', 60: '#ff960f', 61: '#ff871e',
        62: '#f0872d', 63: '#f0783c', 64: '#f0784b',
        91: '#0513b1', 100: '#308703',
    },

    init: function () {
        this.setupEventListeners();
        console.log('Modulo PRODES/EUDR inicializado');
    },

    setupEventListeners: function () {
        const btnAnalyze = document.getElementById('btnAnalyzeProdes');
        if (btnAnalyze) {
            btnAnalyze.addEventListener('click', () => this.analyzeProdes());
        }

        const btnClear = document.getElementById('btnClearProdes');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearAnalysis());
        }
    },

    analyzeProdes: async function () {
        if (this.state.isAnalyzing) {
            APP.showStatus('An\u00e1lise PRODES j\u00e1 em andamento...', 'warn');
            return;
        }

        const hasFiles = APP.state.currentFiles && APP.state.currentFiles.length > 0;
        const hasDrawnPolygon = APP.state.drawnPolygon !== null;

        if (!hasFiles && !hasDrawnPolygon) {
            APP.showStatus('Nenhum arquivo carregado ou pol\u00edgono desenhado.', 'error');
            return;
        }

        this.state.isAnalyzing = true;
        this.updateUIState(true);

        try {
            let results = [];

            if (hasDrawnPolygon) {
                APP.showProgress('PRODES/EUDR: pol\u00edgono desenhado', 1, 1);
                const result = await this.analyzeDrawnPolygon();
                if (result) results.push(result);
            } else if (hasFiles) {
                
                let filesToAnalyze = APP.state.currentFiles;
                const indexOffset = (APP.state.selectedPolygonIndex >= 0 && APP.state.selectedPolygonIndex < APP.state.currentFiles.length)
                    ? APP.state.selectedPolygonIndex : 0;
                if (APP.state.selectedPolygonIndex >= 0 && APP.state.selectedPolygonIndex < APP.state.currentFiles.length) {
                    filesToAnalyze = [APP.state.currentFiles[APP.state.selectedPolygonIndex]];
                }

                for (let i = 0; i < filesToAnalyze.length; i++) {
                    const file = filesToAnalyze[i];
                    const originalIndex = indexOffset + i;
                    APP.showProgress(`PRODES/EUDR: ${file.name}`, i + 1, filesToAnalyze.length);
                    const result = await this.analyzeFile(file, originalIndex);
                    if (result) results.push(result);
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
                APP.showStatus(`An\u00e1lise PRODES/EUDR conclu\u00edda para ${results.length} pol\u00edgono(s)!`, 'success');
            } else {
                APP.showStatus('Nenhum resultado PRODES/EUDR obtido.', 'error');
            }

        } catch (error) {
            console.error('Erro na an\u00e1lise PRODES/EUDR:', error);
            APP.showStatus(`Erro na an\u00e1lise PRODES/EUDR: ${error.message}`, 'error');
        } finally {
            this.state.isAnalyzing = false;
            this.updateUIState(false);
        }
    },

    analyzeFile: async function (file, index) {
        const formData = new FormData();
        const fileToAnalyze = file.originalFile || file;
        formData.append('kml', fileToAnalyze);

        try {
            const response = await fetch('/analisar-prodes', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.status === 'sucesso') {
                return { ...data, fileName: file.name, fileIndex: index };
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

    analyzeDrawnPolygon: async function () {
        if (!APP.state.drawnPolygon) return null;

        try {
            const geojson = APP.state.drawnPolygon.toGeoJSON();
            const geojsonStr = JSON.stringify(geojson);
            const blob = new Blob([geojsonStr], { type: 'application/json' });
            const file = new File([blob], 'poligono_desenhado.geojson', { type: 'application/json' });

            const formData = new FormData();
            formData.append('kml', file);

            const response = await fetch('/analisar-prodes', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.status === 'sucesso') {
                return { ...data, fileName: 'Pol\u00edgono Desenhado', fileIndex: -1 };
            } else {
                APP.showStatus(`Erro no pol\u00edgono desenhado: ${data.mensagem}`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Erro ao analisar pol\u00edgono desenhado:', error);
            APP.showStatus('Erro ao processar pol\u00edgono desenhado', 'error');
            return null;
        }
    },

    displayResults: function (results) {
        if (typeof APP === 'undefined') return;
        if (!APP.state.analysisOrder.includes('prodes')) APP.state.analysisOrder.push('prodes');

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

        setTimeout(() => {
            const btnProdes = document.getElementById('tabProdes');
            if (btnProdes) btnProdes.click();
        }, 150);

        const opacityControl = document.getElementById('opacityControl');
        if (opacityControl) {
            opacityControl.style.display = 'flex';
        }
    },

    createResultCard: function (result, index) {
        const card = document.createElement('div');
        card.className = 'result-card prodes-card';
        card.innerHTML = `
            <div class="result-header">
                <h3>\uD83C\uDF33 ${result.fileName || `Pol\u00edgono ${index + 1}`}</h3>
                <button class="btn-close" onclick="Prodes.removeResult(${index})">&times;</button>
            </div>
            <div class="result-body">
                ${this.createEUDRBadgeHTML(result)}
                ${this.createSummaryHTML(result)}
                ${this.createRiskBreakdownHTML(result)}
                ${this.createClassesTableHTML(result)}
                ${this.createImageHTML(result)}
                ${this.createMetadataHTML(result)}
            </div>
        `;
        return card;
    },

    createEUDRBadgeHTML: function (result) {
        const eudr = result.eudr || {};
        const compliant = eudr.eudr_compliant;
        const color = compliant ? '#308703' : '#de0004';
        const bgColor = compliant ? 'rgba(48, 135, 3, 0.15)' : 'rgba(222, 0, 4, 0.15)';
        const text = compliant ? 'CONFORME EUDR' : 'N\u00c3O CONFORME EUDR';
        const icon = compliant ? '\u2705' : '\u26A0\uFE0F';
        const riskLabel = eudr.overall_risk_label || '';

        return `
            <div style="background: ${bgColor}; border: 2px solid ${color}; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; text-align: center;">
                <div style="font-size: 1.4em; font-weight: bold; color: ${color};">${icon} ${text}</div>
                <div style="font-size: 0.85em; color: var(--text-muted, #8899aa); margin-top: 4px;">${riskLabel}</div>
            </div>
        `;
    },

    createSummaryHTML: function (result) {
        const relatorio = result.relatorio || {};
        return `
            <div class="summary-section">
                <h4>Resumo da An\u00e1lise PRODES</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">\u00c1rea Total:</span>
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

    createRiskBreakdownHTML: function (result) {
        const eudr = result.eudr || {};
        const breakdown = eudr.risk_breakdown || {};
        const entries = Object.entries(breakdown);

        if (entries.length === 0) return '';

        let html = `
            <div class="classes-section">
                <h4>Classifica\u00e7\u00e3o de Risco EUDR</h4>
                <table class="classes-table">
                    <thead>
                        <tr>
                            <th>N\u00edvel</th>
                            <th>\u00c1rea (ha)</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Ordem de prioridade de exibicao
        const order = ['HIGH_RISK', 'EUDR_MARKER', 'ATTENTION', 'CONSOLIDATED', 'SAFE'];
        for (const level of order) {
            const data = breakdown[level];
            if (!data) continue;
            const color = this.RISK_COLORS[level] || '#CCCCCC';
            html += `
                <tr>
                    <td>
                        <span class="color-indicator" style="background-color: ${color}"></span>
                        ${data.label}
                    </td>
                    <td>${data.area_ha_formatado}</td>
                    <td>${data.percentual_formatado}</td>
                </tr>
            `;
        }

        html += `</tbody></table></div>`;
        return html;
    },

    createClassesTableHTML: function (result) {
        const classes = result.relatorio?.classes || {};
        const classesArray = Object.entries(classes).map(([key, value]) => ({
            key, ...value
        }));

        classesArray.sort((a, b) => b.area_ha - a.area_ha);

        if (classesArray.length === 0) return '';

        let html = `
            <div class="classes-section">
                <h4>Detalhamento por Classe PRODES</h4>
                <table class="classes-table">
                    <thead>
                        <tr>
                            <th>Classe</th>
                            <th>\u00c1rea (ha)</th>
                            <th>%</th>
                            <th>Risco</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        classesArray.forEach(cls => {
            const classeNum = parseInt(cls.key.replace('Classe ', ''));
            const cor = this.CORES_PRODES[classeNum] || '#CCCCCC';
            const risco = cls.risco_eudr || 'CONSOLIDATED';
            const riscoCor = this.RISK_COLORS[risco] || '#CCCCCC';

            html += `
                <tr>
                    <td>
                        <span class="color-indicator" style="background-color: ${cor}"></span>
                        ${cls.descricao}
                    </td>
                    <td>${cls.area_ha_formatado}</td>
                    <td>${cls.percentual_formatado}</td>
                    <td><span style="color: ${riscoCor}; font-weight: 600;">${risco}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        return html;
    },

    createImageHTML: function (result) {
        if (!result.imagem_recortada || !result.imagem_recortada.base64) {
            return '';
        }

        return `
            <div class="image-section">
                <h4>Mapa PRODES</h4>
                <img src="data:image/png;base64,${result.imagem_recortada.base64}"
                     alt="Mapa PRODES"
                     class="result-image">
            </div>
        `;
    },

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
                        <span class="label">Munic\u00edpio:</span>
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

    clearAnalysis: function () {
        this.hideProdesImageOnMap();
        this.state.analysisResults = null;
        APP.showStatus('An\u00e1lise PRODES/EUDR limpa', 'info');
    },

    updateUIState: function (isAnalyzing) {
        const btnAnalyze = document.getElementById('btnAnalyzeProdes');
        if (btnAnalyze) {
            btnAnalyze.disabled = isAnalyzing;
            btnAnalyze.textContent = isAnalyzing ? 'Analisando...' : 'Analisar PRODES/EUDR';
        }
    },

    showProdesImageOnMap: function () {
        if (!this.state.analysisResults || this.state.analysisResults.length === 0) return;

        this.hideProdesImageOnMap();

        const opacitySlider = document.getElementById('opacitySlider');
        const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.7;

        if (!MAP.state.leafletMap) return;

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

            if (!imagemRecortada) continue;

            let imageUrl;
            if (typeof imagemRecortada === 'string') {
                imageUrl = imagemRecortada.startsWith('data:') ? imagemRecortada : 'data:image/png;base64,' + imagemRecortada;
            } else if (imagemRecortada.base64) {
                imageUrl = 'data:image/png;base64,' + imagemRecortada.base64;
            } else {
                continue;
            }

            let bounds = MAP.getPolygonBounds(polyIdx);
            if (!bounds && APP.state.drawnPolygon) {
                try { bounds = APP.state.drawnPolygon.getBounds(); } catch (e) { }
            }

            if (bounds) {
                const layer = L.imageOverlay(imageUrl, bounds, { opacity: opacity })
                    .addTo(MAP.state.leafletMap);
                this.state.rasterLayers[polyIdx] = layer;
            }
        }
    },

    hideProdesImageOnMap: function () {
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
    document.addEventListener('DOMContentLoaded', () => Prodes.init());
} else {
    Prodes.init();
}
