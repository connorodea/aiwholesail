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
}

export function PipelineColumn({ stage, deals, onDrop, onCardClick }: PipelineColumnProps) {
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
      className={`flex flex-col min-w-[280px] w-[280px] rounded-xl border transition-all duration-200 ${
        isOver
          ? 'ring-2 ring-primary/50 bg-primary/5 border-primary/30'
          : 'bg-muted/30 border-border/50'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
          <span className="text-sm font-medium">{stage.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {deals.length}
        </Badge>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="p-2 space-y-2">
          {deals.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Drag deals here
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} onClick={onCardClick} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
