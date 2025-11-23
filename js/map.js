// Gerenciamento do mapa
const MAP = {
    state: {
        leafletMap: null,
        baseLayers: {},
        currentBaseLayer: null,
        polygonLayers: [],
        rasterLayers: [],
        useLeaflet: false,
        currentHighlightedIndex: -1,
        // Novas variáveis para desenho
        drawControl: null,
        drawnItems: null,
        isDrawing: false,
        currentDrawingLayer: null
    },
    
    // Inicializar mapa Leaflet
    initLeaflet: function() {
        if (typeof L === 'undefined') {
            console.warn('Leaflet não carregado. Usando canvas offline.');
            return;
        }
        
        this.state.leafletMap = L.map('leafletMap').setView([-15.83, -47.92], 10);
        
        // Configurar camadas base
        this.state.baseLayers.map = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
        
        this.state.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        });
        
        // Adicionar camada padrão (MAP)
        this.state.baseLayers.map.addTo(this.state.leafletMap);
        this.state.currentBaseLayer = this.state.baseLayers.map;
        
        // Inicializar controles de desenho
        this.initDrawingControls();
        
        // Ajustar tamanho quando o container mudar
        new ResizeObserver(() => {
            if (this.state.leafletMap) this.state.leafletMap.invalidateSize();
        }).observe(document.getElementById('leafletMap'));
        
        return true;
    },

    // Inicializar controles de desenho
    initDrawingControls: function() {
        if (!this.state.leafletMap) return;
        
        // Camada para armazenar os elementos desenhados
        this.state.drawnItems = new L.FeatureGroup();
        this.state.leafletMap.addLayer(this.state.drawnItems);
        
        // Configurar opções de desenho
        const drawControlOptions = {
            position: 'topright',
            draw: {
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#e1e100',
                        message: '<strong>Erro:</strong> Polígono não permitido!'
                    },
                    shapeOptions: {
                        color: '#4cc9f0',
                        fillColor: '#4cc9f0',
                        fillOpacity: 0.2,
                        weight: 3
                    },
                    showArea: true,
                    metric: true,
                    finishOn: 'dblclick', // Finalizar com duplo clique
                    guidelineDistance: 20
                },
                polyline: false,
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false
            },
            edit: {
                featureGroup: this.state.drawnItems,
                remove: true,
                edit: true
            }
        };
        
        // Criar controle de desenho (mas não adicionar ao mapa ainda)
        this.state.drawControl = new L.Control.Draw(drawControlOptions);
        
        // Adicionar controle de edição ao mapa (para editar polígonos existentes)
        const editControl = new L.Control.Draw({
            edit: {
                featureGroup: this.state.drawnItems,
                remove: true
            },
            draw: false
        });
        this.state.leafletMap.addControl(editControl);
        
        // Eventos de desenho
        this.state.leafletMap.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            
            // Verificar se o polígono tem pelo menos 3 pontos
            if (layer instanceof L.Polygon) {
                const latLngs = layer.getLatLngs()[0];
                if (latLngs.length < 3) {
                    APP.showStatus('Polígono precisa ter pelo menos 3 pontos.', 'error');
                    return;
                }
            }
            
            this.state.drawnItems.addLayer(layer);
            this.state.currentDrawingLayer = layer;
            
            // Disparar evento personalizado para o app
            const event = new CustomEvent('polygonDrawn', { 
                detail: { layer: layer, type: e.layerType } 
            });
            window.dispatchEvent(event);
        });
        
        this.state.leafletMap.on(L.Draw.Event.EDITED, (e) => {
            const event = new CustomEvent('polygonEdited', { 
                detail: { layers: e.layers } 
            });
            window.dispatchEvent(event);
        });
        
        this.state.leafletMap.on(L.Draw.Event.DELETED, (e) => {
            this.state.currentDrawingLayer = null;
            const event = new CustomEvent('polygonDeleted', { 
                detail: { layers: e.layers } 
            });
            window.dispatchEvent(event);
        });

        this.state.leafletMap.on(L.Draw.Event.DRAWSTART, (e) => {
            this.state.isDrawing = true;
        });

        this.state.leafletMap.on(L.Draw.Event.DRAWSTOP, (e) => {
            this.state.isDrawing = false;
        });
    },

    // Função para ativar/desativar modo de desenho
toggleDrawing: function(enable) {
    if (!this.state.leafletMap || !this.state.drawControl) return;
    
    if (enable) {
        // Ativar modo de desenho - iniciar desenho de polígono
        new L.Draw.Polygon(this.state.leafletMap, this.state.drawControl.options.draw.polygon).enable();
        this.state.isDrawing = true;
    } else {
        // Desativar modo de desenho
        this.state.isDrawing = false;
        // Cancelar qualquer desenho em andamento
        this.state.leafletMap.fire(L.Draw.Event.DRAWSTOP);
    }
},

    // Exportar polígono desenhado para KML
    exportDrawnPolygonToKML: function() {
        if (!this.state.drawnItems || this.state.drawnItems.getLayers().length === 0) {
            return null;
        }
        
        const layers = this.state.drawnItems.getLayers();
        
        // Verificar se há pelo menos um polígono válido
        const validPolygons = layers.filter(layer => 
            layer instanceof L.Polygon && layer.getLatLngs().length > 0
        );
        
        if (validPolygons.length === 0) {
            return null;
        }
        
        let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Polígono Desenhado - InfoGEO</name>
    <description>Polígono desenhado no InfoGEO</description>`;
        
        validPolygons.forEach((layer, index) => {
            if (layer instanceof L.Polygon) {
                const latLngs = layer.getLatLngs()[0]; // Primeiro anel do polígono
                
                // Garantir que temos coordenadas suficientes para um polígono
                if (latLngs.length < 3) {
                    console.warn('Polígono com menos de 3 pontos, ignorando.');
                    return;
                }
                
                // Formatar coordenadas corretamente para KML
                const coordinates = latLngs.map(latlng => 
                    `${latlng.lng.toFixed(6)},${latlng.lat.toFixed(6)},0`
                ).join(' ');
                
                // Fechar o polígono (repetir primeira coordenada no final)
                const firstCoord = `${latLngs[0].lng.toFixed(6)},${latLngs[0].lat.toFixed(6)},0`;
                const closedCoordinates = coordinates + ' ' + firstCoord;
                
                kmlContent += `
      <Placemark>
      <name>Polígono ${index + 1}</name>
      <Style>
        <LineStyle>
          <color>ff4cc9f0</color>
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>404cc9f0</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${closedCoordinates}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
            }
        });
        
        kmlContent += `
  </Document>
</kml>`;
        
        return kmlContent;
    },

    // Adicionar GeoJSON como polígono desenhado (inserido em drawnItems)
    addGeoJsonAsDrawn: function(geojson, name) {
        if (!this.state.leafletMap) return null;

        // Limpar desenhos anteriores
        // (não removemos polygonLayers porque são polígonos carregados via KML/arquivo)
        if (!this.state.drawnItems) {
            this.state.drawnItems = new L.FeatureGroup();
            this.state.leafletMap.addLayer(this.state.drawnItems);
        }

        try {
            const style = {
                color: '#ff7800',
                weight: 3,
                opacity: 0.9,
                fillOpacity: 0.15
            };

            const layer = L.geoJSON(geojson, {
                style: style,
                onEachFeature: function(feature, lyr) {
                    const title = name || (feature.properties && (feature.properties.nome || feature.properties.codigo_imo || 'Imóvel'));
                    if (lyr.bindPopup) lyr.bindPopup(`<b>${title}</b>`);
                }
            }).addTo(this.state.drawnItems);

            // Se o GeoJSON criou um FeatureGroup, pegar o primeiro layer como currentDrawingLayer
            let addedLayer = null;
            if (layer && layer.getLayers && layer.getLayers().length) {
                addedLayer = layer.getLayers()[0];
            } else if (layer instanceof L.Layer) {
                addedLayer = layer;
            }

            if (addedLayer) {
                this.state.currentDrawingLayer = addedLayer;
                // garantir que o control de edição reconheça a feature
                return addedLayer;
            }
        } catch (e) {
            console.error('Erro ao adicionar GeoJSON como desenhado:', e);
        }
        return null;
    },

    // Função para limpar polígonos desenhados
    clearDrawnPolygons: function() {
        if (this.state.drawnItems) {
            this.state.drawnItems.clearLayers();
            this.state.currentDrawingLayer = null;
        }
    },

    // Obter o polígono atualmente desenhado
    getCurrentDrawnPolygon: function() {
        return this.state.currentDrawingLayer;
    },
    
    // Mostrar/ocultar mapa Leaflet
    showLeafletMap: function(show) {
        const leafletMapDiv = document.getElementById('leafletMap');
        const mapCanvas = document.getElementById('map');
        
        if (show && this.state.leafletMap) {
            leafletMapDiv.style.display = 'block';
            mapCanvas.style.display = 'none';
            this.state.useLeaflet = true;
        } else {
            leafletMapDiv.style.display = 'none';
            mapCanvas.style.display = 'block';
            this.state.useLeaflet = false;
        }
    },
    
    // Alternar para visualização de mapa
    showMapBase: function() {
        if (!this.state.leafletMap) return;
        
        if (this.state.currentBaseLayer) {
            this.state.leafletMap.removeLayer(this.state.currentBaseLayer);
        }
        
        this.state.baseLayers.map.addTo(this.state.leafletMap);
        this.state.currentBaseLayer = this.state.baseLayers.map;
        
        document.getElementById('satelliteDate').style.display = 'none';
        this.showLeafletMap(true);
    },
    
    // Alternar para visualização de satélite
    showSatelliteBase: function() {
        if (!this.state.leafletMap) return;
        
        if (this.state.currentBaseLayer) {
            this.state.leafletMap.removeLayer(this.state.currentBaseLayer);
        }
        
        this.state.baseLayers.satellite.addTo(this.state.leafletMap);
        this.state.currentBaseLayer = this.state.baseLayers.satellite;
        
        document.getElementById('satelliteDate').style.display = 'block';
        this.showLeafletMap(true);
    },
    
    // Ocultar mapa base
    hideBaseMap: function() {
        if (!this.state.leafletMap) return;
        
        if (this.state.currentBaseLayer) {
            this.state.leafletMap.removeLayer(this.state.currentBaseLayer);
            this.state.currentBaseLayer = null;
        }
        
        document.getElementById('satelliteDate').style.display = 'none';
        this.showLeafletMap(true);
    },
    
    // Adicionar polígono ao mapa
    addPolygon: function(coordinates, name = 'Polígono', color = '#4cc9f0', index = 0) {
        if (!this.state.leafletMap) return null;
        
        const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
        const polygonLayer = L.polygon(latLngs, {
            color: color,
            fillOpacity: 0,
            weight: 3,
            opacity: 0.8
        }).addTo(this.state.leafletMap);
        
        // Truncar nome do arquivo se muito longo (máximo 30 caracteres)
        const displayName = name.length > 30 ? name.substring(0, 27) + '...' : name;
        
        // Criar popup com estilo clicável e ID único
        const popupContent = `
            <div id="popup-${index}" style="cursor: pointer; user-select: none;" class="polygon-popup-content">
                <b title="${name}">${displayName}</b><br>
                Polígono ${index + 1}<br>
                <small style="color: #4cc9f0;">👆 Clique para ver detalhes</small>
            </div>
        `;
        
        polygonLayer.bindPopup(popupContent);
        
        // Adicionar evento de clique ao popup quando ele for aberto
        polygonLayer.on('popupopen', (e) => {
            const popupElement = document.getElementById(`popup-${index}`);
            if (popupElement) {
                popupElement.onclick = function(evt) {
                    evt.stopPropagation();
                    if (typeof APP !== 'undefined') {
                        APP.selectPolygonByClick(index);
                    }
                };
            }
        });
        
        this.state.polygonLayers[index] = polygonLayer;
        
        return polygonLayer;
    },
    
    // Adicionar raster para um polígono específico
    addRasterForPolygon: function(index, imageBase64, bounds, options = {}) {
        if (!this.state.leafletMap) return null;

        if (this.state.rasterLayers[index]) {
            this.state.leafletMap.removeLayer(this.state.rasterLayers[index]);
        }

        const imageUrl = `data:image/png;base64,${imageBase64}`;
        let rasterBounds = bounds;

        // Se não temos bounds específicos do raster, usar os bounds do polígono
        if (!rasterBounds) {
            if (this.state.polygonLayers[index]) {
                rasterBounds = this.state.polygonLayers[index].getBounds();
            } else if (this.state.drawnItems && this.state.drawnItems.getLayers().length > 0) {
                // Para polígonos desenhados ou do SIGEF
                rasterBounds = this.state.drawnItems.getBounds();
            }
        }

        if (!rasterBounds) {
            console.error('Não foi possível obter bounds para o raster');
            return null;
        }

        // Optionally add small padding to bounds. Default is no padding for pixel-perfect alignment.
        const paddingPercent = typeof options.paddingPercent === 'number' ? options.paddingPercent : 0.0;
        const sw = rasterBounds.getSouthWest();
        const ne = rasterBounds.getNorthEast();

        let finalBounds = rasterBounds;
        if (paddingPercent > 0) {
            const padding = {
                lat: Math.abs(ne.lat - sw.lat) * paddingPercent,
                lng: Math.abs(ne.lng - sw.lng) * paddingPercent
            };
            finalBounds = L.latLngBounds(
                L.latLng(sw.lat - padding.lat, sw.lng - padding.lng),
                L.latLng(ne.lat + padding.lat, ne.lng + padding.lng)
            );
        }

        const rasterLayer = L.imageOverlay(imageUrl, finalBounds, {
            opacity: 0.8,
            interactive: true
        }).addTo(this.state.leafletMap);

        // Adicionar evento de clique para mostrar valores
        rasterLayer.on('click', (e) => {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Coordenadas: ${lat}, ${lng}`)
                .openOn(this.state.leafletMap);
        });

        this.state.rasterLayers[index] = rasterLayer;
        return rasterLayer;
    },
    
    // Destacar polígono específico
    highlightPolygon: function(index) {
        this.state.polygonLayers.forEach((layer, i) => {
            if (layer) {
                const colors = ['#4cc9f0', '#f04c7c', '#4cf0a7', '#f0a74c', '#a74cf0'];
                const normalColor = colors[i % colors.length];
                layer.setStyle({
                    color: i === index ? '#ffeb3b' : normalColor,
                    weight: i === index ? 5 : 3,
                    opacity: i === index ? 1 : 0.8,
                    fillOpacity: 0
                });

                if (i === index) {
                    layer.openPopup();
                }
            }
        });

        this.state.currentHighlightedIndex = index;
    },
    
    // Zoom para polígono específico
    zoomToPolygon: function(index) {
        if (this.state.leafletMap && this.state.polygonLayers[index]) {
            const bounds = this.state.polygonLayers[index].getBounds();
            this.state.leafletMap.fitBounds(bounds, { 
                padding: [20, 20],
                maxZoom: 16
            });
        }
    },

    // Zoom para bounds específicos
    zoomToBounds: function(bounds) {
        if (this.state.leafletMap && bounds) {
            this.state.leafletMap.fitBounds(bounds, { 
                padding: [20, 20],
                maxZoom: 16
            });
        }
    },
    
    // Zoom para mostrar todos os polígonos
    zoomToAllPolygons: function() {
        if (this.state.leafletMap && this.state.polygonLayers.length > 0) {
            const visibleLayers = this.state.polygonLayers.filter(layer => layer !== null);
            if (visibleLayers.length > 0) {
                const group = new L.featureGroup(visibleLayers);
                this.state.leafletMap.fitBounds(group.getBounds(), { 
                    padding: [20, 20],
                    maxZoom: 12
                });
            }
        }
    },
    
    // Ajustar opacidade de todos os rasters
    setRasterOpacity: function(opacity) {
        this.state.rasterLayers.forEach(layer => {
            if (layer) {
                layer.setOpacity(opacity);
            }
        });
    },
    
    // Obter bounds de um polígono específico
    getPolygonBounds: function(index) {
        if (this.state.polygonLayers[index]) {
            return this.state.polygonLayers[index].getBounds();
        }
        return null;
    },
    
    // Limpar apenas rasters
    clearRasters: function() {
        if (this.state.leafletMap) {
            this.state.rasterLayers.forEach(layer => {
                if (layer) {
                    this.state.leafletMap.removeLayer(layer);
                }
            });
            this.state.rasterLayers = [];
        }
        document.getElementById('opacityControl').style.display = 'none';
    },
    
    // Limpar apenas polígonos
    clearPolygons: function() {
        if (this.state.leafletMap) {
            this.state.polygonLayers.forEach(layer => {
                if (layer) {
                    this.state.leafletMap.removeLayer(layer);
                }
            });
            this.state.polygonLayers = [];
        }
    },
    
    // Limpar mapa
    clear: function() {
        if (this.state.leafletMap) {
            this.state.polygonLayers.forEach(layer => {
                if (layer) {
                    this.state.leafletMap.removeLayer(layer);
                }
            });
            this.state.polygonLayers = [];
            
            this.state.rasterLayers.forEach(layer => {
                if (layer) {
                    this.state.leafletMap.removeLayer(layer);
                }
            });
            this.state.rasterLayers = [];
            
            this.clearDrawnPolygons();
        }
        
        document.getElementById('opacityControl').style.display = 'none';
        document.getElementById('satelliteDate').style.display = 'none';
        document.getElementById('hud').textContent = 'Nenhum polígono carregado';
        
        this.state.currentHighlightedIndex = -1;
    },
    
    // Ajustar visualização para mostrar todos os elementos
    fitToBounds: function() {
        if (this.state.leafletMap && this.state.polygonLayers.length > 0) {
            const visibleLayers = this.state.polygonLayers.filter(layer => layer !== null);
            if (visibleLayers.length > 0) {
                const group = new L.featureGroup(visibleLayers);
                this.state.leafletMap.fitBounds(group.getBounds(), { 
                    padding: [20, 20],
                    maxZoom: 12
                });
                
                document.getElementById('hud').textContent = 
                    `${visibleLayers.length} polígono(s) carregado(s)`;
            }
        }
    }
};