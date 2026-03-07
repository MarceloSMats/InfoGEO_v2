// Módulo de Verificação de Embargo ICMBio
const ICMBIO = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        icmbioLayers: [],
    },

    COR_COM_EMBARGO: '#0066cc',
    COR_SEM_EMBARGO: '#028b00',

    init: function () {
        // ICMBio não registra listener no botão — é acionado por Embargo.analyzeEmbargo()
        console.log('Módulo de Embargo ICMBio inicializado');
    },

    analyzeICMBIO: async function () {
        if (this.state.isAnalyzing) return;

        const hasFiles = APP.state.currentFiles && APP.state.currentFiles.length > 0;
        const hasDrawnPolygon = APP.state.drawnPolygon !== null;
        if (!hasFiles && !hasDrawnPolygon) return;

        this.state.isAnalyzing = true;

        try {
            let results = [];

            if (hasDrawnPolygon) {
                APP.showProgress('ICMBio: polígono desenhado', 1, 1);
                const result = await this.analyzeDrawnPolygon();
                if (result) results.push(result);
            } else if (hasFiles) {
                for (let i = 0; i < APP.state.currentFiles.length; i++) {
                    const file = APP.state.currentFiles[i];
                    APP.showProgress(`ICMBio: ${file.name}`, i + 1, APP.state.currentFiles.length);
                    const result = await this.analyzeFile(file, i);
                    if (result) results.push(result);
                }
            }

            APP.hideProgress();

            if (results.length > 0) {
                this.state.analysisResults = results;
                this.displayResults(results);
                const total = results.reduce((s, r) => s + (r.relatorio?.numero_embargoes || 0), 0);
                const msg = total > 0
                    ? `Atenção: ${total} embargo(s) ICMBio identificado(s) na área.`
                    : 'Nenhum embargo ICMBio identificado na área analisada.';
                APP.showStatus(msg, total > 0 ? 'warn' : 'success');
            }
        } finally {
            this.state.isAnalyzing = false;
        }
    },

    analyzeFile: async function (file, index) {
        try {
            const formData = new FormData();
            formData.append('kml', file.originalFile || file);

            const response = await fetch('/analisar-icmbio', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.status === 'sucesso') {
                return { ...data, fileName: file.name, fileIndex: index };
            }
            APP.showStatus(`Erro ICMBio (${file.name}): ${data.mensagem}`, 'error');
            return null;
        } catch (err) {
            APP.showStatus(`Erro ao verificar ICMBio: ${err.message}`, 'error');
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

            const response = await fetch('/analisar-icmbio', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.status === 'sucesso') {
                return { ...data, fileName: 'Polígono Desenhado', fileIndex: -1 };
            }
            APP.showStatus(`Erro ICMBio: ${data.mensagem}`, 'error');
            return null;
        } catch (err) {
            APP.showStatus(`Erro ao verificar ICMBio: ${err.message}`, 'error');
            return null;
        }
    },

    displayResults: function (results) {
        if (typeof APP === 'undefined') return;
        if (!APP.state.analysisOrder.includes('icmbio')) APP.state.analysisOrder.push('icmbio');

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
            const tabICMBio = document.getElementById('tabICMBio');
            if (tabICMBio) tabICMBio.click();
        }, 150);
    },

    createResultCard: function (result, index) {
        const card = document.createElement('div');
        card.className = 'result-card icmbio-card';
        card.innerHTML = `
            <div class="result-header">
                <h3>🔵 ${result.fileName || `Polígono ${index + 1}`}</h3>
                <button class="btn-close" onclick="ICMBIO.removeResult(${index})">&times;</button>
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
        const badgeColor = possui ? '#0066cc' : '#028b00';
        const badgeText = possui ? '⚠️ EMBARGO ICMBIO IDENTIFICADO' : '✅ SEM EMBARGO ICMBIO';

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
            return `<div class="classes-section"><p style="color:var(--text-muted,#8899aa); font-size:0.9em; text-align:center;">Nenhum embargo ICMBio sobreposto.</p></div>`;
        }

        let rows = '';
        embargoes.forEach((emb, i) => {
            rows += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${emb.numero_emb || '—'}</td>
                    <td>${emb.data_embargo || '—'}</td>
                    <td style="font-size:0.82em;">${emb.tipo_infra || '—'}</td>
                    <td style="font-size:0.82em;">${emb.desc_infra || '—'}</td>
                    <td>${emb.area_sobreposta_ha_formatado || '—'}</td>
                    <td>${emb.percentual_sobreposicao_formatado || '—'}</td>
                </tr>
            `;
        });

        return `
            <div class="classes-section">
                <h4>Embargos ICMBio Sobrepostos</h4>
                <div style="overflow-x:auto;">
                    <table class="classes-table" style="font-size:0.85em; min-width:600px;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nº Embargo</th>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Infração</th>
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

    showICMBioOnMap: function () {
        this.hideICMBioOnMap();
        if (!this.state.analysisResults) return;

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
        const result = this.state.analysisResults[polygonIndex] || this.state.analysisResults[0];
        if (!result || !result.embargo_geojson) return;

        try {
            const layer = L.geoJSON(result.embargo_geojson, {
                style: {
                    color: '#0066cc',
                    weight: 2,
                    opacity: 0.9,
                    fillColor: '#0066cc',
                    fillOpacity: 0.55,
                },
                onEachFeature: (feature, lyr) => {
                    const p = feature.properties || {};
                    lyr.bindPopup(`
                        <b>Embargo ICMBio</b><br>
                        Nº Embargo: ${p.numero_emb || '—'}<br>
                        Data: ${p.data_embargo || '—'}<br>
                        Tipo: ${p.tipo_infra || '—'}<br>
                        Infração: ${p.desc_infra || '—'}<br>
                        Área sobreposta: ${p.area_ha || '—'}
                    `);
                },
            });
            if (typeof MAP !== 'undefined' && MAP.state.leafletMap) {
                layer.addTo(MAP.state.leafletMap);
                this.state.icmbioLayers.push(layer);
            }
        } catch (err) {
            console.warn('Erro ao exibir ICMBio no mapa:', err);
        }
    },

    hideICMBioOnMap: function () {
        this.state.icmbioLayers.forEach(layer => {
            if (typeof MAP !== 'undefined' && MAP.state.leafletMap) {
                try { MAP.state.leafletMap.removeLayer(layer); } catch (_) {}
            }
        });
        this.state.icmbioLayers = [];
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
        this.hideICMBioOnMap();
        this.state.analysisResults = null;
        this.state.isAnalyzing = false;

        const tabICMBio = document.getElementById('tabICMBio');
        if (tabICMBio) tabICMBio.style.display = 'none';

        const panelICMBio = document.getElementById('chartPanelICMBio');
        if (panelICMBio) panelICMBio.style.display = 'none';

        if (APP.state.areaChartICMBio) {
            APP.state.areaChartICMBio.destroy();
            APP.state.areaChartICMBio = null;
        }
    },
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ICMBIO.init());
} else {
    ICMBIO.init();
}
