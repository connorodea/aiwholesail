import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath } from 'lucide-react';
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
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 border-border/50"
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
      <CardContent className="p-3 space-y-2">
        {/* Row 1: Price + spread badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight">
            {price ? formatPrice(price) : 'Price TBD'}
          </span>
          {spread > 0 && (
            <Badge
              variant="outline"
              className={`text-xs font-medium ${
                spread >= 50000
                  ? 'border-green-500 text-green-600 bg-green-50'
                  : spread >= 30000
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-muted text-muted-foreground'
              }`}
            >
              +${(spread / 1000).toFixed(0)}K
            </Badge>
          )}
        </div>

        {/* Row 2: Address */}
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          {propertyData.address || 'No address'}
        </p>

        {/* Row 3: Beds/Baths + Score */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            {propertyData.bedrooms != null && (
              <span className="flex items-center gap-0.5">
                <Bed className="h-3 w-3" />
                {propertyData.bedrooms}
              </span>
            )}
            {propertyData.bathrooms != null && (
              <span className="flex items-center gap-0.5">
                <Bath className="h-3 w-3" />
                {propertyData.bathrooms}
              </span>
            )}
            {propertyData.sqft != null && (
              <span>{(propertyData.sqft / 1000).toFixed(1)}K sqft</span>
            )}
          </span>
          {deal.overallScore != null && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {deal.overallScore}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
