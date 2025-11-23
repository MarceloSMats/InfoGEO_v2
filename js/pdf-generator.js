
/* eslint-disable no-undef */
/*
 * pdf-generator.optimized.js
 * Otimizado por M365 Copilot — 2025-11-04
 * Objetivos:
 *  - Remover duplicações (header/footer/card/split helpers)
 *  - Melhorar legibilidade e tipagem JSDoc
 *  - Tratamento de erros e valores faltantes
 *  - Padronizar alinhamentos, cores e números
 *  - Manter API pública compatível: PDF_GENERATOR.generate, PDF_GENERATOR.generateConsolidatedReport
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PDF_GENERATOR = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  /** @type {import('jspdf').jsPDF} */
  const jsPDFCtor = (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;

  const COLORS = {
    primary: [66, 133, 244],
    secondary: [52, 168, 83],
    accent: [251, 188, 5],
    text: [60, 64, 67],
    lightGray: [248, 249, 250],
    border: [218, 220, 224]
  };

  const PAGE = { width: 210, height: 297, margin: 15 };

  /** Conversor simples de HEX para RGB. */
  function hexToRgb(hex) {
    const v = hex.replace('#', '');
    const bigint = parseInt(v.length === 3
      ? v.split('').map(c => c + c).join('')
      : v, 16);
    return [ (bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255 ];
  }

  /** Carrega logo e devolve dataURL PNG. */
  async function loadLogo(logoUrl = 'images/logo_cor.png') {
    return await new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = logoUrl;
      } catch (e) { reject(e); }
    });
  }

  /** Quebra texto respeitando largura. */
  function splitTextToFit(doc, text, maxWidth, fontSize = 10) {
    doc.setFontSize(fontSize);
    const words = (text || '').toString().split(' ');
    const lines = [];
    let current = '';
    for (let i = 0; i < words.length; i++) {
      const test = (current + words[i] + ' ').trim() + ' ';
      if (doc.getTextWidth(test) > maxWidth && current !== '') {
        lines.push(current);
        current = words[i];
      } else {
        current = (current + ' ' + words[i]).trim();
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Obtém dimensões de uma imagem base64. */
  function getImageDimensions(base64Image) {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.src = base64Image;
      img.onload = () => resolve({ width: img.width, height: img.height });
    });
  }

  /** Desenha header padrão. */
  async function drawHeader(doc, title, subtitle) {
    const headerHeight = subtitle ? 40 : 30;
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, PAGE.width, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(title, PAGE.width / 2, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    if (subtitle) {
      const lines = splitTextToFit(doc, subtitle, PAGE.width - 30, 12);
      lines.forEach((line, i) => doc.text(line, PAGE.width / 2, 25 + (i * 6), { align: 'center' }));
    } else {
      doc.setFontSize(12);
      doc.text('InfoGEO - Análise Georreferenciada', PAGE.width / 2, 25, { align: 'center' });
    }

    try {
      const logoData = await loadLogo();
      doc.addImage(logoData, 'PNG', 15, 5, 20, 20);
    } catch (_) {
      // fallback
      doc.setFillColor(255, 255, 255);
      doc.circle(25, 15, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.primary);
      doc.text('InfoGEO', 20, 16);
    }

    return headerHeight;
  }

  /** Desenha footer padrão. */
  function drawFooter(doc, pageNumber, totalPages) {
    const footerY = PAGE.height - 12;
    doc.setDrawColor(...COLORS.border);
    doc.line(20, footerY - 5, PAGE.width - 20, footerY - 5);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, footerY);
    doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE.width / 2, footerY, { align: 'center' });
    doc.text('InfoGEO - Sistema de Análise de Uso do Solo', PAGE.width - 20, footerY, { align: 'right' });
  }

  /** Card container. */
  function drawCard(doc, x, y, width, height, title) {
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(x + 1, y + 1, width, height, 1, 1, 'F');

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x, y, width, height, 1, 1, 'FD');

    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(x, y, width, 12, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, x + 5, y + 8);

    return { contentX: x + 10, contentY: y + 20 };
  }

  /** Formata número com 2 casas. */
  const n2 = (v) => (typeof v === 'number' ? v : Number(v || 0)).toFixed(2);

  /** Obtém cor de classe de um mapa utilitário global se existir. */
  function getClassColor(classNum) {
    const colorHex = (typeof UTILS !== 'undefined' && UTILS.CLASSES_CORES && UTILS.CLASSES_CORES[classNum])
      ? UTILS.CLASSES_CORES[classNum]
      : '#CCCCCC';
    return (typeof UTILS !== 'undefined' && UTILS.hexToRgb) ? UTILS.hexToRgb(colorHex) : hexToRgb(colorHex);
  }

  /** Paginação simples: se passar de Y, cria nova página com header & card novamente. */
  async function ensureSpaceOrAddPage(doc, currentY, limitY, addHeaderCb) {
    if (currentY <= limitY) return { y: currentY, newPage: false };
    drawFooter(doc, doc.internal.getNumberOfPages(), '');
    doc.addPage();
    const headerH = await addHeaderCb();
    return { y: headerH + 20, newPage: true };
  }

  function safe(obj, path, fallback = undefined) {
    try { return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ?? fallback; } catch { return fallback; }
  }

  /**
   * API pública
   */
  const API = {
    /**
     * Gera relatório para um único polígono.
     * @param {any} analysisResults
     * @param {string} centroidCoords
     * @param {string} fileName
     * @param {string} propertyCode - Código do imóvel (opcional)
     */
    generate: async function (analysisResults, centroidCoords, fileName = '', propertyCode = null) {
      if (!analysisResults) return;
      if (!jsPDFCtor) throw new Error('jsPDF não encontrado em window.jspdf');
      const doc = new jsPDFCtor();

      const pageWidth = PAGE.width;
      const margin = PAGE.margin;
      const contentWidth = pageWidth - 2 * margin;

      // Remover extensão .kml, .geojson ou .json do nome do arquivo
      let polygonName = fileName || '';
      polygonName = polygonName.replace(/\.(kml|geojson|json)$/i, '');

      // Preparar título e subtítulo
      const title = 'RELATÓRIO DE USO DO SOLO';
      const subtitle = polygonName 
        ? `${polygonName}\nInfoGEO - Análise Georreferenciada`
        : 'InfoGEO - Análise Georreferenciada';
      
      const headerH = await drawHeader(doc, title, subtitle);
      
      const relatorio = analysisResults.relatorio || {};
      
      // Verificar SIGEF info antecipadamente
      const sigefInfo = safe(window, 'APP.state.sigefExcelInfo');

      // Definir alturas fixas para os quadros
      const infoCardHeight = propertyCode ? 58 : 52;
      const mapCardHeight = 80;
      const tableHeight = sigefInfo ? 100 : 80;
      
      // Calcular espaçamento para distribuir os quadros pela página
      const totalCardsHeight = infoCardHeight + mapCardHeight + tableHeight + (sigefInfo ? 35 : 0);
      const availableHeight = PAGE.height - headerH - 35; // espaço disponível menos margens
      const spacing = (availableHeight - totalCardsHeight) / 4; // 4 espaços (antes do 1º, entre 1º-2º, entre 2º-3º, depois do 3º)
      
      let yOffset = headerH + spacing;

      // INFORMAÇÕES GERAIS - Altura aumentada
      const infoCard = drawCard(doc, margin, yOffset, contentWidth, infoCardHeight, 'INFORMAÇÕES GERAIS');
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
  // Prefer backend-formatted PT-BR fields when available
  const areaTotalFormatado = relatorio.area_total_poligono_ha_formatado || (relatorio.area_total_poligono_ha != null ? String(relatorio.area_total_poligono_ha) + ' ha' : '-');
  // Adicionar símbolo R$ ao valor total
  let valorTotalFormatado = relatorio.valor_total_calculado_formatado || (relatorio.valor_total_calculado != null ? String(relatorio.valor_total_calculado) : '-');
  if (valorTotalFormatado !== '-' && !valorTotalFormatado.includes('R$')) {
    valorTotalFormatado = `R$ ${valorTotalFormatado}`;
  }
  
  // Adicionar código do imóvel se disponível com melhor espaçamento
  let yPos = infoCard.contentY;
  if (propertyCode) {
    doc.text(`Código do Imóvel: ${propertyCode}`, infoCard.contentX, yPos);
    yPos += 8;
  }
  doc.text(`Área Total Analisada: ${areaTotalFormatado}`, infoCard.contentX, yPos);
  doc.text(`Valor Total: ${valorTotalFormatado}`, infoCard.contentX, yPos + 8);
      doc.text(`Número de Classes Identificadas: ${relatorio.numero_classes_encontradas ?? '-'}`, infoCard.contentX, yPos + 16);
      doc.text(`Centroide do Polígono: ${centroidCoords || 'Não disponível'}`, infoCard.contentX, yPos + 24);

      yOffset += infoCardHeight + spacing;

      // INFORMAÇÕES CADASTRAIS BB (opcional)
      if (sigefInfo) {
        const sigefCard = drawCard(doc, margin, yOffset, contentWidth, 30, 'INFORMAÇÕES CADASTRAIS BB');
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const parts = [];
        if (sigefInfo.CLASSES_BB) parts.push(`Classe BB: ${sigefInfo.CLASSES_BB}`);
        if (sigefInfo.QT_AREA_TIP_SOLO) parts.push(`Área Tipo Solo: ${sigefInfo.QT_AREA_TIP_SOLO} ha`);
        if (sigefInfo.NM_MUNICP) parts.push(`Município: ${sigefInfo.NM_MUNICP}`);
        doc.text(parts.join('\n'), sigefCard.contentX, sigefCard.contentY - 2);
        yOffset += 35;
      }

      // MAPA (imagem)
      if (safe(analysisResults, 'imagem_recortada.base64')) {
        const padding = 8;
        const mapCard = drawCard(doc, margin, yOffset, contentWidth, mapCardHeight, 'MAPA DO USO DO SOLO');
        const imgData = `data:image/png;base64,${analysisResults.imagem_recortada.base64}`;
        const { width, height } = await getImageDimensions(imgData);
        const maxWidth = contentWidth - 2 * padding;
        const maxHeight = mapCardHeight - 10 - 2 * padding; // header 10
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        const finalW = width * ratio;
        const finalH = height * ratio;
        const imgX = mapCard.contentX + (maxWidth - finalW) / 2 - 2; // leve ajuste visual
        const imgY = mapCard.contentY + (maxHeight - finalH) / 2 - 2;
        doc.addImage(imgData, 'PNG', imgX, imgY, finalW, finalH);
        yOffset += mapCardHeight + spacing;
      }

      // TABELA DE CLASSES
      const tableCard = drawCard(doc, margin, yOffset, contentWidth, tableHeight, 'DISTRIBUIÇÃO DE CLASSES - TABELA COMPARATIVA');
      let y = tableCard.contentY;

      doc.setFillColor(...COLORS.lightGray);
      doc.rect(tableCard.contentX, y, contentWidth - 20, 8, 'F');
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CLASSE', tableCard.contentX + 2, y + 5);
      doc.text('DESCRIÇÃO', tableCard.contentX + 18, y + 5);
      doc.text('ÁREA (ha)', tableCard.contentX + 70, y + 5);
      doc.text('%', tableCard.contentX + 95, y + 5);
      doc.text('VALOR (R$)', tableCard.contentX + 115, y + 5);
      y += 8;

      doc.setFont('helvetica', 'normal');
      let rowIndex = 0;
      const entries = Object.entries(relatorio.classes || {});
      for (const [key, info] of entries) {
        if (y > 250) {
          drawFooter(doc, 1, 2);
          doc.addPage();
          await drawHeader(doc, 'RELATÓRIO DE USO DO SOLO');
          const contCard = drawCard(doc, margin, 50, contentWidth, 200, 'DISTRIBUIÇÃO DE CLASSES - TABELA (CONT.)');
          y = contCard.contentY;
          doc.setFillColor(...COLORS.lightGray);
          doc.rect(contCard.contentX, y, contentWidth - 20, 8, 'F');
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('CLASSE', contCard.contentX + 2, y + 5);
          doc.text('DESCRIÇÃO', contCard.contentX + 18, y + 5);
          doc.text('ÁREA (ha)', contCard.contentX + 70, y + 5);
          doc.text('%', contCard.contentX + 95, y + 5);
          doc.text('VALOR (R$)', contCard.contentX + 115, y + 5);
          y += 8;
          doc.setFont('helvetica', 'normal');
        }

        doc.setFillColor(...(rowIndex % 2 === 0 ? [255, 255, 255] : COLORS.lightGray));
        doc.rect(tableCard.contentX, y, contentWidth - 20, 8, 'F');

        const classNum = key.replace('Classe ', '');
        const rgb = getClassColor(classNum);
        doc.setFillColor(...rgb);
        doc.rect(tableCard.contentX + 1, y + 1, 3, 6, 'F');

        doc.setTextColor(...COLORS.text);
        doc.text(classNum, tableCard.contentX + 6, y + 5);
        doc.text((info && info.descricao) || '-', tableCard.contentX + 18, y + 5);
        // Use formatted PT-BR strings if provided by backend, else fall back to numeric values
        const areaClasseFormatada = (info && (info.area_ha_formatado || info.area_ha != null))
          ? (info.area_ha_formatado || String(info.area_ha) + ' ha')
          : '-';
        const percentualFormatado = (info && (info.percentual_formatado || info.percentual != null))
          ? (info.percentual_formatado || String(info.percentual) + '%')
          : '-';
        doc.text(String(areaClasseFormatada), tableCard.contentX + 70, y + 5);
        doc.text(String(percentualFormatado), tableCard.contentX + 95, y + 5);

        // Valor calculado (R$)
        const valorFormatado = (info && info.valor_calculado_formatado)
          ? String(info.valor_calculado_formatado)
          : '-';
        doc.text(valorFormatado, tableCard.contentX + 115, y + 5);

        y += 8; rowIndex++;
      }

      drawFooter(doc, 1, 1);
      const outName = `relatorio_uso_solo_${fileName || new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(outName);
    },

    /**
     * Relatório consolidado (múltiplos polígonos)
     * @param {Array<any>} analysisResults
     */
    generateConsolidatedReport: async function (analysisResults) {
      if (!analysisResults || analysisResults.length === 0) return;
      if (!jsPDFCtor) throw new Error('jsPDF não encontrado em window.jspdf');
      const doc = new jsPDFCtor();

      const pageWidth = PAGE.width;
      const margin = PAGE.margin;
      const contentWidth = pageWidth - 2 * margin;

      await drawHeader(doc, 'RELATÓRIO CONSOLIDADO');
      let yOffset = 40;

      // Agregação
      let areaTotalConsolidada = 0;
      const classesConsolidadas = {};
      const totalPoligonos = analysisResults.length;

      analysisResults.forEach((res) => {
        const rel = res.relatorio || {};
        areaTotalConsolidada += Number(rel.area_total_poligono_ha || 0);
        Object.entries(rel.classes || {}).forEach(([key, info]) => {
          if (!classesConsolidadas[key]) {
            classesConsolidadas[key] = { descricao: info.descricao, area_ha: 0, percentual: 0, valor_calculado: 0 };
          }
          classesConsolidadas[key].area_ha += Number(info.area_ha || 0);
          classesConsolidadas[key].valor_calculado += Number(info.valor_calculado || 0);
        });
      });

      Object.keys(classesConsolidadas).forEach((k) => {
        classesConsolidadas[k].percentual = areaTotalConsolidada
          ? (classesConsolidadas[k].area_ha / areaTotalConsolidada) * 100
          : 0;
      });

      // Card: Informações Consolidadas
      const infoCard = drawCard(doc, margin, yOffset, contentWidth, 45, 'INFORMAÇÕES CONSOLIDADAS');
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Área Total Analisada: ${n2(areaTotalConsolidada)} hectares`, infoCard.contentX, infoCard.contentY - 2);
      doc.text(`Número Total de Polígonos: ${totalPoligonos}`, infoCard.contentX, infoCard.contentY + 4);
      doc.text(`Número de Classes Identificadas: ${Object.keys(classesConsolidadas).length}`, infoCard.contentX, infoCard.contentY + 10);
      doc.text(`Data da Análise: ${new Date().toLocaleDateString('pt-BR')}`, infoCard.contentX, infoCard.contentY + 16);

      yOffset += 50;

      // Cadastro BB consolidado (se disponível)
      const consolidatedSigef = (typeof this.getConsolidatedSigefInfo === 'function')
        ? this.getConsolidatedSigefInfo(analysisResults)
        : [];
      if (consolidatedSigef && consolidatedSigef.length > 0) {
        const sigefCard = drawCard(doc, margin, yOffset, contentWidth, 30, 'CADASTRO BB - DADOS CONSOLIDADOS');
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const unique = new Set();
        let totalAreaBB = 0;
        consolidatedSigef.forEach((item) => {
          const classeBB = item.CLASSES_BB || item.CLASSE_BB;
          const area = parseFloat(item.QT_AREA_TIP_SOLO) || 0;
          if (classeBB) unique.add(classeBB);
          totalAreaBB += area;
        });
        doc.text(`Classes BB encontradas: ${unique.size}`, sigefCard.contentX, sigefCard.contentY - 2);
        doc.text(`Área total BB: ${n2(totalAreaBB)} ha`, sigefCard.contentX, sigefCard.contentY + 3);
        doc.text(`Registros totais: ${consolidatedSigef.length}`, sigefCard.contentX, sigefCard.contentY + 8);
        yOffset += 40;
      }

      // Tabela consolidada
      const tableCard = drawCard(doc, margin, yOffset, contentWidth, 120, 'DISTRIBUIÇÃO CONSOLIDADA DE CLASSES - COMPARATIVA');
      let y = tableCard.contentY;

      doc.setFillColor(...COLORS.lightGray);
      doc.rect(tableCard.contentX, y, contentWidth - 20, 8, 'F');
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CLASSE', tableCard.contentX + 2, y + 5);
      doc.text('DESCRIÇÃO', tableCard.contentX + 18, y + 5);
      doc.text('ÁREA TOTAL (ha)', tableCard.contentX + 95, y + 5);
      doc.text('%', tableCard.contentX + 135, y + 5);
      y += 8;

      doc.setFont('helvetica', 'normal');
      let rowIndex = 0;
      const sorted = Object.entries(classesConsolidadas).sort((a, b) => b[1].area_ha - a[1].area_ha);
      for (const [key, info] of sorted) {
        if (y > 230) break; // não quebra página na capa consolidada
        doc.setFillColor(...(rowIndex % 2 === 0 ? [255, 255, 255] : COLORS.lightGray));
        doc.rect(tableCard.contentX, y, contentWidth - 20, 8, 'F');

        const classNum = key.replace('Classe ', '');
        const rgb = getClassColor(classNum);
        doc.setFillColor(...rgb);
        doc.rect(tableCard.contentX + 1, y + 1, 3, 6, 'F');

        doc.setTextColor(...COLORS.text);
        doc.text(classNum, tableCard.contentX + 6, y + 5);
        doc.text(info.descricao || '-', tableCard.contentX + 18, y + 5);
        doc.text(n2(info.area_ha), tableCard.contentX + 95, y + 5);
        doc.text(n2(info.percentual) + '%', tableCard.contentX + 135, y + 5);

        y += 8; rowIndex++;
      }

      // Footer página 1 (resumo)
      drawFooter(doc, 1, totalPoligonos + 1);

      // Páginas individuais
      for (let i = 0; i < analysisResults.length; i++) {
        const result = analysisResults[i];
        doc.addPage();

        // Remover extensão .kml, .geojson ou .json do nome do arquivo
        let polygonName = result.fileName || '';
        polygonName = polygonName.replace(/\.(kml|geojson|json)$/i, '');
        
        doc.setFillColor(...COLORS.primary);
        // Header dinâmico conforme largura do nome
        doc.setFontSize(12);
        const fileNameWidth = doc.getTextWidth(polygonName);
        const headerHeight = fileNameWidth > (PAGE.width - 30) ? 40 : 30;
        doc.rect(0, 0, PAGE.width, headerHeight, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('RELATÓRIO DE USO DO SOLO', PAGE.width / 2, 12, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        if (headerHeight === 30) {
          doc.setFontSize(12);
          doc.text(polygonName, PAGE.width / 2, 20, { align: 'center' });
          doc.setFontSize(10);
          doc.text('InfoGEO - Análise Georreferenciada', PAGE.width / 2, 26, { align: 'center' });
        } else {
          const lines = splitTextToFit(doc, polygonName, PAGE.width - 30, 10);
          lines.forEach((line, idx) => doc.text(line, PAGE.width / 2, 20 + (idx * 6), { align: 'center' }));
          doc.setFontSize(10);
          doc.text('InfoGEO - Análise Georreferenciada', PAGE.width / 2, 32, { align: 'center' });
        }

        try {
          const logoData = await loadLogo();
          doc.addImage(logoData, 'PNG', 15, 5, 20, 20);
        } catch (_) {
          doc.setFillColor(255, 255, 255);
          doc.circle(25, 15, 8, 'F');
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.primary);
          doc.text('InfoGEO', 20, 16);
        }

        let yOffset = headerHeight + 10;
        const relatorio = result.relatorio || {};
        
        // Definir alturas fixas para os quadros
        const infoCardHeight2 = 52;
        const mapCardHeight2 = 80;
        const tableHeight2 = 80;
        
        // Calcular espaçamento para distribuir os quadros pela página
        const totalCardsHeight2 = infoCardHeight2 + mapCardHeight2 + tableHeight2;
        const availableHeight2 = PAGE.height - headerHeight - 35;
        const spacing2 = (availableHeight2 - totalCardsHeight2) / 4;
        
        yOffset = headerHeight + spacing2;
        
        const infoCard2 = drawCard(doc, margin, yOffset, contentWidth, infoCardHeight2, 'INFORMAÇÕES GERAIS');
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
  const areaTotalFormatado2 = relatorio.area_total_poligono_ha_formatado || (relatorio.area_total_poligono_ha != null ? String(relatorio.area_total_poligono_ha) + ' ha' : '-');
  // Adicionar símbolo R$ ao valor total
  let valorTotalFormatado2 = relatorio.valor_total_calculado_formatado || (relatorio.valor_total_calculado != null ? String(relatorio.valor_total_calculado) : '-');
  if (valorTotalFormatado2 !== '-' && !valorTotalFormatado2.includes('R$')) {
    valorTotalFormatado2 = `R$ ${valorTotalFormatado2}`;
  }
  
  let yPos2 = infoCard2.contentY;
  doc.text(`Área Total Analisada: ${areaTotalFormatado2}`, infoCard2.contentX, yPos2);
  doc.text(`Valor Total: ${valorTotalFormatado2}`, infoCard2.contentX, yPos2 + 8);
        doc.text(`Número de Classes Identificadas: ${relatorio.numero_classes_encontradas ?? '-'}`, infoCard2.contentX, yPos2 + 16);

        // Centroide (se disponível via APP/UTILS)
        let centroidText = 'Não disponível';
        try {
          const feature = (typeof APP !== 'undefined' && APP.state && Array.isArray(APP.state.features))
            ? APP.state.features.find(f => f.index === result.fileIndex)
            : null;
          if (feature && typeof UTILS !== 'undefined' && typeof UTILS.calculateCentroid === 'function') {
            const centroid = UTILS.calculateCentroid(feature.geometry);
            if (centroid) centroidText = `${centroid.latGMS}, ${centroid.lonGMS}`;
          }
        } catch (_) {}
        doc.text(`Centroide do Polígono: ${centroidText}`, infoCard2.contentX, yPos2 + 24);
        yOffset += infoCardHeight2 + spacing2;

        // Imagem
        if (safe(result, 'imagem_recortada.base64')) {
          const padding = 8;
          const mapCard2 = drawCard(doc, margin, yOffset, contentWidth, mapCardHeight2, 'MAPA DO USO DO SOLO');
          const imgData = `data:image/png;base64,${result.imagem_recortada.base64}`;
          const { width, height } = await getImageDimensions(imgData);
          const maxWidth = contentWidth - 2 * padding;
          const maxHeight = mapCardHeight2 - 10 - 2 * padding;
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          const finalW = width * ratio;
          const finalH = height * ratio;
          const imgX = mapCard2.contentX + (maxWidth - finalW) / 2 - 2;
          const imgY = mapCard2.contentY + (maxHeight - finalH) / 2 - 2;
          doc.addImage(imgData, 'PNG', imgX, imgY, finalW, finalH);
          yOffset += mapCardHeight2 + spacing2;
        }

        const tableCard2 = drawCard(doc, margin, yOffset, contentWidth, tableHeight2, 'DISTRIBUIÇÃO DE CLASSES - TABELA COMPARATIVA');
        let y2 = tableCard2.contentY;

        doc.setFillColor(...COLORS.lightGray);
        doc.rect(tableCard2.contentX, y2, contentWidth - 20, 8, 'F');
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('CLASSE', tableCard2.contentX + 2, y2 + 5);
        doc.text('DESCRIÇÃO', tableCard2.contentX + 18, y2 + 5);
        doc.text('ÁREA (ha)', tableCard2.contentX + 70, y2 + 5);
        doc.text('%', tableCard2.contentX + 95, y2 + 5);
        doc.text('VALOR (R$)', tableCard2.contentX + 115, y2 + 5);
        y2 += 8;

        doc.setFont('helvetica', 'normal');
        let r = 0;
        for (const [key, info] of Object.entries(relatorio.classes || {})) {
          if (y2 > 250) {
            drawFooter(doc, i + 2, totalPoligonos + 1);
            doc.addPage();
            // header contínuo
            doc.setFillColor(...COLORS.primary);
            doc.rect(0, 0, PAGE.width, headerHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('RELATÓRIO DE USO DO SOLO', PAGE.width / 2, 12, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.text(`${polygonName} (CONT.)`, PAGE.width / 2, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text('InfoGEO - Análise Georreferenciada', PAGE.width / 2, 26, { align: 'center' });

            try {
              const logoData = await loadLogo();
              doc.addImage(logoData, 'PNG', 15, 5, 20, 20);
            } catch (_) {
              doc.setFillColor(255, 255, 255);
              doc.circle(25, 15, 8, 'F');
              doc.setFontSize(8);
              doc.setTextColor(...COLORS.primary);
              doc.text('InfoGEO', 20, 16);
            }

            const contTable = drawCard(doc, margin, headerHeight + 10, contentWidth, 200, 'DISTRIBUIÇÃO DE CLASSES - TABELA (CONT.)');
            y2 = contTable.contentY;

            doc.setFillColor(...COLORS.lightGray);
            doc.rect(contTable.contentX, y2, contentWidth - 20, 8, 'F');
            doc.setTextColor(...COLORS.text);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('CLASSE', contTable.contentX + 2, y2 + 5);
            doc.text('DESCRIÇÃO', contTable.contentX + 18, y2 + 5);
            doc.text('ÁREA (ha)', contTable.contentX + 70, y2 + 5);
            doc.text('%', contTable.contentX + 95, y2 + 5);
            doc.text('VALOR (R$)', contTable.contentX + 115, y2 + 5);
            y2 += 8;
            doc.setFont('helvetica', 'normal');
          }

          doc.setFillColor(...(r % 2 === 0 ? [255, 255, 255] : COLORS.lightGray));
          doc.rect(tableCard2.contentX, y2, contentWidth - 20, 8, 'F');

          const classNum = key.replace('Classe ', '');
          const rgb = getClassColor(classNum);
          doc.setFillColor(...rgb);
          doc.rect(tableCard2.contentX + 1, y2 + 1, 3, 6, 'F');

          doc.setTextColor(...COLORS.text);
          doc.text(classNum, tableCard2.contentX + 6, y2 + 5);
          doc.text((info && info.descricao) || '-', tableCard2.contentX + 18, y2 + 5);
          const areaClasseFormatada2 = (info && (info.area_ha_formatado || info.area_ha != null))
            ? (info.area_ha_formatado || String(info.area_ha) + ' ha')
            : '-';
          const percentualFormatado2 = (info && (info.percentual_formatado || info.percentual != null))
            ? (info.percentual_formatado || String(info.percentual) + '%')
            : '-';
          const valorFormatado2 = (info && info.valor_calculado_formatado)
            ? String(info.valor_calculado_formatado)
            : '-';
          doc.text(String(areaClasseFormatada2), tableCard2.contentX + 70, y2 + 5);
          doc.text(String(percentualFormatado2), tableCard2.contentX + 95, y2 + 5);
          doc.text(valorFormatado2, tableCard2.contentX + 115, y2 + 5);

          y2 += 8; r++;
        }

        drawFooter(doc, i + 2, totalPoligonos + 1);
      }

      doc.save(`relatorio_consolidado_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  return API;
});
