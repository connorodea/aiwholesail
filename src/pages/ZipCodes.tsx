import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, Search, ChevronRight, Hash,
  DollarSign, TrendingUp, Filter, BarChart3,
  Shield, CheckCircle, ArrowUpDown, Percent,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import zipcodes from '@/data/zipcodes.json';

interface ZipCode {
  zip: string;
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  neighborhood: string;
  medianPrice: number;
  avgRent: number;
  priceGrowth: number;
  population: number;
  medianIncome: number;
  investorActivity: string;
  dominantStrategy: string;
  rentToPrice: number;
  daysOnMarket: number;
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

type ActivityFilter = 'all' | 'high' | 'medium' | 'low';
type SortOption = 'activity' | 'price-asc' | 'price-desc' | 'rent-to-price' | 'growth';

const activityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const allCities = Array.from(new Set((zipcodes as ZipCode[]).map((z) => z.city))).sort();

export default function ZipCodes() {
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('activity');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let results = (zipcodes as ZipCode[]).filter((z) => {
      const matchesQuery =
        !q ||
        z.zip.includes(q) ||
        z.city.toLowerCase().includes(q) ||
        z.state.toLowerCase().includes(q) ||
        z.neighborhood.toLowerCase().includes(q) ||
        z.slug.includes(q);
      const matchesCity = cityFilter === 'all' || z.city === cityFilter;
      const matchesActivity = activityFilter === 'all' || z.investorActivity === activityFilter;
      return matchesQuery && matchesCity && matchesActivity;
    });

    results.sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return (activityOrder[a.investorActivity] ?? 3) - (activityOrder[b.investorActivity] ?? 3);
        case 'price-asc':
          return a.medianPrice - b.medianPrice;
        case 'price-desc':
          return b.medianPrice - a.medianPrice;
        case 'rent-to-price':
          return b.rentToPrice - a.rentToPrice;
        case 'growth':
          return b.priceGrowth - a.priceGrowth;
        default:
          return 0;
      }
    });

    return results;
  }, [query, cityFilter, activityFilter, sortBy]);

  return (
    <PublicLayout>
      <SEOHead
        title="ZIP Code Real Estate Data -- 290 Investing ZIP Codes Across 15 Metros"
        description="Search 290+ ZIP codes across 15 US metros for wholesale, flip, and rental real estate investing. Filter by investor activity, sort by rent-to-price ratio, price growth, and median price."
        keywords="zip code real estate investing, best zip codes for wholesaling, zip code rental data, real estate investing by zip code, investor activity zip codes, rent to price ratio zip codes"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'ZIP Codes', url: 'https://aiwholesail.com/zip' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">ZIP Code Data</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Invest by
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              ZIP Code.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Search {(zipcodes as ZipCode[]).length} ZIP codes across 15 top US metros. Filter by city,
            investor activity, and sort by rent-to-price ratio, price growth, or median price.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search + City filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search ZIP, city, or neighborhood..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="pl-9 pr-8 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                >
                  <option value="all">All Cities</option>
                  {allCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
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
                  <option value="rent-to-price">Sort: Rent-to-Price (High)</option>
                  <option value="growth">Sort: Price Growth (High)</option>
                  <option value="price-asc">Sort: Price (Low to High)</option>
                  <option value="price-desc">Sort: Price (High to Low)</option>
                </select>
              </div>
            </div>
          </div>

          <p className="text-sm text-neutral-400 font-light mt-4">
            {filtered.length} ZIP code{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </section>

      {/* ===== ZIP CODE GRID ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((z) => (
              <Link key={z.slug} to={`/zip/${z.slug}`} className="group">
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${activityColors[z.investorActivity] || ''}`}>
                        <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
                        {z.investorActivity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-0.5 group-hover:text-cyan-400 transition-colors">
                    {z.zip}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-1">{z.neighborhood}</p>
                  <p className="text-xs text-neutral-500 font-light mb-5">{z.city}, {z.state}</p>

                  <div className="mt-auto grid grid-cols-4 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Median</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{formatCurrency(z.medianPrice)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Rent</span>
                      </div>
                      <p className="text-sm font-semibold text-white">${z.avgRent.toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Percent className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">RTP</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{(z.rentToPrice * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Growth</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{z.priceGrowth}%</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/[0.06]">
                    <Badge variant="outline" className="text-[10px] font-light border-white/[0.08] text-neutral-400">
                      {z.dominantStrategy}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-light border-white/[0.08] text-neutral-400">
                      {z.daysOnMarket} DOM
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Hash className="h-10 w-10 text-neutral-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No ZIP codes found</p>
              <p className="text-sm text-neutral-400 font-light">Try a different search, city, or filter.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            AI finds deals
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              in every ZIP.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans every ZIP code daily. AI-powered deal scoring, instant comps, and automated outreach -- all starting at $29/mo.
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
