import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight, Calculator,
  BookOpen, Search, ThermometerSun, Zap,
  Shield, CheckCircle, Calendar, Scale,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import cities from '@/data/cities.json';
import stateLaws from '@/data/state-laws.json';

const LAST_UPDATED = '2026-05-12';

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

interface StateLaw {
  slug: string;
  state: string;
  stateFull: string;
  wholesalingLegal: boolean;
  licenseRequired: boolean;
  assignmentAllowed: boolean;
  doubleCloseAllowed: boolean;
  disclosureRequired: boolean;
  notableRegulations: string;
  keyStatutes: string;
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
  const stateLaw = (stateLaws as StateLaw[]).find((s) => s.state === city.state);
  const tempWord = (tempLabels[city.marketTemp] || city.marketTemp).toLowerCase().replace(' market', '');

  const stats = [
    { label: 'Median Home Price', value: formatCurrency(city.medianHomePrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${city.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${city.priceGrowth}%`, icon: TrendingUp },
    { label: 'Population', value: formatNumber(city.population), icon: Users },
    { label: 'Gross Rental Yield', value: `${grossYield}%`, icon: Building2 },
  ];

  // 40-60 word self-contained answer block for AI extraction.
  const marketSummary =
    `${city.city}, ${city.stateFull} is a ${tempWord} real estate market with a median home price of ` +
    `${formatCurrency(city.medianHomePrice)} and ${city.priceGrowth}% year-over-year price growth. ` +
    `Average rent is $${city.avgRent.toLocaleString()}/month, producing a ${grossYield}% gross rental yield ` +
    `across a population of ${formatNumber(city.population)}. The top investor strategies in ${city.city} ` +
    `are ${city.investorTypes.map((t) => (t === 'wholesale' ? 'wholesaling' : t === 'flip' ? 'fix-and-flip' : 'buy-and-hold rentals')).join(', ')}.`;

  // Structured data: Dataset (city stats) + Place (geo) for AI extraction.
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${city.city}, ${city.state} Real Estate Investment Market Data`,
    description: marketSummary,
    url: `https://aiwholesail.com/markets/${city.slug}`,
    creator: {
      '@type': 'Organization',
      name: 'AIWholesail',
      url: 'https://aiwholesail.com',
    },
    dateModified: LAST_UPDATED,
    temporalCoverage: '2025/2026',
    spatialCoverage: {
      '@type': 'Place',
      name: `${city.city}, ${city.state}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city.city,
        addressRegion: city.state,
        addressCountry: 'US',
      },
    },
    keywords: [
      `${city.city} real estate market`,
      `${city.city} wholesale real estate`,
      `${city.city} investment properties`,
      `${city.stateFull} real estate investing`,
      `median home price ${city.city}`,
      `rental yield ${city.city}`,
    ],
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Median Home Price', value: city.medianHomePrice, unitCode: 'USD' },
      { '@type': 'PropertyValue', name: 'Average Monthly Rent', value: city.avgRent, unitText: 'USD/month' },
      { '@type': 'PropertyValue', name: 'Year-over-Year Price Growth', value: city.priceGrowth, unitText: 'percent' },
      { '@type': 'PropertyValue', name: 'Gross Rental Yield', value: parseFloat(grossYield), unitText: 'percent' },
      { '@type': 'PropertyValue', name: 'Population', value: city.population },
    ],
    license: 'https://aiwholesail.com/terms',
  };

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${city.city}, ${city.state}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city.city,
      addressRegion: city.state,
      addressCountry: 'US',
    },
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: city.stateFull,
    },
  };

  return (
    <PublicLayout>
      <SEOHead
        title={`${city.city}, ${city.state} Real Estate Wholesale Market`}
        description={`Find profitable wholesale real estate deals in ${city.city}, ${city.stateFull}. Median home price ${formatCurrency(city.medianHomePrice)}, ${city.priceGrowth}% growth. AI-powered deal scoring for ${city.city} investors.`}
        keywords={`${city.city} wholesale real estate, ${city.city} investment properties, ${city.city} ${city.state} real estate deals, wholesale deals ${city.city}, flip houses ${city.city}, rental properties ${city.city}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Markets', url: 'https://aiwholesail.com/markets' },
          { name: `${city.city}, ${city.state}`, url: `https://aiwholesail.com/markets/${city.slug}` },
        ]}
      />

      {/* Structured data: Dataset + Place — for AI Overviews / Perplexity / ChatGPT extraction */}
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(datasetJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(placeJsonLd)}</script>
        <meta name="last-modified" content={LAST_UPDATED} />
        <meta property="article:modified_time" content={LAST_UPDATED} />
      </Helmet>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(0, 196, 200, 0.15)" />
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
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-white/40">
            <Calendar className="h-3 w-3" /> Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </div>
      </section>

      {/* ===== AI-EXTRACTABLE SUMMARY ANSWER BLOCK ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-3">
              What is the {city.city} real estate market like?
            </h2>
            <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">
              {marketSummary}
            </p>
          </div>
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

      {/* ===== WHOLESALING LEGALITY ===== */}
      {stateLaw && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Legality</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6 max-w-2xl">
              Is wholesaling legal in {city.city}, {city.state}?
            </h2>
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8 space-y-4">
              <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">
                {stateLaw.wholesalingLegal
                  ? `Yes — wholesaling real estate is legal in ${stateLaw.stateFull}, including ${city.city}.`
                  : `Wholesaling in ${stateLaw.stateFull} is restricted. Review the state statutes before structuring assignments in ${city.city}.`}
                {' '}
                {stateLaw.licenseRequired
                  ? `${stateLaw.stateFull} requires a real estate license to wholesale.`
                  : `A real estate license is not required to wholesale in ${stateLaw.stateFull}.`}
                {' '}
                {stateLaw.assignmentAllowed
                  ? 'Assignment of contract is allowed.'
                  : 'Assignment of contract is restricted — use a double-close structure.'}
                {' '}
                {stateLaw.disclosureRequired
                  ? `Wholesalers must disclose their position as a principal in the transaction.`
                  : `Explicit disclosure of intent to assign is not statutorily required, but is best practice.`}
              </p>
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2 text-sm text-white/70">
                  <Scale className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Key statutes</p>
                    <p className="text-white/60 font-light">{stateLaw.keyStatutes}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-white/70">
                  <Shield className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Double-close allowed</p>
                    <p className="text-white/60 font-light">{stateLaw.doubleCloseAllowed ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/40 pt-2 border-t border-white/[0.05]">
                This is general guidance, not legal advice. Consult a licensed {stateLaw.stateFull} real estate attorney before structuring a deal.
                {' '}
                <Link to={`/laws/${stateLaw.slug}`} className="text-cyan-400 hover:text-cyan-300">
                  Read the full {stateLaw.stateFull} wholesaling law guide →
                </Link>
              </p>
            </div>
          </div>
        </section>
      )}

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
