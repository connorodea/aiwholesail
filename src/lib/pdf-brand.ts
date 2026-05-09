/**
 * AIWholesail PDF brand system (jsPDF / frontend).
 *
 * Centralizes colors, fonts, layout primitives, and branded section helpers
 * so every export PDF (DealReport, PropertyComparison, future buyer-pitch
 * deck, future contract drafts, etc.) shares the same visual identity.
 *
 * Aesthetic mirrors the AIWholesail web app:
 *   - White / off-white paper for printability
 *   - Cyan primary accent (#06b6d4) for headers, dividers, key data
 *   - Dark slate headings (matches the app's foreground on dark UI)
 *   - Muted neutrals for body and dividers
 *   - Gradient cyan bar at the top of every page (page header)
 *   - Tier-aware badges (Excellent/Great/Good/Fair/Poor) with consistent colors
 */

import jsPDF from 'jspdf';

// ============================================================================
// COLORS (RGB tuples — jsPDF API)
// ============================================================================

export const BRAND_CYAN: [number, number, number] = [6, 182, 212];      // #06b6d4
export const BRAND_CYAN_DARK: [number, number, number] = [8, 145, 178];  // #0891b2
export const BRAND_CYAN_LIGHT: [number, number, number] = [34, 211, 238]; // #22d3ee
export const BRAND_INK: [number, number, number] = [10, 10, 11];          // near-black headings
export const BRAND_TEXT: [number, number, number] = [38, 38, 38];         // body
export const BRAND_MUTED: [number, number, number] = [115, 115, 115];     // secondary
export const BRAND_DIVIDER: [number, number, number] = [228, 228, 228];   // light divider
export const BRAND_PAPER: [number, number, number] = [250, 250, 250];     // off-white card backgrounds
export const WHITE: [number, number, number] = [255, 255, 255];

// Tier colors — match the app's tier theming
export const TIER_COLORS: Record<string, [number, number, number]> = {
  excellent: [16, 185, 129],   // emerald
  great: [16, 185, 129],
  good: [6, 182, 212],         // cyan (brand)
  fair: [245, 158, 11],        // amber
  poor: [115, 115, 115],       // neutral
};

export const SUCCESS_GREEN: [number, number, number] = [16, 185, 129];
export const WARNING_AMBER: [number, number, number] = [245, 158, 11];
export const DANGER_RED: [number, number, number] = [239, 68, 68];

// ============================================================================
// PAGE GEOMETRY
// ============================================================================

export const PAGE = {
  // A4 portrait
  WIDTH_A4: 210,
  HEIGHT_A4: 297,
  // Letter (US backend)
  WIDTH_LETTER: 215.9,
  HEIGHT_LETTER: 279.4,
  // Standard margins
  MARGIN_X: 20,
  MARGIN_TOP: 50,    // below page header
  MARGIN_BOTTOM: 22, // above page footer
};

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatCurrency(value: number | undefined | null, options?: { compact?: boolean }): string {
  if (value == null || isNaN(value)) return '—';
  if (options?.compact && Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (options?.compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

// Convert backend enum strings to readable form ("FOR_SALE" → "For Sale")
export function humanize(raw?: string | null): string {
  if (!raw) return '—';
  return raw
    .toString()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}

// ============================================================================
// PAGE HEADER (top of every page)
//
// Layout:
//   ┌───────────────────────────────────────────────────────────────────┐
//   │ [cyan gradient bar — 4mm tall, 100% width]                        │
//   │                                                                   │
//   │   AIWholesail                              <subtitle right-align> │
//   │   ────────────────                                  <date>        │
//   │                                                                   │
//   └───────────────────────────────────────────────────────────────────┘
// ============================================================================

export function drawPageHeader(
  doc: jsPDF,
  opts: { subtitle?: string; date?: string; pageWidth?: number } = {}
): void {
  const W = opts.pageWidth ?? PAGE.WIDTH_A4;
  const subtitle = opts.subtitle ?? '';
  const date =
    opts.date ??
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // Top gradient bar — simulate via 3 stacked rects (jsPDF has no gradient primitive)
  const barH = 4;
  const segW = W / 3;
  doc.setFillColor(...BRAND_CYAN);
  doc.rect(0, 0, segW, barH, 'F');
  doc.setFillColor(...BRAND_CYAN_DARK);
  doc.rect(segW, 0, segW, barH, 'F');
  doc.setFillColor(...BRAND_CYAN);
  doc.rect(segW * 2, 0, segW, barH, 'F');

  // Wordmark
  doc.setTextColor(...BRAND_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('AIWholesail', PAGE.MARGIN_X, 18);

  // Tiny accent dot after wordmark (matches the dot in the website logo)
  doc.setFillColor(...BRAND_CYAN);
  doc.circle(PAGE.MARGIN_X + 38, 17.4, 0.9, 'F');

  // Subtitle (right side)
  if (subtitle) {
    doc.setTextColor(...BRAND_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(subtitle, W - PAGE.MARGIN_X, 14, { align: 'right' });
  }

  // Date
  doc.setTextColor(...BRAND_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(date, W - PAGE.MARGIN_X, 20, { align: 'right' });

  // Hairline divider below header
  doc.setDrawColor(...BRAND_DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(PAGE.MARGIN_X, 26, W - PAGE.MARGIN_X, 26);
}

// ============================================================================
// SECTION HEADER (within page)
// ============================================================================

export function drawSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  opts: { pageWidth?: number; tone?: 'cyan' | 'ink' } = {}
): number {
  const W = opts.pageWidth ?? PAGE.WIDTH_A4;
  const tone = opts.tone ?? 'cyan';

  // Cyan accent bar (left)
  if (tone === 'cyan') {
    doc.setFillColor(...BRAND_CYAN);
    doc.rect(PAGE.MARGIN_X, y, 3, 6, 'F');
  }

  doc.setTextColor(...BRAND_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), PAGE.MARGIN_X + 6, y + 4.5);

  // Right-aligned divider line trailing the title
  const titleWidth = doc.getTextWidth(title.toUpperCase());
  const lineStart = PAGE.MARGIN_X + 6 + titleWidth + 6;
  const lineEnd = W - PAGE.MARGIN_X;
  if (lineStart < lineEnd) {
    doc.setDrawColor(...BRAND_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(lineStart, y + 4, lineEnd, y + 4);
  }

  doc.setTextColor(...BRAND_INK);
  return y + 11;
}

// ============================================================================
// METRIC ROW (label : value, with optional emphasis)
// ============================================================================

export function drawMetricRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  opts: {
    bold?: boolean;
    valueColor?: [number, number, number];
    pageWidth?: number;
    indent?: number;
  } = {}
): number {
  const W = opts.pageWidth ?? PAGE.WIDTH_A4;
  const x0 = PAGE.MARGIN_X + (opts.indent ?? 0);
  const xRight = W - PAGE.MARGIN_X;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_MUTED);
  doc.text(label, x0, y);

  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setTextColor(...(opts.valueColor || BRAND_INK));
  doc.setFontSize(10);
  doc.text(value, xRight, y, { align: 'right' });

  doc.setDrawColor(...BRAND_DIVIDER);
  doc.setLineWidth(0.2);
  doc.line(x0, y + 2.2, xRight, y + 2.2);

  doc.setTextColor(...BRAND_INK);
  return y + 7;
}

// ============================================================================
// HEADLINE NUMBER (big stat — useful for spread, ARV, profit)
// ============================================================================

export function drawHeadlineNumber(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  opts: { color?: [number, number, number]; pageWidth?: number } = {}
): number {
  const color = opts.color ?? BRAND_CYAN;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_MUTED);
  doc.text(label.toUpperCase(), PAGE.MARGIN_X, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...color);
  doc.text(value, PAGE.MARGIN_X, y + 11);

  doc.setTextColor(...BRAND_INK);
  return y + 17;
}

// ============================================================================
// TIER BADGE (rounded pill)
// ============================================================================

export function drawTierBadge(
  doc: jsPDF,
  tier: string,
  x: number,
  y: number
): { width: number; height: number } {
  const tierKey = tier.toLowerCase();
  const color = TIER_COLORS[tierKey] || BRAND_MUTED;
  const label = `${tier.charAt(0).toUpperCase() + tier.slice(1)} Deal`.toUpperCase();

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  const tw = doc.getTextWidth(label);
  const padX = 3;
  const padY = 1.6;
  const w = tw + padX * 2;
  const h = 4.5 + padY * 2;

  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
  doc.setTextColor(...WHITE);
  doc.text(label, x + padX, y + h / 2 + 1.3);

  doc.setTextColor(...BRAND_INK);
  return { width: w, height: h };
}

// ============================================================================
// CALLOUT BOX (light cyan card with optional title — for highlights/disclaimers)
// ============================================================================

export function drawCallout(
  doc: jsPDF,
  text: string,
  y: number,
  opts: { title?: string; tone?: 'cyan' | 'amber' | 'green' | 'red'; pageWidth?: number } = {}
): number {
  const W = opts.pageWidth ?? PAGE.WIDTH_A4;
  const tone = opts.tone ?? 'cyan';
  const accent =
    tone === 'amber' ? WARNING_AMBER :
    tone === 'green' ? SUCCESS_GREEN :
    tone === 'red'   ? DANGER_RED :
    BRAND_CYAN;

  const x = PAGE.MARGIN_X;
  const w = W - PAGE.MARGIN_X * 2;
  const padX = 5;
  const padY = 4.5;

  // Wrap text to inner width
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, w - padX * 2 - 2);
  const titleH = opts.title ? 5 : 0;
  const h = padY + titleH + lines.length * 4 + padY;

  // Background tint
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.rect(x, y, w, h, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Left accent bar
  doc.setFillColor(...accent);
  doc.rect(x, y, 2, h, 'F');

  // Title
  let lineY = y + padY + 3.5;
  if (opts.title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...accent);
    doc.text(opts.title, x + padX + 2, lineY);
    lineY += 5;
  }

  // Body
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_TEXT);
  for (const line of lines) {
    doc.text(line, x + padX + 2, lineY);
    lineY += 4;
  }

  doc.setTextColor(...BRAND_INK);
  return y + h + 4;
}

// ============================================================================
// PAGE BREAK GUARD
// ============================================================================

export function checkPageBreak(
  doc: jsPDF,
  y: number,
  needed: number,
  pageHeight = PAGE.HEIGHT_A4
): number {
  const safeBottom = pageHeight - PAGE.MARGIN_BOTTOM - 4;
  if (y + needed > safeBottom) {
    doc.addPage();
    drawPageHeader(doc);
    return PAGE.MARGIN_TOP - 14; // re-establish content top after header
  }
  return y;
}

// ============================================================================
// FOOTER (run last, paints on every page)
// ============================================================================

export function drawFooter(
  doc: jsPDF,
  opts: { pageWidth?: number; pageHeight?: number; date?: string } = {}
): void {
  const W = opts.pageWidth ?? PAGE.WIDTH_A4;
  const H = opts.pageHeight ?? PAGE.HEIGHT_A4;
  const date =
    opts.date ??
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Hairline above footer
    doc.setDrawColor(...BRAND_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(PAGE.MARGIN_X, H - 15, W - PAGE.MARGIN_X, H - 15);

    // Bottom cyan accent dot
    doc.setFillColor(...BRAND_CYAN);
    doc.circle(PAGE.MARGIN_X, H - 8, 0.8, 'F');

    // Left: brand
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_INK);
    doc.text('aiwholesail.com', PAGE.MARGIN_X + 2.5, H - 7.4);

    // Center: tagline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND_MUTED);
    doc.text(`AI-powered real estate deal analysis · ${date}`, W / 2, H - 7.4, { align: 'center' });

    // Right: page number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_MUTED);
    doc.text(`${i} / ${total}`, W - PAGE.MARGIN_X, H - 7.4, { align: 'right' });
  }
}

// ============================================================================
// DISCLAIMER (standardized boilerplate)
// ============================================================================

export const STANDARD_DISCLAIMER =
  'This report is for informational purposes only and does not constitute financial, legal, or investment advice. ' +
  'All figures are estimates based on available data (Zillow / Zestimate, MLS feeds, and AI-derived calculations) and may not reflect actual market conditions. ' +
  'Always conduct independent due diligence — including title search, comp verification, and physical inspection — before making investment decisions.';

export function drawDisclaimer(doc: jsPDF, y: number, pageWidth = PAGE.WIDTH_A4): number {
  return drawCallout(doc, STANDARD_DISCLAIMER, y, {
    title: 'Disclaimer',
    tone: 'amber',
    pageWidth,
  });
}

// ============================================================================
// FILENAME HELPER
// ============================================================================

export function safeFilename(parts: string[]): string {
  return parts
    .map(p => (p || '').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 50))
    .filter(Boolean)
    .join('_');
}
