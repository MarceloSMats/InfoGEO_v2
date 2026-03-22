// Modulo de Analise Pedologica — Solos Embrapa SiBCS 1:5.000.000
const Solos = {
    state: {
        analysisResults: [],
        isAnalyzing: false,
        solosLayers: [],
    },

    // Cores por Ordem SiBCS (fallback quando cor da classe nao disponivel)
    ORDEM_CORES: {
        'Latossolos': '#D4A76A',
        'Argissolos': '#E8A87C',
        'Cambissolos': '#C4B59B',
        'Gleissolos': '#A8C8A0',
        'Espodossolos': '#E8D5B0',
        'Plintossolos': '#D4956A',
        'Vertissolos': '#B8A89A',
        'Neossolos': '#D4C4A0',
        'Luvissolos': '#E8B87C',
        'Planossolos': '#C8D4A0',
        'Chernossolos': '#9A8070',
        'Nitossolos': '#C47050',
        'Afloramentos de Rochas': '#BEBEBE',
        'Dunas': '#F5E6C0',
        'Agua': '#A8D4E8',
        'Outros': '#CCCCCC',
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
                if (result) results.push({ ...result, fileIndex: -1 });
            } else {
                let filesToAnalyze = APP.state.currentFiles;
                const indexOffset = (APP.state.selectedPolygonIndex >= 0 && APP.state.selectedPolygonIndex < APP.state.currentFiles.length)
                    ? APP.state.selectedPolygonIndex : 0;
                if (APP.state.selectedPolygonIndex >= 0 && APP.state.selectedPolygonIndex < APP.state.currentFiles.length) {
                    filesToAnalyze = [APP.state.currentFiles[APP.state.selectedPolygonIndex]];
                }

                for (let i = 0; i < filesToAnalyze.length; i++) {
                    const file = filesToAnalyze[i];
                    const originalIndex = indexOffset + i;
                    APP.showProgress(`Solos: ${file.name}`, i + 1, filesToAnalyze.length);
                    const result = await this.analyzeFile(file);
                    if (result) results.push({ ...result, fileIndex: originalIndex, fileName: file.name });
                }
            }

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

            if (results.length > 0) {
                this.displayResults(this.state.analysisResults);
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
            if (!APP.state.drawnPolygon) {
                APP.showStatus('Poligono desenhado invalido.', 'error');
                return null;
            }
            const geojson = APP.state.drawnPolygon.toGeoJSON();
            const geojsonStr = JSON.stringify(geojson);
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

        // Verificar se TODOS os resultados sao vazios (sem classes de solo)
        const allEmpty = results.every(function (r) {
            return !r.relatorio || !r.relatorio.classes || r.relatorio.classes.length === 0;
        });
        if (allEmpty) {
            APP.showStatus('Nenhum resultado de solos obtido para esta area.', 'warn');
        }

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
            Object.values(this.state.solosLayers).forEach(function (l) {
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
