import { useState, useMemo } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, DollarSign, TrendingUp, Layers, RefreshCw } from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import { PIPELINE_STAGES, Deal, PipelineStage } from '@/types/pipeline';
import { PipelineColumn } from '@/components/pipeline/PipelineColumn';
import { DealDetailSheet } from '@/components/pipeline/DealDetailSheet';

export default function Pipeline() {
  const { deals, dealsByStage, loading, fetchDeals, moveToStage, updateNotes, removeDeal } = usePipeline();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Filter deals by search
  const filteredDealsByStage = useMemo(() => {
    if (!searchQuery.trim()) return dealsByStage;

    const q = searchQuery.toLowerCase();
    const filtered: Record<PipelineStage, Deal[]> = {
      new: [],
      contacted: [],
      analyzing: [],
      offer_made: [],
      under_contract: [],
      closed: [],
    };

    for (const stage of Object.keys(dealsByStage) as PipelineStage[]) {
      filtered[stage] = dealsByStage[stage].filter(
        (d) =>
          d.propertyData.address?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [dealsByStage, searchQuery]);

  // Stats
  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum, d) => sum + (d.propertyData.price || 0), 0);
  const totalSpread = deals.reduce((sum, d) => sum + Math.max(d.spread || 0, 0), 0);
  const underContract = dealsByStage.under_contract.length;

  const formatCompact = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  const handleDrop = (dealId: string, targetStage: PipelineStage) => {
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.status !== targetStage) {
      moveToStage(dealId, targetStage);
    }
  };

  const handleCardClick = (deal: Deal) => {
    setSelectedDeal(deal);
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
      <main className="px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-6">
        {/* Header */}
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Deal Pipeline</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            Track your deals from lead to close
          </p>
        </section>

        {/* Stats Bar */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto animate-fade-in">
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 flex items-center justify-center gap-1">
                <Layers className="h-3 w-3 text-cyan-400" /> Total Deals
              </div>
              <div className="text-2xl font-bold mt-1 text-white">{totalDeals}</div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 flex items-center justify-center gap-1">
                <DollarSign className="h-3 w-3 text-cyan-400" /> Pipeline Value
              </div>
              <div className="text-2xl font-bold mt-1 text-white">{formatCompact(totalValue)}</div>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardContent className="p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3 text-cyan-400" /> Total Spread
              </div>
              <div className="text-2xl font-bold mt-1 text-cyan-400">{formatCompact(totalSpread)}</div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">Under Contract</div>
              <div className="text-2xl font-bold mt-1 text-emerald-400">{underContract}</div>
            </CardContent>
          </Card>
        </section>

        {/* Search + Refresh */}
        <section className="flex items-center gap-3 max-w-4xl mx-auto animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search deals by address or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchDeals}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </section>

        {/* Kanban Board */}
        <section className="animate-fade-in overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {loading && deals.length === 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.id} className="min-w-[280px] w-[280px] rounded-xl border bg-white/[0.02] border-white/[0.06]">
                  <div className="p-3 border-b border-border/30">
                    <Skeleton className="h-5 w-24" />
                  </div>
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
                  onCardClick={handleCardClick}
                  onStageChange={handleStageChange}
                  onRemove={removeDeal}
                />
              ))}
            </div>
          )}
        </section>

        {/* Empty state */}
        {!loading && deals.length === 0 && (
          <section className="text-center py-12 max-w-md mx-auto">
            <Layers className="h-12 w-12 text-neutral-400/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No deals in your pipeline</h3>
            <p className="text-sm text-neutral-400">
              Search for properties and click the pipeline icon to start tracking deals.
            </p>
          </section>
        )}
      </main>

      {/* Deal Detail Sheet */}
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
