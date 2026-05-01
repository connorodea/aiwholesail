import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight, Clock,
  BarChart3, Percent, Shield, CheckCircle, Hash,
  Briefcase,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import zipcodes from '@/data/zipcodes.json';

interface ZipCode {
  zip: string;
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  neighborhood: string;
  medianPrice: number;
  avgRent: number;
  priceGrowth: number;
  population: number;
  medianIncome: number;
  investorActivity: string;
  dominantStrategy: string;
  rentToPrice: number;
  daysOnMarket: number;
}

const strategyDetails: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
  wholesale: {
    icon: <Repeat className="h-5 w-5" />,
    label: 'Wholesaling',
    description: 'This ZIP code shows strong wholesale potential with motivated sellers and below-market properties ideal for contract assignment.',
  },
  flip: {
    icon: <Hammer className="h-5 w-5" />,
    label: 'Fix & Flip',
    description: 'Properties in this area offer strong flip margins with good renovation-to-ARV spreads and active buyer demand.',
  },
  rental: {
    icon: <Building2 className="h-5 w-5" />,
    label: 'Buy & Hold Rentals',
    description: 'Strong rent-to-price ratios and stable tenant demand make this ZIP ideal for long-term rental income.',
  },
};

const activityColors: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
};

const activityLabels: Record<string, string> = {
  high: 'High Investor Activity',
  medium: 'Moderate Activity',
  low: 'Low Activity',
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getNearbyZips(current: ZipCode): ZipCode[] {
  return (zipcodes as ZipCode[])
    .filter((z) => z.citySlug === current.citySlug && z.slug !== current.slug)
    .slice(0, 8);
}

export default function ZipCodePage() {
  const { slug } = useParams<{ slug: string }>();
  const zipData = (zipcodes as ZipCode[]).find((z) => z.slug === slug);

  if (!zipData) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">ZIP Code Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find data for this ZIP code.</p>
          <Link to="/zip">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All ZIP Codes
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const nearby = getNearbyZips(zipData);
  const strategy = strategyDetails[zipData.dominantStrategy];

  const stats = [
    { label: 'Median Price', value: formatCurrency(zipData.medianPrice), icon: DollarSign },
    { label: 'Avg Rent', value: `$${zipData.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Rent-to-Price', value: `${(zipData.rentToPrice * 100).toFixed(2)}%`, icon: Percent },
    { label: 'Days on Market', value: `${zipData.daysOnMarket}`, icon: Clock },
    { label: 'Price Growth (YoY)', value: `${zipData.priceGrowth}%`, icon: TrendingUp },
  ];

  const demoStats = [
    { label: 'Population', value: formatNumber(zipData.population), icon: Users },
    { label: 'Median Income', value: formatCurrency(zipData.medianIncome), icon: Briefcase },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`Real Estate Investing in ${zipData.zip} -- ${zipData.neighborhood}, ${zipData.city}, ${zipData.state}`}
        description={`Find profitable real estate deals in ZIP code ${zipData.zip} (${zipData.neighborhood}, ${zipData.city}, ${zipData.state}). Median price ${formatCurrency(zipData.medianPrice)}, avg rent $${zipData.avgRent}/mo, ${zipData.priceGrowth}% growth. AI-powered deal scoring.`}
        keywords={`${zipData.zip} real estate investing, ${zipData.zip} wholesale deals, ${zipData.neighborhood} investment properties, ${zipData.city} ${zipData.state} zip code ${zipData.zip}, ${zipData.zip} rental properties, ${zipData.zip} flip houses`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'ZIP Codes', url: 'https://aiwholesail.com/zip' },
          { name: `${zipData.zip} - ${zipData.city}, ${zipData.state}`, url: `https://aiwholesail.com/zip/${zipData.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/zip" className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              <Hash className="h-3.5 w-3.5" /> ZIP Codes
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Link to={`/markets/${zipData.citySlug}`} className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              <MapPin className="h-3.5 w-3.5" /> {zipData.city}, {zipData.state}
            </Link>
          </div>

          <Badge variant="outline" className={`mb-6 text-xs border ${activityColors[zipData.investorActivity] || ''}`}>
            <BarChart3 className="h-3 w-3 mr-1" />
            {activityLabels[zipData.investorActivity] || zipData.investorActivity}
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate Investing in {zipData.zip}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {zipData.neighborhood}.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {zipData.city}, {zipData.state} &middot; Median home price {formatCurrency(zipData.medianPrice)} &middot; {zipData.priceGrowth}% annual growth &middot; ${zipData.avgRent}/mo average rent.
          </p>
        </div>
      </section>

      {/* ===== MARKET STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Data</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {zipData.zip} by the numbers.
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

      {/* ===== POPULATION & INCOME ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Demographics</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8 max-w-lg">
            Who lives in {zipData.zip}.
          </h2>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            {demoStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-white mb-1">{stat.value}</div>
                  <p className="text-sm text-neutral-400 font-light">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== DOMINANT STRATEGY ===== */}
      {strategy && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Best Strategy</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
              How to invest in {zipData.zip}.
            </h2>
            <p className="text-neutral-400 font-light mb-10 max-w-xl">
              Based on current market data, the dominant investment strategy for {zipData.neighborhood} is:
            </p>

            <Link
              to={`/invest/${zipData.dominantStrategy}/${zipData.citySlug}`}
              className="group block max-w-xl"
            >
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                  {strategy.icon}
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white mb-3 group-hover:text-cyan-400 transition-colors">
                  {strategy.label}
                </h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed mb-4">
                  {strategy.description}
                </p>
                <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View {strategy.label} strategy in {zipData.city} <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ===== INTERNAL LINKS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Explore More</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to={`/markets/${zipData.citySlug}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <MapPin className="h-4 w-4 text-cyan-400" /> {zipData.city}, {zipData.state} Market
              </Link>
              <Link to="/zip" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Hash className="h-4 w-4 text-cyan-400" /> All ZIP Codes
              </Link>
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BarChart3 className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NEARBY ZIP CODES ===== */}
      {nearby.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Nearby ZIP Codes</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
              More ZIPs in {zipData.city}.
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {nearby.map((z) => (
                <Link key={z.slug} to={`/zip/${z.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-5 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                          {z.zip}
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] border ${activityColors[z.investorActivity] || ''}`}>
                        {z.investorActivity}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-400 font-light mb-3">{z.neighborhood}</p>
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Median</span>
                        <p className="text-sm font-semibold text-white">{formatCurrency(z.medianPrice)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Rent</span>
                        <p className="text-sm font-semibold text-white">${z.avgRent.toLocaleString()}</p>
                      </div>
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
              {zipData.zip} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans {zipData.neighborhood} in {zipData.city} daily. Get AI-powered deal scoring, instant comps, and automated seller outreach.
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
