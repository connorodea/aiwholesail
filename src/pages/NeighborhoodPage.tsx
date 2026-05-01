import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, DollarSign, TrendingUp, Star,
  ChevronRight, Calculator, BookOpen, Search,
  Shield, CheckCircle, CheckCircle2, AlertTriangle,
  Building2, Repeat, Hammer, Home, Footprints,
  ShieldAlert, GraduationCap, BarChart3,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import neighborhoods from '@/data/neighborhoods.json';

interface Neighborhood {
  slug: string;
  name: string;
  citySlug: string;
  city: string;
  state: string;
  zipCodes: string[];
  medianPrice: number;
  avgRent: number;
  priceGrowth: number;
  investorRating: number;
  walkScore: number;
  crimeLevel: string;
  schoolRating: number;
  investmentStrategies: string[];
  description: string;
  highlights: string[];
  risks: string[];
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
  brrrr: {
    icon: <TrendingUp className="h-5 w-5" />,
    label: 'BRRRR Strategy',
    description: 'Buy, Rehab, Rent, Refinance, Repeat to build a portfolio with minimal capital.',
  },
  section8: {
    icon: <Home className="h-5 w-5" />,
    label: 'Section 8',
    description: 'Guaranteed government-backed rental income with stable long-term tenants.',
  },
  airbnb: {
    icon: <Star className="h-5 w-5" />,
    label: 'Short-Term Rentals',
    description: 'Capitalize on tourism and business travel demand with Airbnb and VRBO listings.',
  },
};

const crimeLevelConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  low: { color: 'text-green-400', label: 'Low Crime', bgColor: 'bg-green-500/10 border-green-500/20' },
  medium: { color: 'text-amber-400', label: 'Medium Crime', bgColor: 'bg-amber-500/10 border-amber-500/20' },
  high: { color: 'text-red-400', label: 'High Crime', bgColor: 'bg-red-500/10 border-red-500/20' },
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function renderStars(rating: number, max = 10): React.ReactNode {
  const fullStars = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < fullStars ? 'text-cyan-400 fill-cyan-400' : 'text-neutral-700'}`}
        />
      ))}
    </div>
  );
}

function getNearbyNeighborhoods(current: Neighborhood): Neighborhood[] {
  return (neighborhoods as Neighborhood[]).filter(
    (n) => n.citySlug === current.citySlug && n.slug !== current.slug
  ).slice(0, 4);
}

export default function NeighborhoodPage() {
  const { slug } = useParams<{ slug: string }>();
  const neighborhood = (neighborhoods as Neighborhood[]).find((n) => n.slug === slug);

  if (!neighborhood) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">Neighborhood Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find data for this neighborhood.</p>
          <Link to="/neighborhoods">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All Neighborhoods
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const nearby = getNearbyNeighborhoods(neighborhood);
  const grossYield = ((neighborhood.avgRent * 12) / neighborhood.medianPrice * 100).toFixed(1);
  const crimeConfig = crimeLevelConfig[neighborhood.crimeLevel] || crimeLevelConfig.medium;

  const stats = [
    { label: 'Median Price', value: formatCurrency(neighborhood.medianPrice), icon: DollarSign },
    { label: 'Average Rent', value: `$${neighborhood.avgRent.toLocaleString()}/mo`, icon: Home },
    { label: 'Price Growth (YoY)', value: `${neighborhood.priceGrowth}%`, icon: TrendingUp },
    { label: 'Investor Rating', value: `${neighborhood.investorRating}/10`, icon: BarChart3 },
  ];

  return (
    <PublicLayout>
      <SEOHead
        title={`${neighborhood.name}, ${neighborhood.city} Real Estate Investing -- Neighborhood Guide 2026`}
        description={`Invest in ${neighborhood.name}, ${neighborhood.city}, ${neighborhood.state}. Median price ${formatCurrency(neighborhood.medianPrice)}, ${neighborhood.priceGrowth}% growth, investor rating ${neighborhood.investorRating}/10. AI-powered neighborhood analysis.`}
        keywords={`${neighborhood.name.toLowerCase()} real estate, ${neighborhood.name.toLowerCase()} ${neighborhood.city.toLowerCase()} investment property, ${neighborhood.name.toLowerCase()} rental property, ${neighborhood.name.toLowerCase()} ${neighborhood.city.toLowerCase()} real estate investing`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Markets', url: 'https://aiwholesail.com/markets' },
          { name: `${neighborhood.city}, ${neighborhood.state}`, url: `https://aiwholesail.com/markets/${neighborhood.citySlug}` },
          { name: neighborhood.name, url: `https://aiwholesail.com/neighborhoods/${neighborhood.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumbs */}
          <nav className="flex items-center justify-center gap-2 mb-6 text-sm text-white/50">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/markets" className="hover:text-white transition-colors">Markets</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/markets/${neighborhood.citySlug}`} className="hover:text-white transition-colors">
              {neighborhood.city}, {neighborhood.state}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-cyan-400">{neighborhood.name}</span>
          </nav>

          <Badge variant="outline" className="mb-6 text-xs border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <Star className="h-3 w-3 mr-1 fill-cyan-400" />
            Investor Rating: {neighborhood.investorRating}/10
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {neighborhood.name}, {neighborhood.city}, {neighborhood.state}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Real Estate Investing Guide.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Median price {formatCurrency(neighborhood.medianPrice)} with {neighborhood.priceGrowth}% annual growth
            and {grossYield}% gross rental yield.
          </p>
        </div>
      </section>

      {/* ===== MARKET STATS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Market Overview</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            {neighborhood.name} by the numbers.
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

      {/* ===== NEIGHBORHOOD SCORES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Neighborhood Scores</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12 max-w-lg">
            Livability and safety.
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Walk Score */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Footprints className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400 font-light">Walk Score</p>
                  <p className="text-2xl font-bold text-white">{neighborhood.walkScore}/100</p>
                </div>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${neighborhood.walkScore}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {neighborhood.walkScore >= 90 ? "Walker's Paradise" :
                 neighborhood.walkScore >= 70 ? 'Very Walkable' :
                 neighborhood.walkScore >= 50 ? 'Somewhat Walkable' : 'Car-Dependent'}
              </p>
            </div>

            {/* Crime Level */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400 font-light">Crime Level</p>
                  <p className="text-2xl font-bold text-white capitalize">{neighborhood.crimeLevel}</p>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs border ${crimeConfig.bgColor} ${crimeConfig.color}`}>
                {crimeConfig.label}
              </Badge>
              <p className="text-xs text-neutral-500 mt-3">
                {neighborhood.crimeLevel === 'low' ? 'Relatively safe neighborhood for residents and investors.' :
                 neighborhood.crimeLevel === 'medium' ? 'Moderate crime levels -- research specific blocks.' :
                 'Higher crime area -- factor into tenant screening and insurance costs.'}
              </p>
            </div>

            {/* School Rating */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400 font-light">School Rating</p>
                  <p className="text-2xl font-bold text-white">{neighborhood.schoolRating}/10</p>
                </div>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${neighborhood.schoolRating * 10}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {neighborhood.schoolRating >= 8 ? 'Excellent schools -- strong family tenant demand.' :
                 neighborhood.schoolRating >= 6 ? 'Good schools -- attracts families and stable tenants.' :
                 'Below average schools -- may limit family tenant pool.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DESCRIPTION ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">About This Neighborhood</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6 max-w-lg">
            Why invest in {neighborhood.name}?
          </h2>
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
            <p className="text-neutral-300 font-light leading-relaxed text-lg">{neighborhood.description}</p>
            {neighborhood.zipCodes.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <p className="text-xs font-semibold tracking-[0.15em] uppercase text-neutral-500 mb-3">Zip Codes</p>
                <div className="flex flex-wrap gap-2">
                  {neighborhood.zipCodes.map((zip) => (
                    <Badge key={zip} variant="outline" className="text-xs border-white/[0.08] text-neutral-400">
                      <MapPin className="h-3 w-3 mr-1 text-cyan-400" />
                      {zip}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== INVESTMENT STRATEGIES ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Investment Strategies</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4 max-w-lg">
            Strategies that work in {neighborhood.name}.
          </h2>
          <p className="text-neutral-400 font-light mb-10 max-w-xl">
            These strategies are actively producing returns for investors in {neighborhood.name}, {neighborhood.city}.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {neighborhood.investmentStrategies.map((strategy) => {
              const detail = strategyDetails[strategy];
              if (!detail) return null;
              return (
                <Link
                  key={strategy}
                  to={`/invest/${strategy}/${neighborhood.citySlug}`}
                  className="group"
                >
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-5 text-cyan-400">
                      {detail.icon}
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-white mb-3 group-hover:text-cyan-400 transition-colors">
                      {detail.label}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light leading-relaxed flex-1">{detail.description}</p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity mt-4">
                      Learn more <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HIGHLIGHTS & RISKS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Highlights */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-green-400 mb-4">Highlights</p>
              <h3 className="text-2xl font-bold tracking-tight text-white mb-6">What makes it attractive.</h3>
              <ul className="space-y-4">
                {neighborhood.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-300 font-light leading-relaxed">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-400 mb-4">Risks</p>
              <h3 className="text-2xl font-bold tracking-tight text-white mb-6">What to watch out for.</h3>
              <ul className="space-y-4">
                {neighborhood.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-300 font-light leading-relaxed">{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NEARBY NEIGHBORHOODS ===== */}
      {nearby.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">Nearby Neighborhoods</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-8">
              More neighborhoods in {neighborhood.city}.
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {nearby.map((n) => (
                <Link key={n.slug} to={`/neighborhoods/${n.slug}`} className="group">
                  <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <Badge variant="outline" className="text-[10px] border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                        {n.investorRating}/10
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {n.name}
                    </h3>
                    <p className="text-sm text-neutral-400 font-light mb-4 flex-1">
                      Median {formatCurrency(n.medianPrice)} &middot; {n.priceGrowth}% growth
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View neighborhood <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center">
              <Link
                to={`/neighborhoods/city/${neighborhood.citySlug}`}
                className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                View all {neighborhood.city} neighborhoods <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== CITY MARKET LINK ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <Link to={`/markets/${neighborhood.citySlug}`} className="group block">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-2">City Market</p>
                  <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                    {neighborhood.city}, {neighborhood.state} Market Overview
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mt-1">
                    View full market data, top zip codes, and investment strategies for {neighborhood.city}.
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ===== RELATED TOOLS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="p-6 border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-4">Related Tools</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/tools/cash-flow-calculator" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Cash Flow Calculator
              </Link>
              <Link to="/tools/rental-roi-calculator" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Rental ROI Calculator
              </Link>
              <Link to="/tools/brrrr-calculator" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> BRRRR Calculator
              </Link>
              <Link to="/tools/cap-rate-calculator" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Calculator className="h-4 w-4 text-cyan-400" /> Cap Rate Calculator
              </Link>
              <Link to="/guides" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <BookOpen className="h-4 w-4 text-cyan-400" /> Investing Guides
              </Link>
              <Link to="/markets" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
                <Search className="h-4 w-4 text-cyan-400" /> All Markets
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Get Started</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Find deals in
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {neighborhood.name} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans {neighborhood.name}, {neighborhood.city} daily. Get AI-powered deal scoring, instant comps, and automated seller outreach.
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
