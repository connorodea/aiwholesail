import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Deal, PipelineStage } from '@/types/pipeline';
import { DealCard } from './DealCard';

interface PipelineColumnProps {
  stage: {
    id: string;
    label: string;
    color: string;
    textColor: string;
  };
  deals: Deal[];
  onDrop: (dealId: string, targetStage: PipelineStage) => void;
  onCardClick: (deal: Deal) => void;
  onStageChange?: (dealId: string, stage: PipelineStage) => void;
  onRemove?: (dealId: string) => void;
}

export function PipelineColumn({ stage, deals, onDrop, onCardClick, onStageChange, onRemove }: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const dealId = e.dataTransfer.getData('application/x-deal-id');
    if (dealId) {
      onDrop(dealId, stage.id as PipelineStage);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border transition-all duration-200 ${
        isOver
          ? 'ring-2 ring-cyan-500/50 bg-cyan-500/5 border-cyan-500/30'
          : 'bg-white/[0.015] border-white/[0.06]'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02] rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">{stage.label}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-white/[0.04] text-neutral-400">
          {deals.length}
        </Badge>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="p-2 space-y-2">
          {deals.length === 0 ? (
            <div className="text-center py-10 text-xs text-neutral-600 border border-dashed border-white/[0.06] rounded-lg m-1">
              Drop deals here
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={onCardClick}
                onStageChange={onStageChange}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
