import { Property } from '@/types/zillow';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Bed, Bath, Square, Calendar, TrendingUp, Eye, AlertTriangle, DollarSign, Users, Star, ExternalLink } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onViewDetails: (property: Property) => void;
  highlightWholesaleDeals?: boolean;
}

export function PropertyCard({ property, onViewDetails, highlightWholesaleDeals = false }: PropertyCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'for sale':
        return 'bg-success text-success-foreground';
      case 'pending':
        return 'bg-warning text-warning-foreground';
      case 'sold':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-primary text-primary-foreground';
    }
  };

  // Calculate if this is a high-value wholesale deal (35k+ spread)
  const isHighValueDeal = () => {
    if (!highlightWholesaleDeals || !property.price || !property.zestimate) return false;
    const spread = property.zestimate - property.price;
    return spread >= 35000;
  };

  const cardClassName = isHighValueDeal() 
    ? "group simple-card smooth-transition hover:shadow-elegant bg-gradient-to-br from-success/10 to-success/5 border-2 border-success/30 shadow-lg"
    : "group simple-card smooth-transition hover:shadow-elegant";

  return (
    <Card className={cardClassName}>
      {isHighValueDeal() && (
        <div className="bg-gradient-to-r from-success to-success/80 text-success-foreground px-3 py-2 text-sm font-medium flex items-center gap-2">
          <Star className="h-4 w-4" />
          High-Value Wholesale Deal - ${formatNumber(property.zestimate - property.price)} Spread
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors leading-tight">
              {property.address}
            </h3>
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin className="h-4 w-4 mr-1.5 text-primary/70" />
              {property.propertyType || 'Property'}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className={`${getStatusColor(property.status)} rounded-full px-3 py-1 text-xs font-medium`}>
              {property.status}
            </Badge>
            {property.isFSBO && (
              <Badge className="bg-gradient-to-r from-info/20 to-info/30 text-info border border-info/30 rounded-full px-3 py-1 text-xs font-medium">
                FSBO
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price */}
        <div className="text-3xl font-bold gradient-text">
          {property.price ? formatPrice(property.price) : 'Price N/A'}
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
            <Bed className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{property.bedrooms || 'N/A'} bed</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
            <Bath className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{property.bathrooms || 'N/A'} bath</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
            <Square className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{property.sqft ? formatNumber(property.sqft) : 'N/A'} sqft</span>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {property.daysOnMarket && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{property.daysOnMarket} days on market</span>
            </div>
          )}
          {property.pricePerSqft && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>${Math.round(property.pricePerSqft)}/sqft</span>
            </div>
          )}
          {property.yearBuilt && (
            <div className="text-xs">
              Built in {property.yearBuilt}
            </div>
          )}
        </div>

        {/* Zestimate & AttomData AVM */}
        <div className="space-y-2">
          {property.zestimate && (
            <div className={`p-3 rounded-lg ${
              isHighValueDeal() 
                ? 'bg-gradient-to-r from-success/20 to-success/10 border-2 border-success/40 shadow-md' 
                : 'bg-muted/50'
            }`}>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {isHighValueDeal() && <Star className="h-3 w-3 text-success" />}
                Zestimate
                {isHighValueDeal() && (
                  <span className="text-success font-medium">
                    (+${formatNumber(property.zestimate - property.price)} spread)
                  </span>
                )}
              </div>
              <div className={`font-semibold ${isHighValueDeal() ? 'text-success' : 'text-accent'}`}>
                {formatPrice(property.zestimate)}
              </div>
              {property.price && (
                <div className="text-xs">
                  {property.price > property.zestimate ? 
                    <span className="text-warning">Above estimate</span> :
                    <span className={isHighValueDeal() ? 'text-success font-medium' : 'text-success'}>
                      Below estimate
                    </span>
                  }
                </div>
              )}
            </div>
          )}
          
          {property.attomData?.avm?.amount && (
            <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3" />
                AttomData AVM ({property.attomData.avm.confidence})
              </div>
              <div className="font-semibold text-accent">
                {formatPrice(property.attomData.avm.amount)}
              </div>
              {property.price && (
                <div className="text-xs">
                  {property.price > property.attomData.avm.amount ? 
                    <span className="text-warning">Above AVM</span> :
                    <span className="text-success">Below AVM</span>
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* AttomData Wholesale Indicators */}
        {property.attomData && (
          <div className="space-y-2">
            {/* Motivated Seller Indicators */}
            {property.attomData.motivatedSeller && property.attomData.distressIndicators && (
              <div className="p-2 bg-warning/10 rounded border border-warning/20">
                <div className="flex items-center gap-1 text-xs text-warning font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  Motivated Seller
                </div>
                <div className="text-xs text-muted-foreground">
                  {property.attomData.distressIndicators.join(', ')}
                </div>
              </div>
            )}

            {/* Owner Info */}
            {property.attomData.owner && (
              <div className="p-2 bg-info/10 rounded border border-info/20">
                <div className="flex items-center gap-1 text-xs text-info font-medium">
                  <Users className="h-3 w-3" />
                  Owner Info
                </div>
                <div className="text-xs text-muted-foreground">
                  {property.attomData.owner.ownerOccupied ? 'Owner Occupied' : 'Non-Owner Occupied'}
                </div>
              </div>
            )}

            {/* Equity Position */}
            {property.attomData.equityPosition && (
              <div className="p-2 bg-success/10 rounded border border-success/20">
                <div className="flex items-center gap-1 text-xs text-success font-medium">
                  <DollarSign className="h-3 w-3" />
                  Equity Position
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatPrice(property.attomData.equityPosition)}
                </div>
              </div>
            )}

            {/* Tax Assessment */}
            {property.attomData.taxAssessedValue && (
              <div className="text-xs text-muted-foreground">
                Tax Assessment: {formatPrice(property.attomData.taxAssessedValue)}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-6">
        <div className="flex gap-3 w-full">
          <Button 
            onClick={() => onViewDetails(property)}
            variant="default"
            size="lg"
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="px-4"
            onClick={(e) => {
              e.stopPropagation();
              const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(property.address)}_rb/`;
              window.open(zillowUrl, '_blank');
            }}
          >
            <ExternalLink className="h-5 w-5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}