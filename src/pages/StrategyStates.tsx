import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, ChevronRight, Search, Shield, CheckCircle,
  Repeat, Hammer, Building2, RefreshCw, FileKey, Handshake,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import strategyStates from '@/data/strategy-states.json';

interface StrategyState {
  slug: string;
  strategy: string;
  strategyLabel: string;
  state: string;
  stateFull: string;
  legal: boolean;
  licenseRequired: boolean;
  avgDealSize: number;
  topCities: string[];
  marketConditions: string;
  regulations: string;
  tips: string[];
}

const STRATEGIES = [
  { key: 'all', label: 'All Strategies', icon: <MapPin className="h-4 w-4" /> },
  { key: 'wholesale', label: 'Wholesale', icon: <Repeat className="h-4 w-4" /> },
  { key: 'flip', label: 'Fix & Flip', icon: <Hammer className="h-4 w-4" /> },
  { key: 'rental', label: 'Rental', icon: <Building2 className="h-4 w-4" /> },
  { key: 'brrrr', label: 'BRRRR', icon: <RefreshCw className="h-4 w-4" /> },
  { key: 'subject-to', label: 'Subject-To', icon: <FileKey className="h-4 w-4" /> },
  { key: 'seller-financing', label: 'Seller Financing', icon: <Handshake className="h-4 w-4" /> },
] as const;

const STATES = [
  'TX','FL','GA','OH','NC','TN','IN','MI','MO','AZ',
  'PA','AL','SC','VA','IL','CA','CO','NV','MD','KY',
  'OK','AR','MS','LA','WI','MN','IA','KS','NE','WV',
] as const;

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const strategyColors: Record<string, string> = {
  wholesale: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  flip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rental: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  brrrr: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'subject-to': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'seller-financing': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

export default function StrategyStatesIndex() {
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const all = strategyStates as StrategyState[];

  const filtered = useMemo(() => {
    let result = all;
    if (strategyFilter !== 'all') {
      result = result.filter((s) => s.strategy === strategyFilter);
    }
    if (stateFilter !== 'all') {
      result = result.filter((s) => s.state === stateFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.stateFull.toLowerCase().includes(q) ||
          s.strategyLabel.toLowerCase().includes(q) ||
          s.state.toLowerCase().includes(q)
      );
    }
    return result;
  }, [all, strategyFilter, stateFilter, searchQuery]);

  return (
    <PublicLayout>
      <SEOHead
        title="Real Estate Investing Strategies by State -- 180 Markets | AIWholesail"
        description="Explore 6 real estate investing strategies across 30 US states. Wholesaling, flipping, rentals, BRRRR, subject-to, and seller financing. Legal status, top cities, and expert tips."
        keywords="real estate investing strategies, wholesale by state, flip houses by state, BRRRR investing, subject to deals, seller financing, real estate investing guide, state by state investing"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <Badge variant="outline" className="mb-6 text-xs border-cyan-500/20 text-cyan-400">
            <MapPin className="h-3 w-3 mr-1" />
            6 Strategies &middot; 30 States &middot; 180 Pages
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Strategy &times; State
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Investing Guide.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Find the best real estate investing strategy for your target state. Legal status, market conditions, top cities, and expert tips for every combination.
          </p>
        </div>
      </section>

      {/* ===== FILTERS ===== */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Strategy pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {STRATEGIES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStrategyFilter(s.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
                  strategyFilter === s.key
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {/* State select + search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/30 transition-colors"
            >
              <option value="all">All States</option>
              {STATES.map((st) => {
                const entry = all.find((s) => s.state === st);
                return (
                  <option key={st} value={st}>
                    {entry ? entry.stateFull : st}
                  </option>
                );
              })}
            </select>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search strategies or states..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
              />
            </div>
          </div>

          <p className="text-sm text-neutral-400 mt-3">
            Showing {filtered.length} of {all.length} strategy-state combinations
          </p>
        </div>
      </section>

      {/* ===== GRID ===== */}
      <section className="py-8 px-4 pb-16">
        <div className="container mx-auto max-w-7xl">
          {filtered.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((entry) => (
                <Link key={entry.slug} to={`/strategies/${entry.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className={`text-[10px] border ${strategyColors[entry.strategy] || strategyColors.wholesale}`}>
                        {entry.strategyLabel}
                      </Badge>
                      {entry.legal ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400">
                          Legal
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-400">
                          Restricted
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {entry.strategyLabel} in {entry.stateFull}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-3 flex-1 line-clamp-2">
                      {entry.marketConditions}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">
                        Avg. {formatCurrency(entry.avgDealSize)} profit
                      </span>
                      <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        View <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-neutral-400">No results match your filters. Try adjusting your search.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find your strategy.
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Pick your state.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail covers 30 states with AI-powered deal scoring, instant comps, and automated seller outreach for every strategy.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel Anytime</span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
