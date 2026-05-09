/**
 * AIWholesail PDF brand system (pdfkit / backend).
 *
 * Mirrors src/lib/pdf-brand.ts for the frontend; same visual identity
 * across every export PDF (contracts, utility reports, future buyer
 * pitch decks, lender packets, etc.).
 */

// ============================================================================
// COLORS (hex strings — pdfkit's preferred input)
// ============================================================================

const COLORS = {
  cyan: '#06b6d4',
  cyanDark: '#0891b2',
  cyanLight: '#22d3ee',
  ink: '#0a0a0b',
  text: '#262626',
  muted: '#737373',
  divider: '#e4e4e4',
  paper: '#fafafa',
  white: '#ffffff',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

// Tier theme — keep in sync with src/lib/pdf-brand.ts TIER_COLORS
const TIER_COLORS = {
  excellent: COLORS.green,
  great: COLORS.green,
  good: COLORS.cyan,
  fair: COLORS.amber,
  poor: COLORS.muted,
};

// ============================================================================
// PAGE GEOMETRY
// ============================================================================

const PAGE = {
  // Letter portrait (default for backend contracts/reports)
  WIDTH: 612,    // 8.5" × 72pt
  HEIGHT: 792,   // 11"  × 72pt
  MARGIN: 60,
  HEADER_H: 80,  // top region reserved for branded header
  FOOTER_H: 50,  // bottom region reserved for footer
};

// ============================================================================
// FORMATTERS
// ============================================================================

function formatCurrency(value) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function humanize(raw) {
  if (!raw) return '—';
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}

// ============================================================================
// HEADER (top of every page) — gradient bar + wordmark + subtitle
// ============================================================================

function drawPageHeader(doc, opts = {}) {
  const subtitle = opts.subtitle || '';
  const date = opts.date || formatDate(new Date().toISOString());
  const W = doc.page.width;

  // Top gradient bar (3 segments to fake a gradient)
  const barH = 6;
  const segW = W / 3;
  doc.save();
  doc.rect(0, 0, segW, barH).fillColor(COLORS.cyan).fill();
  doc.rect(segW, 0, segW, barH).fillColor(COLORS.cyanDark).fill();
  doc.rect(segW * 2, 0, segW, barH).fillColor(COLORS.cyan).fill();
  doc.restore();

  // Wordmark
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.ink)
    .text('AIWholesail', PAGE.MARGIN, 22, { lineBreak: false });

  // Accent dot after wordmark
  const wordWidth = doc.widthOfString('AIWholesail');
  doc
    .save()
    .fillColor(COLORS.cyan)
    .circle(PAGE.MARGIN + wordWidth + 6, 28, 2.5)
    .fill()
    .restore();

  // Right side: subtitle + date
  if (subtitle) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(subtitle, W - PAGE.MARGIN - 200, 22, {
        width: 200,
        align: 'right',
        lineBreak: false,
      });
  }

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(date, W - PAGE.MARGIN - 200, 38, {
      width: 200,
      align: 'right',
      lineBreak: false,
    });

  // Hairline below header
  doc
    .moveTo(PAGE.MARGIN, 56)
    .lineTo(W - PAGE.MARGIN, 56)
    .lineWidth(0.5)
    .strokeColor(COLORS.divider)
    .stroke();

  // Move pdfkit cursor below header
  doc.y = 74;
  doc.x = PAGE.MARGIN;
}

// ============================================================================
// SECTION HEADER (within page) — small cyan bar + uppercase title
// ============================================================================

function drawSectionHeader(doc, title) {
  const W = doc.page.width;
  const startY = doc.y;

  doc.save();
  // Cyan accent bar
  doc.rect(PAGE.MARGIN, startY, 3, 12).fillColor(COLORS.cyan).fill();
  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.ink)
    .text(title.toUpperCase(), PAGE.MARGIN + 8, startY + 1.5, { lineBreak: false });

  // Trailing divider
  const titleWidth = doc.widthOfString(title.toUpperCase());
  const lineX = PAGE.MARGIN + 8 + titleWidth + 8;
  if (lineX < W - PAGE.MARGIN) {
    doc
      .moveTo(lineX, startY + 7)
      .lineTo(W - PAGE.MARGIN, startY + 7)
      .lineWidth(0.5)
      .strokeColor(COLORS.divider)
      .stroke();
  }
  doc.restore();

  // Advance cursor past section header
  doc.y = startY + 18;
  doc.x = PAGE.MARGIN;
}

// ============================================================================
// METRIC ROW (label : value with optional emphasis)
// ============================================================================

function drawMetricRow(doc, label, value, opts = {}) {
  const W = doc.page.width;
  const y = doc.y;

  doc.save();
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(label, PAGE.MARGIN, y, { lineBreak: false, width: 300 });

  doc
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(10)
    .fillColor(opts.valueColor || COLORS.ink)
    .text(value, W - PAGE.MARGIN - 220, y, {
      width: 220,
      align: 'right',
      lineBreak: false,
    });

  // Hairline divider
  doc
    .moveTo(PAGE.MARGIN, y + 13)
    .lineTo(W - PAGE.MARGIN, y + 13)
    .lineWidth(0.3)
    .strokeColor(COLORS.divider)
    .stroke();
  doc.restore();

  doc.y = y + 18;
  doc.x = PAGE.MARGIN;
}

// ============================================================================
// CALLOUT BOX (light tint background, accent left bar, optional title)
// ============================================================================

function drawCallout(doc, text, opts = {}) {
  const W = doc.page.width;
  const tone = opts.tone || 'cyan';
  const accent =
    tone === 'amber' ? COLORS.amber :
    tone === 'green' ? COLORS.green :
    tone === 'red'   ? COLORS.red   :
    COLORS.cyan;

  const x = PAGE.MARGIN;
  const w = W - PAGE.MARGIN * 2;
  const padX = 14;
  const padY = 12;
  const startY = doc.y;

  // Measure text height first
  const textW = w - padX * 2;
  const titleH = opts.title ? 16 : 0;
  doc.font('Helvetica').fontSize(10);
  const textH = doc.heightOfString(text, { width: textW });
  const totalH = padY + titleH + textH + padY;

  // Background tint (6% opacity of accent)
  doc.save().opacity(0.06).rect(x, startY, w, totalH).fillColor(accent).fill().restore();

  // Left accent bar
  doc.save().rect(x, startY, 3, totalH).fillColor(accent).fill().restore();

  // Title
  let cursorY = startY + padY;
  if (opts.title) {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(accent)
      .text(opts.title, x + padX, cursorY, { lineBreak: false });
    cursorY += titleH;
  }

  // Body
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(text, x + padX, cursorY, { width: textW, align: 'left' });

  doc.y = startY + totalH + 8;
  doc.x = PAGE.MARGIN;
}

// ============================================================================
// FOOTER (paint on all pages — call at the end)
// ============================================================================

function drawFooter(doc, opts = {}) {
  const date = opts.date || formatDate(new Date().toISOString());
  const tagline = opts.tagline || 'AI-powered real estate deal analysis';
  const W = doc.page.width;
  const H = doc.page.height;

  // BufferedPageRange may not be available — pdfkit only supports footers on
  // each page when called per page. We use the page-range API to iterate.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Hairline above footer
    doc
      .save()
      .moveTo(PAGE.MARGIN, H - 40)
      .lineTo(W - PAGE.MARGIN, H - 40)
      .lineWidth(0.5)
      .strokeColor(COLORS.divider)
      .stroke()
      .restore();

    // Cyan accent dot
    doc.save().fillColor(COLORS.cyan).circle(PAGE.MARGIN, H - 28, 2).fill().restore();

    // Brand
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLORS.ink)
      .text('aiwholesail.com', PAGE.MARGIN + 7, H - 31, { lineBreak: false, width: 120 });

    // Tagline (centered)
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`${tagline} · ${date}`, PAGE.MARGIN, H - 31, {
        width: W - PAGE.MARGIN * 2,
        align: 'center',
        lineBreak: false,
      });

    // Page number
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`${i + 1} / ${range.count}`, W - PAGE.MARGIN - 80, H - 31, {
        width: 80,
        align: 'right',
        lineBreak: false,
      });
  }
}

// ============================================================================
// STANDARD DISCLAIMER
// ============================================================================

const STANDARD_DISCLAIMER =
  'This document is for informational purposes only and does not constitute financial, legal, or investment advice. ' +
  'All figures are estimates based on available data and may not reflect actual market conditions. ' +
  'Always consult a licensed attorney and conduct independent due diligence before executing any agreement.';

function drawDisclaimer(doc) {
  drawCallout(doc, STANDARD_DISCLAIMER, { title: 'Disclaimer', tone: 'amber' });
}

module.exports = {
  COLORS,
  TIER_COLORS,
  PAGE,
  formatCurrency,
  formatNumber,
  formatDate,
  humanize,
  drawPageHeader,
  drawSectionHeader,
  drawMetricRow,
  drawCallout,
  drawFooter,
  drawDisclaimer,
  STANDARD_DISCLAIMER,
};
