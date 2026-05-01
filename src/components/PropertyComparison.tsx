import React from 'react';
import { Property } from '@/types/zillow';
import { calculateWholesalePotential, WholesalePotential } from '@/lib/wholesale-calculator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Trophy, X } from 'lucide-react';
import jsPDF from 'jspdf';

interface PropertyComparisonProps {
  properties: Property[];
  isOpen: boolean;
  onClose: () => void;
}

type ComparisonMetric = {
  label: string;
  getValue: (p: Property) => number | string | null;
  format: (v: number | string | null) => string;
  bestFn: 'highest' | 'lowest' | 'none';
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

function getSpread(p: Property): number | null {
  if (p.price && p.zestimate) return p.zestimate - p.price;
  return null;
}

function getSpreadPercent(p: Property): number | null {
  const spread = getSpread(p);
  if (spread != null && p.zestimate && p.zestimate > 0) {
    return (spread / p.zestimate) * 100;
  }
  return null;
}

function getPricePerSqft(p: Property): number | null {
  if (p.pricePerSqft) return p.pricePerSqft;
  if (p.price && p.sqft && p.sqft > 0) return p.price / p.sqft;
  return null;
}

const METRICS: ComparisonMetric[] = [
  {
    label: 'Price',
    getValue: (p) => p.price ?? null,
    format: (v) => formatCurrency(v as number | null),
    bestFn: 'lowest',
  },
  {
    label: 'Zestimate',
    getValue: (p) => p.zestimate ?? null,
    format: (v) => formatCurrency(v as number | null),
    bestFn: 'highest',
  },
  {
    label: 'Spread',
    getValue: (p) => getSpread(p),
    format: (v) => {
      if (v == null) return 'N/A';
      const num = v as number;
      const sign = num >= 0 ? '+' : '';
      return `${sign}${formatCurrency(num)}`;
    },
    bestFn: 'highest',
  },
  {
    label: 'Spread %',
    getValue: (p) => getSpreadPercent(p),
    format: (v) => {
      if (v == null) return 'N/A';
      const num = v as number;
      return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
    },
    bestFn: 'highest',
  },
  {
    label: '$/sqft',
    getValue: (p) => getPricePerSqft(p),
    format: (v) => {
      if (v == null) return 'N/A';
      return `$${Math.round(v as number)}`;
    },
    bestFn: 'lowest',
  },
  {
    label: 'Beds',
    getValue: (p) => p.bedrooms ?? null,
    format: (v) => (v != null ? String(v) : 'N/A'),
    bestFn: 'highest',
  },
  {
    label: 'Baths',
    getValue: (p) => p.bathrooms ?? null,
    format: (v) => (v != null ? String(v) : 'N/A'),
    bestFn: 'highest',
  },
  {
    label: 'Sqft',
    getValue: (p) => p.sqft ?? null,
    format: (v) => (v != null ? formatNumber(v as number) : 'N/A'),
    bestFn: 'highest',
  },
  {
    label: 'Year Built',
    getValue: (p) => p.yearBuilt ?? null,
    format: (v) => (v != null ? String(v) : 'N/A'),
    bestFn: 'highest',
  },
  {
    label: 'Days on Market',
    getValue: (p) => p.daysOnMarket ?? null,
    format: (v) => (v != null ? String(v) : 'N/A'),
    bestFn: 'lowest',
  },
  {
    label: 'Type',
    getValue: (p) => p.propertyType ?? null,
    format: (v) => (v != null ? String(v) : 'N/A'),
    bestFn: 'none',
  },
];

function findBestIndex(
  values: (number | string | null)[],
  direction: 'highest' | 'lowest' | 'none'
): number | null {
  if (direction === 'none') return null;
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || typeof v === 'string') continue;
    if (
      bestVal === null ||
      (direction === 'highest' && v > bestVal) ||
      (direction === 'lowest' && v < bestVal)
    ) {
      bestVal = v;
      bestIdx = i;
    }
  }
  // Only highlight if there's a meaningful difference (not all the same)
  const numericValues = values.filter(
    (v): v is number => v != null && typeof v === 'number'
  );
  if (numericValues.length < 2) return null;
  const allSame = numericValues.every((v) => v === numericValues[0]);
  if (allSame) return null;
  return bestIdx;
}

function getBestDealIndex(properties: Property[]): number {
  // Score each property by spread + wholesale score
  let bestIdx = 0;
  let bestScore = -Infinity;
  properties.forEach((p, i) => {
    const wholesale = calculateWholesalePotential(p);
    const spread = getSpread(p) ?? 0;
    // Combine: normalized spread (weight 0.6) + wholesale score (weight 0.4)
    const score = spread * 0.6 + wholesale.score * 400;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function getTierColor(tier: WholesalePotential['tier']): string {
  switch (tier) {
    case 'excellent':
      return 'text-yellow-400';
    case 'great':
      return 'text-emerald-400';
    case 'good':
      return 'text-green-400';
    case 'fair':
      return 'text-amber-400';
    default:
      return 'text-neutral-400';
  }
}

// ---- PDF Export ----

function generateComparisonPDF(properties: Property[]): void {
  const ACCENT: [number, number, number] = [0, 150, 180];
  const DARK: [number, number, number] = [30, 30, 30];
  const MUTED: [number, number, number] = [120, 120, 120];
  const LINE: [number, number, number] = [220, 220, 220];
  const WHITE: [number, number, number] = [255, 255, 255];
  const GREEN: [number, number, number] = [0, 150, 50];

  const doc = new jsPDF('l', 'mm', 'a4'); // landscape for comparison
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Header
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('AIWholesail', 15, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Property Comparison Report', 15, 21);
  doc.setFontSize(8);
  doc.text(reportDate, 270, 21, { align: 'right' });

  let y = 38;
  const colCount = properties.length;
  const labelWidth = 50;
  const tableWidth = 267; // 297 - 30 margins
  const colWidth = (tableWidth - labelWidth) / colCount;
  const startX = 15;

  // Column headers (property addresses)
  doc.setFillColor(240, 240, 240);
  doc.rect(startX, y, tableWidth, 14, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Metric', startX + 4, y + 9);

  properties.forEach((p, i) => {
    const x = startX + labelWidth + i * colWidth;
    const addr = (p.address || 'N/A').substring(0, 30);
    doc.text(addr, x + 2, y + 9);
  });
  y += 16;

  // Best deal index
  const bestIdx = getBestDealIndex(properties);

  // Metrics rows
  const allMetrics = [
    ...METRICS,
    {
      label: 'Deal Score',
      getValue: (p: Property) => calculateWholesalePotential(p).score,
      format: (v: number | string | null) => (v != null ? `${v}/100` : 'N/A'),
      bestFn: 'highest' as const,
    },
    {
      label: 'Deal Tier',
      getValue: (p: Property) => calculateWholesalePotential(p).tier,
      format: (v: number | string | null) => {
        if (v == null) return 'N/A';
        return String(v).charAt(0).toUpperCase() + String(v).slice(1);
      },
      bestFn: 'none' as const,
    },
  ];

  allMetrics.forEach((metric, rowIdx) => {
    const values = properties.map((p) => metric.getValue(p));
    const best = findBestIndex(values, metric.bestFn);

    if (rowIdx % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(startX, y - 1, tableWidth, 7, 'F');
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(metric.label, startX + 4, y + 4);

    properties.forEach((_, i) => {
      const x = startX + labelWidth + i * colWidth;
      const val = values[i];
      const formatted = metric.format(val);

      if (best === i) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);
      }
      doc.text(formatted, x + 2, y + 4);
    });

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(startX, y + 6, startX + tableWidth, y + 6);
    y += 7;
  });

  // Best Deal recommendation
  y += 6;
  doc.setFillColor(...GREEN);
  doc.rect(startX, y, tableWidth, 10, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const bestAddr = properties[bestIdx]?.address || 'N/A';
  doc.text(
    `Best Deal Recommendation: ${bestAddr.substring(0, 60)}`,
    startX + 4,
    y + 7
  );

  y += 16;

  // Disclaimer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...MUTED);
  const disclaimer =
    'This report is for informational purposes only and does not constitute financial, legal, or investment advice. ' +
    'All figures are estimates based on available data. Always conduct independent due diligence.';
  const lines = doc.splitTextToSize(disclaimer, tableWidth);
  doc.text(lines, startX, y);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(
      `Generated by AIWholesail.com | ${reportDate}`,
      148,
      200,
      { align: 'center' }
    );
  }

  doc.save('AIWholesail_Property_Comparison.pdf');
}

// ---- Component ----

export function PropertyComparison({
  properties,
  isOpen,
  onClose,
}: PropertyComparisonProps) {
  if (properties.length < 2) return null;

  const bestDealIdx = getBestDealIndex(properties);
  const wholesaleResults = properties.map((p) =>
    calculateWholesalePotential(p)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] bg-[#0c0d0f] border-neutral-800 text-white p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-xl font-medium tracking-tight text-white flex items-center gap-3">
            Property Comparison
            <Badge variant="outline" className="text-xs font-normal text-neutral-400 border-neutral-700">
              {properties.length} properties
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Side-by-side analysis of selected properties
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)] px-6">
          {/* Desktop: table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-3 pr-4 text-neutral-500 font-medium text-xs uppercase tracking-wider w-32">
                    Metric
                  </th>
                  {properties.map((p, i) => (
                    <th
                      key={p.id}
                      className="text-left py-3 px-3 font-medium text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {i === bestDealIdx && (
                          <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                        )}
                        <span
                          className={`truncate max-w-[180px] ${
                            i === bestDealIdx
                              ? 'text-yellow-400'
                              : 'text-neutral-300'
                          }`}
                          title={p.address}
                        >
                          {p.address?.split(',')[0] || 'N/A'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  const values = properties.map((p) => metric.getValue(p));
                  const bestIdx = findBestIndex(values, metric.bestFn);

                  return (
                    <tr
                      key={metric.label}
                      className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                        {metric.label}
                      </td>
                      {properties.map((_, i) => {
                        const val = values[i];
                        const isBest = bestIdx === i;
                        return (
                          <td
                            key={i}
                            className={`py-2.5 px-3 font-mono text-sm ${
                              isBest
                                ? 'text-emerald-400 font-semibold'
                                : 'text-neutral-300'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {isBest && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                              )}
                              {metric.format(val)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Deal Score row */}
                <tr className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                    Deal Score
                  </td>
                  {wholesaleResults.map((w, i) => {
                    const scores = wholesaleResults.map((wr) => wr.score);
                    const bestScoreIdx = findBestIndex(scores, 'highest');
                    const isBest = bestScoreIdx === i;
                    return (
                      <td
                        key={i}
                        className={`py-2.5 px-3 font-mono text-sm ${
                          isBest
                            ? 'text-emerald-400 font-semibold'
                            : 'text-neutral-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isBest && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                          )}
                          {w.score}/100
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Deal Tier row */}
                <tr className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                    Deal Tier
                  </td>
                  {wholesaleResults.map((w, i) => (
                    <td key={i} className="py-2.5 px-3">
                      <span
                        className={`font-semibold text-sm capitalize ${getTierColor(
                          w.tier
                        )}`}
                      >
                        {w.tier}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-6">
            {properties.map((p, pIdx) => {
              const w = wholesaleResults[pIdx];
              const isBestDeal = pIdx === bestDealIdx;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 space-y-3 ${
                    isBestDeal
                      ? 'border-yellow-500/50 bg-yellow-500/5'
                      : 'border-neutral-800 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isBestDeal && (
                      <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    )}
                    <h3
                      className={`text-sm font-medium truncate ${
                        isBestDeal ? 'text-yellow-400' : 'text-white'
                      }`}
                    >
                      {p.address?.split(',')[0] || 'N/A'}
                    </h3>
                    {isBestDeal && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
                        Best Deal
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {METRICS.map((metric) => {
                      const val = metric.getValue(p);
                      return (
                        <div key={metric.label} className="space-y-0.5">
                          <span className="text-neutral-500 uppercase tracking-wider text-[10px]">
                            {metric.label}
                          </span>
                          <p className="text-neutral-200 font-mono">
                            {metric.format(val)}
                          </p>
                        </div>
                      );
                    })}
                    <div className="space-y-0.5">
                      <span className="text-neutral-500 uppercase tracking-wider text-[10px]">
                        Deal Score
                      </span>
                      <p className="text-neutral-200 font-mono">
                        {w.score}/100
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-neutral-500 uppercase tracking-wider text-[10px]">
                        Deal Tier
                      </span>
                      <p
                        className={`font-semibold capitalize ${getTierColor(
                          w.tier
                        )}`}
                      >
                        {w.tier}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Best Deal Summary */}
          <div className="mt-6 mb-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <Trophy className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-medium text-white">
                  Best Deal Recommendation
                </h4>
                <p className="text-sm text-neutral-400">
                  <span className="text-emerald-400 font-medium">
                    {properties[bestDealIdx]?.address?.split(',')[0] || 'N/A'}
                  </span>{' '}
                  has the strongest combination of spread (
                  {formatCurrency(getSpread(properties[bestDealIdx]))}
                  ) and deal score (
                  {wholesaleResults[bestDealIdx]?.score}/100,{' '}
                  <span
                    className={`capitalize font-medium ${getTierColor(
                      wholesaleResults[bestDealIdx]?.tier
                    )}`}
                  >
                    {wholesaleResults[bestDealIdx]?.tier}
                  </span>
                  ).
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-[#0a0b0c]">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="gap-2 h-9 px-4 text-sm font-medium border-neutral-700 text-neutral-300 hover:text-white"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => generateComparisonPDF(properties)}
            className="gap-2 h-9 px-4 text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
