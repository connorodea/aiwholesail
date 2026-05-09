import jsPDF from 'jspdf';
import { Property } from '@/types/zillow';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';
import {
  PAGE,
  BRAND_CYAN,
  BRAND_INK,
  BRAND_MUTED,
  SUCCESS_GREEN,
  DANGER_RED,
  TIER_COLORS,
  drawPageHeader,
  drawSectionHeader,
  drawMetricRow,
  drawHeadlineNumber,
  drawTierBadge,
  drawCallout,
  drawFooter,
  drawDisclaimer,
  checkPageBreak,
  formatCurrency,
  formatNumber,
  formatPercent,
  humanize,
  safeFilename,
} from '@/lib/pdf-brand';

export function generateDealReport(property: Property): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const wholesale = calculateWholesalePotential(property);

  // ── Page header ────────────────────────────────────────────
  drawPageHeader(doc, { subtitle: 'Deal Analysis Report', date: reportDate });

  let y = 36;

  // ── Hero block: address + tier badge + headline price ──────
  doc.setTextColor(...BRAND_INK);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const addressLines = doc.splitTextToSize(property.address || 'Address Not Available', 170);
  doc.text(addressLines, PAGE.MARGIN_X, y);
  y += addressLines.length * 6 + 1;

  // Property type + tier badge inline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_MUTED);
  const typeText = humanize(property.propertyType) || 'Property';
  doc.text(typeText, PAGE.MARGIN_X, y + 2);

  // Tier badge to the right of type text
  const typeWidth = doc.getTextWidth(typeText);
  drawTierBadge(doc, wholesale.tier, PAGE.MARGIN_X + typeWidth + 4, y - 1.5);
  y += 8;

  // Headline price + spread side-by-side
  const spread = (property.zestimate && property.price) ? property.zestimate - property.price : null;
  const tierColor = TIER_COLORS[wholesale.tier] || BRAND_CYAN;

  // Two-column headline: list price (left) + spread (right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_MUTED);
  doc.text('LIST PRICE', PAGE.MARGIN_X, y);
  doc.text('SPREAD VS ZESTIMATE', 110, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_INK);
  doc.text(formatCurrency(property.price), PAGE.MARGIN_X, y + 6);

  doc.setTextColor(...(spread != null && spread > 0 ? SUCCESS_GREEN : spread != null ? DANGER_RED : BRAND_MUTED));
  doc.text(
    spread != null ? `${spread > 0 ? '+' : ''}${formatCurrency(spread)}` : '—',
    110,
    y + 6
  );
  y += 14;

  // ── Property Overview ─────────────────────────────────────
  y = drawSectionHeader(doc, 'Property Overview', y);

  y = drawMetricRow(doc, 'Address', property.address || '—', y);
  y = drawMetricRow(doc, 'Listing Price', formatCurrency(property.price), y, { bold: true });
  y = drawMetricRow(doc, 'Bedrooms', property.bedrooms != null ? String(property.bedrooms) : '—', y);
  y = drawMetricRow(doc, 'Bathrooms', property.bathrooms != null ? String(property.bathrooms) : '—', y);
  y = drawMetricRow(doc, 'Square Feet', property.sqft ? formatNumber(property.sqft) : '—', y);
  y = drawMetricRow(doc, 'Year Built', property.yearBuilt ? String(property.yearBuilt) : '—', y);
  y = drawMetricRow(doc, 'Property Type', humanize(property.propertyType) || '—', y);
  y = drawMetricRow(doc, 'Lot Size', property.lotSize ? `${formatNumber(property.lotSize)} sqft` : '—', y);
  y = drawMetricRow(doc, 'Status', humanize(property.status) || 'For Sale', y);
  y += 4;

  // ── Investment Metrics ────────────────────────────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionHeader(doc, 'Market Position', y);

  y = drawMetricRow(doc, 'Zestimate (estimated value)', formatCurrency(property.zestimate), y, { bold: true });

  const spreadColor: [number, number, number] = spread != null && spread > 0
    ? SUCCESS_GREEN
    : spread != null ? DANGER_RED : BRAND_MUTED;
  y = drawMetricRow(doc, 'Spread (Zestimate − Price)', spread != null ? formatCurrency(spread) : '—', y, {
    bold: true,
    valueColor: spreadColor,
  });

  const pricePerSqft = property.pricePerSqft || (property.price && property.sqft ? property.price / property.sqft : null);
  y = drawMetricRow(doc, 'Price per Sq Ft', pricePerSqft ? `$${Math.round(pricePerSqft)}` : '—', y);
  y = drawMetricRow(doc, 'Days on Market', property.daysOnMarket != null ? String(property.daysOnMarket) : '—', y);
  y += 4;

  // ── Deal Scoring ────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  y = drawSectionHeader(doc, 'Deal Scoring', y);

  y = drawMetricRow(doc, 'Wholesale Potential', humanize(wholesale.tier), y, { bold: true, valueColor: tierColor });
  y = drawMetricRow(doc, 'Deal Score', `${wholesale.score} / 100`, y, { bold: true });
  y = drawMetricRow(doc, 'Spread Amount', formatCurrency(wholesale.spreadAmount || 0), y);
  y = drawMetricRow(doc, 'Spread Percentage', formatPercent(wholesale.spreadPercentage), y);
  y += 4;

  // ── Investment Analysis ─────────────────────────────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionHeader(doc, 'Investment Analysis', y);

  const estimatedARV = property.zestimate || (property.price ? Math.round(property.price * 1.1) : null);
  y = drawMetricRow(doc, 'Estimated ARV', formatCurrency(estimatedARV), y, { bold: true });

  const estimatedRehab = property.sqft ? Math.round(property.sqft * 25) : null;
  const mao = estimatedARV && estimatedRehab ? Math.round(estimatedARV * 0.7 - estimatedRehab) : null;
  y = drawMetricRow(doc, 'Maximum Allowable Offer (70% rule)', formatCurrency(mao), y, { bold: true });
  y = drawMetricRow(doc, 'Estimated Rehab ($25 / sqft)', formatCurrency(estimatedRehab), y);

  const estimatedProfit = mao && property.price ? mao - property.price : null;
  const profitColor: [number, number, number] =
    estimatedProfit != null && estimatedProfit > 0 ? SUCCESS_GREEN : DANGER_RED;
  y = drawMetricRow(
    doc,
    'Estimated Wholesale Profit (MAO − Price)',
    estimatedProfit != null ? formatCurrency(estimatedProfit) : '—',
    y,
    { bold: true, valueColor: estimatedProfit != null ? profitColor : BRAND_MUTED }
  );
  y += 4;

  // ── Cash Flow Projection ───────────────────────────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionHeader(doc, 'Cash Flow Projection (Buy & Hold)', y);

  const rentEstimate = (property as any).rentZestimate || (property.price ? Math.round(property.price * 0.007) : null);
  y = drawMetricRow(doc, 'Estimated Monthly Rent', formatCurrency(rentEstimate), y);

  const mortgageEstimate = property.price ? Math.round((property.price * 0.8 * 0.07) / 12 + (property.price * 0.8) / 360) : null;
  y = drawMetricRow(doc, 'Est. Monthly Mortgage (80% LTV, ~7%)', formatCurrency(mortgageEstimate), y);

  const monthlyCashFlow = rentEstimate && mortgageEstimate ? rentEstimate - mortgageEstimate : null;
  const cashFlowColor: [number, number, number] =
    monthlyCashFlow != null && monthlyCashFlow > 0 ? SUCCESS_GREEN : DANGER_RED;
  y = drawMetricRow(
    doc,
    'Estimated Monthly Cash Flow',
    monthlyCashFlow != null ? formatCurrency(monthlyCashFlow) : '—',
    y,
    { bold: true, valueColor: monthlyCashFlow != null ? cashFlowColor : BRAND_MUTED }
  );

  const annualRent = rentEstimate ? rentEstimate * 12 : null;
  const capRate = annualRent && property.price ? (annualRent / property.price) * 100 : null;
  y = drawMetricRow(doc, 'Estimated Cap Rate', formatPercent(capRate), y, { bold: true });
  y += 6;

  // ── Pitch callout (deal-package summary for buyers / lenders) ─
  if (estimatedProfit != null && estimatedProfit > 0) {
    y = checkPageBreak(doc, y, 25);
    const pitch =
      `Listed at ${formatCurrency(property.price)}, this property has an estimated ARV of ${formatCurrency(estimatedARV)} ` +
      `(spread: ${formatCurrency(spread || 0)}). With a 70%-rule MAO of ${formatCurrency(mao)}, the estimated wholesale ` +
      `profit is ${formatCurrency(estimatedProfit)} after a $${formatNumber(estimatedRehab || 0)} rehab estimate.`;
    y = drawCallout(doc, pitch, y, { title: 'Deal Summary', tone: 'green' });
  }

  // ── Listing info (if available) ─────────────────────────────
  if (property.agentName || property.brokerageName || property.mlsId) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'Listing Information', y);
    if (property.agentName) y = drawMetricRow(doc, 'Listing Agent', property.agentName, y);
    if (property.agentPhone) y = drawMetricRow(doc, 'Agent Phone', property.agentPhone, y);
    if (property.brokerageName) y = drawMetricRow(doc, 'Brokerage', property.brokerageName, y);
    if (property.mlsId) y = drawMetricRow(doc, 'MLS ID', property.mlsId, y);
    y += 4;
  }

  // ── Disclaimer ──────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  drawDisclaimer(doc, y);

  // ── Footer (paints on every page after content done) ───────
  drawFooter(doc, { date: reportDate });

  // ── Save ────────────────────────────────────────────────────
  doc.save(`AIWholesail_Deal_Report_${safeFilename([property.address || 'property'])}.pdf`);
}
