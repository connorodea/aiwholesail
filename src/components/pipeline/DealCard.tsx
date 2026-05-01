import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath, Square, GripVertical, ArrowRight, Eye, Trash2 } from 'lucide-react';
import { Deal, PIPELINE_STAGES, PipelineStage } from '@/types/pipeline';

interface DealCardProps {
  deal: Deal;
  onClick: (deal: Deal) => void;
  onStageChange?: (dealId: string, stage: PipelineStage) => void;
  onRemove?: (dealId: string) => void;
}

export function DealCard({ deal, onClick, onStageChange, onRemove }: DealCardProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
    return `$${(price / 1000).toFixed(0)}K`;
  };

  const { propertyData } = deal;
  const price = propertyData.price;
  const spread = deal.spread || 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setShowMoveSubmenu(false);
  };

  const closeMenu = () => {
    setContextMenu(null);
    setShowMoveSubmenu(false);
  };

  // Close context menu on click outside or scroll
  useEffect(() => {
    if (!contextMenu) return;

    const handleClose = () => closeMenu();
    document.addEventListener('click', handleClose);
    document.addEventListener('scroll', handleClose, true);
    return () => {
      document.removeEventListener('click', handleClose);
      document.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  return (
    <>
      <Card
        className="cursor-grab active:cursor-grabbing hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200 border-white/[0.08] bg-white/[0.02]"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-deal-id', deal.id);
          e.dataTransfer.effectAllowed = 'move';
          (e.currentTarget as HTMLElement).style.opacity = '0.5';
        }}
        onDragEnd={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
        }}
        onClick={() => onClick(deal)}
        onContextMenu={handleContextMenu}
      >
        <CardContent className="p-3 space-y-2.5">
          {/* Row 1: Price + spread badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 text-neutral-600" />
              <span className="text-base font-bold tracking-tight text-white">
                {price ? formatPrice(price) : 'Price TBD'}
              </span>
            </div>
            {spread > 0 && (
              <Badge
                className={`text-[11px] font-semibold border ${
                  spread >= 50000
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : spread >= 30000
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : 'border-white/10 text-neutral-300 bg-white/5'
                }`}
              >
                +${(spread / 1000).toFixed(0)}K
              </Badge>
            )}
          </div>

          {/* Row 2: Address */}
          <p className="text-xs text-neutral-400 truncate flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-neutral-500" />
            {propertyData.address || 'No address'}
          </p>

          {/* Row 3: Beds/Baths/SqFt */}
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            {propertyData.bedrooms != null && (
              <span className="flex items-center gap-1">
                <Bed className="h-3 w-3" />
                {propertyData.bedrooms}
              </span>
            )}
            {propertyData.bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath className="h-3 w-3" />
                {propertyData.bathrooms}
              </span>
            )}
            {propertyData.sqft != null && (
              <span className="flex items-center gap-1">
                <Square className="h-3 w-3" />
                {propertyData.sqft.toLocaleString()}
              </span>
            )}
            {deal.overallScore != null && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto bg-white/[0.04]">
                {deal.overallScore}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[180px] rounded-lg border border-white/[0.1] bg-[#1a1b1e] shadow-xl shadow-black/40 py-1 text-sm"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Move to submenu */}
          <div
            className="relative"
            onMouseEnter={() => setShowMoveSubmenu(true)}
            onMouseLeave={() => setShowMoveSubmenu(false)}
          >
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveSubmenu(!showMoveSubmenu);
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>Move to</span>
              <span className="ml-auto text-neutral-500 text-xs">&#9656;</span>
            </button>

            {showMoveSubmenu && (
              <div className="absolute left-full top-0 ml-0.5 min-w-[180px] rounded-lg border border-white/[0.1] bg-[#1a1b1e] shadow-xl shadow-black/40 py-1">
                {PIPELINE_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    disabled={deal.status === stage.id}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      deal.status === stage.id
                        ? 'text-neutral-600 cursor-default'
                        : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (deal.status !== stage.id && onStageChange) {
                        onStageChange(deal.id, stage.id as PipelineStage);
                      }
                      closeMenu();
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <span>{stage.label}</span>
                    {deal.status === stage.id && (
                      <span className="ml-auto text-[10px] text-neutral-600">current</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Details */}
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClick(deal);
              closeMenu();
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Details</span>
          </button>

          {/* Separator */}
          <div className="my-1 border-t border-white/[0.06]" />

          {/* Remove */}
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (onRemove) {
                onRemove(deal.id);
              }
              closeMenu();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Remove from Pipeline</span>
          </button>
        </div>
      )}
    </>
  );
}
