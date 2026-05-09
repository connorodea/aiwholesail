/**
 * Buyer Pitch PDF — single-page deal sheet for assignment buyers.
 *
 * Elite-only feature. Generates a buyer-ready handoff document that
 * answers "should I take this assignment?" in 30 seconds:
 *
 *   - Hero: address + tier badge + 3-up headline numbers (Asking, ARV, Profit)
 *   - Property snapshot (beds/baths/sqft/year/type)
 *   - Deal math (the convincing breakdown — list price → MAO → assignment fee)
 *   - "Why this is a deal" bullet callout
 *   - Wholesaler contact footer (their name + email; phone if profile has one)
 *
 * Uses the AIW PDF brand library so visuals match every other export.
 */

import jsPDF from 'jspdf';
import { Property } from '@/types/zillow';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';
import {
  PAGE,
  BRAND_CYAN,
  BRAND_INK,
  BRAND_MUTED,
  BRAND_DIVIDER,
  BRAND_PAPER,
  SUCCESS_GREEN,
  TIER_COLORS,
  WHITE,
  drawPageHeader,
  drawSectionHeader,
  drawMetricRow,
  drawTierBadge,
  drawCallout,
  drawFooter,
  formatCurrency,
  formatNumber,
  formatPercent,
  humanize,
  safeFilename,
} from '@/lib/pdf-brand';

interface PitchOptions {
  /** Wholesaler name (top of footer). Falls back to user.fullName, then user.email. */
  wholesalerName?: string;
  /** Wholesaler email (right-side of footer). Falls back to user.email. */
  wholesalerEmail?: string;
  /** Optional phone — printed only if provided (from profile.phone_number). */
  wholesalerPhone?: string;
  /** Optional override of the assignment fee (default: 10000). */
  assignmentFee?: number;
  /** Optional override of repair-cost-per-sqft (default: 25). */
  repairPerSqft?: number;
}

export function generateBuyerPitch(property: Property, opts: PitchOptions = {}): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const wholesale = calculateWholesalePotential(property);
  const tierKey = wholesale.tier.toLowerCase();
  const tierColor = TIER_COLORS[tierKey] || BRAND_CYAN;

  const assignmentFee = opts.assignmentFee ?? 10000;
  const repairPerSqft = opts.repairPerSqft ?? 25;

  // Deal math
  const listPrice = property.price || 0;
  const arv = property.zestimate || (listPrice ? Math.round(listPrice * 1.1) : 0);
  const repairs = property.sqft ? Math.round(property.sqft * repairPerSqft) : 0;
  const mao = Math.max(0, Math.round(arv * 0.7 - repairs));
  const askingFromBuyer = Math.max(0, mao); // what buyer pays to take the assignment (= MAO)
  const buyerCostBasis = askingFromBuyer + repairs;
  const sellingCostsAtExit = Math.round(arv * 0.06);
  const buyerNetProfit = arv - buyerCostBasis - sellingCostsAtExit;
  const spread = property.zestimate && listPrice ? property.zestimate - listPrice : null;

  // ── Branded header ────────────────────────────────────────
  drawPageHeader(doc, { subtitle: 'Buyer Deal Sheet', date: reportDate });

  let y = 36;

  // ── Hero ──────────────────────────────────────────────────
  doc.setTextColor(...BRAND_INK);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const addressLines = doc.splitTextToSize(property.address || 'Address Not Available', 170);
  doc.text(addressLines, PAGE.MARGIN_X, y);
  y += addressLines.length * 6 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_MUTED);
  const typeText = humanize(property.propertyType) || 'Property';
  doc.text(typeText, PAGE.MARGIN_X, y + 2);
  const typeWidth = doc.getTextWidth(typeText);
  drawTierBadge(doc, wholesale.tier, PAGE.MARGIN_X + typeWidth + 4, y - 1.5);
  y += 12;

  // ── 3-up headline cards: Asking / ARV / Buyer Profit ──────
  const cardW = (PAGE.WIDTH_A4 - PAGE.MARGIN_X * 2 - 8) / 3;
  const cardH = 26;

  const drawHeadlineCard = (
    x: number,
    label: string,
    value: string,
    color: [number, number, number],
    sub?: string
  ) => {
    // Light tinted background
    doc.setFillColor(color[0], color[1], color[2]);
    (doc as any).setGState(new (doc as any).GState({ opacity: 0.07 }));
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'F');
    (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

    // Top accent bar
    doc.setFillColor(...color);
    doc.rect(x, y, cardW, 1.2, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_MUTED);
    doc.text(label.toUpperCase(), x + 4, y + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...color);
    doc.text(value, x + 4, y + 16);

    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND_MUTED);
      doc.text(sub, x + 4, y + 22);
    }
  };

  drawHeadlineCard(
    PAGE.MARGIN_X,
    'Take it for',
    formatCurrency(askingFromBuyer, { compact: true }),
    BRAND_CYAN,
    'Your assignment cost'
  );
  drawHeadlineCard(
    PAGE.MARGIN_X + cardW + 4,
    'After Repair Value',
    formatCurrency(arv, { compact: true }),
    BRAND_INK,
    `Spread: ${spread != null ? formatCurrency(spread, { compact: true }) : '—'}`
  );
  drawHeadlineCard(
    PAGE.MARGIN_X + (cardW + 4) * 2,
    'Your Net Profit',
    formatCurrency(buyerNetProfit, { compact: true }),
    buyerNetProfit > 0 ? SUCCESS_GREEN : tierColor,
    `Score: ${wholesale.score}/100`
  );
  y += cardH + 6;

  // ── Property snapshot (compact 5-up grid) ────────────────
  y = drawSectionHeader(doc, 'Property Snapshot', y);

  const snapW = (PAGE.WIDTH_A4 - PAGE.MARGIN_X * 2 - 6) / 5;
  const snapH = 14;
  const drawSnap = (x: number, label: string, value: string) => {
    doc.setFillColor(...BRAND_PAPER);
    doc.roundedRect(x, y, snapW, snapH, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND_MUTED);
    doc.text(label.toUpperCase(), x + 3, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_INK);
    doc.text(value, x + 3, y + 11);
  };

  drawSnap(PAGE.MARGIN_X + (snapW + 1.5) * 0, 'Beds', property.bedrooms != null ? String(property.bedrooms) : '—');
  drawSnap(PAGE.MARGIN_X + (snapW + 1.5) * 1, 'Baths', property.bathrooms != null ? String(property.bathrooms) : '—');
  drawSnap(PAGE.MARGIN_X + (snapW + 1.5) * 2, 'Sq Ft', property.sqft ? formatNumber(property.sqft) : '—');
  drawSnap(PAGE.MARGIN_X + (snapW + 1.5) * 3, '$/sqft', property.pricePerSqft ? `$${Math.round(property.pricePerSqft)}` : '—');
  drawSnap(PAGE.MARGIN_X + (snapW + 1.5) * 4, 'Year', property.yearBuilt ? String(property.yearBuilt) : '—');
  y += snapH + 8;

  // ── Deal math (the convincing breakdown) ─────────────────
  y = drawSectionHeader(doc, 'Deal Math', y);

  y = drawMetricRow(doc, 'Original list price', formatCurrency(listPrice), y);
  y = drawMetricRow(doc, 'After-Repair Value (Zestimate)', formatCurrency(arv), y);
  y = drawMetricRow(doc, `Estimated repairs ($${repairPerSqft}/sqft)`, formatCurrency(repairs), y);
  y = drawMetricRow(doc, 'Maximum Allowable Offer (70% rule)', formatCurrency(mao), y, { bold: true });
  y = drawMetricRow(doc, 'Your assignment fee', formatCurrency(assignmentFee), y);
  y = drawMetricRow(doc, 'Buyer cost basis (asking + repairs)', formatCurrency(buyerCostBasis), y, { bold: true });
  y = drawMetricRow(doc, 'Selling costs at exit (~6% of ARV)', formatCurrency(sellingCostsAtExit), y);
  y = drawMetricRow(
    doc,
    'BUYER NET PROFIT',
    formatCurrency(buyerNetProfit),
    y,
    { bold: true, valueColor: buyerNetProfit > 0 ? SUCCESS_GREEN : [239, 68, 68] }
  );
  y += 4;

  // ── Why this is a deal ───────────────────────────────────
  const whyPoints: string[] = [];
  if (spread != null && spread > 30000) {
    whyPoints.push(`+${formatCurrency(spread, { compact: true })} spread vs Zestimate — well above the $30K wholesale threshold.`);
  }
  if (wholesale.score >= 70) {
    whyPoints.push(`AIWholesail deal score ${wholesale.score}/100 — top-tier deal candidate.`);
  }
  if (property.daysOnMarket != null && property.daysOnMarket > 60) {
    whyPoints.push(`${property.daysOnMarket} days on market — likely motivated seller, room to negotiate.`);
  }
  if (property.isFSBO) {
    whyPoints.push(`FSBO listing — direct seller access, no listing-agent friction.`);
  }
  if (buyerNetProfit > 25000) {
    whyPoints.push(`Net buyer profit of ${formatCurrency(buyerNetProfit, { compact: true })} after repairs and selling costs.`);
  }
  if (whyPoints.length === 0) {
    whyPoints.push(`AIWholesail score: ${wholesale.score}/100, ${humanize(wholesale.tier)} tier.`);
  }

  const whyText = whyPoints.map((p) => `• ${p}`).join('\n');
  y = drawCallout(doc, whyText, y, { title: 'Why This Is A Deal', tone: 'green' });

  // ── Risk callout if poor/fair ────────────────────────────
  if (tierKey === 'fair' || tierKey === 'poor') {
    y = drawCallout(
      doc,
      'This deal is on the marginal end of the wholesale-spread threshold. Verify ARV with a desk appraisal and walk the property before pulling the trigger.',
      y,
      { title: 'Verify Before You Commit', tone: 'amber' }
    );
  }

  // ── Wholesaler contact (footer-area card) ───────────────
  y = Math.max(y, PAGE.HEIGHT_A4 - PAGE.MARGIN_BOTTOM - 38);
  doc.setFillColor(...BRAND_INK);
  doc.roundedRect(PAGE.MARGIN_X, y, PAGE.WIDTH_A4 - PAGE.MARGIN_X * 2, 22, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text('PRESENTED BY', PAGE.MARGIN_X + 5, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(opts.wholesalerName || 'Your Wholesaler', PAGE.MARGIN_X + 5, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DIVIDER);
  const contactBits: string[] = [];
  if (opts.wholesalerEmail) contactBits.push(opts.wholesalerEmail);
  if (opts.wholesalerPhone) contactBits.push(opts.wholesalerPhone);
  if (contactBits.length > 0) {
    doc.text(contactBits.join('  ·  '), PAGE.MARGIN_X + 5, y + 19);
  }

  // Right-side CTA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_CYAN);
  doc.text(
    'Reply to lock this assignment',
    PAGE.WIDTH_A4 - PAGE.MARGIN_X - 5,
    y + 12,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DIVIDER);
  doc.text(
    'First serious offer takes it.',
    PAGE.WIDTH_A4 - PAGE.MARGIN_X - 5,
    y + 17,
    { align: 'right' }
  );

  // ── Footer (paints on every page if we ever spill) ──────
  drawFooter(doc, { date: reportDate });

  doc.save(`AIWholesail_Buyer_Pitch_${safeFilename([property.address || 'property'])}.pdf`);
}
