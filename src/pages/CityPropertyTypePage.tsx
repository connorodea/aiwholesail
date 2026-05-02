import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  ChevronRight, Calculator, BookOpen, ThermometerSun,
  BarChart3, Shield, CheckCircle,
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

const iconMapSmall: Record<string, React.ReactNode> = {
  Building2: <Building2 className="h-5 w-5 text-cyan-400" />,
  Home: <Home className="h-5 w-5 text-cyan-400" />,
  Mountain: <Mountain className="h-5 w-5 text-cyan-400" />,
  Caravan: <Caravan className="h-5 w-5 text-cyan-400" />,
  Warehouse: <Warehouse className="h-5 w-5 text-cyan-400" />,
  Building: <Building className="h-5 w-5 text-cyan-400" />,
  Store: <Store className="h-5 w-5 text-cyan-400" />,
  LayoutGrid: <LayoutGrid className="h-5 w-5 text-cyan-400" />,
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

function formatSlugName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function slugifyState(stateFull: string): string {
  return stateFull.toLowerCase().replace(/\s+/g, '-');
}

/** Estimate a cap rate for the city-property-type combination */
function estimateCapRate(city: City, pt: PropertyType): string {
  // Parse the midpoint of the property type's typical cap rate range
  const capRateStr = pt.typicalReturns.capRate;
  const match = capRateStr.match(/([\d.]+)[^\d]+([\d.]+)/);
  if (!match) return capRateStr; // e.g. "N/A (no income)"

  const low = parseFloat(match[1]);
  const high = parseFloat(match[2]);
  const midpoint = (low + high) / 2;

  // Adjust based on city price level: cheaper markets get higher cap rates
  const nationalMedian = 400000;
  const priceRatio = city.medianHomePrice / nationalMedian;
  let adjusted: number;
  if (priceRatio < 0.7) {
    adjusted = midpoint + 1.2;
  } else if (priceRatio < 1.0) {
    adjusted = midpoint + 0.4;
  } else if (priceRatio < 1.5) {
    adjusted = midpoint - 0.3;
  } else {
    adjusted = midpoint - 1.0;
  }

  // Clamp
  adjusted = Math.max(low - 0.5, Math.min(high + 1.5, adjusted));
  return `${adjusted.toFixed(1)}%`;
}

/** Estimate entry price range for property type in this city */
function estimateEntryPrice(city: City, pt: PropertyType): string {
  const base = city.medianHomePrice;
  let lowMult: number;
  let highMult: number;

  switch (pt.slug) {
    case 'multifamily':
      lowMult = 1.4;
      highMult = 3.5;
      break;
    case 'single-family-homes':
      lowMult = 0.6;
      highMult = 1.2;
      break;
    case 'land':
      lowMult = 0.05;
      highMult = 0.4;
      break;
    case 'mobile-homes':
      lowMult = 1.5;
      highMult = 5.0;
      break;
    case 'self-storage':
      lowMult = 2.0;
      highMult = 8.0;
      break;
    case 'commercial-office':
      lowMult = 3.0;
      highMult = 12.0;
      break;
    case 'retail-strip-malls':
      lowMult = 2.5;
      highMult = 10.0;
      break;
    case 'mixed-use':
      lowMult = 1.5;
      highMult = 5.0;
      break;
    default:
      lowMult = 0.8;
      highMult = 2.0;
  }

  const low = base * lowMult;
  const high = base * highMult;
  return `${formatCurrency(low)} -- ${formatCurrency(high)}`;
}

/** Generate a "why this property type works in this city" paragraph */
function whyItWorks(city: City, pt: PropertyType): string {
  const capRate = estimateCapRate(city, pt);
  const isBestMarket = pt.bestMarkets.includes(city.slug);

  const segments: string[] = [];

  // Opening hook
  segments.push(
    `${city.city}, ${city.stateFull} is ${isBestMarket ? 'one of the top-rated markets' : 'a compelling market'} for ${pt.name.toLowerCase()} investing.`
  );

  // Price context
  segments.push(
    `With a median home price of ${formatCurrency(city.medianHomePrice)} and average rents of $${city.avgRent.toLocaleString()}/mo, the price-to-rent fundamentals ${city.medianHomePrice / city.avgRent < 220 ? 'favor income-oriented investors' : 'require careful underwriting but offer appreciation upside'}.`
  );

  // Property-type-specific insight
  switch (pt.slug) {
    case 'multifamily':
      segments.push(
        `Multifamily demand is driven by ${city.city}'s population of ${formatNumber(city.population)} and growing rental market. Estimated cap rates of ${capRate} on small multifamily make ${city.city} attractive for both cash flow and value-add plays.`
      );
      break;
    case 'single-family-homes':
      segments.push(
        `Single-family rentals in ${city.city} benefit from strong tenant demand across a population of ${formatNumber(city.population)}. At ${city.priceGrowth}% annual price growth, buy-and-hold investors get both cash flow and appreciation.`
      );
      break;
    case 'land':
      segments.push(
        `Land investing near ${city.city} benefits from ${city.priceGrowth}% annual price growth and expanding suburban development. Low entry costs mean high-percentage returns on parcels in the path of growth.`
      );
      break;
    case 'mobile-homes':
      segments.push(
        `Mobile home parks near ${city.city} serve the affordable housing segment, which has growing demand and shrinking supply. Estimated cap rates of ${capRate} are among the highest in real estate.`
      );
      break;
    case 'self-storage':
      segments.push(
        `Self-storage demand in ${city.city} is supported by a population of ${formatNumber(city.population)} and strong household turnover rates. The asset class delivers estimated cap rates of ${capRate} with minimal management overhead.`
      );
      break;
    case 'commercial-office':
      segments.push(
        `Office investing in ${city.city} offers long-term lease stability with estimated cap rates of ${capRate}. ${city.marketTemp === 'hot' ? 'Strong economic growth drives office demand and tenant quality.' : 'Current valuations create opportunities for contrarian investors to buy at attractive yields.'}`
      );
      break;
    case 'retail-strip-malls':
      segments.push(
        `Neighborhood retail in ${city.city} benefits from a consumer base of ${formatNumber(city.population)}. NNN lease structures and necessity-based tenants produce estimated cap rates of ${capRate} with limited landlord responsibility.`
      );
      break;
    case 'mixed-use':
      segments.push(
        `Mixed-use properties in ${city.city} combine residential stability with commercial upside. The dual income stream produces estimated cap rates of ${capRate} while reducing single-tenant vacancy risk.`
      );
      break;
    default:
      segments.push(
        `Estimated cap rates of ${capRate} in ${city.city} make this property type attractive for investors seeking yield above the national average.`
      );
  }

  // Market temperature
  if (city.marketTemp === 'hot') {
    segments.push('The hot market conditions drive strong demand, fast leasing, and reliable exits.');
  } else if (city.marketTemp === 'warm') {
    segments.push('Warm market conditions balance opportunity with manageable competition, ideal for disciplined investors.');
  } else {
    segments.push('Cooler market temperatures reduce competition and create more negotiation leverage on acquisitions.');
  }

  return segments.join(' ');
}

function getRelatedCities(current: City, pt: PropertyType, count = 4): City[] {
  // Prefer cities in the bestMarkets list, then same state, then nearby by population
  const best = pt.bestMarkets
    .filter((slug) => slug !== current.slug)
    .map((slug) => (cities as City[]).find((c) => c.slug === slug))
    .filter(Boolean) as City[];

  const sameState = (cities as City[]).filter(
    (c) => c.slug !== current.slug && c.state === current.state && !best.find((b) => b.slug === c.slug)
  );

  const others = (cities as City[]).filter(
    (c) =>
      c.slug !== current.slug &&
      !best.find((b) => b.slug === c.slug) &&
      !sameState.find((s) => s.slug === c.slug)
  );

  return [...best, ...sameState, ...others].slice(0, count);
}

function getRelatedPropertyTypes(current: PropertyType): PropertyType[] {
  return (propertyTypes as PropertyType[]).filter((p) => p.slug !== current.slug);
}

export default function CityPropertyTypePage() {
  const { typeSlug, citySlug } = useParams<{ typeSlug: string; citySlug: string }>();

  const city = (cities as City[]).find((c) => c.slug === citySlug);
  const pt = (propertyTypes as PropertyType[]).find((p) => p.slug === typeSlug);

  if (!city || !pt) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Page Not Found</h1>
          <p className="text-neutral-400 mb-6">
            {!pt
              ? 'Invalid property type. Browse our available property types.'
              : 'We could not find data for this market.'}
          </p>
          <div className="flex gap-4">
            <Link to="/property-types">
              <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
                <Building2 className="h-4 w-4" /> Property Types
              </button>
            </Link>
            <Link to="/markets">
              <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
                <MapPin className="h-4 w-4" /> Markets
              </button>
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const capRateEst = estimateCapRate(city, pt);
  const entryPrice = estimateEntryPrice(city, pt);
  const relatedCities = getRelatedCities(city, pt);
  const relatedTypes = getRelatedPropertyTypes(pt);
  const primaryTool = pt.relatedTools[0] || 'cash-flow-calculator';

  const stats = [
    { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${city.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${city.priceGrowth}%`, icon: TrendingUp },
    { label: 'Population', value: formatNumber(city.population), icon: Users },
  ];

  const investmentMetrics = [
    { label: 'Est. Cap Rate', value: capRateEst, icon: BarChart3 },
    { label: 'Entry Price Range', value: entryPrice, icon: DollarSign },
    {
      label: 'Typical Cash-on-Cash',
      value: pt.typicalReturns.cashOnCash,
      icon: TrendingUp,
    },
    {
      label: 'Annual Appreciation',
      value: pt.typicalReturns.appreciation,
      icon: TrendingUp,
    },
  ];

  const pageTitle = `${pt.name} Investing in ${city.city}, ${city.state}`;
  const pageDescription = `${pt.name} investing in ${city.city}, ${city.stateFull}. Median price ${formatCurrency(city.medianHomePrice)}, ${city.priceGrowth}% growth, est. cap rate ${capRateEst}. Market data, financing options, and investment analysis.`;

  return (
    <PublicLayout>
      <SEOHead
        title={`${pageTitle} -- Market Data & Investment Guide`}
        description={pageDescription}
        keywords={`${pt.name.toLowerCase()} ${city.city}, ${city.city} ${city.state} ${pt.slug}, ${pt.slug} investing ${city.city}, ${city.city} ${pt.name.toLowerCase()}, ${pt.keywords}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Property Types', url: 'https://aiwholesail.com/property-types' },
          { name: pt.name, url: `https://aiwholesail.com/property-types/${pt.slug}` },
          { name: `${city.city}, ${city.state}`, url: `https://aiwholesail.com/invest-in/${pt.slug}/${city.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            <Link to="/property-types" className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              <Building2 className="h-3.5 w-3.5" />
              <span>Property Types</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Link to={`/property-types/${pt.slug}`} className="text-sm text-white/50 hover:text-white transition-colors">
              {pt.name}
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <span className="text-sm text-white/70">
              {city.city}, {city.state}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              {iconMap[pt.icon] || <Building2 className="h-8 w-8 text-cyan-400" />}
            </div>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${tempColors[city.marketTemp] || ''}`}>
            <ThermometerSun className="h-3 w-3 mr-1" />
            {tempLabels[city.marketTemp] || city.marketTemp}
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {pt.name} Investing in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city}, {city.stateFull}.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {pt.description.replace(/\.$/, '')} in the {city.city}, {city.state} market.
          </p>
        </div>
      </section>

      {/* ===== CITY MARKET STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {city.city} by the numbers.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* ===== PROPERTY TYPE OVERVIEW ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Property Type</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
            What are{' '}
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {pt.name.toLowerCase()}?
            </span>
          </h2>
          <p className="text-neutral-300 font-light leading-relaxed text-lg">
            {pt.overview}
          </p>
        </div>
      </section>

      {/* ===== INVESTMENT METRICS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Investment Metrics</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            {pt.name} numbers for {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Estimated figures based on {city.city} market data and typical {pt.name.toLowerCase()} performance. Use our calculators for deal-specific analysis.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {investmentMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">{metric.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{metric.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== WHY THIS PROPERTY TYPE WORKS HERE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Strategy Insight</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Why {pt.name.toLowerCase()} work in {city.city}.
          </h2>
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                {iconMapSmall[pt.icon] || <Building2 className="h-5 w-5 text-cyan-400" />}
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white">
                {pt.name} in {city.city}, {city.state}
              </h3>
            </div>
            <p className="text-neutral-300 font-light leading-relaxed max-w-3xl">
              {whyItWorks(city, pt)}
            </p>
          </div>
        </div>
      </section>

      {/* ===== FINANCING OPTIONS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Financing</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-10">
            How to finance {pt.name.toLowerCase()} in {city.city}.
          </h2>

          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7">
            <ul className="space-y-3">
              {pt.financingOptions.map((option, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-cyan-400">{i + 1}</span>
                  </div>
                  <p className="text-neutral-300 font-light">{option}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link to={`/markets/${city.slug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <MapPin className="h-4 w-4 text-cyan-400" /> {city.city} Market Page
              </Link>
              <Link to={`/property-types/${pt.slug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Building2 className="h-4 w-4 text-cyan-400" /> {pt.name} Guide
              </Link>
              <Link to={`/tools/${primaryTool}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> {formatSlugName(primaryTool)}
              </Link>
              <Link to={`/states/${slugifyState(city.stateFull)}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> {city.stateFull} Markets
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED PROPERTY TYPES IN THIS CITY ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">More Property Types</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Other property types in {city.city}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            Explore additional property type investment opportunities in {city.city}, {city.state}.
          </p>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedTypes.slice(0, 7).map((rpt) => (
              <Link key={rpt.slug} to={`/invest-in/${rpt.slug}/${city.slug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    {iconMapSmall[rpt.icon] || <Building2 className="h-5 w-5 text-cyan-400" />}
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {rpt.name}
                  </h3>
                  <p className="text-xs text-neutral-500 font-light flex-1">
                    in {city.city}, {city.state}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    View analysis <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== RELATED CITIES FOR THIS PROPERTY TYPE ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">{pt.name} Markets</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
            {pt.name} in other markets.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedCities.map((r) => (
              <Link key={r.slug} to={`/invest-in/${pt.slug}/${r.slug}`} className="group">
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
                    View {pt.name.toLowerCase()} <ChevronRight className="h-3 w-3" />
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
            Find {pt.name.toLowerCase()} deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail gives you AI-powered deal scoring, instant comps, and market intelligence
            to find profitable {pt.name.toLowerCase()} in {city.city}, {city.state}.
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
