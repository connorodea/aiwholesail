import { Property } from '@/types/zillow';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, DollarSign, Star, X } from 'lucide-react';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';

interface PropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyModal({ property, isOpen, onClose }: PropertyModalProps) {
  if (!property) return null;

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

  const wholesalePotential = calculateWholesalePotential(property);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-start justify-between p-8 pb-6 border-b border-border">
          <div className="flex-1 pr-8">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className="text-xs font-normal">
                {property.status}
              </Badge>
              {property.isFSBO && (
                <Badge variant="secondary" className="text-xs font-normal">FSBO</Badge>
              )}
              <Badge 
                variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}
                className="text-xs font-normal"
              >
                {wholesalePotential.tier} potential
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
              {property.address}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{property.propertyType || 'Property'}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground mb-1">
              {property.price ? formatPrice(property.price) : 'Price N/A'}
            </div>
            {property.pricePerSqft && (
              <div className="text-sm text-muted-foreground">
                ${Math.round(property.pricePerSqft)}/sqft
              </div>
            )}
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="ml-4 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Key Stats */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground mb-1">
                {property.bedrooms || '—'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Bedrooms
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground mb-1">
                {property.bathrooms || '—'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Bathrooms
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground mb-1">
                {property.sqft ? formatNumber(property.sqft) : '—'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Square Feet
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground mb-1">
                {property.daysOnMarket || '—'}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Days on Market
              </div>
            </div>
          </div>
        </div>

        {/* AI Wholesale Analysis */}
        <div className="px-8 pb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                AI Wholesale Analysis
                <Badge variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}>
                  {wholesalePotential.tier} deal
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Wholesale Score</span>
                    <span className="text-lg font-bold">{wholesalePotential.score}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Spread Amount</span>
                    <span className="text-lg font-semibold text-green-600">
                      ${formatNumber(wholesalePotential.spreadAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Spread Percentage</span>
                    <span className="text-lg font-semibold">
                      {wholesalePotential.spreadPercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Price</span>
                    <span className="font-medium">{formatPrice(property.price || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Zestimate</span>
                    <span className="font-medium">{formatPrice(property.zestimate || 0)}</span>
                  </div>
                  {wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          Excellent wholesale opportunity!
                        </span>
                      </div>
                    </div>
                  ) : wholesalePotential.tier === 'good' ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Good wholesale potential
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Property Images */}
        {property.images && property.images.length > 0 && (
          <div className="px-8 pb-8">
            <h3 className="text-lg font-semibold mb-4">Photos</h3>
            <div className="grid grid-cols-3 gap-4">
              {property.images.slice(0, 6).map((image, index) => (
                <img 
                  key={index} 
                  src={image} 
                  alt={`Property ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {property.description && (
          <div className="px-8 pb-8">
            <h3 className="text-lg font-semibold mb-4">Description</h3>
            <p className="text-muted-foreground leading-relaxed">
              {property.description}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}