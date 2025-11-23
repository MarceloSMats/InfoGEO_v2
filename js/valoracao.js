/**
 * Módulo de Valoração de Imóveis
 * Responsável por calcular o valor de imóveis baseado em quadrantes e notas agronômicas
 */

const ValoracaoModule = (function() {
    'use strict';

    // Estado do módulo
    let isEnabled = true;

    /**
     * Verifica se o módulo está habilitado
     */
    function isModuleEnabled() {
        return isEnabled;
    }

    /**
     * Habilita ou desabilita o módulo
     */
    function setModuleEnabled(enabled) {
        isEnabled = enabled;
        localStorage.setItem('valoracaoEnabled', enabled);
        console.log(`Módulo de Valoração ${enabled ? 'habilitado' : 'desabilitado'}`);
    }

    /**
     * Carrega preferência salva
     */
    function loadPreference() {
        const saved = localStorage.getItem('valoracaoEnabled');
        if (saved !== null) {
            isEnabled = saved === 'true';
        }
        return isEnabled;
    }

    /**
     * Formata número para pt-BR
     */
    function formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Formata valor monetário
     */
    function formatCurrency(value) {
        if (value === null || value === undefined || isNaN(value)) return '-';
        return `R$ ${formatNumber(value, 2)}`;
    }

    /**
     * Processa dados de valoração do resultado da análise
     */
    function processValoracao(result) {
        if (!isEnabled) {
            console.log('Módulo de Valoração desabilitado - pulando cálculos');
            return null;
        }

        if (!result || !result.metadados) {
            return null;
        }

        const valoracaoData = {
            quadrante: null,
            centroides: null,
            valorTotal: null,
            valorPorClasse: null,
            temDados: false
        };

        // Extrair informações de quadrante
        if (result.metadados.quadrante) {
            valoracaoData.quadrante = {
                codigo: result.metadados.quadrante.codigo || '-',
                valor: result.metadados.quadrante.valor_quadrante,
                valorFormatado: result.metadados.quadrante.valor_quadrante_formatado || 
                               formatCurrency(result.metadados.quadrante.valor_quadrante),
                cdMicrGe: result.metadados.quadrante.CD_MICR_GE || result.metadados.quadrante.cd_micr_ge,
                notaAgronomica: result.metadados.quadrante.nota_agronomica
            };
            valoracaoData.temDados = true;
        }

        // Extrair informações de centroides
        if (result.metadados.centroides && Array.isArray(result.metadados.centroides)) {
            valoracaoData.centroides = result.metadados.centroides.map(c => ({
                codigo: c.codigo_centroide || c.codigo || '-',
                valor: c.valor_centroide,
                valorFormatado: c.valor_centroide_formatado || formatCurrency(c.valor_centroide),
                area: c.area_ha,
                areaFormatada: c.area_ha_formatado || `${formatNumber(c.area_ha, 4)} ha`
            }));
            valoracaoData.temDados = true;
        }

        // Extrair valor total
        if (result.metadados.valor_total !== undefined && result.metadados.valor_total !== null) {
            valoracaoData.valorTotal = {
                valor: result.metadados.valor_total,
                valorFormatado: result.metadados.valor_total_formatado || formatCurrency(result.metadados.valor_total)
            };
            valoracaoData.temDados = true;
        }

        // Extrair valoração por classe
        if (result.metadados.valoracao_por_classe) {
            valoracaoData.valorPorClasse = result.metadados.valoracao_por_classe;
            valoracaoData.temDados = true;
        }

        return valoracaoData.temDados ? valoracaoData : null;
    }

    /**
     * Renderiza informações de quadrante no painel flutuante
     */
    function renderQuadranteInfo(quadranteData, containerId = 'floatingQuadranteInfo') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!isEnabled || !quadranteData) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        
        let html = '<div style="background: rgba(76,201,240,0.1); padding: 10px; border-radius: 6px; border-left: 3px solid #4cc9f0;">';
        html += '<strong style="color: #4cc9f0;">📍 Quadrante de Valoração</strong><br>';
        html += `<span class="muted">Código:</span> <strong>${quadranteData.codigo}</strong><br>`;
        html += `<span class="muted">Valor do Quadrante:</span> <strong>${quadranteData.valorFormatado}</strong>`;
        
        if (quadranteData.cdMicrGe) {
            html += `<br><span class="muted">Código Microrregião:</span> ${quadranteData.cdMicrGe}`;
        }
        
        if (quadranteData.notaAgronomica !== undefined && quadranteData.notaAgronomica !== null) {
            html += `<br><span class="muted">Nota Agronômica:</span> ${quadranteData.notaAgronomica}`;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Renderiza informações de centroides
     */
    function renderCentroidesInfo(centroidesData, containerId = 'floatingCentroidesInfo') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!isEnabled || !centroidesData || centroidesData.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        
        let html = '<h4>Centroides de Valoração</h4>';
        html += '<div class="centroids-container">';
        
        centroidesData.forEach((centroid, idx) => {
            html += '<div class="centroid-info">';
            html += `<strong>Centroide ${idx + 1}</strong><br>`;
            html += `<span class="muted">Código:</span> ${centroid.codigo}<br>`;
            html += `<span class="muted">Valor:</span> ${centroid.valorFormatado}<br>`;
            html += `<span class="muted">Área:</span> ${centroid.areaFormatada}`;
            html += '</div>';
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Renderiza valor total no cabeçalho do painel
     */
    function renderValorTotal(valorTotalData, containerId = 'floatingTotalValue') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!isEnabled || !valorTotalData) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'inline-block';
        container.innerHTML = `💰 ${valorTotalData.valorFormatado}`;
    }

    /**
     * Renderiza todas as informações de valoração
     */
    function renderValoracaoComplete(valoracaoData) {
        if (!isEnabled || !valoracaoData) {
            // Ocultar todas as seções de valoração
            const elementsToHide = [
                'floatingQuadranteInfo',
                'floatingCentroidesInfo',
                'floatingTotalValue',
                'totalValue'
            ];
            
            elementsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    if (id === 'totalValue') el.innerHTML = 'Desabilitado';
                }
            });
            
            return;
        }

        // Renderizar cada componente
        if (valoracaoData.quadrante) {
            renderQuadranteInfo(valoracaoData.quadrante);
        }

        if (valoracaoData.centroides) {
            renderCentroidesInfo(valoracaoData.centroides);
        }

        if (valoracaoData.valorTotal) {
            renderValorTotal(valoracaoData.valorTotal);
            
            // Também atualizar no resumo da aba
            const totalValueEl = document.getElementById('totalValue');
            if (totalValueEl) {
                totalValueEl.innerHTML = valoracaoData.valorTotal.valorFormatado;
                totalValueEl.style.display = 'block';
            }
        }
    }

    /**
     * Limpa todas as informações de valoração da UI
     */
    function clearValoracaoUI() {
        const elementsToReset = [
            { id: 'floatingQuadranteInfo', display: 'none' },
            { id: 'floatingCentroidesInfo', display: 'none' },
            { id: 'floatingTotalValue', display: 'none', text: '' },
            { id: 'totalValue', display: 'block', text: '-' }
        ];

        elementsToReset.forEach(({ id, display, text }) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = display;
                if (text !== undefined) el.innerHTML = text;
            }
        });
    }

    /**
     * Atualiza UI quando módulo é habilitado/desabilitado
     */
    function updateUIState(enabled) {
        // Atualizar labels
        const valorLabels = document.querySelectorAll('[data-valoracao-element]');
        valorLabels.forEach(label => {
            if (enabled) {
                label.style.display = '';
            } else {
                label.style.display = 'none';
            }
        });

        // Se desabilitado, limpar UI
        if (!enabled) {
            clearValoracaoUI();
        }
    }

    /**
     * Inicializa o módulo
     */
    function init() {
        // Carregar preferência salva
        const savedEnabled = loadPreference();
        
        // Configurar toggle no modal de configurações
        const toggleInput = document.getElementById('enableValoracao');
        if (toggleInput) {
            toggleInput.checked = savedEnabled;
            toggleInput.addEventListener('change', (e) => {
                setModuleEnabled(e.target.checked);
                updateUIState(e.target.checked);
            });
        }

        // Atualizar estado inicial da UI
        updateUIState(savedEnabled);

        console.log('Módulo de Valoração inicializado:', savedEnabled ? 'habilitado' : 'desabilitado');
    }

    // API pública
    return {
        init,
        isEnabled: isModuleEnabled,
        setEnabled: setModuleEnabled,
        processValoracao,
        renderQuadranteInfo,
        renderCentroidesInfo,
        renderValorTotal,
        renderValoracaoComplete,
        clearValoracaoUI,
        formatCurrency,
        formatNumber
    };
})();

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ValoracaoModule.init());
} else {
    ValoracaoModule.init();
}
