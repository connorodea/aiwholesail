import { lazy, Suspense, useState, useMemo } from 'react';
import {
  RefreshCw, DollarSign, Hammer, Building2, Calculator, TrendingUp,
  Percent, Clock, Home, Wallet, BarChart3, Receipt, Target, Sparkles,
  ArrowLeft, Loader2, ExternalLink,
} from 'lucide-react';
import type { Property } from '@/types/zillow';
import { buildPrefillFromProperty, toolsUrlForProperty } from '@/lib/property-prefill';
import { InModalProvider } from '@/lib/in-modal-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ToolMeta {
  slug: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  autoFill: boolean;
}

const TOOLS: ToolMeta[] = [
  { slug: 'wholesale-deal-calculator', label: 'Wholesale Deal', description: 'Calculate spread, MAO, and assignment fee using the 70% rule', icon: Target,    autoFill: true  },
  { slug: 'brrrr-calculator',          label: 'BRRRR',          description: 'Buy, rehab, rent, refinance, repeat — full hold analysis', icon: RefreshCw, autoFill: true  },
  { slug: 'cap-rate-calculator',       label: 'Cap Rate',       description: 'NOI, cap rate, GRM, and value at target rates',           icon: Building2, autoFill: true  },
  { slug: 'rehab-estimator',           label: 'Rehab Estimator', description: 'Itemized rehab cost estimate by sqft, baths, and scope',  icon: Hammer,    autoFill: true  },
  { slug: 'arv-calculator',            label: 'ARV',            description: 'After-repair value via comparable sales analysis',         icon: Home,      autoFill: false },
  { slug: 'offer-price-calculator',    label: 'Offer Price',    description: 'Maximum allowable offer working backwards from ARV',       icon: DollarSign,autoFill: false },
  { slug: '70-percent-rule-calculator',label: '70% Rule',       description: 'Quick MAO check using the classic 70% rule',               icon: Percent,   autoFill: false },
  { slug: 'wholesale-fee-calculator',  label: 'Assignment Fee', description: 'Optimal assignment fee given buyer ROI targets',           icon: Wallet,    autoFill: false },
  { slug: 'mortgage-calculator',       label: 'Mortgage',       description: 'Monthly payment, amortization, and total interest',        icon: Calculator,autoFill: false },
  { slug: 'cash-flow-calculator',      label: 'Cash Flow',      description: 'Monthly cash flow, NOI, and DSCR breakdown',               icon: TrendingUp,autoFill: false },
  { slug: 'rental-roi-calculator',     label: 'Rental ROI',     description: 'Cash-on-cash return and total ROI for rentals',            icon: BarChart3, autoFill: false },
  { slug: 'dscr-calculator',           label: 'DSCR',           description: 'Debt service coverage ratio for lender pre-qual',          icon: Receipt,   autoFill: false },
  { slug: 'holding-cost-calculator',   label: 'Holding Costs',  description: 'True cost per month while holding the property',           icon: Clock,     autoFill: false },
];

// Lazy-loaded calculator components — each chunk only ships when the user
// actually opens that tile. Avoids inflating the property-modal bundle
// with 13 calculators upfront.
const CALCULATORS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'wholesale-deal-calculator': lazy(() => import('@/pages/tools/WholesaleDealCalculator')),
  'brrrr-calculator':          lazy(() => import('@/pages/tools/BRRRRCalculator')),
  'cap-rate-calculator':       lazy(() => import('@/pages/tools/CapRateCalculator')),
  'rehab-estimator':           lazy(() => import('@/pages/tools/RehabEstimator')),
  'arv-calculator':            lazy(() => import('@/pages/tools/ARVCalculator')),
  'offer-price-calculator':    lazy(() => import('@/pages/tools/OfferPriceCalculator')),
  '70-percent-rule-calculator':lazy(() => import('@/pages/tools/SeventyPercentRuleCalculator')),
  'wholesale-fee-calculator':  lazy(() => import('@/pages/tools/WholesaleFeeCalculator')),
  'mortgage-calculator':       lazy(() => import('@/pages/tools/MortgageCalculator')),
  'cash-flow-calculator':      lazy(() => import('@/pages/tools/CashFlowCalculator')),
  'rental-roi-calculator':     lazy(() => import('@/pages/tools/RentalROICalculator')),
  'dscr-calculator':           lazy(() => import('@/pages/tools/DSCRCalculator')),
  'holding-cost-calculator':   lazy(() => import('@/pages/tools/HoldingCostCalculator')),
};

interface PropertyToolsTabProps {
  property: Property;
}

export function PropertyToolsTab({ property }: PropertyToolsTabProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const autoFillCount = TOOLS.filter((t) => t.autoFill).length;

  // Build the prefill once per property render; passed via context so the
  // selected calculator's usePrefill() returns it instead of reading URL.
  const prefill = useMemo(() => buildPrefillFromProperty(property), [property]);

  // Inline calculator view — the user clicked a tile.
  if (selectedSlug) {
    const meta = TOOLS.find((t) => t.slug === selectedSlug);
    const Component = CALCULATORS[selectedSlug];
    if (!meta || !Component) {
      // Unknown slug — bail to grid. Shouldn't happen since TOOLS/CALCULATORS
      // are kept in lockstep, but defend against typos in future entries.
      setSelectedSlug(null);
      return null;
    }
    const externalUrl = meta.autoFill ? toolsUrlForProperty(meta.slug, property) : `/tools/${meta.slug}`;
    return (
      <div className="space-y-3">
        {/* Header — back button + breadcrumb + open-in-new-tab escape hatch */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50 sticky top-0 bg-background z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSlug(null)}
            className="gap-1.5 h-8 -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All tools
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{meta.label}</span>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
              title="Open this calculator in a new tab"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">Open in new tab</span>
            </a>
          </div>
        </div>
        <InModalProvider prefill={prefill}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm">Loading {meta.label}…</span>
              </div>
            }
          >
            <Component />
          </Suspense>
        </InModalProvider>
      </div>
    );
  }

  // Grid view — default.
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Investment Calculators</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
            Run any of these calculators against this property. The {autoFillCount} marked
            <Badge variant="secondary" className="mx-1 text-[10px] gap-1 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              <Sparkles className="h-2.5 w-2.5" /> auto-fill
            </Badge>
            open with the property&apos;s price, ARV, sqft, and rule-of-thumb expenses already filled in.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => setSelectedSlug(t.slug)}
              className="group relative flex items-start gap-3 p-3.5 rounded-lg border border-border/50 hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] transition-all text-left w-full"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/15 transition-colors">
                <Icon className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h4 className="text-sm font-medium truncate">{t.label}</h4>
                  {t.autoFill && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shrink-0"
                    >
                      <Sparkles className="h-2 w-2" />
                      auto-fill
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {t.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-3 mt-2">
        Calculators open inline — the property stays open behind so you can flip back to it any time.
      </div>
    </div>
  );
}
