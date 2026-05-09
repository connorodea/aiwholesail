import { Link } from 'react-router-dom';
import {
  RefreshCw, DollarSign, Hammer, Building2, Calculator, TrendingUp,
  Percent, Clock, Home, Wallet, BarChart3, Receipt, Target, Sparkles,
} from 'lucide-react';
import type { Property } from '@/types/zillow';
import { toolsUrlForProperty } from '@/lib/property-prefill';
import { Badge } from '@/components/ui/badge';

interface ToolMeta {
  slug: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** True when this calculator now reads `?prefill=...` on its page */
  autoFill: boolean;
}

const TOOLS: ToolMeta[] = [
  // Auto-filled — most relevant for wholesale workflow
  {
    slug: 'wholesale-deal-calculator',
    label: 'Wholesale Deal',
    description: 'Calculate spread, MAO, and assignment fee using the 70% rule',
    icon: Target,
    autoFill: true,
  },
  {
    slug: 'brrrr-calculator',
    label: 'BRRRR',
    description: 'Buy, rehab, rent, refinance, repeat — full hold analysis',
    icon: RefreshCw,
    autoFill: true,
  },
  {
    slug: 'cap-rate-calculator',
    label: 'Cap Rate',
    description: 'NOI, cap rate, GRM, and value at target rates',
    icon: Building2,
    autoFill: true,
  },
  {
    slug: 'rehab-estimator',
    label: 'Rehab Estimator',
    description: 'Itemized rehab cost estimate by sqft, baths, and scope',
    icon: Hammer,
    autoFill: true,
  },
  // Standalone (no prefill yet — will fall back to defaults)
  {
    slug: 'arv-calculator',
    label: 'ARV',
    description: 'After-repair value via comparable sales analysis',
    icon: Home,
    autoFill: false,
  },
  {
    slug: 'offer-price-calculator',
    label: 'Offer Price',
    description: 'Maximum allowable offer working backwards from ARV',
    icon: DollarSign,
    autoFill: false,
  },
  {
    slug: '70-percent-rule-calculator',
    label: '70% Rule',
    description: 'Quick MAO check using the classic 70% rule',
    icon: Percent,
    autoFill: false,
  },
  {
    slug: 'wholesale-fee-calculator',
    label: 'Assignment Fee',
    description: 'Optimal assignment fee given buyer ROI targets',
    icon: Wallet,
    autoFill: false,
  },
  {
    slug: 'mortgage-calculator',
    label: 'Mortgage',
    description: 'Monthly payment, amortization, and total interest',
    icon: Calculator,
    autoFill: false,
  },
  {
    slug: 'cash-flow-calculator',
    label: 'Cash Flow',
    description: 'Monthly cash flow, NOI, and DSCR breakdown',
    icon: TrendingUp,
    autoFill: false,
  },
  {
    slug: 'rental-roi-calculator',
    label: 'Rental ROI',
    description: 'Cash-on-cash return and total ROI for rentals',
    icon: BarChart3,
    autoFill: false,
  },
  {
    slug: 'dscr-calculator',
    label: 'DSCR',
    description: 'Debt service coverage ratio for lender pre-qual',
    icon: Receipt,
    autoFill: false,
  },
  {
    slug: 'holding-cost-calculator',
    label: 'Holding Costs',
    description: 'True cost per month while holding the property',
    icon: Clock,
    autoFill: false,
  },
];

interface PropertyToolsTabProps {
  property: Property;
}

export function PropertyToolsTab({ property }: PropertyToolsTabProps) {
  const autoFillCount = TOOLS.filter((t) => t.autoFill).length;
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
          const href = t.autoFill ? toolsUrlForProperty(t.slug, property) : `/tools/${t.slug}`;
          return (
            <Link
              key={t.slug}
              to={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-start gap-3 p-3.5 rounded-lg border border-border/50 hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] transition-all"
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
            </Link>
          );
        })}
      </div>

      <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-3 mt-2">
        Calculators open in a new tab so you can keep this property open for reference.
      </div>
    </div>
  );
}
