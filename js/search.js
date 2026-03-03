/**
 * Módulo de Pesquisa - InfoGEO
 * Gerencia a busca por coordenadas GMS, nomes de municípios e códigos CAR.
 */
const SEARCH = {
    state: {
        lastResults: [],
        currentMarker: null,
        carLayer: null  // Layer para exibir polígonos CAR no mapa
    },

    init: function () {
        const input = document.getElementById('mapSearchInput');
        const btn = document.getElementById('btnMapSearch');
        const results = document.getElementById('searchResults');

        if (!input || !btn) return;

        // Pesquisar ao clicar no botão
        btn.addEventListener('click', () => this.handleSearch());

        // Pesquisar ao apertar Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Fechar resultados ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideResults();
            }
        });
    },

    handleSearch: async function () {
        const input = document.getElementById('mapSearchInput');
        const query = input.value.trim();

        if (!query) return;

        // 1. Tentar interpretar como coordenadas
        const coords = this.parseCoordinates(query);
        if (coords) {
            this.goToLocation(coords.lat, coords.lon, "Coordenadas informadas");
            this.hideResults();
            return;
        }

        // 2. Se não forem coordenadas, buscar como CAR
        await this.searchCAR(query);
    },

    /**
     * Busca CARs pelo cod_imovel no backend.
     */
    searchCAR: async function (query) {
        if (query.length < 3) {
            this.showResultsMessage('Digite pelo menos 3 caracteres para buscar CAR');
            return;
        }

        this.showResultsMessage('🔄 Buscando...');

        try {
            const response = await fetch(`/buscar-car?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.status === 'erro') {
                this.showResultsMessage(`⚠️ ${data.mensagem}`);
                return;
            }

            const resultados = data.resultados || [];

            if (resultados.length === 0) {
                this.showResultsMessage('Nenhum CAR encontrado');
                return;
            }

            this.showCARResults(resultados);

        } catch (err) {
            console.error('[SEARCH] Erro ao buscar CAR:', err);
            this.showResultsMessage('❌ Erro ao buscar CAR');
        }
    },

    /**
     * Exibe resultados de CAR no dropdown.
     */
    showCARResults: function (resultados) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        container.innerHTML = '';

        resultados.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <span class="name">
                    <span class="search-badge">CAR</span>
                    ${item.cod_imovel}
                </span>
                <span class="coords">${item.centroid[0].toFixed(4)}, ${item.centroid[1].toFixed(4)}</span>
            `;
            div.addEventListener('click', () => {
                this.selectCARResult(item);
                this.hideResults();
            });
            container.appendChild(div);
        });

        container.classList.add('active');
    },

    /**
     * Ao clicar num resultado CAR: carrega o polígono no mapa para análise.
     */
    selectCARResult: function (item) {
        if (!MAP.state.leafletMap) return;

        const map = MAP.state.leafletMap;

        // Remover layer CAR de visualização anterior (se existir)
        if (this.state.carLayer) {
            map.removeLayer(this.state.carLayer);
            this.state.carLayer = null;
        }

        // Remover marcador de pesquisa anterior
        if (this.state.currentMarker) {
            map.removeLayer(this.state.currentMarker);
            this.state.currentMarker = null;
        }

        // Limpar polígonos e análises anteriores para carregar o novo CAR
        APP.clear();

        try {
            // Usar addGeoJsonAsDrawn para registrar o polígono como "desenhado",
            // habilitando as análises (mesma lógica da busca por código de imóvel)
            const layer = MAP.addGeoJsonAsDrawn(item.geojson, `CAR: ${item.cod_imovel}`);

            if (layer) {
                APP.state.drawnPolygon = layer;
                APP.state.currentPropertyCode = item.cod_imovel;
                APP.updateAnalysisButtons(true);

                // Zoom para os limites do polígono
                try {
                    const bounds = layer.getBounds ? layer.getBounds() : L.geoJSON(item.geojson).getBounds();
                    map.flyToBounds(bounds, {
                        padding: [50, 50],
                        duration: 1.5,
                        maxZoom: 15
                    });
                } catch (e) {
                    // Fallback: zoom para o centroide
                    map.flyTo(item.centroid, 13, { duration: 1.5 });
                }

                APP.showStatus(`CAR ${item.cod_imovel} carregado. Pronto para análise!`, 'success');
            } else {
                APP.showStatus('Erro ao carregar geometria do CAR no mapa', 'error');
            }

        } catch (err) {
            console.error('[SEARCH] Erro ao carregar CAR no mapa:', err);
            APP.showStatus('Erro ao carregar CAR no mapa', 'error');
        }
    },

    /**
     * Exibe uma mensagem no dropdown de resultados.
     */
    showResultsMessage: function (message) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        container.innerHTML = `<div class="search-result-item" style="cursor: default; opacity: 0.7;">
            <span class="name">${message}</span>
        </div>`;
        container.classList.add('active');
    },

    /**
     * Esconde o dropdown de resultados.
     */
    hideResults: function () {
        const container = document.getElementById('searchResults');
        if (container) {
            container.classList.remove('active');
        }
    },

    /**
     * Tenta extrair coordenadas lat/lon de uma string.
     * Suporta Decimal (-23.55, -46.63) e GMS (23° 33' S, 46° 38' W).
     */
    parseCoordinates: function (input) {
        // Limpar a string para facilitar regex
        const clean = input.toUpperCase().replace(/[,;]/g, ' ').trim();
        console.log("[SEARCH] Parsing input:", clean);

        // Se contém letras além de N/S/E/W (coordenadas), não é coordenada
        // Isso evita que códigos CAR (ex: BA-2927408-7D5E...) sejam interpretados como GMS
        const nonCoordLetters = clean.replace(/[^A-Z]/g, '').replace(/[NSEW]/g, '');
        if (nonCoordLetters.length > 0) {
            console.log("[SEARCH] Contém letras não-coordenadas, pulando parse:", nonCoordLetters);
            return null;
        }

        // 1. Tentar Decimal simples (ex: -23.5475 -46.6358)
        const decimalMatch = clean.match(/^([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)$/);
        if (decimalMatch) {
            const lat = parseFloat(decimalMatch[1]);
            const lon = parseFloat(decimalMatch[2]);
            if (this.isValidCoords(lat, lon)) {
                console.log("[SEARCH] Decimal matched:", lat, lon);
                return { lat, lon };
            }
        }

        // 2. Tentar GMS completo ou parcial (Graus, Minutos opcional, Segundos opcional, Direção)
        // Regex para capturar um par de coordenadas GMS
        // Formato: D° M' S" DIR  ou D M S DIR ou D° M' DIR etc.
        const partPattern = /(\d+)[°\s]*(\d+)?['\s]*(\d+\.?\d*)?["\s]*([NSEW])/g;
        const matches = [...clean.matchAll(partPattern)];
        console.log("[SEARCH] GMS matches found:", matches.length);

        if (matches.length === 2) {
            const lat = this.gmsToDecimal(
                matches[0][1], // Graus
                matches[0][2] || 0, // Minutos (default 0)
                matches[0][3] || 0, // Segundos (default 0)
                matches[0][4] // Direção
            );
            const lon = this.gmsToDecimal(
                matches[1][1],
                matches[1][2] || 0,
                matches[1][3] || 0,
                matches[1][4]
            );

            console.log("[SEARCH] GMS result:", lat, lon);
            if (this.isValidCoords(lat, lon)) return { lat, lon };
        }

        return null;
    },

    gmsToDecimal: function (d, m, s, dir) {
        const degrees = parseFloat(d) || 0;
        const minutes = parseFloat(m) || 0;
        const seconds = parseFloat(s) || 0;

        let dec = degrees + minutes / 60 + seconds / 3600;
        if (dir === 'S' || dir === 'W') dec = -dec;
        return dec;
    },

    isValidCoords: function (lat, lon) {
        return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    },

    goToLocation: function (lat, lon, label) {
        if (!MAP.state.leafletMap) return;

        const map = MAP.state.leafletMap;

        // Remover layer CAR anterior ao navegar por coordenadas
        if (this.state.carLayer) {
            map.removeLayer(this.state.carLayer);
            this.state.carLayer = null;
        }

        // Suave animação para o local
        map.flyTo([lat, lon], 13, {
            duration: 1.5
        });

        // Adicionar ou mover marcador
        if (this.state.currentMarker) {
            this.state.currentMarker.setLatLng([lat, lon]);
            this.state.currentMarker.getPopup().setContent(`<b>${label}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        } else {
            this.state.currentMarker = L.marker([lat, lon])
                .addTo(map)
                .bindPopup(`<b>${label}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}`)
                .openPopup();
        }

        APP.showStatus(`Localizado: ${label}`, 'success');
    }
};
