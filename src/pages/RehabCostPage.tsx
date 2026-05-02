import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight, ChevronRight, MapPin, DollarSign, Clock,
  Wrench, Calculator, Lightbulb, Users, CheckSquare,
  Square, ArrowUpDown,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Spotlight } from '@/components/ui/spotlight';
import rehabCosts from '@/data/rehab-costs.json';

interface RehabCategory {
  name: string;
  low: number;
  high: number;
  avgDays: number;
}

interface RehabCity {
  slug: string;
  citySlug: string;
  city: string;
  state: string;
  laborRate: string;
  avgCostPerSqft: number;
  permitCost: string;
  timeline: string;
  categories: RehabCategory[];
  tips: string[];
  bestContractorSources: string[];
}

function formatCurrency(n: number): string {
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('en-US');
}

function getLaborRateLabel(rate: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    'low': { label: 'Low', color: 'text-green-400' },
    'medium': { label: 'Medium', color: 'text-yellow-400' },
    'medium-high': { label: 'Medium-High', color: 'text-orange-400' },
    'high': { label: 'High', color: 'text-red-400' },
    'very-high': { label: 'Very High', color: 'text-red-500' },
  };
  return map[rate] || { label: rate, color: 'text-neutral-400' };
}

type SortKey = 'name' | 'low' | 'high' | 'avg' | 'avgDays';
type SortDir = 'asc' | 'desc';

export default function RehabCostPage() {
  const { slug } = useParams<{ slug: string }>();
  const city = (rehabCosts as RehabCity[]).find((c) => c.slug === slug);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sortedCategories = useMemo(() => {
    if (!city) return [];
    const cats = [...city.categories];
    cats.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (sortKey) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'low': aVal = a.low; bVal = b.low; break;
        case 'high': aVal = a.high; bVal = b.high; break;
        case 'avg': aVal = (a.low + a.high) / 2; bVal = (b.low + b.high) / 2; break;
        case 'avgDays': aVal = a.avgDays; bVal = b.avgDays; break;
        default: aVal = a.name; bVal = b.name;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return cats;
  }, [city, sortKey, sortDir]);

  const totalEstimate = useMemo(() => {
    if (!city) return { low: 0, high: 0 };
    let low = 0;
    let high = 0;
    let days = 0;
    for (const cat of city.categories) {
      if (selected.has(cat.name)) {
        low += cat.low;
        high += cat.high;
        days += cat.avgDays;
      }
    }
    return { low, high, days };
  }, [city, selected]);

  function toggleCategory(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  if (!city) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-40 px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-4">City Not Found</h1>
          <p className="text-neutral-400 mb-6">We could not find rehab cost data for this city.</p>
          <Link to="/rehab-costs">
            <button className="inline-flex items-center gap-2 px-6 py-3 border border-white/[0.08] rounded-md text-sm text-white hover:bg-white/[0.04] transition-colors">
              Browse All Cities
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const laborInfo = getLaborRateLabel(city.laborRate);

  // Related cities: same labor-rate bracket or neighboring states, excluding current
  const relatedCities = (rehabCosts as RehabCity[])
    .filter((c) => c.slug !== city.slug)
    .sort((a, b) => Math.abs(a.avgCostPerSqft - city.avgCostPerSqft) - Math.abs(b.avgCostPerSqft - city.avgCostPerSqft))
    .slice(0, 6);

  return (
    <PublicLayout>
      <SEOHead
        title={`Rehab Costs in ${city.city}, ${city.state} -- 2026 Investor Guide | AIWholesail`}
        description={`Complete rehab cost breakdown for ${city.city}, ${city.state}. Average $${city.avgCostPerSqft}/sqft, ${city.laborRate} labor rates, permit costs ${city.permitCost}. 15 renovation categories with low/high estimates for house flippers.`}
        keywords={`rehab costs ${city.city}, renovation costs ${city.city} ${city.state}, house flip rehab budget ${city.city}, contractor costs ${city.city}, kitchen renovation cost ${city.city}, bathroom renovation cost ${city.city}`}
        canonicalUrl={`https://aiwholesail.com/rehab-costs/${city.slug}`}
        breadcrumbs={[
          { name: 'Home', url: 'https://aiwholesail.com' },
          { name: 'Rehab Costs', url: 'https://aiwholesail.com/rehab-costs' },
          { name: `${city.city}, ${city.state}`, url: `https://aiwholesail.com/rehab-costs/${city.slug}` },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a] text-white overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(6, 182, 212, 0.15)" />
        <div className="relative container mx-auto max-w-5xl px-4 pt-28 pb-20 text-center">
          {/* Breadcrumbs */}
          <nav className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mb-8">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/rehab-costs" className="hover:text-white transition-colors">Rehab Costs</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-400">{city.city}, {city.state}</span>
          </nav>

          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-6">
            2026 INVESTOR GUIDE
          </p>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] text-white mb-6">
            Rehab Costs in{' '}
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              {city.city}, {city.state}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light mb-10">
            Detailed renovation cost estimates for 15 categories. Built for house flippers and real estate investors.
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <DollarSign className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">${city.avgCostPerSqft}</p>
              <p className="text-xs text-neutral-500 mt-1">Avg $/sqft</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <Wrench className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
              <p className={`text-2xl font-bold ${laborInfo.color}`}>{laborInfo.label}</p>
              <p className="text-xs text-neutral-500 mt-1">Labor Rate</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <DollarSign className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">${city.permitCost}</p>
              <p className="text-xs text-neutral-500 mt-1">Permit Costs</p>
            </div>
            <div className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
              <Clock className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{city.timeline}</p>
              <p className="text-xs text-neutral-500 mt-1">Typical Timeline</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INTERACTIVE CALCULATOR ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400">
              REHAB COST CALCULATOR
            </h2>
          </div>
          <p className="text-neutral-400 mb-8 text-sm">
            Select the renovation categories for your project to get a running cost estimate.
          </p>

          {/* Running total bar */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-20 mb-6 border border-cyan-500/20 bg-[#0a0a0a]/95 backdrop-blur rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-xs text-neutral-400">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
                <span className="text-xs text-neutral-500">|</span>
                <span className="text-xs text-neutral-400">{totalEstimate.days} days est.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-400">Estimated Total:</span>
                <span className="text-lg font-bold text-cyan-400">
                  {formatCurrency(totalEstimate.low)} - {formatCurrency(totalEstimate.high)}
                </span>
              </div>
            </div>
          )}

          {/* Cost breakdown table */}
          <div className="border border-white/[0.05] rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid md:grid-cols-[auto_1fr_120px_120px_120px_80px] gap-2 px-6 py-3 bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <div className="w-6" />
              <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white transition-colors text-left">
                Category <ArrowUpDown className="h-3 w-3" />
              </button>
              <button onClick={() => toggleSort('low')} className="flex items-center gap-1 hover:text-white transition-colors">
                Low <ArrowUpDown className="h-3 w-3" />
              </button>
              <button onClick={() => toggleSort('high')} className="flex items-center gap-1 hover:text-white transition-colors">
                High <ArrowUpDown className="h-3 w-3" />
              </button>
              <button onClick={() => toggleSort('avg')} className="flex items-center gap-1 hover:text-white transition-colors">
                Avg <ArrowUpDown className="h-3 w-3" />
              </button>
              <button onClick={() => toggleSort('avgDays')} className="flex items-center gap-1 hover:text-white transition-colors">
                Days <ArrowUpDown className="h-3 w-3" />
              </button>
            </div>

            {/* Table rows */}
            {sortedCategories.map((cat, i) => {
              const isSelected = selected.has(cat.name);
              const avg = Math.round((cat.low + cat.high) / 2);
              return (
                <button
                  key={cat.name}
                  onClick={() => toggleCategory(cat.name)}
                  className={`w-full text-left grid grid-cols-1 md:grid-cols-[auto_1fr_120px_120px_120px_80px] gap-2 px-6 py-4 transition-colors ${
                    i !== sortedCategories.length - 1 ? 'border-b border-white/[0.05]' : ''
                  } ${isSelected ? 'bg-cyan-500/[0.06]' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="w-6 flex items-center">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-cyan-400" />
                    ) : (
                      <Square className="h-4 w-4 text-neutral-600" />
                    )}
                  </div>

                  <div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                      {cat.name}
                    </span>
                    {/* Mobile-only inline data */}
                    <div className="flex items-center gap-3 mt-1 md:hidden text-xs text-neutral-500">
                      <span>{formatCurrency(cat.low)} - {formatCurrency(cat.high)}</span>
                      <span>{cat.avgDays} days</span>
                    </div>
                  </div>

                  <span className="hidden md:block text-sm text-neutral-400">{formatCurrency(cat.low)}</span>
                  <span className="hidden md:block text-sm text-neutral-400">{formatCurrency(cat.high)}</span>
                  <span className="hidden md:block text-sm font-medium text-white">{formatCurrency(avg)}</span>
                  <span className="hidden md:block text-sm text-neutral-500">{cat.avgDays}d</span>
                </button>
              );
            })}
          </div>

          {/* Select-all / clear */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => {
                if (!city) return;
                setSelected(new Set(city.categories.map((c) => c.name)));
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </section>

      {/* ===== TIPS ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400">
              LOCAL TIPS FOR {city.city.toUpperCase()}
            </h2>
          </div>
          <div className="border border-white/[0.05] rounded-xl p-6 space-y-4">
            {city.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] font-bold text-cyan-400">{i + 1}</span>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BEST CONTRACTOR SOURCES ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400">
              WHERE TO FIND CONTRACTORS IN {city.city.toUpperCase()}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {city.bestContractorSources.map((source, i) => (
              <div key={i} className="border border-white/[0.06] rounded-xl p-5 bg-white/[0.01] text-center">
                <span className="text-sm font-semibold text-white">{source}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== REHAB ESTIMATOR CTA ===== */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] to-transparent rounded-xl p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Calculator className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-semibold text-white mb-1">
                Need a More Detailed Estimate?
              </h3>
              <p className="text-sm text-neutral-400">
                Use our interactive Rehab Estimator tool to build a room-by-room budget with material choices, labor rates, and contingency planning.
              </p>
            </div>
            <Link
              to="/tools/rehab-estimator"
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors text-sm whitespace-nowrap"
            >
              Open Rehab Estimator <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== RELATED CITIES ===== */}
      <section className="py-16 px-4 border-t border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">COMPARE MARKETS</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8">
            Rehab Costs in Other Cities
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedCities.map((rc) => {
              const rcLabor = getLaborRateLabel(rc.laborRate);
              return (
                <Link
                  key={rc.slug}
                  to={`/rehab-costs/${rc.slug}`}
                  className="group border border-white/[0.06] bg-gradient-to-b from-neutral-900/40 to-transparent rounded-xl p-5 hover:border-cyan-500/20 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                      {rc.city}, {rc.state}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-neutral-500 mb-3">
                    <span>${rc.avgCostPerSqft}/sqft</span>
                    <span className={rcLabor.color}>{rcLabor.label} labor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 group-hover:gap-2.5 transition-all">
                    View Costs <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 px-4 border-t border-white/[0.06]">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
            FIND YOUR NEXT DEAL
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Ready to Flip Properties in {city.city}?
          </h2>
          <p className="text-neutral-400 mb-8 max-w-xl mx-auto">
            AIWholesail helps investors find off-market properties, analyze deals with AI, and estimate rehab costs instantly in {city.city} and 30+ other markets.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors text-sm"
            >
              Start Finding Deals <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/rehab-costs"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.1] text-white rounded-lg hover:bg-white/[0.04] transition-colors text-sm"
            >
              Browse All Cities
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
