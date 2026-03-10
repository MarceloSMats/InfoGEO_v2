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
          const w = Math.max(1, Math.round(img.width * ratio));
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
   * @param {number} quality - qualidade JPEG 0–1 (padrão 0.92)
   */
  function optimizeImageForPdf(base64, maxMm_W, maxMm_H, quality = 0.92) {
    const PX_PER_MM = 300 / 25.4; // 300 DPI → pixels por mm
    const maxPxW = Math.round(maxMm_W * PX_PER_MM);
    const maxPxH = Math.round(maxMm_H * PX_PER_MM);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxPxW / img.width, maxPxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
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
    generate: async function (analysisResult, centroidCoords, fileName = '', propertyCode = null, declivityResult = null, aptidaoResult = null, embargoResult = null, icmbioResult = null, soloTexturalResult = null) {
      if (!analysisResult && !declivityResult && !aptidaoResult && !embargoResult && !icmbioResult && !soloTexturalResult) return;
      if (!jsPDFCtor) throw new Error('jsPDF não encontrado em window.jspdf');

      const doc = new jsPDFCtor();
      await this.drawPolygonAnalysisSection(doc, analysisResult, centroidCoords, fileName, propertyCode, declivityResult, aptidaoResult, embargoResult, icmbioResult, soloTexturalResult);

      const polygonName = (fileName || '').replace(/\.(kml|geojson|kmz|json)$/i, '');
      doc.save(`relatorio_infogeo_${polygonName || Date.now()}.pdf`);
    },

    /**
     * Desenha as páginas de análise de um polígono (Uso do Solo + Declividade + Aptidão).
     * Não adiciona nova página inicial, desenha na página atual.
     */
    drawPolygonAnalysisSection: async function (doc, analysisResult, centroidCoords, fileName = '', propertyCode = null, declivityResult = null, aptidaoResult = null, embargoResult = null, icmbioResult = null, soloTexturalResult = null) {
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
        const infoCardHeight = propertyCode ? 55 : 45;
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

        const hasValoracao = !!(relatorio.valor_total_calculado && Number(relatorio.valor_total_calculado) > 0);
        if (hasValoracao) {
          const valorTotal = relatorio.valor_total_calculado_formatado || (relatorio.valor_total_calculado ? 'R$ ' + n2(relatorio.valor_total_calculado) : '-');
          doc.text(`Valor Total Estimado: ${valorTotal}`, infoCard.contentX, yPos);
        }
        doc.text(`Localização: ${baseMetadata.municipio || 'N/D'} - ${baseMetadata.uf || ''}`, infoCard.contentX + 85, yPos);
        yPos += 5.5;

        const cdRta = baseMetadata.cd_rta || null;
        const nmRta = baseMetadata.nm_rta || null;
        const rtaLabel = cdRta && nmRta ? `${cdRta} – ${nmRta}` : (nmRta || 'Não identificado');
        doc.text(`Macrorregião RTA: ${rtaLabel}`, infoCard.contentX, yPos);
        yPos += 5.5;

        // Classe predominante
        const usoClasses = Object.values(relatorio.classes || {});
        if (usoClasses.length > 0) {
          const predom = usoClasses.reduce((a, b) => a.area_ha >= b.area_ha ? a : b);
          const pctTxt = predom.percentual_formatado || n2(predom.percentual) + '%';
          const areaTxt = predom.area_ha_formatado || n2(predom.area_ha) + ' ha';
          doc.setFont('helvetica', 'bold');
          doc.text(pdfSafe(`Classe Predominante: ${predom.descricao} (${pctTxt} - ${areaTxt})`), infoCard.contentX, yPos);
          doc.setFont('helvetica', 'normal');
        }

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
        const classes = Object.entries(relatorio.classes || {}).sort((a, b) => b[1].area_ha - a[1].area_ha);
        const tableHeight = 12 + classes.length * 5 + 12;
        const tableCard = drawCard(doc, margin, currentY, contentWidth, tableHeight, 'Distribuição de Áreas por Classe de Uso');
        let ty = tableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(tableCard.contentX, ty, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        const colArea = hasValoracao ? 100 : 135;
        const colPct = hasValoracao ? 128 : 168;
        const colVal = 168;
        doc.text('DESCRIÇÃO DA CLASSE', tableCard.contentX + 2, ty + 4.2);
        doc.text('ÁREA (ha)', tableCard.contentX + colArea, ty + 4.2, { align: 'right' });
        doc.text('%', tableCard.contentX + colPct, ty + 4.2, { align: 'right' });
        if (hasValoracao) doc.text('VALOR ESTIMADO (R$)', tableCard.contentX + colVal, ty + 4.2, { align: 'right' });
        ty += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);

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
          doc.text(info.area_ha_formatado || n2(info.area_ha), tableCard.contentX + colArea, ty, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', tableCard.contentX + colPct, ty, { align: 'right' });
          if (hasValoracao) doc.text(info.valor_calculado_formatado || (info.valor_calculado ? n2(info.valor_calculado) : '-'), tableCard.contentX + colVal, ty, { align: 'right' });
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
        const dInfoCard = drawCard(doc, margin, dy, contentWidth, 29, 'Resumo Topográfico');
        doc.setFontSize(8.5); doc.setTextColor(...COLORS.text);
        doc.text(`Área Analisada: ${relD.area_total_poligono_ha_formatado || n2(relD.area_total_poligono_ha) + ' ha'}`, dInfoCard.contentX, dInfoCard.contentY + 2);
        doc.text(`Classes Identificadas: ${relD.numero_classes_encontradas}`, dInfoCard.contentX + 85, dInfoCard.contentY + 2);
        // Classe predominante
        const dClsVals = Object.values(relD.classes || {});
        if (dClsVals.length > 0) {
          const dPredom = dClsVals.reduce((a, b) => a.area_ha >= b.area_ha ? a : b);
          const dPct = dPredom.percentual_formatado || n2(dPredom.percentual) + '%';
          const dArea = dPredom.area_ha_formatado || n2(dPredom.area_ha) + ' ha';
          doc.setFont('helvetica', 'bold');
          doc.text(pdfSafe(`Classe Predominante: ${dPredom.descricao} (${dPct} - ${dArea})`), dInfoCard.contentX, dInfoCard.contentY + 8);
          doc.setFont('helvetica', 'normal');
        }
        dy += 35;

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
        const dClasses = Object.entries(relD.classes || {}).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));
        const dTableH = 12 + dClasses.length * 5 + 12;
        const dTableCard = drawCard(doc, margin, dy, contentWidth, dTableH, 'Distribuição de Áreas por Classe de Relevo');
        let dyt = dTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(dTableCard.contentX, dyt, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE DE DECLIVIDADE (INTERVALO)', dTableCard.contentX + 2, dyt + 4.2);
        doc.text('ÁREA (ha)', dTableCard.contentX + 135, dyt + 4.2, { align: 'right' });
        doc.text('%', dTableCard.contentX + 168, dyt + 4.2, { align: 'right' });
        dyt += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);

        for (const [key, info] of dClasses) {
          const cNum = key.replace('Classe ', '');
          const rgb = getClassColor(cNum, true);
          doc.setFillColor(...rgb);
          doc.rect(dTableCard.contentX + 1, dyt - 3.2, 3, 3.5, 'F');

          doc.text(pdfSafe(info.descricao || '-'), dTableCard.contentX + 6, dyt);
          doc.text(info.area_ha_formatado || n2(info.area_ha), dTableCard.contentX + 135, dyt, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', dTableCard.contentX + 168, dyt, { align: 'right' });
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
        const aInfoCard = drawCard(doc, margin, ay, contentWidth, 29, 'Resumo Aptidão');
        doc.setFontSize(8.5); doc.setTextColor(...COLORS.text);
        doc.text(`Área Analisada: ${relA.area_total_poligono_ha_formatado || n2(relA.area_total_poligono_ha) + ' ha'}`, aInfoCard.contentX, aInfoCard.contentY + 2);
        doc.text(`Classes Identificadas: ${relA.numero_classes_encontradas}`, aInfoCard.contentX + 85, aInfoCard.contentY + 2);
        // Classe predominante
        const aClsVals = Object.values(relA.classes || {});
        if (aClsVals.length > 0) {
          const aPredom = aClsVals.reduce((a, b) => a.area_ha >= b.area_ha ? a : b);
          const aPct = aPredom.percentual_formatado || n2(aPredom.percentual) + '%';
          const aArea = aPredom.area_ha_formatado || n2(aPredom.area_ha) + ' ha';
          doc.setFont('helvetica', 'bold');
          doc.text(pdfSafe(`Classe Predominante: ${aPredom.descricao} (${aPct} - ${aArea})`), aInfoCard.contentX, aInfoCard.contentY + 8);
          doc.setFont('helvetica', 'normal');
        }
        ay += 35;

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
        const aClasses = Object.entries(relA.classes || {}).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));
        const aTableH = 12 + aClasses.length * 9 + 12;
        const aTableCard = drawCard(doc, margin, ay, contentWidth, aTableH, 'Distribuição de Áreas por Classe de Aptidão');
        let ayt = aTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(aTableCard.contentX, ayt, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE / CRITÉRIO', aTableCard.contentX + 2, ayt + 4.2);
        doc.text('ÁREA (ha)', aTableCard.contentX + 135, ayt + 4.2, { align: 'right' });
        doc.text('%', aTableCard.contentX + 168, ayt + 4.2, { align: 'right' });
        ayt += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);

        for (const [key, info] of aClasses) {
          const cNum = key.replace('Classe ', '');
          const rgb = getClassColor(cNum, false, true);
          doc.setFillColor(...rgb);
          doc.rect(aTableCard.contentX + 1, ayt - 3.2, 3, 7, 'F');

          // Linha 1: nome da classe com faixa de declividade
          doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.text);
          doc.text(pdfSafe(info.descricao || '-'), aTableCard.contentX + 6, ayt);
          doc.text(info.area_ha_formatado || n2(info.area_ha), aTableCard.contentX + 135, ayt, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', aTableCard.contentX + 168, ayt, { align: 'right' });

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

      // --- PÁGINA: TEXTURA DO SOLO (Se houver) ---
      if (soloTexturalResult && soloTexturalResult.relatorio) {
        doc.addPage();
        const headerS = await drawHeader(doc, 'Relatório de Análise — Textura do Solo', polygonName);
        let sy = headerS;

        const relS = soloTexturalResult.relatorio;

        // 1. Resumo
        const sInfoCard = drawCard(doc, margin, sy, contentWidth, 29, 'Resumo Textura do Solo');
        doc.setFontSize(8.5); doc.setTextColor(...COLORS.text);
        doc.text(`Área Analisada: ${relS.area_total_poligono_ha_formatado || n2(relS.area_total_poligono_ha) + ' ha'}`, sInfoCard.contentX, sInfoCard.contentY + 2);
        doc.text(`Classes Identificadas: ${relS.numero_classes_encontradas}`, sInfoCard.contentX + 85, sInfoCard.contentY + 2);
        // Classe predominante
        const sClsVals = Object.values(relS.classes || {});
        if (sClsVals.length > 0) {
          const sPredom = sClsVals.reduce((a, b) => a.area_ha >= b.area_ha ? a : b);
          const sPct = sPredom.percentual_formatado || n2(sPredom.percentual) + '%';
          const sArea = sPredom.area_ha_formatado || n2(sPredom.area_ha) + ' ha';
          doc.setFont('helvetica', 'bold');
          doc.text(pdfSafe(`Classe Predominante: ${sPredom.descricao} (${sPct} - ${sArea})`), sInfoCard.contentX, sInfoCard.contentY + 8);
          doc.setFont('helvetica', 'normal');
        }
        sy += 35;

        // 2. Mapa
        if (safe(soloTexturalResult, 'imagem_recortada.base64')) {
          const mapH = 90;
          const mapCardS = drawCard(doc, margin, sy, contentWidth, mapH, 'Mapa Temático de Textura do Solo');
          const imgS = await optimizeImageForPdf(soloTexturalResult.imagem_recortada.base64, contentWidth - 10, mapH - 14);
          const { width: iW, height: iH } = await getImageDimensions(imgS);
          const r = Math.min((contentWidth - 10) / iW, (mapH - 14) / iH);
          doc.addImage(imgS, 'JPEG', mapCardS.contentX + (contentWidth - 10 - iW * r) / 2, mapCardS.contentY + (mapH - 14 - iH * r) / 2, iW * r, iH * r);
          sy += mapH + 6;
        }

        // 3. Tabela de classes
        const sClasses = Object.entries(relS.classes || {}).sort((a, b) => b[1].area_ha - a[1].area_ha);
        const sTableH = 12 + sClasses.length * 5 + 12;
        const sTableCard = drawCard(doc, margin, sy, contentWidth, sTableH, 'Distribuição de Áreas por Classe Textural');
        let syt = sTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(sTableCard.contentX, syt, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE TEXTURAL', sTableCard.contentX + 2, syt + 4.2);
        doc.text('ÁREA (ha)', sTableCard.contentX + 135, syt + 4.2, { align: 'right' });
        doc.text('%', sTableCard.contentX + 168, syt + 4.2, { align: 'right' });
        syt += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);

        const CORES_STX = (typeof SoloTextural !== 'undefined') ? SoloTextural.CORES_SOLO_TEXTURAL : {};

        for (const [key, info] of sClasses) {
          const cNum = parseInt(key.replace('Classe ', ''));
          const hexColor = CORES_STX[cNum] || '#CCCCCC';
          const r = parseInt(hexColor.slice(1, 3), 16);
          const g = parseInt(hexColor.slice(3, 5), 16);
          const b = parseInt(hexColor.slice(5, 7), 16);
          doc.setFillColor(r, g, b);
          doc.rect(sTableCard.contentX + 1, syt - 3.2, 3, 3.5, 'F');

          doc.setFontSize(7.5); doc.setTextColor(...COLORS.text);
          doc.text(pdfSafe(info.descricao || '-'), sTableCard.contentX + 6, syt);
          doc.text(info.area_ha_formatado || n2(info.area_ha), sTableCard.contentX + 135, syt, { align: 'right' });
          doc.text(info.percentual_formatado || n2(info.percentual) + '%', sTableCard.contentX + 168, syt, { align: 'right' });
          syt += 5;
        }

        drawFooter(doc, doc.internal.getNumberOfPages());
      }

      // ── PÁGINA UNIFICADA DE EMBARGOS (IBAMA + ICMBio) ────────────────────────
      const hasEmbIbama = embargoResult && embargoResult.relatorio;
      const hasEmbIcmbio = icmbioResult && icmbioResult.relatorio;

      if (hasEmbIbama || hasEmbIcmbio) {
        doc.addPage();
        const headerEmb = await drawHeader(doc, 'Resultado de Análise — Embargos', polygonName);
        let embY = headerEmb;
        const PAGE_BOTTOM_EMB = PAGE.height - 22;

        // Helper: trunca e sanitiza texto
        const truncEmb = (s, max) => {
          const t = pdfSafe((s || '-').trim());
          return t.length > max ? t.substring(0, max) + '...' : t;
        };

        // ── IBAMA ──
        if (hasEmbIbama) {
          const relE = embargoResult.relatorio;
          const possuiEmb = relE.possui_embargo;

          // Card de resumo IBAMA
          const eInfoCard = drawCard(doc, margin, embY, contentWidth, 34, 'Situação de Embargo IBAMA');
          doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text);
          const corEmb = possuiEmb ? [222, 0, 4] : [2, 139, 0];
          const txtEmb = possuiEmb ? 'EMBARGO IDENTIFICADO' : 'SEM EMBARGO IBAMA';
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...corEmb);
          doc.text(txtEmb, eInfoCard.contentX + (contentWidth - 10) / 2, eInfoCard.contentY + 5, { align: 'center' });
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text); doc.setFontSize(8);
          doc.text(`Area Total: ${relE.area_total_poligono_ha_formatado || '-'}`, eInfoCard.contentX + 2, eInfoCard.contentY + 12);
          doc.text(`Area Embargada: ${relE.area_embargada_ha_formatado || '0,0000 ha'} (${relE.area_embargada_percentual_formatado || '0,00%'})`, eInfoCard.contentX + 65, eInfoCard.contentY + 12);
          doc.text(`No. de Embargos: ${relE.numero_embargoes || 0}`, eInfoCard.contentX + 2, eInfoCard.contentY + 19);
          embY += 40;

          // Tabela de embargos IBAMA
          const embargoes = embargoResult.embargoes || [];
          if (embargoes.length > 0) {
            const LINE_H = 4.0;
            const ROW_PAD = 2;
            const HDR_H = 8;

            doc.setFontSize(7);
            const rowData = embargoes.map(emb => {
              const lNum = doc.splitTextToSize(pdfSafe(emb.num_tad || '-'), 27);
              const lInfrac = doc.splitTextToSize(truncEmb(emb.des_infrac, 55), 46);
              const lTad = doc.splitTextToSize(truncEmb(emb.des_tad, 120), 40);
              const nLines = Math.max(lNum.length, lInfrac.length, lTad.length, 1);
              return {
                lNum, lInfrac, lTad,
                dataTxt: pdfSafe(emb.dat_embarg || '-'),
                areaTxt: pdfSafe(emb.area_sobreposta_ha_formatado || '-'),
                rowH: nLines * LINE_H + ROW_PAD * 2,
              };
            });

            const drawTblHdr = (cx, y) => {
              doc.setFillColor(240, 240, 240);
              doc.rect(cx, y, contentWidth - 10, 6, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(31, 39, 72);
              doc.text('No. TAD', cx + 6, y + 4.2);
              doc.text('DATA', cx + 35, y + 4.2);
              doc.text('INFRACAO', cx + 60, y + 4.2);
              doc.text('DESC. TAD', cx + 108, y + 4.2);
              doc.text('AREA SOBR. (ha)', cx + contentWidth - 12, y + 4.2, { align: 'right' });
              return y + HDR_H;
            };

            let remaining = [...rowData];
            let firstChunk = true;

            while (remaining.length > 0) {
              if (!firstChunk) {
                drawFooter(doc, doc.internal.getNumberOfPages());
                doc.addPage();
                embY = await drawHeader(doc, 'Resultado de Análise — Embargos', polygonName);
              }

              const availH = PAGE_BOTTOM_EMB - embY - 16;
              let usedH = HDR_H;
              const chunk = [];
              for (const row of remaining) {
                if (usedH + row.rowH > availH) break;
                chunk.push(row);
                usedH += row.rowH;
              }
              if (chunk.length === 0) {
                chunk.push(remaining[0]);
                usedH = HDR_H + remaining[0].rowH;
              }
              remaining = remaining.slice(chunk.length);

              const tableH = usedH + 16;
              const label = firstChunk ? 'Embargos IBAMA Sobrepostos' : 'Embargos IBAMA Sobrepostos (cont.)';
              const tCard = drawCard(doc, margin, embY, contentWidth, tableH, label);
              const cx = tCard.contentX;
              let eyt = drawTblHdr(cx, tCard.contentY);

              doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.text);
              for (const row of chunk) {
                const ty = eyt + ROW_PAD + LINE_H - 0.5;
                doc.setFillColor(222, 0, 4);
                doc.rect(cx + 1, eyt + ROW_PAD - 0.5, 3, 3.5, 'F');
                doc.text(row.lNum, cx + 6, ty);
                doc.text(row.dataTxt, cx + 35, ty);
                doc.text(row.lInfrac, cx + 60, ty);
                doc.text(row.lTad, cx + 108, ty);
                doc.text(row.areaTxt, cx + contentWidth - 12, ty, { align: 'right' });
                eyt += row.rowH;
              }

              embY += tableH + 6;
              firstChunk = false;
            }
          }
        }

        // ── ICMBio ──
        if (hasEmbIcmbio) {
          const relI = icmbioResult.relatorio;
          const possuiI = relI.possui_embargo;

          // Verificar se cabe o card de resumo ICMBio na página atual
          if (embY + 40 > PAGE_BOTTOM_EMB) {
            drawFooter(doc, doc.internal.getNumberOfPages());
            doc.addPage();
            embY = await drawHeader(doc, 'Resultado de Análise — Embargos', polygonName);
          }

          // Card de resumo ICMBio
          const iInfoCard = drawCard(doc, margin, embY, contentWidth, 34, 'Situação de Embargo ICMBio');
          doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text);
          const corI = possuiI ? [0, 102, 204] : [2, 139, 0];
          const txtI = possuiI ? 'EMBARGO ICMBIO IDENTIFICADO' : 'SEM EMBARGO ICMBIO';
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...corI);
          doc.text(txtI, iInfoCard.contentX + (contentWidth - 10) / 2, iInfoCard.contentY + 5, { align: 'center' });
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text); doc.setFontSize(8);
          doc.text(`Area Total: ${relI.area_total_poligono_ha_formatado || '-'}`, iInfoCard.contentX + 2, iInfoCard.contentY + 12);
          doc.text(`Area Embargada: ${relI.area_embargada_ha_formatado || '0,0000 ha'} (${relI.area_embargada_percentual_formatado || '0,00%'})`, iInfoCard.contentX + 65, iInfoCard.contentY + 12);
          doc.text(`No. de Embargos: ${relI.numero_embargoes || 0}`, iInfoCard.contentX + 2, iInfoCard.contentY + 19);
          embY += 40;

          // Tabela de embargos ICMBio
          const icmbios = icmbioResult.embargoes || [];
          if (icmbios.length > 0) {
            const LINE_H = 4.0;
            const ROW_PAD = 2;
            const HDR_H = 8;

            doc.setFontSize(7);
            const rowData = icmbios.map(emb => {
              const lNum = doc.splitTextToSize(pdfSafe(emb.numero_emb || '-'), 25);
              const lTipo = doc.splitTextToSize(truncEmb(emb.tipo_infra, 30), 30);
              const lDesc = doc.splitTextToSize(truncEmb(emb.desc_infra, 100), 55);
              const nLines = Math.max(lNum.length, lTipo.length, lDesc.length, 1);
              return {
                lNum, lTipo, lDesc,
                dataTxt: pdfSafe(emb.data_embargo || '-'),
                areaTxt: pdfSafe(emb.area_sobreposta_ha_formatado || '-'),
                pctTxt: pdfSafe(emb.percentual_sobreposicao_formatado || '-'),
                rowH: nLines * LINE_H + ROW_PAD * 2,
              };
            });

            const drawTblHdrI = (cx, y) => {
              doc.setFillColor(240, 240, 240);
              doc.rect(cx, y, contentWidth - 10, 6, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(31, 39, 72);
              doc.text('No. EMBARGO', cx + 6, y + 4.2);
              doc.text('DATA', cx + 30, y + 4.2);
              doc.text('TIPO', cx + 55, y + 4.2);
              doc.text('INFRACAO', cx + 88, y + 4.2);
              doc.text('AREA SOBR. (ha)', cx + contentWidth - 22, y + 4.2, { align: 'right' });
              return y + HDR_H;
            };

            // Verificar se cabe a tabela na página atual
            if (embY + 30 > PAGE_BOTTOM_EMB) {
              drawFooter(doc, doc.internal.getNumberOfPages());
              doc.addPage();
              embY = await drawHeader(doc, 'Resultado de Análise — Embargos', polygonName);
            }

            let remaining = [...rowData];
            let firstChunk = true;

            while (remaining.length > 0) {
              if (!firstChunk) {
                drawFooter(doc, doc.internal.getNumberOfPages());
                doc.addPage();
                embY = await drawHeader(doc, 'Resultado de Análise — Embargos', polygonName);
              }

              const availH = PAGE_BOTTOM_EMB - embY - 16;
              let usedH = HDR_H;
              const chunk = [];
              for (const row of remaining) {
                if (usedH + row.rowH > availH) break;
                chunk.push(row);
                usedH += row.rowH;
              }
              if (chunk.length === 0) {
                chunk.push(remaining[0]);
                usedH = HDR_H + remaining[0].rowH;
              }
              remaining = remaining.slice(chunk.length);

              const tableH = usedH + 16;
              const label = firstChunk ? 'Embargos ICMBio Sobrepostos' : 'Embargos ICMBio Sobrepostos (cont.)';
              const tCard = drawCard(doc, margin, embY, contentWidth, tableH, label);
              const cx = tCard.contentX;
              let iyt = drawTblHdrI(cx, tCard.contentY);

              doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COLORS.text);
              for (const row of chunk) {
                const ty = iyt + ROW_PAD + LINE_H - 0.5;
                doc.setFillColor(0, 102, 204);
                doc.rect(cx + 1, iyt + ROW_PAD - 0.5, 3, 3.5, 'F');
                doc.text(row.lNum, cx + 6, ty);
                doc.text(row.dataTxt, cx + 30, ty);
                doc.text(row.lTipo, cx + 55, ty);
                doc.text(row.lDesc, cx + 88, ty);
                doc.text(row.areaTxt, cx + contentWidth - 22, ty, { align: 'right' });
                iyt += row.rowH;
              }

              embY += tableH + 6;
              firstChunk = false;
            }
          }
        }

        drawFooter(doc, doc.internal.getNumberOfPages());
      }
    },

    /**
     * Relatório consolidado (múltiplos polígonos)
     */
    generateConsolidatedReport: async function (analysisResults, declivityResults = null, aptidaoResults = null, embargoResults = null, icmbioResults = null, soloTexturalResults = null) {
      if ((!analysisResults || analysisResults.length === 0) &&
        (!declivityResults || declivityResults.length === 0) &&
        (!aptidaoResults || aptidaoResults.length === 0) &&
        (!embargoResults || embargoResults.length === 0) &&
        (!icmbioResults || icmbioResults.length === 0) &&
        (!soloTexturalResults || soloTexturalResults.length === 0)) return;

      if (!jsPDFCtor) throw new Error('jsPDF não encontrado em window.jspdf');

      const doc = new jsPDFCtor();
      const pageWidth = PAGE.width;
      const contentWidth = pageWidth - 2 * margin;

      await drawHeader(doc, 'Relatório Consolidado de Áreas', 'Visão Geral do Empreendimento');
      let yOffset = 45;
      const PAGE_BOTTOM = PAGE.height - 22;

      // Calcular o total de polígonos baseando-se no módulo que tiver mais
      const totalPolygons = Math.max(
        analysisResults ? analysisResults.length : 0,
        declivityResults ? declivityResults.length : 0,
        aptidaoResults ? aptidaoResults.length : 0,
        embargoResults ? embargoResults.length : 0,
        icmbioResults ? icmbioResults.length : 0,
        soloTexturalResults ? soloTexturalResults.length : 0
      );

      // Calcular área total consolidada a partir de qualquer módulo disponível
      let areaTotalGlobal = 0;
      const modulesForArea = [analysisResults, declivityResults, aptidaoResults, embargoResults, icmbioResults, soloTexturalResults];
      // Usar o primeiro módulo com dados para evitar dupla-contagem
      const moduleForArea = modulesForArea.find(m => m && m.length > 0);
      if (moduleForArea) {
        moduleForArea.forEach(res => {
          const rel = res.relatorio || {};
          areaTotalGlobal += Number(rel.area_total_poligono_ha || 0);
        });
      }

      // Listar análises realizadas
      const analisesList = [];
      if (analysisResults && analysisResults.length > 0) analisesList.push('Uso do Solo');
      if (declivityResults && declivityResults.length > 0) analisesList.push('Declividade');
      if (aptidaoResults && aptidaoResults.length > 0) analisesList.push('Aptidao Agronomica');
      if (soloTexturalResults && soloTexturalResults.length > 0) analisesList.push('Textura do Solo');
      if (embargoResults && embargoResults.length > 0) analisesList.push('Embargos IBAMA');
      if (icmbioResults && icmbioResults.length > 0) analisesList.push('Embargos ICMBio');

      const dataEmissao = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');

      // ---------- CARD: RESUMO EXECUTIVO (sempre presente) ----------
      const resumoH = 38;
      const resumoCard = drawCard(doc, margin, yOffset, contentWidth, resumoH, 'Resumo Executivo do Empreendimento');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text);
      let ry = resumoCard.contentY + 2;
      doc.text(pdfSafe(`Poligonos Analisados: ${totalPolygons}`), resumoCard.contentX, ry);
      doc.text(pdfSafe(`Area Total: ${n2(areaTotalGlobal)} ha`), resumoCard.contentX + 80, ry);
      ry += 6;
      doc.text(pdfSafe(`Analises Realizadas: ${analisesList.join(', ')}`), resumoCard.contentX, ry);
      ry += 6;
      doc.text(pdfSafe(`Data de Emissao: ${dataEmissao}`), resumoCard.contentX, ry);

      yOffset += resumoH + 6;

      // Helper: verificar espaço e quebrar página se necessário
      const ensureSpace = async (needed) => {
        if (yOffset + needed > PAGE_BOTTOM) {
          drawFooter(doc, doc.internal.getNumberOfPages());
          doc.addPage();
          const hh = await drawHeader(doc, 'Relatório Consolidado de Áreas', 'Visão Geral do Empreendimento');
          yOffset = hh;
        }
      };

      // ---------- 1. CONSOLIDADO: USO DO SOLO ----------
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

        const sorted = Object.entries(classesConsolidadas).sort((a, b) => b[1].area_ha - a[1].area_ha);
        const ROW_H = 5.5;
        const tableH = 12 + sorted.length * ROW_H + 12;

        await ensureSpace(tableH);

        const tableCard = drawCard(doc, margin, yOffset, contentWidth, tableH, 'Consolidado: Uso do Solo');
        let y = tableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(tableCard.contentX, y, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        const hasValC = valorTotalConsolidado > 0;
        const cColArea = hasValC ? 100 : 135;
        const cColPct = hasValC ? 128 : 168;
        const cColVal = 168;
        doc.text('DESCRICAO DA CLASSE', tableCard.contentX + 2, y + 4.2);
        doc.text('AREA TOTAL (ha)', tableCard.contentX + cColArea, y + 4.2, { align: 'right' });
        doc.text('%', tableCard.contentX + cColPct, y + 4.2, { align: 'right' });
        if (hasValC) doc.text('VALOR TOTAL (R$)', tableCard.contentX + cColVal, y + 4.2, { align: 'right' });
        y += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        for (const [key, info] of sorted) {
          const classNum = key.replace('Classe ', '');
          doc.setFillColor(...getClassColor(classNum));
          doc.rect(tableCard.contentX + 1, y - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), tableCard.contentX + 6, y);
          doc.text(n2(info.area_ha), tableCard.contentX + cColArea, y, { align: 'right' });
          doc.text(n2((info.area_ha / areaTotalConsolidada) * 100) + '%', tableCard.contentX + cColPct, y, { align: 'right' });
          if (hasValC) doc.text(n2(info.valor), tableCard.contentX + cColVal, y, { align: 'right' });
          y += ROW_H;
        }

        yOffset += tableH + 6;
      }

      // ---------- 2. CONSOLIDADO: DECLIVIDADE ----------
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

        const dSorted = Object.entries(dClassesCons).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));
        const ROW_H = 5.5;
        const dTableH = 12 + dSorted.length * ROW_H + 12;

        await ensureSpace(dTableH);

        const dTableCard = drawCard(doc, margin, yOffset, contentWidth, dTableH, 'Consolidado: Relevo e Declividade');
        let dy = dTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(dTableCard.contentX, dy, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE DE DECLIVIDADE', dTableCard.contentX + 2, dy + 4.2);
        doc.text('AREA TOTAL (ha)', dTableCard.contentX + 135, dy + 4.2, { align: 'right' });
        doc.text('%', dTableCard.contentX + 168, dy + 4.2, { align: 'right' });
        dy += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);

        for (const [key, info] of dSorted) {
          const cNum = key.replace('Classe ', '');
          doc.setFillColor(...getClassColor(cNum, true));
          doc.rect(dTableCard.contentX + 1, dy - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), dTableCard.contentX + 6, dy);
          doc.text(n2(info.area_ha), dTableCard.contentX + 135, dy, { align: 'right' });
          doc.text(dAreaTotal > 0 ? n2((info.area_ha / dAreaTotal) * 100) + '%' : '0.00%', dTableCard.contentX + 168, dy, { align: 'right' });
          dy += ROW_H;
        }

        yOffset += dTableH + 6;
      }

      // ---------- 3. CONSOLIDADO: APTIDÃO ----------
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

        const aSorted = Object.entries(aClassesCons).sort((a, b) => parseInt(a[0].replace('Classe ', '')) - parseInt(b[0].replace('Classe ', '')));
        const ROW_H = 5.5;
        const aTableH = 12 + aSorted.length * ROW_H + 12;

        await ensureSpace(aTableH);

        const aTableCard = drawCard(doc, margin, yOffset, contentWidth, aTableH, 'Consolidado: Aptidao Agronomica');
        let ay = aTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(aTableCard.contentX, ay, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE DE APTIDAO', aTableCard.contentX + 2, ay + 4.2);
        doc.text('AREA TOTAL (ha)', aTableCard.contentX + 135, ay + 4.2, { align: 'right' });
        doc.text('%', aTableCard.contentX + 168, ay + 4.2, { align: 'right' });
        ay += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);

        for (const [key, info] of aSorted) {
          const cNum = key.replace('Classe ', '');
          doc.setFillColor(...getClassColor(cNum, false, true));
          doc.rect(aTableCard.contentX + 1, ay - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), aTableCard.contentX + 6, ay);
          doc.text(n2(info.area_ha), aTableCard.contentX + 135, ay, { align: 'right' });
          doc.text(aAreaTotal > 0 ? n2((info.area_ha / aAreaTotal) * 100) + '%' : '0.00%', aTableCard.contentX + 168, ay, { align: 'right' });
          ay += ROW_H;
        }

        yOffset += aTableH + 6;
      }

      // ---------- 4. CONSOLIDADO: TEXTURA DO SOLO ----------
      if (soloTexturalResults && soloTexturalResults.length > 0) {
        const stxClassesCons = {};
        let stxAreaTotal = 0;

        soloTexturalResults.forEach(res => {
          if (!res || !res.relatorio) return;
          stxAreaTotal += Number(res.relatorio.area_total_poligono_ha || 0);
          Object.entries(res.relatorio.classes || {}).forEach(([key, info]) => {
            if (!stxClassesCons[key]) stxClassesCons[key] = { descricao: info.descricao, area_ha: 0 };
            stxClassesCons[key].area_ha += Number(info.area_ha || 0);
          });
        });

        const stxSorted = Object.entries(stxClassesCons).sort((a, b) => b[1].area_ha - a[1].area_ha);
        const ROW_H = 5.5;
        const stxTableH = 12 + stxSorted.length * ROW_H + 12;

        await ensureSpace(stxTableH);

        const stxTableCard = drawCard(doc, margin, yOffset, contentWidth, stxTableH, 'Consolidado: Textura do Solo');
        let sy = stxTableCard.contentY;

        doc.setFillColor(240, 240, 240);
        doc.rect(stxTableCard.contentX, sy, contentWidth - 10, 6, 'F');
        doc.setTextColor(31, 39, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text('CLASSE TEXTURAL', stxTableCard.contentX + 2, sy + 4.2);
        doc.text('AREA TOTAL (ha)', stxTableCard.contentX + 135, sy + 4.2, { align: 'right' });
        doc.text('%', stxTableCard.contentX + 168, sy + 4.2, { align: 'right' });
        sy += 12;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const CORES_STX = (typeof SoloTextural !== 'undefined') ? SoloTextural.CORES_SOLO_TEXTURAL : {};

        for (const [key, info] of stxSorted) {
          const cNum = parseInt(key.replace('Classe ', ''));
          const hexColor = CORES_STX[cNum] || '#CCCCCC';
          const r = parseInt(hexColor.slice(1, 3), 16);
          const g = parseInt(hexColor.slice(3, 5), 16);
          const b = parseInt(hexColor.slice(5, 7), 16);
          doc.setFillColor(r, g, b);
          doc.rect(stxTableCard.contentX + 1, sy - 3.2, 3, 3.5, 'F');
          doc.text(pdfSafe(info.descricao || '-'), stxTableCard.contentX + 6, sy);
          doc.text(n2(info.area_ha), stxTableCard.contentX + 135, sy, { align: 'right' });
          doc.text(stxAreaTotal > 0 ? n2((info.area_ha / stxAreaTotal) * 100) + '%' : '0.00%', stxTableCard.contentX + 168, sy, { align: 'right' });
          sy += ROW_H;
        }

        yOffset += stxTableH + 6;
      }

      // ---------- 5. CONSOLIDADO: EMBARGOS ----------
      const hasEmbIbamaC = embargoResults && embargoResults.length > 0;
      const hasEmbIcmbioC = icmbioResults && icmbioResults.length > 0;

      if (hasEmbIbamaC || hasEmbIcmbioC) {
        // Agregar dados de embargos
        let totalEmbIbama = 0, areaEmbIbama = 0, polyComEmbIbama = 0;
        let totalEmbIcmbio = 0, areaEmbIcmbio = 0, polyComEmbIcmbio = 0;

        if (hasEmbIbamaC) {
          embargoResults.forEach(res => {
            if (!res || !res.relatorio) return;
            const rel = res.relatorio;
            totalEmbIbama += Number(rel.numero_embargoes || 0);
            areaEmbIbama += Number(rel.area_embargada_ha || 0);
            if (rel.possui_embargo) polyComEmbIbama++;
          });
        }
        if (hasEmbIcmbioC) {
          icmbioResults.forEach(res => {
            if (!res || !res.relatorio) return;
            const rel = res.relatorio;
            totalEmbIcmbio += Number(rel.numero_embargoes || 0);
            areaEmbIcmbio += Number(rel.area_embargada_ha || 0);
            if (rel.possui_embargo) polyComEmbIcmbio++;
          });
        }

        // Calcular altura do card
        let embLines = 0;
        if (hasEmbIbamaC) embLines += 2; // título + dados IBAMA
        if (hasEmbIcmbioC) embLines += 2; // título + dados ICMBio
        const embCardH = 12 + embLines * 6 + 4;

        await ensureSpace(embCardH);

        const embCard = drawCard(doc, margin, yOffset, contentWidth, embCardH, 'Consolidado: Embargos');
        let ey = embCard.contentY + 2;

        doc.setFontSize(8); doc.setTextColor(...COLORS.text);

        if (hasEmbIbamaC) {
          const corIbama = polyComEmbIbama > 0 ? [222, 0, 4] : [2, 139, 0];
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...corIbama);
          doc.text(pdfSafe(`IBAMA: ${polyComEmbIbama > 0 ? polyComEmbIbama + ' poligono(s) com embargo' : 'Nenhum embargo identificado'}`), embCard.contentX, ey);
          ey += 6;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text);
          doc.text(pdfSafe(`Total de Embargos: ${totalEmbIbama}   |   Area Embargada Total: ${n2(areaEmbIbama)} ha`), embCard.contentX, ey);
          ey += 6;
        }

        if (hasEmbIcmbioC) {
          const corIcmbio = polyComEmbIcmbio > 0 ? [0, 102, 204] : [2, 139, 0];
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...corIcmbio);
          doc.text(pdfSafe(`ICMBio: ${polyComEmbIcmbio > 0 ? polyComEmbIcmbio + ' poligono(s) com embargo' : 'Nenhum embargo identificado'}`), embCard.contentX, ey);
          ey += 6;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text);
          doc.text(pdfSafe(`Total de Embargos: ${totalEmbIcmbio}   |   Area Embargada Total: ${n2(areaEmbIcmbio)} ha`), embCard.contentX, ey);
          ey += 6;
        }

        yOffset += embCardH + 6;
      }

      drawFooter(doc, doc.internal.getNumberOfPages());

      // --- PÁGINAS INDIVIDUAIS (NOVIDADE) ---
      // Como os resultados podem vir de módulos diferentes (e alguns podem não ter Uso do Solo),
      // precisamos obter uma lista única de "polígonos" processados.
      const uniqueIndices = new Set();
      const allModules = [analysisResults || [], declivityResults || [], aptidaoResults || [], embargoResults || [], icmbioResults || [], soloTexturalResults || []];

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
        const iResult = (icmbioResults || []).find(ir => ir.fileIndex === fileIdx) || null;
        const stxResult = (soloTexturalResults || []).find(sr => sr.fileIndex === fileIdx) || null;

        const baseResult = sResult || dResult || aResult || eResult || iResult || stxResult;
        if (!baseResult) continue;

        // Recuperar metadados úteis para o cabeçalho/dados do imóvel
        const centroidText = baseResult.metadados?.centroide_display || baseResult.centroidText || '';
        const propertyCode = baseResult.propertyCode || baseResult.metadados?.codigo_imovel || null;

        doc.addPage();
        await this.drawPolygonAnalysisSection(doc, sResult, centroidText, baseResult.fileName, propertyCode, dResult, aResult, eResult, iResult, stxResult);
      }

      // Atualizar número total de páginas em todos os rodapés (opcional, mas jspdf não faz auto)
      // Por simplicidade, deixamos o rodapé com o número da página atual.

      doc.save(`relatorio_consolidado_infogeo_${Date.now()}.pdf`);
    }
  };

  return API;
});
