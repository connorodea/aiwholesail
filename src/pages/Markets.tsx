import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Zap, MapPin, Search, ChevronRight,
  ThermometerSun, DollarSign, TrendingUp, Filter,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { GradientOrbs } from '@/components/effects/GradientOrbs';
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
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Wholesale Real Estate Markets -- 50 US Cities"
        description="Browse 50+ US real estate markets for wholesale, flip, and rental investing. AI-powered market data, median home prices, growth rates, and top zip codes."
        keywords="wholesale real estate markets, US real estate investing, best cities for wholesaling, real estate market data, investment property markets, best cities to flip houses"
      />

      {/* ===== HERO -- DARK ===== */}
      <section className="relative bg-[#0a0a0a] text-white overflow-hidden">
        <GradientOrbs variant="hero" />

        {/* Nav */}
        <div className="relative container mx-auto max-w-7xl px-4 pt-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight">AIWholesail</span>
            </Link>
            <Link to="/pricing">
              <Button size="sm" className="rounded-full px-5 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Zap className="h-3.5 w-3.5" /> Start Free Trial
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative container mx-auto max-w-5xl px-4 pt-24 pb-28 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-6">Markets</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            Explore Every
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              US Market.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            AI-powered market intelligence for the top 50 US metros.
            Median prices, growth rates, top zips, and investment strategies.
          </p>
        </div>

        <div className="h-20 bg-gradient-to-b from-[#0a0a0a] to-background" />
      </section>

      {/* ===== SEARCH & FILTER ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search city or state..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-muted/30 border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            {/* Temperature filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {(['all', 'hot', 'warm', 'cool'] as TempFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTempFilter(t)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    tempFilter === t
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-muted/30 text-muted-foreground border border-border/50 hover:border-primary/20'
                  }`}
                >
                  {t === 'all' ? 'All Markets' : `${t.charAt(0).toUpperCase() + t.slice(1)}`}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground font-light mt-4">
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
                <div className="h-full bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 rounded-3xl p-7 hover:border-primary/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <Badge variant="outline" className={`text-[10px] border ${tempColors[city.marketTemp] || ''}`}>
                        <ThermometerSun className="h-2.5 w-2.5 mr-0.5" />
                        {tempLabels[city.marketTemp]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight mb-1 group-hover:text-primary transition-colors">
                    {city.city}, {city.state}
                  </h3>
                  <p className="text-xs text-muted-foreground font-light mb-5">{city.stateFull}</p>

                  <div className="mt-auto grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Median</span>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(city.medianHomePrice)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Growth</span>
                      </div>
                      <p className="text-sm font-semibold">{city.priceGrowth}%</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Rent</span>
                      </div>
                      <p className="text-sm font-semibold">${city.avgRent.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Investor types */}
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-border/30">
                    {city.investorTypes.map((type) => (
                      <Badge key={type} variant="outline" className="text-[10px] font-light border-border/50 text-muted-foreground">
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
              <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No markets found</p>
              <p className="text-sm text-muted-foreground font-light">Try a different search or filter.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA -- DARK ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#0f1a14] text-white py-32 px-4 overflow-hidden">
        <GradientOrbs variant="cta" />

        <div className="relative container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-6">Go Further</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Let AI find deals
            <br />
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              in any market.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans every market daily. AI-powered deal scoring, instant comps, and automated outreach -- all starting at $29/mo.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full px-10 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER -- DARK ===== */}
      <footer className="bg-[#0a0a0a] text-white border-t border-white/5 px-4 py-12">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight">AIWholesail</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/markets" className="hover:text-white transition-colors">Markets</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <p className="text-xs text-white/30">&copy; 2026 AIWholesail</p>
        </div>
      </footer>
    </div>
  );
}
