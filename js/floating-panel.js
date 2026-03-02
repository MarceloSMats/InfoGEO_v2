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
            // this.createAreaChart(soloResult.relatorio.classes, APP.state.sigefExcelInfo, false, 'maximizedAreaChart');
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
            this.createAreaChart(soloResult.relatorio.classes, APP.state.sigefExcelInfo, false, 'floatingAreaChart');
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

    // Criar gráfico no quadro flutuante
    createAreaChart: function (classes, sigefInfo = null, isDeclividade = false, canvasId = 'floatingAreaChart') {
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

        // Preparar dados do SIGEF se disponíveis
        let sigefLabels = [];
        let sigefData = [];
        let sigefColors = [];

        if (sigefInfo && sigefInfo.length > 0) {
            const sigefGrouped = APP.processSigefInfoByType ? APP.processSigefInfoByType(sigefInfo) : {};

            Object.keys(sigefGrouped).forEach(classe => {
                const info = sigefGrouped[classe];
                sigefLabels.push(classe);
                sigefData.push(parseFloat(info.totalArea) || 0);

                // Tentar mapear cores baseado no nome da classe
                const mappedColor = this.mapSigefClassToColor(classe);
                sigefColors.push(mappedColor);
            });
        }

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

        // Adicionar segunda camada se houver dados SIGEF
        if (sigefData.length > 0) {
            this.addSigefLayerToChart(sigefLabels, sigefData, sigefColors);
        }
    },

    // Adicionar camada SIGEF ao gráfico
    addSigefLayerToChart: function (labels, data, colors) {
        if (!APP.state.areaChart) return;

        // Adicionar segundo dataset
        APP.state.areaChart.data.datasets.push({
            label: 'Cadastro BB',
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#1f2748',
            hoverOffset: 8
        });

        // Detectar tema atual
        const currentTheme = document.body.getAttribute('data-theme');
        const isLightTheme = currentTheme === 'light';

        // Cores otimizadas para acessibilidade
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        console.log('addSigefLayerToChart - Tema:', currentTheme, '| Cor legenda:', legendColor);

        // Atualizar legenda para mostrar ambos
        APP.state.areaChart.options.plugins.legend = {
            display: true,
            position: 'bottom',
            labels: {
                color: legendColor,
                font: {
                    size: 11,
                    weight: '600'
                },
                padding: 10,
                generateLabels: function (chart) {
                    const datasets = chart.data.datasets;
                    return datasets.map((dataset, i) => {
                        return {
                            text: dataset.label,
                            fillStyle: dataset.backgroundColor[0],
                            strokeStyle: dataset.borderColor,
                            lineWidth: 1,
                            hidden: false,
                            index: i
                        };
                    });
                }
            }
        };

        // Atualizar tooltip com cores do tema
        APP.state.areaChart.options.plugins.tooltip = {
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
        };

        APP.state.areaChart.update();
    },

    // Mapear classes SIGEF para cores
    mapSigefClassToColor: function (sigefClass) {
        const classUpper = sigefClass.toUpperCase();

        // Mapeamento de palavras-chave para cores
        const colorMapping = {
            'LAVOURA': '#c27ba0',
            'ANUAL': '#c27ba0',
            'PERENE': '#9932cc',
            'PASTAGEM': '#edde8e',
            'CULTIVADA': '#edde8e',
            'NATIVA': '#d6bc74',
            'DEGRADADA': '#d4271e',
            'SILVICULTURA': '#7a5900',
            'FLORESTA': '#7a5900',
            'PRESERVAÇÃO': '#1f8d49',
            'APP': '#1f8d49',
            'RL': '#1f8d49',
            'AQUÁTICA': '#2532e4',
            'LAGO': '#2532e4',
            'RIO': '#2532e4',
            'CONSTRUÇÃO': '#5e5e5e',
            'BENFEITORIA': '#5e5e5e',
            'EDIFICAÇÃO': '#5e5e5e'
        };

        for (const [keyword, color] of Object.entries(colorMapping)) {
            if (classUpper.includes(keyword)) {
                return color;
            }
        }

        return '#CCCCCC'; // Cor padrão
    },

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

    // Atualizar painel esquerdo com informações do imóvel (planilha AMOSTRA_SIGEF)
    updateImovelInfo: function (info) {
        const imovelDiv = document.getElementById('floatingImovelInfo');
        if (!imovelDiv) return;

        let html = '';
        if (!info) {
            imovelDiv.innerHTML = '<div class="sigef-item">Nenhuma informação do imóvel disponível</div>';
            return;
        }

        // info pode ser array (vários registros) ou objeto
        const item = Array.isArray(info) ? info[0] : info;

        const fields = [
            { k: 'COD_NMRO_ICRA', l: 'Código' },
            { k: 'NOM', l: 'Nome' },
            { k: 'NM_MUNICP', l: 'Município' },
            { k: 'QT_AREA_TIP_SOLO', l: 'Área (ha)' },
            { k: 'PROPRIETARIO', l: 'Proprietário' },
            { k: 'TIPO_PROPR', l: 'Tipo' }
        ];

        html += '<div class="sigef-summary">';
        fields.forEach(f => {
            if (item && (item[f.k] !== undefined && item[f.k] !== null)) {
                html += `<div class="sigef-detail-item"><strong>${f.l}:</strong> <span style="margin-left:6px;">${item[f.k]}</span></div>`;
            }
        });
        html += '</div>';

        imovelDiv.innerHTML = html;
    },

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
        const resultSolo = APP.state.analysisResults ? APP.state.analysisResults[APP.state.currentPolygonIndex] : null;
        if (resultSolo && resultSolo.relatorio && resultSolo.relatorio.classes && Object.keys(resultSolo.relatorio.classes).length > 0) {
            hasContent = true;
            // reduzir espaçamento para organizar melhor as tabelas
            rows.push('<div style="margin-bottom: 12px;">')
            rows.push('<h5 style="color: #60d5ff; margin-bottom: 10px; font-size: 13px;">📊 Uso do Solo</h5>');
            rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
            rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0;">Descrição</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th><th style="text-align:right; padding:6px; color:#91a0c0;">Valor</th></tr></thead>');
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
                totalValue += parseFloat(info.valor_calculado) || 0;

                rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${classNum}</td><td style="padding:6px;">${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td><td style="padding:6px;text-align:right;">${info.valor_calculado_formatado !== undefined ? info.valor_calculado_formatado : (info.valor_calculado !== undefined ? info.valor_calculado : '-')}</td></tr>`);
            });

            rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
            rows.push(`<td style="padding:6px;" colspan="2"><strong>Total</strong></td>`);
            rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalArea, 2)} ha</strong></td>`);
            rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatNumberPTBR(totalPercent, 2)}%</strong></td>`);
            rows.push(`<td style="padding:6px;text-align:right;"><strong>${APP.formatCurrencyPTBR(totalValue)}</strong></td>`);
            rows.push(`</tr>`);
            rows.push('</tbody></table>');
            rows.push('</div>');
        }

        // ===== TABELA DE DECLIVIDADE (se houver) =====
        if (DecliviDADE && DecliviDADE.state.analysisResults && DecliviDADE.state.analysisResults.length > 0) {
            const decliviDADEResult = DecliviDADE.state.analysisResults[APP.state.currentPolygonIndex] || DecliviDADE.state.analysisResults[0];

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
            const aptidaoResult = Aptidao.state.analysisResults[APP.state.currentPolygonIndex] || Aptidao.state.analysisResults[0];

            if (aptidaoResult && aptidaoResult.relatorio && aptidaoResult.relatorio.classes) {
                rows.push('<div style="margin-bottom: 12px;">')
                rows.push('<h5 style="color: #60d5ff; margin-bottom: 10px; font-size: 13px;">✨ Aptidão</h5>');
                rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
                rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0;">Descrição</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th></tr></thead>');
                rows.push('<tbody>');

                let totalAreaApti = 0;
                let totalPercentApti = 0;

                Object.entries(aptidaoResult.relatorio.classes).forEach(([key, info]) => {
                    const classNum = key.replace('Classe ', '');
                    if (classNum === '0') return;
                    const color = Aptidao.CORES_APTIDAO[classNum] || '#CCCCCC';

                    totalAreaApti += parseFloat(info.area_ha) || 0;
                    totalPercentApti += parseFloat(info.percentual) || 0;

                    rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${classNum}</td><td style="padding:6px;">${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td></tr>`);
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

        if (hasContent) {
            container.innerHTML = rows.join('');
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

        if (chartType === 'soloUso') {
            if (panelSoloUso) { panelSoloUso.style.display = ''; panelSoloUso.classList.add('active'); }
            if (panelDeclividade) { panelDeclividade.style.display = 'none'; panelDeclividade.classList.remove('active'); }
            if (panelAptidao) { panelAptidao.style.display = 'none'; panelAptidao.classList.remove('active'); }
            if (typeof DecliviDADE !== 'undefined') DecliviDADE.hideDecliviDADEImageOnMap();
            if (typeof Aptidao !== 'undefined') Aptidao.hideAptidaoImageOnMap();
            MAP.showRasters();
        } else if (chartType === 'declividade') {
            if (panelSoloUso) { panelSoloUso.style.display = 'none'; panelSoloUso.classList.remove('active'); }
            if (panelDeclividade) { panelDeclividade.style.display = ''; panelDeclividade.classList.add('active'); }
            if (panelAptidao) { panelAptidao.style.display = 'none'; panelAptidao.classList.remove('active'); }
            MAP.hideRasters();
            if (typeof Aptidao !== 'undefined') Aptidao.hideAptidaoImageOnMap();
            if (typeof DecliviDADE !== 'undefined') DecliviDADE.showDecliviDADEImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('declividade', polygonIndex);
        } else if (chartType === 'aptidao') {
            if (panelSoloUso) { panelSoloUso.style.display = 'none'; panelSoloUso.classList.remove('active'); }
            if (panelDeclividade) { panelDeclividade.style.display = 'none'; panelDeclividade.classList.remove('active'); }
            if (panelAptidao) { panelAptidao.style.display = ''; panelAptidao.classList.add('active'); }
            MAP.hideRasters();
            if (typeof DecliviDADE !== 'undefined') DecliviDADE.hideDecliviDADEImageOnMap();
            if (typeof Aptidao !== 'undefined') Aptidao.showAptidaoImageOnMap();

            const polygonIndex = Math.max(APP.state.currentPolygonIndex, 0);
            this.updateChartForType('aptidao', polygonIndex);
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

        const tabDeclividade = document.getElementById('tabDeclividade');
        const tabAptidao = document.getElementById('tabAptidao');

        const tabSolo = document.getElementById('tabSoloUso');

        let hasSolo = false;
        if (tabSolo) {
            hasSolo = APP.state.analysisResults && APP.state.analysisResults[polygonIndex] && APP.state.analysisResults[polygonIndex].relatorio;
            if (hasSolo) {
                tabSolo.style.display = 'flex';
                const soloRes = APP.state.analysisResults[polygonIndex];
                if (soloRes && soloRes.relatorio) {
                    this.createAreaChart(soloRes.relatorio.classes, APP.state.sigefExcelInfo);
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
            if (hasAptidao) {
                tabAptidao.style.display = 'flex';
            } else {
                tabAptidao.style.display = 'none';
            }
        }

        // Definir aba padrão automaticamente para a primeira análise disponível
        if (hasSolo) {
            this.switchChartTab('soloUso');
        } else if (hasDecliviDADE) {
            this.switchChartTab('declividade');
        } else if (hasAptidao) {
            this.switchChartTab('aptidao');
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
                this.createAreaChart(result.relatorio.classes, APP.state.sigefExcelInfo);
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
        }
    }
};
