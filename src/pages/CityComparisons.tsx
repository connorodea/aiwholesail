import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, MapPin, Search, ChevronRight,
  DollarSign, TrendingUp, ThermometerSun, Shield,
  CheckCircle, Zap, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import cities from '@/data/cities.json';
import comparisons from '@/data/city-comparisons.json';

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

interface ComparisonPair {
  city1: string;
  city2: string;
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

function getCityBySlug(slug: string): City | undefined {
  return (cities as City[]).find((c) => c.slug === slug);
}

export default function CityComparisons() {
  const [query, setQuery] = useState('');

  const resolvedPairs = useMemo(() => {
    return (comparisons as ComparisonPair[])
      .map((pair) => {
        const c1 = getCityBySlug(pair.city1);
        const c2 = getCityBySlug(pair.city2);
        if (!c1 || !c2) return null;
        return { city1: c1, city2: c2, slug: `${c1.slug}-vs-${c2.slug}` };
      })
      .filter(Boolean) as { city1: City; city2: City; slug: string }[];
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return resolvedPairs;
    return resolvedPairs.filter(
      (pair) =>
        pair.city1.city.toLowerCase().includes(q) ||
        pair.city1.state.toLowerCase().includes(q) ||
        pair.city1.stateFull.toLowerCase().includes(q) ||
        pair.city2.city.toLowerCase().includes(q) ||
        pair.city2.state.toLowerCase().includes(q) ||
        pair.city2.stateFull.toLowerCase().includes(q)
    );
  }, [query, resolvedPairs]);

  return (
    <PublicLayout>
      <SEOHead
        title="City vs City -- Real Estate Investing Comparisons"
        description="Compare 50 US city pairs for real estate investing. Side-by-side analysis of median prices, rents, growth rates, and investment strategies for wholesaling, flipping, and rentals."
        keywords="city comparison real estate, best city for real estate investing, compare real estate markets, wholesale real estate markets, city vs city investing, real estate market comparison"
        canonicalUrl="https://aiwholesail.com/compare"
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            CITY COMPARISONS
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            City vs City
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              for Investors.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Compare 50 US market pairs side by side. Median prices, rents, growth rates, and the best
            investment strategy for every matchup.
          </p>
        </div>
      </section>

      {/* ===== SEARCH ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by city or state..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>
            <p className="text-sm text-neutral-400 font-light">
              {filtered.length} comparison{filtered.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>
      </section>

      {/* ===== COMPARISON GRID ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((pair) => (
              <Link key={pair.slug} to={`/compare/${pair.slug}`} className="group">
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  {/* Header: both city names */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                        Comparison
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Compare <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {pair.city1.city}, {pair.city1.state}
                    <span className="text-neutral-500 mx-2 text-base font-normal">vs</span>
                    {pair.city2.city}, {pair.city2.state}
                  </h3>

                  {/* Market temps */}
                  <div className="flex items-center gap-2 mt-2 mb-5">
                    <Badge variant="outline" className={`text-[10px] border ${tempColors[pair.city1.marketTemp] || ''}`}>
                      <ThermometerSun className="h-2.5 w-2.5 mr-0.5" />
                      {tempLabels[pair.city1.marketTemp]}
                    </Badge>
                    <span className="text-neutral-600 text-xs">vs</span>
                    <Badge variant="outline" className={`text-[10px] border ${tempColors[pair.city2.marketTemp] || ''}`}>
                      <ThermometerSun className="h-2.5 w-2.5 mr-0.5" />
                      {tempLabels[pair.city2.marketTemp]}
                    </Badge>
                  </div>

                  {/* Key metrics side by side */}
                  <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
                    <div>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <DollarSign className="h-2.5 w-2.5" /> Median Price
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-white">
                          {formatCurrency(pair.city1.medianHomePrice)}
                        </span>
                        <span className="text-xs text-neutral-500">vs</span>
                        <span className="text-sm font-semibold text-white">
                          {formatCurrency(pair.city2.medianHomePrice)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp className="h-2.5 w-2.5" /> Growth
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-white">{pair.city1.priceGrowth}%</span>
                        <span className="text-xs text-neutral-500">vs</span>
                        <span className="text-sm font-semibold text-white">{pair.city2.priceGrowth}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <MapPin className="h-10 w-10 text-neutral-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No comparisons found</p>
              <p className="text-sm text-neutral-400 font-light">Try a different search term.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">
              Explore More
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link
                to="/markets"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <MapPin className="h-4 w-4 text-cyan-400" /> All Markets
              </Link>
              <Link
                to="/tools"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <DollarSign className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link
                to="/guides"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <Users className="h-4 w-4 text-cyan-400" /> Investment Guides
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            Go Further
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Let AI find deals
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              in any market.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans every market daily. AI-powered deal scoring, instant comps, and automated
            outreach -- all starting at $29/mo.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" /> No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Cancel Anytime
            </span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
