import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Users,
  Home, Building2, Repeat, Hammer, ChevronRight, Calculator,
  BookOpen, Search, Shield, CheckCircle, Landmark,
  Percent, AlertTriangle, Scale, FileText,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import counties from '@/data/counties.json';

interface County {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  county_seat: string;
  population: number;
  medianHomePrice: number;
  avgRent: number;
  priceGrowth: number;
  foreclosureRate: number;
  taxRate: number;
  landlordFriendly: boolean;
  topCities: string[];
  investorActivity: string;
  dominantStrategies: string[];
  courtHouseAddress: string;
  taxSaleInfo: string;
  description: string;
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

const activityColors: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
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

function citySlugToName(slug: string): string {
  return slug
    .replace(/-[a-z]{2}$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function citySlugToState(slug: string): string {
  const match = slug.match(/-([a-z]{2})$/);
  return match ? match[1].toUpperCase() : '';
}

function getRelatedCounties(current: County): County[] {
  const sameState = (counties as County[]).filter(
    (c) => c.slug !== current.slug && c.state === current.state
  );
  if (sameState.length >= 3) return sameState.slice(0, 3);

  const others = (counties as County[]).filter((c) => c.slug !== current.slug);
  const remaining = others.filter((c) => !sameState.includes(c));
  return [...sameState, ...remaining].slice(0, 3);
}

export default function CountyPage() {
  const { slug } = useParams<{ slug: string }>();
  const county = (counties as County[]).find((c) => c.slug === slug);

  if (!county) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">County Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find data for this county.</p>
          <Link to="/counties">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <Landmark className="h-4 w-4" /> Browse All Counties
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const related = getRelatedCounties(county);
  const grossYield = ((county.avgRent * 12) / county.medianHomePrice * 100).toFixed(1);

  const stats = [
    { label: 'Median Home Price', value: formatCurrency(county.medianHomePrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${county.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${county.priceGrowth}%`, icon: TrendingUp },
    { label: 'Population', value: formatNumber(county.population), icon: Users },
    { label: 'Gross Rental Yield', value: `${grossYield}%`, icon: Building2 },
    { label: 'Foreclosure Rate', value: `${county.foreclosureRate}%`, icon: AlertTriangle },
    { label: 'Property Tax Rate', value: `${county.taxRate}%`, icon: Percent },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`${county.name}, ${county.state} Real Estate Investing -- Tax Sales, Data & Deals`}
        description={`Invest in ${county.name}, ${county.stateFull}. Median home price ${formatCurrency(county.medianHomePrice)}, ${county.priceGrowth}% growth, ${county.taxRate}% tax rate. Tax sale info, courthouse address, and county-level investment data.`}
        keywords={`${county.name} real estate investing, ${county.name} tax sale, ${county.name} wholesale deals, ${county.county_seat} investment properties, ${county.name} foreclosures, ${county.name} ${county.state} property tax`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Counties', url: 'https://aiwholesail.com/counties' },
          { name: `${county.name}, ${county.state}`, url: `https://aiwholesail.com/counties/${county.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/counties" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
              <Landmark className="h-4 w-4" />
              <span>All Counties</span>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <Badge variant="outline" className={`text-xs border ${activityColors[county.investorActivity] || ''}`}>
              {county.investorActivity} activity
            </Badge>
            {county.landlordFriendly ? (
              <Badge variant="outline" className="text-xs border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <Shield className="h-3 w-3 mr-1" />
                Landlord Friendly
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border bg-red-500/10 text-red-400 border-red-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Tenant Friendly
              </Badge>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {county.name}, {county.state}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Real Estate Investing.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            {county.description}
          </p>
        </div>
      </section>

      {/* ===== COUNTY STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">County Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {county.name} by the numbers.
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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

      {/* ===== TAX SALE INFORMATION ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white mb-3">Tax Sale Information</h3>
              <p className="text-sm text-neutral-400 font-light leading-relaxed mb-4">
                {county.taxSaleInfo}
              </p>
              <div className="flex items-center gap-2 text-sm text-cyan-400">
                <CheckCircle className="h-4 w-4" />
                <span>Property tax rate: {county.taxRate}%</span>
              </div>
            </div>

            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                <Landmark className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white mb-3">Courthouse</h3>
              <p className="text-sm text-neutral-400 font-light leading-relaxed mb-4">
                {county.name} Courthouse<br />
                {county.courtHouseAddress}
              </p>
              <div className="flex items-center gap-2 text-sm text-cyan-400">
                <MapPin className="h-4 w-4" />
                <span>County seat: {county.county_seat}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LANDLORD FRIENDLY ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                county.landlordFriendly ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white mb-2">
                  {county.landlordFriendly ? 'Landlord-Friendly County' : 'Tenant-Friendly County'}
                </h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed max-w-2xl">
                  {county.landlordFriendly
                    ? `${county.name}, ${county.stateFull} is considered landlord-friendly with favorable eviction timelines, no rent control, and property-rights-oriented legislation. This is beneficial for rental investors seeking predictable cash flow.`
                    : `${county.name}, ${county.stateFull} has tenant-friendly regulations including longer eviction timelines and potential rent control considerations. Rental investors should factor in additional holding costs and legal compliance requirements.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TOP CITIES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Top Cities</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Major cities in {county.name}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            These cities drive the most real estate investment activity in {county.name}, {county.stateFull}.
          </p>

          <div className="flex flex-wrap gap-3">
            {county.topCities.map((citySlug) => (
              <Link key={citySlug} to={`/markets/${citySlug}`} className="group">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl px-6 py-4 hover:border-cyan-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                      {citySlugToName(citySlug)}
                    </span>
                    <span className="text-sm text-neutral-500">{citySlugToState(citySlug)}</span>
                    <ChevronRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INVESTMENT STRATEGIES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Investment Strategies</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            How to invest in {county.name}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            These strategies are actively producing returns for investors in {county.name}, {county.stateFull}.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {county.dominantStrategies.map((type) => {
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
            <div className="grid sm:grid-cols-4 gap-3">
              <Link to="/tools" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Free Calculators
              </Link>
              <Link to="/blog" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Blog & Guides
              </Link>
              <Link to="/markets" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Search className="h-4 w-4 text-cyan-400" /> Browse Markets
              </Link>
              <Link to={`/laws/${county.state.toLowerCase()}`} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <FileText className="h-4 w-4 text-cyan-400" /> {county.state} Laws
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RELATED COUNTIES ===== */}
      {related.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Related Counties</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">More counties in {county.stateFull}.</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.slug} to={`/counties/${r.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <Landmark className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className={`text-[10px] border ${activityColors[r.investorActivity] || ''}`}>
                        {r.investorActivity}
                      </Badge>
                      {r.landlordFriendly && (
                        <Badge variant="outline" className="text-[10px] border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          LL
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {r.name}, {r.state}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4">{r.county_seat}</p>
                    <div className="mt-auto grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Price</p>
                        <p className="font-semibold text-white">{formatCurrency(r.medianHomePrice)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Growth</p>
                        <p className="font-semibold text-white">{r.priceGrowth}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Tax</p>
                        <p className="font-semibold text-white">{r.taxRate}%</p>
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
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Find deals in {county.name}.
            </h2>
            <p className="text-neutral-400 font-light mb-8 max-w-lg mx-auto">
              AIWholesail scans {county.name} for off-market deals, pre-foreclosures, and motivated sellers. Get AI-powered deal scoring and instant notifications.
            </p>
            <Link to="/auth">
              <button className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
