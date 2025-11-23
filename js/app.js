// Aplicação principal
const APP = {
// SUBSTITUA o state existente por:
    state: {
        features: [],
        currentFiles: [],
        currentRasterFile: null,
        analysisResults: [],
        areaChart: null,
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
        sigefExcelInfo: null,
        currentCodigoImo: null,
        // === NOVOS ESTADOS ADICIONADOS ===
        analysisCache: new Map(),
        searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
        settings: JSON.parse(localStorage.getItem('appSettings') || '{}'),
        isPanelPinned: false,
        searchTimeout: null
    },
    
    // Inicialização
    // SUBSTITUA a função init por:
    init: function() {
        this.loadTheme(); // Carregar tema antes de tudo
        this.setupEventListeners();
        this.loadUserPreferences(); // NOVA LINHA
        MAP.initLeaflet();
        MAP.showMapBase();
        
    const satTextEl = document.getElementById('satelliteDateText');
    if (satTextEl) satTextEl.textContent = 'n/a';
        this.updateRasterInfo();
        this.populateSearchHistory(); // NOVA LINHA
        
        // Atalhos de teclado
        this.setupKeyboardShortcuts(); // NOVA LINHA
    },

            // === NOVAS FUNÇÕES ADICIONADAS ===

        // Configurar atalhos de teclado
        setupKeyboardShortcuts: function() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch(e.key) {
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
        loadUserPreferences: function() {
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
        saveUserPreferences: function() {
            this.state.settings.opacity = parseFloat(document.getElementById('opacitySlider').value);
            this.state.settings.panelPinned = this.state.isPanelPinned;
            localStorage.setItem('appSettings', JSON.stringify(this.state.settings));
        },

        // Popular histórico de busca
        populateSearchHistory: function() {
            const datalist = document.getElementById('codigoHistory');
            const history = this.state.searchHistory.slice(0, 10);
            datalist.innerHTML = history.map(code => 
                `<option value="${code}">${code}</option>`
            ).join('');
        },

        // === GERENCIAMENTO DE TEMAS ===
        
    // Abrir modal de configurações
    openSettings: function() {
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
        closeSettings: function() {
            const modal = document.getElementById('settingsModal');
            if (modal) {
                modal.style.display = 'none';
            }
        },
        
    // Aplicar tema
    applyTheme: function(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.state.settings.theme = theme;
        this.saveUserPreferences();
        
        // Atualizar gráfico se existir
        if (this.state.areaChart) {
            const isLightTheme = theme === 'light';
            const legendColor = isLightTheme ? '#1a1a1a' : '#ffffff';
            const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 31, 58, 0.95)';
            const tooltipText = isLightTheme ? '#1a1a1a' : '#ffffff';
            const tooltipBorder = isLightTheme ? '#dee2e6' : '#4a5683';
            
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
            console.log('Tema aplicado ao gráfico:', theme, '| Cor legenda:', legendColor);
        }
    },
    
    // Aplicar tipo de raster
    applyRasterType: function(rasterType) {
        this.state.settings.rasterType = rasterType;
        localStorage.setItem('rasterType', rasterType);
        this.saveUserPreferences();
        
        // Informar ao usuário que a mudança será aplicada na próxima análise
        const rasterName = rasterType === 'com_mosaico' 
            ? 'LULC_VALORACAO_10m_com_mosaico.tif' 
            : 'Brasil_LULC_10m_sem_mosaico_DW.tif';
        this.showStatus(`Tipo de raster alterado para: ${rasterName}. Será aplicado na próxima análise.`, 'success');
    },        // Carregar tema salvo
        loadTheme: function() {
            const savedTheme = localStorage.getItem('theme') || 'auto';
            this.applyTheme(savedTheme);
        },

        // Adicionar ao histórico de busca
        addToSearchHistory: function(codigo) {
            const history = this.state.searchHistory.filter(c => c !== codigo);
            history.unshift(codigo);
            this.state.searchHistory = history.slice(0, 20);
            localStorage.setItem('searchHistory', JSON.stringify(this.state.searchHistory));
            this.populateSearchHistory();
        },

        // Alternar painel de histórico
        toggleHistoryPanel: function() {
            const panel = document.getElementById('historyPanel');
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.loadHistory();
            }
        },

        // Carregar histórico de análises
        loadHistory: function() {
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
        saveToHistory: function(analysisResult) {
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
        loadFromHistory: function(index) {
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
        deleteFromHistory: function(index) {
            const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
            history.splice(index, 1);
            localStorage.setItem('analysisHistory', JSON.stringify(history));
            this.loadHistory();
            this.showStatus('Análise excluída do histórico.', 'info');
        },

        // Fixar/desfixar painel
        togglePanelPin: function() {
            this.state.isPanelPinned = !this.state.isPanelPinned;
            const btn = document.getElementById('btnPinPanel');
            btn.textContent = this.state.isPanelPinned ? '📌' : '📌';
            btn.title = this.state.isPanelPinned ? 'Painel fixado' : 'Fixar painel';
            this.saveUserPreferences();
        },
    // Configurar event listeners
    setupEventListeners: function() {
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
        document.getElementById('btnShowMap').addEventListener('click', () => MAP.showMapBase());
        document.getElementById('btnShowSatellite').addEventListener('click', () => MAP.showSatelliteBase());
        document.getElementById('btnShowNone').addEventListener('click', () => MAP.hideBaseMap());
        
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

        // Novos listeners para funcionalidades adicionadas
        document.getElementById('btnHistory').addEventListener('click', () => this.toggleHistoryPanel());
        document.getElementById('btnCloseHistory').addEventListener('click', () => this.toggleHistoryPanel());
        document.getElementById('btnPinPanel').addEventListener('click', () => this.togglePanelPin());

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

        // Salvar preferências quando opacidade mudar
        document.getElementById('opacitySlider').addEventListener('change', () => this.saveUserPreferences());
    },

    // Funções de formatação PT-BR
formatNumberPTBR: function(value, decimals = 2) {
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

formatCurrencyPTBR: function(value) {
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
searchImovel: async function() {
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
processSearchResult: function(data, codigo) {
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
        document.getElementById('btnAnalyze').disabled = false;
        this.showStatus(`Imóvel ${codigo} carregado no mapa.`, 'success');
        
        this.loadSigefExcelInfo(codigo);
        
        try {
            const bounds = layer.getBounds();
            MAP.zoomToBounds(bounds);
        } catch (e) {}
    }
},

// Nova função para carregar informações do Excel SIGEF
loadSigefExcelInfo: async function(codigo) {
    try {
        const resp = await fetch(`/api/sigef_excel_info?codigo=${encodeURIComponent(codigo)}`);
        const data = await resp.json();
        
        if (data.status === 'sucesso') {
            this.state.sigefExcelInfo = data.dados;
            this.showStatus('Informações cadastrais do BB carregadas.', 'success');
            this.updateSigefInfoInUI();
        } else {
            this.state.sigefExcelInfo = null;
            console.warn('Não foram encontradas informações cadastrais para este imóvel');
        }
    } catch (error) {
        console.error('Erro ao carregar informações do Excel SIGEF:', error);
        this.state.sigefExcelInfo = null;
    }
},

// Função para atualizar a UI com informações do SIGEF
updateSigefInfoInUI: function() {
    const info = this.state.sigefExcelInfo;
    if (!info) return;

    // Atualizar painel flutuante
    this.updateFloatingSigefInfo(info);
    
    // Atualizar tabela de classes
    this.updateClassesTableWithSigefInfo(info);
},

// Nova função para consolidar informações SIGEF de todos os polígonos
getConsolidatedSigefInfo: function() {
    if (!this.state.sigefExcelInfo) return null;
    
    // Se já temos informações SIGEF, retornar consolidado
    const allSigefInfo = [];
    this.state.analysisResults.forEach(result => {
        if (result.sigefInfo) {
            allSigefInfo.push(...result.sigefInfo);
        }
    });
    
    return allSigefInfo.length > 0 ? allSigefInfo : this.state.sigefExcelInfo;
},

// Atualizar painel flutuante com informações do SIGEF
updateFloatingSigefInfo: function(info) {
    const sigefInfoDiv = document.getElementById('floatingSigefInfo');
    if (sigefInfoDiv) {
        let html = '';
        
        // Agrupar informações por tipo para resumo
        const groupedInfo = this.processSigefInfoByType(info);
        
        // Resumo por classe
        html += '<div class="sigef-summary">';
        html += '<strong>Resumo por Classe:</strong>';
        Object.keys(groupedInfo).forEach(classe => {
            const classInfo = groupedInfo[classe];
            html += `<div class="sigef-class-item">`;
            html += `<span class="sigef-class-name">${classe}</span>`;
            if (classInfo.totalArea) {
                html += `<span class="sigef-class-area">${classInfo.totalArea} ha</span>`;
            }
            html += `</div>`;
        });
        html += '</div>';

        sigefInfoDiv.innerHTML = html || '<div class="sigef-item">Nenhuma informação adicional disponível</div>';
    }
},

// Modifique a função updateClassesTableWithSigefInfo:

updateClassesTableWithSigefInfo: function(info) {
    const classesTable = document.getElementById('classesTable');
    if (!classesTable) return;

    // Adicionar coluna "Cadastro BB" se não existir
    const headerRow = classesTable.querySelector('thead tr');
    if (headerRow && !headerRow.querySelector('th:nth-child(5)')) {
        const newHeader = document.createElement('th');
        newHeader.textContent = 'Cadastro BB';
        newHeader.title = 'Informações do Cadastro BB - Classe e Área';
        headerRow.appendChild(newHeader);
    }

    // Processar informações do SIGEF
    const sigefGrouped = this.processSigefInfoForTable(info);
    
    // Atualizar células existentes
    const tbody = classesTable.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        // Adicionar célula para Cadastro BB se não existir
        if (row.cells.length === 4) {
            const bbCell = row.insertCell(4);
            bbCell.className = 'sigef-data-cell';
            
            // Obter informações SIGEF para esta linha
            const classInfo = this.getSigefInfoForTableRow(row, sigefGrouped);
            bbCell.innerHTML = classInfo.html;
            
            if (classInfo.hasMatch) {
                bbCell.classList.add('comparison-match');
            }
        } else if (row.cells.length === 5) {
            // Atualizar célula existente
            const bbCell = row.cells[4];
            const classInfo = this.getSigefInfoForTableRow(row, sigefGrouped);
            bbCell.innerHTML = classInfo.html;
            bbCell.className = 'sigef-data-cell' + (classInfo.hasMatch ? ' comparison-match' : '');
        }
    });
},

// Nova função para processar informações SIGEF para tabela
processSigefInfoForTable: function(sigefInfo) {
    const grouped = {};
    
    if (!sigefInfo || sigefInfo.length === 0) return grouped;
    
    sigefInfo.forEach(item => {
        const classeBB = item.CLASSES_BB || item.CLASSE_BB || item.CLASSES || item.CLASSE || 'Não informado';
        const area = item.QT_AREA_TIP_SOLO || item.AREA || item.AREA_HA || item.AREA_TOTAL;
        
        if (!grouped[classeBB]) {
            grouped[classeBB] = {
                classe: classeBB,
                areas: [],
                registros: 0
            };
        }
        
        if (area) {
            grouped[classeBB].areas.push(parseFloat(area) || 0);
        }
        grouped[classeBB].registros++;
    });
    
    // Calcular totais
    Object.keys(grouped).forEach(classe => {
        if (grouped[classe].areas.length > 0) {
            const totalArea = grouped[classe].areas.reduce((sum, area) => sum + area, 0);
            grouped[classe].totalArea = totalArea.toFixed(2);
            grouped[classe].avgArea = (totalArea / grouped[classe].areas.length).toFixed(2);
        }
    });
    
    return grouped;
},

// Função para obter informações SIGEF para uma linha específica da tabela
getSigefInfoForTableRow: function(row, sigefInfo) {
    const classCell = row.cells[0];
    const classText = classCell.textContent.trim();
    const classNum = classText.replace(/[^\d]/g, '');
    
    if (!classNum || !sigefInfo || sigefInfo.length === 0) {
        return { html: '-', hasMatch: false };
    }
    
    // BUSCA DIRETA POR DN_BB
    const matchingRecords = sigefInfo.filter(item => {
        const dnBB = item.DN_BB || item.dn_bb;
        return dnBB && parseInt(dnBB) === parseInt(classNum);
    });
    
    if (matchingRecords.length > 0) {
        const areaTotal = matchingRecords.reduce((total, item) => {
            const area = parseFloat(item.QT_AREA_TIP_SOLO) || 0;
            return total + area;
        }, 0);
        
        const primeiraDescricao = matchingRecords[0].CLASSES_BB || matchingRecords[0].CLASSE_BB || 'N/I';
        
        let html = `<div class="sigef-class-match">`;
        html += `<strong>${classNum} - ${primeiraDescricao}</strong>`;
        html += `<br><small>${areaTotal.toFixed(1)} ha (${matchingRecords.length} reg.)</small>`;
        html += `</div>`;
        
        return { html: html, hasMatch: true };
    }
    
    return { html: 'Sem correspondência', hasMatch: false };
},

// Função auxiliar para verificar correspondência entre classes
classesMatch: function(analysisClass, sigefClass) {
    const analysisNum = parseInt(analysisClass);
    const sigefUpper = sigefClass.toUpperCase();
    
    const mapping = {
        1: ['LAVOURA', 'ANUAL', 'AGRÍCOLA'],
        2: ['PERENE', 'FRUTÍFERAS', 'ARBÓREA'],
        3: ['PASTAGEM', 'CULTIVADA', 'PLANTADA'],
        4: ['NATIVA', 'CAMPO', 'CERrado'],
        5: ['DEGRADADA', 'EROSÃO', 'DESGASTE'],
        6: ['SILVICULTURA', 'FLORESTAL', 'REFLORESTAMENTO'],
        8: ['PRESERVAÇÃO', 'APP', 'RL', 'RESERVA'],
        9: ['AQUÁTICA', 'LAGO', 'RIO', 'ÁGUA'],
        10: ['CONSTRUÇÃO', 'BENFEITORIA', 'EDIFICAÇÃO'],
        100: ['INDEFINIDO', 'OUTROS', 'DIVERSOS']
    };
    
    if (mapping[analysisNum]) {
        return mapping[analysisNum].some(keyword => 
            sigefUpper.includes(keyword.toUpperCase())
        );
    }
    
    return false;
},
// Nova função para processar informações do SIGEF agrupadas por tipo
processSigefInfoByType: function(sigefInfo) {
    const grouped = {};
    
    sigefInfo.forEach(item => {
        const classeBB = item.CLASSES_BB || item.CLASSE_BB || item.CLASSES || item.CLASSE;
        const area = item.QT_AREA_TIP_SOLO || item.AREA || item.AREA_HA;
        
        if (classeBB) {
            if (!grouped[classeBB]) {
                grouped[classeBB] = {
                    classes: classeBB,
                    areas: []
                };
            }
            if (area) {
                grouped[classeBB].areas.push(parseFloat(area) || 0);
            }
        }
    });
    
    // Calcular totais para cada classe
    Object.keys(grouped).forEach(classe => {
        if (grouped[classe].areas.length > 0) {
            const totalArea = grouped[classe].areas.reduce((sum, area) => sum + area, 0);
            grouped[classe].totalArea = totalArea.toFixed(2);
        }
    });
    
    return grouped;
},

// Nova função para obter informações do SIGEF para uma classe específica
getSigefInfoForClass: function(classNum, sigefInfoByType) {
    if (!classNum || !sigefInfoByType) return '';
    
    // Mapeamento de classes (ajuste conforme necessário)
    const classMapping = {
        '1': ['LAVOURA', 'ANUAL', 'AGRICOLA'],
        '2': ['PERENE', 'FRUTÍFERAS', 'ARBÓREA'],
        '3': ['PASTAGEM', 'CULTIVADA', 'PLANTADA'],
        '4': ['NATIVA', 'CAMPO', 'CERrado'],
        '5': ['DEGRADADA', 'EROSÃO', 'DESGASTE'],
        '6': ['SILVICULTURA', 'FLORESTAL', 'REFLORESTAMENTO'],
        '8': ['PRESERVAÇÃO', 'APP', 'RL', 'RESERVA'],
        '9': ['AQUÁTICA', 'LAGO', 'RIO', 'ÁGUA'],
        '10': ['CONSTRUÇÃO', 'BENFEITORIA', 'EDIFICAÇÃO'],
        '100': ['INDEFINIDO', 'OUTROS']
    };
    
    let matchedInfo = '';
    
    // Procurar correspondência direta
    Object.keys(sigefInfoByType).forEach(sigefClass => {
        const sigefClassUpper = sigefClass.toUpperCase();
        
        // Verificar correspondência direta por número
        if (sigefClass.includes(classNum)) {
            const info = sigefInfoByType[sigefClass];
            matchedInfo += `Classe: ${sigefClass}`;
            if (info.totalArea) {
                matchedInfo += `<br>Área: ${info.totalArea} ha`;
            }
            return;
        }
        
        // Verificar correspondência por palavras-chave
        if (classMapping[classNum]) {
            const keywords = classMapping[classNum];
            const hasMatch = keywords.some(keyword => 
                sigefClassUpper.includes(keyword.toUpperCase())
            );
            
            if (hasMatch) {
                const info = sigefInfoByType[sigefClass];
                if (!matchedInfo) {
                    matchedInfo += `Classe: ${sigefClass}`;
                    if (info.totalArea) {
                        matchedInfo += `<br>Área: ${info.totalArea} ha`;
                    }
                }
            }
        }
    });
    
    return matchedInfo || this.getFallbackSigefInfo(sigefInfoByType);
},

// Função fallback para quando não há correspondência específica
getFallbackSigefInfo: function(sigefInfoByType) {
    if (!sigefInfoByType || Object.keys(sigefInfoByType).length === 0) return '';
    
    let fallbackInfo = '';
    const classes = Object.keys(sigefInfoByType);
    
    if (classes.length === 1) {
        const classe = classes[0];
        const info = sigefInfoByType[classe];
        fallbackInfo = `Classe: ${classe}`;
        if (info.totalArea) {
            fallbackInfo += `<br>Área: ${info.totalArea} ha`;
        }
    } else {
        fallbackInfo = `Múltiplas classes:<br>`;
        classes.forEach((classe, index) => {
            if (index < 3) { // Limitar a 3 classes para não poluir
                const info = sigefInfoByType[classe];
                fallbackInfo += `• ${classe}`;
                if (info.totalArea) {
                    fallbackInfo += ` (${info.totalArea} ha)`;
                }
                fallbackInfo += '<br>';
            }
        });
        if (classes.length > 3) {
            fallbackInfo += `... +${classes.length - 3} mais`;
        }
    }
    
    return fallbackInfo;
},
// Modifique a função clear para limpar também as informações do SIGEF
clear: function() {
    // ... código existente
    
    this.state.sigefExcelInfo = null;
    this.state.currentCodigoImo = null;
    
    // Limpar informações do SIGEF na UI
    const sigefSection = document.getElementById('floatingSigefSection');
    if (sigefSection) {
        sigefSection.remove();
    }
    
    // Limpar coluna da tabela
    const classesTable = document.getElementById('classesTable');
    if (classesTable) {
        const headerRow = classesTable.querySelector('thead tr');
        if (headerRow && headerRow.querySelector('th:nth-child(5)')) {
            headerRow.deleteCell(4);
        }
        
        const tbody = classesTable.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            if (row.cells.length === 5) {
                row.deleteCell(4);
            }
        });
    }
},

    // Alternar modo de desenho
    toggleDrawingMode: function() {
        if (this.state.drawnPolygon) {
            this.showStatus('Já existe um polígono desenhado. Limpe o mapa para desenhar um novo.', 'error');
            return;
        }

        const isDrawing = !MAP.state.isDrawing;
        MAP.toggleDrawing(isDrawing);

        const drawBtn = document.getElementById('btnDrawPolygon');
        if (isDrawing) {
            drawBtn.classList.add('active');
            drawBtn.innerHTML = '🛑 Finalizar Desenho';
            this.showStatus('Modo desenho ativado. Clique no mapa para desenhar. Duplo clique para finalizar.', 'info');
        } else {
            drawBtn.classList.remove('active');
            drawBtn.innerHTML = '✏️ Desenhar Polígono';
            this.showStatus('Modo desenho desativado.', 'info');
        }
    },

    // Manipular polígono desenhado
    handlePolygonDrawn: function(detail) {
        this.state.drawnPolygon = detail.layer;
        
        // Desativar modo de desenho
        const drawBtn = document.getElementById('btnDrawPolygon');
        drawBtn.classList.remove('active');
        drawBtn.innerHTML = '✏️ Desenhar Polígono';
        MAP.state.isDrawing = false;

        // Habilitar análise
        document.getElementById('btnAnalyze').disabled = false;
        
        this.showStatus('Polígono desenhado! Você pode editá-lo movendo os pontos. Clique em "Analisar Uso do Solo" para processar.', 'success');
    },

    handlePolygonEdited: function(detail) {
        this.showStatus('Polígono editado.', 'info');
    },

    handlePolygonDeleted: function(detail) {
        this.state.drawnPolygon = null;
        document.getElementById('btnAnalyze').disabled = true;
        this.showStatus('Polígono removido.', 'info');
    },

    // Exportar polígono desenhado como KML
    exportDrawnPolygon: function() {
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
    handleRasterTypeChange: function(event) {
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
    updateRasterInfo: function() {
        const info = this.state.currentRasterInfo;
        const nameEl = document.getElementById('currentRasterName');
        const resEl = document.getElementById('currentRasterResolution');
        const paEl = document.getElementById('currentRasterPixelArea');
        if (nameEl) nameEl.textContent = info.name;
        if (resEl) resEl.textContent = info.resolution;
        if (paEl) paEl.textContent = info.pixelArea;
    },
    
    // Manipular seleção de arquivos geoespaciais
    handleFileSelect: function() {
        const fileInput = document.getElementById('file');
        if (fileInput.files.length === 0) return;
        
        const files = Array.from(fileInput.files);
        
        // Validar cada arquivo
        const allowedExtensions = ['.kml', '.kmz', '.geojson', '.json', '.zip'];
        for (const file of files) {
            if (!UTILS.validateFile(file, allowedExtensions)) {
                this.showStatus('Formatos aceitos: KML, KMZ, GeoJSON (.json), Shapefile (.zip com todos os arquivos)', 'error');
                return;
            }
        }
        
        this.state.currentFiles = files;
        document.getElementById('btnAnalyze').disabled = false;
        
        // Determinar tipo(s) de arquivo
        const fileTypes = files.map(f => {
            const ext = f.name.toLowerCase().split('.').pop();
            const typeMap = {
                'kml': 'KML',
                'kmz': 'KMZ',
                'geojson': 'GeoJSON',
                'json': 'GeoJSON',
                'zip': 'Shapefile'
            };
            return typeMap[ext] || ext.toUpperCase();
        });
        const uniqueTypes = [...new Set(fileTypes)].join(', ');
        const fileInfo = `Arquivos selecionados: ${files.length} arquivo(s) (${uniqueTypes})`;
        this.showStatus(fileInfo, 'info');
        
        this.loadGeoFiles(files);
    },
    
    // Carregar múltiplos arquivos geoespaciais (KML, KMZ, GeoJSON, Shapefile)
    loadGeoFiles: function(files) {
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
        MAP.clear();
        
        // Limpar drawnPolygon para não interferir com análise de KML
        this.state.drawnPolygon = null;
        this.state.currentPropertyCode = null; // Limpar código do imóvel (não é busca por código)
        
        files.forEach((file, index) => {
            this.loadGeoFile(file, index);
        });
        
        setTimeout(() => {
            MAP.fitToBounds();
        }, 500);
    },
    
    // Carregar arquivo geoespacial individual (KML, KMZ, GeoJSON, Shapefile)
    loadGeoFile: async function(file, index) {
        const ext = file.name.toLowerCase().split('.').pop();
        
        // Para formatos binários (KMZ, Shapefile ZIP), converter para GeoJSON primeiro
        const binaryFormats = ['kmz', 'zip'];
        if (binaryFormats.includes(ext)) {
            this.showStatus(`Convertendo ${file.name} para visualização...`, 'info');
            
            try {
                // Enviar para backend converter para GeoJSON
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch('/convert_to_geojson', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.status === 'sucesso' && data.geojson) {
                    // Extrair coordenadas do GeoJSON retornado
                    const geojson = data.geojson;
                    let coordinates = null;
                    
                    if (geojson.features && geojson.features.length > 0) {
                        const firstFeature = geojson.features[0];
                        if (firstFeature.geometry && firstFeature.geometry.coordinates) {
                            // ✅ GeoJSON usa [lon, lat], MAP.addPolygon fará a conversão para Leaflet
                            const geomType = firstFeature.geometry.type;
                            if (geomType === 'Polygon') {
                                coordinates = firstFeature.geometry.coordinates[0];
                            } else if (geomType === 'MultiPolygon') {
                                // Pegar primeiro polígono do MultiPolygon
                                coordinates = firstFeature.geometry.coordinates[0][0];
                            }
                        }
                    }
                    
                    if (coordinates) {
                        const polygon = {
                            type: 'Polygon',
                            coordinates: [coordinates]
                        };
                        
                        this.state.features.push({ 
                            name: file.name, 
                            geometry: polygon,
                            index: index,
                            fileType: ext,
                            originalFile: file  // Guardar arquivo original para análise posterior
                        });
                        
                        const colors = ['#4cc9f0', '#f04c7c', '#4cf0a7', '#f0a74c', '#a74cf0'];
                        const color = colors[index % colors.length];
                        
                        const layer = MAP.addPolygon(coordinates, file.name, color, index);
                        
                        // ✅ Zoom automático para o polígono adicionado
                        if (layer) {
                            setTimeout(() => {
                                try {
                                    MAP.state.leafletMap.fitBounds(layer.getBounds(), { padding: [50, 50] });
                                } catch (e) {
                                    console.warn('Não foi possível fazer zoom:', e);
                                }
                            }, 300);
                        }
                        
                        this.showStatus(`Polígono ${file.name} carregado com sucesso.`, 'success');
                    } else {
                        throw new Error('Não foi possível extrair coordenadas do GeoJSON');
                    }
                } else {
                    throw new Error(data.mensagem || 'Erro ao converter arquivo');
                }
            } catch (error) {
                console.error(`Erro ao converter ${file.name}:`, error);
                this.showStatus(`Erro ao carregar ${file.name}: ${error.message}`, 'error');
                
                // Adicionar mesmo com erro para permitir tentativa de análise direta
                this.state.features.push({ 
                    name: file.name, 
                    geometry: null,
                    index: index,
                    fileType: ext,
                    originalFile: file
                });
            }
            return;
        }
        
        // Para KML e GeoJSON, tentar renderizar no mapa
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                let coordinates = null;
                
                if (ext === 'kml') {
                    // Processar KML
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
                    const placemarks = xmlDoc.getElementsByTagName("Placemark");
                    
                    if (placemarks.length === 0) {
                        this.showStatus(`Nenhum polígono encontrado no arquivo ${file.name}.`, 'warning');
                        return;
                    }
                    
                    const coordinatesText = xmlDoc.getElementsByTagName("coordinates")[0].textContent;
                    coordinates = UTILS.parseKmlCoordinates(coordinatesText);
                } else if (ext === 'geojson' || ext === 'json') {
                    // Processar GeoJSON
                    const geojson = JSON.parse(e.target.result);
                    
                    // Extrair coordenadas do primeiro polígono
                    if (geojson.type === 'FeatureCollection' && geojson.features && geojson.features.length > 0) {
                        const firstFeature = geojson.features[0];
                        if (firstFeature && firstFeature.geometry && firstFeature.geometry.type === 'Polygon' && firstFeature.geometry.coordinates) {
                            coordinates = firstFeature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // Inverter para [lat, lon]
                        }
                    } else if (geojson.type === 'Feature' && geojson.geometry && geojson.geometry.type === 'Polygon' && geojson.geometry.coordinates) {
                        coordinates = geojson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                    } else if (geojson.type === 'Polygon' && geojson.coordinates) {
                        coordinates = geojson.coordinates[0].map(coord => [coord[1], coord[0]]);
                    }
                }
                
                if (coordinates) {
                    const polygon = {
                        type: 'Polygon',
                        coordinates: [coordinates]
                    };
                    
                    this.state.features.push({ 
                        name: file.name, 
                        geometry: polygon,
                        index: index,
                        fileType: ext
                    });
                    
                    const colors = ['#4cc9f0', '#f04c7c', '#4cf0a7', '#f0a74c', '#a74cf0'];
                    const color = colors[index % colors.length];
                    
                    MAP.addPolygon(coordinates, file.name, color, index);
                    
                    this.showStatus(`Polígono ${file.name} carregado com sucesso.`, 'success');
                } else {
                    this.showStatus(`Arquivo ${file.name} carregado. Clique em "Analisar" para processar.`, 'info');
                }
            } catch (error) {
                console.error(`Erro ao carregar ${file.name}:`, error);
                this.showStatus(`Erro ao renderizar ${file.name}. O arquivo será enviado para análise.`, 'warning');
                
                // Adicionar mesmo com erro de renderização
                this.state.features.push({ 
                    name: file.name, 
                    geometry: null,
                    index: index,
                    fileType: ext
                });
            }
        };
        
        reader.onerror = () => {
            this.showStatus(`Erro ao ler o arquivo ${file.name}.`, 'error');
        };
        
        reader.readAsText(file);
    },
    
    // Manipular seleção de arquivo raster
    handleRasterFileSelect: function() {
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
    previewRasterInfo: function(file) {
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
    calculateAndDisplayCentroid: function(polygon) {
        const centroid = UTILS.calculateCentroid(polygon);
        if (!centroid) return;
        const fcEl = document.getElementById('floatingCentroid');
        if (fcEl) fcEl.textContent = `${centroid.latGMS}, ${centroid.lonGMS}`;
    },

    // Calcular e exibir centroide para polígono Leaflet
    calculateAndDisplayLeafletCentroid: function(leafletPolygon) {
        const centroid = UTILS.calculateLeafletCentroid(leafletPolygon);
        if (!centroid) return;
        const fcEl = document.getElementById('floatingCentroid');
        if (fcEl) fcEl.textContent = `${centroid.latGMS}, ${centroid.lonGMS}`;
    },
    
    // Analisar arquivos
    analyzeFile: async function() {
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
                    // É um polígono desenhado, converter para KML
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
        
    document.getElementById('loading').classList.add('active');
        document.getElementById('btnAnalyze').disabled = true;
        this.state.allRastersLoaded = false;
        
        this.state.analysisResults = [];
        
        try {
            const totalFiles = this.state.currentFiles.length;
            const progressEl = document.getElementById('analysisProgress');
            if (progressEl) { progressEl.value = 0; }

            for (let i = 0; i < totalFiles; i++) {
                const file = this.state.currentFiles[i];
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

                // Atualizar barra de progresso por arquivo
                try {
                    if (progressEl) {
                        const pct = Math.round(((i + 1) / totalFiles) * 100);
                        progressEl.value = pct;
                    }
                } catch (e) {}
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
                // garantir que a barra chegue a 100% e depois reset
                const progressEl = document.getElementById('analysisProgress');
                if (progressEl) {
                    progressEl.value = 100;
                    setTimeout(() => { progressEl.value = 0; }, 800);
                }
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
            document.getElementById('loading').classList.remove('active');
            document.getElementById('btnAnalyze').disabled = false;
        }
    },

    // Função auxiliar para verificar se é um arquivo KML virtual
    isVirtualKMLFile: function(file) {
        return file.name === 'poligono_desenhado.kml' && file.type === 'application/vnd.google-earth.kml+xml';
    },
    
    // Função auxiliar para verificar se é um arquivo SIGEF virtual (GeoJSON)
    isSIGEFFile: function(file) {
        return file.name === 'poligono_sigef.geojson' && file.type === 'application/geo+json';
    },

    // Analisar um único arquivo
    analyzeSingleFile: async function(file, index) {
        const formData = new FormData();
        
        // ✅ Se o arquivo tem originalFile (foi convertido de binário para GeoJSON),
        // usar o arquivo original para análise no backend
        const fileToAnalyze = file.originalFile || file;
        formData.append('kml', fileToAnalyze);
        
        // Adicionar tipo de raster selecionado
        const rasterType = localStorage.getItem('rasterType') || 'com_mosaico';
        formData.append('raster_type', rasterType);
        
        // ✅ VALORAÇÃO: Adicionar flag de valoração habilitada/desabilitada
        const enableValoracao = typeof ValoracaoModule !== 'undefined' && ValoracaoModule.isEnabled();
        formData.append('enable_valoracao', enableValoracao ? 'true' : 'false');
        
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
                // ✅ NOVO: Apenas adicionar polígono ao mapa se ele NÃO foi carregado anteriormente
                // (ou seja, se não há geometry no state.features[index])
                const featureAlreadyLoaded = this.state.features[index] && this.state.features[index].geometry;
                
                if (data.polygon_geojson && !featureAlreadyLoaded) {
                    console.log('polygon_geojson recebido do backend (primeira vez):', data.polygon_geojson);
                    try {
                        const layer = MAP.addGeoJsonAsDrawn(data.polygon_geojson, file.name);
                        console.log('Layer adicionada ao mapa:', layer);
                        
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
                            
                            // Zoom para o polígono adicionado
                            try {
                                MAP.state.leafletMap.fitBounds(layer.getBounds());
                            } catch (e) {
                                console.warn('Não foi possível fazer zoom para o polígono:', e);
                            }
                        } else {
                            console.warn('addGeoJsonAsDrawn retornou null');
                        }
                    } catch (error) {
                        console.error('Erro ao adicionar polígono ao mapa:', error);
                    }
                } else if (featureAlreadyLoaded) {
                    console.log('Polígono já estava carregado no mapa, pulando renderização');
                } else {
                    console.log('Nenhum polygon_geojson retornado do backend');
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
    displayBatchResults: function() {
        document.getElementById('resultSection').classList.add('active');
        
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
            this.showPolygonResult(0);
        }
    },
    
    // Adicionar seletor de polígono
    addPolygonSelector: function() {
        const selectorHtml = `
            <div class="row" id="polygonSelector">
                <label class="label">Selecionar Polígono:</label>
                <select id="polygonSelect" class="btn" style="width: 100%; margin-top: 5px;">
                    <option value="-1">Todos os polígonos</option>
                    ${this.state.analysisResults.map((result, index) => 
                        `<option value="${index}">${result.fileName}</option>`
                    ).join('')}
                </select>
            </div>
        `;
        
        const resultSection = document.getElementById('resultSection');
        const title = resultSection.querySelector('.section-title');
        title.insertAdjacentHTML('afterend', selectorHtml);
        
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
    selectPolygonByClick: function(index) {
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
                    btn.textContent = '⛶';
                    btn.title = 'Restaurar';
                }
            }
        }
    },
    
    // Exibir resultados de um polígono específico
    showPolygonResult: function(index) {
        this.state.currentPolygonIndex = index;
        const result = this.state.analysisResults[index];
        if (!result) return;
        
        const relatorio = result.relatorio;
        // Safe DOM writer helper
        const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    setText('totalArea', relatorio.area_total_poligono_ha_formatado !== undefined ? relatorio.area_total_poligono_ha_formatado : (relatorio.area_total_poligono_ha ? `${relatorio.area_total_poligono_ha} ha` : '-'));
        setText('classesCount', relatorio.numero_classes_encontradas);
    
    // ✅ VALORAÇÃO: Usar módulo separado
    if (typeof ValoracaoModule !== 'undefined' && ValoracaoModule.isEnabled()) {
        setText('totalValue', relatorio.valor_total_calculado_formatado !== undefined ? relatorio.valor_total_calculado_formatado : '-');
    } else {
        setText('totalValue', 'Desabilitado');
    }
    
    const classesTableEl = document.getElementById('classesTable');
    const classesTbody = classesTableEl ? classesTableEl.querySelector('tbody') : null;
    if (classesTbody) classesTbody.innerHTML = '';
    
        for (const [key, info] of Object.entries(relatorio.classes)) {
        const classNum = key.replace('Classe ', '');
        
        // ✅ PULAR CLASSE 0
        if (classNum === '0') continue;
        
        const color = UTILS.CLASSES_CORES[classNum] || '#CCCCCC';
        
        // ✅ VALORAÇÃO: Mostrar/ocultar coluna de valor
        const showValor = typeof ValoracaoModule !== 'undefined' && ValoracaoModule.isEnabled();
        const valorCell = showValor 
            ? `<td>${info.valor_calculado_formatado !== undefined ? info.valor_calculado_formatado : (info.valor_calculado !== undefined ? info.valor_calculado : '-')}</td>`
            : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div style="display:inline-block; width:12px; height:12px; background-color:${color}; margin-right:5px;"></div> ${classNum}</td>
            <td>${info.descricao}</td>
            <td>${info.area_ha_formatado !== undefined ? info.area_ha_formatado : (info.area_ha !== undefined ? info.area_ha + ' ha' : '-')}</td>
            <td>${info.percentual_formatado !== undefined ? info.percentual_formatado : (info.percentual !== undefined ? info.percentual + '%' : '-')}</td>
            ${valorCell}
        `;
        
        classesTbody.appendChild(row);
    }
        
        const metadados = result.metadados || {};
    setText('crsInfo', metadados.crs || 'Não disponível');
    setText('spatialResolution', metadados.resolucao_espacial || 'Não disponível');
    setText('clipDimensions', metadados.dimensoes_recorte || 'Não disponível');
    setText('pixelArea', metadados.area_por_pixel_ha_formatado ? metadados.area_por_pixel_ha_formatado : (metadados.area_por_pixel_ha ? `${metadados.area_por_pixel_ha} ha` : 'Não disponível'));
    setText('satelliteDateText', metadados.data_imagem || 'n/a');
    
    // ✅ VALORAÇÃO: Informações do Quadrante via módulo
    if (typeof ValoracaoModule !== 'undefined') {
        const valoracaoData = ValoracaoModule.processValoracao(result);
        if (ValoracaoModule.isEnabled() && valoracaoData) {
            const quadrante = valoracaoData.quadrante || {};
            setText('quadranteCode', quadrante.codigo || 'Não disponível');
            setText('quadranteValor', quadrante.valorFormatado || 'Não disponível');
        } else {
            setText('quadranteCode', 'Desabilitado');
            setText('quadranteValor', 'Desabilitado');
        }
    } else {
        const quadrante = metadados.quadrante || {};
        setText('quadranteCode', quadrante.codigo || 'Não disponível');
        setText('quadranteValor', quadrante.valor_quadrante_formatado || (quadrante.valor_quadrante ? quadrante.valor_quadrante.toString() : 'Não disponível'));
    }
        
    // Atualizar gráfico com dados SIGEF
    this.createFloatingAreaChart(relatorio.classes, this.state.sigefExcelInfo);
    // Atualizar a tabela central e informações do imóvel
    this.updateFloatingCenter(relatorio);
    this.updateFloatingImovelInfo(this.state.sigefExcelInfo);
        
        if (result.imagem_recortada && result.imagem_recortada.legenda) {
            this.updateFloatingLegend(result.imagem_recortada.legenda);
            
            // Se temos bounds nos metadados, usar para posicionar o raster
            let bounds = null;
            if (metadados.bounds) {
                bounds = L.latLngBounds(metadados.bounds[0], metadados.bounds[1]);
            }
            
            // Se temos polígono desenhado ou SIGEF, usar seus bounds
            if (result.isVirtual && this.state.drawnPolygon) {
                bounds = this.state.drawnPolygon.getBounds();
            }
            
            if (result.imagem_recortada.base64) {
                MAP.addRasterForPolygon(index, result.imagem_recortada.base64, bounds);
            }
        }
        
// Destacar polígono e fazer zoom
        // ✅ CORREÇÃO: EXIBIR CENTROIDE INDEPENDENTEMENTE DA ORIGEM DO POLÍGONO
        let centroidText = 'Não disponível';
        
        // Prioridade 1: Usar centroide do servidor se disponível
        if (result.metadados && result.metadados.centroide_display) {
            centroidText = result.metadados.centroide_display;
        } 
        // Prioridade 2: Calcular centroide no cliente para polígonos desenhados/SIGEF
        else if (result.isVirtual && this.state.drawnPolygon) {
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

    // ✅ EXIBIR NO PAINEL FLUTUANTE - INFORMAÇÕES DO IMÓVEL
    setText('floatingCentroid', centroidText);
    
    // Nome do arquivo
    const nomeArquivo = result.isVirtual ? 'Polígono desenhado' : 
                       result.isSIGEF ? `Imóvel ${this.state.currentCodigoImo || result.fileName}` :
                       (result.fileName || 'Arquivo sem nome').replace('.kml', '');
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
    
    // Área total e número de classes
    setText('floatingAreaTotal', relatorio.area_total_poligono_ha_formatado || '-');
    setText('floatingNumClasses', relatorio.numero_classes_encontradas || '-');
    
    // Exibir valor total destacado no header do painel flutuante
    // ✅ VALORAÇÃO: Usar módulo separado
    if (typeof ValoracaoModule !== 'undefined' && ValoracaoModule.isEnabled()) {
        const valoracaoData = ValoracaoModule.processValoracao(result);
        if (valoracaoData && valoracaoData.valorTotal) {
            ValoracaoModule.renderValorTotal(valoracaoData.valorTotal, 'floatingTotalValue');
        }
    } else {
        const floatingTotalEl = document.getElementById('floatingTotalValue');
        if (floatingTotalEl) {
            floatingTotalEl.style.display = 'none';
            floatingTotalEl.innerHTML = '';
        }
    }
        
        // ✅ ATUALIZAR INFORMAÇÕES DE ANÁLISE NO PAINEL
        const analysisInfoDiv = document.getElementById('floatingAnalysisInfo');
        if (analysisInfoDiv) {
            let analysisHtml = '';
            analysisHtml += `<div style="color: #e7ecff; font-size: 12px; line-height: 1.6;">`;
            analysisHtml += `<strong style="color: #4cc9f0;">Área Total:</strong> ${relatorio.area_total_poligono_ha_formatado !== undefined ? relatorio.area_total_poligono_ha_formatado : (relatorio.area_total_poligono_ha ? relatorio.area_total_poligono_ha + ' ha' : '-')}<br>`;
            analysisHtml += `<strong style="color: #4cc9f0;">Classes Encontradas:</strong> ${relatorio.numero_classes_encontradas}<br>`;
            analysisHtml += `<strong style="color: #4cc9f0;">Resolução:</strong> ${metadados.resolucao_espacial || 'Não disponível'}<br>`;
            analysisHtml += `<strong style="color: #4cc9f0;">Área/Pixel:</strong> ${metadados.area_por_pixel_ha_formatado ? metadados.area_por_pixel_ha_formatado : (metadados.area_por_pixel_ha ? metadados.area_por_pixel_ha + ' ha' : 'Não disponível')}<br>`;
            
            // ✅ VALORAÇÃO: Mostrar valor total apenas se módulo habilitado
            if (typeof ValoracaoModule !== 'undefined' && ValoracaoModule.isEnabled()) {
                analysisHtml += `<strong style="color: #4cc9f0;">Valor Total:</strong> ${relatorio.valor_total_calculado_formatado !== undefined ? relatorio.valor_total_calculado_formatado : (relatorio.valor_total_calculado !== undefined ? relatorio.valor_total_calculado : '-') }<br>`;
            }
            
            // Mostrar mensagem do centroide se houver
            if (result._mensagem_centroide) {
                analysisHtml += `<div style="margin-top:6px; color:#ffcccb; font-weight:600;">Observação: ${result._mensagem_centroide}</div>`;
            }
            analysisHtml += `</div>`;
            analysisInfoDiv.innerHTML = analysisHtml;
        }
        
        // ✅ ATUALIZAR O STATE PARA USO NO PDF
        this.state.currentCentroid = centroidText;

        // ✅ VALORAÇÃO: QUADRANTE usando módulo separado
        if (typeof ValoracaoModule !== 'undefined' && ValoracaoModule.isEnabled()) {
            const valoracaoData = ValoracaoModule.processValoracao(result);
            if (valoracaoData && valoracaoData.quadrante) {
                ValoracaoModule.renderQuadranteInfo(valoracaoData.quadrante, 'floatingQuadranteInfo');
            } else {
                const quadDiv = document.getElementById('floatingQuadranteInfo');
                if (quadDiv) {
                    quadDiv.style.display = 'none';
                }
            }
        } else {
            // Ocultar seção de quadrante se módulo desabilitado
            const quadDiv = document.getElementById('floatingQuadranteInfo');
            if (quadDiv) {
                quadDiv.style.display = 'none';
            }
        }

        // Destacar polígono e fazer zoom
        if (result.isVirtual && this.state.drawnPolygon) {
            // Para polígono desenhado, destacar o polígono desenhado
            this.state.drawnPolygon.setStyle({
                color: '#ffeb3b',
                weight: 5,
                opacity: 1,
                fillOpacity: 0
            });
            const bounds = this.state.drawnPolygon.getBounds();
            MAP.zoomToBounds(bounds);
        } else {
            MAP.highlightPolygon(index);
            MAP.zoomToPolygon(index);
        }
    },
    
    // Exibir resultados consolidados
    showAllResults: function() {
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
    
    // ✅ CORREÇÃO: Pular APENAS classe 0, não todas
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
        // Formatar valor total consolidado (se disponível em analysisResults)
        let consolidatedValorTotal = 0;
        this.state.analysisResults.forEach(r => {
            if (r.relatorio && r.relatorio.valor_total_calculado) consolidatedValorTotal += parseFloat(r.relatorio.valor_total_calculado) || 0;
        });
        const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setText('totalValue', consolidatedValorTotal > 0 ? nf.format(consolidatedValorTotal) : '-');
        const floatingTotalEl = document.getElementById('floatingTotalValue'); if (floatingTotalEl) floatingTotalEl.textContent = consolidatedValorTotal > 0 ? nf.format(consolidatedValorTotal) : '-';
        setText('classesCount', Object.keys(classesConsolidadas).length);
        setText('methodUsed', 'Consolidado - Múltiplos polígonos');
    
    const classesTableEl = document.getElementById('classesTable');
    const classesTbody = classesTableEl ? classesTableEl.querySelector('tbody') : null;
    if (classesTbody) classesTbody.innerHTML = '';
    
    for (const [key, info] of Object.entries(classesConsolidadas)) {
        const classNum = key.replace('Classe ', '');
        
        // ✅ PULAR CLASSE 0
        if (classNum === '0') continue;
        
        const color = UTILS.CLASSES_CORES[classNum] || '#CCCCCC';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div style="display:inline-block; width:12px; height:12px; background-color:${color}; margin-right:5px;"></div> ${classNum}</td>
            <td>${info.descricao}</td>
            <td>${nf.format(info.area_ha || 0)}</td>
            <td>${nf.format(info.percentual || 0)}%</td>
        `;
        
        classesTable.appendChild(row);
    }
        
    setText('crsInfo', 'Vários (depende do polígono)');
    setText('spatialResolution', 'Vários (depende do polígono)');
    setText('clipDimensions', 'Múltiplos recortes');
    setText('pixelArea', 'Vários (depende do polígono)');
        
    // Atualizar gráfico com dados SIGEF consolidados
    this.createFloatingAreaChart(classesConsolidadas, this.getConsolidatedSigefInfo());
        
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
    
    // Criar gráfico no quadro flutuante
createFloatingAreaChart: function(classes, sigefInfo = null) {
    if (this.state.areaChart) {
        this.state.areaChart.destroy();
    }
    const canvasEl = document.getElementById('floatingAreaChart');
    if (!canvasEl) return; // nothing to draw into
    const ctx = canvasEl.getContext && canvasEl.getContext('2d');
    if (!ctx) return;
    
    // Preparar dados da análise
    const analysisLabels = [];
    const analysisData = [];
    const analysisColors = [];
    
    for (const [key, info] of Object.entries(classes)) {
        const classNum = key.replace('Classe ', '');
        if (classNum === '0') continue;
        
        analysisLabels.push(info.descricao);
        analysisData.push(info.area_ha);
        analysisColors.push(UTILS.CLASSES_CORES[classNum] || '#CCCCCC');
    }

    // Preparar dados do SIGEF se disponíveis
    let sigefLabels = [];
    let sigefData = [];
    let sigefColors = [];
    
    if (sigefInfo && sigefInfo.length > 0) {
        const sigefGrouped = this.processSigefInfoByType(sigefInfo);
        
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
    
    this.state.areaChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: analysisLabels,
            datasets: [
                {
                    label: 'Análise Atual',
                    data: analysisData,
                    backgroundColor: analysisColors,
                    borderWidth: 2,
                    borderColor: '#1f2748',
                    hoverOffset: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                    position: 'bottom',
                    labels: {
                        color: legendColor,
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        padding: 10
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
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });

    // Adicionar segunda camada se houver dados SIGEF
    if (sigefData.length > 0) {
        this.addSigefLayerToChart(sigefLabels, sigefData, sigefColors);
    }
},

// Nova função para adicionar camada SIGEF ao gráfico
addSigefLayerToChart: function(labels, data, colors) {
    if (!this.state.areaChart) return;

    // Adicionar segundo dataset
    this.state.areaChart.data.datasets.push({
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
    this.state.areaChart.options.plugins.legend = {
        display: true,
        position: 'bottom',
        labels: {
            color: legendColor,
            font: {
                size: 11,
                weight: '600'
            },
            padding: 10,
            generateLabels: function(chart) {
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
    this.state.areaChart.options.plugins.tooltip = {
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
            label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value.toFixed(2)} ha (${percentage}%)`;
            }
        }
    };

    this.state.areaChart.update();
},

// Nova função para mapear classes SIGEF para cores
mapSigefClassToColor: function(sigefClass) {
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

    // Atualizar legenda no quadro flutuante
updateFloatingLegend: function(legendData) {
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
updateFloatingImovelInfo: function(info) {
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
        {k: 'COD_NMRO_ICRA', l: 'Código'},
        {k: 'NOM', l: 'Nome'},
        {k: 'NM_MUNICP', l: 'Município'},
        {k: 'QT_AREA_TIP_SOLO', l: 'Área (ha)'},
        {k: 'PROPRIETARIO', l: 'Proprietário'},
        {k: 'TIPO_PROPR', l: 'Tipo'}
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

// Atualizar a área central com a tabela de classes resultante da análise
updateFloatingCenter: function(relatorio) {
    const container = document.getElementById('floatingClassesTableContainer');
    if (!container) return;

    if (!relatorio || !relatorio.classes) {
        container.innerHTML = '<div class="sigef-item">Nenhuma informação de classes disponível</div>';
        return;
    }

    const rows = [];
    rows.push('<table class="classes-table-small" style="width:100%; border-collapse:collapse; font-size:12px;">');
    rows.push('<thead><tr><th style="text-align:left; padding:6px; color:#91a0c0;">Classe</th><th style="text-align:left; padding:6px; color:#91a0c0;">Descrição</th><th style="text-align:right; padding:6px; color:#91a0c0;">Área (ha)</th><th style="text-align:right; padding:6px; color:#91a0c0;">%</th><th style="text-align:right; padding:6px; color:#91a0c0;">Valor</th></tr></thead>');
    rows.push('<tbody>');

    // Variáveis para calcular totais
    let totalArea = 0;
    let totalPercent = 0;
    let totalValue = 0;

    Object.entries(relatorio.classes).forEach(([key, info]) => {
        const classNum = key.replace('Classe ', '');
        if (classNum === '0') return;
        const color = UTILS.CLASSES_CORES[classNum] || '#CCCCCC';
        
        // Acumular totais
        totalArea += parseFloat(info.area_ha) || 0;
        totalPercent += parseFloat(info.percentual) || 0;
        totalValue += parseFloat(info.valor_calculado) || 0;

        rows.push(`<tr><td style="padding:6px;"><div style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:2px;vertical-align:middle;"></div>${classNum}</td><td style="padding:6px;">${info.descricao}</td><td style="padding:6px;text-align:right;">${info.area_ha_formatado !== undefined ? info.area_ha_formatado : ((info.area_ha || 0).toFixed(2) + ' ha')}</td><td style="padding:6px;text-align:right;">${info.percentual_formatado !== undefined ? info.percentual_formatado : ((info.percentual || 0).toFixed(2) + '%')}</td><td style="padding:6px;text-align:right;">${info.valor_calculado_formatado !== undefined ? info.valor_calculado_formatado : (info.valor_calculado !== undefined ? info.valor_calculado : '-')}</td></tr>`);
    });

    // Adicionar linha de totais (última linha) - FORMATADA EM PT-BR
    rows.push(`<tr style="background: rgba(76, 201, 240, 0.1); font-weight: bold; border-top: 1px solid #263156;">`);
    rows.push(`<td style="padding:6px;" colspan="2"><strong>Total</strong></td>`);
    rows.push(`<td style="padding:6px;text-align:right;"><strong>${this.formatNumberPTBR(totalArea, 2)} ha</strong></td>`);
    rows.push(`<td style="padding:6px;text-align:right;"><strong>${this.formatNumberPTBR(totalPercent, 2)}%</strong></td>`);
    rows.push(`<td style="padding:6px;text-align:right;"><strong>${this.formatCurrencyPTBR(totalValue)}</strong></td>`);
    rows.push(`</tr>`);

    rows.push('</tbody></table>');
    container.innerHTML = rows.join('');
},

    // Fechar quadro flutuante
    closeFloatingPanel: function() {
        document.getElementById('floatingPanel').style.display = 'none';
    },
    
    // Alternar maximização do quadro flutuante
    toggleMaximizePanel: function() {
        const panel = document.getElementById('floatingPanel');
        const btn = document.getElementById('btnMaximizePanel');
        
        if (panel.classList.contains('maximized')) {
            this.restorePanel();
            btn.textContent = '⛶';
            btn.title = 'Maximizar';
        } else {
            this.maximizePanel();
            btn.textContent = '⛶';
            btn.title = 'Restaurar';
        }
    },
    
    // Maximizar quadro flutuante
    maximizePanel: function() {
        const panel = document.getElementById('floatingPanel');
        panel.classList.add('maximized');
        panel.classList.remove('compact');
        // Armazenar posição original se necessário para restauração
        panel.setAttribute('data-maximized', 'true');
        // Garantir que o gráfico seja redimensionado após a transição
        setTimeout(() => {
            try {
                if (this.state.areaChart) {
                    this.state.areaChart.resize();
                    this.state.areaChart.update();
                }
            } catch (e) { console.warn('Erro ao redimensionar gráfico:', e); }
        }, 350);
    },
    
    // Restaurar quadro flutuante para tamanho original
    restorePanel: function() {
        const panel = document.getElementById('floatingPanel');
        panel.classList.remove('maximized');
        panel.classList.add('compact');
        panel.removeAttribute('data-maximized');
        // Reaplicar resize após restauração
        setTimeout(() => {
            try {
                if (this.state.areaChart) {
                    this.state.areaChart.resize();
                    this.state.areaChart.update();
                }
            } catch (e) { console.warn('Erro ao redimensionar gráfico:', e); }
        }, 300);
    },
    
    // Gerar PDF
    generatePdf: function() {
        if (this.state.analysisResults.length === 0) return;
        
        if (this.state.currentPolygonIndex === -1) {
            PDF_GENERATOR.generateConsolidatedReport(this.state.analysisResults);
        } else {
            const currentResult = this.state.analysisResults[this.state.currentPolygonIndex];
            if (!currentResult) return;
            
            // ✅ USAR CENTROIDE DO STATE EM VEZ DO ELEMENTO HTML
            const centroidEl = document.getElementById('floatingCentroid');
            let centroidText = this.state.currentCentroid || (centroidEl ? centroidEl.textContent : '');
            
            // Passar código do imóvel se disponível
            const propertyCode = this.state.currentPropertyCode || currentResult.propertyCode || null;
            
            PDF_GENERATOR.generate(currentResult, centroidText, currentResult.fileName, propertyCode);
        }
    },
    
    // Zoom in
    zoomIn: function() {
        if (MAP.state.useLeaflet && MAP.state.leafletMap) {
            MAP.state.leafletMap.zoomIn();
        }
    },
    
    // Zoom out
    zoomOut: function() {
        if (MAP.state.useLeaflet && MAP.state.leafletMap) {
            MAP.state.leafletMap.zoomOut();
        }
    },
    
    // Limpar
    clear: function() {
        this.state.features = [];
        this.state.currentFiles = [];
        this.state.analysisResults = [];
        this.state.allRastersLoaded = false;
        this.state.currentPolygonIndex = -1;
        this.state.drawnPolygon = null;
        this.state.sigefExcelInfo = null;
        this.state.currentCodigoImo = null;
    
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
    const btnAnalyzeEl = document.getElementById('btnAnalyze'); if (btnAnalyzeEl) btnAnalyzeEl.disabled = true;
    const btnGenEl = document.getElementById('btnGeneratePdf'); if (btnGenEl) btnGenEl.disabled = true;
    const resultSectionEl = document.getElementById('resultSection'); if (resultSectionEl) resultSectionEl.classList.remove('active');
        
        const polygonSelector = document.getElementById('polygonSelector');
        if (polygonSelector) {
            polygonSelector.remove();
        }
        
    const btnDrawEl = document.getElementById('btnDrawPolygon'); if (btnDrawEl) { btnDrawEl.classList.remove('active'); btnDrawEl.innerHTML = '✏️ Desenhar Polígono'; }
        
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
    
    // Exibir mensagem de status
    showStatus: function(message, type = 'info') {
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

