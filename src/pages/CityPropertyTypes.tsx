import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, ChevronRight, Search,
  ThermometerSun, Shield, CheckCircle,
  Building2, Home, Mountain, Caravan, Warehouse,
  Building, Store, LayoutGrid,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import cities from '@/data/cities.json';
import propertyTypes from '@/data/property-types.json';

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

interface PropertyType {
  slug: string;
  name: string;
  h1: string;
  description: string;
  keywords: string;
  icon: string;
  overview: string;
  investmentThesis: string;
  typicalReturns: { capRate: string; cashOnCash: string; appreciation: string };
  bestMarkets: string[];
  financingOptions: string[];
  prosAndCons: { pros: string[]; cons: string[] };
  relatedTools: string[];
  relatedGuides: string[];
}

const iconMap: Record<string, React.ReactNode> = {
  Building2: <Building2 className="h-8 w-8 text-cyan-400" />,
  Home: <Home className="h-8 w-8 text-cyan-400" />,
  Mountain: <Mountain className="h-8 w-8 text-cyan-400" />,
  Caravan: <Caravan className="h-8 w-8 text-cyan-400" />,
  Warehouse: <Warehouse className="h-8 w-8 text-cyan-400" />,
  Building: <Building className="h-8 w-8 text-cyan-400" />,
  Store: <Store className="h-8 w-8 text-cyan-400" />,
  LayoutGrid: <LayoutGrid className="h-8 w-8 text-cyan-400" />,
};

const tempColors: Record<string, string> = {
  hot: 'bg-red-500/10 text-red-500 border-red-500/20',
  warm: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  cool: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const tempLabels: Record<string, string> = {
  hot: 'Hot Market',
  warm: 'Warm Market',
  cool: 'Cool Market',
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

type SortKey = 'city' | 'price' | 'growth' | 'rent';
type TempFilter = 'all' | 'hot' | 'warm' | 'cool';

export default function CityPropertyTypes() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const pt = (propertyTypes as PropertyType[]).find((p) => p.slug === typeSlug);

  const [query, setQuery] = useState('');
  const [tempFilter, setTempFilter] = useState<TempFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('city');

  const filtered = useMemo(() => {
    let list = (cities as City[]).slice();
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.stateFull.toLowerCase().includes(q) ||
          c.slug.includes(q)
      );
    }
    if (tempFilter !== 'all') {
      list = list.filter((c) => c.marketTemp === tempFilter);
    }
    switch (sortBy) {
      case 'price':
        list.sort((a, b) => a.medianHomePrice - b.medianHomePrice);
        break;
      case 'growth':
        list.sort((a, b) => b.priceGrowth - a.priceGrowth);
        break;
      case 'rent':
        list.sort((a, b) => b.avgRent - a.avgRent);
        break;
      default:
        list.sort((a, b) => a.city.localeCompare(b.city));
    }
    return list;
  }, [query, tempFilter, sortBy]);

  if (!pt) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Property Type Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find this property type.</p>
          <Link to="/property-types">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <Building2 className="h-4 w-4" /> Browse All Property Types
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const otherTypes = (propertyTypes as PropertyType[]).filter((p) => p.slug !== pt.slug);

  return (
    <PublicLayout>
      <SEOHead
        title={`${pt.name} Investing -- All 264 Markets | AIWholesail`}
        description={`Find the best markets for ${pt.name.toLowerCase()} investing. Compare ${(cities as City[]).length} cities by median price, rent, growth, and market temperature.`}
        keywords={`${pt.name.toLowerCase()} investing, ${pt.name.toLowerCase()} markets, best cities for ${pt.slug}, ${pt.keywords}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Property Types', url: 'https://aiwholesail.com/property-types' },
          { name: pt.name, url: `https://aiwholesail.com/invest-in/${pt.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/property-types" className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              <Building2 className="h-3.5 w-3.5" />
              <span>Property Types</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <span className="text-sm text-white/70">{pt.name}</span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-6">
            {iconMap[pt.icon] || <Building2 className="h-8 w-8 text-cyan-400" />}
          </div>

          <Badge variant="outline" className="text-xs border-cyan-500/20 text-cyan-400 mb-6">
            {(cities as City[]).length} Markets
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {pt.name} Investing
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Across America.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Compare {(cities as City[]).length} markets for {pt.name.toLowerCase()} investing.
            Find the cities with the best fundamentals for your strategy.
          </p>
        </div>
      </section>

      {/* ===== FILTERS ===== */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search cities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-900/50 border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'hot', 'warm', 'cool'] as TempFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTempFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    tempFilter === t
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                      : 'border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {t === 'all' ? 'All' : tempLabels[t]}
                </button>
              ))}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-white/[0.08] bg-neutral-900/50 text-neutral-400 focus:outline-none focus:border-cyan-500/30"
              >
                <option value="city">Sort: A-Z</option>
                <option value="price">Sort: Price (Low-High)</option>
                <option value="growth">Sort: Growth (High-Low)</option>
                <option value="rent">Sort: Rent (High-Low)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ===== BEST MARKETS (highlighted) ===== */}
      {pt.bestMarkets.length > 0 && tempFilter === 'all' && !query && (
        <section className="pb-8 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Top Markets</p>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">
              Best markets for {pt.name.toLowerCase()}.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {pt.bestMarkets.map((slug) => {
                const c = (cities as City[]).find((city) => city.slug === slug);
                if (!c) return null;
                return (
                  <Link key={c.slug} to={`/invest-in/${pt.slug}/${c.slug}`} className="group">
                    <div className="border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent rounded-xl p-6 hover:border-cyan-500/40 transition-all duration-300 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-cyan-400" />
                        <Badge variant="outline" className={`text-[10px] border ${tempColors[c.marketTemp] || ''}`}>
                          {tempLabels[c.marketTemp]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-cyan-500/20 text-cyan-400">
                          Recommended
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                        {c.city}, {c.state}
                      </h3>
                      <p className="text-sm text-neutral-400 font-light mb-2 flex-1">
                        Median {formatCurrency(c.medianHomePrice)} &middot; {c.priceGrowth}% growth &middot; ${c.avgRent.toLocaleString()}/mo rent
                      </p>
                      <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        View {pt.name.toLowerCase()} analysis <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== ALL CITIES GRID ===== */}
      <section className="py-8 px-4 pb-20">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-neutral-400">
              {filtered.length} {filtered.length === 1 ? 'market' : 'markets'} found
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((c) => (
              <Link key={c.slug} to={`/invest-in/${pt.slug}/${c.slug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <Badge variant="outline" className={`text-[10px] border ${tempColors[c.marketTemp] || ''}`}>
                      {tempLabels[c.marketTemp]}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {c.city}, {c.state}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-1">
                    Median {formatCurrency(c.medianHomePrice)}
                  </p>
                  <p className="text-xs text-neutral-500 font-light flex-1">
                    {c.priceGrowth}% growth &middot; ${c.avgRent.toLocaleString()}/mo rent &middot; Pop. {formatNumber(c.population)}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    View analysis <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-neutral-400 text-lg">No markets match your search.</p>
              <button
                onClick={() => { setQuery(''); setTempFilter('all'); }}
                className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ===== OTHER PROPERTY TYPES ===== */}
      <section className="py-16 px-4 border-t border-white/[0.05]">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Other Property Types</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
            Explore other property types.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherTypes.map((op) => (
              <Link key={op.slug} to={`/invest-in/${op.slug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    {iconMap[op.icon] ? (
                      <span className="[&>svg]:h-5 [&>svg]:w-5">{iconMap[op.icon]}</span>
                    ) : (
                      <Building2 className="h-5 w-5 text-cyan-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {op.name}
                  </h3>
                  <p className="text-xs text-neutral-500 font-light flex-1">
                    {op.typicalReturns.capRate} cap rate &middot; {op.typicalReturns.cashOnCash} CoC
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore markets <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Ready to invest in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {pt.name.toLowerCase()}?
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps, and market intelligence
            to find profitable {pt.name.toLowerCase()} deals in any market.
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
