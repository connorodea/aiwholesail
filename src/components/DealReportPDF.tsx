import jsPDF from 'jspdf';
import { Property } from '@/types/zillow';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';

const ACCENT_COLOR: [number, number, number] = [0, 150, 180]; // Blue/cyan accent
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const MUTED_TEXT: [number, number, number] = [120, 120, 120];
const LINE_COLOR: [number, number, number] = [220, 220, 220];
const WHITE: [number, number, number] = [255, 255, 255];

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value == null || isNaN(value)) return 'N/A';
  return `${value.toFixed(decimals)}%`;
}

function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(20, y, 170, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 25, y + 5.5);
  doc.setTextColor(...DARK_TEXT);
  return y + 12;
}

function drawMetricRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  options?: { bold?: boolean; valueColor?: [number, number, number] }
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(label, 25, y);

  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  doc.setTextColor(...(options?.valueColor || DARK_TEXT));
  doc.text(value, 185, y, { align: 'right' });

  // Light divider
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.2);
  doc.line(25, y + 2, 185, y + 2);

  doc.setTextColor(...DARK_TEXT);
  return y + 7;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 275) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function generateDealReport(property: Property): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const wholesale = calculateWholesalePotential(property);

  // ── Header ──────────────────────────────────────────────────
  // Background bar
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 0, 210, 38, 'F');

  // Logo text
  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('AIWholesail', 20, 16);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Deal Analysis Report', 20, 24);

  // Date
  doc.setFontSize(8);
  doc.text(reportDate, 20, 31);

  // Right-side branding
  doc.setFontSize(8);
  doc.text('aiwholesail.com', 185, 31, { align: 'right' });

  let y = 48;

  // ── Property Address ────────────────────────────────────────
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const addressLines = doc.splitTextToSize(property.address || 'Address Not Available', 170);
  doc.text(addressLines, 20, y);
  y += addressLines.length * 7 + 4;

  // Price line
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ACCENT_COLOR);
  doc.text(formatCurrency(property.price), 20, y);
  doc.setTextColor(...DARK_TEXT);
  y += 10;

  // ── Property Overview ───────────────────────────────────────
  y = drawSectionHeader(doc, 'PROPERTY OVERVIEW', y);

  y = drawMetricRow(doc, 'Address', property.address || 'N/A', y);
  y = drawMetricRow(doc, 'Listing Price', formatCurrency(property.price), y, { bold: true });
  y = drawMetricRow(doc, 'Bedrooms', property.bedrooms != null ? String(property.bedrooms) : 'N/A', y);
  y = drawMetricRow(doc, 'Bathrooms', property.bathrooms != null ? String(property.bathrooms) : 'N/A', y);
  y = drawMetricRow(doc, 'Square Feet', property.sqft ? formatNumber(property.sqft) : 'N/A', y);
  y = drawMetricRow(doc, 'Year Built', property.yearBuilt ? String(property.yearBuilt) : 'N/A', y);
  y = drawMetricRow(doc, 'Property Type', property.propertyType || 'N/A', y);
  y = drawMetricRow(doc, 'Lot Size', property.lotSize ? `${formatNumber(property.lotSize)} sqft` : 'N/A', y);
  y = drawMetricRow(doc, 'Status', property.status || 'N/A', y);
  y += 4;

  // ── Investment Metrics ──────────────────────────────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionHeader(doc, 'INVESTMENT METRICS', y);

  y = drawMetricRow(doc, 'Zestimate (Estimated Value)', formatCurrency(property.zestimate), y, { bold: true });

  const spread = (property.zestimate && property.price) ? property.zestimate - property.price : null;
  const spreadColor: [number, number, number] = spread && spread > 0 ? [0, 150, 50] : [200, 50, 50];
  y = drawMetricRow(doc, 'Spread (Zestimate - Price)', spread != null ? formatCurrency(spread) : 'N/A', y, {
    bold: true,
    valueColor: spread != null ? spreadColor : MUTED_TEXT,
  });

  const pricePerSqft = property.pricePerSqft || (property.price && property.sqft ? property.price / property.sqft : null);
  y = drawMetricRow(doc, 'Price per Sq Ft', pricePerSqft ? `$${Math.round(pricePerSqft)}` : 'N/A', y);
  y = drawMetricRow(doc, 'Days on Market', property.daysOnMarket != null ? String(property.daysOnMarket) : 'N/A', y);
  y += 4;

  // ── Deal Scoring ────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  y = drawSectionHeader(doc, 'DEAL SCORING', y);

  const tierLabel = wholesale.tier.charAt(0).toUpperCase() + wholesale.tier.slice(1);
  const tierColor: [number, number, number] =
    wholesale.tier === 'excellent' || wholesale.tier === 'great'
      ? [0, 150, 50]
      : wholesale.tier === 'good'
        ? [0, 100, 200]
        : wholesale.tier === 'fair'
          ? [200, 150, 0]
          : [200, 50, 50];

  y = drawMetricRow(doc, 'Wholesale Potential Tier', tierLabel, y, { bold: true, valueColor: tierColor });
  y = drawMetricRow(doc, 'Deal Score', `${wholesale.score} / 100`, y, { bold: true });
  y = drawMetricRow(doc, 'Spread Amount', formatCurrency(wholesale.spreadAmount || 0), y);
  y = drawMetricRow(doc, 'Spread Percentage', formatPercent(wholesale.spreadPercentage), y);
  y += 4;

  // ── Investment Analysis ─────────────────────────────────────
  y = checkPageBreak(doc, y, 45);
  y = drawSectionHeader(doc, 'INVESTMENT ANALYSIS', y);

  // Estimated ARV (use zestimate as proxy, or 110% of price)
  const estimatedARV = property.zestimate || (property.price ? Math.round(property.price * 1.1) : null);
  y = drawMetricRow(doc, 'Estimated ARV', formatCurrency(estimatedARV), y, { bold: true });

  // MAO (70% rule): 70% of ARV minus estimated rehab
  const estimatedRehab = property.price && property.sqft ? Math.round(property.sqft * 25) : null; // $25/sqft estimate
  const mao = estimatedARV && estimatedRehab ? Math.round(estimatedARV * 0.7 - estimatedRehab) : null;
  y = drawMetricRow(doc, 'Maximum Allowable Offer (70% Rule)', formatCurrency(mao), y, { bold: true });

  y = drawMetricRow(doc, 'Estimated Rehab ($25/sqft)', formatCurrency(estimatedRehab), y);

  // Estimated profit
  const estimatedProfit = mao && property.price ? mao - property.price : null;
  const profitColor: [number, number, number] =
    estimatedProfit != null && estimatedProfit > 0 ? [0, 150, 50] : [200, 50, 50];
  y = drawMetricRow(
    doc,
    'Estimated Wholesale Profit (MAO - Price)',
    estimatedProfit != null ? formatCurrency(estimatedProfit) : 'N/A',
    y,
    { bold: true, valueColor: estimatedProfit != null ? profitColor : MUTED_TEXT }
  );
  y += 4;

  // ── Cash Flow Projection ───────────────────────────────────
  y = checkPageBreak(doc, y, 45);
  y = drawSectionHeader(doc, 'CASH FLOW PROJECTION', y);

  // Estimated rent (use rentZestimate if available, or rough estimate)
  const rentEstimate = (property as any).rentZestimate || (property.price ? Math.round(property.price * 0.007) : null);
  y = drawMetricRow(doc, 'Estimated Monthly Rent', formatCurrency(rentEstimate), y);

  // Mortgage estimate (30yr fixed at ~7%, rough P&I)
  const mortgageEstimate = property.price ? Math.round((property.price * 0.8 * 0.07) / 12 + (property.price * 0.8) / 360) : null;
  y = drawMetricRow(doc, 'Est. Monthly Mortgage (80% LTV, ~7%)', formatCurrency(mortgageEstimate), y);

  // Monthly cash flow
  const monthlyCashFlow = rentEstimate && mortgageEstimate ? rentEstimate - mortgageEstimate : null;
  const cashFlowColor: [number, number, number] =
    monthlyCashFlow != null && monthlyCashFlow > 0 ? [0, 150, 50] : [200, 50, 50];
  y = drawMetricRow(
    doc,
    'Estimated Monthly Cash Flow',
    monthlyCashFlow != null ? formatCurrency(monthlyCashFlow) : 'N/A',
    y,
    { bold: true, valueColor: monthlyCashFlow != null ? cashFlowColor : MUTED_TEXT }
  );

  // Cap rate
  const annualRent = rentEstimate ? rentEstimate * 12 : null;
  const capRate = annualRent && property.price ? (annualRent / property.price) * 100 : null;
  y = drawMetricRow(doc, 'Estimated Cap Rate', formatPercent(capRate), y, { bold: true });
  y += 6;

  // ── Agent & Listing Info (if available) ─────────────────────
  if (property.agentName || property.brokerageName || property.mlsId) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'LISTING INFORMATION', y);

    if (property.agentName) {
      y = drawMetricRow(doc, 'Listing Agent', property.agentName, y);
    }
    if (property.agentPhone) {
      y = drawMetricRow(doc, 'Agent Phone', property.agentPhone, y);
    }
    if (property.brokerageName) {
      y = drawMetricRow(doc, 'Brokerage', property.brokerageName, y);
    }
    if (property.mlsId) {
      y = drawMetricRow(doc, 'MLS ID', property.mlsId, y);
    }
    y += 4;
  }

  // ── Disclaimer ──────────────────────────────────────────────
  y = checkPageBreak(doc, y, 25);
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 6;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...MUTED_TEXT);
  const disclaimer =
    'This report is for informational purposes only and does not constitute financial, legal, or investment advice. ' +
    'All figures are estimates based on available data and may not reflect actual market conditions. ' +
    'Always conduct independent due diligence before making investment decisions.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, 170);
  doc.text(disclaimerLines, 20, y);
  y += disclaimerLines.length * 3.5 + 4;

  // ── Footer ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED_TEXT);
    doc.text(`Generated by AIWholesail.com | ${reportDate}`, 105, 290, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, 185, 290, { align: 'right' });
  }

  // ── Save ────────────────────────────────────────────────────
  const safeAddress = (property.address || 'property')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  doc.save(`AIWholesail_Deal_Report_${safeAddress}.pdf`);
}
