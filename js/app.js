// Aplicação principal
const APP = {
    // SUBSTITUA o state existente por:
    state: {
        features: [],
        currentFiles: [],
        currentRasterFile: null,
        analysisResults: [],
        areaChart: null,
        areaChartDeclividade: null,
        areaChartAptidao: null,
        rasterType: 'default',
        currentRasterInfo: {
            name: 'Padrão do sistema',
            resolution: '-',
            pixelArea: '-'
        },
        currentPolygonIndex: -1,
        allRastersLoaded: false,
        drawnPolygon: null,
        currentCentroid: '',

        currentCodigoImo: null,
        // === NOVOS ESTADOS ADICIONADOS ===
        batchOutputDir: null,
        analysisCache: new Map(),
        searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
        settings: JSON.parse(localStorage.getItem('appSettings') || '{}'),
        isPanelPinned: false,
        searchTimeout: null,
        valoracaoCache: null,
        valoracaoFiles: [],
        valoracaoFeatures: []
    },

    // Inicialização
    // SUBSTITUA a função init por:
    init: function () {
        this.loadTheme(); // Carregar tema antes de tudo
        this.loadUserPreferences(); // NOVA LINHA

        // Garantindo inicialização imediata do MAPA
        try {
            MAP.initLeaflet();
            MAP.showMapBase();
        } catch (e) {
            console.error('Falha ao inicializar Leaflet: ', e);
        }

        this.setupEventListeners();
        SEARCH.init(); // Inicializar busca

        const satTextEl = document.getElementById('satelliteDateText');
        if (satTextEl) satTextEl.textContent = 'n/a';
        this.updateRasterInfo();
        this.populateSearchHistory(); // NOVA LINHA

        // Atalhos de teclado
        this.setupKeyboardShortcuts(); // NOVA LINHA
    },

    // === NOVAS FUNÃ‡Ã•ES ADICIONADAS ===

    // Configurar atalhos de teclado
    setupKeyboardShortcuts: function () {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'a':
                        e.preventDefault();
                        if (!document.getElementById('btnAnalyze').disabled) {
                            this.analyzeFile();
                        }
                        break;
                    case 'p':
                        e.preventDefault();
                        if (!document.getElementById('btnGeneratePdf').disabled) {
                            this.generatePdf();
                        }
                        break;
                    case 'h':
                        e.preventDefault();
                        this.toggleHistoryPanel();
                        break;
                }
            }
        });
    },

    // Carregar preferências do usuário
    loadUserPreferences: function () {
        const settings = this.state.settings;
        if (settings.opacity) {
            document.getElementById('opacitySlider').value = settings.opacity;
            MAP.setRasterOpacity(settings.opacity);
        }
        if (settings.panelPinned) {
            this.state.isPanelPinned = settings.panelPinned;
        }
    },

    // Salvar preferências do usuário
    saveUserPreferences: function () {
        this.state.settings.opacity = parseFloat(document.getElementById('opacitySlider').value);
        this.state.settings.panelPinned = this.state.isPanelPinned;
        localStorage.setItem('appSettings', JSON.stringify(this.state.settings));
    },

    // Popular histórico de busca
    populateSearchHistory: function () {
        const datalist = document.getElementById('codigoHistory');
        const history = this.state.searchHistory.slice(0, 10);
        datalist.innerHTML = history.map(code =>
            `<option value="${code}">${code}</option>`
        ).join('');
    },

    // === GERENCIAMENTO DE TEMAS ===

    // Abrir modal de configurações
    openSettings: function () {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;

        // Carregar tema atual
        const currentTheme = localStorage.getItem('theme') || 'auto';
        const themeRadios = modal.querySelectorAll('input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.checked = radio.value === currentTheme;
        });

        // Carregar tipo de raster atual
        const currentRasterType = localStorage.getItem('rasterType') || 'com_mosaico';
        const rasterRadios = modal.querySelectorAll('input[name="rasterType"]');
        rasterRadios.forEach(radio => {
            radio.checked = radio.value === currentRasterType;
        });

        modal.style.display = 'flex';
    },        // Fechar modal de configurações
    closeSettings: function () {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // Aplicar tema
    applyTheme: function (theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.state.settings.theme = theme;
        this.saveUserPreferences();

        const isLightTheme = theme === 'light';
        const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
        const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
        const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';

        // Atualizar gráfico de uso do solo se existir
        if (this.state.areaChart) {
            // Atualizar legenda se existir
            if (this.state.areaChart.options.plugins.legend) {
                this.state.areaChart.options.plugins.legend.labels.color = legendColor;
            }

            // Atualizar tooltip
            if (this.state.areaChart.options.plugins.tooltip) {
                this.state.areaChart.options.plugins.tooltip.backgroundColor = tooltipBg;
                this.state.areaChart.options.plugins.tooltip.titleColor = tooltipText;
                this.state.areaChart.options.plugins.tooltip.bodyColor = tooltipText;
                this.state.areaChart.options.plugins.tooltip.borderColor = tooltipBorder;
            }

            this.state.areaChart.update();
        }

        // Atualizar gráfico de declividade se existir
        if (this.state.areaChartDeclividade) {
            if (this.state.areaChartDeclividade.options.plugins.legend) {
                this.state.areaChartDeclividade.options.plugins.legend.labels.color = legendColor;
            }

            if (this.state.areaChartDeclividade.options.plugins.tooltip) {
                this.state.areaChartDeclividade.options.plugins.tooltip.backgroundColor = tooltipBg;
                this.state.areaChartDeclividade.options.plugins.tooltip.titleColor = tooltipText;
                this.state.areaChartDeclividade.options.plugins.tooltip.bodyColor = tooltipText;
                this.state.areaChartDeclividade.options.plugins.tooltip.borderColor = tooltipBorder;
            }

            this.state.areaChartDeclividade.update();
        }

        // Atualizar gráfico de aptidao se existir
        if (this.state.areaChartAptidao) {
            if (this.state.areaChartAptidao.options.plugins.legend) {
                this.state.areaChartAptidao.options.plugins.legend.labels.color = legendColor;
            }

            if (this.state.areaChartAptidao.options.plugins.tooltip) {
                this.state.areaChartAptidao.options.plugins.tooltip.backgroundColor = tooltipBg;
                this.state.areaChartAptidao.options.plugins.tooltip.titleColor = tooltipText;
                this.state.areaChartAptidao.options.plugins.tooltip.bodyColor = tooltipText;
                this.state.areaChartAptidao.options.plugins.tooltip.borderColor = tooltipBorder;
            }

            this.state.areaChartAptidao.update();
        }

        console.log('Tema aplicado:', theme, '| Cor legenda:', legendColor);
    },

    // Aplicar tipo de raster
    applyRasterType: function (rasterType) {
        this.state.settings.rasterType = rasterType;
        localStorage.setItem('rasterType', rasterType);
        this.saveUserPreferences();

        // Informar ao usuário que a mudança será aplicada na próxima análise
        const rasterName = rasterType === 'com_mosaico'
            ? 'LULC_VALORACAO_10m_com_mosaico.tif'
            : 'Brasil_LULC_10m_sem_mosaico_DW.tif';
        this.showStatus(`Tipo de raster alterado para: ${rasterName}. Será aplicado na próxima análise.`, 'success');
    },        // Carregar tema salvo
    loadTheme: function () {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        this.applyTheme(savedTheme);
    },

    // Adicionar ao histórico de busca
    addToSearchHistory: function (codigo) {
        const history = this.state.searchHistory.filter(c => c !== codigo);
        history.unshift(codigo);
        this.state.searchHistory = history.slice(0, 20);
        localStorage.setItem('searchHistory', JSON.stringify(this.state.searchHistory));
        this.populateSearchHistory();
    },

    // === CONTROLES DO PAINEL FLUTUANTE (delegados para FloatingPanel) ===
    toggleMaximizePanel: function () { FloatingPanel.toggleMaximize(); },
    maximizePanel: function () { FloatingPanel.maximize(); },
    restorePanel: function () { FloatingPanel.restore(); },
    closeFloatingPanel: function () { FloatingPanel.close(); },

    // Alternar painel de histórico
    toggleHistoryPanel: function () {
        const panel = document.getElementById('historyPanel');
        const isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this.loadHistory();
        }
    },

    // Toggle painel de informações
    toggleInfoPanel: function () {
        const panel = document.getElementById('infoPanel');
        const isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
    },

    // Carregar histórico de análises
    loadHistory: function () {
        const historyList = document.getElementById('historyList');
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');

        if (history.length === 0) {
            historyList.innerHTML = '<div class="muted" style="text-align:center; padding:20px;">Nenhuma análise no histórico</div>';
            return;
        }

        historyList.innerHTML = history.slice(0, 50).map((item, index) => {
            const title = item.propertyCode
                ? `Imóvel ${item.propertyCode}`
                : (item.fileName || 'Polígono');
            const subtitle = item.propertyCode
                ? `Código: ${item.propertyCode}`
                : '';
            return `
                <div class="history-item">
                    <div class="history-title">
                        <strong>${title}</strong><br>
                        ${subtitle ? `<small style="color: var(--acc);">${subtitle}</small><br>` : ''}
                        <small>${new Date(item.timestamp).toLocaleString()}</small>
                    </div>
                    <div class="history-actions">
                        <button class="btn btn-sm" onclick="APP.loadFromHistory(${index})">Carregar</button>
                        <button class="btn btn-sm err" onclick="APP.deleteFromHistory(${index})">Excluir</button>
                    </div>
                </div>
            `}).join('');
    },

    // Salvar análise no histórico
    saveToHistory: function (analysisResult) {
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        history.unshift({
            ...analysisResult,
            timestamp: new Date().toISOString(),
            id: Date.now(),
            propertyCode: this.state.currentPropertyCode || null // Incluir código do imóvel
        });
        localStorage.setItem('analysisHistory', JSON.stringify(history.slice(0, 50)));
    },

    // Carregar do histórico
    loadFromHistory: function (index) {
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        const item = history[index];
        if (item) {
            this.state.analysisResults = [item];
            this.displayBatchResults();
            this.showStatus('Análise carregada do histórico.', 'success');
            this.toggleHistoryPanel();
        }
    },

    // Excluir do histórico
    deleteFromHistory: function (index) {
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        history.splice(index, 1);
        localStorage.setItem('analysisHistory', JSON.stringify(history));
        this.loadHistory();
        this.showStatus('Análise excluída do histórico.', 'info');
    },

    // Fixar/desfixar painel (delegado para FloatingPanel)
    togglePanelPin: function () { FloatingPanel.togglePin(); },
    // Configurar event listeners
    setupEventListeners: function () {
        // Upload de arquivo
        document.getElementById('file').addEventListener('change', (e) => this.handleFileSelect(e));
        const rasterFileEl = document.getElementById('rasterFile');
        if (rasterFileEl) rasterFileEl.addEventListener('change', (e) => this.handleRasterFileSelect(e));

        // Toggle de raster (se presente)
        const rasterDefaultEl = document.getElementById('rasterDefault');
        const rasterCustomEl = document.getElementById('rasterCustom');
        if (rasterDefaultEl) rasterDefaultEl.addEventListener('change', (e) => this.handleRasterTypeChange(e));
        if (rasterCustomEl) rasterCustomEl.addEventListener('change', (e) => this.handleRasterTypeChange(e));

        // Botão de desenho
        document.getElementById('btnDrawPolygon').addEventListener('click', () => this.toggleDrawingMode());

        // Botão de busca por código do imóvel (se presente)
        const btnSearch = document.getElementById('btnSearchImovel');
        if (btnSearch) btnSearch.addEventListener('click', () => this.searchImovel());

        // Event listeners para eventos de desenho
        window.addEventListener('polygonDrawn', (e) => this.handlePolygonDrawn(e.detail));
        window.addEventListener('polygonEdited', (e) => this.handlePolygonEdited(e.detail));
        window.addEventListener('polygonDeleted', (e) => this.handlePolygonDeleted(e.detail));

        // Drag and drop
        const dropArea = document.getElementById('drop');
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');

            if (e.dataTransfer.files.length) {
                document.getElementById('file').files = e.dataTransfer.files;
                this.handleFileSelect();
            }
        });

        // Botões de ação
        document.getElementById('btnAnalyze').addEventListener('click', () => this.analyzeFile());
        document.getElementById('btnGeneratePdf').addEventListener('click', () => this.generatePdf());
        document.getElementById('btnClear').addEventListener('click', () => this.clear());

        // Controles do mapa
        document.getElementById('btnFit').addEventListener('click', () => MAP.fitToBounds());
        document.getElementById('btnZoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('btnZoomOut').addEventListener('click', () => this.zoomOut());

        // Controles de visualização do mapa
        document.getElementById('btnShowMap').addEventListener('click', () => {
            MAP.showMapBase();
            this.updateBasemapButtons('btnShowMap');
        });
        document.getElementById('btnShowSatellite').addEventListener('click', () => {
            MAP.showSatelliteBase();
            this.updateBasemapButtons('btnShowSatellite');
        });
        document.getElementById('btnShowNone').addEventListener('click', () => {
            MAP.hideBaseMap();
            this.updateBasemapButtons('btnShowNone');
        });

        // Controle de opacidade
        document.getElementById('opacitySlider').addEventListener('input', (e) => {
            MAP.setRasterOpacity(parseFloat(e.target.value));
        });

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            });
        });

        // Botão fechar quadro flutuante
        document.getElementById('btnClosePanel').addEventListener('click', () => this.closeFloatingPanel());

        // Botão maximizar quadro flutuante
        const btnMaximize = document.getElementById('btnMaximizePanel');
        if (btnMaximize) {
            btnMaximize.addEventListener('click', () => this.toggleMaximizePanel());
        }

        // Event listeners para abas de gráficos
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.switchChartTab(chartType);
            });
        });

        // Novos listeners para funcionalidades adicionadas
        document.getElementById('btnHistory').addEventListener('click', () => this.toggleHistoryPanel());
        document.getElementById('btnCloseHistory').addEventListener('click', () => this.toggleHistoryPanel());
        document.getElementById('btnPinPanel').addEventListener('click', () => this.togglePanelPin());

        // Informações
        document.getElementById('btnInfo').addEventListener('click', () => this.toggleInfoPanel());
        document.getElementById('btnCloseInfo').addEventListener('click', () => this.toggleInfoPanel());

        // Configurações
        document.getElementById('btnSettings').addEventListener('click', () => this.openSettings());
        document.getElementById('btnCloseSettings').addEventListener('click', () => this.closeSettings());

        // Mudança de tema
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.applyTheme(e.target.value);
                }
            });
        });

        // Mudança de tipo de raster
        document.querySelectorAll('input[name="rasterType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.applyRasterType(e.target.value);
                }
            });
        });

        // Botão de histórico nas configurações
        const btnHistorySettings = document.getElementById('btnHistoryFromSettings');
        if (btnHistorySettings) {
            btnHistorySettings.addEventListener('click', () => {
                this.closeSettings();
                this.toggleHistoryPanel();
            });
        }

        // Fechar modal ao clicar fora
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettings();
            }
        });

        // PRO Modal
        document.getElementById('btnPro').addEventListener('click', () => this.openProModal());
        document.getElementById('btnCloseProModal').addEventListener('click', () => this.closeProModal());
        document.getElementById('proModal').addEventListener('click', (e) => {
            if (e.target.id === 'proModal') this.closeProModal();
        });
        document.getElementById('btnBatchAnalysis').addEventListener('click', () => this.showBatchPanel());
        document.getElementById('btnBackToProMenu').addEventListener('click', () => {
            document.getElementById('batchPanel').style.display = 'none';
            document.getElementById('proMenu').style.display = 'block';
        });
        document.getElementById('btnSelectFolder').addEventListener('click', () => this.selectOutputFolder());
        document.getElementById('batchFileInput').addEventListener('change', () => this.updateBatchExecuteButton());
        document.getElementById('chkUsoSolo').addEventListener('change', () => this.updateBatchExecuteButton());
        document.getElementById('chkDeclividade').addEventListener('change', () => this.updateBatchExecuteButton());
        document.getElementById('chkAptidao').addEventListener('change', () => this.updateBatchExecuteButton());
        document.getElementById('btnExecuteBatch').addEventListener('click', () => this.executeBatchAnalysis());

        // Valoração Panel
        document.getElementById('btnValoracaoMenu').addEventListener('click', () => this.showValoracaoPanel());
        document.getElementById('btnBackToProMenuFromVal').addEventListener('click', () => {
            document.getElementById('valoracaoPanel').style.display = 'none';
            document.getElementById('proMenu').style.display = 'block';
            // Restaurar seção de upload de arquivo (pode ter sido escondida pelo auto-load)
            const fileInputSection = document.getElementById('valoracaoFileInput').closest('.batch-section');
            if (fileInputSection) fileInputSection.style.display = '';
            // Limpar estado de valoração auto-carregada para permitir re-detecção
            this.state.valoracaoFeatures = [];
            this.state.valoracaoFiles = [];
        });
        document.getElementById('valoracaoFileInput').addEventListener('change', () => this.handleValoracaoFileUpload());
        document.getElementById('btnExecuteValoracao').addEventListener('click', () => this.executeValoracao());
        document.getElementById('btnValoracaoPdf').addEventListener('click', () => this.generateValoracaoPdf());
        document.getElementById('btnSelectOnMap').addEventListener('click', () => this.selectValoracaoPolygonOnMap());

        // Salvar preferências quando opacidade mudar
        document.getElementById('opacitySlider').addEventListener('change', () => this.saveUserPreferences());
    },

    // Atualizar estado dos botões de análise
    updateAnalysisButtons: function (enabled = true) {
        const btnAnalyze = document.getElementById('btnAnalyze');
        const btnAnalyzeDeclividade = document.getElementById('btnAnalyzeDeclividade');
        const btnAnalyzeAptidao = document.getElementById('btnAnalyzeAptidao');

        if (btnAnalyze) {
            btnAnalyze.disabled = !enabled;
        }
        if (btnAnalyzeDeclividade) {
            btnAnalyzeDeclividade.disabled = !enabled;
        }
        if (btnAnalyzeAptidao) {
            btnAnalyzeAptidao.disabled = !enabled;
        }
    },

    // Atualizar estado visual dos botões de basemap
    updateBasemapButtons: function (activeId) {
        const buttons = ['btnShowMap', 'btnShowSatellite', 'btnShowNone'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (id === activeId) {
                    btn.classList.add('primary');
                } else {
                    btn.classList.remove('primary');
                }
            }
        });
    },

    // Funções de formatação PT-BR
    formatNumberPTBR: function (value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) return '-';

        try {
            return value.toLocaleString('pt-BR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        } catch (e) {
            return value.toFixed(decimals);
        }
    },

    formatCurrencyPTBR: function (value) {
        if (value === null || value === undefined || isNaN(value)) return '-';

        try {
            return value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } catch (e) {
            return 'R$ ' + this.formatNumberPTBR(value, 2);
        }
    },

    // Buscar imóvel por código no backend e adicionar ao mapa (como polígono desenhado)
    // SUBSTITUA a função searchImovel por:
    searchImovel: async function () {
        const input = document.getElementById('codigoImovelInput');
        const codigo = input.value.trim();

        if (!codigo) {
            this.showStatus('Informe o código do imóvel para pesquisa.', 'error');
            return;
        }

        // Debounce - cancela busca anterior se nova tecla for pressionada
        if (this.searchTimeout) clearTimeout(this.searchTimeout);

        this.searchTimeout = setTimeout(async () => {
            await this.executeSearch(codigo);
        }, 500);
    },

    // Nova função separada para execução da busca
    async executeSearch(codigo) {
        this.showStatus(`Buscando imóvel ${codigo}...`, 'info');
        this.state.currentCodigoImo = codigo;

        try {
            // Verificar cache
            const cacheKey = `search_${codigo}`;
            if (this.state.analysisCache.has(cacheKey)) {
                const cached = this.state.analysisCache.get(cacheKey);
                this.processSearchResult(cached, codigo);
                return;
            }

            const resp = await fetch(`/api/imovel?codigo=${encodeURIComponent(codigo)}`);
            const data = await resp.json();

            if (data.status === 'sucesso' && data.geojson) {
                this.state.analysisCache.set(cacheKey, data);
                this.processSearchResult(data, codigo);
                this.addToSearchHistory(codigo);
            } else {
                this.showStatus(data.mensagem || 'Nenhum imóvel encontrado', 'error');
            }
        } catch (error) {
            console.error('Erro na busca do imóvel:', error);
            this.showStatus('Erro ao buscar imóvel no servidor.', 'error');
        }
    },

    // Processar resultado da busca
    processSearchResult: function (data, codigo) {
        // === LIMPAR ANÁLISE ANTERIOR ANTES DE CARREGAR NOVO POLÍGONO ===
        if (this.state.analysisResults.length > 0) {
            // Salvar análise anterior no histórico
            this.saveToHistory(this.state.analysisResults[0]);

            // Limpar resultados anteriores
            this.state.analysisResults = [];

            // Limpar tabela de classes
            const classesTableEl = document.getElementById('classesTable');
            const classesTbody = classesTableEl ? classesTableEl.querySelector('tbody') : null;
            if (classesTbody) {
                classesTbody.innerHTML = '';
            }

            // Limpar valores na UI
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            setText('totalArea', '-');
            setText('classesCount', '-');
            setText('totalValue', '-');

            // Limpar rasters e polígonos do mapa
            MAP.clearRasters();
            MAP.clearPolygons();
        }

        MAP.clearDrawnPolygons();
        const layer = MAP.addGeoJsonAsDrawn(data.geojson, `Imóvel ${codigo}`);

        if (layer) {
            this.state.drawnPolygon = layer;
            this.state.currentPropertyCode = codigo; // Armazenar código do imóvel
            this.updateAnalysisButtons(true);
            this.showStatus(`Imóvel ${codigo} carregado no mapa.`, 'success');



            try {
                const bounds = layer.getBounds();
                MAP.zoomToBounds(bounds);
            } catch (e) { }
        }
    },


    clear: function () {
        this.state.currentCentroid = '';
        this.state.features = [];
        this.state.currentFiles = [];
        this.state.analysisResults = [];
        this.state.drawnPolygon = null;
        this.state.currentPropertyCode = null;

        MAP.clear();

        // UI Updates
        const selectorContainer = document.getElementById('polygonSelectorContainer');
        if (selectorContainer) {
            selectorContainer.innerHTML = '';
            selectorContainer.style.display = 'none';
        }

        const panel = document.getElementById('floatingPanel');
        if (panel) panel.style.display = 'none';

        const hud = document.getElementById('hud');
        if (hud) hud.textContent = 'Nenhum polígono carregado';

        const drawBtn = document.getElementById('btnDrawPolygon');
        if (drawBtn) {
            drawBtn.classList.remove('active');
            drawBtn.innerHTML = 'âœï¸ Desenhar';
        }

        this.updateAnalysisButtons(false);
        this.showStatus('Mapa limpo.', 'info');
    },

    // Alternar modo de desenho
    toggleDrawingMode: function () {
        if (this.state.drawnPolygon) {
            this.showStatus('Já existe um polígono desenhado. Limpe o mapa para desenhar um novo.', 'error');
            return;
        }

        const isDrawing = !MAP.state.isDrawing;
        MAP.toggleDrawing(isDrawing);

        const drawBtn = document.getElementById('btnDrawPolygon');
        if (isDrawing) {
            drawBtn.classList.add('active');
            drawBtn.innerHTML = 'ðŸ›‘ Finalizar Desenho';
            this.showStatus('Modo desenho ativado. Clique no mapa para desenhar. Duplo clique para finalizar.', 'info');
        } else {
            drawBtn.classList.remove('active');
            drawBtn.innerHTML = 'âœï¸ Desenhar';
            this.showStatus('Modo desenho desativado.', 'info');
        }
    },

    // Manipular polígono desenhado
    handlePolygonDrawn: function (detail) {
        this.state.drawnPolygon = detail.layer;

        // Desativar modo de desenho
        const drawBtn = document.getElementById('btnDrawPolygon');
        drawBtn.classList.remove('active');
        drawBtn.innerHTML = 'âœï¸ Desenhar';
        MAP.state.isDrawing = false;

        // Habilitar análise
        this.updateAnalysisButtons(true);

        this.showStatus('Polígono desenhado! Você pode editá-lo movendo os pontos. Clique em "Analisar Uso do Solo" para processar.', 'success');
    },

    handlePolygonEdited: function (detail) {
        this.showStatus('Polígono editado.', 'info');
    },

    handlePolygonDeleted: function (detail) {
        this.state.drawnPolygon = null;
        this.updateAnalysisButtons(false);
        this.showStatus('Polígono removido.', 'info');
    },

    // Exportar polígono desenhado como KML
    exportDrawnPolygon: function () {
        const kmlContent = MAP.exportDrawnPolygonToKML();
        if (kmlContent) {
            const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `poligono_desenhado_${new Date().toISOString().split('T')[0]}.kml`;
            a.click();
            URL.revokeObjectURL(url);
            this.showStatus('Polígono exportado como KML!', 'success');
        } else {
            this.showStatus('Nenhum polígono para exportar.', 'error');
        }
    },

    // Manipular mudança no tipo de raster
    handleRasterTypeChange: function (event) {
        const rasterType = event.target.value;
        this.state.rasterType = rasterType;
        const rasterCustomUploadEl = document.getElementById('rasterCustomUpload');
        if (rasterCustomUploadEl) rasterCustomUploadEl.style.display = rasterType === 'custom' ? 'block' : 'none';

        if (rasterType === 'custom' && !this.state.currentRasterFile) {
            const rasterFileEl = document.getElementById('rasterFile');
            if (rasterFileEl) rasterFileEl.click();
        }

        this.updateRasterInfo();

        if (rasterType === 'default') {
            this.showStatus('Usando raster padrão do sistema.', 'info');
        } else if (rasterType === 'custom' && this.state.currentRasterFile) {
            this.showStatus(`Usando raster personalizado: ${this.state.currentRasterFile.name}`, 'info');
        }
    },

    // Atualizar informações do raster na UI
    updateRasterInfo: function () {
        const info = this.state.currentRasterInfo;
        const nameEl = document.getElementById('currentRasterName');
        const resEl = document.getElementById('currentRasterResolution');
        const paEl = document.getElementById('currentRasterPixelArea');
        if (nameEl) nameEl.textContent = info.name;
        if (resEl) resEl.textContent = info.resolution;
        if (paEl) paEl.textContent = info.pixelArea;
    },

    // Manipular seleção de arquivos geoespaciais
    handleFileSelect: function () {
        const fileInput = document.getElementById('file');
        if (fileInput.files.length === 0) return;

        const files = Array.from(fileInput.files);

        // Validar cada arquivo
        const allowedExtensions = ['.kml', '.kmz', '.geojson', '.json', '.zip', '.gpkg'];
        for (const file of files) {
            if (!UTILS.validateFile(file, allowedExtensions)) {
                this.showStatus('Formatos aceitos: KML, KMZ, GeoJSON (.json), Shapefile (.zip) ou GeoPackage (.gpkg)', 'error');
                return;
            }
        }

        this.state.currentFiles = files;
        this.updateAnalysisButtons(true);

        // Determinar tipo(s) de arquivo
        const fileTypes = files.map(f => {
            const ext = f.name.toLowerCase().split('.').pop();
            const typeMap = {
                'kml': 'KML',
                'kmz': 'KMZ',
                'geojson': 'GeoJSON',
                'json': 'GeoJSON',
                'zip': 'Shapefile',
                'gpkg': 'GeoPackage'
            };
            return typeMap[ext] || ext.toUpperCase();
        });
        const uniqueTypes = [...new Set(fileTypes)].join(', ');
        const fileInfo = `Arquivos selecionados: ${files.length} arquivo(s) (${uniqueTypes})`;
        this.showStatus(fileInfo, 'info');

        this.loadGeoFiles(files);
    },

    // Carregar múltiplos arquivos geoespaciais (KML, KMZ, GeoJSON, Shapefile)
    loadGeoFiles: function (files) {
        // === LIMPAR ANÁLISE ANTERIOR ANTES DE CARREGAR NOVOS ARQUIVOS ===
        if (this.state.analysisResults.length > 0) {
            // Salvar análise anterior no histórico
            this.saveToHistory(this.state.analysisResults[0]);

            // Limpar resultados anteriores
            this.state.analysisResults = [];

            // Limpar tabela de classes
            const classesTableEl = document.getElementById('classesTable');
            const classesTbody = classesTableEl ? classesTableEl.querySelector('tbody') : null;
            if (classesTbody) {
                classesTbody.innerHTML = '';
            }

            // Limpar valores na UI
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            setText('totalArea', '-');
            setText('classesCount', '-');
            setText('totalValue', '-');
        }

        this.state.features = [];
        this.state.currentPropertyCode = null; // Limpar código do imóvel (não é busca por código)

        const selectorContainer = document.getElementById('polygonSelectorContainer');
        if (selectorContainer) {
            selectorContainer.innerHTML = '';
            selectorContainer.style.display = 'none';
        }

        files.forEach((file, index) => {
            this.loadGeoFile(file, index);
        });

        setTimeout(() => {
            MAP.fitToBounds();
        }, 500);
    },

    // Carregar arquivo geoespacial individual (KML, KMZ, GeoJSON, Shapefile)
    loadGeoFile: async function (file, index) {
        const ext = file.name.toLowerCase().split('.').pop();
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        // Função auxiliar para extrair o melhor nome das propriedades
        const getBestName = (properties, defaultName) => {
            if (!properties) return defaultName;

            // Ordem de prioridade para campos de nome
            const nameKeys = ['nome', 'name', 'id_parcela', 'id', 'sigef', 'descricao', 'layer', 'cod_imovel'];

            for (const key of nameKeys) {
                // Busca case-insensitive
                const foundKey = Object.keys(properties).find(k => k.toLowerCase() === key);
                if (foundKey && properties[foundKey]) {
                    return String(properties[foundKey]);
                }
            }
            return defaultName;
        };

        // Função auxiliar para processar uma feature GeoJSON e adicioná-feature na tela e na fila
        const processFeature = (feature, polyIndex, totalFeatures) => {
            if (!feature.geometry) return;

            let coordinates = null;
            const geomType = feature.geometry.type;

            if (geomType === 'Polygon') {
                coordinates = feature.geometry.coordinates[0]; // [lon, lat]
            } else if (geomType === 'MultiPolygon') {
                coordinates = feature.geometry.coordinates[0][0]; // [lon, lat]
            } else {
                return; // Ignorar geometrias não poligonais (pontos, linhas)
            }

            if (coordinates) {
                // Extrair nome
                const polyName = totalFeatures === 1 ? file.name : `${baseName} - ${getBestName(feature.properties, `Polígono ${polyIndex + 1}`)}`;

                const colors = ['#4cc9f0', '#f04c7c', '#4cf0a7', '#f0a74c', '#a74cf0'];
                const color = colors[(this.state.features.length) % colors.length];

                // Criar FeatureCollection individual para este polígono para a análise mantendo o formato GeoJSON original [lon, lat] do backend/parser
                const singleFeatureCollection = {
                    type: "FeatureCollection",
                    features: [feature]
                };
                const geojsonStr = JSON.stringify(singleFeatureCollection);
                const virtualFile = new File([geojsonStr], `${polyName}.geojson`, {
                    type: 'application/geo+json'
                });

                this.state.features.push({
                    name: polyName,
                    geometry: feature.geometry, // Keep original intact GeoJSON geometry (MultiPolygon/Polygon)
                    index: this.state.features.length,
                    fileType: 'geojson',
                    originalFile: virtualFile
                });

                // Adicionar no MAPA. MAP.addPolygon. O `map.js` inverte [lon, lat] nativamente no seu código fonte `latLngs = coordinates.map(coord => [coord[1], coord[0]]);`
                const addedLayer = MAP.addPolygon(coordinates, polyName, color, this.state.features.length - 1);
                return addedLayer;
            }
            return null;
        };

        // Processar qualquer formato (binário ou texto) através da API unificada do backend,
        // garantindo consistência, CRS válido, extração de atributos e split de MultiPolygons.
        const acceptedFormats = ['kmz', 'zip', 'gpkg', 'kml', 'geojson', 'json'];

        if (acceptedFormats.includes(ext)) {
            this.showStatus(`Processando arquivo ${file.name}...`, 'info');

            try {
                // Enviar para backend padronizar e converter para FeatureCollection de Polygons
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/convert_to_geojson', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.status === 'sucesso' && data.geojson) {
                    const geojson = data.geojson;
                    let addedLayers = [];

                    if (geojson.features && geojson.features.length > 0) {
                        geojson.features.forEach((feature, i) => {
                            const layer = processFeature(feature, i, geojson.features.length);
                            if (layer) addedLayers.push(layer);
                        });

                        // Remover o arquivo original da lista e adicionar os novos virtuais correspondentes
                        const fileIdx = this.state.currentFiles.indexOf(file);
                        if (fileIdx > -1) {
                            const newVirtualFiles = this.state.features.slice(this.state.features.length - addedLayers.length).map(f => f.originalFile);
                            this.state.currentFiles.splice(fileIdx, 1, ...newVirtualFiles);
                        }
                    }

                    if (addedLayers.length > 0) {
                        try {
                            // Zoom para contemplar todos os polígonos lidos
                            const group = new L.featureGroup(addedLayers);
                            setTimeout(() => { MAP.state.leafletMap.fitBounds(group.getBounds(), { padding: [50, 50] }); }, 300);
                        } catch (e) { console.warn('Não foi possível fazer zoom geral:', e); }
                        this.showStatus(`${addedLayers.length} polígono(s) lidos de ${file.name}.`, 'success');
                    } else {
                        throw new Error('Nenhum polígono encontrado após conversão.');
                    }
                } else {
                    throw new Error(data.mensagem || 'Erro ao converter arquivo');
                }
            } catch (error) {
                console.error(`Erro ao processar ${file.name}:`, error);
                this.showStatus(`Erro ao carregar ${file.name}: ${error.message}`, 'error');
            }
            return;
        }
    },

    // Manipular seleção de arquivo raster
    handleRasterFileSelect: function () {
        const rasterFileInput = document.getElementById('rasterFile');
        if (!rasterFileInput || rasterFileInput.files.length === 0) return;

        const file = rasterFileInput.files[0];
        if (!UTILS.validateFile(file, ['.tif', '.tiff'])) {
            this.showStatus('Por favor, selecione um arquivo TIFF válido.', 'error');
            return;
        }

        this.state.currentRasterFile = file;

        this.state.currentRasterInfo = {
            name: file.name,
            resolution: 'A ser calculada...',
            pixelArea: 'A ser calculada...'
        };
        this.updateRasterInfo();

        const rasterCustomEl = document.getElementById('rasterCustom');
        if (rasterCustomEl) rasterCustomEl.checked = true;
        this.state.rasterType = 'custom';
        const rasterCustomUploadEl = document.getElementById('rasterCustomUpload');
        if (rasterCustomUploadEl) rasterCustomUploadEl.style.display = 'block';

        const fileInfo = `Raster personalizado carregado: ${file.name} (${UTILS.formatFileSize(file.size)})`;
        this.showStatus(fileInfo, 'info');

        this.previewRasterInfo(file);
    },

    // Pré-visualizar informações do raster
    previewRasterInfo: function (file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            this.state.currentRasterInfo.name = file.name;
            this.state.currentRasterInfo.resolution = 'Será calculada na análise';
            this.state.currentRasterInfo.pixelArea = 'Será calculada na análise';
            this.updateRasterInfo();
        };

        reader.readAsArrayBuffer(file);
    },

    // Calcular e exibir centroide
    calculateAndDisplayCentroid: function (polygon) {
        const centroid = UTILS.calculateCentroid(polygon);
        if (!centroid) return;
        const fcEl = document.getElementById('floatingCentroid');
        if (fcEl) fcEl.textContent = `${centroid.latGMS}, ${centroid.lonGMS}`;
    },

    // Calcular e exibir centroide para polígono Leaflet
    calculateAndDisplayLeafletCentroid: function (leafletPolygon) {
        const centroid = UTILS.calculateLeafletCentroid(leafletPolygon);
        if (!centroid) return;
        const fcEl = document.getElementById('floatingCentroid');
        if (fcEl) fcEl.textContent = `${centroid.latGMS}, ${centroid.lonGMS}`;
    },

    // Analisar arquivos
    exportMultiplesCsv: async function () {
        if (this.state.currentFiles.length === 0 && !this.state.drawnPolygon) {
            this.showStatus('Nenhum arquivo ou polígono para analisar.', 'error');
            return;
        }

        document.getElementById('loading').classList.add('active');
        this.updateAnalysisButtons(false);
        this.showStatus('Iniciando análise em lote e geração de CSV...', 'info');

        let fileToUpload = null;

        // Se há polígono desenhado ou selecionado do shapefile, exportar ele para um arquivo virtual
        if (this.state.drawnPolygon) {
            if (this.state.drawnPolygon.feature) {
                const featureCollection = {
                    type: "FeatureCollection",
                    features: [this.state.drawnPolygon.feature]
                };
                fileToUpload = new File([JSON.stringify(featureCollection)], 'poligono.geojson', { type: 'application/geo+json' });
            } else {
                const kmlContent = MAP.exportDrawnPolygonToKML();
                if (kmlContent) {
                    fileToUpload = new File([new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' })], 'poligono.kml', { type: 'application/vnd.google-earth.kml+xml' });
                }
            }
        }

        // Se há arquivos na lista de espera, priorizaremos o primeiro arquivo (caso haja múltiplos) para a lógica do lote, 
        // ou você pode unificar todos os arquivos através da nova feature iterada.
        if (!fileToUpload && this.state.currentFiles.length > 0) {
            fileToUpload = this.state.currentFiles[0];
        }

        if (!fileToUpload) {
            this.showStatus('Não foi encontrado arquivos de saída.', 'error');
            document.getElementById('loading').classList.remove('active');
            this.updateAnalysisButtons(true);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            // Garantir que usa o tipo de raster (com/sem mosaico) do localStorage/configurações
            const currentRasterType = localStorage.getItem('rasterType') || 'com_mosaico';
            formData.append('raster_type', currentRasterType);

            const response = await fetch('/analisar-multiplos-csv', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.mensagem || 'Falha ao processar CSV.');
            }

            // Converter a resposta em Blob e fazer download in-loco
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analise_multiplos_poligonos.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showStatus('CSV gerado e baixado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro CSV Lote:', error);
            this.showStatus(error.message, 'error');
        } finally {
            document.getElementById('loading').classList.remove('active');
            this.updateAnalysisButtons(true);
        }
    },

    analyzeFile: async function () {
        // === GARANTIR LIMPEZA APENAS DOS RASTERS ANTES DE NOVA ANÁLISE ===
        // (Polígonos e dados anteriores já foram limpos em processSearchResult/loadGeoFiles)
        if (this.state.analysisResults.length > 0) {
            MAP.clearRasters();
        }

        // Se há polígono desenhado ou carregado do shapefile, analisar diretamente
        if (this.state.drawnPolygon) {
            try {
                // Se o polígono veio da busca no shapefile, usar GeoJSON diretamente
                if (this.state.drawnPolygon.feature) {
                    // Criar estrutura FeatureCollection completa
                    const featureCollection = {
                        type: "FeatureCollection",
                        features: [this.state.drawnPolygon.feature]
                    };
                    const geojsonStr = JSON.stringify(featureCollection);
                    const virtualFile = new File([geojsonStr], 'poligono_sigef.geojson', {
                        type: 'application/geo+json'
                    });
                    this.state.currentFiles = [virtualFile];
                    this.showStatus('Iniciando análise do polígono SIGEF...', 'info');
                } else {
                    // Ã‰ um polígono desenhado, converter para KML
                    const kmlContent = MAP.exportDrawnPolygonToKML();
                    if (!kmlContent) {
                        this.showStatus('Erro: Não foi possível gerar KML do polígono desenhado.', 'error');
                        return;
                    }
                    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
                    const virtualFile = new File([blob], 'poligono_desenhado.kml', {
                        type: 'application/vnd.google-earth.kml+xml'
                    });
                    this.state.currentFiles = [virtualFile];
                    this.showStatus('Polígono desenhado convertido para KML. Iniciando análise...', 'info');
                }

                if (this.state.analysisResults.length > 0) {
                    this.state.allRastersLoaded = true;
                    this.displayBatchResults();
                    this.showStatus(`Análise concluída! ${this.state.analysisResults.length} arquivo(s) processado(s).`, 'success');
                    document.getElementById('btnGeneratePdf').disabled = false;
                    document.getElementById('opacityControl').style.display = 'flex';

                    if (this.state.analysisResults[0].metadados) {
                        const metadados = this.state.analysisResults[0].metadados;
                        this.state.currentRasterInfo.resolution = metadados.resolucao_espacial || '-';
                        this.state.currentRasterInfo.pixelArea = metadados.area_por_pixel_ha ?
                            `${metadados.area_por_pixel_ha} ha` : '-';
                        this.updateRasterInfo();
                    }
                }
            } catch (error) {
                this.showStatus('Erro ao preparar polígono para análise: ' + error.message, 'error');
                return;
            }
        }

        if (this.state.currentFiles.length === 0) {
            this.showStatus('Nenhum arquivo KML ou polígono para analisar.', 'error');
            return;
        }

        this.updateAnalysisButtons(false);
        this.state.allRastersLoaded = false;

        this.state.analysisResults = [];

        try {
            const totalFiles = this.state.currentFiles.length;

            for (let i = 0; i < totalFiles; i++) {
                const file = this.state.currentFiles[i];
                this.showProgress(`Uso do Solo: ${file.name}`, i + 1, totalFiles);
                const result = await this.analyzeSingleFile(file, i);
                if (result) {
                    this.state.analysisResults.push(result);

                    if (result.imagem_recortada && result.imagem_recortada.base64) {
                        let bounds = null;

                        // Se for um polígono SIGEF ou desenhado, usa drawnPolygon
                        if (result.isSIGEF || result.isVirtual) {
                            const drawnLayer = this.state.drawnPolygon;
                            if (drawnLayer) {
                                bounds = drawnLayer.getBounds();
                            }
                        } else {
                            // Para KML carregado: tentar obter bounds do polígono existente no mapa
                            bounds = MAP.getPolygonBounds(i);

                            // Se não encontrou (polígono foi limpo), re-adicionar do state.features
                            if (!bounds && this.state.features && this.state.features[i]) {
                                const feature = this.state.features[i];
                                const coords = feature.geometry.coordinates[0];
                                const colors = ['#4cc9f0', '#f04c7c', '#4cf0a7', '#f0a74c', '#a74cf0'];
                                const color = colors[i % colors.length];
                                MAP.addPolygon(coords, feature.name, color, i);
                                bounds = MAP.getPolygonBounds(i);
                            }
                        }

                        if (bounds) {
                            MAP.addRasterForPolygon(i, result.imagem_recortada.base64, bounds);
                        }
                    }
                }

            }

            if (this.state.analysisResults.length > 0) {
                this.state.allRastersLoaded = true;
                document.getElementById('btnGeneratePdf').disabled = false;
                this.displayBatchResults();
                this.showStatus(`Análise concluída! ${this.state.analysisResults.length} arquivo(s) processado(s).`, 'success');
                document.getElementById('opacityControl').style.display = 'flex';

                if (this.state.analysisResults[0].metadados) {
                    const metadados = this.state.analysisResults[0].metadados;
                    this.state.currentRasterInfo.resolution = metadados.resolucao_espacial || '-';
                    this.state.currentRasterInfo.pixelArea = metadados.area_por_pixel_ha ?
                        `${metadados.area_por_pixel_ha} ha` : '-';
                    this.updateRasterInfo();
                }
                this.hideProgress();
            }
        } catch (error) {
            console.error('Erro na análise:', error);
            // Se ao menos um resultado foi obtido, considerar erro como não-fatal
            if (this.state.analysisResults && this.state.analysisResults.length > 0) {
                this.showStatus(`Análise concluída com ${this.state.analysisResults.length} arquivo(s), porém ocorreu um erro secundário: ${error.message || error}`, 'warn');
            } else {
                this.showStatus('Erro ao processar análise.', 'error');
            }
        } finally {
            this.updateAnalysisButtons(true);
        }
    },

    // Função auxiliar para verificar se é um arquivo KML virtual
    isVirtualKMLFile: function (file) {
        return file.name === 'poligono_desenhado.kml' && file.type === 'application/vnd.google-earth.kml+xml';
    },

    // Função auxiliar para verificar se é um arquivo SIGEF virtual (GeoJSON)
    isSIGEFFile: function (file) {
        return file.name === 'poligono_sigef.geojson' && file.type === 'application/geo+json';
    },

    // Analisar um único arquivo
    analyzeSingleFile: async function (file, index) {
        const formData = new FormData();

        // âœ… Se o arquivo tem originalFile (foi convertido de binário para GeoJSON),
        // usar o arquivo original para análise no backend
        const fileToAnalyze = file.originalFile || file;
        formData.append('kml', fileToAnalyze);

        // Adicionar tipo de raster selecionado
        const rasterType = localStorage.getItem('rasterType') || 'com_mosaico';
        formData.append('raster_type', rasterType);

        // ✅ VALORAÇÃO: Análise normal do sidebar NÃO envia valoração
        formData.append('enable_valoracao', 'false');

        if (this.state.rasterType === 'custom' && this.state.currentRasterFile) {
            formData.append('raster', this.state.currentRasterFile);
        }

        formData.append('file_index', index.toString());

        try {
            const response = await fetch('/analisar', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            // If server indicates centroid has no quadrante/value, surface a visible message
            if (data && data.mensagem_centroide) {
                // show status banner and keep message in the object for UI rendering
                this.showStatus(data.mensagem_centroide, 'warn');
                data._mensagem_centroide = data.mensagem_centroide;
            }

            if (data.status === 'sucesso') {
                if (data.polygon_geojson) {
                    try {
                        let layer = null;

                        // Validando se o poligono ja existe desenhado na memoria para evitar duplicação em tela
                        const featureAlreadyLoaded = this.state.features[index] && this.state.features[index].geometry;

                        if (!featureAlreadyLoaded) {
                            layer = MAP.addGeoJsonAsDrawn(data.polygon_geojson, file.name);

                            if (layer) {
                                // Marcar como polígono desenhado apenas se não for um arquivo SIGEF ou virtual
                                if (!this.isSIGEFFile(file) && !this.isVirtualKMLFile(file)) {
                                    this.state.drawnPolygon = layer;
                                }

                                // Adicionar ao state.features para compatibilidade
                                if (data.polygon_geojson.features && data.polygon_geojson.features.length > 0) {
                                    const firstFeature = data.polygon_geojson.features[0];
                                    if (firstFeature.geometry && firstFeature.geometry.coordinates) {
                                        const coords = firstFeature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                                        this.state.features.push({
                                            name: file.name,
                                            geometry: { type: 'Polygon', coordinates: [coords] },
                                            index: index,
                                            fileType: file.name.split('.').pop()
                                        });
                                    }
                                }

                            }
                        } else {
                            // O polígono já existia em this.state.features
                        }
                    } catch (error) {
                        console.error('Erro ao processar e enquadrar polígono do mapa:', error);
                    }
                } else {
                    console.warn('Nenhum polygon_geojson retornado do backend');
                }

                return {
                    ...data,
                    fileName: file.name,
                    fileIndex: index,
                    isVirtual: this.isVirtualKMLFile(file),
                    isSIGEF: this.isSIGEFFile(file)
                };
            } else {
                // Mensagem de erro mais específica para polígonos desenhados
                if (this.isVirtualKMLFile(file)) {
                    this.showStatus('Erro no polígono desenhado: O polígono pode estar fora da área coberta pelo raster ou ter formato inválido.', 'error');
                } else {
                    this.showStatus(`Erro no arquivo ${file.name}: ${data.mensagem}`, 'error');
                }
                return null;
            }
        } catch (error) {
            if (this.isVirtualKMLFile(file)) {
                this.showStatus('Erro ao processar polígono desenhado', 'error');
            } else {
                this.showStatus(`Erro ao processar ${file.name}`, 'error');
            }
            return null;
        }
    },

    // Exibir resultados em lote
    displayBatchResults: function () {
        // document.getElementById('resultSection').classList.add('active');

        if (this.state.analysisResults.length > 1) {
            this.addPolygonSelector();
        }

        const panel = document.getElementById('floatingPanel');
        panel.style.display = 'block';
        // In compact mode (not maximized) show only the right column (chart + legend)
        if (!panel.classList.contains('maximized')) {
            panel.classList.add('compact');
        }

        if (this.state.analysisResults.length > 1) {
            this.showAllResults();
        } else {
            this.showPolygonResult(0, { skipZoom: true });
        }
    },

    // Adicionar seletor de polígono
    addPolygonSelector: function () {
        const container = document.getElementById('polygonSelectorContainer');
        if (!container) return;

        const selectorHtml = `
            <div class="polygon-selector-inner" style="display: flex; align-items: center; width: 100%; height: 100%; padding: 0 8px; gap: 8px; box-sizing: border-box;">
                <span title="Selecionar Polígono" style="color: #60d5ff; font-size: 14px; display: flex; align-items: center;">📊</span>
                <select id="polygonSelect" style="flex: 1; background: transparent; border: none; color: white; font-size: 13px; height: 100%; outline: none; cursor: pointer;">
                    <option value="-1" style="background: #1a1f3a;">Todos os polígonos</option>
                    ${this.state.analysisResults.map((result, index) =>
            `<option value="${index}" style="background: #1a1f3a;">${result.fileName.replace('.kml', '').replace('.kmz', '').replace('.geojson', '').replace('.json', '')}</option>`
        ).join('')}
                </select>
            </div>
        `;

        container.innerHTML = selectorHtml;
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        document.getElementById('polygonSelect').addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            if (index === -1) {
                this.showAllResults();
            } else {
                this.showPolygonResult(index);
            }
        });

        document.getElementById('polygonSelect').value = "-1";
    },

    // Selecionar polígono por clique no mapa
    selectPolygonByClick: function (index) {
        const polygonSelect = document.getElementById('polygonSelect');
        if (polygonSelect) {
            polygonSelect.value = index;
        }

        this.showPolygonResult(index);

        // Abrir e maximizar o painel flutuante automaticamente ao clicar no polígono
        const panel = document.getElementById('floatingPanel');
        if (panel) {
            // Garantir que o painel esteja visível
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
            }

            // Maximizar o painel se não estiver maximizado
            if (!panel.classList.contains('maximized')) {
                this.maximizePanel();
                const btn = document.getElementById('btnMaximizePanel');
                if (btn) {
                    btn.textContent = 'â›¶';
                    btn.title = 'Restaurar';
                }
            }
        }
    },

    // Retorna o resultado da análise de *qualquer* módulo ativo para uso como metadados/referência
    getAnyAvailableResult: function (index) {
        if (this.state.analysisResults && this.state.analysisResults[index]) {
            return this.state.analysisResults[index];
        }
        if (typeof DecliviDADE !== 'undefined' && DecliviDADE.state.analysisResults && DecliviDADE.state.analysisResults[index]) {
            return DecliviDADE.state.analysisResults[index];
        }
        if (typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.analysisResults && Aptidao.state.analysisResults[index]) {
            return Aptidao.state.analysisResults[index];
        }
        return null; // Nada analisado para este polygonIndex
    },

    // Exibir resultados de um polígono específico
    showPolygonResult: function (index, options = {}) {
        this.state.currentPolygonIndex = index;

        // Obter de *qualquer* módulo que já tenha metadados/nome para gerar o header e contexto da UI
        const baseResult = this.getAnyAvailableResult(index);
        if (!baseResult) return;

        // Tentar obter resultado específico de Uso do Solo
        const resultSolo = this.state.analysisResults && this.state.analysisResults[index] ? this.state.analysisResults[index] : null;

        // Safe DOM writer helper
        const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

        // ======================================
        // ATUALIZAÃ‡ÃƒO DO CABEÃ‡ALHO/METADADOS
        // ======================================

        const metadados = baseResult.metadados || {};
        setText('crsInfo', metadados.crs || 'Não disponível');
        setText('spatialResolution', metadados.resolucao_espacial || 'Não disponível');
        setText('clipDimensions', metadados.dimensoes_recorte || 'Não disponível');
        setText('pixelArea', metadados.area_por_pixel_ha_formatado ? metadados.area_por_pixel_ha_formatado : (metadados.area_por_pixel_ha ? `${metadados.area_por_pixel_ha} ha` : 'Não disponível'));
        setText('satelliteDateText', metadados.data_imagem || 'n/a');

        // Valores da tabela agregada
        if (resultSolo && resultSolo.relatorio) {
            const relSolo = resultSolo.relatorio;
            setText('totalArea', relSolo.area_total_poligono_ha_formatado !== undefined ? relSolo.area_total_poligono_ha_formatado : (relSolo.area_total_poligono_ha ? `${relSolo.area_total_poligono_ha} ha` : '-'));
            setText('classesCount', relSolo.numero_classes_encontradas);
            if (this.state.valoracaoCache && this.state.valoracaoCache[index]) {
                const cachedResult = this.state.valoracaoCache[index];
                setText('totalValue', cachedResult.relatorio.valor_total_calculado_formatado !== undefined ? cachedResult.relatorio.valor_total_calculado_formatado : '-');
                const valoracaoData = ValoracaoModule.processValoracao(cachedResult);
                if (valoracaoData && valoracaoData.quadrante) {
                    ValoracaoModule.renderQuadranteInfo(valoracaoData.quadrante, 'floatingQuadranteInfo');
                }
            } else {
                // Sem valoração executada — omitir dados do valor
                const quadDiv = document.getElementById('floatingQuadranteInfo');
                if (quadDiv) quadDiv.style.display = 'none';
                const totalValEl = document.getElementById('floatingTotalValue');
                if (totalValEl) { totalValEl.style.display = 'none'; totalValEl.innerHTML = ''; }
            }
        } else {
            // Se não houver Uso do Solo, pegar as dimensões do baseResult
            if (baseResult.relatorio) {
                setText('totalArea', baseResult.relatorio.area_total_poligono_ha_formatado || (baseResult.relatorio.area_total_poligono_ha ? `${baseResult.relatorio.area_total_poligono_ha} ha` : '-'));
            }
            setText('classesCount', '-');
            setText('totalValue', 'N/D');
            const quadDiv = document.getElementById('floatingQuadranteInfo');
            if (quadDiv) quadDiv.style.display = 'none';
        }

        // Tabela central de classes (Solo, Declividade, Aptidao)
        // Isso foi internalizado para "updateFloatingCenter"
        this.updateFloatingCenter();

        // Imovel Info (SIGEF)
        this.updateFloatingImovelInfo(this.state.sigefExcelInfo);

        // Gráficos (Gráfico de área do uso do solo)
        if (resultSolo && resultSolo.relatorio) {
            this.createFloatingAreaChart(resultSolo.relatorio.classes, this.state.sigefExcelInfo);
            this.updateFloatingSummary(resultSolo.relatorio, metadados);
        } else {
            // Limpa grafico solo
            const cEl = document.getElementById('floatingAreaChart');
            if (cEl) {
                const ctx = cEl.getContext('2d');
                ctx.clearRect(0, 0, cEl.width, cEl.height);
            }
            const infoDiv = document.getElementById('floatingAnalysisInfo');
            if (infoDiv) infoDiv.innerHTML = '<div style="color: #e7ecff; font-size: 12px;">Uso do solo ausente.</div>';
        }

        // Legenda 
        if (baseResult.imagem_recortada && baseResult.imagem_recortada.legenda) {
            this.updateFloatingLegend(baseResult.imagem_recortada.legenda);
        }

        // Se temos bounds nos metadados, usar para posicionar o raster
        let bounds = null;
        if (metadados.bounds) {
            bounds = L.latLngBounds(metadados.bounds[0], metadados.bounds[1]);
        }

        // Se temos polígono desenhado ou SIGEF, usar seus bounds
        if (baseResult.isVirtual && this.state.drawnPolygon) {
            bounds = this.state.drawnPolygon.getBounds();
        }

        // A imagem recortada depende da TAB ATIVA, que será cuidada ao final pela 'setupVisualizationToggle'

        // Destacar polígono e fazer zoom
        // âœ… CORREÃ‡ÃƒO: EXIBIR CENTROIDE INDEPENDENTEMENTE DA ORIGEM DO POLÍGONO
        let centroidText = 'Não disponível';

        // Prioridade 1: Usar centroide do servidor se disponível
        if (baseResult.metadados && baseResult.metadados.centroide_display) {
            centroidText = baseResult.metadados.centroide_display;
        }
        // Prioridade 2: Calcular centroide no cliente para polígonos desenhados/SIGEF
        else if (baseResult.isVirtual && this.state.drawnPolygon) {
            const centroid = UTILS.calculateLeafletCentroid(this.state.drawnPolygon);
            if (centroid) {
                centroidText = `${centroid.latGMS}, ${centroid.lonGMS}`;
            }
        }
        // Prioridade 3: Calcular centroide no cliente para polígonos KML
        else {
            const feature = this.state.features.find(f => f.index === index);
            if (feature) {
                const centroid = UTILS.calculateCentroid(feature.geometry);
                if (centroid) {
                    centroidText = `${centroid.latGMS}, ${centroid.lonGMS}`;
                }
            }
        }

        // âœ… EXIBIR NO PAINEL FLUTUANTE - INFORMAÃ‡Ã•ES DO IMÃ“VEL
        setText('floatingCentroid', centroidText);
        this.state.currentCentroid = centroidText; // âœ… ATUALIZAR O STATE PARA USO NO PDF

        // Nome do arquivo
        const nomeArquivo = baseResult.isVirtual ? 'Polígono desenhado' :
            baseResult.isSIGEF ? `Imóvel ${this.state.currentCodigoImo || baseResult.fileName}` :
                (baseResult.fileName || 'Arquivo sem nome').replace('.kml', '');
        setText('floatingFileName', nomeArquivo);

        // Código do imóvel (se disponível)
        const codigoImovel = this.state.currentCodigoImo ||
            (this.state.sigefExcelInfo && this.state.sigefExcelInfo[0] ?
                this.state.sigefExcelInfo[0].COD_NMRO_ICRA : '-');
        setText('floatingCodigoImovel', codigoImovel);

        // Município e UF
        const municipio = metadados.municipio || 'Não identificado';
        const uf = metadados.uf || 'Não identificado';
        setText('floatingMunicipio', municipio);
        setText('floatingUF', uf);

        // O Valor e informacoes especificas sao ativados logo acima (nas checagens do APP.state)

        // Destacar polígono e fazer zoom (se não estiver em modo skipZoom)
        if (!options.skipZoom) {
            if (baseResult.isVirtual && this.state.drawnPolygon) {
                // Para polígono desenhado, destacar o polígono desenhado
                this.state.drawnPolygon.setStyle({
                    color: '#ffeb3b',
                    weight: 5,
                    opacity: 1,
                    fillOpacity: 0
                });
                if (bounds) MAP.zoomToBounds(bounds);
            } else {
                MAP.highlightPolygon(index);
                MAP.zoomToPolygon(index);
            }
        }

        // Habilita a aba de declividade se ela existir nos metadados
        this.setupVisualizationToggle(index);
    },

    // Exibir resultados consolidados
    showAllResults: function () {
        this.state.currentPolygonIndex = -1;

        let areaTotal = 0;
        let classesCount = 0;
        const classesConsolidadas = {};

        this.state.analysisResults.forEach(result => {
            const relatorio = result.relatorio;
            areaTotal += relatorio.area_total_poligono_ha;
            classesCount = Math.max(classesCount, relatorio.numero_classes_encontradas);

            for (const [key, info] of Object.entries(relatorio.classes)) {
                const classNum = key.replace('Classe ', '');

                // âœ… CORREÃ‡ÃƒO: Pular APENAS classe 0, não todas
                if (classNum === '0') continue;
                if (!classesConsolidadas[key]) {
                    classesConsolidadas[key] = {
                        descricao: info.descricao,
                        area_ha: 0,
                        percentual: 0
                    };
                }
                classesConsolidadas[key].area_ha += info.area_ha;
            }
        });

        Object.keys(classesConsolidadas).forEach(key => {
            classesConsolidadas[key].percentual = (classesConsolidadas[key].area_ha / areaTotal) * 100;
        });

        const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
        setText('totalArea', `${areaTotal.toFixed(2)} ha`);
        // Formatar valor total consolidado (apenas se houver valoração em cache)
        let consolidatedValorTotal = 0;
        let hasValoracao = false;
        if (this.state.valoracaoCache) {
            Object.values(this.state.valoracaoCache).forEach(r => {
                if (r.relatorio && r.relatorio.valor_total_calculado) {
                    consolidatedValorTotal += parseFloat(r.relatorio.valor_total_calculado) || 0;
                    hasValoracao = true;
                }
            });
        }
        const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (hasValoracao) {
            setText('totalValue', nf.format(consolidatedValorTotal));
            const floatingTotalEl = document.getElementById('floatingTotalValue'); if (floatingTotalEl) floatingTotalEl.textContent = nf.format(consolidatedValorTotal);
        } else {
            setText('totalValue', '-');
            const floatingTotalEl = document.getElementById('floatingTotalValue'); if (floatingTotalEl) { floatingTotalEl.style.display = 'none'; floatingTotalEl.innerHTML = ''; }
        }
        setText('classesCount', Object.keys(classesConsolidadas).length);
        setText('methodUsed', 'Consolidado - Múltiplos polígonos');

        const classesTableEl = document.getElementById('classesTable');
        const classesTbody = classesTableEl ? classesTableEl.querySelector('tbody') : null;
        if (classesTbody) classesTbody.innerHTML = '';

        for (const [key, info] of Object.entries(classesConsolidadas)) {
            const classNum = key.replace('Classe ', '');

            // âœ… PULAR CLASSE 0
            if (classNum === '0') continue;

            const color = UTILS.CLASSES_CORES[classNum] || '#CCCCCC';

            const row = document.createElement('tr');
            row.innerHTML = `
            <td><div style="display:inline-block; width:12px; height:12px; background-color:${color}; margin-right:5px;"></div> ${classNum}</td>
            <td>${info.descricao}</td>
            <td>${nf.format(info.area_ha || 0)}</td>
            <td>${nf.format(info.percentual || 0)}%</td>
        `;

            if (classesTbody) classesTbody.appendChild(row);
        }

        setText('crsInfo', 'Vários (depende do polígono)');
        setText('spatialResolution', 'Vários (depende do polígono)');
        setText('clipDimensions', 'Múltiplos recortes');
        setText('pixelArea', 'Vários (depende do polígono)');

        // Atualizar gráfico com dados SIGEF consolidados
        this.createFloatingAreaChart(classesConsolidadas, null);

        const legendaConsolidada = [];
        Object.keys(classesConsolidadas).forEach(key => {
            const classNum = parseInt(key.replace('Classe ', ''));
            legendaConsolidada.push({
                classe: classNum,
                cor: UTILS.CLASSES_CORES[classNum] || '#CCCCCC',
                descricao: classesConsolidadas[key].descricao
            });
        });
        this.updateFloatingLegend(legendaConsolidada);

        setText('floatingCentroid', 'Centroide médio de todos os polígonos');

        // Remover destaque do polígono desenhado se houver
        if (this.state.drawnPolygon) {
            this.state.drawnPolygon.setStyle({
                color: '#4cc9f0',
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0
            });
        }

        MAP.highlightPolygon(-1);
        MAP.zoomToAllPolygons();
    },

    // === FUNÃ‡Ã•ES DELEGADAS PARA FloatingPanel ===

    createFloatingAreaChartDeclividade: function (classes, canvasId) { FloatingPanel.createAreaChartDeclividade(classes, canvasId); },
    createFloatingAreaChartAptidao: function (classes, canvasId) { FloatingPanel.createAreaChartAptidao(classes, canvasId); },
    createFloatingAreaChart: function (classes, sigefInfo, isDeclividade, canvasId) { FloatingPanel.createAreaChart(classes, sigefInfo, isDeclividade, canvasId); },
    addSigefLayerToChart: function (labels, data, colors) { FloatingPanel.addSigefLayerToChart(labels, data, colors); },
    mapSigefClassToColor: function (sigefClass) { return FloatingPanel.mapSigefClassToColor(sigefClass); },
    updateFloatingLegend: function (legendData) { FloatingPanel.updateLegend(legendData); },
    updateFloatingImovelInfo: function (info) { FloatingPanel.updateImovelInfo(info); },
    updateFloatingSummary: function (relatorio, metadados) { FloatingPanel.updateSummary(relatorio, metadados); },
    updateFloatingCenter: function () { FloatingPanel.updateCenter(); },
    updateFloatingCenterDeclividade: function (rel) { FloatingPanel.updateCenterDeclividade(rel); },
    updateFloatingChartDeclividade: function (rel) { FloatingPanel.updateChartDeclividade(rel); },
    updateFloatingChartAptidao: function (rel) { FloatingPanel.updateChartAptidao(rel); },
    switchChartTab: function (chartType) { FloatingPanel.switchChartTab(chartType); },
    setupVisualizationToggle: function (polygonIndex) { FloatingPanel.setupVisualizationToggle(polygonIndex); },
    switchVisualization: function (type, polygonIndex) { FloatingPanel.switchVisualization(type, polygonIndex); },
    updateFloatingCenterForType: function (type, polygonIndex) { FloatingPanel.updateCenterForType(type, polygonIndex); },
    updateFloatingChartForType: function (type, polygonIndex) { FloatingPanel.updateChartForType(type, polygonIndex); },

    // Gerar PDF
    generatePdf: function () {
        const hasSolo = this.state.analysisResults && this.state.analysisResults.length > 0;
        const hasDeclividade = typeof DecliviDADE !== 'undefined' && DecliviDADE.state && DecliviDADE.state.analysisResults && DecliviDADE.state.analysisResults.length > 0;
        const hasAptidao = typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.analysisResults && Aptidao.state.analysisResults.length > 0;

        if (!hasSolo && !hasDeclividade && !hasAptidao) return;

        if (this.state.currentPolygonIndex === -1) {
            const allDeclivity = hasDeclividade ? DecliviDADE.state.analysisResults : null;
            const allAptidao = hasAptidao ? Aptidao.state.analysisResults : null;
            PDF_GENERATOR.generateConsolidatedReport(
                hasSolo ? this.state.analysisResults : null,
                allDeclivity,
                allAptidao
            );
        } else {
            const idx = this.state.currentPolygonIndex;

            let currentResult = hasSolo ? this.state.analysisResults[idx] : null;
            let declivityResult = hasDeclividade ? DecliviDADE.state.analysisResults.find(r => r.fileIndex === idx) : null;
            let aptidaoResult = hasAptidao ? Aptidao.state.analysisResults.find(r => r.fileIndex === idx) : null;

            // Fallbacks se buscar por fileIndex falhar e os arrays tiverem tamanho 1 
            // (comum para analise de unico polygono dropado/desenhado)
            if (!declivityResult && hasDeclividade && DecliviDADE.state.analysisResults.length === 1) declivityResult = DecliviDADE.state.analysisResults[0];
            if (!aptidaoResult && hasAptidao && Aptidao.state.analysisResults.length === 1) aptidaoResult = Aptidao.state.analysisResults[0];

            // Se nao houver resultado de solo mas houver de outros, podemos tentar 'emprestar' os metadados basicos do primeiro disponivel
            if (!currentResult) {
                currentResult = declivityResult || aptidaoResult;
            }

            if (!currentResult) return; // Nenhuma informacao disponivel para o poligono

            // âœ… USAR CENTROIDE DO STATE EM VEZ DO ELEMENTO HTML
            const centroidEl = document.getElementById('floatingCentroid');
            let centroidText = this.state.currentCentroid || (centroidEl ? centroidEl.textContent : '');

            // Passar código do imóvel se disponível
            const propertyCode = this.state.currentPropertyCode || currentResult.propertyCode || null;

            PDF_GENERATOR.generate(
                hasSolo ? currentResult : null, // Manda null para Solo se so tiver decl/apti
                centroidText,
                currentResult.fileName,
                propertyCode,
                declivityResult,
                aptidaoResult
            );
        }
    },

    // Zoom in
    zoomIn: function () {
        if (MAP.state.useLeaflet && MAP.state.leafletMap) {
            MAP.state.leafletMap.zoomIn();
        }
    },

    // Zoom out
    zoomOut: function () {
        if (MAP.state.useLeaflet && MAP.state.leafletMap) {
            MAP.state.leafletMap.zoomOut();
        }
    },

    // Limpar
    clear: function () {
        this.state.features = [];
        this.state.currentFiles = [];
        this.state.analysisResults = [];
        this.state.allRastersLoaded = false;
        this.state.currentPolygonIndex = -1;
        this.state.drawnPolygon = null;
        this.state.sigefExcelInfo = null;
        this.state.currentCodigoImo = null;
        this.state.valoracaoCache = null;
        this.state.valoracaoFiles = [];
        this.state.valoracaoFeatures = [];

        // Limpar informações do SIGEF na UI
        const sigefSection = document.getElementById('floatingSigefSection');
        if (sigefSection) {
            sigefSection.remove();
        }

        // Limpar coluna da tabela mas manter o cabeçalho
        const classesTable = document.getElementById('classesTable');
        if (classesTable) {
            const tbody = classesTable.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.cells.length === 5) {
                        // Limpar conteúdo mas manter a célula
                        row.cells[4].innerHTML = '-';
                        row.cells[4].className = '';
                    }
                });
            }
        }

        const fileEl = document.getElementById('file'); if (fileEl) fileEl.value = '';
        this.updateAnalysisButtons(false);
        const btnGenEl = document.getElementById('btnGeneratePdf'); if (btnGenEl) btnGenEl.disabled = true;
        const resultSectionEl = document.getElementById('resultSection'); if (resultSectionEl) resultSectionEl.classList.remove('active');

        const polygonSelector = document.getElementById('polygonSelector');
        if (polygonSelector) {
            polygonSelector.remove();
        }

        const btnDrawEl = document.getElementById('btnDrawPolygon'); if (btnDrawEl) { btnDrawEl.classList.remove('active'); btnDrawEl.innerHTML = 'âœï¸ Desenhar Polígono'; }

        this.closeFloatingPanel();
        const fcEl = document.getElementById('floatingCentroid'); if (fcEl) fcEl.textContent = '';
        const flEl = document.getElementById('floatingLegendContent'); if (flEl) flEl.innerHTML = '';

        if (this.state.areaChart) {
            this.state.areaChart.destroy();
            this.state.areaChart = null;
        }

        const rasterDefaultEl = document.getElementById('rasterDefault');
        if (rasterDefaultEl) rasterDefaultEl.checked = true;
        this.state.rasterType = 'default';
        const rasterCustomUploadEl = document.getElementById('rasterCustomUpload');
        if (rasterCustomUploadEl) rasterCustomUploadEl.style.display = 'none';

        this.state.currentRasterInfo = {
            name: 'Padrão do sistema',
            resolution: '-',
            pixelArea: '-'
        };
        this.updateRasterInfo();

        MAP.clear();
        this.showStatus('Mapa limpo. Raster redefinido para padrão.', 'info');
    },

    // === PRO MODAL ===
    openProModal: function () {
        const modal = document.getElementById('proModal');
        if (modal) {
            // Reset to menu view
            document.getElementById('proMenu').style.display = 'block';
            document.getElementById('batchPanel').style.display = 'none';
            document.getElementById('valoracaoPanel').style.display = 'none';
            modal.style.display = 'flex';
        }
    },

    closeProModal: function () {
        const modal = document.getElementById('proModal');
        if (modal) modal.style.display = 'none';
    },

    showBatchPanel: function () {
        document.getElementById('proMenu').style.display = 'none';
        document.getElementById('batchPanel').style.display = 'block';
        document.getElementById('valoracaoPanel').style.display = 'none';
        this.updateBatchExecuteButton();
    },

    // === VALORAÇÃO PRO ===
    showValoracaoPanel: function () {
        document.getElementById('proMenu').style.display = 'none';
        document.getElementById('batchPanel').style.display = 'none';
        document.getElementById('valoracaoPanel').style.display = 'block';
        // Reset status
        const statusEl = document.getElementById('valoracaoStatus');
        if (statusEl) statusEl.style.display = 'none';

        // Auto-carregar polígonos da tela principal se disponíveis
        this._tryAutoLoadValoracaoFromMain();
    },

    // Auto-carregar polígonos da tela principal no painel de Valoração
    _tryAutoLoadValoracaoFromMain: function () {
        // Só auto-carregar se há features na tela principal e nenhuma no painel de Valoração
        if (this.state.features.length === 0 || this.state.valoracaoFeatures.length > 0) {
            return;
        }

        const statusEl = document.getElementById('valoracaoStatus');
        const selectorSection = document.getElementById('valoracaoPolygonSelectorSection');
        const select = document.getElementById('valoracaoPolygonSelect');
        const fileInputSection = document.getElementById('valoracaoFileInput').closest('.batch-section');

        // Resetar seletor
        if (select) select.innerHTML = '';
        if (selectorSection) selectorSection.style.display = 'none';

        // Popular valoracaoFeatures e valoracaoFiles a partir de state.features
        this.state.valoracaoFeatures = [];
        this.state.valoracaoFiles = [];

        this.state.features.forEach((feat, i) => {
            // Criar GeoJSON feature a partir da geometria armazenada
            const feature = {
                type: 'Feature',
                properties: { name: feat.name },
                geometry: feat.geometry
            };
            this.state.valoracaoFeatures.push(feature);

            // Usar o arquivo virtual já criado ou criar um novo
            if (feat.originalFile) {
                this.state.valoracaoFiles.push(feat.originalFile);
            } else {
                const fc = { type: 'FeatureCollection', features: [feature] };
                const blob = new Blob([JSON.stringify(fc)], { type: 'application/geo+json' });
                const vFile = new File([blob], `${feat.name}.geojson`, { type: 'application/geo+json' });
                this.state.valoracaoFiles.push(vFile);
            }
        });

        // Esconder a seção de upload de arquivo (polígono já carregado)
        if (fileInputSection) {
            fileInputSection.style.display = 'none';
        }

        // Mostrar seletor se múltiplos polígonos
        if (this.state.valoracaoFeatures.length > 1 && select && selectorSection) {
            selectorSection.style.display = 'block';
            this.state.valoracaoFeatures.forEach((feature, i) => {
                const name = feature.properties?.name || `Polígono ${i + 1}`;
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = name;
                select.appendChild(opt);
            });

            // Highlight ao mudar seleção
            select.addEventListener('change', (e) => {
                MAP.highlightPolygon(parseInt(e.target.value));
                MAP.zoomToPolygon(parseInt(e.target.value));
            });
        }

        // Habilitar botão de valoração
        document.getElementById('btnExecuteValoracao').disabled = false;

        // Mostrar status
        if (statusEl) {
            const count = this.state.valoracaoFeatures.length;
            statusEl.style.display = 'block';
            statusEl.style.background = 'rgba(76,201,240,0.15)';
            statusEl.style.color = '#e7ecff';
            statusEl.textContent = count > 1
                ? `${count} polígonos carregados automaticamente da tela principal. Selecione o polígono e clique em "Valor do Imóvel".`
                : 'Polígono carregado automaticamente da tela principal. Clique em "Valor do Imóvel" para calcular.';
        }
    },

    selectValoracaoPolygonOnMap: function () {
        // Close modal so user can see the map
        this.closeProModal();
        this.showStatus('Clique no polígono desejado no mapa para selecioná-lo.', 'info');

        // Set up temporary click handlers on each polygon
        const self = this;
        this._valoracaoMapClickHandlers = [];

        this.state.valoracaoFeatures.forEach((feature, i) => {
            const polygonLayer = MAP.state.polygonLayers[i];
            if (polygonLayer) {
                // Highlight all polygons so they're visible
                polygonLayer.setStyle({ fillOpacity: 0.15, weight: 3 });

                const handler = () => {
                    self._onValoracaoPolygonMapClick(i);
                };
                polygonLayer.on('click', handler);
                self._valoracaoMapClickHandlers.push({ layer: polygonLayer, handler });
            }
        });
    },

    _onValoracaoPolygonMapClick: function (selectedIndex) {
        // Remove temporary click handlers
        if (this._valoracaoMapClickHandlers) {
            this._valoracaoMapClickHandlers.forEach(({ layer, handler }) => {
                layer.off('click', handler);
            });
            this._valoracaoMapClickHandlers = null;
        }

        // Highlight the selected polygon
        MAP.highlightPolygon(selectedIndex);
        MAP.zoomToPolygon(selectedIndex);

        // Update the dropdown to match
        const select = document.getElementById('valoracaoPolygonSelect');
        if (select) select.value = selectedIndex;

        // Reopen the PRO modal at the Valoração panel
        const modal = document.getElementById('proModal');
        if (modal) {
            document.getElementById('proMenu').style.display = 'none';
            document.getElementById('batchPanel').style.display = 'none';
            document.getElementById('valoracaoPanel').style.display = 'block';
            modal.style.display = 'flex';
        }

        // Update status
        const name = (this.state.valoracaoFeatures[selectedIndex]?.properties?.name ||
            this.state.valoracaoFeatures[selectedIndex]?.properties?.Nome ||
            this.state.valoracaoFeatures[selectedIndex]?.properties?.NAME ||
            `Polígono ${selectedIndex + 1}`);
        const statusEl = document.getElementById('valoracaoStatus');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.background = 'rgba(76,201,240,0.15)';
            statusEl.style.color = '#e7ecff';
            statusEl.textContent = `Polígono selecionado: ${name}`;
        }

        this.showStatus(`Polígono "${name}" selecionado. Clique em "Valor do Imóvel" para calcular.`, 'success');
    },

    handleValoracaoFileUpload: async function () {
        const fileInput = document.getElementById('valoracaoFileInput');
        if (!fileInput.files.length) return;

        const file = fileInput.files[0];
        const statusEl = document.getElementById('valoracaoStatus');
        const selectorSection = document.getElementById('valoracaoPolygonSelectorSection');
        const select = document.getElementById('valoracaoPolygonSelect');

        // Reset
        select.innerHTML = '';
        selectorSection.style.display = 'none';
        this.state.valoracaoFiles = [];
        this.state.valoracaoFeatures = [];

        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(76,201,240,0.1)';
        statusEl.style.color = '#e7ecff';
        statusEl.textContent = 'Processando arquivo...';

        try {
            const ext = file.name.split('.').pop().toLowerCase();
            let features = [];

            if (['zip', 'kmz', 'gpkg'].includes(ext)) {
                // Binary files: convert via backend
                const formData = new FormData();
                formData.append('file', file);
                const resp = await fetch('/convert_to_geojson', { method: 'POST', body: formData });
                const data = await resp.json();
                if (data.status === 'sucesso' && data.geojson) {
                    features = (data.geojson.features || []).filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
                } else {
                    throw new Error(data.mensagem || 'Falha na conversão');
                }
            } else {
                // Text-based files: parse locally
                const text = await file.text();
                let geojson;
                if (ext === 'kml') {
                    // Use DOMParser for KML
                    const parser = new DOMParser();
                    const kmlDoc = parser.parseFromString(text, 'text/xml');
                    // Simple KML→GeoJSON inline for validation
                    // Actually, send to backend for proper parsing
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch('/convert_to_geojson', { method: 'POST', body: formData });
                    const data = await resp.json();
                    if (data.status === 'sucesso' && data.geojson) {
                        geojson = data.geojson;
                    } else {
                        throw new Error(data.mensagem || 'Falha na conversão');
                    }
                } else {
                    geojson = JSON.parse(text);
                }
                features = (geojson.features || []).filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
            }

            if (features.length === 0) {
                throw new Error('Nenhum polígono encontrado no arquivo.');
            }

            this.state.valoracaoFeatures = features;

            // Clear main map and show polygons
            MAP.clear();

            // Create virtual files for each feature
            features.forEach((feature, i) => {
                const fc = { type: 'FeatureCollection', features: [feature] };
                const blob = new Blob([JSON.stringify(fc)], { type: 'application/geo+json' });
                const name = (feature.properties && (feature.properties.name || feature.properties.Nome || feature.properties.NAME)) || `Polígono ${i + 1}`;
                const vFile = new File([blob], `${name}.geojson`, { type: 'application/geo+json' });
                this.state.valoracaoFiles.push(vFile);

                // Add to map
                try {
                    const coords = feature.geometry.type === 'Polygon' ?
                        feature.geometry.coordinates[0] :
                        feature.geometry.coordinates[0][0];
                    const colors = ['#4cc9f0', '#f04c7c', '#4cf0a7', '#f0a74c', '#a74cf0'];
                    MAP.addPolygon(coords, name, colors[i % colors.length], i);
                } catch (e) {
                    console.warn('Erro ao adicionar polígono ao mapa:', e);
                }
            });

            MAP.zoomToAllPolygons();

            if (features.length > 1) {
                // Show polygon selector
                selectorSection.style.display = 'block';
                features.forEach((feature, i) => {
                    const name = (feature.properties && (feature.properties.name || feature.properties.Nome || feature.properties.NAME)) || `Polígono ${i + 1}`;
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = name;
                    select.appendChild(opt);
                });

                // Highlight selected polygon on change
                select.addEventListener('change', (e) => {
                    MAP.highlightPolygon(parseInt(e.target.value));
                    MAP.zoomToPolygon(parseInt(e.target.value));
                });

                statusEl.textContent = `${features.length} polígonos encontrados. Selecione o polígono para valoração.`;
            } else {
                statusEl.textContent = 'Polígono carregado com sucesso.';
            }

            statusEl.style.background = 'rgba(76,201,240,0.15)';
            document.getElementById('btnExecuteValoracao').disabled = false;
        } catch (error) {
            console.error('Erro ao processar arquivo de valoração:', error);
            statusEl.style.background = 'rgba(240,76,124,0.1)';
            statusEl.style.color = '#f04c7c';
            statusEl.textContent = `Erro: ${error.message}`;
            document.getElementById('btnExecuteValoracao').disabled = true;
            document.getElementById('btnValoracaoPdf').disabled = true;
        }
    },

    executeValoracao: async function () {
        if (this.state.valoracaoFiles.length === 0) {
            this.showStatus('Nenhum arquivo carregado para valoração.', 'error');
            return;
        }

        const statusEl = document.getElementById('valoracaoStatus');
        const selectedIndex = this.state.valoracaoFeatures.length > 1 ?
            parseInt(document.getElementById('valoracaoPolygonSelect').value) : 0;

        const file = this.state.valoracaoFiles[selectedIndex];
        if (!file) {
            this.showStatus('Polígono não encontrado.', 'error');
            return;
        }

        // Close modal and show progress
        this.closeProModal();
        this.showProgress('Calculando valoração...', 0, 1);
        this.showStatus('Executando valoração do imóvel...', 'info');

        try {
            const formData = new FormData();
            formData.append('kml', file);
            const rasterType = localStorage.getItem('rasterType') || 'com_mosaico';
            formData.append('raster_type', rasterType);
            formData.append('enable_valoracao', 'true'); // ✅ PRO: valoração habilitada
            formData.append('file_index', selectedIndex.toString());

            const response = await fetch('/analisar', { method: 'POST', body: formData });
            const data = await response.json();

            if (data.status === 'sucesso') {
                // Store in cache
                if (!this.state.valoracaoCache) this.state.valoracaoCache = {};
                this.state.valoracaoCache[selectedIndex] = {
                    ...data,
                    fileName: file.name,
                    fileIndex: selectedIndex
                };

                // Also merge into analysisResults for floating panel compatibility
                if (!this.state.analysisResults[selectedIndex]) {
                    this.state.analysisResults[selectedIndex] = {
                        ...data,
                        fileName: file.name,
                        fileIndex: selectedIndex
                    };
                }

                // Show results on floating panel
                this.state.currentPolygonIndex = selectedIndex;
                const panel = document.getElementById('floatingPanel');
                if (panel) {
                    panel.style.display = 'block';
                    if (!panel.classList.contains('maximized')) {
                        panel.classList.add('compact');
                    }
                }
                this.showPolygonResult(selectedIndex, { skipZoom: false });

                // Add raster if available
                if (data.imagem_recortada && data.imagem_recortada.base64) {
                    const bounds = MAP.getPolygonBounds(selectedIndex);
                    if (bounds) {
                        MAP.addRasterForPolygon(selectedIndex, data.imagem_recortada.base64, bounds);
                    }
                }

                document.getElementById('btnGeneratePdf').disabled = false;
                document.getElementById('opacityControl').style.display = 'flex';

                this.hideProgress();
                this.showStatus('Valoração concluída com sucesso!', 'success');

                // Enable PDF button in PRO panel
                document.getElementById('btnValoracaoPdf').disabled = false;
            } else {
                throw new Error(data.mensagem || 'Erro na análise');
            }
        } catch (error) {
            console.error('Erro na valoração:', error);
            this.hideProgress();
            this.showStatus(`Erro na valoração: ${error.message}`, 'error');
        }
    },

    generateValoracaoPdf: function () {
        if (!this.state.valoracaoCache) {
            this.showStatus('Execute a valoração antes de gerar o relatório.', 'error');
            return;
        }

        // Find the first cached result
        const keys = Object.keys(this.state.valoracaoCache);
        if (keys.length === 0) {
            this.showStatus('Nenhum resultado de valoração disponível.', 'error');
            return;
        }

        const idx = parseInt(keys[0]);
        const cachedResult = this.state.valoracaoCache[idx];

        if (!cachedResult) return;

        // Get centroid
        let centroidText = '';
        if (cachedResult.metadados && cachedResult.metadados.centroide_display) {
            centroidText = cachedResult.metadados.centroide_display;
        }

        // Use the PDF generator with valoração data
        PDF_GENERATOR.generate(
            cachedResult,
            centroidText,
            cachedResult.fileName || 'Valoração',
            null,
            null,
            null
        );
    },

    selectOutputFolder: async function () {
        if (!window.showDirectoryPicker) {
            this.showStatus('Seu navegador não suporta seleção de pasta. O arquivo será baixado na pasta de downloads padrão.', 'warn');
            return;
        }
        try {
            this.state.batchOutputDir = await window.showDirectoryPicker({ mode: 'readwrite' });
            document.getElementById('selectedFolderPath').textContent = this.state.batchOutputDir.name;
        } catch (e) {
            // User cancelled
            if (e.name !== 'AbortError') {
                console.error('Erro ao selecionar pasta:', e);
            }
        }
    },

    updateBatchExecuteButton: function () {
        const hasFile = document.getElementById('batchFileInput').files.length > 0;
        const hasAnalysis = document.getElementById('chkUsoSolo').checked ||
            document.getElementById('chkDeclividade').checked ||
            document.getElementById('chkAptidao').checked;
        document.getElementById('btnExecuteBatch').disabled = !(hasFile && hasAnalysis);
    },

    executeBatchAnalysis: async function () {
        const fileInput = document.getElementById('batchFileInput');
        if (fileInput.files.length === 0) {
            this.showStatus('Selecione um arquivo para análise em lote.', 'error');
            return;
        }

        const analises = [];
        if (document.getElementById('chkUsoSolo').checked) analises.push('uso_solo');
        if (document.getElementById('chkDeclividade').checked) analises.push('declividade');
        if (document.getElementById('chkAptidao').checked) analises.push('aptidao');

        if (analises.length === 0) {
            this.showStatus('Selecione pelo menos uma análise.', 'error');
            return;
        }

        // Close modal
        this.closeProModal();

        // Show progress
        this.showProgress('Iniciando análise em lote...', 0, 1);
        this.showStatus('Análise em lote em andamento...', 'info');

        try {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('analises', JSON.stringify(analises));
            const currentRasterType = localStorage.getItem('rasterType') || 'com_mosaico';
            formData.append('raster_type', currentRasterType);
            const includeCentroid = document.getElementById('chkIncludeCentroid').checked;
            formData.append('include_centroid', includeCentroid ? 'true' : 'false');
            const includeWkt = document.getElementById('chkIncludeWkt').checked;
            formData.append('include_wkt', includeWkt ? 'true' : 'false');

            // Start polling progress
            const taskId = Date.now().toString();
            formData.append('task_id', taskId);
            const progressInterval = setInterval(async () => {
                try {
                    const resp = await fetch(`/analisar-lote-progresso/${taskId}`);
                    if (resp.ok) {
                        const prog = await resp.json();
                        if (prog.total > 0) {
                            const label = prog.label || 'Processando...';
                            this.showProgress(label, prog.current, prog.total);
                        }
                    }
                } catch (e) { /* ignore polling errors */ }
            }, 2000);

            const response = await fetch('/analisar-lote-completo', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.mensagem || 'Falha ao processar análise em lote.');
            }

            const blob = await response.blob();
            const filename = 'analise_lote_' + new Date().toISOString().split('T')[0] + '.csv';

            // Try to save to selected folder, otherwise download normally
            if (this.state.batchOutputDir) {
                try {
                    const fileHandle = await this.state.batchOutputDir.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    this.showStatus(`CSV salvo em: ${this.state.batchOutputDir.name}/${filename}`, 'success');
                } catch (e) {
                    console.warn('Falha ao salvar na pasta selecionada, fazendo download padrão:', e);
                    this._downloadBlob(blob, filename);
                }
            } else {
                this._downloadBlob(blob, filename);
            }

            this.hideProgress();
            this.showStatus('Análise em lote concluída! CSV gerado com sucesso.', 'success');
        } catch (error) {
            console.error('Erro na análise em lote:', error);
            this.hideProgress();
            this.showStatus(error.message, 'error');
        }
    },

    _downloadBlob: function (blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    // Exibir barra de progresso de análise
    showProgress: function (label, current, total) {
        let progressEl = document.getElementById('analysisProgressBar');
        if (!progressEl) {
            // Remover mensagens de status existentes para não acumular
            document.querySelectorAll('.status').forEach(el => el.remove());

            progressEl = document.createElement('div');
            progressEl.id = 'analysisProgressBar';
            progressEl.className = 'analysis-progress-bar';
            progressEl.innerHTML = `
                <div class="progress-label">
                    <span class="progress-text"></span>
                    <span class="progress-pct"></span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            `;
            document.querySelector('aside').insertBefore(progressEl, document.getElementById('resultSection'));
        }

        const pct = Math.round((current / total) * 100);
        progressEl.querySelector('.progress-text').textContent = label;
        progressEl.querySelector('.progress-pct').textContent = `${current}/${total} (${pct}%)`;
        progressEl.querySelector('.progress-fill').style.width = `${pct}%`;
    },

    // Esconder barra de progresso
    hideProgress: function () {
        const progressEl = document.getElementById('analysisProgressBar');
        if (progressEl) {
            // Animar para 100% antes de remover
            progressEl.querySelector('.progress-fill').style.width = '100%';
            setTimeout(() => { progressEl.remove(); }, 500);
        }
    },

    // Exibir mensagem de status
    showStatus: function (message, type = 'info') {
        document.querySelectorAll('.status').forEach(el => el.remove());

        const statusEl = document.createElement('div');
        statusEl.className = `status ${type}`;
        statusEl.textContent = message;

        document.querySelector('aside').insertBefore(statusEl, document.getElementById('resultSection'));

        if (type !== 'error') {
            setTimeout(() => {
                statusEl.remove();
            }, 5000);
        }
    }
};

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    APP.init();
});

