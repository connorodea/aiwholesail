import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Search, ChevronRight, Shield, Star, Filter,
  Banknote, MapPin, Percent, Clock,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import lendersData from '@/data/lenders.json';

interface LenderEntry {
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  lenderType: string;
  lenderTypeLabel: string;
  lenders: { name: string; rate: string; ltv: string; minLoan: number; closingDays: string; specialties: string[] }[];
  avgRate: string;
  avgClosing: string;
  tips: string[];
}

const lenderTypeLabels: Record<string, string> = {
  'hard-money': 'Hard Money',
  'private-money': 'Private Money',
  'dscr': 'DSCR',
  'portfolio': 'Portfolio',
  'commercial': 'Commercial',
};

export default function Lenders() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');

  const entries = lendersData as LenderEntry[];

  const cities = useMemo(() => {
    const citySet = Array.from(new Set(entries.map((e) => `${e.city}, ${e.state}`)));
    return ['All', ...citySet.sort()];
  }, [entries]);

  const lenderTypes = useMemo(() => {
    return ['All', ...Object.keys(lenderTypeLabels)];
  }, []);

  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    if (selectedCity !== 'All') {
      filtered = filtered.filter((e) => `${e.city}, ${e.state}` === selectedCity);
    }

    if (selectedType !== 'All') {
      filtered = filtered.filter((e) => e.lenderType === selectedType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.city.toLowerCase().includes(query) ||
          e.state.toLowerCase().includes(query) ||
          e.lenderTypeLabel.toLowerCase().includes(query) ||
          e.lenders.some((l) => l.name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [entries, selectedCity, selectedType, searchQuery]);

  return (
    <PublicLayout>
      <SEOHead
        title="Find Real Estate Lenders by City -- Hard Money, DSCR, Private & More"
        description="Find and compare real estate lenders in 30+ cities. Hard money, private money, DSCR, portfolio, and commercial lenders with rates, LTV, and closing times."
        keywords="hard money lenders, DSCR lenders, private money lenders, portfolio lenders, commercial lenders, real estate financing, investment property loans, real estate lender directory"
        canonicalUrl="https://aiwholesail.com/lenders"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Lenders', url: 'https://aiwholesail.com/lenders' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-16 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">LENDER DIRECTORY</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Find Real Estate
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Lenders by City.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            Compare hard money, private money, DSCR, portfolio, and commercial lenders across 30 major investment markets. Rates, LTV, and closing times.
          </p>
        </div>
      </section>

      {/* ===== SEARCH & FILTERS ===== */}
      <section className="py-8 px-4 border-b border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by city, state, or lender name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
              />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="appearance-none pl-10 pr-10 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/30 transition-colors cursor-pointer min-w-[200px]"
              >
                {cities.map((city) => (
                  <option key={city} value={city} className="bg-neutral-900 text-white">
                    {city}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 rotate-90 pointer-events-none" />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="appearance-none pl-10 pr-10 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/30 transition-colors cursor-pointer min-w-[180px]"
              >
                {lenderTypes.map((type) => (
                  <option key={type} value={type} className="bg-neutral-900 text-white">
                    {type === 'All' ? 'All Types' : lenderTypeLabels[type]}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 rotate-90 pointer-events-none" />
            </div>
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            Showing {filteredEntries.length} of {entries.length} lender pages across {new Set(entries.map((e) => e.city)).size} cities
          </p>
        </div>
      </section>

      {/* ===== LENDER GRID ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg text-neutral-400 mb-2">No lender pages match your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCity('All');
                  setSelectedType('All');
                }}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntries.map((entry) => (
                <Link
                  key={entry.slug}
                  to={`/lenders/${entry.slug}`}
                  className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 hover:border-cyan-500/20 transition-all duration-300 group flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Banknote className="h-5 w-5 text-cyan-400" />
                    </div>
                    <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider px-2 py-1 border border-white/[0.06] rounded">
                      {entry.lenderType}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {entry.lenderTypeLabel}
                  </h3>
                  <p className="text-sm text-neutral-400 font-light mb-4">
                    {entry.city}, {entry.state}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-4 mt-auto">
                    <div className="bg-white/[0.02] rounded-md px-3 py-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Percent className="h-2.5 w-2.5 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Rate</span>
                      </div>
                      <span className="text-xs font-semibold text-white">{entry.avgRate}</span>
                    </div>
                    <div className="bg-white/[0.02] rounded-md px-3 py-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="h-2.5 w-2.5 text-neutral-500" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Close</span>
                      </div>
                      <span className="text-xs font-semibold text-white">{entry.avgClosing}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-cyan-400 group-hover:text-cyan-300 transition-colors">
                    View Lenders
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-[#0a0a0a] text-white py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">Find Funded Deals</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-white mb-6">
            Great financing starts with
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              a great deal.
            </span>
          </h2>
          <p className="text-lg text-white/50 font-light max-w-xl mx-auto mb-10">
            AIWholesail uses AI to find off-market deals, calculate spreads, and match you with the right financing structure. Start for free.
          </p>
          <Link to="/pricing">
            <button className="inline-flex items-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black text-base font-semibold rounded-md transition-colors">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400 mt-6">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-light">No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-light">4.8/5 User Rating</span>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
