import { useEffect, useState } from 'react';
import { zillowAPI } from '@/lib/zillow-api';
import type { Property } from '@/types/zillow';
import { Home, RefreshCw } from 'lucide-react';

/**
 * Compact rental-estimate stat for the PropertyModal Overview tab.
 *
 * Calls /v1/rental-estimate lazily. Shows the monthly rent estimate
 * and the rent-to-price ratio (a quick cap-rate sanity check). Renders
 * as a single inline stat card so it slots into the existing Overview
 * grid without restructuring it.
 *
 * Silent failure: if the endpoint returns nothing, the component
 * renders null so we don't show a broken card to the user.
 */

interface RentalData {
  rentZestimate?: number;
  rentRangeLow?: number;
  rentRangeHigh?: number;
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,]/g, ''));
    return isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalize(raw: unknown): RentalData {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  const root = (d.rental ?? d.data ?? d) as Record<string, unknown>;
  return {
    rentZestimate:
      readNumber(root.rentZestimate) ??
      readNumber(root.rent_zestimate) ??
      readNumber(root.zestimate) ??
      readNumber(root.estimate),
    rentRangeLow: readNumber(root.rentRangeLow) ?? readNumber(root.range_low) ?? readNumber(root.low),
    rentRangeHigh: readNumber(root.rentRangeHigh) ?? readNumber(root.range_high) ?? readNumber(root.high),
  };
}

const fmtCurrency = (val?: number) =>
  val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : null;

export function PropertyRentalEstimate({ property }: { property: Property }) {
  const zpid = property.zpid || property.id;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RentalData>({});

  useEffect(() => {
    if (!zpid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await zillowAPI.getRentalEstimate(String(zpid));
        if (!cancelled) setData(normalize(raw));
      } catch (err) {
        console.warn('[PropertyRentalEstimate] failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zpid]);

  // Fall back to the property.rentZestimate that PropertyModal already
  // populates from getPropertyDetails — saves a redundant fetch when
  // detail response carried the value.
  const rent = data.rentZestimate || (property as { rentZestimate?: number }).rentZestimate;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
        <RefreshCw className="h-3 w-3 animate-spin" /> Rent estimate…
      </div>
    );
  }

  if (!rent) return null;

  const rentToPrice =
    property.price && rent > 0 ? ((rent * 12) / property.price) * 100 : undefined;

  return (
    <div className="p-3 rounded-lg bg-cyan-500/[0.04] border border-cyan-500/20 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Home className="h-3.5 w-3.5 text-cyan-400" />
        Rent Estimate
      </div>
      <div className="text-xl font-bold">
        {fmtCurrency(rent)}<span className="text-xs text-muted-foreground font-normal">/mo</span>
      </div>
      {(data.rentRangeLow || data.rentRangeHigh) && (
        <div className="text-[11px] text-muted-foreground">
          Range: {fmtCurrency(data.rentRangeLow)} – {fmtCurrency(data.rentRangeHigh)}
        </div>
      )}
      {rentToPrice != null && (
        <div className="text-[11px] text-muted-foreground">
          Annual rent ≈ <span className="font-medium text-foreground">{rentToPrice.toFixed(1)}%</span> of price
        </div>
      )}
    </div>
  );
}
