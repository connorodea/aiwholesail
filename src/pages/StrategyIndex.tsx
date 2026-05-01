import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, ChevronRight, Search,
  Building2, Repeat, Hammer, ThermometerSun, RefreshCw,
  BookOpen, Calculator,
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

const STRATEGIES = ['wholesale', 'flip', 'rental', 'brrrr'] as const;
type Strategy = (typeof STRATEGIES)[number];

interface StrategyMeta {
  label: string;
  fullLabel: string;
  icon: React.ReactNode;
  description: string;
  longDescription: string;
  guideSlug: string;
  toolPath: string;
  toolLabel: string;
}

const strategyMeta: Record<Strategy, StrategyMeta> = {
  wholesale: {
    label: 'Wholesale',
    fullLabel: 'Wholesale Real Estate',
    icon: <Repeat className="h-5 w-5" />,
    description: 'Find and assign contracts on undervalued properties for quick profit without owning the asset.',
    longDescription: 'Wholesaling is the fastest way to start in real estate investing. Find motivated sellers, lock properties under contract at a discount, and assign those contracts to cash buyers for an assignment fee. No rehab, no tenants, no long-term risk.',
    guideSlug: 'wholesale-real-estate-beginners-guide',
    toolPath: '/tools/wholesale-deal-calculator',
    toolLabel: 'Wholesale Deal Calculator',
  },
  flip: {
    label: 'Fix & Flip',
    fullLabel: 'Fix & Flip',
    icon: <Hammer className="h-5 w-5" />,
    description: 'Buy distressed properties, renovate strategically, and sell at market value for maximum returns.',
    longDescription: 'Fix and flip investing targets distressed properties that can be purchased below market value, renovated with a controlled rehab budget, and sold at or above ARV. Success requires accurate deal analysis, reliable contractors, and fast execution.',
    guideSlug: 'how-to-analyze-real-estate-deals',
    toolPath: '/tools/arv-calculator',
    toolLabel: 'ARV Calculator',
  },
  rental: {
    label: 'Rental',
    fullLabel: 'Rental Property Investing',
    icon: <Building2 className="h-5 w-5" />,
    description: 'Acquire properties below market, hold for cash flow and long-term appreciation.',
    longDescription: 'Buy-and-hold rental investing builds lasting wealth through monthly cash flow, loan paydown, tax benefits, and long-term appreciation. Target markets with strong rent-to-price ratios, population growth, and economic diversification.',
    guideSlug: 'rental-property-investing-guide',
    toolPath: '/tools/cash-flow-calculator',
    toolLabel: 'Cash Flow Calculator',
  },
  brrrr: {
    label: 'BRRRR',
    fullLabel: 'BRRRR Method',
    icon: <RefreshCw className="h-5 w-5" />,
    description: 'Buy, Rehab, Rent, Refinance, Repeat. Recycle capital to scale your portfolio rapidly.',
    longDescription: 'The BRRRR method combines fix-and-flip execution with buy-and-hold ownership. Purchase a distressed property, rehab it to increase value, rent it out, refinance to pull your capital back out, and repeat the process. This strategy lets you build a rental portfolio while recycling the same capital.',
    guideSlug: 'brrrr-method-explained',
    toolPath: '/tools/brrrr-calculator',
    toolLabel: 'BRRRR Calculator',
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

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function StrategyIndex() {
  const { strategy } = useParams<{ strategy: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  const validStrategy = STRATEGIES.includes(strategy as Strategy) ? (strategy as Strategy) : null;

  const allCities = cities as City[];
  const totalCities = allCities.length;

  const filteredCities = useMemo(() => {
    if (!searchQuery) return allCities;
    const q = searchQuery.toLowerCase();
    return allCities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.stateFull.toLowerCase().includes(q)
    );
  }, [searchQuery, allCities]);

  if (!validStrategy) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Strategy Not Found</h1>
          <p className="text-neutral-400 mb-6">
            Invalid investment strategy. Choose wholesale, flip, rental, or brrrr.
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

  const meta = strategyMeta[validStrategy];
  const otherStrategies = STRATEGIES.filter((s) => s !== validStrategy);

  const hotCities = filteredCities.filter((c) => c.marketTemp === 'hot');
  const warmCities = filteredCities.filter((c) => c.marketTemp === 'warm');
  const coolCities = filteredCities.filter((c) => c.marketTemp === 'cool');

  return (
    <PublicLayout>
      <SEOHead
        title={`${meta.fullLabel}: Find Deals in ${totalCities} Markets`}
        description={`${meta.fullLabel} opportunities across ${totalCities} US markets. ${meta.description} Browse cities by market temperature, median price, and growth rate.`}
        keywords={`${meta.fullLabel.toLowerCase()}, ${meta.label.toLowerCase()} real estate, ${meta.label.toLowerCase()} investing, ${meta.label.toLowerCase()} properties, real estate ${meta.label.toLowerCase()} markets, best cities for ${meta.label.toLowerCase()}`}
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

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-6">
            {meta.icon}
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {meta.fullLabel}:
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {totalCities} Markets.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {meta.longDescription}
          </p>
        </div>
      </section>

      {/* ===== QUICK LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Resources</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Link to={`/guides/${meta.guideSlug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> {meta.fullLabel} Guide
              </Link>
              <Link to={meta.toolPath} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> {meta.toolLabel}
              </Link>
              {otherStrategies.map((s) => (
                <Link key={s} to={`/invest/${s}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                  {strategyMeta[s].icon} {strategyMeta[s].fullLabel}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SEARCH ===== */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by city or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-neutral-400 mt-3">
              {filteredCities.length} market{filteredCities.length !== 1 ? 's' : ''} matching &ldquo;{searchQuery}&rdquo;
            </p>
          )}
        </div>
      </section>

      {/* ===== HOT MARKETS ===== */}
      {hotCities.length > 0 && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className={`text-xs border ${tempColors.hot}`}>
                <ThermometerSun className="h-3 w-3 mr-1" />
                Hot Markets
              </Badge>
              <span className="text-sm text-neutral-500">{hotCities.length} cities</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {hotCities.map((c) => (
                <Link key={c.slug} to={`/invest/${validStrategy}/${c.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${tempColors.hot}`}>
                        Hot
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {c.city}, {c.state}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                      Median {formatCurrency(c.medianHomePrice)} &middot; {c.priceGrowth}% growth
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View {meta.label.toLowerCase()} strategy <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== WARM MARKETS ===== */}
      {warmCities.length > 0 && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className={`text-xs border ${tempColors.warm}`}>
                <ThermometerSun className="h-3 w-3 mr-1" />
                Warm Markets
              </Badge>
              <span className="text-sm text-neutral-500">{warmCities.length} cities</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {warmCities.map((c) => (
                <Link key={c.slug} to={`/invest/${validStrategy}/${c.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${tempColors.warm}`}>
                        Warm
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {c.city}, {c.state}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                      Median {formatCurrency(c.medianHomePrice)} &middot; {c.priceGrowth}% growth
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View {meta.label.toLowerCase()} strategy <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== COOL MARKETS ===== */}
      {coolCities.length > 0 && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="outline" className={`text-xs border ${tempColors.cool}`}>
                <ThermometerSun className="h-3 w-3 mr-1" />
                Cool Markets
              </Badge>
              <span className="text-sm text-neutral-500">{coolCities.length} cities</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {coolCities.map((c) => (
                <Link key={c.slug} to={`/invest/${validStrategy}/${c.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${tempColors.cool}`}>
                        Cool
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {c.city}, {c.state}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                      Median {formatCurrency(c.medianHomePrice)} &middot; {c.priceGrowth}% growth
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View {meta.label.toLowerCase()} strategy <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {filteredCities.length === 0 && searchQuery && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl text-center">
            <p className="text-neutral-400">No markets match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Start {meta.label.toLowerCase()} investing
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              with AI today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail covers {totalCities} markets nationwide. Get AI-powered deal scoring, instant comps, and automated seller outreach for your {meta.label.toLowerCase()} business.
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
