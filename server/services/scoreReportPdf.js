const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, LineCapStyle } = require('pdf-lib');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const NAVY = rgb(0.075, 0.188, 0.247);
const NAVY_CARD = rgb(0.059, 0.196, 0.255);
const SLATE = rgb(0.392, 0.455, 0.545);
const MUTED = rgb(0.58, 0.639, 0.722);
const TEAL = rgb(0.086, 0.722, 0.663);
const TEAL_TEXT = rgb(0.17, 0.66, 0.65);
const TEAL_PALE = rgb(0.906, 0.961, 0.949);
const HEADER_BG = rgb(0.902, 0.957, 0.969);
const HEADER_BLOB = rgb(0.78, 0.91, 0.898);
const ACCENT = rgb(0.129, 0.816, 0.851);
const CARD_BG = rgb(0.969, 0.98, 0.988);
const BORDER = rgb(0.886, 0.91, 0.941);
const TRACK = rgb(0.855, 0.898, 0.918);
const LINE = rgb(0.929, 0.949, 0.965);
const WHITE = rgb(1, 1, 1);
const RANK_LABEL = rgb(0.604, 0.725, 0.776);
const RANK_SUB = rgb(0.741, 0.812, 0.843);

const TABLE_TOP = PAGE_H - 446;
const TABLE_COLS = {
  round: { x: MARGIN, w: 175 },
  performance: { x: MARGIN + 175, w: 285 },
  score: { x: PAGE_W - MARGIN }
};
const ROW_H = 36;
const TABLE_HEAD_H = 22;
const ROW_FLOOR = 80;

const formatScore = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

const truncate = (font, text, size, maxWidth) => {
  let out = String(text == null ? '' : text);
  if (font.widthOfTextAtSize(out, size) <= maxWidth) return out;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) out = out.slice(0, -1);
  return `${out}...`;
};

const wrapText = (font, text, size, maxWidth, maxLines = 45) => {
  const paragraphs = String(text == null ? '' : text).split(/\r?\n/);
  const lines = [];
  paragraphs.forEach(paragraph => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      return;
    }
    let line = '';
    words.forEach(word => {
      let w = word;
      while (w.length > 1 && font.widthOfTextAtSize(w, size) > maxWidth) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut -= 1;
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);
  });
  if (lines.length > maxLines) {
    const capped = lines.slice(0, maxLines);
    capped[maxLines - 1] = `${capped[maxLines - 1]}...`;
    return capped;
  }
  return lines;
};

const roundRectPath = (w, h, r) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M ${rr} 0`,
    `H ${w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${w} ${rr}`,
    `V ${h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${w - rr} ${h}`,
    `H ${rr}`,
    `A ${rr} ${rr} 0 0 1 0 ${h - rr}`,
    `V ${rr}`,
    `A ${rr} ${rr} 0 0 1 ${rr} 0`,
    'Z'
  ].join(' ');
};

const arcPath = (r, sweepDeg) => {
  const clamped = Math.min(Math.max(sweepDeg, 0), 359.99);
  const phi = (clamped * Math.PI) / 180;
  const ex = r * Math.sin(phi);
  const ey = -r * Math.cos(phi);
  const large = clamped > 180 ? 1 : 0;
  return `M 0 ${-r} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`;
};

const fullRingPath = (r) =>
  `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`;

const buildScoreReportPdf = async ({ event, student, rows, total, rank, totalParticipants, comment, criterionComments }) => {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logo = null;
  for (const file of ['logo-mark-cyan.png', 'logo-mark.png']) {
    try {
      const logoBytes = fs.readFileSync(path.resolve(__dirname, '../../client/public', file));
      logo = await doc.embedPng(logoBytes);
      break;
    } catch (e) {
      logo = null;
    }
  }

  let universityLogo = null;
  try {
    const uniBytes = fs.readFileSync(path.resolve(__dirname, '../../client/public', 'sreenidhi-university.png'));
    universityLogo = await doc.embedPng(uniBytes);
  } catch (e) {
    universityLogo = null;
  }

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const safeRows = Array.isArray(rows) ? rows : [];
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Results derived from the breakdown itself so the summary always matches the table
  const totalScore = safeRows.reduce((sum, r) => sum + (r.score == null || r.score === '' ? 0 : num(r.score)), 0);
  const displayTotal = totalScore;
  const maxTotal = safeRows.reduce((sum, r) => sum + Math.max(0, num(r.max)), 0);
  const fraction = maxTotal > 0 ? Math.min(Math.max(displayTotal / maxTotal, 0), 1) : 0;

  const drawText = (page, text, x, y, opts = {}) => {
    const { size = 10, font = regular, color = NAVY, align = 'left', maxWidth = null } = opts;
    const content = maxWidth ? truncate(font, text, size, maxWidth) : String(text == null ? '' : text);
    const width = font.widthOfTextAtSize(content, size);
    const drawX = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    page.drawText(content, { x: drawX, y, size, font, color });
  };

  const drawRoundRect = (page, x, yTop, w, h, r, fill, stroke = null, strokeWidth = 1) => {
    const opts = { x, y: yTop, color: fill };
    if (stroke) {
      opts.borderColor = stroke;
      opts.borderWidth = strokeWidth;
    }
    page.drawSvgPath(roundRectPath(w, h, r), opts);
  };

  const drawLogo = (page, x, yBottom, w, h, pad) => {
    if (!logo) return;
    const dims = logo.scale(1);
    const scale = Math.min((w - pad * 2) / dims.width, (h - pad * 2) / dims.height);
    const lw = dims.width * scale;
    const lh = dims.height * scale;
    page.drawImage(logo, { x: x + (w - lw) / 2, y: yBottom + (h - lh) / 2, width: lw, height: lh });
  };

  const drawUniversityLogo = (page, rightX, topY, height) => {
    if (!universityLogo) return;
    const dims = universityLogo.scale(1);
    const w = dims.width * (height / dims.height);
    page.drawImage(universityLogo, { x: rightX - w, y: topY - height, width: w, height });
  };

  const drawFullHeader = (page) => {
    page.drawRectangle({ x: 0, y: PAGE_H - 112, width: PAGE_W, height: 112, color: HEADER_BG });
    page.drawCircle({ x: PAGE_W - 62, y: PAGE_H - 12, size: 96, color: HEADER_BLOB });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H - 112, color: WHITE });
    page.drawRectangle({ x: 0, y: PAGE_H - 114.5, width: PAGE_W, height: 2.5, color: ACCENT });

    drawLogo(page, 44, PAGE_H - 92, 68, 68, 2);
    drawText(page, 'AVENTO', 126, PAGE_H - 58, { size: 26, font: bold, color: NAVY });
    drawText(page, 'SMART CAMPUS EVENT MANAGEMENT', 127, PAGE_H - 73, { size: 7, color: SLATE });
    drawUniversityLogo(page, PAGE_W - 40, PAGE_H - 37, 42);
  };

  const drawContinuationHeader = (page) => {
    page.drawRectangle({ x: 0, y: PAGE_H - 54, width: PAGE_W, height: 54, color: HEADER_BG });
    page.drawCircle({ x: PAGE_W - 30, y: PAGE_H - 6, size: 56, color: HEADER_BLOB });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H - 54, color: WHITE });
    page.drawRectangle({ x: 0, y: PAGE_H - 56.5, width: PAGE_W, height: 2.5, color: ACCENT });

    drawLogo(page, 40, PAGE_H - 45, 34, 34, 1);
    drawText(page, 'AVENTO', 82, PAGE_H - 34, { size: 13, font: bold, color: NAVY });
    drawUniversityLogo(page, PAGE_W - 40, PAGE_H - 12, 20);
    drawText(page, `${student.name || 'Student'} - Score Report (continued)`, PAGE_W - 40, PAGE_H - 46, { size: 8.5, color: SLATE, align: 'right' });
  };

  const drawTitleBlock = (page) => {
    const title = event.title || 'Event';
    const name = student.name || 'Student';
    // Show the event title in full: wrap it across lines (shrinking the font a
    // little when needed) so it fits between the header and the info card,
    // instead of truncating it to a single line ending in "...".
    const topLimit = 122.5;
    const bottomLimit = 175;
    let size = 22;
    let lineH = size * 1.15;
    let firstBaseline = topLimit + size * 0.72;
    let maxLines = Math.max(1, Math.floor((bottomLimit - firstBaseline) / lineH) + 1);
    let lines = wrapText(bold, title, size, CONTENT_W, 20);
    while (lines.length > maxLines && size > 11) {
      size -= 1;
      lineH = size * 1.15;
      firstBaseline = topLimit + size * 0.72;
      maxLines = Math.max(1, Math.floor((bottomLimit - firstBaseline) / lineH) + 1);
      lines = wrapText(bold, title, size, CONTENT_W, 20);
    }
    if (lines.length > maxLines) lines = wrapText(bold, title, size, CONTENT_W, maxLines);

    if (lines.length === 1) {
      drawText(page, lines[0], MARGIN, PAGE_H - 158, { size, font: bold, color: NAVY });
      drawText(page, `Score report for ${name}`, MARGIN, PAGE_H - 176, { size: 9.5, color: SLATE, maxWidth: CONTENT_W });
      return;
    }

    lines.forEach((line, i) => {
      drawText(page, line, MARGIN, PAGE_H - (firstBaseline + i * lineH), { size, font: bold, color: NAVY });
    });
    drawText(page, `Score report for ${name}`, MARGIN, PAGE_H - (firstBaseline + (lines.length - 1) * lineH + 18), { size: 9.5, color: SLATE, maxWidth: CONTENT_W });
  };

  const drawInfoCard = (page) => {
    const top = PAGE_H - 200;
    drawRoundRect(page, MARGIN, top, CONTENT_W, 64, 10, CARD_BG, BORDER, 1);
    const cols = [
      { label: 'NAME', x: MARGIN + 18, value: student.name || 'Unknown Student', w: 185 },
      { label: 'ROLL NO', x: MARGIN + 215, value: student.roll_number || '-', w: 125 },
      { label: 'DEPARTMENT', x: MARGIN + 355, value: student.department || '-', w: 142 }
    ];
    cols.forEach(col => {
      drawText(page, col.label, col.x, top - 22, { size: 6.5, font: bold, color: MUTED });
      drawText(page, col.value, col.x, top - 44, { size: 11, font: bold, color: NAVY, maxWidth: col.w });
    });
  };

  const drawTotalCard = (page) => {
    const top = PAGE_H - 296;
    const h = 92;
    drawRoundRect(page, MARGIN, top, CONTENT_W, h, 12, TEAL_PALE, BORDER, 1);
    drawText(page, 'TOTAL SCORE', MARGIN + 20, top - 24, { size: 7.5, font: bold, color: SLATE });
    const valueStr = formatScore(displayTotal);
    drawText(page, valueStr, MARGIN + 20, top - 60, { size: 28, font: bold, color: TEAL });
    const valueW = bold.widthOfTextAtSize(valueStr, 28);
    drawText(page, `/ ${formatScore(maxTotal)} marks`, MARGIN + 20 + valueW + 8, top - 60, { size: 12, color: SLATE });
    const barX = MARGIN + 20;
    const barY = top - 76;
    const barW = CONTENT_W - 40;
    const barH = 8;
    drawRoundRect(page, barX, barY, barW, barH, barH / 2, TRACK);
    if (fraction > 0.001) drawRoundRect(page, barX, barY, Math.max(barH, barW * fraction), barH, barH / 2, TEAL);
  };

  const drawTableHeader = (page, topY) => {
    drawText(page, 'ROUND', TABLE_COLS.round.x, topY - 14, { size: 7, font: bold, color: MUTED });
    drawText(page, 'PERFORMANCE', TABLE_COLS.performance.x, topY - 14, { size: 7, font: bold, color: MUTED });
    drawText(page, 'SCORE', TABLE_COLS.score.x, topY - 14, { size: 7, font: bold, color: MUTED, align: 'right' });
    page.drawLine({
      start: { x: MARGIN, y: topY - TABLE_HEAD_H },
      end: { x: MARGIN + CONTENT_W, y: topY - TABLE_HEAD_H },
      thickness: 0.75,
      color: BORDER
    });
  };

  const drawRow = (page, topY, item) => {
    const row = item.row;
    const barX = TABLE_COLS.performance.x;
    const barW = TABLE_COLS.performance.w;
    const barH = 8;
    const midY = topY - item.mid;
    const barY = midY + barH / 2;

    item.roundLines.forEach((line, i) => {
      drawText(page, line, TABLE_COLS.round.x, topY - 16 - i * 11, { size: 10, font: bold, color: NAVY, maxWidth: TABLE_COLS.round.w - 12 });
    });

    drawRoundRect(page, barX, barY, barW, barH, barH / 2, TRACK);
    const scoreNum = row.score == null || row.score === '' ? null : num(row.score);
    const maxNum = Math.max(0, num(row.max));
    if (scoreNum != null && maxNum > 0) {
      const frac = Math.min(Math.max(scoreNum / maxNum, 0), 1);
      if (frac > 0) drawRoundRect(page, barX, barY, Math.max(barH, barW * frac), barH, barH / 2, TEAL);
    }

    drawText(page, scoreNum == null ? '-' : formatScore(scoreNum), TABLE_COLS.score.x, midY + 5, { size: 13, font: bold, color: NAVY, align: 'right' });
    const maxLabel = row.max == null || row.max === '' ? '-' : formatScore(maxNum);
    drawText(page, `of ${maxLabel}`, TABLE_COLS.score.x, midY - 9, { size: 7.5, color: MUTED, align: 'right' });

    page.drawLine({
      start: { x: MARGIN, y: topY - item.h },
      end: { x: MARGIN + CONTENT_W, y: topY - item.h },
      thickness: 0.5,
      color: LINE
    });
  };

  const drawFooter = (page) => {
    drawText(page, `AVENTO - Smart Campus Event Management  |  Report generated ${generatedAt}`, PAGE_W / 2, 48, { size: 7.5, color: MUTED, align: 'center' });
    drawText(page, 'This is a computer generated report.', PAGE_W / 2, 36, { size: 6.5, color: MUTED, align: 'center' });
  };

  const firstRowTop = TABLE_TOP - TABLE_HEAD_H;
  const contTableTop = PAGE_H - 84;
  const contRowTop = contTableTop - TABLE_HEAD_H;
  const nameLineH = 11;
  const rowItems = safeRows.map(row => {
    const roundLines = wrapText(bold, String(row.roundName == null ? '' : row.roundName), 10, TABLE_COLS.round.w - 12);
    const extraNameLines = Math.max(roundLines.length - 1, 0);
    const textBottom = 16 + extraNameLines * nameLineH + 3;
    const mid = (9 + Math.max(31, textBottom)) / 2;
    return { row, roundLines, mid, h: ROW_H + extraNameLines * nameLineH };
  });

  const chunks = [];
  let remaining = rowItems.slice();
  let avail = firstRowTop - ROW_FLOOR;
  while (remaining.length > 0) {
    const chunk = [];
    let used = 0;
    while (remaining.length > 0) {
      const item = remaining[0];
      if (chunk.length > 0 && used + item.h > avail) break;
      chunk.push(item);
      used += item.h;
      remaining = remaining.slice(1);
    }
    chunks.push(chunk);
    avail = contRowTop - ROW_FLOOR;
  }
  if (chunks.length === 0) chunks.push([]);

  const pages = [];
  let lastRowsBottom = firstRowTop;
  chunks.forEach((chunk, chunkIdx) => {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let y;
    if (chunkIdx === 0) {
      drawFullHeader(page);
      drawTitleBlock(page);
      drawInfoCard(page);
      drawTotalCard(page);
      drawText(page, 'Score breakdown', MARGIN, PAGE_H - 430, { size: 13, font: bold, color: NAVY });
      drawTableHeader(page, TABLE_TOP);
      y = firstRowTop;
    } else {
      drawContinuationHeader(page);
      drawTableHeader(page, contTableTop);
      y = contRowTop;
    }
    chunk.forEach(item => {
      drawRow(page, y, item);
      y -= item.h;
    });
    lastRowsBottom = y;
    drawFooter(page);
  });

  const commentText = String(comment == null ? '' : comment).trim();
  const critComments = (Array.isArray(criterionComments) ? criterionComments : [])
    .filter(cc => cc && String(cc.comment || '').trim());
  const commentWidth = CONTENT_W - 36;
  const commentLines = [];
  if (commentText) {
    wrapText(regular, commentText, 9.5, commentWidth).forEach(line => commentLines.push({ text: line, bold: false }));
  }
  critComments.forEach(cc => {
    wrapText(bold, String(cc.name || 'Criterion'), 9, commentWidth).forEach(line => commentLines.push({ text: line, bold: true }));
    wrapText(regular, String(cc.comment), 9.5, commentWidth).forEach(line => commentLines.push({ text: line, bold: false }));
  });
  if (commentLines.length > 0) {
    const commentLineH = 14;
    const commentHeadH = 30;
    const commentH = commentHeadH + (Math.max(1, commentLines.length) - 1) * commentLineH + 19;

    const drawComment = (page, topY) => {
      drawRoundRect(page, MARGIN, topY, CONTENT_W, commentH, 10, CARD_BG, BORDER, 1);
      drawText(page, 'EVALUATOR COMMENTS', MARGIN + 18, topY - 18, { size: 7.5, font: bold, color: MUTED });
      commentLines.forEach((entry, i) => {
        drawText(page, entry.text, MARGIN + 18, topY - commentHeadH - i * commentLineH, {
          size: 9.5,
          font: entry.bold ? bold : regular,
          color: entry.bold ? TEAL_TEXT : NAVY,
          maxWidth: commentWidth
        });
      });
    };

    const rowsBottom = lastRowsBottom;
    if (rowsBottom - 14 - commentH >= 72) {
      drawComment(pages[pages.length - 1], rowsBottom - 14);
    } else {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      drawContinuationHeader(page);
      drawComment(page, PAGE_H - 84);
      drawFooter(page);
      pages.push(page);
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
};

module.exports = { buildScoreReportPdf };
