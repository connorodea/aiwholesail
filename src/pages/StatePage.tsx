import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight,
  ThermometerSun, Search, BarChart3, RefreshCw,
  Shield, CheckCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
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
  hot: 'Hot Market',
  warm: 'Warm Market',
  cool: 'Cool Market',
};

const strategyIcons: Record<string, React.ReactNode> = {
  wholesale: <Repeat className="h-3.5 w-3.5" />,
  flip: <Hammer className="h-3.5 w-3.5" />,
  rental: <Building2 className="h-3.5 w-3.5" />,
  brrrr: <RefreshCw className="h-3.5 w-3.5" />,
};

const strategyLabels: Record<string, string> = {
  wholesale: 'Wholesale',
  flip: 'Fix & Flip',
  rental: 'Rental',
  brrrr: 'BRRRR',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function slugifyState(stateFull: string): string {
  return stateFull.toLowerCase().replace(/\s+/g, '-');
}

function unslugifyState(slug: string): string {
  return slug.replace(/-/g, ' ');
}

export default function StatePage() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  const stateCities = useMemo(() => {
    if (!stateSlug) return [];
    return (cities as City[]).filter(
      (c) => slugifyState(c.stateFull) === stateSlug
    );
  }, [stateSlug]);

  const stateFullName = stateCities.length > 0 ? stateCities[0].stateFull : null;
  const stateAbbrev = stateCities.length > 0 ? stateCities[0].state : null;

  if (!stateFullName || stateCities.length === 0) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">State Not Found</h1>
          <p className="text-neutral-400 mb-6">
            We could not find market data for &ldquo;{stateSlug ? unslugifyState(stateSlug) : 'this state'}&rdquo;.
          </p>
          <Link to="/markets">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All Markets
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const filteredCities = stateCities.filter(
    (c) => c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const avgMedianPrice = Math.round(
    stateCities.reduce((sum, c) => sum + c.medianHomePrice, 0) / stateCities.length
  );
  const avgRent = Math.round(
    stateCities.reduce((sum, c) => sum + c.avgRent, 0) / stateCities.length
  );
  const totalPop = stateCities.reduce((sum, c) => sum + c.population, 0);
  const avgGrowth = (
    stateCities.reduce((sum, c) => sum + c.priceGrowth, 0) / stateCities.length
  ).toFixed(1);

  const hotCount = stateCities.filter((c) => c.marketTemp === 'hot').length;
  const warmCount = stateCities.filter((c) => c.marketTemp === 'warm').length;
  const coolCount = stateCities.filter((c) => c.marketTemp === 'cool').length;

  const topCities = [...stateCities].sort((a, b) => b.population - a.population).slice(0, 4);

  const stats = [
    { label: 'Markets Tracked', value: `${stateCities.length}`, icon: MapPin },
    { label: 'Avg. Median Price', value: formatCurrency(avgMedianPrice), icon: DollarSign },
    { label: 'Avg. Rent', value: `$${avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Total Population', value: formatNumber(totalPop), icon: Users },
    { label: 'Avg. Price Growth', value: `${avgGrowth}%`, icon: TrendingUp },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`Real Estate Investing in ${stateFullName} -- ${stateCities.length} Markets`}
        description={`Explore real estate investing opportunities across ${stateCities.length} markets in ${stateFullName}. Average median price ${formatCurrency(avgMedianPrice)}, average rent $${avgRent.toLocaleString()}/mo. Find wholesale, flip, rental, and BRRRR deals.`}
        keywords={`real estate investing ${stateFullName}, ${stateFullName} investment properties, ${stateFullName} wholesale real estate, ${stateFullName} rental properties, ${stateAbbrev} real estate market, ${stateFullName} fix and flip`}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/markets" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <MapPin className="h-4 w-4" />
              <span>All Markets</span>
            </Link>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate Investing in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {stateFullName}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {stateCities.length} markets tracked across {stateFullName}. Average median price {formatCurrency(avgMedianPrice)} with {avgGrowth}% annual growth.
          </p>
        </div>
      </section>

      {/* ===== STATE STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">State Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {stateFullName} by the numbers.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">{stat.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== MARKET TEMPERATURE BREAKDOWN ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Temperature</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            {stateFullName} market breakdown.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Market temperature indicates overall investor demand, price momentum, and deal velocity.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { temp: 'hot', count: hotCount, label: 'Hot Markets', desc: 'High demand, fast-moving deals, strong price momentum.' },
              { temp: 'warm', count: warmCount, label: 'Warm Markets', desc: 'Balanced supply and demand, steady growth, consistent deal flow.' },
              { temp: 'cool', count: coolCount, label: 'Cool Markets', desc: 'Lower competition, negotiation leverage, emerging opportunity.' },
            ].map((item) => (
              <div
                key={item.temp}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <ThermometerSun className="h-5 w-5 text-cyan-400" />
                  </div>
                  <Badge variant="outline" className={`text-xs border ${tempColors[item.temp]}`}>
                    {item.label}
                  </Badge>
                </div>
                <div className="text-4xl font-bold tracking-tight text-white mb-2">{item.count}</div>
                <p className="text-sm text-neutral-400 font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STRATEGY LINKS FOR TOP CITIES ===== */}
      {topCities.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Top Markets</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
              Strategy pages for top {stateFullName} cities.
            </h2>
            <p className="text-neutral-400 font-light mb-10 max-w-xl">
              Explore detailed strategy breakdowns for the largest markets in {stateFullName}.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {topCities.map((c) => (
                <div
                  key={c.slug}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-lg font-bold tracking-tight text-white">{c.city}, {c.state}</h3>
                    <Badge variant="outline" className={`text-[10px] border ml-auto ${tempColors[c.marketTemp] || ''}`}>
                      {tempLabels[c.marketTemp]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['wholesale', 'flip', 'rental', 'brrrr'] as const).map((s) => (
                      <Link
                        key={s}
                        to={`/invest/${s}/${c.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] rounded-md text-xs text-neutral-400 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                      >
                        {strategyIcons[s]} {strategyLabels[s]}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== ALL CITIES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">All Markets</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            {stateFullName} markets.
          </h2>
          <p className="text-neutral-400 font-light mb-6 max-w-xl">
            Browse all {stateCities.length} tracked markets in {stateFullName}.
          </p>

          {stateCities.length > 4 && (
            <div className="relative max-w-md mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder={`Search ${stateFullName} cities...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
              />
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCities.map((c) => (
              <Link key={c.slug} to={`/markets/${c.slug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <Badge variant="outline" className={`text-[10px] border ${tempColors[c.marketTemp] || ''}`}>
                      {tempLabels[c.marketTemp]}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {c.city}, {c.state}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-3">
                    Median {formatCurrency(c.medianHomePrice)} &middot; Rent ${c.avgRent.toLocaleString()}/mo &middot; {c.priceGrowth}% growth
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {c.investorTypes.map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1 px-2 py-0.5 border border-white/[0.06] rounded text-[10px] text-neutral-500"
                      >
                        {strategyIcons[type]} {strategyLabels[type]}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    View market <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredCities.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <p className="text-neutral-400">No cities match &ldquo;{searchQuery}&rdquo; in {stateFullName}.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find deals across
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {stateFullName} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail covers {stateCities.length} markets in {stateFullName}. Get AI-powered deal scoring, instant comps, and automated seller outreach.
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
