import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight, Calculator,
  BookOpen, Search, ThermometerSun, Zap,
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

const strategyDetails: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
  wholesale: {
    icon: <Repeat className="h-5 w-5" />,
    label: 'Wholesaling',
    description: 'Assign contracts on undervalued properties for quick profit without owning the asset.',
  },
  flip: {
    icon: <Hammer className="h-5 w-5" />,
    label: 'Fix & Flip',
    description: 'Buy distressed properties, renovate them, and sell at market value for maximum returns.',
  },
  rental: {
    icon: <Building2 className="h-5 w-5" />,
    label: 'Buy & Hold Rentals',
    description: 'Acquire properties below market, hold for cash flow and long-term appreciation.',
  },
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

function getRelatedCities(current: City): City[] {
  const sameState = (cities as City[]).filter(
    (c) => c.slug !== current.slug && c.state === current.state
  );
  if (sameState.length >= 3) return sameState.slice(0, 3);

  const others = (cities as City[]).filter((c) => c.slug !== current.slug);
  const remaining = others.filter((c) => !sameState.includes(c));
  return [...sameState, ...remaining].slice(0, 3);
}

export default function MarketPage() {
  const { slug } = useParams<{ slug: string }>();
  const city = (cities as City[]).find((c) => c.slug === slug);

  if (!city) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Market Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find data for this market.</p>
          <Link to="/markets">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All Markets
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const related = getRelatedCities(city);
  const grossYield = ((city.avgRent * 12) / city.medianHomePrice * 100).toFixed(1);

  const stats = [
    { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${city.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${city.priceGrowth}%`, icon: TrendingUp },
    { label: 'Population', value: formatNumber(city.population), icon: Users },
    { label: 'Gross Rental Yield', value: `${grossYield}%`, icon: Building2 },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`${city.city}, ${city.state} Real Estate Wholesale Market`}
        description={`Find profitable wholesale real estate deals in ${city.city}, ${city.stateFull}. Median home price ${formatCurrency(city.medianHomePrice)}, ${city.priceGrowth}% growth. AI-powered deal scoring for ${city.city} investors.`}
        keywords={`${city.city} wholesale real estate, ${city.city} investment properties, ${city.city} ${city.state} real estate deals, wholesale deals ${city.city}, flip houses ${city.city}, rental properties ${city.city}`}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/markets" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <MapPin className="h-4 w-4" />
              <span>All Markets</span>
            </Link>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${tempColors[city.marketTemp] || ''}`}>
            <ThermometerSun className="h-3 w-3 mr-1" />
            {tempLabels[city.marketTemp] || city.marketTemp}
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {city.city}, {city.state}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Real Estate Market.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            AI-powered deal finding and market intelligence for {city.city}, {city.stateFull}.
            Median home price {formatCurrency(city.medianHomePrice)} with {city.priceGrowth}% annual growth.
          </p>
        </div>
      </section>

      {/* ===== MARKET STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {city.city} by the numbers.
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

      {/* ===== TOP ZIP CODES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Top Zip Codes</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Hottest zips in {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            These zip codes show the highest deal activity and investor interest in the {city.city} metro area.
          </p>

          <div className="flex flex-wrap gap-3">
            {city.topZips.map((zip) => (
              <div
                key={zip}
                className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl px-6 py-4 hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span className="text-lg font-bold tracking-tight text-white">{zip}</span>
                </div>
                <p className="text-xs text-neutral-400 font-light mt-1">{city.city}, {city.state}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INVESTMENT STRATEGIES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Investment Strategies</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            How to invest in {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            These strategies are actively producing returns for investors in the {city.city}, {city.state} market.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {city.investorTypes.map((type) => {
              const detail = strategyDetails[type];
              if (!detail) return null;
              return (
                <div
                  key={type}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                    {detail.icon}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-white mb-3">{detail.label}</h3>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">{detail.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link to="/blog" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Blog & Guides
              </Link>
              <Link to="/use-cases" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Search className="h-4 w-4 text-cyan-400" /> Use Cases
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED MARKETS ===== */}
      {related.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related Markets</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">Nearby markets to explore.</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.slug} to={`/markets/${r.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${tempColors[r.marketTemp] || ''}`}>
                        {tempLabels[r.marketTemp]}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {r.city}, {r.state}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                      Median {formatCurrency(r.medianHomePrice)} &middot; {r.priceGrowth}% growth
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View market <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans the {city.city} market daily. Get AI-powered deal scoring, instant comps, and automated seller outreach.
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
