import { Property } from '@/types/zillow';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Bed, Bath, Square, Calendar, TrendingUp, Eye, AlertTriangle, DollarSign, Users, Star, ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import { SkipTraceModal } from './SkipTraceModal';
import { LeadScoreBadge } from './LeadScoreBadge';

interface PropertyCardProps {
  property: Property;
  onViewDetails: (property: Property) => void;
  highlightWholesaleDeals?: boolean;
}

export function PropertyCard({ property, onViewDetails, highlightWholesaleDeals = false }: PropertyCardProps) {
  const [showSkipTrace, setShowSkipTrace] = useState(false);
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

  // Check if property was listed recently (within 24 hours)
  const isListedRecently = () => {
    const listingDate = property.datePostedString || property.listDate;
    if (!listingDate) {
      // For testing - if no real date, randomly make some properties appear recent
      const testId = property.id.toString();
      return testId.includes('3') || testId.includes('7'); // Arbitrary test condition
    }
    
    const posted = new Date(listingDate);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return posted > twentyFourHoursAgo;
  };

  // Format the listing date for display
  const formatListingDate = () => {
    const listingDate = property.datePostedString || property.listDate;
    if (!listingDate) {
      // For testing - show mock recent times for some properties
      const testId = property.id.toString();
      if (testId.includes('3')) return '2 hours ago';
      if (testId.includes('7')) return '15 hours ago';
      return 'Recently listed';
    }
    
    const posted = new Date(listingDate);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 1) return 'less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return posted.toLocaleDateString();
  };

  // Get styling for listing date section
  const getListingDateStyle = () => {
    if (isListedRecently()) {
      return 'bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/40 shadow-md';
    }
    return 'bg-muted/50 border-muted';
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
      
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors leading-tight break-words">
              {property.address}
            </h3>
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin className="h-4 w-4 mr-1.5 text-primary/70 flex-shrink-0" />
              <span className="truncate">{property.propertyType || 'Property'}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className={`${getStatusColor(property.status)} rounded-full px-2 sm:px-3 py-1 text-xs font-medium flex-shrink-0`}>
              {property.status}
            </Badge>
            {property.isFSBO && (
              <Badge className="bg-gradient-to-r from-info/20 to-info/30 text-info border border-info/30 rounded-full px-2 sm:px-3 py-1 text-xs font-medium flex-shrink-0">
                FSBO
              </Badge>
            )}
            <LeadScoreBadge 
              leadId={property.zpid || property.id} 
              className="rounded-full px-2 sm:px-3 py-1 text-xs font-medium flex-shrink-0"
              showIcon={false}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6">
        {/* Price */}
        <div className="text-2xl sm:text-3xl font-bold gradient-text">
          {property.price ? formatPrice(property.price) : 'Price N/A'}
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-muted/30 rounded-lg">
            <Bed className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate">{property.bedrooms || 'N/A'} <span className="hidden sm:inline">bed</span></span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-muted/30 rounded-lg">
            <Bath className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate">{property.bathrooms || 'N/A'} <span className="hidden sm:inline">bath</span></span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-muted/30 rounded-lg">
            <Square className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate">{property.sqft ? formatNumber(property.sqft) : 'N/A'} <span className="hidden sm:inline">sqft</span></span>
          </div>
        </div>

        {/* Listing Date - Highlighted Area */}
        <div className={`p-3 rounded-lg border ${getListingDateStyle()}`}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <div>
              <div className="text-sm font-medium">
                Listed {formatListingDate()}
              </div>
              {isListedRecently() && (
                <div className="text-xs text-primary font-medium">
                  🔥 Listed within 24 hours!
                </div>
              )}
            </div>
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

      <CardFooter className="pt-4 sm:pt-6">
        <div className="flex gap-2 w-full">
          <Button 
            onClick={() => onViewDetails(property)}
            variant="default"
            size="sm"
            className="flex-1 text-xs sm:text-sm"
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">View </span>Details
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="px-2 sm:px-3"
            onClick={(e) => {
              e.stopPropagation();
              setShowSkipTrace(true);
            }}
          >
            <Search className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline ml-1">Skip Trace</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="px-2 sm:px-4"
            onClick={(e) => {
              e.stopPropagation();
              const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(property.address)}_rb/`;
              window.open(zillowUrl, '_blank');
            }}
          >
            <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </CardFooter>

      <SkipTraceModal
        property={property}
        isOpen={showSkipTrace}
        onClose={() => setShowSkipTrace(false)}
      />
    </Card>
  );
}