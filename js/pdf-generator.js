/* eslint-disable no-undef */
/*
 * pdf-generator.js
 * InfoGEO - Gerador de Relatórios Corporativos
 * Inclui: Uso do Solo e Declividade (Simples e Consolidado)
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
    primary: [31, 39, 72],    // Azul escuro corporativo
    secondary: [46, 61, 113],  // Azul médio
    accent: [60, 213, 255],   // Ciano InfoGEO
    text: [40, 40, 40],       // Cinza muito escuro
    lightGray: [245, 245, 245],  // Fundo de cards
    border: [209, 209, 209]      // Bordas
  };

  /**
   * Normaliza texto para Latin-1 (suportado pela fonte helvetica do jsPDF).
   * Substitui caracteres Unicode especiais por equivalentes ASCII seguros.
   */
  const pdfSafe = (str) => {
    if (!str) return str;
    return str
      .replace(/\u2265/g, '>=')   // ≥ → >=
      .replace(/\u2264/g, '<=')   // ≤ → <=
      .replace(/\u2013/g, '-')    // – (en dash) → -
      .replace(/\u2014/g, '-')    // — (em dash) → -
      .replace(/[^\x00-\xFF]/g, '?');  // demais fora de Latin-1
  };

  // Conversão simples para RGB strings se necessário
  const hexToRgb = (hex) => {
    const v = hex.replace('#', '');
    const bigint = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };

  const PAGE = { width: 210, height: 297, margin: 15 };
  const margin = PAGE.margin;

  /** Carrega logo, redimensiona para max 220px e devolve dataURL PNG. */
  async function loadLogo(logoUrl, maxPx = 220) {
    return await new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const w = Math.max(1, Math.round(img.width  * ratio));
          const h = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error(`Erro ao carregar logo: ${logoUrl}`));
        img.src = logoUrl;
      } catch (e) { reject(e); }
    });
  }

  /**
   * Redimensiona imagem base64 para caber em maxMm_W × maxMm_H (em mm)
   * e converte para JPEG comprimido — principal fator de redução do PDF.
   * @param {string} base64 - dados da imagem sem prefixo "data:"
   * @param {number} maxMm_W - largura máxima no PDF (mm)
   * @param {number} maxMm_H - altura máxima no PDF (mm)
   * @param {number} quality - qualidade JPEG 0–1 (padrão 0.80)
   */
  function optimizeImageForPdf(base64, maxMm_W, maxMm_H, quality = 0.80) {
    const PX_PER_MM = 150 / 25.4; // 150 DPI → pixels por mm
    const maxPxW = Math.round(maxMm_W * PX_PER_MM);
    const maxPxH = Math.round(maxMm_H * PX_PER_MM);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxPxW / img.width, maxPxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width  * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // fundo branco (JPEG não suporta transparência)
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(`data:image/png;base64,${base64}`); // fallback
      img.src = `data:image/png;base64,${base64}`;
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

  /** Desenha header padrão corporativo. */
  async function drawHeader(doc, title, subtitle) {
    const headerHeight = 35;

    // Faixa superior corporativa
    doc.setFillColor(31, 39, 72);
    doc.rect(0, 0, PAGE.width, headerHeight, 'F');
    doc.setFillColor(60, 213, 255); // Detalhe ciano
    doc.rect(0, headerHeight - 1.5, PAGE.width, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title.toUpperCase(), PAGE.width / 2, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    if (subtitle) {
      doc.setFontSize(9);
      const lines = splitTextToFit(doc, subtitle, PAGE.width - 100, 9);
      lines.forEach((line, i) => doc.text(line, PAGE.width / 2, 19 + (i * 4.5), { align: 'center' }));
    }

    // Logo da Empresa (Esquerda)
    try {
      const logoEmpresa = await loadLogo('images/logo_cor.png');
      doc.addImage(logoEmpresa, 'PNG', 10, 5, 22, 22);
    } catch (e) { console.warn(e); }

    // Logo do App (Direita)
    try {
      const logoApp = await loadLogo('images/Logo_InfoGEO_.png');
      doc.addImage(logoApp, 'PNG', PAGE.width - 32, 5, 22, 19);
    } catch (e) { console.warn(e); }

    return headerHeight + 5;
  }

  /** Desenha footer padrão. */
  function drawFooter(doc, pageNumber, totalPages) {
    const footerY = PAGE.height - 12;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, footerY - 4, PAGE.width - margin, footerY - 4);

    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Relatório InfoGEO — Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY);

    const pagStr = totalPages ? `Página ${pageNumber} de ${totalPages}` : `Página ${pageNumber}`;
    doc.text(pagStr, PAGE.width / 2, footerY, { align: 'center' });

    doc.text('© InfoGEO Inteligência Geográfica', PAGE.width - margin, footerY, { align: 'right' });
  }

  /** Card container corporativo. */
  function drawCard(doc, x, y, width, height, title) {
    // Sombra sutil
    doc.setFillColor(245, 245, 245);
    doc.rect(x + 0.5, y + 0.5, width, height, 'F');

    // Fundo branco
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.rect(x, y, width, height, 'FD');

    // Cabeçalho do card
    doc.setFillColor(31, 39, 72);
    doc.rect(x, y, width, 7, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(title.toUpperCase(), x + 3, y + 4.8);

    return { contentX: x + 5, contentY: y + 12 };
  }

  /** Formata número com 2 casas. */
  const n2 = (v) => (typeof v === 'number' ? v : Number(v || 0)).toFixed(2);

  /** Obtém cor de classe. */
  function getClassColor(classNum, isDeclivity = false, isAptidao = false) {
    let colorHex = '#CCCCCC';
    if (isDeclivity) {
      if (typeof DecliviDADE !== 'undefined' && DecliviDADE.CORES_DECLIVIDADE) {
        colorHex = DecliviDADE.CORES_DECLIVIDADE[classNum] || '#CCCCCC';
      }
    } else if (isAptidao) {
      if (typeof Aptidao !== 'undefined' && Aptidao.CORES_APTIDAO) {
        colorHex = Aptidao.CORES_APTIDAO[classNum] || '#CCCCCC';
      }
    } else {
      colorHex = (typeof UTILS !== 'undefined' && UTILS.CLASSES_CORES && UTILS.CLASSES_CORES[classNum])
        ? UTILS.CLASSES_CORES[classNum]
        : '#CCCCCC';
    }
    return hexToRgb(colorHex);
  }

  function safe(obj, path, fallback = undefined) {
    try { return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ?? fallback; } catch { return fallback; }
  }

  /**
   * API pública
   */
  const API = {
    /**
     * Gera e salva relatório para um único polígono.
     */
    generate: async function (analysisResult, centroidCoords, fileName = '', propertyCode = null, declivityResult = null, aptidaoResult = null, embargoResult = null) {
      if (!analysisResult && !declivityResult && !aptidaoResult && !embargoResult) return;
      if (!jsPDFCtor) throw new Error('jsPDF não encontrado em window.jspdf');

      const doc = new jsPDFCtor();
      await this.drawPolygonAnalysisSection(doc, analysisResult, centroidCoords, fileName, propertyCode, declivityResult, aptidaoResult, embargoResult);

      const polygonName = (fileName || '').replace(/\.(kml|geojson|kmz|json)$/i, '');
      doc.save(`relatorio_infogeo_${polygonName || Date.now()}.pdf`);
    },

    /**
     * Desenha as páginas de análise de um polígono (Uso do Solo + Declividade + Aptidão).
     * Não adiciona nova página inicial, desenha na página atual.
     */
    drawPolygonAnalysisSection: async function (doc, analysisResult, centroidCoords, fileName = '', propertyCode = null, declivityResult = null, aptidaoResult = null, embargoResult = null) {
      const pageWidth = PAGE.width;
      const contentWidth = pageWidth - 2 * margin;
      let polygonName = (fileName || '').replace(/\.(kml|geojson|kmz|json)$/i, '');
      let baseMetadata = (analysisResult && analysisResult.metadados) || (declivityResult && declivityResult.metadados) || (aptidaoResult && aptidaoResult.metadados) || {};

      // --- PÁGINA: USO DO SOLO (Se houver) ---
      if (analysisResult && analysisResult.relatorio) {
        const headerH = await drawHeader(doc, 'Relatório de Análise — Uso do Solo', polygonName);
        let currentY = headerH;

        const relatorio = analysisResult.relatorio || {};

        // 1. INFORMAÇÕES GERAIS
        const infoCardHeight = propertyCode ? 48 : 38;
        const infoCard = drawCard(doc, margin, currentY, contentWidth, infoCardHeight, 'Dados do Imóvel e Análise');
        doc.setTextColor(...COLORS.text);
        doc.setFontSize(8.5);

        let yPos = infoCard.contentY;
        if (propertyCode) {
          doc.setFont('helvetica', 'bold');
          doc.text(`Código do Imóvel: ${propertyCode}`, infoCard.contentX, yPos);
          doc.setFont('helvetica', 'normal');
          yPos += 5.5;
        }

        doc.text(`Área Total Analisada: ${relatorio.area_total_poligono_ha_formatado || n2(relatorio.area_total_poligono_ha) + ' ha'}`, infoCard.contentX, yPos);
        doc.text(`Centroide (Lat/Lon): ${centroidCoords || 'N/D'}`, infoCard.contentX + 85, yPos);
        yPos += 5.5;

        const valorTotal = relatorio.valor_total_calculado_formatado || (relatorio.valor_total_calculado ? 'R$ ' + n2(relatorio.valor_total_calculado) : '-');
        doc.text(`Valor Total Estimado: ${valorTotal}`, infoCard.contentX, yPos);
        doc.text(`Localização: ${baseMetadata.municipio || 'N/D'} - ${baseMetadata.uf || ''}`, infoCard.contentX + 85, yPos);
        yPos += 5.5;

        const cdRta = baseMetadata.cd_rta || null;
        const nmRta = baseMetadata.nm_rta || null;
        const rtaLabel = cdRta && nmRta ? `${cdRta} – ${nmRta}` : (nmRta || 'Não identificado');
        doc.text(`Macrorregião RTA: ${rtaLabel}`, infoCard.contentX, yPos);

        currentY += infoCardHeight + 6;

        // 2. MAPA DE USO DO SOLO
        if (safe(analysisResult, 'imagem_recortada.base64')) {
          const mapHeight = 85;
          const mapCard = drawCard(doc, margin, currentY, contentWidth, mapHeight, 'Mapa Temático de Uso do Solo');
          const availW = contentWidth - 10;
          const availH = mapHeight - 14;
          const imgData = await optimizeImageForPdf(analysisResult.imagem_recortada.base64, availW, availH);
          const { width: imgW, height: imgH } = await getImageDimensions(imgData);

          const ratio = Math.min(availW / imgW, availH / imgH);
          const drawW = imgW * ratio;
          const drawH = imgH * ratio;

          doc.addImage(imgData, 'JPEG', mapCard.contentX + (availW - drawW) / 2, mapCard.contentY + (availH - drawH) / 2, drawW, drawH);
          currentY += mapHeight + 6;
        }

        // 3. TABELA DE CLASSES
        const tableHeight = 70;
        const tableCard = drawCard(doc, margin, currentY, contentWidth, tableHeight, 'Distribuição de Áreas por Classe de Uso');
        let ty = tableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(tableCard.contentX, ty, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('DESCRIÇÃO DA CLASSE', tableCard.contentX + 2, ty + 4.2);
        doc.text('ÁREA (ha)', tableCard.contentX + 90, ty + 4.2, { align: 'right' });
        doc.text('%', tableCard.contentX + 110, ty + 4.2, { align: 'right' });
        doc.text('VALOR ESTIMADO (R$)', tableCard.contentX + 150, ty + 4.2, { align: 'right' });
        ty += 9;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const classes = Object.entries(relatorio.classes || {}).sort((a, b) => b[1].area_ha - a[1].area_ha);

        for (const [key, info] of classes) {
          if (ty > PAGE.height - 30) {
            drawFooter(doc, doc.internal.getNumberOfPages());
            doc.addPage();
            const tH = await drawHeader(doc, 'USO DO SOLO (CONTINUAÇÃO)', polygonName); ty = tH + 10;
          }

          const classNum = key.replace('Classe ', '');
          const rgb = getClassColor(classNum);
          doc.setFillColor(...rgb);
          doc.rect(tableCard.contentX + 1, ty - 3.2, 3, 3.5, 'F');

          doc.text(pdfSafe(info.descricao || '-'), tableCard.contentX + 6, ty);
          doc.text(info.area_ha_formatado || n2(info.area_ha), tableCard.contentX + 90, ty, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', tableCard.contentX + 110, ty, { align: 'right' });
          doc.text(info.valor_calculado_formatado || (info.valor_calculado ? n2(info.valor_calculado) : '-'), tableCard.contentX + 150, ty, { align: 'right' });
          ty += 5;
        }

        drawFooter(doc, doc.internal.getNumberOfPages());
      }

      // --- PÁGINA: DECLIVIDADE (Se houver) ---
      if (declivityResult && declivityResult.relatorio) {
        doc.addPage();
        const headerD = await drawHeader(doc, 'Relatório de Análise — Relevo e Declividade', polygonName);
        let dy = headerD;

        const relD = declivityResult.relatorio;

        // 1. Resumo Declividade
        const dInfoCard = drawCard(doc, margin, dy, contentWidth, 22, 'Resumo Topográfico');
        doc.setFontSize(8.5);
        doc.text(`Área Analisada: ${relD.area_total_poligono_ha_formatado || n2(relD.area_total_poligono_ha) + ' ha'}`, dInfoCard.contentX, dInfoCard.contentY + 2);
        doc.text(`Classes Identificadas: ${relD.numero_classes_encontradas}`, dInfoCard.contentX + 85, dInfoCard.contentY + 2);
        dy += 28;

        // 2. Mapa Declividade
        if (safe(declivityResult, 'imagem_recortada.base64')) {
          const mapH = 90;
          const mapCardD = drawCard(doc, margin, dy, contentWidth, mapH, 'Mapa Temático de Declividade (%)');
          const imgD = await optimizeImageForPdf(declivityResult.imagem_recortada.base64, contentWidth - 10, mapH - 14);
          const { width: iW, height: iH } = await getImageDimensions(imgD);
          const r = Math.min((contentWidth - 10) / iW, (mapH - 14) / iH);
          doc.addImage(imgD, 'JPEG', mapCardD.contentX + (contentWidth - 10 - iW * r) / 2, mapCardD.contentY + (mapH - 14 - iH * r) / 2, iW * r, iH * r);
          dy += mapH + 6;
        }

        // 3. Tabela Declividade
        const dTableCard = drawCard(doc, margin, dy, contentWidth, 75, 'Distribuição de Áreas por Classe de Relevo');
        let dyt = dTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(dTableCard.contentX, dyt, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE DE DECLIVIDADE (INTERVALO)', dTableCard.contentX + 2, dyt + 4.2);
        doc.text('ÁREA (ha)', dTableCard.contentX + 110, dyt + 4.2, { align: 'right' });
        doc.text('%', dTableCard.contentX + 140, dyt + 4.2, { align: 'right' });
        dyt += 9;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const dClasses = Object.entries(relD.classes || {}).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));

        for (const [key, info] of dClasses) {
          const cNum = key.replace('Classe ', '');
          const rgb = getClassColor(cNum, true);
          doc.setFillColor(...rgb);
          doc.rect(dTableCard.contentX + 1, dyt - 3.2, 3, 3.5, 'F');

          doc.text(pdfSafe(info.descricao || '-'), dTableCard.contentX + 6, dyt);
          doc.text(info.area_ha_formatado || n2(info.area_ha), dTableCard.contentX + 110, dyt, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', dTableCard.contentX + 140, dyt, { align: 'right' });
          dyt += 5;
        }

        drawFooter(doc, doc.internal.getNumberOfPages());
      }

      // --- PÁGINA: APTIDÃO (Se houver) ---
      if (aptidaoResult && aptidaoResult.relatorio) {
        doc.addPage();
        const headerA = await drawHeader(doc, 'Relatório de Análise — Aptidão Agronômica', polygonName);
        let ay = headerA;

        const relA = aptidaoResult.relatorio;

        // 1. Resumo Aptidao
        const aInfoCard = drawCard(doc, margin, ay, contentWidth, 22, 'Resumo Aptidão');
        doc.setFontSize(8.5);
        doc.text(`Área Analisada: ${relA.area_total_poligono_ha_formatado || n2(relA.area_total_poligono_ha) + ' ha'}`, aInfoCard.contentX, aInfoCard.contentY + 2);
        doc.text(`Classes Identificadas: ${relA.numero_classes_encontradas}`, aInfoCard.contentX + 85, aInfoCard.contentY + 2);
        ay += 28;

        // 2. Mapa Aptidao
        if (safe(aptidaoResult, 'imagem_recortada.base64')) {
          const mapH = 90;
          const mapCardA = drawCard(doc, margin, ay, contentWidth, mapH, 'Mapa Temático de Aptidão Agronômica');
          const imgA = await optimizeImageForPdf(aptidaoResult.imagem_recortada.base64, contentWidth - 10, mapH - 14);
          const { width: iW, height: iH } = await getImageDimensions(imgA);
          const r = Math.min((contentWidth - 10) / iW, (mapH - 14) / iH);
          doc.addImage(imgA, 'JPEG', mapCardA.contentX + (contentWidth - 10 - iW * r) / 2, mapCardA.contentY + (mapH - 14 - iH * r) / 2, iW * r, iH * r);
          ay += mapH + 6;
        }

        // 3. Tabela Aptidao
        const aTableCard = drawCard(doc, margin, ay, contentWidth, 95, 'Distribuição de Áreas por Classe de Aptidão');
        let ayt = aTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(aTableCard.contentX, ayt, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE / CRITÉRIO', aTableCard.contentX + 2, ayt + 4.2);
        doc.text('ÁREA (ha)', aTableCard.contentX + 110, ayt + 4.2, { align: 'right' });
        doc.text('%', aTableCard.contentX + 140, ayt + 4.2, { align: 'right' });
        ayt += 9;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const aClasses = Object.entries(relA.classes || {}).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));

        for (const [key, info] of aClasses) {
          const cNum = key.replace('Classe ', '');
          const rgb = getClassColor(cNum, false, true);
          doc.setFillColor(...rgb);
          doc.rect(aTableCard.contentX + 1, ayt - 3.2, 3, 7, 'F');

          // Linha 1: nome da classe com faixa de declividade
          doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.text);
          doc.text(pdfSafe(info.descricao || '-'), aTableCard.contentX + 6, ayt);
          doc.text(info.area_ha_formatado || n2(info.area_ha), aTableCard.contentX + 110, ayt, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', aTableCard.contentX + 140, ayt, { align: 'right' });

          // Linha 2: descrição completa em fonte menor
          if (info.descricao_completa) {
            doc.setFontSize(6.2); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 110, 130);
            doc.text(pdfSafe(info.descricao_completa), aTableCard.contentX + 6, ayt + 3.8, { maxWidth: 100 });
          }

          doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text); doc.setFontSize(7.5);
          ayt += 9;
        }

        drawFooter(doc, doc.internal.getNumberOfPages());
      }

      // ── PÁGINA DE EMBARGO IBAMA ──────────────────────────────────────────────
      if (embargoResult && embargoResult.relatorio) {
        doc.addPage();
        const relE = embargoResult.relatorio;
        const possuiEmb = relE.possui_embargo;
        const headerE = await drawHeader(doc, 'Relatório de Análise — Embargo IBAMA', polygonName);
        let ey = headerE;

        // 1. Card de resumo
        const eInfoCard = drawCard(doc, margin, ey, contentWidth, 30, 'Situação de Embargo IBAMA');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text);
        const corEmb = possuiEmb ? [222, 0, 4] : [2, 139, 0];
        const txtEmb = possuiEmb ? 'EMBARGO IDENTIFICADO' : 'SEM EMBARGO IBAMA';
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...corEmb);
        doc.text(txtEmb, eInfoCard.contentX + (contentWidth - 10) / 2, eInfoCard.contentY + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text); doc.setFontSize(8);
        doc.text(`Area Total: ${relE.area_total_poligono_ha_formatado || '-'}`, eInfoCard.contentX + 2, eInfoCard.contentY + 12);
        doc.text(`Area Embargada: ${relE.area_embargada_ha_formatado || '0,0000 ha'} (${relE.area_embargada_percentual_formatado || '0,00%'})`, eInfoCard.contentX + 65, eInfoCard.contentY + 12);
        doc.text(`No. de Embargos: ${relE.numero_embargoes || 0}`, eInfoCard.contentX + 2, eInfoCard.contentY + 19);
        ey += 36;

        // 2. Tabela de embargos individuais
        const embargoes = embargoResult.embargoes || [];
        if (embargoes.length > 0) {
          const LINE_H  = 4.0;  // altura por linha a fontSize 7
          const ROW_PAD = 2;    // padding vertical interno
          const HDR_H   = 8;    // altura do cabeçalho da tabela
          const PAGE_BOTTOM = PAGE.height - 22; // margem acima do footer

          // Trunca e sanitiza texto para colunas longas
          const trunc = (s, max) => {
            const t = pdfSafe((s || '-').trim());
            return t.length > max ? t.substring(0, max) + '...' : t;
          };

          // Pré-calcular conteúdo e altura real de cada linha
          doc.setFontSize(7);
          const rowData = embargoes.map(emb => {
            const lNum    = doc.splitTextToSize(pdfSafe(emb.num_tad || '-'), 27);
            const lInfrac = doc.splitTextToSize(trunc(emb.des_infrac, 55), 46);
            const lTad    = doc.splitTextToSize(trunc(emb.des_tad, 120), 40);
            const nLines  = Math.max(lNum.length, lInfrac.length, lTad.length, 1);
            return {
              lNum, lInfrac, lTad,
              dataTxt: pdfSafe(emb.dat_embarg || '-'),
              areaTxt: pdfSafe(emb.area_sobreposta_ha_formatado || '-'),
              rowH: nLines * LINE_H + ROW_PAD * 2,
            };
          });

          // Desenha header de colunas dentro do card
          const drawTblHdr = (cx, y) => {
            doc.setFillColor(240, 240, 240);
            doc.rect(cx, y, contentWidth - 10, 6, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(31, 39, 72);
            doc.text('No. TAD',         cx + 6,                    y + 4.2);
            doc.text('DATA',            cx + 35,                   y + 4.2);
            doc.text('INFRACAO',        cx + 60,                   y + 4.2);
            doc.text('DESC. TAD',       cx + 108,                  y + 4.2);
            doc.text('AREA SOBR. (ha)', cx + contentWidth - 12,    y + 4.2, { align: 'right' });
            return y + HDR_H;
          };

          // Distribuir linhas em chunks com quebra de página
          let remaining = [...rowData];
          let firstChunk = true;

          while (remaining.length > 0) {
            if (!firstChunk) {
              drawFooter(doc, doc.internal.getNumberOfPages());
              doc.addPage();
              ey = await drawHeader(doc, 'Relatório de Análise — Embargo IBAMA', polygonName);
            }

            // Calcular quantas linhas cabem no espaço restante da página
            const availH = PAGE_BOTTOM - ey - 16; // 16 = card-title(7) + pad(9)
            let usedH = HDR_H;
            const chunk = [];
            for (const row of remaining) {
              if (usedH + row.rowH > availH) break;
              chunk.push(row);
              usedH += row.rowH;
            }
            // Garante pelo menos 1 linha para evitar loop infinito
            if (chunk.length === 0) {
              chunk.push(remaining[0]);
              usedH = HDR_H + remaining[0].rowH;
            }
            remaining = remaining.slice(chunk.length);

            const tableH = usedH + 4;
            const label  = firstChunk ? 'Embargos Sobrepostos' : 'Embargos Sobrepostos (cont.)';
            const tCard  = drawCard(doc, margin, ey, contentWidth, tableH, label);
            const cx     = tCard.contentX;
            let eyt = drawTblHdr(cx, tCard.contentY);

            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.text);
            for (const row of chunk) {
              const ty = eyt + ROW_PAD + LINE_H - 0.5;
              doc.setFillColor(2, 139, 0);
              doc.rect(cx + 1, eyt + ROW_PAD - 0.5, 3, 3.5, 'F');
              doc.text(row.lNum,    cx + 6,                 ty);
              doc.text(row.dataTxt, cx + 35,                ty);
              doc.text(row.lInfrac, cx + 60,                ty);
              doc.text(row.lTad,    cx + 108,               ty);
              doc.text(row.areaTxt, cx + contentWidth - 12, ty, { align: 'right' });
              eyt += row.rowH;
            }

            ey += tableH + 6;
            firstChunk = false;
          }
        }

        drawFooter(doc, doc.internal.getNumberOfPages());
      }
    },

    /**
     * Relatório consolidado (múltiplos polígonos)
     */
    generateConsolidatedReport: async function (analysisResults, declivityResults = null, aptidaoResults = null, embargoResults = null) {
      if ((!analysisResults || analysisResults.length === 0) &&
        (!declivityResults || declivityResults.length === 0) &&
        (!aptidaoResults || aptidaoResults.length === 0) &&
        (!embargoResults || embargoResults.length === 0)) return;

      if (!jsPDFCtor) throw new Error('jsPDF não encontrado em window.jspdf');

      const doc = new jsPDFCtor();
      const pageWidth = PAGE.width;
      const contentWidth = pageWidth - 2 * margin;

      await drawHeader(doc, 'Relatório Consolidado de Áreas', 'Visão Geral do Empreendimento');
      let yOffset = 45;

      // Calcular o total de polígonos baseando-se no módulo que tiver mais
      const totalPolygons = Math.max(
        analysisResults ? analysisResults.length : 0,
        declivityResults ? declivityResults.length : 0,
        aptidaoResults ? aptidaoResults.length : 0,
        embargoResults ? embargoResults.length : 0
      );

      // 1. Agregação Uso do Solo
      if (analysisResults && analysisResults.length > 0) {
        let areaTotalConsolidada = 0;
        let valorTotalConsolidado = 0;
        const classesConsolidadas = {};

        analysisResults.forEach((res) => {
          const rel = res.relatorio || {};
          areaTotalConsolidada += Number(rel.area_total_poligono_ha || 0);
          valorTotalConsolidado += Number(rel.valor_total_calculado || 0);
          Object.entries(rel.classes || {}).forEach(([key, info]) => {
            if (!classesConsolidadas[key]) {
              classesConsolidadas[key] = { descricao: info.descricao, area_ha: 0, valor: 0 };
            }
            classesConsolidadas[key].area_ha += Number(info.area_ha || 0);
            classesConsolidadas[key].valor += Number(info.valor_calculado || 0);
          });
        });

        // Card: Resumo Executivo
        const infoCard = drawCard(doc, margin, yOffset, contentWidth, 25, 'Resumo Executivo do Empreendimento');
        doc.setFontSize(9);
        doc.text(`Área Total Consolidada: ${n2(areaTotalConsolidada)} ha`, infoCard.contentX, infoCard.contentY + 2);
        doc.text(`Valor de Avaliação Consolidado: R$ ${n2(valorTotalConsolidado)}`, infoCard.contentX, infoCard.contentY + 8);
        doc.text(`Total de Polígonos Analisados: ${totalPolygons}`, infoCard.contentX + 100, infoCard.contentY + 2);

        yOffset += 32;

        // Tabela Consolidada Uso Solo
        const tableHeight = 80;
        const tableCard = drawCard(doc, margin, yOffset, contentWidth, tableHeight, 'Consolidado: Uso do Solo');
        let y = tableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(tableCard.contentX, y, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('DESCRIÇÃO DA CLASSE', tableCard.contentX + 2, y + 4.2);
        doc.text('ÁREA TOTAL (ha)', tableCard.contentX + 100, y + 4.2, { align: 'right' });
        doc.text('%', tableCard.contentX + 120, y + 4.2, { align: 'right' });
        doc.text('VALOR TOTAL (R$)', tableCard.contentX + 160, y + 4.2, { align: 'right' });
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const sorted = Object.entries(classesConsolidadas).sort((a, b) => b[1].area_ha - a[1].area_ha);
        for (const [key, info] of sorted) {
          if (y > PAGE.height - 30) break;
          const classNum = key.replace('Classe ', '');
          doc.setFillColor(...getClassColor(classNum));
          doc.rect(tableCard.contentX + 1, y - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), tableCard.contentX + 6, y);
          doc.text(n2(info.area_ha), tableCard.contentX + 100, y, { align: 'right' });
          doc.text(n2((info.area_ha / areaTotalConsolidada) * 100) + '%', tableCard.contentX + 120, y, { align: 'right' });
          doc.text(n2(info.valor), tableCard.contentX + 160, y, { align: 'right' });
          y += 5.5;
        }

        yOffset += tableHeight + 8;
      } else {
        // Se não tem uso do solo, apenas mostre o resumo básico
        const infoCard = drawCard(doc, margin, yOffset, contentWidth, 15, 'Resumo Executivo do Empreendimento');
        doc.setFontSize(9);
        doc.text(`Total de Polígonos Analisados: ${totalPolygons}`, infoCard.contentX, infoCard.contentY + 2);
        yOffset += 22;
      }

      // 2. Agregação Declividade (Se houver)
      if (declivityResults && declivityResults.length > 0) {
        const dClassesCons = {};
        let dAreaTotal = 0;

        declivityResults.forEach(res => {
          if (!res || !res.relatorio) return;
          dAreaTotal += Number(res.relatorio.area_total_poligono_ha || 0);
          Object.entries(res.relatorio.classes || {}).forEach(([key, info]) => {
            if (!dClassesCons[key]) dClassesCons[key] = { descricao: info.descricao, area_ha: 0 };
            dClassesCons[key].area_ha += Number(info.area_ha || 0);
          });
        });

        const dTableH = 70;
        const dTableCard = drawCard(doc, margin, yOffset, contentWidth, dTableH, 'Consolidado: Relevo e Declividade');
        let dy = dTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(dTableCard.contentX, dy, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE DE DECLIVIDADE', dTableCard.contentX + 2, dy + 4.2);
        doc.text('ÁREA TOTAL (ha)', dTableCard.contentX + 110, dy + 4.2, { align: 'right' });
        doc.text('%', dTableCard.contentX + 140, dy + 4.2, { align: 'right' });
        dy += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const dSorted = Object.entries(dClassesCons).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));

        for (const [key, info] of dSorted) {
          if (dy > PAGE.height - 20) break;
          const cNum = key.replace('Classe ', '');
          doc.setFillColor(...getClassColor(cNum, true));
          doc.rect(dTableCard.contentX + 1, dy - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), dTableCard.contentX + 6, dy);
          doc.text(n2(info.area_ha), dTableCard.contentX + 110, dy, { align: 'right' });
          if (dAreaTotal > 0) {
            doc.text(n2((info.area_ha / dAreaTotal) * 100) + '%', dTableCard.contentX + 140, dy, { align: 'right' });
          } else {
            doc.text('0.00%', dTableCard.contentX + 140, dy, { align: 'right' });
          }
          dy += 5.5;
        }
      }

      // 3. Agregação Aptidão (Se houver)
      if (aptidaoResults && aptidaoResults.length > 0) {
        const aClassesCons = {};
        let aAreaTotal = 0;

        aptidaoResults.forEach(res => {
          if (!res || !res.relatorio) return;
          aAreaTotal += Number(res.relatorio.area_total_poligono_ha || 0);
          Object.entries(res.relatorio.classes || {}).forEach(([key, info]) => {
            if (!aClassesCons[key]) aClassesCons[key] = { descricao: info.descricao, area_ha: 0 };
            aClassesCons[key].area_ha += Number(info.area_ha || 0);
          });
        });

        // Adiciona nova página para Consolidado de Aptidão
        doc.addPage();
        await drawHeader(doc, 'Relatório Consolidado', 'Aptidão Agronômica');
        let aYOffset = 45;

        const aTableH = 70;
        const aTableCard = drawCard(doc, margin, aYOffset, contentWidth, aTableH, 'Consolidado: Aptidão Agronômica');
        let ay = aTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(aTableCard.contentX, ay, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE DE APTIDÃO', aTableCard.contentX + 2, ay + 4.2);
        doc.text('ÁREA TOTAL (ha)', aTableCard.contentX + 110, ay + 4.2, { align: 'right' });
        doc.text('%', aTableCard.contentX + 140, ay + 4.2, { align: 'right' });
        ay += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const aSorted = Object.entries(aClassesCons).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));

        for (const [key, info] of aSorted) {
          if (ay > PAGE.height - 20) break;
          const cNum = key.replace('Classe ', '');
          doc.setFillColor(...getClassColor(cNum, false, true));
          doc.rect(aTableCard.contentX + 1, ay - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), aTableCard.contentX + 6, ay);
          doc.text(n2(info.area_ha), aTableCard.contentX + 110, ay, { align: 'right' });
          if (aAreaTotal > 0) {
            doc.text(n2((info.area_ha / aAreaTotal) * 100) + '%', aTableCard.contentX + 140, ay, { align: 'right' });
          } else {
            doc.text('0.00%', aTableCard.contentX + 140, ay, { align: 'right' });
          }
          ay += 5.5;
        }
      }

      drawFooter(doc, 1); // Rodapé da última página de resumo consolidado

      // --- PÁGINAS INDIVIDUAIS (NOVIDADE) ---
      // Como os resultados podem vir de módulos diferentes (e alguns podem não ter Uso do Solo),
      // precisamos obter uma lista única de "polígonos" processados.
      const uniqueIndices = new Set();
      const allModules = [analysisResults || [], declivityResults || [], aptidaoResults || [], embargoResults || []];

      allModules.forEach(moduleResults => {
        moduleResults.forEach(res => {
          if (res.fileIndex !== undefined) uniqueIndices.add(res.fileIndex);
        });
      });

      const indicesArray = Array.from(uniqueIndices).sort((a, b) => a - b);

      for (let i = 0; i < indicesArray.length; i++) {
        const fileIdx = indicesArray[i];

        // Buscar o resultado de cada módulo para este índice
        const sResult = (analysisResults || []).find(r => r.fileIndex === fileIdx) || null;
        const dResult = (declivityResults || []).find(dr => dr.fileIndex === fileIdx) || null;
        const aResult = (aptidaoResults || []).find(ar => ar.fileIndex === fileIdx) || null;
        const eResult = (embargoResults || []).find(er => er.fileIndex === fileIdx) || null;

        const baseResult = sResult || dResult || aResult || eResult;
        if (!baseResult) continue;

        // Recuperar metadados úteis para o cabeçalho/dados do imóvel
        const centroidText = baseResult.metadados?.centroide_display || baseResult.centroidText || '';
        const propertyCode = baseResult.propertyCode || baseResult.metadados?.codigo_imovel || null;

        doc.addPage();
        await this.drawPolygonAnalysisSection(doc, sResult, centroidText, baseResult.fileName, propertyCode, dResult, aResult, eResult);
      }

      // Atualizar número total de páginas em todos os rodapés (opcional, mas jspdf não faz auto)
      // Por simplicidade, deixamos o rodapé com o número da página atual.

      doc.save(`relatorio_consolidado_infogeo_${Date.now()}.pdf`);
    }
  };

  return API;
});
