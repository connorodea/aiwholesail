import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, MapPin, Search, ChevronRight,
  DollarSign, TrendingUp, Star, BarChart3,
  Shield, CheckCircle,
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

type SortKey = 'investorRating' | 'medianPrice' | 'priceGrowth';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'investorRating', label: 'Investor Rating' },
  { key: 'medianPrice', label: 'Median Price' },
  { key: 'priceGrowth', label: 'Price Growth' },
];

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function renderStars(rating: number): React.ReactNode {
  const fullStars = Math.round(rating / 2);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < fullStars ? 'text-cyan-400 fill-cyan-400' : 'text-neutral-700'}`}
        />
      ))}
    </div>
  );
}

export default function CityNeighborhoods() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('investorRating');

  const allNeighborhoods = neighborhoods as Neighborhood[];

  const cityNeighborhoods = useMemo(() => {
    return allNeighborhoods.filter((n) => n.citySlug === citySlug);
  }, [citySlug, allNeighborhoods]);

  const cityName = cityNeighborhoods[0]?.city || '';
  const stateName = cityNeighborhoods[0]?.state || '';

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return cityNeighborhoods
      .filter((n) => {
        return (
          !q ||
          n.name.toLowerCase().includes(q) ||
          n.slug.includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'investorRating') return b.investorRating - a.investorRating;
        if (sortBy === 'medianPrice') return b.medianPrice - a.medianPrice;
        if (sortBy === 'priceGrowth') return b.priceGrowth - a.priceGrowth;
        return 0;
      });
  }, [query, sortBy, cityNeighborhoods]);

  if (cityNeighborhoods.length === 0) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">City Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find neighborhoods for this city.</p>
          <Link to="/neighborhoods">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              <MapPin className="h-4 w-4" /> Browse All Neighborhoods
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const avgMedianPrice = Math.round(
    cityNeighborhoods.reduce((sum, n) => sum + n.medianPrice, 0) / cityNeighborhoods.length
  );
  const avgGrowth = (
    cityNeighborhoods.reduce((sum, n) => sum + n.priceGrowth, 0) / cityNeighborhoods.length
  ).toFixed(1);

  return (
    <PublicLayout>
      <SEOHead
        title={`${cityName}, ${stateName} Neighborhoods -- Real Estate Investing Guide`}
        description={`Explore ${cityNeighborhoods.length} neighborhoods in ${cityName}, ${stateName} for real estate investing. Investor ratings, median prices, walk scores, and investment strategies.`}
        keywords={`${cityName.toLowerCase()} neighborhoods real estate, ${cityName.toLowerCase()} ${stateName.toLowerCase()} neighborhood investing, best neighborhoods ${cityName.toLowerCase()}, ${cityName.toLowerCase()} rental neighborhoods`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Neighborhoods', url: 'https://aiwholesail.com/neighborhoods' },
          { name: `${cityName}, ${stateName}`, url: `https://aiwholesail.com/neighborhoods/city/${citySlug}` },
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
            <Link to="/neighborhoods" className="hover:text-white transition-colors">Neighborhoods</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-cyan-400">{cityName}, {stateName}</span>
          </nav>

          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            {cityNeighborhoods.length} Neighborhoods
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            {cityName}, {stateName}
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Neighborhoods.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Neighborhood-level investment data for {cityName}. Average median price {formatCurrency(avgMedianPrice)} with {avgGrowth}% average growth.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & SORT ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search neighborhood..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-white/[0.08] rounded-md text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-neutral-400" />
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                    sortBy === opt.key
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'bg-neutral-900/50 text-neutral-400 border border-white/[0.08] hover:border-cyan-500/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-neutral-400 font-light mt-4">
            {filtered.length} neighborhood{filtered.length !== 1 ? 's' : ''} in {cityName}
          </p>
        </div>
      </section>

      {/* ===== NEIGHBORHOOD GRID ===== */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((n) => (
              <Link key={n.slug} to={`/neighborhoods/${n.slug}`} className="group">
                <div className="h-full border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-7 hover:border-cyan-500/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs text-neutral-400 font-light">{n.city}, {n.state}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {n.name}
                  </h3>

                  <div className="flex items-center gap-2 mb-4">
                    {renderStars(n.investorRating)}
                    <span className="text-xs text-neutral-500">{n.investorRating}/10</span>
                  </div>

                  <div className="mt-auto grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Median</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{formatCurrency(n.medianPrice)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Growth</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{n.priceGrowth}%</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Rent</span>
                      </div>
                      <p className="text-sm font-semibold text-white">${n.avgRent.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Strategy badges */}
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/[0.06]">
                    {n.investmentStrategies.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-light border-white/[0.08] text-neutral-400">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <MapPin className="h-10 w-10 text-neutral-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-2">No neighborhoods found</p>
              <p className="text-sm text-neutral-400 font-light">Try a different search or sort option.</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== CITY MARKET LINK ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <Link to={`/markets/${citySlug}`} className="group block">
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-8 hover:border-cyan-500/20 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-cyan-400 mb-2">City Market</p>
                  <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                    {cityName}, {stateName} Market Overview
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mt-1">
                    View full market data, top zip codes, and investment strategies for {cityName}.
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
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
              {cityName} today.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail scans {cityName} neighborhoods daily. Get AI-powered deal scoring, instant comps, and automated seller outreach.
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
