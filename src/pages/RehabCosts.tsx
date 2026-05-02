import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Search, ChevronRight, MapPin, DollarSign,
  Wrench, Shield, Star, ArrowUpDown,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import rehabCosts from '@/data/rehab-costs.json';

interface RehabCity {
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  laborRate: string;
  avgCostPerSqft: number;
  permitCost: string;
  timeline: string;
  categories: { name: string; low: number; high: number; avgDays: number }[];
  tips: string[];
  bestContractorSources: string[];
}

function getLaborRateLabel(rate: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    'low': { label: 'Low', color: 'text-green-400' },
    'medium': { label: 'Medium', color: 'text-yellow-400' },
    'medium-high': { label: 'Med-High', color: 'text-orange-400' },
    'high': { label: 'High', color: 'text-red-400' },
    'very-high': { label: 'Very High', color: 'text-red-500' },
  };
  return map[rate] || { label: rate, color: 'text-neutral-400' };
}

type SortKey = 'city' | 'avgCostPerSqft' | 'laborRate';
type SortDir = 'asc' | 'desc';

const laborOrder: Record<string, number> = { low: 1, medium: 2, 'medium-high': 3, high: 4, 'very-high': 5 };

export default function RehabCosts() {
  const cities = rehabCosts as RehabCity[];
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let list = [...cities];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          `${c.city} ${c.state}`.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (sortKey) {
        case 'city':
          aVal = a.city;
          bVal = b.city;
          break;
        case 'avgCostPerSqft':
          aVal = a.avgCostPerSqft;
          bVal = b.avgCostPerSqft;
          break;
        case 'laborRate':
          aVal = laborOrder[a.laborRate] || 0;
          bVal = laborOrder[b.laborRate] || 0;
          break;
        default:
          aVal = a.city;
          bVal = b.city;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return list;
  }, [cities, search, sortKey, sortDir]);

  const avgCost = Math.round(cities.reduce((s, c) => s + c.avgCostPerSqft, 0) / cities.length);

  return (
    <PublicLayout>
      <SEOHead
        title="Rehab Costs by City -- 2026 Renovation Cost Guide for Investors | AIWholesail"
        description={`Compare rehab and renovation costs across ${cities.length} US cities. Average cost per square foot, labor rates, and detailed category breakdowns for house flippers and real estate investors.`}
        keywords="rehab costs by city, renovation costs real estate, house flip rehab budget, contractor costs by city, kitchen renovation cost, bathroom renovation cost, rehab cost estimator"
        canonicalUrl="https://aiwholesail.com/rehab-costs"
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Rehab Costs', url: 'https://aiwholesail.com/rehab-costs' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-16 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            2026 REHAB COST GUIDE
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Rehab Costs
            <br />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              by City.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light mb-10">
            Detailed renovation cost breakdowns across {cities.length} US markets. Compare $/sqft, labor rates, and category-level estimates for your next flip.
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-white">{cities.length}</p>
              <p className="text-xs text-neutral-500 mt-1">Cities</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-cyan-400">${avgCost}</p>
              <p className="text-xs text-neutral-500 mt-1">Avg $/sqft</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <p className="text-2xl font-bold text-white">15</p>
              <p className="text-xs text-neutral-500 mt-1">Categories</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SEARCH & SORT ===== */}
      <section className="py-8 px-4 border-b border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by city or state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/30 transition-colors"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Showing {filtered.length} of {cities.length} cities
            </p>
          </div>
        </div>
      </section>

      {/* ===== CITY TABLE ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="border border-white/[0.05] rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_120px_100px] gap-2 px-6 py-3 bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <button onClick={() => toggleSort('city')} className="flex items-center gap-1 hover:text-white transition-colors text-left">
                City <ArrowUpDown className="h-3 w-3" />
              </button>
              <button onClick={() => toggleSort('avgCostPerSqft')} className="flex items-center gap-1 hover:text-white transition-colors">
                $/sqft <ArrowUpDown className="h-3 w-3" />
              </button>
              <button onClick={() => toggleSort('laborRate')} className="flex items-center gap-1 hover:text-white transition-colors">
                Labor Rate <ArrowUpDown className="h-3 w-3" />
              </button>
              <span>Timeline</span>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-neutral-400 mb-2">No cities match your search.</p>
                <button
                  onClick={() => setSearch('')}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filtered.map((city, i) => {
                const labor = getLaborRateLabel(city.laborRate);
                return (
                  <Link
                    key={city.slug}
                    to={`/rehab-costs/${city.slug}`}
                    className={`group w-full grid grid-cols-1 md:grid-cols-[1fr_120px_120px_120px_100px] gap-2 px-6 py-4 hover:bg-white/[0.02] transition-colors ${
                      i !== filtered.length - 1 ? 'border-b border-white/[0.05]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                          {city.city}, {city.state}
                        </span>
                        {/* Mobile-only inline data */}
                        <div className="flex items-center gap-3 mt-1 md:hidden text-xs text-neutral-500">
                          <span>${city.avgCostPerSqft}/sqft</span>
                          <span className={labor.color}>{labor.label}</span>
                          <span>{city.timeline}</span>
                        </div>
                      </div>
                    </div>

                    <span className="hidden md:flex items-center text-sm font-semibold text-white">
                      <DollarSign className="h-3.5 w-3.5 text-cyan-400 mr-0.5" />
                      {city.avgCostPerSqft}/sqft
                    </span>
                    <span className={`hidden md:flex items-center text-sm ${labor.color}`}>
                      <Wrench className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                      {labor.label}
                    </span>
                    <span className="hidden md:flex items-center text-sm text-neutral-400">{city.timeline}</span>
                    <span className="hidden md:flex items-center gap-1 text-xs text-cyan-400 group-hover:gap-1.5 transition-all">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ===== CITY CARDS (GRID VIEW) ===== */}
      <section className="py-12 px-4 border-t border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">BROWSE BY CITY</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            City Rehab Cost Guides
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities
              .sort((a, b) => a.city.localeCompare(b.city))
              .map((city) => {
                const labor = getLaborRateLabel(city.laborRate);
                const totalLow = city.categories.reduce((s, c) => s + c.low, 0);
                const totalHigh = city.categories.reduce((s, c) => s + c.high, 0);
                return (
                  <Link
                    key={city.slug}
                    to={`/rehab-costs/${city.slug}`}
                    className="group border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-5 hover:border-cyan-500/20 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {city.city}, {city.state}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-500 mb-2">
                      <span className="font-medium text-white">${city.avgCostPerSqft}/sqft</span>
                      <span className={labor.color}>{labor.label} labor</span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-3">
                      Full rehab: ${totalLow.toLocaleString()} - ${totalHigh.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 group-hover:gap-2.5 transition-all">
                      View Cost Guide <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      </section>

      {/* ===== REHAB ESTIMATOR CTA ===== */}
      <section className="py-16 px-4 border-t border-white/[0.06]">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            TOOLS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Need a Custom Rehab Estimate?
          </h2>
          <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
            Use our interactive Rehab Estimator to build a room-by-room budget with material choices, labor rates, and contingency planning.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/tools/rehab-estimator"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors text-sm"
            >
              Open Rehab Estimator <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/tools"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.1] text-white rounded-lg hover:bg-white/[0.04] transition-colors text-sm"
            >
              All Investor Tools
            </Link>
          </div>
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
