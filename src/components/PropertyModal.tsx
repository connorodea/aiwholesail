import { Property } from '@/types/zillow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, Bed, Bath, Square, Calendar, TrendingUp, Home, DollarSign, Download, Star } from 'lucide-react';

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

  const calculateWholesaleMetrics = () => {
    if (!property.price || !property.zestimate) return null;
    
    const arv = property.zestimate; // After Repair Value (using Zestimate as estimate)
    const estimatedRepairs = arv * 0.15; // Assume 15% of ARV for repairs
    const wholesaleFee = 10000; // Typical wholesale fee
    const maxOffer = arv * 0.7 - estimatedRepairs - wholesaleFee; // 70% rule
    const spread = property.price - maxOffer;
    
    return {
      arv,
      estimatedRepairs,
      wholesaleFee,
      maxOffer,
      spread,
      profitPotential: spread > 0 ? 'Low' : 'High'
    };
  };

  const wholesaleMetrics = calculateWholesaleMetrics();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">{property.address}</h2>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{property.propertyType || 'Property'}</span>
                <Badge className={getStatusColor(property.status)}>
                  {property.status}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {property.price ? formatPrice(property.price) : 'Price N/A'}
              </div>
              {property.pricePerSqft && (
                <div className="text-sm text-muted-foreground">
                  ${Math.round(property.pricePerSqft)}/sqft
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Property Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Bed className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">{property.bedrooms || 'N/A'}</div>
                <div className="text-xs text-muted-foreground">Bedrooms</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Bath className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">{property.bathrooms || 'N/A'}</div>
                <div className="text-xs text-muted-foreground">Bathrooms</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Square className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">{property.sqft ? formatNumber(property.sqft) : 'N/A'}</div>
                <div className="text-xs text-muted-foreground">Sq Ft</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">{property.yearBuilt || 'N/A'}</div>
                <div className="text-xs text-muted-foreground">Year Built</div>
              </div>
            </div>
          </div>

          {/* Market Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {property.zestimate && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  <span className="font-semibold">Zestimate</span>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {formatPrice(property.zestimate)}
                </div>
                {property.price && (
                  <div className="text-sm mt-1">
                    {property.price > property.zestimate ? (
                      <span className="text-warning">
                        ${formatNumber(property.price - property.zestimate)} above estimate
                      </span>
                    ) : (
                      <span className="text-success">
                        ${formatNumber(property.zestimate - property.price)} below estimate
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {property.daysOnMarket && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Days on Market</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {property.daysOnMarket}
                </div>
                <div className="text-sm text-muted-foreground">
                  {property.daysOnMarket > 60 ? 'Long time on market' : 'Recent listing'}
                </div>
              </div>
            )}
          </div>

          {/* Wholesale Analysis */}
          {wholesaleMetrics && (
            <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Wholesale Analysis</h3>
                <Badge variant={wholesaleMetrics.profitPotential === 'High' ? 'default' : 'secondary'}>
                  {wholesaleMetrics.profitPotential} Profit Potential
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ARV (Zestimate):</span>
                    <span className="font-semibold">{formatPrice(wholesaleMetrics.arv)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Repairs (15%):</span>
                    <span className="font-semibold text-warning">-{formatPrice(wholesaleMetrics.estimatedRepairs)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wholesale Fee:</span>
                    <span className="font-semibold text-primary">-{formatPrice(wholesaleMetrics.wholesaleFee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Max Offer (70% Rule):</span>
                    <span className="font-bold text-success">{formatPrice(wholesaleMetrics.maxOffer)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-semibold">{formatPrice(property.price!)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Max Offer:</span>
                    <span className="font-semibold">{formatPrice(wholesaleMetrics.maxOffer)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Spread:</span>
                    <span className={`font-bold ${wholesaleMetrics.spread < 0 ? 'text-success' : 'text-destructive'}`}>
                      {wholesaleMetrics.spread < 0 ? '+' : ''}{formatPrice(Math.abs(wholesaleMetrics.spread))}
                    </span>
                  </div>
                  {wholesaleMetrics.spread < 0 && (
                    <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium text-success">Good wholesale opportunity!</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Property Description */}
          {property.description && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Description
              </h3>
              <p className="text-muted-foreground">{property.description}</p>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {property.lotSize && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Lot Size</div>
                <div className="font-semibold">{formatNumber(property.lotSize)} sq ft</div>
              </div>
            )}
            
            {/* Raw data preview for debugging */}
            <details className="p-3 bg-muted/30 rounded-lg">
              <summary className="text-sm font-medium cursor-pointer">Raw Property Data</summary>
              <pre className="text-xs mt-2 overflow-auto max-h-32 text-muted-foreground">
                {JSON.stringify(property, null, 2)}
              </pre>
            </details>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button className="flex-1 bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4 mr-2" />
              Export Lead
            </Button>
            <Button variant="outline" className="flex-1">
              <Star className="h-4 w-4 mr-2" />
              Save to Favorites
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}