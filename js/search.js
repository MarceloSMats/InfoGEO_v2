/**
 * Módulo de Pesquisa - InfoGEO
 * Gerencia a busca por coordenadas GMS e nomes de municípios.
 */
const SEARCH = {
    state: {
        lastResults: [],
        currentMarker: null
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

        // 2. Se não forem coordenadas, tratar como busca textual
        await this.performGeocode(query);
    },

    /**
     * Tenta extrair coordenadas lat/lon de uma string.
     * Suporta Decimal (-23.55, -46.63) e GMS (23° 33' S, 46° 38' W).
     */
    parseCoordinates: function (input) {
        // Limpar a string para facilitar regex
        const clean = input.toUpperCase().replace(/[,;]/g, ' ').trim();
        console.log("[SEARCH] Parsing input:", clean);

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
