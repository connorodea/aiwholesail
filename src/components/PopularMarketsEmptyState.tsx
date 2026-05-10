import { TrendingUp, MapPin, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PropertySearchParams } from '@/types/zillow';

/**
 * Trial-activation lever.
 *
 * The trial funnel showed 77% of signups never run a single property search.
 * The /app empty state was a blank wall after the search input — users had
 * to invent a city to type. These one-click chips lower the friction from
 * "what should I search?" to "click this".
 *
 * Markets picked for: high wholesale-deal activity, geographic diversity,
 * recognizable names. Investor consensus + property-data driven.
 */

interface PopularMarket {
  label: string;
  location: string;
  hint: string;
}

const POPULAR_MARKETS: PopularMarket[] = [
  { label: 'Dallas, TX',       location: 'Dallas, TX',       hint: 'High volume · investor-friendly' },
  { label: 'Atlanta, GA',      location: 'Atlanta, GA',      hint: 'Strong rental demand' },
  { label: 'Houston, TX',      location: 'Houston, TX',      hint: 'Large inventory · low taxes' },
  { label: 'Tampa, FL',        location: 'Tampa, FL',        hint: 'Population growth' },
  { label: 'Phoenix, AZ',      location: 'Phoenix, AZ',      hint: 'Distressed inventory' },
  { label: 'Indianapolis, IN', location: 'Indianapolis, IN', hint: 'Cash-flow markets' },
];

interface PopularMarketsEmptyStateProps {
  onSelect: (params: PropertySearchParams) => void;
}

export function PopularMarketsEmptyState({ onSelect }: PopularMarketsEmptyStateProps) {
  const handleClick = (market: PopularMarket) => {
    // Defaults match the regular form's defaults so the click-to-search
    // experience is identical to typing the city manually.
    onSelect({
      location: market.location,
      homeType: 'Houses',
    });
  };

  return (
    <section className="max-w-4xl mx-auto animate-fade-in">
      <Card className="border-cyan-500/20 bg-gradient-to-b from-cyan-500/[0.04] to-transparent">
        <CardContent className="p-5 sm:p-7 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold tracking-tight">
                Not sure where to start? Try a popular market.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                One click runs an instant scan. AIWholesail finds undervalued properties with the highest spreads.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {POPULAR_MARKETS.map((m) => (
              <button
                key={m.location}
                type="button"
                onClick={() => handleClick(m)}
                className="group flex flex-col items-start gap-0.5 p-3 rounded-lg border border-border/60 hover:border-cyan-500/40 hover:bg-cyan-500/[0.04] transition-all text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground line-clamp-1 pl-5">{m.hint}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            <TrendingUp className="h-3 w-3" />
            <span>Or type any city, county, or ZIP code in the search box above to scan a different market.</span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
