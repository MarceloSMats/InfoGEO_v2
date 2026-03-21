// Módulo de Verificação de Embargo IBAMA
const Embargo = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        embargoLayers: [],
    },

    COR_COM_EMBARGO: '#de0004',
    COR_SEM_EMBARGO: '#028b00',

    init: function () {
        this.setupEventListeners();
        console.log('Módulo de Embargo IBAMA inicializado');
    },

    setupEventListeners: function () {
        const btn = document.getElementById('btnAnalyzeEmbargo');
        if (btn) {
            btn.addEventListener('click', () => this.analyzeEmbargo());
        }
        const btnClear = document.getElementById('btnClearEmbargo');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearAnalysis());
        }
    },

    analyzeEmbargo: async function () {
        if (this.state.isAnalyzing) {
            APP.showStatus('Verificação de embargo já em andamento...', 'warn');
            return;
        }

        const hasFiles = APP.state.currentFiles && APP.state.currentFiles.length > 0;
        const hasDrawnPolygon = APP.state.drawnPolygon !== null;

        if (!hasFiles && !hasDrawnPolygon) {
            APP.showStatus('Nenhum arquivo carregado ou polígono desenhado.', 'error');
            return;
        }

        this.state.isAnalyzing = true;
        this.updateUIState(true);

        try {
            let results = [];

            if (hasDrawnPolygon) {
                APP.showProgress('Embargo: polígono desenhado', 1, 1);
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
                    APP.showProgress(`Embargo: ${file.name}`, i + 1, filesToAnalyze.length);
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
                const total = results.reduce((s, r) => s + (r.relatorio?.numero_embargoes || 0), 0);
                const msg = total > 0
                    ? `Atenção: ${total} embargo(s) IBAMA identificado(s) na área.`
                    : 'Nenhum embargo IBAMA identificado na área analisada.';
                APP.showStatus(msg, total > 0 ? 'warn' : 'success');
            } else {
                APP.showStatus('Nenhum resultado de embargo obtido.', 'error');
            }

            // Executar análise ICMBio com os mesmos arquivos/polígono
            if (typeof ICMBIO !== 'undefined') {
                await ICMBIO.analyzeICMBIO();
            }
        } finally {
            this.state.isAnalyzing = false;
            this.updateUIState(false);
        }
    },

    analyzeFile: async function (file, index) {
        try {
            const formData = new FormData();
            formData.append('kml', file.originalFile || file);

            const response = await fetch('/analisar-embargo', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.status === 'sucesso') {
                return { ...data, fileName: file.name, fileIndex: index };
            }
            APP.showStatus(`Erro embargo (${file.name}): ${data.mensagem}`, 'error');
            return null;
        } catch (err) {
            APP.showStatus(`Erro ao verificar embargo: ${err.message}`, 'error');
            return null;
        }
    },

    analyzeDrawnPolygon: async function () {
        try {
            const geojson = APP.state.drawnPolygon.toGeoJSON();
            const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
            const file = new File([blob], 'poligono_desenhado.geojson');
            const formData = new FormData();
            formData.append('kml', file);

            const response = await fetch('/analisar-embargo', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.status === 'sucesso') {
                return { ...data, fileName: 'Polígono Desenhado', fileIndex: -1 };
            }
            APP.showStatus(`Erro embargo: ${data.mensagem}`, 'error');
            return null;
        } catch (err) {
            APP.showStatus(`Erro ao verificar embargo: ${err.message}`, 'error');
            return null;
        }
    },

    displayResults: function (results) {
        if (typeof APP === 'undefined') return;
        if (!APP.state.analysisOrder.includes('embargo')) APP.state.analysisOrder.push('embargo');

        const panel = document.getElementById('floatingPanel');
        if (panel) {
            panel.style.display = 'block';
            if (!panel.classList.contains('maximized')) panel.classList.add('compact');
        }

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);

        if (APP.state.analysisResults && APP.state.analysisResults.length > 0) {
            APP.setupVisualizationToggle(polygonIndex);
        } else {
            APP.showPolygonResult(polygonIndex, { skipZoom: true });
        }

        setTimeout(() => {
            const tabEmbargo = document.getElementById('tabEmbargo');
            if (tabEmbargo) tabEmbargo.click();
        }, 150);
    },

    createResultCard: function (result, index) {
        const card = document.createElement('div');
        card.className = 'result-card embargo-card';
        card.innerHTML = `
            <div class="result-header">
                <h3>🔴 ${result.fileName || `Polígono ${index + 1}`}</h3>
                <button class="btn-close" onclick="Embargo.removeResult(${index})">&times;</button>
            </div>
            <div class="result-body">
                ${this.createSummaryHTML(result)}
                ${this.createEmbargoesTableHTML(result)}
                ${this.createMetadataHTML(result)}
            </div>
        `;
        return card;
    },

    createSummaryHTML: function (result) {
        const rel = result.relatorio || {};
        const possui = rel.possui_embargo;
        const badgeColor = possui ? '#de0004' : '#028b00';
        const badgeText = possui ? '⚠️ EMBARGO IDENTIFICADO' : '✅ SEM EMBARGO';

        return `
            <div class="summary-section">
                <div style="text-align:center; margin-bottom:10px;">
                    <span style="background:${badgeColor}; color:#fff; padding:4px 14px; border-radius:12px; font-weight:bold; font-size:0.9em;">
                        ${badgeText}
                    </span>
                </div>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">Área Total:</span>
                        <span class="value">${rel.area_total_poligono_ha_formatado || 'N/D'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Área Embargada:</span>
                        <span class="value" style="color:${badgeColor}; font-weight:bold;">
                            ${rel.area_embargada_ha_formatado || '0,0000 ha'} (${rel.area_embargada_percentual_formatado || '0,00%'})
                        </span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Nº de Embargos:</span>
                        <span class="value">${rel.numero_embargoes || 0}</span>
                    </div>
                </div>
            </div>
        `;
    },

    createEmbargoesTableHTML: function (result) {
        const embargoes = result.embargoes || [];
        if (embargoes.length === 0) {
            return `<div class="classes-section"><p style="color:var(--text-muted,#8899aa); font-size:0.9em; text-align:center;">Nenhum embargo sobreposto.</p></div>`;
        }

        let rows = '';
        embargoes.forEach((emb, i) => {
            rows += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${emb.num_tad || '—'}</td>
                    <td>${emb.dat_embarg || '—'}</td>
                    <td style="font-size:0.82em;">${emb.des_infrac || '—'}</td>
                    <td style="font-size:0.82em;">${emb.des_tad || '—'}</td>
                    <td>${emb.area_sobreposta_ha_formatado || '—'}</td>
                    <td>${emb.percentual_sobreposicao_formatado || '—'}</td>
                </tr>
            `;
        });

        return `
            <div class="classes-section">
                <h4>Embargos Sobrepostos</h4>
                <div style="overflow-x:auto;">
                    <table class="classes-table" style="font-size:0.85em; min-width:600px;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nº TAD</th>
                                <th>Data</th>
                                <th>Infração</th>
                                <th>Desc. TAD</th>
                                <th>Área Sobr. (ha)</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
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
                        <span class="label">Município:</span>
                        <span class="value">${meta.municipio || 'N/D'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">UF:</span>
                        <span class="value">${meta.uf || 'N/D'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Data da Análise:</span>
                        <span class="value">${meta.data_analise || 'N/D'}</span>
                    </div>
                </div>
            </div>
        `;
    },

    showEmbargoOnMap: function () {
        this.hideEmbargoOnMap();
        if (!this.state.analysisResults) return;

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
        const result = this.state.analysisResults[polygonIndex] || this.state.analysisResults[0];
        if (!result) return;

        const leafletMap = (typeof MAP !== 'undefined') ? MAP.state.leafletMap : null;
        if (!leafletMap) return;

        try {
            // 1. Camada base verde: área livre da gleba
            let basePolygonLayer = null;
            if (result.fileIndex === -1 && APP.state.drawnPolygon) {
                basePolygonLayer = APP.state.drawnPolygon;
            } else if (MAP.state.polygonLayers) {
                const layerIdx = result.fileIndex >= 0 ? result.fileIndex : polygonIndex;
                basePolygonLayer = MAP.state.polygonLayers[layerIdx] || MAP.state.polygonLayers[0];
            }
            if (basePolygonLayer) {
                const greenLayer = L.polygon(basePolygonLayer.getLatLngs(), {
                    color: 'transparent',
                    weight: 0,
                    fillColor: '#028b00',
                    fillOpacity: 0.30,
                }).addTo(leafletMap);
                this.state.embargoLayers.push(greenLayer);
            }

            // 2. Camada vermelha: sobreposições de embargo IBAMA
            if (!result.embargo_geojson) return;
            const layer = L.geoJSON(result.embargo_geojson, {
                style: {
                    color: '#de0004',
                    weight: 2,
                    opacity: 0.9,
                    fillColor: '#de0004',
                    fillOpacity: 0.55,
                },
                onEachFeature: (feature, lyr) => {
                    const p = feature.properties || {};
                    lyr.bindPopup(`
                        <b>Embargo IBAMA</b><br>
                        Nº TAD: ${p.num_tad || '—'}<br>
                        Data: ${p.dat_embarg || '—'}<br>
                        Infração: ${p.des_infrac || '—'}<br>
                        Área sobreposta: ${p.area_ha || '—'}
                    `);
                },
            });
            layer.addTo(leafletMap);
            this.state.embargoLayers.push(layer);
        } catch (err) {
            console.warn('Erro ao exibir embargos no mapa:', err);
        }
    },

    hideEmbargoOnMap: function () {
        this.state.embargoLayers.forEach(layer => {
            if (typeof MAP !== 'undefined' && MAP.state.leafletMap) {
                try { MAP.state.leafletMap.removeLayer(layer); } catch (_) {}
            }
        });
        this.state.embargoLayers = [];
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
        this.hideEmbargoOnMap();
        this.state.analysisResults = null;
        this.state.isAnalyzing = false;

        const tabEmbargo = document.getElementById('tabEmbargo');
        if (tabEmbargo) tabEmbargo.style.display = 'none';

        const panelEmbargo = document.getElementById('chartPanelEmbargo');
        if (panelEmbargo) panelEmbargo.style.display = 'none';

        if (APP.state.areaChartEmbargo) {
            APP.state.areaChartEmbargo.destroy();
            APP.state.areaChartEmbargo = null;
        }
    },

    updateUIState: function (analyzing) {
        const btn = document.getElementById('btnAnalyzeEmbargo');
        if (btn) {
            btn.disabled = analyzing;
            btn.textContent = analyzing ? 'Verificando...' : 'Verificar Embargos';
        }
    },
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Embargo.init());
} else {
    Embargo.init();
}
