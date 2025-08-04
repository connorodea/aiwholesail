import { Property } from '@/types/zillow';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Bed, Bath, Square, Calendar, TrendingUp, Eye } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onViewDetails: (property: Property) => void;
}

export function PropertyCard({ property, onViewDetails }: PropertyCardProps) {
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

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {property.address}
            </h3>
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin className="h-4 w-4 mr-1" />
              {property.propertyType || 'Property'}
            </div>
          </div>
          <Badge className={getStatusColor(property.status)}>
            {property.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price */}
        <div className="text-2xl font-bold text-primary">
          {property.price ? formatPrice(property.price) : 'Price N/A'}
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4 text-muted-foreground" />
            <span>{property.bedrooms || 'N/A'} bed</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4 text-muted-foreground" />
            <span>{property.bathrooms || 'N/A'} bath</span>
          </div>
          <div className="flex items-center gap-1">
            <Square className="h-4 w-4 text-muted-foreground" />
            <span>{property.sqft ? formatNumber(property.sqft) : 'N/A'} sqft</span>
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

        {/* Zestimate */}
        {property.zestimate && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">Zestimate</div>
            <div className="font-semibold text-accent">
              {formatPrice(property.zestimate)}
            </div>
            {property.price && (
              <div className="text-xs">
                {property.price > property.zestimate ? 
                  <span className="text-warning">Above estimate</span> :
                  <span className="text-success">Below estimate</span>
                }
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button 
          onClick={() => onViewDetails(property)}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}