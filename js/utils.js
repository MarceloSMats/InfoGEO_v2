// Utilitários gerais
const UTILS = {
    // Cores para as classes de uso do solo
    CLASSES_CORES: {
        0: "#CCCCCC",  // cinza claro para NoData/fora do raster
        1: "#c27ba0", 2: "#9932cc", 3: "#edde8e", 4: "#d6bc74", 5: "#d4271e",
        6: "#7a5900", 8: "#1f8d49", 9: "#2532e4", 10: "#5e5e5e", 100: "#000000"
    },
    
    // Nomes das classes
    CLASSES_NOMES: {
        0: "Sem classe (NoData/fora do raster)",
        1: "Lavoura Anual",
        2: "Lavoura Perene",
        3: "Pastagem Cultivada",
        4: "Pastagem Nativa",
        5: "Pastagem Degradada",
        6: "Silvicultura (Comercial)",
        8: "Área de preservação (RL,APP)",
        9: "Lagos, lagoas",
        10: "Construções e Benfeitorias (+ servidão)",
        100: "Uso Agropecuário não Definido"
    },

    // Funções auxiliares
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    
    download: (filename, text, mime = 'text/plain;charset=utf-8') => {
        const blob = new Blob([text], {type: mime});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // Converter decimal para GMS (Graus, Minutos, Segundos)
    decimalToGMS: (decimal, isLatitude) => {
        const absDecimal = Math.abs(decimal);
        const degrees = Math.floor(absDecimal);
        const minutesFloat = (absDecimal - degrees) * 60;
        const minutes = Math.floor(minutesFloat);
        const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
        
        const direction = isLatitude 
            ? (decimal >= 0 ? 'N' : 'S')
            : (decimal >= 0 ? 'E' : 'W');
            
        return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
    },
    
    // Converter hex para RGB
    hexToRgb: (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    },
    
    // Calcular centroide de um polígono
    calculateCentroid: (polygon) => {
        if (!polygon || !polygon.coordinates || polygon.coordinates.length === 0) 
            return null;
        
        const coords = polygon.coordinates[0];
        let sumX = 0, sumY = 0;
        
        for (let i = 0; i < coords.length - 1; i++) {
            sumX += coords[i][0];
            sumY += coords[i][1];
        }
        
        const centerX = sumX / (coords.length - 1);
        const centerY = sumY / (coords.length - 1);
        
        return {
            x: centerX,
            y: centerY,
            latGMS: UTILS.decimalToGMS(centerY, true),
            lonGMS: UTILS.decimalToGMS(centerX, false)
        };
    },

    // Calcular centroide de um polígono Leaflet
    calculateLeafletCentroid: (leafletPolygon) => {
        if (!leafletPolygon || !leafletPolygon.getLatLngs) return null;
        
        const latLngs = leafletPolygon.getLatLngs()[0]; // Primeiro anel do polígono
        if (!latLngs || latLngs.length < 3) return null;
        
        let sumX = 0, sumY = 0;
        
        for (let i = 0; i < latLngs.length; i++) {
            sumX += latLngs[i].lng;
            sumY += latLngs[i].lat;
        }
        
        const centerX = sumX / latLngs.length;
        const centerY = sumY / latLngs.length;
        
        return {
            x: centerX,
            y: centerY,
            latGMS: UTILS.decimalToGMS(centerY, true),
            lonGMS: UTILS.decimalToGMS(centerX, false)
        };
    },

    // Converter polígono Leaflet para GeoJSON
    leafletToGeoJSON: (leafletPolygon) => {
        if (!leafletPolygon || !leafletPolygon.getLatLngs) return null;
        
        const latLngs = leafletPolygon.getLatLngs()[0]; // Primeiro anel
        const coordinates = latLngs.map(latlng => [latlng.lng, latlng.lat]);
        
        // Fechar o polígono (adicionar primeira coordenada no final)
        if (coordinates.length > 0) {
            coordinates.push([coordinates[0][0], coordinates[0][1]]);
        }
        
        return {
            type: 'Polygon',
            coordinates: [coordinates]
        };
    },
    
    // Extrair coordenadas de texto KML
    parseKmlCoordinates: (coordinatesText) => {
        const coordPairs = coordinatesText.trim().split(/\s+/);
        return coordPairs.map(pair => {
            const [lon, lat] = pair.split(',').map(Number);
            return [lon, lat];
        });
    },
    
    // Validar arquivo
    validateFile: (file, allowedExtensions) => {
        const extension = file.name.toLowerCase().split('.').pop();
        return allowedExtensions.includes(`.${extension}`);
    },
    
    // Formatar tamanho de arquivo
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    // Função para extrair múltiplos polígonos de KML
//    parseMultipleKmlPolygons: function(kmlContent) {
//        try {
//            const parser = new DOMParser();
//            const xmlDoc = parser.parseFromString(kmlContent, "text/xml");
//            const placemarks = xmlDoc.getElementsByTagName("Placemark");
//            
//            const polygons = [];
//           
//            for (let i = 0; i < placemarks.length; i++) {
//                const placemark = placemarks[i];
//                const coordinatesElements = placemark.getElementsByTagName("coordinates");
//                
//                for (let j = 0; j < coordinatesElements.length; j++) {
//                    const coordinatesText = coordinatesElements[j].textContent;
//                    const coordinates = this.parseKmlCoordinates(coordinatesText);
//                    
//                    if (coordinates.length >= 3) { // Mínimo para um polígono
//                        const polygon = {
//                            type: 'Polygon',
//                            coordinates: [coordinates]
 //                       };
                        
//                        polygons.push({
//                            geometry: polygon,
//                            name: placemarks.length > 1 ? `Polígono ${i + 1}` : 'Polígono',
//                            index: i
//                        });
 //                   }
//                }
//            }
//            
//            return polygons;
//        } catch (error) {
//            console.error('Erro ao parsear múltiplos polígonos KML:', error);
//            return [];
//        }
 //   }
};