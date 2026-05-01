import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Search, ChevronRight, Filter,
  DollarSign, MapPin, Home, TrendingUp, Repeat, Key, FileText,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import dealExamples from '@/data/deal-examples.json';

interface DealNumbers {
  mao: number;
  spreadFromARV: number;
  percentBelowARV: number;
  [key: string]: unknown;
}

interface DealExample {
  slug: string;
  title: string;
  strategy: string;
  city: string;
  citySlug: string;
  state: string;
  propertyType: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  purchasePrice: number;
  arv: number;
  rehabCost: number;
  assignmentFee: number;
  totalProfit: number;
  holdingPeriod: string;
  financingUsed: string;
  howFound: string;
  keyLesson: string;
  timeline: string[];
  numbers: DealNumbers;
}

const STRATEGIES = [
  { value: 'All', label: 'All Strategies', icon: TrendingUp, color: 'text-cyan-400' },
  { value: 'wholesale', label: 'Wholesale', icon: Repeat, color: 'text-green-400' },
  { value: 'flip', label: 'Fix & Flip', icon: Home, color: 'text-amber-400' },
  { value: 'brrrr', label: 'BRRRR', icon: Key, color: 'text-purple-400' },
  { value: 'rental', label: 'Buy & Hold', icon: DollarSign, color: 'text-blue-400' },
  { value: 'creative', label: 'Creative Finance', icon: FileText, color: 'text-rose-400' },
];

function getStrategyBadge(strategy: string) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    wholesale: { label: 'Wholesale', bg: 'bg-green-500/10', text: 'text-green-400' },
    flip: { label: 'Fix & Flip', bg: 'bg-amber-500/10', text: 'text-amber-400' },
    brrrr: { label: 'BRRRR', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    rental: { label: 'Buy & Hold', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    creative: { label: 'Creative Finance', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  };
  return map[strategy] || { label: strategy, bg: 'bg-cyan-500/10', text: 'text-cyan-400' };
}

function formatCurrency(n: number): string {
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('en-US');
}

function getPrimaryMetric(deal: DealExample): { label: string; value: string } {
  if (deal.strategy === 'wholesale') {
    return { label: 'Assignment Fee', value: formatCurrency(deal.assignmentFee) };
  }
  if (deal.strategy === 'flip') {
    const net = (deal.numbers as Record<string, unknown>).netProfit;
    return { label: 'Net Profit', value: formatCurrency(typeof net === 'number' ? net : deal.totalProfit) };
  }
  if (deal.strategy === 'brrrr') {
    const cf = (deal.numbers as Record<string, unknown>).monthlyCashFlow;
    return { label: 'Monthly Cash Flow', value: typeof cf === 'number' ? formatCurrency(cf) + '/mo' : 'N/A' };
  }
  if (deal.strategy === 'rental') {
    const cf = (deal.numbers as Record<string, unknown>).monthlyCashFlow;
    return { label: 'Monthly Cash Flow', value: typeof cf === 'number' ? formatCurrency(cf) + '/mo' : 'N/A' };
  }
  if (deal.strategy === 'creative') {
    const cf = (deal.numbers as Record<string, unknown>).monthlyCashFlow;
    const spread = (deal.numbers as Record<string, unknown>).monthlySpread;
    const val = typeof cf === 'number' ? cf : typeof spread === 'number' ? spread : 0;
    return { label: 'Monthly Income', value: formatCurrency(val) + '/mo' };
  }
  return { label: 'Profit', value: formatCurrency(deal.totalProfit) };
}

export default function DealExamples() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('All');

  const deals = dealExamples as DealExample[];

  const cities = useMemo(() => {
    const citySet = Array.from(new Set(deals.map((d) => d.city + ', ' + d.state)));
    return ['All Cities', ...citySet.sort()];
  }, [deals]);

  const [selectedCity, setSelectedCity] = useState('All Cities');

  const filteredDeals = useMemo(() => {
    let filtered = [...deals];

    if (selectedStrategy !== 'All') {
      filtered = filtered.filter((d) => d.strategy === selectedStrategy);
    }

    if (selectedCity !== 'All Cities') {
      filtered = filtered.filter((d) => d.city + ', ' + d.state === selectedCity);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.city.toLowerCase().includes(query) ||
          d.state.toLowerCase().includes(query) ||
          d.propertyType.toLowerCase().includes(query) ||
          d.strategy.toLowerCase().includes(query) ||
          d.howFound.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [deals, selectedStrategy, selectedCity, searchQuery]);

  const stats = useMemo(() => {
    const wholesale = deals.filter((d) => d.strategy === 'wholesale');
    const flips = deals.filter((d) => d.strategy === 'flip');
    const avgWholesaleFee = wholesale.length
      ? Math.round(wholesale.reduce((s, d) => s + d.assignmentFee, 0) / wholesale.length)
      : 0;
    const avgFlipProfit = flips.length
      ? Math.round(
          flips.reduce((s, d) => {
            const net = (d.numbers as Record<string, unknown>).netProfit;
            return s + (typeof net === 'number' ? net : d.totalProfit);
          }, 0) / flips.length
        )
      : 0;
    return {
      totalDeals: deals.length,
      avgWholesaleFee,
      avgFlipProfit,
      citiesCovered: new Set(deals.map((d) => d.city)).size,
    };
  }, [deals]);

  return (
    <PublicLayout>
      <SEOHead
        title="Real Estate Deal Examples & Case Studies | AIWholesail"
        description={`Browse ${stats.totalDeals} real-world real estate deal examples with full financial breakdowns. Wholesale, flip, BRRRR, rental, and creative financing case studies across ${stats.citiesCovered}+ cities.`}
        keywords="real estate deal examples, wholesale deal case study, fix and flip example, BRRRR deal breakdown, real estate investment case studies, wholesale deal numbers, flip profit breakdown"
        canonicalUrl="https://aiwholesail.com/deals/examples"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Deal Examples', url: 'https://aiwholesail.com/deals/examples' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mb-8">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400">Deal Examples</span>
          </nav>

          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            REAL DEAL BREAKDOWNS
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Real Estate Deal
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Examples & Case Studies
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light mb-10">
            {stats.totalDeals} real-world deals with full numbers, timelines, and lessons learned.
            Filter by strategy, city, or property type.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-white">{stats.totalDeals}</p>
              <p className="text-xs text-neutral-500 mt-1">Case Studies</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.avgWholesaleFee)}</p>
              <p className="text-xs text-neutral-500 mt-1">Avg Wholesale Fee</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats.avgFlipProfit)}</p>
              <p className="text-xs text-neutral-500 mt-1">Avg Flip Profit</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-cyan-400">{stats.citiesCovered}+</p>
              <p className="text-xs text-neutral-500 mt-1">Cities Covered</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FILTERS ===== */}
      <section className="py-8 px-4 border-b border-white/[0.06]">
        <div className="container mx-auto max-w-6xl">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search deals by city, property type, strategy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Strategy filter pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-neutral-500 mr-1" />
            {STRATEGIES.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setSelectedStrategy(value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedStrategy === value
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/[0.03] text-neutral-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon className={`h-3 w-3 ${selectedStrategy === value ? 'text-cyan-400' : color}`} />
                {label}
              </button>
            ))}
          </div>

          {/* City filter */}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-neutral-500" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-neutral-300 px-3 py-1.5 focus:outline-none focus:border-cyan-500/50"
            >
              {cities.map((city) => (
                <option key={city} value={city} className="bg-neutral-900">
                  {city}
                </option>
              ))}
            </select>
            <span className="text-xs text-neutral-500 ml-2">
              {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      </section>

      {/* ===== DEAL CARDS ===== */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {filteredDeals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-400 text-lg mb-2">No deals found matching your filters.</p>
              <p className="text-neutral-500 text-sm">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDeals.map((deal) => {
                const badge = getStrategyBadge(deal.strategy);
                const metric = getPrimaryMetric(deal);

                return (
                  <Link
                    key={deal.slug}
                    to={`/deals/examples/${deal.slug}`}
                    className="group border border-white/[0.06] bg-gradient-to-b from-neutral-900/40 to-transparent rounded-xl p-6 hover:border-cyan-500/20 hover:bg-white/[0.02] transition-all"
                  >
                    {/* Strategy badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-neutral-500">{deal.holdingPeriod}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors leading-snug">
                      {deal.title}
                    </h3>

                    {/* Location & property info */}
                    <div className="flex items-center gap-3 text-xs text-neutral-500 mb-4">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {deal.city}, {deal.state}
                      </span>
                      <span>{deal.propertyType}</span>
                      <span>{deal.beds}bd/{deal.baths}ba</span>
                    </div>

                    {/* Key numbers */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {deal.purchasePrice > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Purchase</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(deal.purchasePrice)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">ARV</p>
                        <p className="text-sm font-semibold text-white">{formatCurrency(deal.arv)}</p>
                      </div>
                      {deal.rehabCost > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Rehab</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(deal.rehabCost)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">{metric.label}</p>
                        <p className="text-sm font-bold text-cyan-400">{metric.value}</p>
                      </div>
                    </div>

                    {/* How found */}
                    <p className="text-xs text-neutral-400 line-clamp-2 mb-4">{deal.howFound}</p>

                    {/* CTA */}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 group-hover:gap-2.5 transition-all">
                      View Full Breakdown <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 px-4 border-t border-white/[0.06]">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            FIND YOUR NEXT DEAL
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Ready to Find Deals Like These?
          </h2>
          <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
            AIWholesail uses AI to find off-market properties, analyze deals instantly, and connect you with motivated sellers across every market.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors text-sm"
            >
              Start Finding Deals <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.1] text-white rounded-lg hover:bg-white/[0.04] transition-colors text-sm"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
