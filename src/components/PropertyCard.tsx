import { Property } from '@/types/zillow';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, Bed, Bath, Square, Calendar, Eye, ExternalLink, Search, TrendingUp, TrendingDown, Clock, Flame, User, Phone, Building2 } from 'lucide-react';
import { useState } from 'react';
import { SkipTraceModal } from './SkipTraceModal';

interface PropertyCardProps {
  property: Property;
  onViewDetails: (property: Property) => void;
  highlightWholesaleDeals?: boolean;
  showFSBOBadge?: boolean;
}

export function PropertyCard({ property, onViewDetails }: PropertyCardProps) {
  const [showSkipTrace, setShowSkipTrace] = useState(false);

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(2)}M`;
    }
    return `$${(price / 1000).toFixed(0)}K`;
  };

  const formatFullPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatSpread = (spread: number) => {
    const abs = Math.abs(spread);
    if (abs >= 1000000) {
      return `${spread >= 0 ? '+' : '-'}$${(abs / 1000000).toFixed(2)}M`;
    }
    return `${spread >= 0 ? '+' : '-'}$${(abs / 1000).toFixed(0)}K`;
  };

  // Calculate spread
  const spread = property.price && property.zestimate ? property.zestimate - property.price : 0;
  const spreadPercent = property.zestimate && property.zestimate > 0 ? ((spread / property.zestimate) * 100).toFixed(1) : '0';
  const hasZestimate = !!(property.zestimate && property.price);
  const isQualifiedDeal = spread >= 30000;
  const isGreatDeal = spread >= 50000;
  const isTopDeal = spread >= 100000;

  // Days on market
  const daysOnMarket = property.daysOnMarket ?? null;
  const isNew = daysOnMarket !== null && daysOnMarket <= 1;
  const isFresh = daysOnMarket !== null && daysOnMarket <= 7;

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-xl ${
      isTopDeal ? 'ring-2 ring-yellow-500 bg-gradient-to-br from-yellow-500/10 to-amber-500/5' :
      isGreatDeal ? 'ring-2 ring-emerald-500 bg-gradient-to-br from-emerald-500/10 to-green-500/5' :
      isQualifiedDeal ? 'ring-2 ring-green-500/50 bg-gradient-to-br from-green-500/5 to-emerald-500/5' :
      'hover:ring-1 hover:ring-border'
    }`}>
      {/* Deal Banner */}
      {isQualifiedDeal && (
        <div className={`px-4 py-2 text-sm font-semibold flex items-center justify-between ${
          isTopDeal ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
          isGreatDeal ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' :
          'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
        }`}>
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {isTopDeal ? 'TOP DEAL' : isGreatDeal ? 'GREAT DEAL' : 'WHOLESALE DEAL'}
          </span>
          <span className="flex items-center gap-2">
            {formatSpread(spread)}
            {isNew && <Flame className="h-4 w-4" />}
          </span>
        </div>
      )}

      <CardContent className="p-4 space-y-4">
        {/* Header: Price + Status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-2xl font-bold tracking-tight">
              {property.price ? formatFullPrice(property.price) : 'Price TBD'}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{property.address}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={property.status?.toLowerCase().includes('sale') ? 'default' : 'secondary'} className="text-xs">
              {property.status || 'For Sale'}
            </Badge>
            {isNew && (
              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                <Flame className="h-3 w-3" /> NEW
              </Badge>
            )}
          </div>
        </div>

        {/* Property Details */}
        <div className="flex items-center gap-4 text-sm">
          {property.bedrooms && (
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms && (
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{property.bathrooms}</span>
            </div>
          )}
          {property.sqft && (
            <div className="flex items-center gap-1">
              <Square className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{property.sqft.toLocaleString()}</span>
            </div>
          )}
          {daysOnMarket !== null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={`font-medium ${isFresh ? 'text-orange-500' : ''}`}>
                {daysOnMarket === 0 ? 'Today' : `${daysOnMarket}d`}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* SPREAD Section - The Main Focus */}
        <div className={`p-4 rounded-xl text-center ${
          hasZestimate ? (
            isQualifiedDeal ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30' :
            spread > 0 ? 'bg-green-500/10 border border-green-500/20' :
            spread < 0 ? 'bg-orange-500/10 border border-orange-500/20' :
            'bg-muted/50 border border-border'
          ) : (property as any).zestimateUnavailable ? 'bg-muted/30 border border-dashed border-border' :
          'bg-muted/30 border border-dashed border-border'
        }`}>
          {hasZestimate ? (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Spread
              </div>
              <div className={`text-3xl font-bold tracking-tight ${
                isQualifiedDeal ? 'text-green-500' :
                spread > 0 ? 'text-green-600' :
                spread < 0 ? 'text-orange-500' :
                'text-muted-foreground'
              }`}>
                {formatSpread(spread)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-2">
                <span>Zestimate: {formatFullPrice(property.zestimate!)}</span>
                <span className={spread > 0 ? 'text-green-500' : spread < 0 ? 'text-orange-500' : ''}>
                  ({spreadPercent}%)
                </span>
              </div>
              {isQualifiedDeal && (
                <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-green-600">
                  <TrendingDown className="h-3 w-3" />
                  Below market value
                </div>
              )}
            </>
          ) : (property as any).zestimateUnavailable ? (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Spread
              </div>
              <div className="text-xl font-semibold text-muted-foreground/60">N/A</div>
              <div className="text-xs text-muted-foreground mt-1">No Zestimate available</div>
            </>
          ) : (
            <>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Spread
              </div>
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Calculating...</span>
              </div>
            </>
          )}
        </div>

        {/* Agent Info Preview */}
        {(property.agentName || property.brokerageName) && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{property.agentName || 'Agent N/A'}</span>
              </div>
              {property.agentPhone && (
                <a
                  href={`tel:${property.agentPhone}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="h-3 w-3" />
                  <span>Call</span>
                </a>
              )}
            </div>
            {property.brokerageName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{property.brokerageName}</span>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          onClick={() => onViewDetails(property)}
          className="flex-1"
          size="sm"
        >
          <Eye className="h-4 w-4 mr-2" />
          Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowSkipTrace(true);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://www.zillow.com/homes/${encodeURIComponent(property.address)}_rb/`, '_blank');
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardFooter>

      <SkipTraceModal
        property={property}
        isOpen={showSkipTrace}
        onClose={() => setShowSkipTrace(false)}
      />
    </Card>
  );
}
