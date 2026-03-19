// Módulo de Análise Climática Köppen-Geiger
const Koppen = {
    state: {
        analysisResults: null,
        isAnalyzing: false,
        rasterLayers: [],
        climatogramChart: null
    },

    // Cores das classes Köppen
    CORES_KOPPEN: {
        0:  "#CCCCCC",
        1:  "#7bae65",
        2:  "#314999",
        3:  "#221f65",
        4:  "#aac31b",
        5:  "#549a48",
        6:  "#b9c116",
        7:  "#e6e40a",
        8:  "#45922a",
        9:  "#d39525",
        10: "#8ec0e1",
        11: "#275c26",
        12: "#3a7bc7",
    },

    // Nomes das classes Köppen
    NOMES_KOPPEN: {
        0:  "Sem classe (NoData/fora do raster)",
        1:  "Cwa — Subtropical com inverno seco e verão quente",
        2:  "Am — Monçônico tropical",
        3:  "Af — Tropical úmido sem estação seca (equatorial)",
        4:  "Cfa — Subtropical úmido com verão quente",
        5:  "Cwb — Subtropical com inverno seco e verão temperado",
        6:  "Csb — Mediterrâneo com verão seco e temperado",
        7:  "Csa — Mediterrâneo com verão seco e quente",
        8:  "Cfb — Oceânico temperado úmido",
        9:  "BSh — Semiárido quente",
        10: "As — Tropical com estação seca de verão",
        11: "Cwc — Subtropical com inverno seco e verão frio",
        12: "Aw — Tropical de savana",
    },

    /**
     * Inicialização do módulo
     */
    init: function () {
        this.setupEventListeners();
        console.log('Módulo Köppen-Geiger inicializado');
    },

    /**
     * Configurar event listeners
     */
    setupEventListeners: function () {
        const btnAnalyze = document.getElementById('btnAnalyzeKoppen');
        if (btnAnalyze) {
            btnAnalyze.addEventListener('click', () => this.analyzeKoppen());
        }

        const btnClearKoppen = document.getElementById('btnClearKoppen');
        if (btnClearKoppen) {
            btnClearKoppen.addEventListener('click', () => this.clearAnalysis());
        }
    },

    /**
     * Executar análise Köppen
     */
    analyzeKoppen: async function () {
        if (this.state.isAnalyzing) {
            APP.showStatus('Análise Köppen já em andamento...', 'warn');
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
                APP.showProgress('Köppen: polígono desenhado', 1, 1);
                const result = await this.analyzeDrawnPolygon();
                if (result) {
                    results.push(result);
                }
            }
            // Se não há polígono desenhado, mas há arquivos carregados, analisar arquivos
            else if (hasFiles) {
                for (let i = 0; i < APP.state.currentFiles.length; i++) {
                    const file = APP.state.currentFiles[i];
                    APP.showProgress(`Köppen: ${file.name}`, i + 1, APP.state.currentFiles.length);

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
                APP.showStatus(`Análise Köppen-Geiger concluída para ${results.length} polígono(s)!`, 'success');
            } else {
                APP.showStatus('Nenhum resultado Köppen obtido.', 'error');
            }

        } catch (error) {
            console.error('Erro na análise Köppen:', error);
            APP.showStatus(`Erro na análise Köppen: ${error.message}`, 'error');
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
            const response = await fetch('/analisar-koppen', {
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

            const response = await fetch('/analisar-koppen', {
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
        if (!APP.state.analysisOrder.includes('koppen')) APP.state.analysisOrder.push('koppen');

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
            // Sem Solo: inicializar o painel com dados da Köppen
            APP.showPolygonResult(polygonIndex, { skipZoom: true });
        }

        // Após análise de Köppen, sempre exibir a aba de Köppen
        setTimeout(() => {
            const btnKoppen = document.getElementById('tabKoppen');
            if (btnKoppen) btnKoppen.click();

            // Renderizar climograma se dados climáticos disponíveis
            const currentResult = results[polygonIndex] || results[0];
            if (currentResult && currentResult.dados_climaticos) {
                setTimeout(() => this.renderClimatogram(currentResult.dados_climaticos), 200);
            }
        }, 150);

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
        card.className = 'result-card koppen-card';
        card.innerHTML = `
            <div class="result-header">
                <h3>🌡️ ${result.fileName || `Polígono ${index + 1}`}</h3>
                <button class="btn-close" onclick="Koppen.removeResult(${index})">&times;</button>
            </div>
            <div class="result-body">
                ${this.createSummaryHTML(result)}
                ${this.createClassesTableHTML(result)}
                ${this.createClimatogramHTML(result)}
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
                <h4>Classificação Climática Köppen-Geiger</h4>
                <table class="classes-table">
                    <thead>
                        <tr>
                            <th>Classe</th>
                            <th>Descrição</th>
                            <th>Área (ha)</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        classesArray.forEach(cls => {
            const classeNum = parseInt(cls.key.replace('Classe ', ''));
            const cor = this.CORES_KOPPEN[classeNum] || '#CCCCCC';

            tableHTML += `
                <tr>
                    <td>
                        <span class="color-indicator" style="background-color: ${cor}"></span>
                        ${cls.descricao}
                    </td>
                    <td style="font-size: 0.85em; color: var(--text-muted, #8899aa);">${this.NOMES_KOPPEN[classeNum] || ''}</td>
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
                <h4>Mapa de Classificação Climática</h4>
                <img src="data:image/png;base64,${result.imagem_recortada.base64}"
                     alt="Mapa Köppen-Geiger"
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
        this.hideKoppenImageOnMap();
        this.state.analysisResults = null;

        APP.showStatus('Análise Köppen limpa', 'info');
    },

    /**
     * Atualizar estado da UI
     */
    updateUIState: function (isAnalyzing) {
        const btnAnalyze = document.getElementById('btnAnalyzeKoppen');
        if (btnAnalyze) {
            btnAnalyze.disabled = isAnalyzing;
            btnAnalyze.textContent = isAnalyzing ? 'Analisando...' : 'Analisar Köppen';
        }
    },

    /**
     * Mostrar imagem de Köppen no mapa com opacidade atual
     * Exibe todos os recortes para todos os polígonos simultaneamente
     */
    showKoppenImageOnMap: function () {
        console.log('🟢 showKoppenImageOnMap chamado');

        if (!this.state.analysisResults || this.state.analysisResults.length === 0) {
            console.warn('⚠️ Nenhum resultado de análise disponível');
            return;
        }

        // Remover layers anteriores se existirem
        this.hideKoppenImageOnMap();

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

            // Verificar se há uma cor predominante (estratégia "pintar polígono" ao invés de raster)
            if (result.cor_predominante && result.polygon_geojson) {
                console.log(`🎨 Usando cor predominante para Köppen: ${result.cor_predominante}`);
                
                try {
                    // Extrair geometrias do GeoJSON e criar camadas com a cor predominante
                    const geojsonFeatures = result.polygon_geojson.features || [];
                    
                    for (let j = 0; j < geojsonFeatures.length; j++) {
                        const feature = geojsonFeatures[j];
                        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                            const layer = L.geoJSON(feature, {
                                style: {
                                    color: result.cor_predominante,
                                    weight: 2,
                                    opacity: opacity,
                                    fill: true,
                                    fillColor: result.cor_predominante,
                                    fillOpacity: opacity * 0.8
                                }
                            }).addTo(MAP.state.leafletMap);
                            
                            this.state.rasterLayers[i] = layer;
                            console.log(`✅ Polígono Köppen ${i} pintado com cor ${result.cor_predominante}`);
                        }
                    }
                } catch (e) {
                    console.error(`❌ Erro ao criar layer com cor predominante: ${e}`);
                }
                continue;
            }

            // Fallback: usar o recorte do raster se disponível (para compatibilidade)
            let imagemRecortada = null;

            if (result.relatorio && result.relatorio.imagem_recortada) {
                imagemRecortada = result.relatorio.imagem_recortada;
            } else if (result.imagem_recortada) {
                imagemRecortada = result.imagem_recortada;
            }

            if (!imagemRecortada) {
                console.log(`ℹ️ Sem imagem ou cor predominante para resultado ${i}`);
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
            let bounds = MAP.getPolygonBounds(i);

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
                this.state.rasterLayers[i] = layer;
                console.log(`✅ Camada Köppen ${i} (imagem) adicionada ao mapa`);
            } else {
                console.warn(`⚠️ Bounds não encontrados para o polígono de índice: ${i}`);
            }
        }
    },

    /**
     * Criar HTML da seção de climograma
     */
    createClimatogramHTML: function (result) {
        const dados = result.dados_climaticos;
        if (!dados) return '';

        return `
            <div class="climatogram-section">
                <h4>Dados Climáticos — ${dados.municipio}/${dados.uf}</h4>
                <div class="climate-summary">
                    <div class="climate-summary-item">
                        <span class="label">Köppen Dominante:</span>
                        <span class="value">${dados.koppen_dominante}</span>
                    </div>
                    <div class="climate-summary-item">
                        <span class="label">Altitude Média:</span>
                        <span class="value">${dados.altitude_m.toFixed(0)} m</span>
                    </div>
                    <div class="climate-summary-item">
                        <span class="label">Temp. Média Anual:</span>
                        <span class="value">${dados.temperatura_media_anual.toFixed(1)} °C</span>
                    </div>
                    <div class="climate-summary-item">
                        <span class="label">Precip. Total Anual:</span>
                        <span class="value">${dados.precipitacao_total_anual.toFixed(0)} mm</span>
                    </div>
                </div>
                <div class="climatogram-chart-container">
                    <canvas id="koppenClimatogram"></canvas>
                </div>
            </div>
        `;
    },

    /**
     * Renderizar climograma em canvas específico (usado pelo painel maximizado)
     */
    renderClimatogramOnCanvas: function (canvasId, dados) {
        if (!dados) return;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destruir chart anterior associado a este canvas
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        this._buildClimatogramChart(canvas, dados);
    },

    /**
     * Renderizar climograma (barras precipitação + linha temperatura)
     */
    renderClimatogram: function (dados) {
        if (!dados) return;

        const canvas = document.getElementById('koppenClimatogram');
        if (!canvas) return;

        // Destruir chart anterior se existir
        if (this.state.climatogramChart) {
            this.state.climatogramChart.destroy();
            this.state.climatogramChart = null;
        }

        this.state.climatogramChart = this._buildClimatogramChart(canvas, dados);
    },

    /**
     * Construir chart de climograma em um canvas
     */
    _buildClimatogramChart: function (canvas, dados) {
        const meses = Object.keys(dados.temperaturas_mensais);
        const temps = Object.values(dados.temperaturas_mensais);
        const precs = Object.values(dados.precipitacoes_mensais);
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#c9d1d9';
        const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#8b949e';

        return new Chart(canvas, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Precipitação (mm)',
                        data: precs,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        yAxisID: 'y-prec',
                        order: 2
                    },
                    {
                        label: 'Temperatura (°C)',
                        data: temps,
                        type: 'line',
                        borderColor: 'rgba(255, 68, 68, 1)',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: 'rgba(255, 68, 68, 1)',
                        fill: false,
                        yAxisID: 'y-temp',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, font: { size: 11 } }
                    },
                    title: {
                        display: true,
                        text: `Climograma — ${dados.municipio}/${dados.uf}`,
                        color: textColor,
                        font: { size: 13, weight: 'bold' }
                    }
                },
                scales: {
                    'y-prec': {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'Precipitação (mm)', color: 'rgba(54, 162, 235, 1)', font: { size: 11 } },
                        ticks: { color: 'rgba(54, 162, 235, 0.8)', font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    'y-temp': {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Temperatura (°C)', color: 'rgba(255, 68, 68, 1)', font: { size: 11 } },
                        ticks: { color: 'rgba(255, 68, 68, 0.8)', font: { size: 10 } },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        ticks: { color: textSecondary, font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
    },

    /**
     * Esconder imagem de Köppen no mapa
     */
    hideKoppenImageOnMap: function () {
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
    document.addEventListener('DOMContentLoaded', () => Koppen.init());
} else {
    Koppen.init();
}
