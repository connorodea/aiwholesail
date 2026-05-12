import { useState, useMemo } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, DollarSign, TrendingUp, Layers, RefreshCw, FileSignature,
  SlidersHorizontal, X, Bed,
} from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import { PIPELINE_STAGES, Deal, PipelineStage } from '@/types/pipeline';
import { PipelineColumn } from '@/components/pipeline/PipelineColumn';
import { DealDetailSheet } from '@/components/pipeline/DealDetailSheet';

type SortKey = 'newest' | 'oldest' | 'spread_high' | 'price_high' | 'price_low';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',      label: 'Newest first' },
  { value: 'oldest',      label: 'Oldest first' },
  { value: 'spread_high', label: 'Highest spread' },
  { value: 'price_high',  label: 'Highest price' },
  { value: 'price_low',   label: 'Lowest price' },
];

const BEDS_OPTIONS = ['any', '2', '3', '4', '5'];
const SPREAD_OPTIONS = [
  { value: '0',      label: 'Any spread' },
  { value: '20000',  label: '$20K+' },
  { value: '50000',  label: '$50K+' },
  { value: '100000', label: '$100K+' },
];

export default function Pipeline() {
  const { deals, dealsByStage, loading, fetchDeals, moveToStage, updateNotes, removeDeal } = usePipeline();

  const [searchQuery, setSearchQuery] = useState('');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [bedsMin, setBedsMin] = useState<string>('any');
  const [spreadMin, setSpreadMin] = useState<string>('0');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const filtersActive =
    !!searchQuery.trim() ||
    !!priceMin ||
    !!priceMax ||
    bedsMin !== 'any' ||
    spreadMin !== '0' ||
    sortKey !== 'newest';

  const clearFilters = () => {
    setSearchQuery('');
    setPriceMin('');
    setPriceMax('');
    setBedsMin('any');
    setSpreadMin('0');
    setSortKey('newest');
  };

  // Compose filter + sort over each stage's deals. One pass, then per-stage
  // sort to keep relative order stable inside each column.
  const filteredDealsByStage = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pMin = priceMin ? Number(priceMin) : null;
    const pMax = priceMax ? Number(priceMax) : null;
    const bMin = bedsMin === 'any' ? null : Number(bedsMin);
    const sMin = Number(spreadMin) || 0;

    const out: Record<PipelineStage, Deal[]> = {
      new: [], contacted: [], analyzing: [], offer_made: [], under_contract: [], closed: [],
    };

    const matches = (d: Deal): boolean => {
      const data = d.propertyData;
      if (q) {
        const addr = (data.address || '').toLowerCase();
        const notes = (d.notes || '').toLowerCase();
        if (!addr.includes(q) && !notes.includes(q)) return false;
      }
      if (pMin !== null && (data.price || 0) < pMin) return false;
      if (pMax !== null && (data.price || 0) > pMax) return false;
      if (bMin !== null && (data.bedrooms || 0) < bMin) return false;
      if (sMin > 0 && (d.spread || 0) < sMin) return false;
      return true;
    };

    const sortFn = (a: Deal, b: Deal): number => {
      switch (sortKey) {
        case 'newest':      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'spread_high': return (b.spread || 0) - (a.spread || 0);
        case 'price_high':  return (b.propertyData.price || 0) - (a.propertyData.price || 0);
        case 'price_low':   return (a.propertyData.price || 0) - (b.propertyData.price || 0);
        default: return 0;
      }
    };

    for (const stage of Object.keys(dealsByStage) as PipelineStage[]) {
      out[stage] = dealsByStage[stage].filter(matches).sort(sortFn);
    }
    return out;
  }, [dealsByStage, searchQuery, priceMin, priceMax, bedsMin, spreadMin, sortKey]);

  // Stats reflect visible (filtered) deals so the user can see what a
  // specific filter cohort is worth in aggregate.
  const visibleDeals = useMemo(
    () => Object.values(filteredDealsByStage).flat(),
    [filteredDealsByStage]
  );
  const totalDeals = visibleDeals.length;
  const totalValue = visibleDeals.reduce((sum, d) => sum + (d.propertyData.price || 0), 0);
  const totalSpread = visibleDeals.reduce((sum, d) => sum + Math.max(d.spread || 0, 0), 0);
  const underContract = filteredDealsByStage.under_contract.length;

  const formatCompact = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val}`;
  };

  const handleDrop = (dealId: string, targetStage: PipelineStage) => {
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.status !== targetStage) moveToStage(dealId, targetStage);
  };
  const handleStageChange = (dealId: string, stage: PipelineStage) => {
    moveToStage(dealId, stage);
    if (selectedDeal?.id === dealId) {
      setSelectedDeal((prev) => (prev ? { ...prev, status: stage } : null));
    }
  };
  const handleNotesUpdate = (dealId: string, notes: string) => {
    updateNotes(dealId, notes);
    if (selectedDeal?.id === dealId) {
      setSelectedDeal((prev) => (prev ? { ...prev, notes } : null));
    }
  };

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />

      {/* The whole page lives in one consistent max-w container — the kanban
          still escapes via overflow-x-auto for wider viewports without
          breaking the visual rhythm above it. */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <section className="text-center space-y-2 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            Deal Pipeline
          </h1>
          <p className="text-sm text-neutral-400">
            Track your deals from lead to close
          </p>
        </section>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <StatCard icon={Layers}        label="Total Deals"     value={totalDeals.toString()} />
          <StatCard icon={DollarSign}    label="Pipeline Value"  value={formatCompact(totalValue)} />
          <StatCard icon={TrendingUp}    label="Total Spread"    value={formatCompact(totalSpread)} accent />
          <StatCard icon={FileSignature} label="Under Contract"  value={underContract.toString()} success />
        </section>

        {/* ── Search + Filters panel ─────────────────────────────────── */}
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 space-y-3 animate-fade-in">
          {/* Search row */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
              <Input
                placeholder="Search deals by address or notes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-black/40 border-white/[0.08] h-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchDeals}
              disabled={loading}
              className="h-10 w-10 shrink-0 border-white/[0.08] bg-black/40 hover:bg-white/[0.04]"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-neutral-500 pr-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </div>

            <FilterPill label="Price min">
              <Input
                type="number"
                placeholder="$0"
                inputMode="numeric"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-7 w-24 bg-transparent border-0 px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </FilterPill>

            <FilterPill label="Price max">
              <Input
                type="number"
                placeholder="No max"
                inputMode="numeric"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-7 w-24 bg-transparent border-0 px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </FilterPill>

            <FilterPill label="Beds" icon={Bed}>
              <Select value={bedsMin} onValueChange={setBedsMin}>
                <SelectTrigger className="h-7 w-[78px] bg-transparent border-0 px-2 text-xs gap-1 focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEDS_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>{v === 'any' ? 'Any' : `${v}+`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterPill>

            <FilterPill label="Spread" icon={TrendingUp}>
              <Select value={spreadMin} onValueChange={setSpreadMin}>
                <SelectTrigger className="h-7 w-[110px] bg-transparent border-0 px-2 text-xs gap-1 focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPREAD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterPill>

            <FilterPill label="Sort">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-7 w-[140px] bg-transparent border-0 px-2 text-xs gap-1 focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterPill>

            {filtersActive && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors text-xs"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        </section>

        {/* ── Kanban ─────────────────────────────────────────────────── */}
        <section className="animate-fade-in overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-2">
          {loading && deals.length === 0 ? (
            <div className="grid grid-cols-6 gap-3 min-w-[1200px]">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.id} className="rounded-xl border bg-white/[0.02] border-white/[0.06]">
                  <div className="p-3 border-b border-border/30"><Skeleton className="h-5 w-24" /></div>
                  <div className="p-2 space-y-2">
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-3 min-w-[1200px]">
              {PIPELINE_STAGES.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={filteredDealsByStage[stage.id as PipelineStage] || []}
                  onDrop={handleDrop}
                  onCardClick={setSelectedDeal}
                  onStageChange={handleStageChange}
                  onRemove={removeDeal}
                />
              ))}
            </div>
          )}
        </section>

        {/* Empty state — only when no deals at all (not filtered-empty) */}
        {!loading && deals.length === 0 && (
          <section className="text-center py-10 max-w-md mx-auto">
            <Layers className="h-12 w-12 text-neutral-400/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No deals in your pipeline</h3>
            <p className="text-sm text-neutral-400">
              Search for properties and click the pipeline icon to start tracking deals.
            </p>
          </section>
        )}

        {/* Filtered-empty state — distinct from "no deals at all" */}
        {!loading && deals.length > 0 && visibleDeals.length === 0 && (
          <section className="text-center py-8 text-sm text-neutral-500">
            No deals match the current filters.
            <button onClick={clearFilters} className="ml-2 text-cyan-400 hover:text-cyan-300 underline">
              Clear filters
            </button>
          </section>
        )}
      </main>

      <DealDetailSheet
        deal={selectedDeal}
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onStageChange={handleStageChange}
        onNotesUpdate={handleNotesUpdate}
        onRemove={removeDeal}
      />

      <ChatAssistant />
    </div>
  );
}

/* ────────────────────────── helpers ────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  success,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
}) {
  const borderColor = accent ? 'border-cyan-500/30' : 'border-white/[0.06]';
  const bgColor = accent ? 'bg-cyan-500/[0.04]' : 'bg-white/[0.02]';
  const labelColor = accent ? 'text-cyan-400/80' : 'text-neutral-500';
  const valueColor = accent ? 'text-cyan-400' : success ? 'text-emerald-400' : 'text-white';
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 sm:p-5`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium ${labelColor}`}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 pl-2.5 rounded-md border border-white/[0.08] bg-black/40 hover:border-white/[0.14] transition-colors">
      <span className="text-neutral-500 text-xs flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <div className="border-l border-white/[0.06] pl-0.5">
        {children}
      </div>
    </div>
  );
}
