import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, Search, ChevronRight,
  ThermometerSun, DollarSign, TrendingUp, Filter, Zap,
  Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import cities from '@/data/cities.json';

interface City {
  slug: string;
  city: string;
  state: string;
  stateFull: string;
  population: number;
  medianHomePrice: number;
  avgRent: number;
  priceGrowth: number;
  topZips: string[];
  investorTypes: string[];
  marketTemp: string;
}

const tempColors: Record<string, string> = {
  hot: 'bg-red-500/10 text-red-500 border-red-500/20',
  warm: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  cool: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const tempLabels: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cool: 'Cool',
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

type TempFilter = 'all' | 'hot' | 'warm' | 'cool';

export default function Markets() {
  const [query, setQuery] = useState('');
  const [tempFilter, setTempFilter] = useState<TempFilter>('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (cities as City[]).filter((c) => {
      const matchesQuery =
        !q ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.stateFull.toLowerCase().includes(q) ||
        c.slug.includes(q);
      const matchesTemp = tempFilter === 'all' || c.marketTemp === tempFilter;
      return matchesQuery && matchesTemp;
    });
  }, [query, tempFilter]);

  return (
    <PublicLayout>
      <SEOHead
        title="Wholesale Real Estate Markets -- 50 US Cities"
        description="Browse 50+ US real estate markets for wholesale, flip, and rental investing. AI-powered market data, median home prices, growth rates, and top zip codes."
        keywords="wholesale real estate markets, US real estate investing, best cities for wholesaling, real estate market data, investment property markets, best cities to flip houses"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Markets</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Explore Every
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              US Market.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            AI-powered market intelligence for the top 50 US metros.
            Median prices, growth rates, top zips, and investment strategies.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search city or state..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>

            {/* Temperature filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-neutral-400" />
              {(['all', 'hot', 'warm', 'cool'] as TempFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTempFilter(t)}
                  className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                    tempFilter === t
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'bg-neutral-900/50 text-neutral-400 border border-white/[0.08] hover:border-cyan-500/20'
                  }`}
                >
                  {t === 'all' ? 'All Markets' : `${t.charAt(0).toUpperCase() + t.slice(1)}`}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-neutral-400 font-light mt-4">
            {filtered.length} market{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </section>

      {/* ===== CITY GRID ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((city) => (
              <Link key={city.slug} to={`/markets/${city.slug}`} className="group">
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${tempColors[city.marketTemp] || ''}`}>
                        <ThermometerSun className="h-2.5 w-2.5 mr-0.5" />
                        {tempLabels[city.marketTemp]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {city.city}, {city.state}
                  </h3>
                  <p className="text-xs text-neutral-400 font-light mb-5">{city.stateFull}</p>

                  <div className="mt-auto grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Median</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{formatCurrency(city.medianHomePrice)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Growth</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{city.priceGrowth}%</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Rent</span>
                      </div>
                      <p className="text-sm font-semibold text-white">${city.avgRent.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Investor types */}
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/[0.06]">
                    {city.investorTypes.map((type) => (
                      <Badge key={type} variant="outline" className="text-[10px] font-light border-white/[0.08] text-neutral-400">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <MapPin className="h-10 w-10 text-neutral-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No markets found</p>
              <p className="text-sm text-neutral-400 font-light">Try a different search or filter.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Let AI find deals
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              in any market.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans every market daily. AI-powered deal scoring, instant comps, and automated outreach -- all starting at $29/mo.
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
