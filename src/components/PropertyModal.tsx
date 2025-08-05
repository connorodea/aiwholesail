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
                <div className="flex gap-2 flex-wrap">
                  <Badge className={getStatusColor(property.status)}>
                    {property.status}
                  </Badge>
                  {property.isFSBO && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      FSBO
                    </Badge>
                  )}
                </div>
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
          {/* Property Images */}
          {property.images && property.images.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Property Photos
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {property.images.slice(0, 8).map((image, index) => (
                  <img 
                    key={index} 
                    src={image} 
                    alt={`Property ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* Extended Property Details from Zillow API */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Additional Property Details
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {property.lotSize && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Lot Size</div>
                  <div className="font-semibold">{formatNumber(property.lotSize)} sq ft</div>
                  {property.property_lotSizeWithUnit_lotSizeUnit && (
                    <div className="text-xs text-muted-foreground">{property.property_lotSizeWithUnit_lotSizeUnit}</div>
                  )}
                </div>
              )}

              {property.property_estimates_rentZestimate && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Rent Estimate</div>
                  <div className="font-semibold">{formatPrice(property.property_estimates_rentZestimate)}/mo</div>
                  <div className="text-xs text-muted-foreground">Rent Zestimate</div>
                </div>
              )}

              {property.property_taxAssessment_taxAssessedValue && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Tax Assessment</div>
                  <div className="font-semibold">{formatPrice(property.property_taxAssessment_taxAssessedValue)}</div>
                  {property.property_taxAssessment_taxAssessmentYear && (
                    <div className="text-xs text-muted-foreground">{property.property_taxAssessment_taxAssessmentYear}</div>
                  )}
                </div>
              )}

              {property.property_listing_listingSubType_isFSBA && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-600 dark:text-blue-400">Listing Type</div>
                  <div className="font-semibold text-blue-800 dark:text-blue-200">For Sale By Agent</div>
                </div>
              )}
            </div>

            {/* MLS and Agent Information */}
            {(property.property_propertyDisplayRules_mls_brokerName || property.property_propertyDisplayRules_agent_agentName) && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <h4 className="font-semibold mb-3 text-accent">Listing Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {property.property_propertyDisplayRules_agent_agentName && (
                    <div>
                      <div className="text-sm text-muted-foreground">Listing Agent</div>
                      <div className="font-medium">{property.property_propertyDisplayRules_agent_agentName}</div>
                    </div>
                  )}
                  {property.property_propertyDisplayRules_mls_brokerName && (
                    <div>
                      <div className="text-sm text-muted-foreground">Brokerage</div>
                      <div className="font-medium">{property.property_propertyDisplayRules_mls_brokerName}</div>
                    </div>
                  )}
                  {property.property_propertyDisplayRules_mls_mlsName && (
                    <div>
                      <div className="text-sm text-muted-foreground">MLS</div>
                      <div className="font-medium">{property.property_propertyDisplayRules_mls_mlsName}</div>
                      {property.property_propertyDisplayRules_mls_mlsStatus && (
                        <Badge variant="outline" className="mt-1">
                          {property.property_propertyDisplayRules_mls_mlsStatus}
                        </Badge>
                      )}
                    </div>
                  )}
                  {property.property_listing_palsId && (
                    <div>
                      <div className="text-sm text-muted-foreground">MLS ID</div>
                      <div className="font-mono text-sm">{property.property_listing_palsId}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price History and Market Data */}
            {property.property_price_changedDate && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-3">Price History</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-semibold">{formatPrice(property.price)}</span>
                  </div>
                  {property.property_price_priceChange && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Price Change:</span>
                      <span className={`font-semibold ${property.property_price_priceChange > 0 ? 'text-destructive' : 'text-success'}`}>
                        {property.property_price_priceChange > 0 ? '+' : ''}{formatPrice(property.property_price_priceChange)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last Changed:</span>
                    <span className="text-sm">{new Date(property.property_price_changedDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Property Features and Amenities */}
            <div className="space-y-3">
              <h4 className="font-semibold">Property Features</h4>
              <div className="flex flex-wrap gap-2">
                {property.property_media_hasVRModel && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    🏠 3D Tour Available
                  </Badge>
                )}
                {property.property_media_hasVideos && (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    🎥 Video Tour
                  </Badge>
                )}
                {property.property_media_hasApprovedThirdPartyVirtualTour && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    🌐 Virtual Tour
                  </Badge>
                )}
                {property.property_isShowcaseListing && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    ⭐ Showcase Listing
                  </Badge>
                )}
                {property.property_isFeatured && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    🏆 Featured
                  </Badge>
                )}
                {property.property_isPreforeclosureAuction && (
                  <Badge variant="destructive">
                    ⚠️ Pre-foreclosure
                  </Badge>
                )}
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

          {/* AttomData Enhanced Information */}
          {property.attomData && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Enhanced Property Data
              </h3>
              
              {/* Valuations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.attomData.avm && (
                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="text-sm text-muted-foreground">AttomData AVM</div>
                    <div className="text-lg font-bold text-accent">{formatPrice(property.attomData.avm.amount || 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      Confidence: {property.attomData.avm.confidence}
                    </div>
                  </div>
                )}

                {property.attomData.taxAssessedValue && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground">Tax Assessment</div>
                    <div className="text-lg font-bold">{formatPrice(property.attomData.taxAssessedValue)}</div>
                    {property.attomData.taxInfo?.taxAmount && (
                      <div className="text-xs text-muted-foreground">
                        Annual Tax: {formatPrice(property.attomData.taxInfo.taxAmount)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Owner & Mortgage Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.attomData.owner && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground">Owner Information</div>
                    {property.attomData.owner.name && (
                      <div className="font-medium">{property.attomData.owner.name}</div>
                    )}
                    <Badge variant={property.attomData.owner.ownerOccupied ? "default" : "secondary"} className="mt-1">
                      {property.attomData.owner.ownerOccupied ? "Owner Occupied" : "Non-Owner Occupied"}
                    </Badge>
                  </div>
                )}

                {property.attomData.mortgageInfo && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground">Mortgage Info</div>
                    {property.attomData.mortgageInfo.loanAmount && (
                      <div className="font-medium">{formatPrice(property.attomData.mortgageInfo.loanAmount)}</div>
                    )}
                    {property.attomData.equityPosition && (
                      <div className="text-sm text-success">
                        Equity: {formatPrice(property.attomData.equityPosition)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wholesale Indicators */}
              {property.attomData.motivatedSeller && (
                <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="text-sm text-warning font-medium mb-2">🎯 Wholesale Opportunity</div>
                  {property.attomData.distressIndicators && (
                    <div className="flex flex-wrap gap-1">
                      {property.attomData.distressIndicators.map((indicator, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {indicator}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sale History & Comparables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.attomData.saleHistory && property.attomData.saleHistory.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">Recent Sales</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {property.attomData.saleHistory.slice(0, 3).map((sale, index) => (
                        <div key={index} className="text-xs flex justify-between">
                          <span>{sale.salePrice ? formatPrice(sale.salePrice) : 'N/A'}</span>
                          <span>{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.attomData.comparables && property.attomData.comparables.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">Recent Comps</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {property.attomData.comparables.slice(0, 3).map((comp, index) => (
                        <div key={index} className="text-xs flex justify-between">
                          <span>{comp.salePrice ? formatPrice(comp.salePrice) : 'N/A'}</span>
                          <span>{comp.distance ? `${comp.distance.toFixed(1)}mi` : 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* School and Neighborhood Information */}
          {(property.property_region || property.property_location_latitude) && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-3">Location Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.property_location_latitude && property.property_location_longitude && (
                  <div>
                    <div className="text-sm text-muted-foreground">Coordinates</div>
                    <div className="font-mono text-sm">
                      {property.property_location_latitude.toFixed(6)}, {property.property_location_longitude.toFixed(6)}
                    </div>
                  </div>
                )}
                {property.property_bestGuessTimeZone && (
                  <div>
                    <div className="text-sm text-muted-foreground">Time Zone</div>
                    <div className="font-medium">{property.property_bestGuessTimeZone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Investment Analysis */}
          {property.rental_metrics_monthlyCashFlow !== undefined && (
            <div className="p-4 bg-gradient-to-r from-success/10 to-primary/10 rounded-lg border border-success/20">
              <h4 className="font-semibold mb-3 text-success">Rental Investment Analysis</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Monthly Cash Flow</div>
                  <div className={`font-bold ${property.rental_metrics_monthlyCashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {property.rental_metrics_monthlyCashFlow >= 0 ? '+' : ''}{formatPrice(property.rental_metrics_monthlyCashFlow)}
                  </div>
                </div>
                {property.rental_metrics_cashOnCashReturn !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">Cash on Cash Return</div>
                    <div className={`font-bold ${property.rental_metrics_cashOnCashReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {property.rental_metrics_cashOnCashReturn.toFixed(1)}%
                    </div>
                  </div>
                )}
                {property.rental_metrics_capRate !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">Cap Rate</div>
                    <div className={`font-bold ${property.rental_metrics_capRate >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {property.rental_metrics_capRate.toFixed(1)}%
                    </div>
                  </div>
                )}
                {property.rental_metrics_totalReturn5yr !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">5-Year Return</div>
                    <div className={`font-bold ${property.rental_metrics_totalReturn5yr >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {property.rental_metrics_totalReturn5yr.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Zillow Data Explorer */}
          <details className="p-3 bg-muted/30 rounded-lg">
            <summary className="text-sm font-medium cursor-pointer">All Zillow API Data</summary>
            <div className="mt-3 space-y-2 max-h-96 overflow-auto">
              {Object.entries(property)
                .filter(([key]) => key.startsWith('property_') || key.startsWith('rental_'))
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <div key={key} className="flex text-xs border-b border-muted/20 pb-1">
                    <span className="text-muted-foreground w-1/3 break-words">{key.replace(/^property_|^rental_/, '')}:</span>
                    <span className="w-2/3 font-mono break-words">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </details>

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