const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const NAVY = rgb(0.075, 0.188, 0.247);
const SLATE = rgb(0.392, 0.455, 0.545);
const MUTED = rgb(0.58, 0.639, 0.722);
const CYAN = rgb(0.024, 0.714, 0.831);
const CYAN_DARK = rgb(0.031, 0.569, 0.698);
const HEADER_BG = rgb(0.902, 0.957, 0.969);
const HEADER_BLOB = rgb(0.78, 0.91, 0.898);
const ACCENT = rgb(0.129, 0.816, 0.851);
const CARD_BG = rgb(0.969, 0.98, 0.988);
const BORDER = rgb(0.886, 0.91, 0.941);
const TRACK = rgb(0.855, 0.898, 0.918);
const LINE = rgb(0.929, 0.949, 0.965);
const WHITE = rgb(1, 1, 1);

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

const gradeOf = (pct) => {
  const p = Number(pct) || 0;
  if (p >= 90) return 'O';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  return 'F';
};

const buildScoreAnalysisPdf = async ({ event, students, orderedSubs, scores }) => {
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

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

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

  const drawFullHeader = (page) => {
    page.drawRectangle({ x: 0, y: PAGE_H - 112, width: PAGE_W, height: 112, color: HEADER_BG });
    page.drawCircle({ x: PAGE_W - 62, y: PAGE_H - 12, size: 96, color: HEADER_BLOB });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H - 112, color: WHITE });
    page.drawRectangle({ x: 0, y: PAGE_H - 114.5, width: PAGE_W, height: 2.5, color: ACCENT });

    drawLogo(page, 44, PAGE_H - 92, 68, 68, 2);
    drawText(page, 'AVENTO', 126, PAGE_H - 58, { size: 26, font: bold, color: NAVY });
    drawText(page, 'SMART CAMPUS EVENT MANAGEMENT', 127, PAGE_H - 73, { size: 7, color: SLATE });
    drawText(page, 'SCORE ANALYSIS', PAGE_W - 40, PAGE_H - 54, { size: 14, font: bold, color: CYAN_DARK, align: 'right' });
    drawText(page, 'Evaluation Performance Report', PAGE_W - 40, PAGE_H - 70, { size: 8.5, color: SLATE, align: 'right' });
  };

  const drawContinuationHeader = (page) => {
    page.drawRectangle({ x: 0, y: PAGE_H - 54, width: PAGE_W, height: 54, color: HEADER_BG });
    page.drawCircle({ x: PAGE_W - 30, y: PAGE_H - 6, size: 56, color: HEADER_BLOB });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H - 54, color: WHITE });
    page.drawRectangle({ x: 0, y: PAGE_H - 56.5, width: PAGE_W, height: 2.5, color: ACCENT });

    drawLogo(page, 40, PAGE_H - 45, 34, 34, 1);
    drawText(page, 'AVENTO', 82, PAGE_H - 34, { size: 13, font: bold, color: NAVY });
    drawText(page, `${event.title || 'Event'} - Score Analysis (continued)`, PAGE_W - 40, PAGE_H - 33, { size: 8.5, color: SLATE, align: 'right' });
  };

  const drawFooter = (page) => {
    drawText(page, `AVENTO - Smart Campus Event Management  |  Analysis generated ${generatedAt}`, PAGE_W / 2, 48, { size: 7.5, color: MUTED, align: 'center' });
    drawText(page, 'This is a computer generated report.', PAGE_W / 2, 36, { size: 6.5, color: MUTED, align: 'center' });
  };

  // ---------------- stats ----------------
  const maxTotal = orderedSubs.reduce((sum, sub) => sum + Math.max(0, Number(sub.max) || 0), 0);
  const scoreMap = new Map();
  (scores || []).forEach(s => {
    if (s && s.registration_id && s.subround_id && s.score != null) {
      scoreMap.set(`${s.registration_id}:${s.subround_id}`, Number(s.score) || 0);
    }
  });
  const scoredIds = new Set((scores || []).map(s => s.registration_id));

  const perStudent = (students || [])
    .filter(st => scoredIds.has(st.registration_id))
    .map(st => {
      const total = orderedSubs.reduce((sum, sub) => sum + (scoreMap.get(`${st.registration_id}:${sub.id}`) || 0), 0);
      return { ...st, total, pct: maxTotal > 0 ? (total / maxTotal) * 100 : 0 };
    })
    .sort((a, b) => (b.total - a.total) || String(a.name || '').localeCompare(String(b.name || '')));

  let currentRank = 0;
  perStudent.forEach((st, idx) => {
    if (idx === 0 || st.total !== perStudent[idx - 1].total) currentRank = idx + 1;
    st.rank = currentRank;
  });

  const totals = perStudent.map(st => st.total);
  const count = totals.length;
  const mean = count ? totals.reduce((a, b) => a + b, 0) / count : 0;
  const sortedTotals = [...totals].sort((a, b) => a - b);
  const median = count ? (count % 2 ? sortedTotals[(count - 1) / 2] : (sortedTotals[count / 2 - 1] + sortedTotals[count / 2]) / 2) : 0;
  const stdDev = count ? Math.sqrt(totals.reduce((sum, t) => sum + (t - mean) ** 2, 0) / count) : 0;
  const highest = count ? Math.max(...totals) : 0;
  const lowest = count ? Math.min(...totals) : 0;
  const avgPct = maxTotal > 0 ? (mean / maxTotal) * 100 : 0;

  const perCriterion = orderedSubs.map(sub => {
    const values = perStudent
      .map(st => scoreMap.get(`${st.registration_id}:${sub.id}`))
      .filter(v => v != null);
    const subAvg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return {
      ...sub,
      count: values.length,
      avg: subAvg,
      high: values.length ? Math.max(...values) : null,
      low: values.length ? Math.min(...values) : null,
      avgPct: Number(sub.max) > 0 ? (subAvg / Number(sub.max)) * 100 : 0
    };
  });

  const bandDefs = [
    { label: 'O - 90 to 100%', min: 90, max: 101 },
    { label: 'A - 80 to 89%', min: 80, max: 90 },
    { label: 'B - 70 to 79%', min: 70, max: 80 },
    { label: 'C - 60 to 69%', min: 60, max: 70 },
    { label: 'D - 50 to 59%', min: 50, max: 60 },
    { label: 'F - below 50%', min: -1, max: 50 }
  ];
  const gradeBands = bandDefs.map(band => {
    const members = perStudent.filter(st => st.pct >= band.min && st.pct < band.max);
    return { ...band, count: members.length, share: count ? (members.length / count) * 100 : 0 };
  });

  const groupBy = (keyFn) => {
    const groups = new Map();
    perStudent.forEach(st => {
      const key = keyFn(st);
      if (!key) return;
      const list = groups.get(key) || [];
      list.push(st);
      groups.set(key, list);
    });
    return [...groups.entries()]
      .map(([name, list]) => ({
        name,
        count: list.length,
        avg: list.reduce((sum, st) => sum + st.total, 0) / list.length,
        avgPct: list.reduce((sum, st) => sum + st.pct, 0) / list.length
      }))
      .sort((a, b) => b.avg - a.avg);
  };
  const panelGroups = groupBy(st => String(st.panel_name || '').trim());
  const deptGroups = groupBy(st => String(st.department || '').trim());
  const topPerformers = perStudent.slice(0, 5);

  // ---------------- flow layout ----------------
  let page = null;
  let y = 0;

  const newPage = (continued) => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    if (continued) {
      drawContinuationHeader(page);
      y = PAGE_H - 84;
    } else {
      drawFullHeader(page);
      y = PAGE_H - 150;
    }
    drawFooter(page);
  };

  const ensureSpace = (h) => {
    if (y - h < 72) newPage(true);
  };

  const sectionTitle = (title, subtitle) => {
    ensureSpace(subtitle ? 48 : 34);
    drawText(page, title, MARGIN, y - 14, { size: 13, font: bold, color: NAVY });
    if (subtitle) {
      drawText(page, subtitle, MARGIN, y - 30, { size: 8.5, color: SLATE, maxWidth: CONTENT_W });
      y -= 48;
    } else {
      y -= 34;
    }
  };

  // ---------------- page 1 ----------------
  newPage(false);
  drawText(page, event.title || 'Event', MARGIN, y - 16, { size: 20, font: bold, color: NAVY, maxWidth: CONTENT_W });
  drawText(page, `Evaluation analysis across ${count} scored student${count === 1 ? '' : 's'} and ${orderedSubs.length} criteria`, MARGIN, y - 34, { size: 9.5, color: SLATE, maxWidth: CONTENT_W });
  y -= 56;

  sectionTitle('Overall Summary');
  const cards = [
    { label: 'PARTICIPANTS', value: String(count) },
    { label: 'AVERAGE SCORE', value: `${formatScore(mean)} / ${formatScore(maxTotal)}` },
    { label: 'HIGHEST SCORE', value: formatScore(highest) },
    { label: 'LOWEST SCORE', value: formatScore(lowest) }
  ];
  const cardGap = 12;
  const cardW = (CONTENT_W - cardGap * (cards.length - 1)) / cards.length;
  const cardH = 78;
  ensureSpace(cardH + 10);
  cards.forEach((card, idx) => {
    const x = MARGIN + idx * (cardW + cardGap);
    drawRoundRect(page, x, y, cardW, cardH, 10, CARD_BG, BORDER, 1);
    drawText(page, card.label, x + 14, y - 22, { size: 6.5, font: bold, color: MUTED });
    drawText(page, card.value, x + 14, y - 50, { size: 15, font: bold, color: CYAN_DARK, maxWidth: cardW - 28 });
  });
  y -= cardH + 16;

  const statsLine = `Mean: ${formatScore(mean)}   |   Median: ${formatScore(median)}   |   Std Dev: ${formatScore(stdDev)}   |   Average: ${formatScore(avgPct)}% of ${formatScore(maxTotal)} marks`;
  ensureSpace(20);
  drawText(page, statsLine, MARGIN, y - 8, { size: 8.5, color: SLATE, maxWidth: CONTENT_W });
  y -= 30;

  sectionTitle('Grade Distribution', 'Student performance grouped by percentage of total marks.');
  const bandH = 26;
  gradeBands.forEach(band => {
    ensureSpace(bandH + 6);
    drawText(page, band.label, MARGIN, y - 14, { size: 9, font: bold, color: NAVY, maxWidth: 110 });
    const barX = MARGIN + 120;
    const barW = CONTENT_W - 120 - 110;
    const barY = y - 6.5;
    drawRoundRect(page, barX, barY, barW, 9, 4.5, TRACK);
    const frac = count ? band.count / count : 0;
    if (frac > 0) drawRoundRect(page, barX, barY, Math.max(9, barW * frac), 9, 4.5, CYAN);
    drawText(page, `${band.count} student${band.count === 1 ? '' : 's'} (${formatScore(band.share)}%)`, MARGIN + CONTENT_W, y - 14, { size: 8.5, color: SLATE, align: 'right' });
    y -= bandH;
  });
  y -= 12;

  sectionTitle('Criterion-wise Performance', 'Average, highest and lowest score per scoring criterion.');
  const critCols = { name: MARGIN, max: MARGIN + 225, avg: MARGIN + 295, high: MARGIN + 365, low: MARGIN + 430, pct: MARGIN + CONTENT_W };
  ensureSpace(26);
  drawText(page, 'CRITERION', critCols.name, y - 12, { size: 7, font: bold, color: MUTED });
  drawText(page, 'MAX', critCols.max, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  drawText(page, 'AVG', critCols.avg, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  drawText(page, 'HIGH', critCols.high, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  drawText(page, 'LOW', critCols.low, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  drawText(page, 'AVG %', critCols.pct, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  y -= 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: BORDER });

  perCriterion.forEach(crit => {
    ensureSpace(28);
    y -= 16;
    drawText(page, `${crit.roundName} - ${crit.name}`, critCols.name, y, { size: 9, font: bold, color: NAVY, maxWidth: 215 });
    drawText(page, formatScore(crit.max), critCols.max, y, { size: 9, color: SLATE, align: 'right' });
    drawText(page, formatScore(crit.avg), critCols.avg, y, { size: 9, font: bold, color: CYAN_DARK, align: 'right' });
    drawText(page, crit.high == null ? '-' : formatScore(crit.high), critCols.high, y, { size: 9, color: SLATE, align: 'right' });
    drawText(page, crit.low == null ? '-' : formatScore(crit.low), critCols.low, y, { size: 9, color: SLATE, align: 'right' });
    drawText(page, `${formatScore(crit.avgPct)}%`, critCols.pct, y, { size: 9, font: bold, color: CYAN_DARK, align: 'right' });
    y -= 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: LINE });
    y -= 2;
  });
  y -= 14;

  const groupSection = (title, subtitle, groups) => {
    if (groups.length === 0) return;
    sectionTitle(title, subtitle);
    ensureSpace(26);
    drawText(page, title.toUpperCase().split(' ')[0], MARGIN, y - 12, { size: 7, font: bold, color: MUTED });
    drawText(page, 'STUDENTS', MARGIN + 300, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
    drawText(page, 'AVG TOTAL', MARGIN + 400, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
    drawText(page, 'AVG %', MARGIN + CONTENT_W, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
    y -= 18;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: BORDER });
    groups.forEach(group => {
      ensureSpace(26);
      y -= 16;
      drawText(page, group.name, MARGIN, y, { size: 9, font: bold, color: NAVY, maxWidth: 285 });
      drawText(page, String(group.count), MARGIN + 300, y, { size: 9, color: SLATE, align: 'right' });
      drawText(page, formatScore(group.avg), MARGIN + 400, y, { size: 9, font: bold, color: CYAN_DARK, align: 'right' });
      drawText(page, `${formatScore(group.avgPct)}%`, MARGIN + CONTENT_W, y, { size: 9, color: SLATE, align: 'right' });
      y -= 10;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: LINE });
      y -= 2;
    });
    y -= 14;
  };

  groupSection('Panel-wise Performance', 'Average total and percentage per evaluation panel.', panelGroups);
  groupSection('Department-wise Performance', 'Average total and percentage per department.', deptGroups);

  if (topPerformers.length > 0) {
    sectionTitle('Top Performers', 'Highest scoring students in this event.');
    topPerformers.forEach((st, idx) => {
      ensureSpace(40);
      const rowH = 34;
      drawRoundRect(page, MARGIN, y, CONTENT_W, rowH, 8, idx === 0 ? HEADER_BG : CARD_BG, BORDER, 1);
      page.drawCircle({ x: MARGIN + 20, y: y - rowH / 2, size: 11, color: idx === 0 ? CYAN : TRACK });
      drawText(page, `#${st.rank}`, MARGIN + 20, y - rowH / 2 - 3, { size: 8, font: bold, color: idx === 0 ? WHITE : NAVY, align: 'center' });
      drawText(page, st.name || 'Unknown Student', MARGIN + 42, y - 14, { size: 10, font: bold, color: NAVY, maxWidth: 280 });
      if (st.roll_number) drawText(page, st.roll_number, MARGIN + 42, y - 26, { size: 7.5, color: MUTED, maxWidth: 280 });
      drawText(page, `${formatScore(st.total)} pts`, MARGIN + CONTENT_W - 100, y - 20, { size: 10, font: bold, color: CYAN_DARK, align: 'right' });
      drawText(page, `${formatScore(st.pct)}%`, MARGIN + CONTENT_W - 12, y - 20, { size: 10, font: bold, color: NAVY, align: 'right' });
      y -= rowH + 8;
    });
    y -= 10;
  }

  sectionTitle('Student Performance', 'Complete per-student breakdown ranked by total score.');
  const cols = { rank: MARGIN, student: MARGIN + 40, panel: MARGIN + 245, total: MARGIN + 375, pct: MARGIN + 445, grade: MARGIN + CONTENT_W };
  ensureSpace(30);
  drawText(page, 'RANK', cols.rank, y - 12, { size: 7, font: bold, color: MUTED });
  drawText(page, 'STUDENT', cols.student, y - 12, { size: 7, font: bold, color: MUTED });
  drawText(page, 'PANEL', cols.panel, y - 12, { size: 7, font: bold, color: MUTED });
  drawText(page, 'TOTAL', cols.total, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  drawText(page, 'PERCENTAGE', cols.pct, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  drawText(page, 'GRADE', cols.grade, y - 12, { size: 7, font: bold, color: MUTED, align: 'right' });
  y -= 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: BORDER });

  perStudent.forEach(st => {
    ensureSpace(30);
    y -= 17;
    drawText(page, `#${st.rank}`, cols.rank, y, { size: 9, font: bold, color: MUTED });
    drawText(page, st.name || 'Unknown Student', cols.student, y, { size: 9.5, font: bold, color: NAVY, maxWidth: 135 });
    if (st.roll_number) drawText(page, st.roll_number, cols.student + 140, y, { size: 8, color: MUTED, maxWidth: 60 });
    drawText(page, st.panel_name || '-', cols.panel, y, { size: 8.5, color: SLATE, maxWidth: 115 });
    drawText(page, formatScore(st.total), cols.total, y, { size: 10, font: bold, color: NAVY, align: 'right' });
    drawText(page, `${formatScore(st.pct)}%`, cols.pct, y, { size: 9, color: SLATE, align: 'right' });
    drawText(page, gradeOf(st.pct), cols.grade, y, { size: 10, font: bold, color: CYAN_DARK, align: 'right' });
    y -= 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: LINE });
    y -= 2;
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
};

module.exports = { buildScoreAnalysisPdf };
