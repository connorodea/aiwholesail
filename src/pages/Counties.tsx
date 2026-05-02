import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, Search, ChevronRight,
  DollarSign, TrendingUp, Filter, Landmark,
  Shield, CheckCircle, ArrowUpDown, Percent,
  Home, Users, BarChart3, Scale,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import counties from '@/data/counties.json';

interface County {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  county_seat: string;
  population: number;
  medianHomePrice: number;
  avgRent: number;
  priceGrowth: number;
  foreclosureRate: number;
  taxRate: number;
  landlordFriendly: boolean;
  topCities: string[];
  investorActivity: string;
  dominantStrategies: string[];
  courtHouseAddress: string;
  taxSaleInfo: string;
  description: string;
}

const activityColors: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

type ActivityFilter = 'all' | 'high' | 'medium' | 'low';
type SortOption = 'activity' | 'price-asc' | 'price-desc' | 'growth' | 'tax-rate' | 'population';

const activityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const allStates = Array.from(new Set((counties as County[]).map((c) => c.stateFull))).sort();

export default function Counties() {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('activity');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let results = (counties as County[]).filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.stateFull.toLowerCase().includes(q) ||
        c.county_seat.toLowerCase().includes(q) ||
        c.slug.includes(q);
      const matchesState = stateFilter === 'all' || c.stateFull === stateFilter;
      const matchesActivity = activityFilter === 'all' || c.investorActivity === activityFilter;
      return matchesQuery && matchesState && matchesActivity;
    });

    results.sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return (activityOrder[a.investorActivity] ?? 3) - (activityOrder[b.investorActivity] ?? 3);
        case 'price-asc':
          return a.medianHomePrice - b.medianHomePrice;
        case 'price-desc':
          return b.medianHomePrice - a.medianHomePrice;
        case 'growth':
          return b.priceGrowth - a.priceGrowth;
        case 'tax-rate':
          return a.taxRate - b.taxRate;
        case 'population':
          return b.population - a.population;
        default:
          return 0;
      }
    });

    return results;
  }, [query, stateFilter, activityFilter, sortBy]);

  return (
    <PublicLayout>
      <SEOHead
        title="County Real Estate Data -- 100 Top Investing Counties Across 18 States"
        description="Explore 100 top real estate investing counties across 18 US states. Filter by state, investor activity, and sort by price, growth, tax rate, or population. Tax sale info, courthouse addresses, and county-level investment data."
        keywords="county real estate investing, best counties for wholesaling, county tax sale data, real estate investing by county, investor activity counties, county property tax rates, tax lien investing"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Counties', url: 'https://aiwholesail.com/counties' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">County Data</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Invest by
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              County.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Explore {(counties as County[]).length} top investing counties across 18 states. Tax sale schedules,
            courthouse addresses, foreclosure rates, and landlord-friendly ratings.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search + State filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search county, state, or county seat..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="pl-9 pr-8 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                >
                  <option value="all">All States</option>
                  {allStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Activity filter + Sort */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-neutral-400" />
                {(['all', 'high', 'medium', 'low'] as ActivityFilter[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setActivityFilter(a)}
                    className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                      activityFilter === a
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'bg-neutral-900/50 text-neutral-400 border border-white/[0.08] hover:border-cyan-500/20'
                    }`}
                  >
                    {a === 'all' ? 'All Activity' : `${a.charAt(0).toUpperCase() + a.slice(1)}`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-neutral-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-4 py-2 bg-neutral-900/50 border border-white/[0.08] rounded-md text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500/30 transition-colors"
                >
                  <option value="activity">Sort: Investor Activity</option>
                  <option value="price-asc">Sort: Price (Low to High)</option>
                  <option value="price-desc">Sort: Price (High to Low)</option>
                  <option value="growth">Sort: Price Growth (High)</option>
                  <option value="tax-rate">Sort: Tax Rate (Low to High)</option>
                  <option value="population">Sort: Population (High to Low)</option>
                </select>
              </div>
            </div>
          </div>

          <p className="text-sm text-neutral-400 font-light mt-4">
            {filtered.length} count{filtered.length !== 1 ? 'ies' : 'y'} found
          </p>
        </div>
      </section>

      {/* ===== COUNTY GRID ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <Link key={c.slug} to={`/counties/${c.slug}`} className="group">
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${activityColors[c.investorActivity] || ''}`}>
                        <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
                        {c.investorActivity}
                      </Badge>
                      {c.landlordFriendly && (
                        <Badge variant="outline" className="text-[10px] border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          LL Friendly
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-0.5 group-hover:text-cyan-400 transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-1">{c.stateFull}</p>
                  <p className="text-xs text-neutral-500 font-light mb-5">County seat: {c.county_seat}</p>

                  <div className="mt-auto grid grid-cols-4 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Median</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{formatCurrency(c.medianHomePrice)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Home className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Rent</span>
                      </div>
                      <p className="text-sm font-semibold text-white">${c.avgRent.toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Growth</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{c.priceGrowth}%</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Percent className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Tax</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{c.taxRate}%</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY COUNTIES MATTER ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Why County Data</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6 max-w-lg">
            Why invest at the county level.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white mb-3">Tax Sales & Liens</h3>
              <p className="text-sm text-neutral-400 font-light leading-relaxed">
                Tax sales happen at the county level. Knowing your county's tax sale schedule, redemption periods, and interest rates is critical for tax lien and tax deed investing.
              </p>
            </div>
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                <Landmark className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white mb-3">Courthouse Records</h3>
              <p className="text-sm text-neutral-400 font-light leading-relaxed">
                Property records, liens, deeds, and foreclosure filings are all recorded at the county courthouse. Direct access to county records gives investors a competitive edge.
              </p>
            </div>
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white mb-3">Tax Rates & Regulations</h3>
              <p className="text-sm text-neutral-400 font-light leading-relaxed">
                Property tax rates vary dramatically by county, directly impacting your cash flow. Counties also set zoning, permitting, and landlord-tenant enforcement policies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-12">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Get Started</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Find deals in any county.
            </h2>
            <p className="text-neutral-400 font-light mb-8 max-w-lg mx-auto">
              AIWholesail uses AI to scan every county for off-market deals, distressed properties, and motivated sellers. Start finding deals today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <button className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link to="/markets">
                <button className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
                  <MapPin className="h-4 w-4" /> Browse Markets
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
