// Modulo de Analise Pedologica — Solos Embrapa SiBCS 1:5.000.000
const Solos = {
    state: {
        analysisResults: [],
        isAnalyzing: false,
        solosLayers: [],
    },

    // Cores por Ordem SiBCS (fallback quando cor da classe nao disponivel)
    ORDEM_CORES: {
        'Latossolos':             '#D4A76A',
        'Argissolos':             '#E8A87C',
        'Cambissolos':            '#C4B59B',
        'Gleissolos':             '#A8C8A0',
        'Espodossolos':           '#E8D5B0',
        'Plintossolos':           '#D4956A',
        'Vertissolos':            '#B8A89A',
        'Neossolos':              '#D4C4A0',
        'Luvissolos':             '#E8B87C',
        'Planossolos':            '#C8D4A0',
        'Chernossolos':           '#9A8070',
        'Nitossolos':             '#C47050',
        'Afloramentos de Rochas': '#BEBEBE',
        'Dunas':                  '#F5E6C0',
        'Agua':                   '#A8D4E8',
        'Outros':                 '#CCCCCC',
    },

    init: function () {
        this.setupEventListeners();
        console.log('Modulo Solos Embrapa SiBCS inicializado');
    },

    setupEventListeners: function () {
        const btnClear = document.getElementById('btnClearSolos');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearAnalysis());
        }
    },

    analyzeSolos: async function () {
        if (this.state.isAnalyzing) {
            APP.showStatus('Analise de solos ja em andamento...', 'warn');
            return;
        }

        const hasFiles = APP.state.currentFiles && APP.state.currentFiles.length > 0;
        const hasDrawnPolygon = APP.state.drawnPolygon !== null;

        if (!hasFiles && !hasDrawnPolygon) {
            APP.showStatus('Nenhum arquivo carregado ou poligono desenhado.', 'error');
            return;
        }

        this.state.isAnalyzing = true;
        this.state.analysisResults = [];

        try {
            let results = [];

            if (hasDrawnPolygon) {
                APP.showProgress('Solos: poligono desenhado', 1, 1);
                const result = await this.analyzeDrawnPolygon();
                if (result) results.push({ ...result, fileIndex: 0 });
            } else {
                for (let i = 0; i < APP.state.currentFiles.length; i++) {
                    const file = APP.state.currentFiles[i];
                    APP.showProgress(`Solos: ${file.name}`, i + 1, APP.state.currentFiles.length);
                    const result = await this.analyzeFile(file);
                    if (result) results.push({ ...result, fileIndex: i, fileName: file.name });
                }
            }

            this.state.analysisResults = results;

            if (results.length > 0) {
                this.displayResults(results);
            } else {
                APP.showStatus('Nenhum resultado de solos obtido.', 'warn');
            }
        } catch (err) {
            console.error('Erro na analise de solos:', err);
            APP.showStatus('Erro ao analisar solos.', 'error');
        } finally {
            this.state.isAnalyzing = false;
        }
    },

    analyzeFile: async function (file) {
        const formData = new FormData();
        formData.append('kml', file);
        try {
            const response = await fetch('/analisar-solos', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            console.error('Erro ao enviar arquivo para /analisar-solos:', err);
            APP.showStatus(`Erro ao analisar solos: ${err.message}`, 'error');
            return null;
        }
    },

    analyzeDrawnPolygon: async function () {
        try {
            const geojsonStr = APP.getDrawnPolygonAsGeoJSON();
            if (!geojsonStr) { APP.showStatus('Poligono desenhado invalido.', 'error'); return null; }
            const blob = new Blob([geojsonStr], { type: 'application/json' });
            const file = new File([blob], 'poligono_desenhado.geojson', { type: 'application/json' });
            return await this.analyzeFile(file);
        } catch (err) {
            console.error('Erro ao analisar poligono desenhado (solos):', err);
            return null;
        }
    },

    displayResults: function (results) {
        if (typeof APP === 'undefined') return;
        if (!APP.state.analysisOrder.includes('solos')) APP.state.analysisOrder.push('solos');

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
            const btnSolos = document.getElementById('tabSolos');
            if (btnSolos) btnSolos.click();
        }, 150);
    },

    // ── HTML de resultados para o floating panel ──────────────────────────────

    createResultHTML: function (result) {
        if (!result || !result.relatorio) return '<p>Sem dados de solos.</p>';
        const rel = result.relatorio;
        const sp  = rel.solo_predominante;
        return `
            ${this.createSoloPredominanteHTML(rel)}
            ${this.createOrdemTableHTML(rel)}
            ${this.createClassesTableHTML(rel)}
        `;
    },

    createSoloPredominanteHTML: function (rel) {
        const sp = rel.solo_predominante;
        if (!sp) return '<p class="no-data">Nenhuma classe de solo identificada na gleba.</p>';
        const cor = sp.cor || '#CCCCCC';
        return `
            <div class="solo-predominante-card" style="border-left: 4px solid ${cor}; padding: 10px 12px; margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:${cor}; flex-shrink:0;"></span>
                    <strong style="font-size:0.85rem; color:#e0e0e0;">${sp.simbolo || sp.leg_desc}</strong>
                </div>
                <div style="font-size:0.78rem; color:#b0bec5; margin-bottom:6px;">${sp.leg_desc}</div>
                <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:0.75rem; color:#90a4ae;">
                    <span><b>Ordem:</b> ${sp.ordem || '—'}</span>
                    <span><b>Subordem:</b> ${sp.subordem || '—'}</span>
                    <span><b>Grande Grupo:</b> ${sp.grande_grupo || '—'}</span>
                </div>
                <div style="margin-top:6px; font-size:0.78rem; color:#4fc3f7;">
                    <b>${sp.area_ha_formatado}</b> &nbsp;|&nbsp; <b>${sp.percentual_formatado}</b> da gleba
                </div>
            </div>
            <div style="font-size:0.72rem; color:#78909c; margin-bottom:8px;">
                Area total da gleba: <b>${rel.area_total_poligono_ha_formatado}</b> &nbsp;|&nbsp; ${rel.num_classes} classe(s) identificada(s)
            </div>
        `;
    },

    createOrdemTableHTML: function (rel) {
        const ordens = rel.ordens || [];
        if (ordens.length === 0) return '';
        let rows = ordens.map(o => `
            <tr>
                <td>
                    <span class="color-indicator" style="background-color:${o.cor || '#CCCCCC'}"></span>
                    ${o.ordem}
                </td>
                <td>${o.area_ha ? o.area_ha.toFixed(4) : '—'}</td>
                <td>${o.percentual_formatado || '—'}</td>
            </tr>
        `).join('');
        return `
            <div class="classes-section" style="margin-bottom:10px;">
                <h4 style="font-size:0.78rem; color:#90a4ae; margin-bottom:6px;">DISTRIBUICAO POR ORDEM SiBCS</h4>
                <table class="classes-table">
                    <thead><tr><th>Ordem</th><th>Area (ha)</th><th>%</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    createClassesTableHTML: function (rel) {
        const classes = rel.classes || [];
        if (classes.length === 0) return '';
        const top = classes.slice(0, 12);
        let rows = top.map(cls => `
            <tr>
                <td>
                    <span class="color-indicator" style="background-color:${cls.cor || '#CCCCCC'}"></span>
                    <span title="${cls.leg_desc}">${cls.simbolo || cls.leg_desc.split(' ')[0]}</span>
                </td>
                <td style="font-size:0.7rem; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${cls.leg_desc}">${cls.ordem || '—'}</td>
                <td>${cls.area_ha_formatado}</td>
                <td>${cls.percentual_formatado}</td>
            </tr>
        `).join('');
        return `
            <div class="classes-section">
                <h4 style="font-size:0.78rem; color:#90a4ae; margin-bottom:6px;">CLASSES PEDOLOGICAS (TOP 12)</h4>
                <table class="classes-table">
                    <thead><tr><th>Cod.</th><th>Ordem</th><th>Area (ha)</th><th>%</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    // ── Overlay de solos no mapa (padrão Embargo — L.geoJSON) ──────────────

    showSolosOnMap: function () {
        this.hideSolosOnMap();
        if (!this.state.analysisResults || this.state.analysisResults.length === 0) return;

        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
        const result = this.state.analysisResults[polygonIndex] || this.state.analysisResults[0];
        if (!result || !result.solos_geojson) return;

        const leafletMap = (typeof MAP !== 'undefined') ? MAP.state.leafletMap : null;
        if (!leafletMap) return;

        try {
            const layer = L.geoJSON(result.solos_geojson, {
                style: function (feature) {
                    return {
                        color: '#333',
                        weight: 1,
                        opacity: 0.8,
                        fillColor: (feature.properties && feature.properties.cor) || '#CCCCCC',
                        fillOpacity: 0.55,
                    };
                },
                onEachFeature: function (feature, lyr) {
                    const p = feature.properties || {};
                    lyr.bindPopup(
                        '<b>' + (p.leg_desc || '-') + '</b><br>' +
                        'Ordem: ' + (p.ordem || '-')
                    );
                },
            }).addTo(leafletMap);
            this.state.solosLayers.push(layer);
        } catch (err) {
            console.error('Erro ao exibir solos no mapa:', err);
        }
    },

    hideSolosOnMap: function () {
        const leafletMap = (typeof MAP !== 'undefined') ? MAP.state.leafletMap : null;
        if (leafletMap) {
            this.state.solosLayers.forEach(function (l) {
                if (l && leafletMap.hasLayer(l)) leafletMap.removeLayer(l);
            });
        }
        this.state.solosLayers = [];
    },

    clearAnalysis: function () {
        this.hideSolosOnMap();
        this.state.analysisResults = [];
        this.state.isAnalyzing = false;
        console.log('Analise de solos limpa.');
    },
};
