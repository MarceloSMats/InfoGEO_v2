// =============================================
// FloatingPanel - Módulo de Quadros Flutuantes
// =============================================
// Gerencia painéis flutuantes, gráficos de distribuição,
// abas de visualização e funções de atualização do painel.

const FloatingPanel = {

    // === CONTROLES DO PAINEL ===

    // Fechar quadro flutuante
    close: function () {
        const panel = document.getElementById('floatingPanel');
        if (panel) panel.style.display = 'none';
    },

    // Alternar maximização do quadro flutuante
    toggleMaximize: function () {
        const panel = document.getElementById('floatingPanel');
        const btn = document.getElementById('btnMaximizePanel');
        if (!panel || !btn) return;

        if (panel.classList.contains('maximized')) {
            this.restore();
            btn.textContent = '⛶';
            btn.title = 'Maximizar';
        } else {
            this.maximize();
            btn.textContent = '⛶';
            btn.title = 'Restaurar';
        }
    },

    // Maximizar quadro flutuante
    maximize: function () {
        const panel = document.getElementById('floatingPanel');
        if (!panel) return;
        panel.classList.add('maximized');
        panel.classList.remove('compact');
        panel.setAttribute('data-maximized', 'true');

        // Mostrar TODAS as colunas quando maximizado (Solo E Declividade)
        const centerSolo = document.getElementById('floatingCenter');
        const rightSolo = document.getElementById('floatingRight');
        const maximizedChartsContainer = document.getElementById('maximizedChartsContainer');
        // quando maximizado, mostramos somente as colunas com tabelas;
        // remove gráficos de pizza conforme solicitado pelo usuário
        if (centerSolo) centerSolo.style.display = 'flex';
        if (rightSolo) rightSolo.style.display = 'none';              // ocultar coluna direita completamente
        if (maximizedChartsContainer) maximizedChartsContainer.style.display = 'none';

        // Preencher dados de SOLO (sempre, independente do toggle)
        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
        const soloResult = APP.state.analysisResults[polygonIndex];
        if (soloResult && soloResult.relatorio) {
            this.updateCenter(soloResult.relatorio);
            // nada de gráficos no modo maximizado
            // this.createAreaChart(soloResult.relatorio.classes, false, 'maximizedAreaChart');
        }

        // Preencher dados de DECLIVIDADE (sempre, independente do toggle)
        // declividade continua a popular as tabelas, mas gráficos não são exibidos
        if (typeof DecliviDADE !== 'undefined' && DecliviDADE.state.analysisResults &&
            DecliviDADE.state.analysisResults.length > 0) {
            const decliviDADEResult = DecliviDADE.state.analysisResults[polygonIndex] || DecliviDADE.state.analysisResults[0];
            if (decliviDADEResult && decliviDADEResult.relatorio) {
                // sem gráfico
                // this.createAreaChartDeclividade(decliviDADEResult.relatorio.classes, 'maximizedAreaChartDeclividade');
            }
        }

        // Preencher dados de APTIDÃO
        if (typeof Aptidao !== 'undefined' && Aptidao.state.analysisResults &&
            Aptidao.state.analysisResults.length > 0) {
            const aptidaoResult = Aptidao.state.analysisResults[polygonIndex] || Aptidao.state.analysisResults[0];
            if (aptidaoResult && aptidaoResult.relatorio) {
                // sem gráfico
                // this.createAreaChartAptidao(aptidaoResult.relatorio.classes, 'maximizedAreaChartAptidao');
            }
        }

        // Garantir que o gráfico seja redimensionado após a transição
        setTimeout(() => {
            try {
                if (APP.state.areaChart) {
                    APP.state.areaChart.resize();
                    APP.state.areaChart.update();
                }
                if (APP.state.areaChartDeclividade) {
                    APP.state.areaChartDeclividade.resize();
                    APP.state.areaChartDeclividade.update();
                }
                if (APP.state.areaChartAptidao) {
                    APP.state.areaChartAptidao.resize();
                    APP.state.areaChartAptidao.update();
                }
                if (APP.state.areaChartSoloTextural) {
                    APP.state.areaChartSoloTextural.resize();
                    APP.state.areaChartSoloTextural.update();
                }
            } catch (e) { console.warn('Erro ao redimensionar gráfico:', e); }
        }, 350);
    },

    // Restaurar quadro flutuante para tamanho original
    restore: function () {
        const panel = document.getElementById('floatingPanel');
        if (!panel) return;
        panel.classList.remove('maximized');
        panel.classList.add('compact');
        panel.removeAttribute('data-maximized');

        // Esconder container de gráficos empilhados e restaurar coluna direita
        const maximizedChartsContainer = document.getElementById('maximizedChartsContainer');
        if (maximizedChartsContainer) maximizedChartsContainer.style.display = 'none';
        const rightSolo = document.getElementById('floatingRight');
        if (rightSolo) rightSolo.style.display = 'flex';

        // Renderizar gráficos novamente nos elementos originais
        const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
        const soloResult = APP.state.analysisResults[polygonIndex];
        if (soloResult && soloResult.relatorio) {
            this.createAreaChart(soloResult.relatorio.classes, false, 'floatingAreaChart');
        }

        if (typeof DecliviDADE !== 'undefined' && DecliviDADE.state.analysisResults &&
            DecliviDADE.state.analysisResults.length > 0) {
            const decliviDADEResult = DecliviDADE.state.analysisResults[polygonIndex] || DecliviDADE.state.analysisResults[0];
            if (decliviDADEResult && decliviDADEResult.relatorio) {
                this.createAreaChartDeclividade(decliviDADEResult.relatorio.classes, 'floatingAreaChartDeclividade');
            }
        }

        if (typeof Aptidao !== 'undefined' && Aptidao.state.analysisResults &&
            Aptidao.state.analysisResults.length > 0) {
            const aptidaoResult = Aptidao.state.analysisResults[polygonIndex] || Aptidao.state.analysisResults[0];
            if (aptidaoResult && aptidaoResult.relatorio) {
                this.createAreaChartAptidao(aptidaoResult.relatorio.classes, 'floatingAreaChartAptidao');
            }
        }

        if (typeof SoloTextural !== 'undefined' && SoloTextural.state.analysisResults &&
            SoloTextural.state.analysisResults.length > 0) {
            const stxResult = SoloTextural.state.analysisResults[polygonIndex] || SoloTextural.state.analysisResults[0];
            if (stxResult && stxResult.relatorio) {
                this.createAreaChartSoloTextural(stxResult.relatorio.classes, 'floatingAreaChartSoloTextural');
            }
        }

        // Reaplicar resize após restauração
        setTimeout(() => {
            try {
                if (APP.state.areaChart) {
                    APP.state.areaChart.resize();
                    APP.state.areaChart.update();
                }
                if (APP.state.areaChartDeclividade) {
                    APP.state.areaChartDeclividade.resize();
                    APP.state.areaChartDeclividade.update();
                }
                if (APP.state.areaChartAptidao) {
                    APP.state.areaChartAptidao.resize();
                    APP.state.areaChartAptidao.update();
                }
                if (APP.state.areaChartSoloTextural) {
                    APP.state.areaChartSoloTextural.resize();
                    APP.state.areaChartSoloTextural.update();
                }
            } catch (e) { console.warn('Erro ao redimensionar gráfico:', e); }
        }, 300);
    },

    // Fixar/desfixar painel
    togglePin: function () {
        APP.state.isPanelPinned = !APP.state.isPanelPinned;
        const btn = document.getElementById('btnPinPanel');
        if (btn) {
            btn.textContent = APP.state.isPanelPinned ? '📌' : '📌';
            btn.title = APP.state.isPanelPinned ? 'Painel fixado' : 'Fixar painel';
        }
        APP.saveUserPreferences();
    },

    // === CRIAÇÃO DE GRÁFICOS ===

    // Criar gráfico de declividade no quadro flutuante
    createAreaChartDeclividade: function (classes, canvasId = 'floatingAreaChartDeclividade') {
        if (APP.state.areaChartDeclividade) {
            APP.state.areaChartDeclividade.destroy();
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        // Preparar dados da análise
        const labels = [];
        const data = [];
        const colors = [];

        const colorPalette = DecliviDADE.CORES_DECLIVIDADE;

        for (const [key, info] of Object.entries(classes)) {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') continue;

            labels.push(info.descricao);
            data.push(info.area_ha);
            colors.push(colorPalette[classNum] || '#CCCCCC');
        }

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartDeclividade = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Análise Declividade',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // Criar gráfico de aptidão no quadro flutuante
    createAreaChartAptidao: function (classes, canvasId = 'floatingAreaChartAptidao') {
        if (APP.state.areaChartAptidao) {
            APP.state.areaChartAptidao.destroy();
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        // Preparar dados da análise
        const labels = [];
        const data = [];
        const colors = [];

        const colorPalette = Aptidao.CORES_APTIDAO;

        for (const [key, info] of Object.entries(classes)) {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') continue;

            labels.push(info.descricao);
            data.push(info.area_ha);
            colors.push(colorPalette[classNum] || '#CCCCCC');
        }

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartAptidao = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Análise Aptidão',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    createAreaChartSoloTextural: function (classes, canvasId = 'floatingAreaChartSoloTextural') {
        if (APP.state.areaChartSoloTextural) {
            APP.state.areaChartSoloTextural.destroy();
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const labels = [];
        const data = [];
        const colors = [];

        const colorPalette = SoloTextural.CORES_SOLO_TEXTURAL;

        for (const [key, info] of Object.entries(classes)) {
            const classNum = parseInt(key.replace('Classe ', ''));
            if (classNum === 0) continue;

            labels.push(info.descricao);
            data.push(info.area_ha);
            colors.push(colorPalette[classNum] || '#CCCCCC');
        }

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartSoloTextural = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Textura do Solo',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    createAreaChartKoppen: function (classes, canvasId = 'floatingAreaChartKoppen') {
        if (APP.state.areaChartKoppen) {
            APP.state.areaChartKoppen.destroy();
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const labels = [];
        const data = [];
        const colors = [];

        const colorPalette = Koppen.CORES_KOPPEN;

        for (const [key, info] of Object.entries(classes)) {
            const classNum = parseInt(key.replace('Classe ', ''));
            if (classNum === 0) continue;

            labels.push(info.descricao);
            data.push(info.area_ha);
            colors.push(colorPalette[classNum] || '#CCCCCC');
        }

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartKoppen = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Köppen-Geiger',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    createAreaChartProdes: function (prodesResult, canvasId = 'floatingAreaChartProdes') {
        if (APP.state.areaChartProdes) {
            APP.state.areaChartProdes.destroy();
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const eudr = prodesResult.eudr || {};
        const breakdown = eudr.risk_breakdown || {};

        const labels = [];
        const data = [];
        const colors = [];

        const order = ['HIGH_RISK', 'EUDR_MARKER', 'ATTENTION', 'CONSOLIDATED', 'SAFE'];
        for (const level of order) {
            const item = breakdown[level];
            if (!item) continue;
            labels.push(item.label);
            data.push(item.area_ha);
            colors.push(item.color);
        }

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartProdes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Risco EUDR',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Timeline de desmatamento
        this.createProdesTimeline(eudr.deforestation_years || {});
    },

    createAreaChartSolos: function (solosResult, canvasId = 'floatingAreaChartSolos') {
        if (APP.state.areaChartSolos) {
            APP.state.areaChartSolos.destroy();
            APP.state.areaChartSolos = null;
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const rel = solosResult.relatorio || {};
        const ordens = rel.ordens || [];
        if (!ordens.length) {
            const canvasContainer = canvasEl.parentElement;
            if (canvasContainer) {
                canvasContainer.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Nenhum resultado de solos obtido para esta area.</p>';
            }
            return;
        }

        const labels = ordens.map(o => o.ordem);
        const data   = ordens.map(o => o.area_ha || 0);
        const colors = ordens.map(o => o.cor || '#CCCCCC');

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor  = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg    = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText  = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartSolos = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Solos (ha)',
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${context.label}: ${value.toFixed(2)} ha (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    createProdesTimeline: function (timeline) {
        const container = document.getElementById('prodesTimelineContainer');
        const canvasEl = document.getElementById('prodesTimelineCanvas');
        if (!container || !canvasEl) return;

        const years = Object.keys(timeline).map(Number);
        const areas = Object.values(timeline);

        if (years.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';

        if (APP.state.prodesTimelineChart) {
            APP.state.prodesTimelineChart.destroy();
        }

        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const colors = years.map(y => y >= 2021 ? '#de0004' : y === 2020 ? '#FF9800' : '#66BB6A');

        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const gridColor = isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';

        APP.state.prodesTimelineChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years.map(String),
                datasets: [{
                    label: 'Desmatamento (ha)',
                    data: areas,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#263156'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        callbacks: {
                            label: function (context) {
                                return `${context.raw.toFixed(4)} ha`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: legendColor, font: { size: 10 } },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { color: legendColor, font: { size: 10 } },
                        grid: { color: gridColor },
                        title: {
                            display: true,
                            text: 'hectares',
                            color: legendColor,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    },

    // Criar gráfico no quadro flutuante
    createAreaChart: function (classes, isDeclividade = false, canvasId = 'floatingAreaChart') {
        if (APP.state.areaChart) {
            APP.state.areaChart.destroy();
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return; // nothing to draw into
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        // Preparar dados da análise
        const analysisLabels = [];
        const analysisData = [];
        const analysisColors = [];

        // Usar cores de declividade ou de solo conforme o tipo
        const colorPalette = isDeclividade ? DecliviDADE.CORES_DECLIVIDADE : UTILS.CLASSES_CORES;

        for (const [key, info] of Object.entries(classes)) {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') continue;

            analysisLabels.push(info.descricao);
            analysisData.push(info.area_ha);
            analysisColors.push(colorPalette[classNum] || '#CCCCCC');
        }

        // SIGEF desativado nesta versão
        // let sigefLabels = [];
        // let sigefData = [];
        // let sigefColors = [];
        // if (sigefInfo && sigefInfo.length > 0) { ... }

        // Criar gráfico de rosca dupla
        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        console.log('createFloatingAreaChart - Tema:', currentTheme, '| Cor legenda:', legendColor);

        APP.state.areaChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: analysisLabels,
                datasets: [
                    {
                        label: 'Análise Atual',
                        data: analysisData,
                        backgroundColor: analysisColors,
                        borderWidth: 1,
                        borderColor: '#263156'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // SIGEF desativado nesta versão
        // if (sigefData.length > 0) {
        //     this.addSigefLayerToChart(sigefLabels, sigefData, sigefColors);
        // }
    },

    // Adicionar camada SIGEF ao gráfico
    // === SIGEF desativado nesta versão ===
    // addSigefLayerToChart: function (labels, data, colors) { ... },
    // mapSigefClassToColor: function (sigefClass) { ... },

    // === ATUALIZAÇÃO DE CONTEÚDO DO PAINEL ===

    // Atualizar legenda no quadro flutuante
    updateLegend: function (legendData) {
        const legendContent = document.getElementById('floatingLegendContent');
        if (!legendContent) return;
        legendContent.innerHTML = '';

        legendData.forEach(item => {
            // ✅ PULAR CLASSE 0
            if (item.classe === 0) return;

            const legendItem = document.createElement('div');
            legendItem.className = 'floating-legend-item';
            legendItem.innerHTML = `
            <div class="floating-legend-color" style="background-color:${item.cor};"></div>
            <div class="floating-legend-label">${item.descricao}</div>
        `;
            legendContent.appendChild(legendItem);
        });
    },

    // SIGEF desativado nesta versão
    // updateImovelInfo: function (info) { ... },

    // Atualizar resumo da análise
    updateSummary: function (relatorio, metadados = {}) {
        const container = document.getElementById('floatingSummaryContainer');
        if (!container) return;

        if (!relatorio) {
            container.innerHTML = '<div style="font-size: 12px; color: #91a0c0;">Execute uma análise para ver o resumo.</div>';
            return;
        }

        const areaTotal = relatorio.area_total_poligono_ha_formatado || relatorio.area_total_poligono_ha || '-';
        const numClasses = relatorio.numero_classes_encontradas || 0;
        const municipio = metadados.municipio || 'Não identificado';
        const uf = metadados.uf || 'N/D';
        const cdRta = metadados.cd_rta || null;
        const nmRta = metadados.nm_rta || null;
        const rtaLabel = cdRta && nmRta ? `${cdRta} – ${nmRta}` : (nmRta || 'Não identificado');

        // Obter número de classes de declividade se disponível
        let numClassesDecl = 0;
        if (typeof DecliviDADE !== 'undefined' && DecliviDADE.state.analysisResults &&
            DecliviDADE.state.analysisResults.length > 0) {
            const decliviDADEResult = DecliviDADE.state.analysisResults[0];
            if (decliviDADEResult && decliviDADEResult.relatorio) {
                numClassesDecl = decliviDADEResult.relatorio.numero_classes_encontradas || 0;
            }
        }

        // Obter número de classes de aptidão se disponível
        let numClassesApti = 0;
        if (typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.analysisResults &&
            Aptidao.state.analysisResults.length > 0) {
            const aptidaoResult = Aptidao.state.analysisResults[0];
            if (aptidaoResult && aptidaoResult.relatorio) {
                numClassesApti = aptidaoResult.relatorio.numero_classes_encontradas || 0;
            }
        }

        container.innerHTML = `
        <div style="font-size: 12px; color: #91a0c0; line-height: 1.6;">
            <div style="margin-bottom: 8px;"><strong>Município/UF:</strong> ${municipio} - ${uf}</div>
            <div style="margin-bottom: 8px;"><strong>Macrorregião RTA:</strong> ${rtaLabel}</div>
            <div style="margin-bottom: 8px;"><strong>Área Total:</strong> ${areaTotal}</div>
            <div style="margin-bottom: 8px;"><strong>Classes Solo:</strong> ${numClasses}</div>
            <div><strong>Classes Declividade:</strong> ${numClassesDecl}</div>
            <div><strong>Classes Aptidão:</strong> ${numClassesApti}</div>
        </div>
    `;
    },


    // Atualizar a área central com a tabela de classes resultante da análise multimodulo
    updateCenter: function () {
        const container = document.getElementById('floatingClassesTableContainer');
        if (!container) return;

        const rows = [];
        let hasContent = false;

        // ===== TABELA DE USO DO SOLO =====
        const resultSolo = APP.state.analysisResults ? APP.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex) : null;
        // Coluna "Valor" só aparece quando valoração PRO foi executada explicitamente
        const hasValoracao = !!(APP.state.valoracaoCache && APP.state.valoracaoCache[APP.state.currentPolygonIndex] != null);

        if (resultSolo && resultSolo.relatorio && resultSolo.relatorio.classes && Object.keys(resultSolo.relatorio.classes).length > 0) {
            hasContent = true;
            rows.push('<div style="margin-bottom: 12px;">')
            rows.push('<h5 style="color: #60d5ff; margin-bottom: 10px; font-size: 13px;">📊 Uso do Solo</h5>');
            rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
            const valorTh = hasValoracao ? '<th style="text-align:right; padding:6px; color:#91a0c0;">Valor</th>' : '';
            rows.push(`<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0;">Descrição</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th>${valorTh}</tr></thead>`);
            rows.push('<tbody>');

            let totalArea = 0;
            let totalPercent = 0;
            let totalValue = 0;

            Object.entries(resultSolo.relatorio.classes).forEach(([key, info]) => {
                const classNum = key.replace('Classe ', '');
                if (classNum === '0') return;
                const color = UTILS.CLASSES_CORES[classNum] || '#CCCCCC';

                totalArea += parseFloat(info.area_ha) || 0;
                totalPercent += parseFloat(info.percentual) || 0;
                if (hasValoracao) totalValue += parseFloat(info.valor_calculado) || 0;

                const valorTd = hasValoracao
                    ? `<td style="padding:6px;text-align:right;">${info.valor_calculado_formatado !== undefined ? info.valor_calculado_formatado : (info.valor_calculado !== undefined ? info.valor_calculado : '-')}</td>`
                    : '';
                rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${classNum}</td><td style="padding:6px;">${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td>${valorTd}</tr>`);
            });

            const valorTotalTd = hasValoracao
                ? `<td style="padding:6px;text-align:right;"><strong>${APP.formatCurrencyPTBR(totalValue)}</strong></td>`
                : '';
            rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
            rows.push(`<td style="padding:6px;" colspan="2"><strong>Total</strong></td>`);
            rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalArea, 2)} ha</strong></td>`);
            rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercent, 2)}%</strong></td>`);
            rows.push(valorTotalTd);
            rows.push(`</tr>`);
            rows.push('</tbody></table>');
            rows.push('</div>');
        }

        // ===== TABELA DE DECLIVIDADE (se houver) =====
        if (DecliviDADE && DecliviDADE.state.analysisResults && DecliviDADE.state.analysisResults.length > 0) {
            const decliviDADEResult = DecliviDADE.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);

            if (decliviDADEResult && decliviDADEResult.relatorio && decliviDADEResult.relatorio.classes) {
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push('<h5 style="color: #60d5ff; margin-bottom: 10px; font-size: 13px;">📐 Declividade</h5>');
                rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0;">Descrição</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                rows.push('<tbody>');

                let totalAreaDecl = 0;
                let totalPercentDecl = 0;

                Object.entries(decliviDADEResult.relatorio.classes).forEach(([key, info]) => {
                    const classNum = key.replace('Classe ', '');
                    if (classNum === '0') return;
                    const color = DecliviDADE.CORES_DECLIVIDADE[classNum] || '#CCCCCC';

                    totalAreaDecl += parseFloat(info.area_ha) || 0;
                    totalPercentDecl += parseFloat(info.percentual) || 0;

                    rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${classNum}</td><td style="padding:6px;">${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td></tr>`);
                });

                // Linha de totais
                rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
                rows.push(`<td style="padding:6px;" colspan="2"><strong>Total</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalAreaDecl, 2)} ha</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercentDecl, 2)}%</strong></td>`);
                rows.push(`</tr>`);

                rows.push('</tbody></table>');
                rows.push('</div>');
            }
        }

        // ===== TABELA DE APTIDÃO (se houver) =====
        if (typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.analysisResults && Aptidao.state.analysisResults.length > 0) {
            const aptidaoResult = Aptidao.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);

            if (aptidaoResult && aptidaoResult.relatorio && aptidaoResult.relatorio.classes) {
                rows.push('<div style="margin-bottom: 12px;">')
                rows.push('<h5 style="color: #60d5ff; margin-bottom: 10px; font-size: 13px;">✨ Aptidão</h5>');
                rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0; font-size:11px;">Critério</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                rows.push('<tbody>');

                let totalAreaApti = 0;
                let totalPercentApti = 0;

                Object.entries(aptidaoResult.relatorio.classes).forEach(([key, info]) => {
                    const classNum = key.replace('Classe ', '');
                    if (classNum === '0') return;
                    const color = Aptidao.CORES_APTIDAO[classNum] || '#CCCCCC';
                    const descCompleta = info.descricao_completa || Aptidao.DESCRICOES_APTIDAO[parseInt(classNum)] || '';

                    totalAreaApti += parseFloat(info.area_ha) || 0;
                    totalPercentApti += parseFloat(info.percentual) || 0;

                    rows.push(`<tr title="${descCompleta}"><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${info.descricao}</td><td style="padding:6px; font-size:11px; color:#91a0c0;">${descCompleta}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td></tr>`);
                });

                // Linha de totais
                rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
                rows.push(`<td style="padding:6px;" colspan="2"><strong>Total</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalAreaApti, 2)} ha</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercentApti, 2)}%</strong></td>`);
                rows.push(`</tr>`);

                rows.push('</tbody></table>');
                rows.push('</div>');
            }
        }

        // ===== TABELA DE SOLO TEXTURAL (se houver) =====
        if (typeof SoloTextural !== 'undefined' && SoloTextural.state && SoloTextural.state.analysisResults && SoloTextural.state.analysisResults.length > 0) {
            const stxResult = SoloTextural.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
            if (stxResult && stxResult.relatorio && stxResult.relatorio.classes) {
                hasContent = true;
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push('<h5 style="color: #60d5ff; margin-bottom: 10px; font-size: 13px;">🪨 Textura do Solo</h5>');
                rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                rows.push('<tbody>');

                let totalAreaStx = 0;
                let totalPercentStx = 0;

                Object.entries(stxResult.relatorio.classes).forEach(([key, info]) => {
                    const classNum = key.replace('Classe ', '');
                    if (classNum === '0') return;
                    const color = SoloTextural.CORES_SOLO_TEXTURAL[classNum] || '#CCCCCC';

                    totalAreaStx += parseFloat(info.area_ha) || 0;
                    totalPercentStx += parseFloat(info.percentual) || 0;

                    rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td></tr>`);
                });

                rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
                rows.push(`<td style="padding:6px;"><strong>Total</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalAreaStx, 2)} ha</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercentStx, 2)}%</strong></td>`);
                rows.push(`</tr>`);
                rows.push('</tbody></table>');
                rows.push('</div>');
            }
        }

        // ===== TABELA DE EMBARGO IBAMA (se houver) =====
        if (typeof Embargo !== 'undefined' && Embargo.state && Embargo.state.analysisResults && Embargo.state.analysisResults.length > 0) {
            const embargoResult = Embargo.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
            if (embargoResult && embargoResult.relatorio) {
                const rel = embargoResult.relatorio;
                const corBadge = rel.possui_embargo ? '#de0004' : '#028b00';
                const txtBadge = rel.possui_embargo ? '⚠️ EMBARGO IBAMA' : '✅ SEM EMBARGO';
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push(`<h5 style="color: #de0004; margin-bottom: 8px; font-size: 13px;">🔴 Embargo IBAMA</h5>`);
                rows.push(`<div style="margin-bottom:8px;"><span style="background:${corBadge};color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:bold;">${txtBadge}</span></div>`);
                rows.push(`<div style="font-size:12px; color:#91a0c0; margin-bottom:6px;">Área Embargada: <strong style="color:${corBadge};">${rel.area_embargada_ha_formatado || '0,0000 ha'} (${rel.area_embargada_percentual_formatado || '0,00%'})</strong> &nbsp;|&nbsp; Nº Embargos: <strong>${rel.numero_embargoes || 0}</strong></div>`);
                if (embargoResult.embargoes && embargoResult.embargoes.length > 0) {
                    rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:11px;">');
                    rows.push('<thead><tr><th style="text-align:left;padding:4px;color:#91a0c0;">Nº TAD</th><th style="text-align:left;padding:4px;color:#91a0c0;">Data</th><th style="text-align:left;padding:4px;color:#91a0c0;">Infração</th><th style="text-align:right;padding:4px;color:#91a0c0;">Área Sobr. (ha)</th><th style="text-align:right;padding:4px;color:#91a0c0;">%</th></tr></thead>');
                    rows.push('<tbody>');
                    embargoResult.embargoes.forEach(emb => {
                        rows.push(`<tr><td style="padding:4px;">${emb.num_tad || '—'}</td><td style="padding:4px;">${emb.dat_embarg || '—'}</td><td style="padding:4px;font-size:10px;">${emb.des_infrac || '—'}</td><td style="padding:4px;text-align:right;">${emb.area_sobreposta_ha_formatado || '—'}</td><td style="padding:4px;text-align:right;">${emb.percentual_sobreposicao_formatado || '—'}</td></tr>`);
                    });
                    rows.push('</tbody></table>');
                }
                rows.push('</div>');
            }
        }

        // ===== TABELA DE EMBARGO ICMBIO (se houver) =====
        if (typeof ICMBIO !== 'undefined' && ICMBIO.state && ICMBIO.state.analysisResults && ICMBIO.state.analysisResults.length > 0) {
            const icmbioResult = ICMBIO.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
            if (icmbioResult && icmbioResult.relatorio) {
                const rel = icmbioResult.relatorio;
                const corBadge = rel.possui_embargo ? '#0066cc' : '#028b00';
                const txtBadge = rel.possui_embargo ? '⚠️ EMBARGO ICMBIO' : '✅ SEM EMBARGO ICMBIO';
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push(`<h5 style="color: #0066cc; margin-bottom: 8px; font-size: 13px;">🔵 Embargo ICMBio</h5>`);
                rows.push(`<div style="margin-bottom:8px;"><span style="background:${corBadge};color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:bold;">${txtBadge}</span></div>`);
                rows.push(`<div style="font-size:12px; color:#91a0c0; margin-bottom:6px;">Área Embargada: <strong style="color:${corBadge};">${rel.area_embargada_ha_formatado || '0,0000 ha'} (${rel.area_embargada_percentual_formatado || '0,00%'})</strong> &nbsp;|&nbsp; Nº Embargos: <strong>${rel.numero_embargoes || 0}</strong></div>`);
                if (icmbioResult.embargoes && icmbioResult.embargoes.length > 0) {
                    rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:11px;">');
                    rows.push('<thead><tr><th style="text-align:left;padding:4px;color:#91a0c0;">Nº Embargo</th><th style="text-align:left;padding:4px;color:#91a0c0;">Data</th><th style="text-align:left;padding:4px;color:#91a0c0;">Tipo</th><th style="text-align:left;padding:4px;color:#91a0c0;">Infração</th><th style="text-align:right;padding:4px;color:#91a0c0;">Área Sobr. (ha)</th><th style="text-align:right;padding:4px;color:#91a0c0;">%</th></tr></thead>');
                    rows.push('<tbody>');
                    icmbioResult.embargoes.forEach(emb => {
                        rows.push(`<tr><td style="padding:4px;">${emb.numero_emb || '—'}</td><td style="padding:4px;">${emb.data_embargo || '—'}</td><td style="padding:4px;font-size:10px;">${emb.tipo_infra || '—'}</td><td style="padding:4px;font-size:10px;">${emb.desc_infra || '—'}</td><td style="padding:4px;text-align:right;">${emb.area_sobreposta_ha_formatado || '—'}</td><td style="padding:4px;text-align:right;">${emb.percentual_sobreposicao_formatado || '—'}</td></tr>`);
                    });
                    rows.push('</tbody></table>');
                }
                rows.push('</div>');
            }
        }

        // ===== TABELA DE CLIMA KÖPPEN-GEIGER (se houver) =====
        if (typeof Koppen !== 'undefined' && Koppen.state && Koppen.state.analysisResults && Koppen.state.analysisResults.length > 0) {
            const koppenResult = Koppen.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
            if (koppenResult && koppenResult.relatorio && koppenResult.relatorio.classes) {
                hasContent = true;
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push('<h5 style="color: #ff9800; margin-bottom: 10px; font-size: 13px;">🌡️ Classificação Climática — Köppen-Geiger</h5>');
                rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                rows.push('<tbody>');

                let totalAreaKoppen = 0;
                let totalPercentKoppen = 0;

                Object.entries(koppenResult.relatorio.classes).forEach(([key, info]) => {
                    const classNum = key.replace('Classe ', '');
                    if (classNum === '0') return;
                    const color = Koppen.CORES_KOPPEN[classNum] || '#CCCCCC';

                    totalAreaKoppen += parseFloat(info.area_ha) || 0;
                    totalPercentKoppen += parseFloat(info.percentual) || 0;

                    rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td></tr>`);
                });

                rows.push(`<tr style="background: rgba(255, 152, 0, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
                rows.push(`<td style="padding:6px;"><strong>Total</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalAreaKoppen, 2)} ha</strong></td>`);
                rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercentKoppen, 2)}%</strong></td>`);
                rows.push(`</tr>`);
                rows.push('</tbody></table>');
                rows.push('</div>');
            }

            // Dados climáticos do Excel Köppen (temperatura, precipitação, altitude)
            const dadosClima = koppenResult ? koppenResult.dados_climaticos : null;
            if (dadosClima) {
                hasContent = true;
                rows.push('<div class="climatogram-section" style="margin-top: 12px;">');
                rows.push('<h5 style="color: #ff9800; margin-bottom: 10px; font-size: 13px;">📊 Dados Climáticos — ' + dadosClima.municipio + '/' + dadosClima.uf + '</h5>');
                rows.push('<div class="climate-summary" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; font-size: 12px;">');
                rows.push('<div><span style="color:#91a0c0;">Köppen Dominante:</span> <strong>' + dadosClima.koppen_dominante + '</strong></div>');
                rows.push('<div><span style="color:#91a0c0;">Altitude Média:</span> <strong>' + dadosClima.altitude_m.toFixed(0) + ' m</strong></div>');
                rows.push('<div><span style="color:#91a0c0;">Temp. Média Anual:</span> <strong>' + dadosClima.temperatura_media_anual.toFixed(1) + ' °C</strong></div>');
                rows.push('<div><span style="color:#91a0c0;">Precip. Total Anual:</span> <strong>' + dadosClima.precipitacao_total_anual.toFixed(0) + ' mm</strong></div>');
                rows.push('</div>');
                rows.push('<div class="climatogram-chart-container"><canvas id="koppenClimatogramMaximized"></canvas></div>');
                rows.push('</div>');
            }
        }

        // ===== TABELA PRODES/EUDR (se houver) =====
        if (typeof Prodes !== 'undefined' && Prodes.state && Prodes.state.analysisResults && Prodes.state.analysisResults.length > 0) {
            const prodesResult = Prodes.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
            if (prodesResult && prodesResult.eudr) {
                hasContent = true;
                const eudr = prodesResult.eudr;
                const breakdown = eudr.risk_breakdown || {};
                const statusColor = eudr.eudr_compliant ? '#028b00' : '#de0004';
                const statusText = eudr.eudr_compliant ? '✅ CONFORME EUDR' : '⚠️ NÃO CONFORME EUDR';
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push('<h5 style="color: #4caf50; margin-bottom: 10px; font-size: 13px;">🌳 PRODES — Conformidade EUDR</h5>');
                rows.push(`<div style="margin-bottom:8px;"><span style="background:${statusColor};color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:bold;">${statusText}</span></div>`);
                rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Nível de Risco</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                rows.push('<tbody>');
                const order = ['HIGH_RISK', 'EUDR_MARKER', 'ATTENTION', 'CONSOLIDATED', 'SAFE'];
                for (const level of order) {
                    const item = breakdown[level];
                    if (!item) continue;
                    rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${item.color || '#CCCCCC'};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${item.label}</td><td style="padding:6px;text-align:right;">${APP.formatNumberPTBR(item.area_ha || 0, 4)} ha</td><td style="padding:6px;text-align:right;">${item.percentual_formatado || APP.formatNumberPTBR(item.percentual || 0, 2) + '%'}</td></tr>`);
                }
                rows.push('</tbody></table>');
                rows.push('</div>');
            }
        }

        // ===== TABELA SOLOS EMBRAPA SiBCS (se houver) =====
        if (typeof Solos !== 'undefined' && Solos.state && Solos.state.analysisResults && Solos.state.analysisResults.length > 0) {
            const solosResult = Solos.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
            if (solosResult && solosResult.relatorio) {
                hasContent = true;
                const relS = solosResult.relatorio;
                rows.push('<div style="margin-bottom: 12px;">');
                rows.push('<h5 style="color: #d4a76a; margin-bottom: 10px; font-size: 13px;">🪨 Solos Embrapa SiBCS</h5>');

                // Verificar se ha dados efetivos
                if (!relS.classes || relS.classes.length === 0) {
                    rows.push('<div style="font-size: 12px; color: #91a0c0; padding: 8px 0;">Nenhum resultado de solos obtido para esta area.</div>');
                    rows.push('</div>');
                } else {
                    // Solo predominante
                    const sp = relS.solo_predominante;
                    if (sp) {
                        const cor = sp.cor || '#CCCCCC';
                        rows.push(`<div style="margin-bottom:8px; padding:6px 8px; border-left:3px solid ${cor}; background:rgba(0,0,0,0.15); border-radius:4px; font-size:12px;">`);
                        rows.push(`<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;"><div style="width:12px;height:12px;border-radius:2px;background:${cor};flex-shrink:0;"></div><strong>${sp.simbolo || sp.leg_desc}</strong></div>`);
                        rows.push(`<div style="color:#91a0c0; font-size:11px;">${sp.leg_desc || '-'}</div>`);
                        rows.push(`<div style="color:#91a0c0; font-size:11px; margin-top:2px;">Ordem: ${sp.ordem || '-'} | Subordem: ${sp.subordem || '-'} | Grande Grupo: ${sp.grande_grupo || '-'}</div>`);
                        rows.push(`<div style="color:#4fc3f7; font-size:11px; margin-top:4px;"><b>${sp.area_ha_formatado || '-'}</b> | <b>${sp.percentual_formatado || '-'}</b> da gleba</div>`);
                        rows.push('</div>');
                    }

                    // Distribuicao por Ordem
                    const ordens = relS.ordens || [];
                    if (ordens.length > 0) {
                        rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">');
                        rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Ordem SiBCS</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                        rows.push('<tbody>');
                        for (const ord of ordens) {
                            rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${ord.cor || '#CCCCCC'};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${ord.ordem || '-'}</td><td style="padding:6px;text-align:right;">${APP.formatNumberPTBR(ord.area_ha || 0, 4)} ha</td><td style="padding:6px;text-align:right;">${ord.percentual_formatado || '-'}</td></tr>`);
                        }
                        rows.push('</tbody></table>');
                    }

                    // Top 12 Classes Pedologicas
                    const classes = (relS.classes || []).slice(0, 12);
                    if (classes.length > 0) {
                        rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                        rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Cód.</th><th style="text-align:left; padding:6px; color:#91a0c0;">Ordem</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                        rows.push('<tbody>');
                        for (const cls of classes) {
                            rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${cls.cor || '#CCCCCC'};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${cls.simbolo || '-'}</td><td style="padding:6px;">${cls.ordem || '-'}</td><td style="padding:6px;text-align:right;">${cls.area_ha_formatado || '-'}</td><td style="padding:6px;text-align:right;">${cls.percentual_formatado || '-'}</td></tr>`);
                        }
                        rows.push('</tbody></table>');
                    }

                    rows.push('</div>');
                }
            }
        }

        if (hasContent) {
            container.innerHTML = rows.join('');

            // Renderizar climograma no painel maximizado (após inserir o HTML)
            if (typeof Koppen !== 'undefined' && Koppen.state && Koppen.state.analysisResults) {
                const koppenRes = Koppen.state.analysisResults.find(r => r.fileIndex === APP.state.currentPolygonIndex);
                if (koppenRes && koppenRes.dados_climaticos) {
                    setTimeout(() => {
                        Koppen.renderClimatogramOnCanvas('koppenClimatogramMaximized', koppenRes.dados_climaticos);
                    }, 100);
                }
            }
        } else {
            container.innerHTML = '<div style="font-size: 12px; color: #91a0c0;">Nenhuma análise realizada neste polígono.</div>';
        }
    },

    // Atualizar tabela de classes de declividade no painel maximizado
    updateCenterDeclividade: function (decliviDADERelatorio) {
        const container = document.getElementById('floatingClassesTableDeclividade');
        if (!container) return;

        if (!decliviDADERelatorio || !decliviDADERelatorio.classes) {
            container.innerHTML = '<div style="font-size: 12px; color: #91a0c0;">Nenhuma informação de classes de declividade disponível</div>';
            return;
        }

        const rows = [];
        rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
        rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0;">Descrição</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
        rows.push('<tbody>');

        let totalAreaDecl = 0;
        let totalPercentDecl = 0;

        Object.entries(decliviDADERelatorio.classes).forEach(([key, info]) => {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') return;
            const color = DecliviDADE.CORES_DECLIVIDADE[classNum] || '#CCCCCC';

            totalAreaDecl += parseFloat(info.area_ha) || 0;
            totalPercentDecl += parseFloat(info.percentual) || 0;

            rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${classNum}</td><td style="padding:6px;">${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td></tr>`);
        });

        rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
        rows.push(`<td style="padding:6px;" colspan="2"><strong>Total</strong></td>`);
        rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalAreaDecl, 2)} ha</strong></td>`);
        rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercentDecl, 2)}%</strong></td>`);
        rows.push(`</tr>`);
        rows.push('</tbody></table>');

        container.innerHTML = rows.join('');
    },

    // Criar gráfico de declividade para painel maximizado
    updateChartDeclividade: function (decliviDADERelatorio) {
        const canvas = document.getElementById('floatingAreaChartDeclividade');
        if (!canvas) return;

        if (!decliviDADERelatorio || !decliviDADERelatorio.classes) {
            canvas.parentElement.innerHTML = '<p>Sem dados de declividade</p>';
            return;
        }

        const ctx = canvas.getContext('2d');
        const labels = [];
        const data = [];
        const bgColors = [];

        Object.entries(decliviDADERelatorio.classes).forEach(([key, classInfo]) => {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') return;

            labels.push(`${classInfo.descricao}`);
            data.push(parseFloat(classInfo.area_ha) || 0);
            bgColors.push(DecliviDADE.CORES_DECLIVIDADE[classNum] || '#CCCCCC');
        });

        // Destruir gráfico anterior se existir
        if (APP.state.areaChartDeclividade) {
            APP.state.areaChartDeclividade.destroy();
        }

        // Obter cores do tema
        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#91a0c0';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartDeclividade = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderColor: '#263156',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // Criar gráfico de aptidão para painel maximizado
    updateChartAptidao: function (aptidaoRelatorio) {
        const canvas = document.getElementById('maximizedAreaChartAptidao');
        if (!canvas) return;

        if (!aptidaoRelatorio || !aptidaoRelatorio.classes) {
            canvas.parentElement.innerHTML = '<p>Sem dados de aptidão</p>';
            return;
        }

        const ctx = canvas.getContext('2d');
        const labels = [];
        const data = [];
        const bgColors = [];

        Object.entries(aptidaoRelatorio.classes).forEach(([key, classInfo]) => {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') return;

            labels.push(`${classInfo.descricao}`);
            data.push(parseFloat(classInfo.area_ha) || 0);
            bgColors.push(Aptidao.CORES_APTIDAO[classNum] || '#CCCCCC');
        });

        // Destruir gráfico anterior se existir
        if (APP.state.areaChartAptidao) {
            APP.state.areaChartAptidao.destroy();
        }

        // Obter cores do tema
        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#91a0c0';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartAptidao = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderColor: '#263156',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // Criar gráfico de aptidão para painel compacto (modo normal)
    createAreaChartAptidaoCompact: function (aptidaoRelatorio) {
        const canvas = document.getElementById('floatingAreaChartAptidao');
        if (!canvas) return;

        if (!aptidaoRelatorio || !aptidaoRelatorio.classes) {
            canvas.parentElement.innerHTML = '<p>Sem dados de aptidão</p>';
            return;
        }

        const ctx = canvas.getContext('2d');
        const labels = [];
        const data = [];
        const bgColors = [];

        Object.entries(aptidaoRelatorio.classes).forEach(([key, classInfo]) => {
            const classNum = key.replace('Classe ', '');
            if (classNum === '0') return;

            labels.push(`${classInfo.descricao}`);
            data.push(parseFloat(classInfo.area_ha) || 0);
            bgColors.push(Aptidao.CORES_APTIDAO[classNum] || '#CCCCCC');
        });

        // Destruir gráfico anterior se existir
        if (APP.state.areaChartAptidaoCompact) {
            APP.state.areaChartAptidaoCompact.destroy();
        }

        // Obter cores do tema
        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#91a0c0';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        APP.state.areaChartAptidaoCompact = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderColor: '#263156',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10 },
                            color: legendColor,
                            padding: 6,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // === NAVEGAÇÃO DE ABAS ===

    // Alternar entre abas de gráficos
    switchChartTab: function (chartType) {
        // Atualizar estado das abas
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.chart === chartType);
        });

        // Alternar visibilidade dos painéis de gráfico
        const panelSoloUso = document.getElementById('chartPanelSoloUso');
        const panelDeclividade = document.getElementById('chartPanelDeclividade');
        const panelAptidao = document.getElementById('chartPanelAptidao');
        const panelEmbargo = document.getElementById('chartPanelEmbargo');
        const panelICMBio = document.getElementById('chartPanelICMBio');
        const panelSoloTextural = document.getElementById('chartPanelSoloTextural');
        const panelKoppen = document.getElementById('chartPanelKoppen');
        const panelProdes = document.getElementById('chartPanelProdes');
        const panelSolos = document.getElementById('chartPanelSolos');

        // Ocultar todos
        [panelSoloUso, panelDeclividade, panelAptidao, panelEmbargo, panelICMBio, panelSoloTextural, panelKoppen, panelProdes, panelSolos].forEach(p => {
            if (p) { p.style.display = 'none'; p.classList.remove('active'); }
        });

        // Helper: ocultar todos os overlays de análise
        const hideAllOverlays = () => {
            APP.hideSoloUsoOnMap();
            if (typeof DecliviDADE !== 'undefined') DecliviDADE.hideDecliviDADEImageOnMap();
            if (typeof Aptidao !== 'undefined') Aptidao.hideAptidaoImageOnMap();
            if (typeof SoloTextural !== 'undefined') SoloTextural.hideSoloTexturalImageOnMap();
            if (typeof Embargo !== 'undefined') Embargo.hideEmbargoOnMap();
            if (typeof ICMBIO !== 'undefined') ICMBIO.hideICMBioOnMap();
            if (typeof Koppen !== 'undefined') Koppen.hideKoppenImageOnMap();
            if (typeof Prodes !== 'undefined') Prodes.hideProdesImageOnMap();
            if (typeof Solos !== 'undefined') Solos.hideSolosOnMap();
        };

        if (chartType === 'soloUso') {
            if (panelSoloUso) { panelSoloUso.style.display = ''; panelSoloUso.classList.add('active'); }
            hideAllOverlays();
            APP.showSoloUsoOnMap();
        } else if (chartType === 'declividade') {
            if (panelDeclividade) { panelDeclividade.style.display = ''; panelDeclividade.classList.add('active'); }
            hideAllOverlays();
            if (typeof DecliviDADE !== 'undefined') DecliviDADE.showDecliviDADEImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('declividade', polygonIndex);
        } else if (chartType === 'aptidao') {
            if (panelAptidao) { panelAptidao.style.display = ''; panelAptidao.classList.add('active'); }
            hideAllOverlays();
            if (typeof Aptidao !== 'undefined') Aptidao.showAptidaoImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('aptidao', polygonIndex);
        } else if (chartType === 'embargo') {
            if (panelEmbargo) { panelEmbargo.style.display = ''; panelEmbargo.classList.add('active'); }
            hideAllOverlays();
            if (typeof Embargo !== 'undefined') Embargo.showEmbargoOnMap();
            if (typeof ICMBIO !== 'undefined') ICMBIO.showICMBioOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('embargo', polygonIndex);
        } else if (chartType === 'icmbio') {
            if (panelICMBio) { panelICMBio.style.display = ''; panelICMBio.classList.add('active'); }
            hideAllOverlays();
            if (typeof Embargo !== 'undefined') Embargo.showEmbargoOnMap();
            if (typeof ICMBIO !== 'undefined') ICMBIO.showICMBioOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('icmbio', polygonIndex);
        } else if (chartType === 'soloTextural') {
            if (panelSoloTextural) { panelSoloTextural.style.display = ''; panelSoloTextural.classList.add('active'); }
            hideAllOverlays();
            if (typeof SoloTextural !== 'undefined') SoloTextural.showSoloTexturalImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('soloTextural', polygonIndex);
        } else if (chartType === 'koppen') {
            if (panelKoppen) { panelKoppen.style.display = ''; panelKoppen.classList.add('active'); }
            hideAllOverlays();
            if (typeof Koppen !== 'undefined') Koppen.showKoppenImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('koppen', polygonIndex);
        } else if (chartType === 'prodes') {
            if (panelProdes) { panelProdes.style.display = ''; panelProdes.classList.add('active'); }
            hideAllOverlays();
            if (typeof Prodes !== 'undefined') Prodes.showProdesImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('prodes', polygonIndex);
        } else if (chartType === 'solos') {
            if (panelSolos) { panelSolos.style.display = ''; panelSolos.classList.add('active'); }
            hideAllOverlays();
            if (typeof Solos !== 'undefined') Solos.showSolosOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('solos', polygonIndex);
        }
    },

    // Configurar toggle de visualização entre Solo e Declividade e Aptidão
    setupVisualizationToggle: function (polygonIndex) {
        // Verificar se há análise de declividade
        const hasDecliviDADE = DecliviDADE && DecliviDADE.state.analysisResults &&
            DecliviDADE.state.analysisResults.length > 0;

        // Verificar se há análise de aptidão
        const hasAptidao = typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.analysisResults &&
            Aptidao.state.analysisResults.length > 0;

        // Verificar se há análise de embargo
        const hasEmbargo = typeof Embargo !== 'undefined' && Embargo.state && Embargo.state.analysisResults &&
            Embargo.state.analysisResults.length > 0;

        // Verificar se há análise ICMBio
        const hasICMBio = typeof ICMBIO !== 'undefined' && ICMBIO.state && ICMBIO.state.analysisResults &&
            ICMBIO.state.analysisResults.length > 0;

        // Verificar se há análise de solo textural
        const hasSoloTextural = typeof SoloTextural !== 'undefined' && SoloTextural.state && SoloTextural.state.analysisResults &&
            SoloTextural.state.analysisResults.length > 0;

        // Verificar se há análise de Köppen
        const hasKoppen = typeof Koppen !== 'undefined' && Koppen.state && Koppen.state.analysisResults &&
            Koppen.state.analysisResults.length > 0;

        // Verificar se há análise PRODES/EUDR
        const hasProdes = typeof Prodes !== 'undefined' && Prodes.state && Prodes.state.analysisResults &&
            Prodes.state.analysisResults.length > 0;

        // Verificar se há análise de Solos Embrapa
        const hasSolos = typeof Solos !== 'undefined' && Solos.state && Solos.state.analysisResults &&
            Solos.state.analysisResults.length > 0;

        const tabDeclividade = document.getElementById('tabDeclividade');
        const tabAptidao = document.getElementById('tabAptidao');
        const tabEmbargo = document.getElementById('tabEmbargo');
        const tabICMBio = document.getElementById('tabICMBio');
        const tabSoloTextural = document.getElementById('tabSoloTextural');
        const tabKoppen = document.getElementById('tabKoppen');
        const tabProdes = document.getElementById('tabProdes');
        const tabSolos = document.getElementById('tabSolos');

        const tabSolo = document.getElementById('tabSoloUso');

        let hasSolo = false;
        if (tabSolo) {
            hasSolo = APP.state.analysisResults && APP.state.analysisResults[polygonIndex] && APP.state.analysisResults[polygonIndex].relatorio;
            if (hasSolo) {
                tabSolo.style.display = 'flex';
                const soloRes = APP.state.analysisResults[polygonIndex];
                if (soloRes && soloRes.relatorio) {
                    this.createAreaChart(soloRes.relatorio.classes);
                }
            } else {
                tabSolo.style.display = 'none';
            }
        }

        if (tabDeclividade) {
            if (hasDecliviDADE) {
                tabDeclividade.style.display = 'flex';
                // Gráfico atualizado ao clicar na aba
            } else {
                tabDeclividade.style.display = 'none';
            }
        }

        if (tabAptidao) {
            tabAptidao.style.display = hasAptidao ? 'flex' : 'none';
        }

        if (tabEmbargo) {
            tabEmbargo.style.display = hasEmbargo ? 'flex' : 'none';
        }

        if (tabICMBio) {
            tabICMBio.style.display = hasICMBio ? 'flex' : 'none';
        }

        if (tabSoloTextural) {
            if (hasSoloTextural) {
                tabSoloTextural.style.display = 'flex';
                const stxRes = SoloTextural.state.analysisResults[polygonIndex] || SoloTextural.state.analysisResults[0];
                if (stxRes && stxRes.relatorio) {
                    this.createAreaChartSoloTextural(stxRes.relatorio.classes);
                }
            } else {
                tabSoloTextural.style.display = 'none';
            }
        }

        if (tabKoppen) {
            if (hasKoppen) {
                tabKoppen.style.display = 'flex';
                const kopRes = Koppen.state.analysisResults[polygonIndex] || Koppen.state.analysisResults[0];
                if (kopRes && kopRes.relatorio) {
                    this.createAreaChartKoppen(kopRes.relatorio.classes);
                }
            } else {
                tabKoppen.style.display = 'none';
            }
        }

        if (tabProdes) {
            if (hasProdes) {
                tabProdes.style.display = 'flex';
                const prodesRes = Prodes.state.analysisResults[polygonIndex] || Prodes.state.analysisResults[0];
                if (prodesRes && prodesRes.eudr) {
                    this.createAreaChartProdes(prodesRes);
                }
            } else {
                tabProdes.style.display = 'none';
            }
        }

        if (tabSolos) {
            if (hasSolos) {
                tabSolos.style.display = 'flex';
                const solosRes = Solos.state.analysisResults[polygonIndex] || Solos.state.analysisResults[0];
                if (solosRes && solosRes.relatorio) {
                    this.createAreaChartSolos(solosRes);
                }
            } else {
                tabSolos.style.display = 'none';
            }
        }

        // Reordenar abas visualmente conforme a ordem de ativação dos módulos
        const tabMap = {
            'soloUso':       document.querySelector('[data-chart="soloUso"]'),
            'declividade':   document.getElementById('tabDeclividade'),
            'aptidao':       document.getElementById('tabAptidao'),
            'embargo':       document.getElementById('tabEmbargo'),
            'icmbio':        document.getElementById('tabICMBio'),
            'soloTextural':  document.getElementById('tabSoloTextural'),
            'koppen':        document.getElementById('tabKoppen'),
            'prodes':        document.getElementById('tabProdes'),
            'solos':         document.getElementById('tabSolos'),
        };
        const order = (APP.state && APP.state.analysisOrder) ? APP.state.analysisOrder : [];
        Object.values(tabMap).forEach(t => { if (t) t.style.order = '99'; });
        order.forEach((type, idx) => {
            const tab = tabMap[type];
            if (tab) tab.style.order = String(idx + 1);
        });

        // Definir aba ativa padrão: última análise executada, ou a primeira disponível
        const lastType = order.length > 0 ? order[order.length - 1] : null;
        if (lastType && tabMap[lastType]) {
            this.switchChartTab(lastType);
        } else if (hasSolo) {
            this.switchChartTab('soloUso');
        } else if (hasDecliviDADE) {
            this.switchChartTab('declividade');
        } else if (hasAptidao) {
            this.switchChartTab('aptidao');
        } else if (hasEmbargo) {
            this.switchChartTab('embargo');
        } else if (hasICMBio) {
            this.switchChartTab('icmbio');
        } else if (hasSoloTextural) {
            this.switchChartTab('soloTextural');
        } else if (hasKoppen) {
            this.switchChartTab('koppen');
        } else if (hasProdes) {
            this.switchChartTab('prodes');
        } else if (hasSolos) {
            this.switchChartTab('solos');
        }

        // Atualizar tabela central (maximizada) com os dados de todas as análises
        this.updateCenter();
    },

    // Alternar visualização entre Uso do Solo e Declividade (mantido para compatibilidade)
    switchVisualization: function (type, polygonIndex) {
        // Redirecionar para a nova função de abas
        this.switchChartTab(type === 'soloUso' ? 'soloUso' : 'declividade');
    },

    // Atualizar coluna central com dados de solo, declividade ou aptidão
    updateCenterForType: function (type, polygonIndex) {
        // Redireciona tudo para a criadora mestre
        this.updateCenter();
    },

    // Atualizar gráfico com dados de solo, declividade ou aptidão
    updateChartForType: function (type, polygonIndex) {
        if (type === 'soloUso') {
            const result = APP.state.analysisResults[polygonIndex];
            if (result && result.relatorio) {
                this.createAreaChart(result.relatorio.classes);
            }
        } else if (type === 'declividade') {
            const decliviDADEResult = DecliviDADE.state.analysisResults[polygonIndex] || DecliviDADE.state.analysisResults[0];
            if (decliviDADEResult && decliviDADEResult.relatorio) {
                this.updateChartDeclividade(decliviDADEResult.relatorio);
            }
        } else if (type === 'aptidao') {
            if (typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.analysisResults) {
                const aptidaoResult = Aptidao.state.analysisResults[polygonIndex] || Aptidao.state.analysisResults[0];
                if (aptidaoResult && aptidaoResult.relatorio) {
                    this.createAreaChartAptidaoCompact(aptidaoResult.relatorio);
                }
            }
        } else if (type === 'embargo') {
            if (typeof Embargo !== 'undefined' && Embargo.state && Embargo.state.analysisResults) {
                const embargoResult = Embargo.state.analysisResults[polygonIndex] || Embargo.state.analysisResults[0];
                if (embargoResult && embargoResult.relatorio) {
                    this.createAreaChartEmbargo(embargoResult.relatorio);
                }
            }
        } else if (type === 'icmbio') {
            if (typeof ICMBIO !== 'undefined' && ICMBIO.state && ICMBIO.state.analysisResults) {
                const icmbioResult = ICMBIO.state.analysisResults[polygonIndex] || ICMBIO.state.analysisResults[0];
                if (icmbioResult && icmbioResult.relatorio) {
                    this.createAreaChartICMBio(icmbioResult.relatorio);
                }
            }
        } else if (type === 'soloTextural') {
            if (typeof SoloTextural !== 'undefined' && SoloTextural.state && SoloTextural.state.analysisResults) {
                const stxResult = SoloTextural.state.analysisResults[polygonIndex] || SoloTextural.state.analysisResults[0];
                if (stxResult && stxResult.relatorio) {
                    this.createAreaChartSoloTextural(stxResult.relatorio.classes);
                }
            }
        } else if (type === 'koppen') {
            if (typeof Koppen !== 'undefined' && Koppen.state && Koppen.state.analysisResults) {
                const kopResult = Koppen.state.analysisResults[polygonIndex] || Koppen.state.analysisResults[0];
                if (kopResult && kopResult.relatorio) {
                    // Preencher informações de clima predominante
                    this.updateKoppenClimateInfo(kopResult);
                }
                // Renderizar climograma compacto se dados climáticos disponíveis
                const compactContainer = document.getElementById('koppenClimatogramCompact');
                if (kopResult && kopResult.dados_climaticos && compactContainer) {
                    compactContainer.style.display = 'block';
                    setTimeout(() => {
                        Koppen.renderClimatogramOnCanvas('koppenClimatogramCompactCanvas', kopResult.dados_climaticos);
                    }, 150);
                } else if (compactContainer) {
                    compactContainer.style.display = 'none';
                }
            }
        } else if (type === 'prodes') {
            if (typeof Prodes !== 'undefined' && Prodes.state && Prodes.state.analysisResults) {
                const prodesResult = Prodes.state.analysisResults[polygonIndex] || Prodes.state.analysisResults[0];
                if (prodesResult && prodesResult.eudr) {
                    this.createAreaChartProdes(prodesResult);
                }
            }
        } else if (type === 'solos') {
            if (typeof Solos !== 'undefined' && Solos.state && Solos.state.analysisResults) {
                const solosResult = Solos.state.analysisResults[polygonIndex] || Solos.state.analysisResults[0];
                if (solosResult && solosResult.relatorio) {
                    this.createAreaChartSolos(solosResult);
                }
            }
        }
    },

    createAreaChartICMBio: function (relatorio, canvasId = 'floatingAreaChartICMBio') {
        if (APP.state.areaChartICMBio) {
            APP.state.areaChartICMBio.destroy();
            APP.state.areaChartICMBio = null;
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const areaTotal = relatorio.area_total_poligono_ha || 0;
        const areaEmb = relatorio.area_embargada_ha || 0;
        const areaLivre = Math.max(0, areaTotal - areaEmb);
        const possui = relatorio.possui_embargo;

        const currentTheme = document.body.getAttribute('data-theme');
        const isLight = currentTheme === 'light';
        const legendColor = isLight ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,31,58,0.95)';
        const tooltipText = isLight ? '#1a1a1a' : '#ffffff';

        APP.state.areaChartICMBio = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Embargada', 'Livre'],
                datasets: [{
                    data: [areaEmb, areaLivre],
                    backgroundColor: ['#0066cc', '#028b00'],
                    borderWidth: 1,
                    borderColor: '#263156',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { font: { size: 10 }, color: legendColor, padding: 6, boxWidth: 10 },
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = areaTotal > 0 ? ((val / areaTotal) * 100).toFixed(2) : '0.00';
                                return `${context.label}: ${val.toFixed(2)} ha (${pct}%)`;
                            },
                        },
                    },
                    title: {
                        display: true,
                        text: possui ? '⚠️ Embargo ICMBio Identificado' : '✅ Sem Embargo ICMBio',
                        color: possui ? '#0066cc' : '#028b00',
                        font: { size: 12, weight: 'bold' },
                    },
                },
            },
        });
    },

    createAreaChartEmbargo: function (relatorio, canvasId = 'floatingAreaChartEmbargo') {
        if (APP.state.areaChartEmbargo) {
            APP.state.areaChartEmbargo.destroy();
            APP.state.areaChartEmbargo = null;
        }
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext && canvasEl.getContext('2d');
        if (!ctx) return;

        const areaTotal = relatorio.area_total_poligono_ha || 0;
        const areaEmb = relatorio.area_embargada_ha || 0;
        const areaLivre = Math.max(0, areaTotal - areaEmb);
        const possui = relatorio.possui_embargo;

        const currentTheme = document.body.getAttribute('data-theme');
        const isLight = currentTheme === 'light';
        const legendColor = isLight ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,31,58,0.95)';
        const tooltipText = isLight ? '#1a1a1a' : '#ffffff';

        APP.state.areaChartEmbargo = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Embargada', 'Livre'],
                datasets: [{
                    data: [areaEmb, areaLivre],
                    backgroundColor: ['#de0004', '#028b00'],
                    borderWidth: 1,
                    borderColor: '#263156',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { font: { size: 10 }, color: legendColor, padding: 6, boxWidth: 10 },
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = areaTotal > 0 ? ((val / areaTotal) * 100).toFixed(2) : '0.00';
                                return `${context.label}: ${val.toFixed(2)} ha (${pct}%)`;
                            },
                        },
                    },
                    title: {
                        display: true,
                        text: possui ? '⚠️ Embargo Identificado' : '✅ Sem Embargo',
                        color: possui ? '#de0004' : '#028b00',
                        font: { size: 12, weight: 'bold' },
                    },
                },
            },
        });
    },

    /**
     * Atualizar informações de clima predominante na abas de Köppen
     */
    updateKoppenClimateInfo: function (kopResult) {
        const container = document.getElementById('koppenClimateInfo');
        if (!container) return;

        const relatorio = kopResult.relatorio || {};
        const classes = relatorio.classes || {};
        const dados = kopResult.dados_climaticos || {};

        // Encontrar classe com maior área
        let classePrincipal = null;
        let areaMaxima = 0;

        for (const [key, info] of Object.entries(classes)) {
            if (info.area_ha > areaMaxima) {
                areaMaxima = info.area_ha;
                classePrincipal = info;
            }
        }

        if (!classePrincipal && dados.koppen_dominante) {
            // Fallback: usar informação do dados_climaticos
            // koppen_dominante é algo como "Cwa", "Am", etc.
            // Procurar na tabela de nomes a classe correspondente
            let classNum = 1;
            for (let i = 1; i <= 12; i++) {
                if (Koppen.NOMES_KOPPEN[i] && Koppen.NOMES_KOPPEN[i].includes(dados.koppen_dominante)) {
                    classNum = i;
                    break;
                }
            }
            
            const cor = Koppen.CORES_KOPPEN[classNum] || '#CCCCCC';
            const nome = Koppen.NOMES_KOPPEN[classNum] || dados.koppen_dominante;
            
            container.innerHTML = `
                <div class="climate-info-box">
                    <div class="climate-dominant">
                        <span class="climate-color" style="background-color: ${cor}; display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; margin-right: 8px;"></span>
                        <strong>Köppen Dominante:</strong>
                    </div>
                    <div class="climate-class">${dados.koppen_dominante}</div>
                    <div class="climate-description">${nome}</div>
                    ${dados.temperatura_media_anual ? `<div class="climate-stat">🌡️ Temp. Média: ${dados.temperatura_media_anual.toFixed(1)}°C</div>` : ''}
                    ${dados.precipitacao_total_anual ? `<div class="climate-stat">💧 Precip. Anual: ${dados.precipitacao_total_anual.toFixed(0)} mm</div>` : ''}
                </div>
            `;
        } else if (classePrincipal) {
            const descricao = classePrincipal.descricao || 'Classificação';
            const areha = classePrincipal.area_ha_formatado || '0 ha';
            const percentual = classePrincipal.percentual_formatado || '0%';
            
            // Extrar classe numérica da descrição (ex: "Classe 1" -> 1)
            const classNum = parseInt(descricao.replace('Classe ', '')) || 1;
            const cor = Koppen.CORES_KOPPEN[classNum] || '#CCCCCC';
            const nome = Koppen.NOMES_KOPPEN[classNum] || descricao;

            container.innerHTML = `
                <div class="climate-info-box">
                    <div class="climate-dominant">
                        <span class="climate-color" style="background-color: ${cor}; display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; margin-right: 8px;"></span>
                        <strong>Köppen Predominante:</strong>
                    </div>
                    <div class="climate-class">${descricao}</div>
                    <div class="climate-description">${nome}</div>
                    ${dados.temperatura_media_anual ? `<div class="climate-stat">🌡️ Temp. Média: ${dados.temperatura_media_anual.toFixed(1)}°C</div>` : ''}
                    ${dados.precipitacao_total_anual ? `<div class="climate-stat">💧 Precip. Anual: ${dados.precipitacao_total_anual.toFixed(0)} mm</div>` : ''}
                </div>
            `;
        } else {
            container.innerHTML = '<div class="climate-info-box"><p>Sem dados de clima disponíveis</p></div>';
        }
    },

    // === EXPORTAÇÃO KML ===

    /**
     * Exportar análise em formato KML.
     * Genérico: funciona para qualquer tipo de análise registrado no backend.
     * @param {string} analysisType - Chave do tipo de análise (ex: 'uso_solo', 'declividade')
     */
    exportarKML: async function (analysisType) {
        const polygonIndex = APP.state.currentPolygonIndex;

        // Mapeamento: analysis_type → módulo JS que armazena os resultados
        const moduleMap = {
            'uso_solo': () => APP.state.analysisResults,
            'declividade': () => (typeof DecliviDADE !== 'undefined' ? DecliviDADE.state.analysisResults : null),
            'aptidao': () => (typeof Aptidao !== 'undefined' ? Aptidao.state.analysisResults : null),
            'solo_textural': () => (typeof SoloTextural !== 'undefined' ? SoloTextural.state.analysisResults : null),
            'prodes': () => (typeof Prodes !== 'undefined' ? Prodes.state.analysisResults : null),
        };

        // Encontrar os resultados
        let results = null;
        const getResults = moduleMap[analysisType];
        if (getResults) results = getResults();
        
        if (!results) {
            for (const key of Object.keys(moduleMap)) {
                try {
                    const res = moduleMap[key]();
                    if (res && res.length > 0) { results = res; break; }
                } catch (e) { /* ignorar */ }
            }
        }
        if (!results) results = APP.state.analysisResults;

        if (!results || results.length === 0) {
            APP.showStatus('Nenhum dado disponível para exportar.', 'error');
            return;
        }

        // --- 1. Obter polygon_geojson (combinando múltiplos se necessário) ---
        let polygonGeojson = null;
        let selectedResult = null;

        if (polygonIndex === -1) {
            // "Todos os polígonos" - agrupar todas as features em uma FeatureCollection
            let allFeatures = [];
            for (const res of results) {
                if (res.polygon_geojson && res.polygon_geojson.features) {
                    allFeatures = allFeatures.concat(res.polygon_geojson.features);
                }
            }
            if (allFeatures.length > 0) {
                polygonGeojson = {
                    type: "FeatureCollection",
                    features: allFeatures
                };
            }
        } else {
            // APP.state.currentPolygonIndex geralmente é o índice do array em APP.state.analysisResults
            // Precisamos do result.fileIndex que corresponda ao polígono selecionado na interface (APP.state.selectedPolygonIndex)
            const selIdx = APP.state.selectedPolygonIndex;
            
            // Buscar pelo fileIndex correspondente à seleção atual, ou usar de fallback o currentPolygonIndex, ou o primeiro elemento
            if (selIdx >= 0) {
                selectedResult = results.find(r => r.fileIndex === selIdx);
            }
            
            if (!selectedResult) {
                const idx = Math.max(polygonIndex, 0); // fallback
                selectedResult = results[idx] || results[0];
            }

            if (selectedResult && selectedResult.polygon_geojson) {
                polygonGeojson = selectedResult.polygon_geojson;
            }
        }

        if (!polygonGeojson) {
            APP.showStatus('Nenhum polígono disponível para exportação KML.', 'error');
            return;
        }

        // --- 2. Pedir nome do arquivo ---
        const nomeLabels = {
            'uso_solo': 'Uso do Solo',
            'declividade': 'Declividade',
            'aptidao': 'Aptidão Agronômica',
            'solo_textural': 'Textura do Solo',
            'prodes': 'PRODES-EUDR',
        };
        const tipoLabel = nomeLabels[analysisType] || analysisType;

        // Extrair nome base do arquivo atual
        let nomeBase = 'InfoGEO';
        if (polygonIndex === -1) {
            nomeBase = 'InfoGEO_Todos_Poligonos';
        } else if (selectedResult && selectedResult.fileName) {
            nomeBase = selectedResult.fileName.replace(/\.[^.]+$/, '');
        }

        const nomeDefault = `${nomeBase}_${tipoLabel}`;
        const nomeArquivo = prompt(`Nome do arquivo KML (${tipoLabel}):`, nomeDefault);
        if (!nomeArquivo) return; // Cancelou

        const rasterType = localStorage.getItem('rasterType') || 'com_mosaico';

        // --- 3. Enviar para o backend ---
        try {
            APP.showStatus(`Gerando KML de ${tipoLabel}...`, 'info');

            const response = await fetch('/exportar-kml', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysis_type: analysisType,
                    polygon_geojson: polygonGeojson,
                    nome_arquivo: nomeArquivo,
                    raster_type: rasterType
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.mensagem || 'Erro ao gerar KML');
            }

            // --- 4. Download do arquivo ---
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${nomeArquivo}.kml`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            APP.showStatus(`KML "${nomeArquivo}.kml" exportado com sucesso!`, 'success');
        } catch (error) {
            console.error('[KML Export] Erro:', error);
            APP.showStatus(`Erro ao exportar KML: ${error.message}`, 'error');
        }
    },
};
