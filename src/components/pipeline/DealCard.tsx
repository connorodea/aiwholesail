import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath, Square, GripVertical } from 'lucide-react';
import { Deal } from '@/types/pipeline';

interface DealCardProps {
  deal: Deal;
  onClick: (deal: Deal) => void;
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
    return `$${(price / 1000).toFixed(0)}K`;
  };

  const { propertyData } = deal;
  const price = propertyData.price;
  const spread = deal.spread || 0;

  return (
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
  );
}
