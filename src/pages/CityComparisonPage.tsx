import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, Check, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight, Calculator,
  ThermometerSun, Shield, CheckCircle, Star, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function rentToPriceRatio(rent: number, price: number): string {
  return ((rent / price) * 100).toFixed(2);
}

type Strategy = 'wholesale' | 'flip' | 'rental' | 'brrrr';

interface StrategyInfo {
  label: string;
  icon: React.ReactNode;
  evaluate: (city: City) => { score: number; reason: string };
}

const strategies: Record<Strategy, StrategyInfo> = {
  wholesale: {
    label: 'Wholesaling',
    icon: <Repeat className="h-4 w-4" />,
    evaluate: (city: City) => {
      let score = 0;
      if (city.medianHomePrice < 350000) score += 3;
      else if (city.medianHomePrice < 500000) score += 2;
      else score += 1;
      if (city.population > 500000) score += 2;
      else if (city.population > 200000) score += 1;
      if (city.investorTypes.includes('wholesale')) score += 2;
      if (city.marketTemp === 'warm') score += 1;
      const reasons: string[] = [];
      if (city.medianHomePrice < 350000) reasons.push('affordable entry point');
      if (city.investorTypes.includes('wholesale')) reasons.push('active wholesale market');
      if (city.population > 500000) reasons.push('large buyer pool');
      return { score, reason: reasons.length > 0 ? reasons.join(', ') : 'moderate opportunity' };
    },
  },
  flip: {
    label: 'Fix & Flip',
    icon: <Hammer className="h-4 w-4" />,
    evaluate: (city: City) => {
      let score = 0;
      if (city.priceGrowth > 4) score += 3;
      else if (city.priceGrowth > 3) score += 2;
      else score += 1;
      if (city.medianHomePrice < 400000) score += 2;
      else if (city.medianHomePrice < 600000) score += 1;
      if (city.investorTypes.includes('flip')) score += 2;
      const reasons: string[] = [];
      if (city.priceGrowth > 4) reasons.push('strong appreciation');
      if (city.medianHomePrice < 400000) reasons.push('lower rehab cost basis');
      if (city.investorTypes.includes('flip')) reasons.push('proven flip market');
      return { score, reason: reasons.length > 0 ? reasons.join(', ') : 'moderate opportunity' };
    },
  },
  rental: {
    label: 'Buy & Hold Rental',
    icon: <Building2 className="h-4 w-4" />,
    evaluate: (city: City) => {
      let score = 0;
      const rtp = (city.avgRent / city.medianHomePrice) * 100;
      if (rtp > 0.6) score += 3;
      else if (rtp > 0.45) score += 2;
      else score += 1;
      if (city.population > 300000) score += 1;
      if (city.priceGrowth > 3) score += 1;
      if (city.investorTypes.includes('rental')) score += 2;
      const reasons: string[] = [];
      if (rtp > 0.6) reasons.push('excellent rent-to-price ratio');
      if (city.investorTypes.includes('rental')) reasons.push('strong rental demand');
      if (city.priceGrowth > 3) reasons.push('healthy appreciation');
      return { score, reason: reasons.length > 0 ? reasons.join(', ') : 'moderate opportunity' };
    },
  },
  brrrr: {
    label: 'BRRRR',
    icon: <Home className="h-4 w-4" />,
    evaluate: (city: City) => {
      let score = 0;
      if (city.medianHomePrice < 300000) score += 3;
      else if (city.medianHomePrice < 450000) score += 2;
      else score += 1;
      const rtp = (city.avgRent / city.medianHomePrice) * 100;
      if (rtp > 0.55) score += 2;
      else if (rtp > 0.4) score += 1;
      if (city.priceGrowth > 3.5) score += 2;
      else if (city.priceGrowth > 2.5) score += 1;
      const reasons: string[] = [];
      if (city.medianHomePrice < 300000) reasons.push('low acquisition cost');
      if (rtp > 0.55) reasons.push('strong cash flow potential');
      if (city.priceGrowth > 3.5) reasons.push('good forced equity opportunity');
      return { score, reason: reasons.length > 0 ? reasons.join(', ') : 'moderate opportunity' };
    },
  },
};

interface MetricRow {
  label: string;
  icon: React.ReactNode;
  value1: string;
  value2: string;
  raw1: number;
  raw2: number;
  higherIsBetter: boolean;
}

function WinnerBadge({ isWinner }: { isWinner: boolean }) {
  if (!isWinner) return null;
  return (
    <span className="inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
      <Check className="h-2.5 w-2.5" /> Better
    </span>
  );
}

export default function CityComparisonPage() {
  const { slug } = useParams<{ slug: string }>();

  // Parse "atlanta-ga-vs-houston-tx"
  const parts = slug?.split('-vs-') || [];
  const city1Slug = parts[0] || '';
  const city2Slug = parts[1] || '';

  const city1 = (cities as City[]).find((c) => c.slug === city1Slug);
  const city2 = (cities as City[]).find((c) => c.slug === city2Slug);

  if (!city1 || !city2) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Comparison Not Found</h1>
          <p className="text-neutral-400 mb-6">
            We could not find one or both cities for this comparison.
          </p>
          <Link to="/compare">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Comparisons
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const city1Name = `${city1.city}, ${city1.state}`;
  const city2Name = `${city2.city}, ${city2.state}`;

  const rtp1 = rentToPriceRatio(city1.avgRent, city1.medianHomePrice);
  const rtp2 = rentToPriceRatio(city2.avgRent, city2.medianHomePrice);

  const metrics: MetricRow[] = [
    {
      label: 'Median Home Price',
      icon: <DollarSign className="h-4 w-4 text-neutral-500" />,
      value1: formatCurrency(city1.medianHomePrice),
      value2: formatCurrency(city2.medianHomePrice),
      raw1: city1.medianHomePrice,
      raw2: city2.medianHomePrice,
      higherIsBetter: false,
    },
    {
      label: 'Average Rent',
      icon: <Building2 className="h-4 w-4 text-neutral-500" />,
      value1: `$${city1.avgRent.toLocaleString()}/mo`,
      value2: `$${city2.avgRent.toLocaleString()}/mo`,
      raw1: city1.avgRent,
      raw2: city2.avgRent,
      higherIsBetter: true,
    },
    {
      label: 'Price Growth (YoY)',
      icon: <TrendingUp className="h-4 w-4 text-neutral-500" />,
      value1: `${city1.priceGrowth}%`,
      value2: `${city2.priceGrowth}%`,
      raw1: city1.priceGrowth,
      raw2: city2.priceGrowth,
      higherIsBetter: true,
    },
    {
      label: 'Population',
      icon: <Users className="h-4 w-4 text-neutral-500" />,
      value1: formatPop(city1.population),
      value2: formatPop(city2.population),
      raw1: city1.population,
      raw2: city2.population,
      higherIsBetter: true,
    },
    {
      label: 'Rent-to-Price Ratio',
      icon: <Home className="h-4 w-4 text-neutral-500" />,
      value1: `${rtp1}%`,
      value2: `${rtp2}%`,
      raw1: parseFloat(rtp1),
      raw2: parseFloat(rtp2),
      higherIsBetter: true,
    },
    {
      label: 'Market Temperature',
      icon: <ThermometerSun className="h-4 w-4 text-neutral-500" />,
      value1: tempLabels[city1.marketTemp] || city1.marketTemp,
      value2: tempLabels[city2.marketTemp] || city2.marketTemp,
      raw1: city1.marketTemp === 'hot' ? 3 : city1.marketTemp === 'warm' ? 2 : 1,
      raw2: city2.marketTemp === 'hot' ? 3 : city2.marketTemp === 'warm' ? 2 : 1,
      higherIsBetter: true,
    },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`${city1.city} vs ${city2.city} for Real Estate Investing -- Which Is Better?`}
        description={`Compare ${city1Name} vs ${city2Name} for real estate investing. Side-by-side analysis of median prices, rent, growth, and best investment strategies for wholesaling, flipping, and rentals.`}
        keywords={`${city1.city} vs ${city2.city} real estate, ${city1Name} vs ${city2Name} investing, best city for real estate investing, ${city1.city} real estate market, ${city2.city} real estate market, wholesale real estate ${city1.city}, wholesale real estate ${city2.city}`}
        canonicalUrl={`https://aiwholesail.com/compare/${city1.slug}-vs-${city2.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com/' },
          { name: 'City Comparisons', url: 'https://aiwholesail.com/compare' },
          { name: `${city1.city} vs ${city2.city}`, url: `https://aiwholesail.com/compare/${city1.slug}-vs-${city2.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            CITY COMPARISON
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {city1.city}
            <span className="text-neutral-500 mx-3">vs</span>
            <br className="md:hidden" />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city2.city}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Which city is better for real estate investing? Compare median prices, rents, growth rates, and investment
            strategies side by side.
          </p>

          {/* Quick stat pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <div className="flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-full text-sm text-neutral-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              {city1.city}, {city1.state}
            </div>
            <div className="text-neutral-600 text-sm flex items-center">vs</div>
            <div className="flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-full text-sm text-neutral-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              {city2.city}, {city2.state}
            </div>
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Key Metrics
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12">
            Side-by-side comparison.
          </h2>

          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="text-sm font-semibold text-white">Metric</div>
              <div className="text-sm font-semibold text-center text-cyan-400">{city1Name}</div>
              <div className="text-sm font-semibold text-center text-cyan-400">{city2Name}</div>
            </div>

            {/* Rows */}
            {metrics.map((row, i) => {
              const winner1 = row.higherIsBetter ? row.raw1 > row.raw2 : row.raw1 < row.raw2;
              const winner2 = row.higherIsBetter ? row.raw2 > row.raw1 : row.raw2 < row.raw1;
              const tie = row.raw1 === row.raw2;

              return (
                <div
                  key={row.label}
                  className={`grid grid-cols-3 gap-4 px-6 py-4 ${
                    i < metrics.length - 1 ? 'border-b border-white/[0.06]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-light text-neutral-300">
                    {row.icon}
                    {row.label}
                  </div>
                  <div className="flex items-center justify-center text-sm">
                    <span className={winner1 && !tie ? 'text-emerald-400 font-semibold' : 'text-neutral-400 font-light'}>
                      {row.value1}
                    </span>
                    {winner1 && !tie && <WinnerBadge isWinner />}
                  </div>
                  <div className="flex items-center justify-center text-sm">
                    <span className={winner2 && !tie ? 'text-emerald-400 font-semibold' : 'text-neutral-400 font-light'}>
                      {row.value2}
                    </span>
                    {winner2 && !tie && <WinnerBadge isWinner />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== INVESTMENT STRATEGY COMPARISON ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            Strategy Breakdown
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Best investment strategy for each city.
          </h2>
          <p className="text-neutral-400 font-light mb-12 max-w-2xl">
            We evaluate each city across four core strategies: wholesaling, fix &amp; flip, buy &amp; hold rental, and BRRRR.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {(Object.entries(strategies) as [Strategy, StrategyInfo][]).map(([key, strat]) => {
              const eval1 = strat.evaluate(city1);
              const eval2 = strat.evaluate(city2);
              const winner = eval1.score > eval2.score ? city1 : eval2.score > eval1.score ? city2 : null;

              return (
                <div
                  key={key}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                      {strat.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{strat.label}</h3>
                      {winner && (
                        <span className="text-xs text-emerald-400 font-medium">
                          {winner.city}, {winner.state} is stronger
                        </span>
                      )}
                      {!winner && (
                        <span className="text-xs text-amber-400 font-medium">Tied</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* City 1 */}
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${eval1.score >= eval2.score ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {city1Name}
                          <span className="ml-2 text-xs text-neutral-500">{eval1.score}/7</span>
                        </p>
                        <p className="text-xs text-neutral-400 font-light capitalize">{eval1.reason}</p>
                      </div>
                    </div>

                    {/* City 2 */}
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${eval2.score >= eval1.score ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {city2Name}
                          <span className="ml-2 text-xs text-neutral-500">{eval2.score}/7</span>
                        </p>
                        <p className="text-xs text-neutral-400 font-light capitalize">{eval2.reason}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== LINKS: CALCULATORS & MARKET PAGES ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-6">
            {/* City 1 */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">{city1Name}</h3>
                <Badge variant="outline" className={`text-[10px] border ${tempColors[city1.marketTemp] || ''}`}>
                  {tempLabels[city1.marketTemp]}
                </Badge>
              </div>

              <div className="space-y-2">
                <Link
                  to={`/markets/${city1.slug}`}
                  className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> {city1.city} Market Overview
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/tools/wholesale-deal-calculator"
                  className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5" /> Wholesale Deal Calculator
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/tools/arv-calculator"
                  className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5" /> ARV Calculator
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                {city1.investorTypes.includes('rental') && (
                  <Link
                    to="/tools/rental-roi-calculator"
                    className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                  >
                    <span className="flex items-center gap-2">
                      <Calculator className="h-3.5 w-3.5" /> Rental ROI Calculator
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {/* City 2 */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">{city2Name}</h3>
                <Badge variant="outline" className={`text-[10px] border ${tempColors[city2.marketTemp] || ''}`}>
                  {tempLabels[city2.marketTemp]}
                </Badge>
              </div>

              <div className="space-y-2">
                <Link
                  to={`/markets/${city2.slug}`}
                  className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> {city2.city} Market Overview
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/tools/wholesale-deal-calculator"
                  className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5" /> Wholesale Deal Calculator
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/tools/arv-calculator"
                  className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5" /> ARV Calculator
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                {city2.investorTypes.includes('rental') && (
                  <Link
                    to="/tools/rental-roi-calculator"
                    className="flex items-center justify-between text-sm text-neutral-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
                  >
                    <span className="flex items-center gap-2">
                      <Calculator className="h-3.5 w-3.5" /> Rental ROI Calculator
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MORE COMPARISONS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link
                to="/compare"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]"
              >
                <Zap className="h-4 w-4 text-cyan-400" /> All City Comparisons
              </Link>
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
                <Calculator className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Deals</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find wholesale deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city1.city} or {city2.city}.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans both markets daily. AI-powered deal scoring, instant comps, and automated
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
              <Star className="h-3.5 w-3.5 text-cyan-400" /> 4.8/5 User Rating
            </span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
