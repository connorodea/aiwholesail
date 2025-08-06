import { Property } from '@/types/zillow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, Bed, Bath, Square, Calendar, TrendingUp, Home, DollarSign, Download, Star, Phone, StarIcon } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface PropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyModal({ property, isOpen, onClose }: PropertyModalProps) {
  const { user } = useAuth();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { exportLead, loading: exportLoading } = useLeads();
  const [actionLoading, setActionLoading] = useState(false);

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
                      {/* Agent Phone Number */}
                      {(property.property_listing_agentPhone || property.property_contact_phone || property.agent_phone) && (
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {property.property_listing_agentPhone || property.property_contact_phone || property.agent_phone}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {property.property_propertyDisplayRules_mls_brokerName && (
                    <div>
                      <div className="text-sm text-muted-foreground">Brokerage</div>
                      <div className="font-medium">{property.property_propertyDisplayRules_mls_brokerName}</div>
                      {/* Brokerage Phone */}
                      {property.property_brokerage_phone && (
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {property.property_brokerage_phone}
                          </span>
                        </div>
                      )}
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
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                AttomData Intelligence
              </h3>
              
              {/* Property Valuations Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {property.attomData.avm && (
                  <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="text-sm text-muted-foreground">AttomData AVM</div>
                    <div className="text-xl font-bold text-accent">{formatPrice(property.attomData.avm.amount || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Confidence: {property.attomData.avm.confidence}
                      {property.attomData.avm.date && (
                        <div>Date: {new Date(property.attomData.avm.date).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                )}

                {property.attomData.marketValue && (
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="text-sm text-muted-foreground">Market Value</div>
                    <div className="text-xl font-bold text-primary">{formatPrice(property.attomData.marketValue)}</div>
                  </div>
                )}

                {property.attomData.taxAssessedValue && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground">Tax Assessment</div>
                    <div className="text-xl font-bold">{formatPrice(property.attomData.taxAssessedValue)}</div>
                    {property.attomData.taxInfo?.taxAmount && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Annual Tax: {formatPrice(property.attomData.taxInfo.taxAmount)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Comprehensive Mortgage & Ownership Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Detailed Owner Information */}
                {property.attomData.owner && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Owner Details
                    </h4>
                    <div className="space-y-3">
                      {property.attomData.owner.name && (
                        <div>
                          <div className="text-sm text-blue-600 dark:text-blue-400">Owner Name</div>
                          <div className="font-medium text-blue-900 dark:text-blue-100">{property.attomData.owner.name}</div>
                        </div>
                      )}
                      {property.attomData.owner.mailingAddress && (
                        <div>
                          <div className="text-sm text-blue-600 dark:text-blue-400">Mailing Address</div>
                          <div className="text-sm text-blue-800 dark:text-blue-200">{property.attomData.owner.mailingAddress}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant={property.attomData.owner.ownerOccupied ? "default" : "secondary"}>
                          {property.attomData.owner.ownerOccupied ? "Owner Occupied" : "Non-Owner Occupied"}
                        </Badge>
                        {!property.attomData.owner.ownerOccupied && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Investment Property
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Comprehensive Mortgage Information */}
                {property.attomData.mortgageInfo && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold mb-3 text-green-800 dark:text-green-200 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Mortgage Information
                    </h4>
                    <div className="space-y-3">
                      {property.attomData.mortgageInfo.loanAmount && (
                        <div>
                          <div className="text-sm text-green-600 dark:text-green-400">Loan Amount</div>
                          <div className="text-lg font-bold text-green-900 dark:text-green-100">
                            {formatPrice(property.attomData.mortgageInfo.loanAmount)}
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {property.attomData.mortgageInfo.lenderName && (
                          <div>
                            <div className="text-sm text-green-600 dark:text-green-400">Lender</div>
                            <div className="font-medium text-green-800 dark:text-green-200">{property.attomData.mortgageInfo.lenderName}</div>
                          </div>
                        )}
                        
                        {property.attomData.mortgageInfo.loanType && (
                          <div>
                            <div className="text-sm text-green-600 dark:text-green-400">Loan Type</div>
                            <div className="font-medium text-green-800 dark:text-green-200">{property.attomData.mortgageInfo.loanType}</div>
                          </div>
                        )}
                        
                        {property.attomData.mortgageInfo.interestRate && (
                          <div>
                            <div className="text-sm text-green-600 dark:text-green-400">Interest Rate</div>
                            <div className="font-medium text-green-800 dark:text-green-200">{property.attomData.mortgageInfo.interestRate}%</div>
                          </div>
                        )}
                        
                        {property.attomData.mortgageInfo.loanDate && (
                          <div>
                            <div className="text-sm text-green-600 dark:text-green-400">Loan Date</div>
                            <div className="font-medium text-green-800 dark:text-green-200">
                              {new Date(property.attomData.mortgageInfo.loanDate).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {property.attomData.equityPosition && (
                        <div className="pt-2 border-t border-green-200 dark:border-green-800">
                          <div className="text-sm text-green-600 dark:text-green-400">Estimated Equity</div>
                          <div className="text-lg font-bold text-success">
                            {formatPrice(property.attomData.equityPosition)}
                          </div>
                          {property.attomData.mortgageInfo.loanAmount && property.attomData.avm?.amount && (
                            <div className="text-xs text-green-600 dark:text-green-400">
                              Equity Ratio: {((property.attomData.equityPosition / property.attomData.avm.amount) * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Comprehensive Tax Information */}
              {property.attomData.taxInfo && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h4 className="font-semibold mb-3 text-yellow-800 dark:text-yellow-200">Tax Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {property.attomData.taxInfo.taxAmount && (
                      <div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">Annual Tax</div>
                        <div className="font-bold text-yellow-900 dark:text-yellow-100">{formatPrice(property.attomData.taxInfo.taxAmount)}</div>
                      </div>
                    )}
                    {property.attomData.taxInfo.taxYear && (
                      <div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">Tax Year</div>
                        <div className="font-medium text-yellow-800 dark:text-yellow-200">{property.attomData.taxInfo.taxYear}</div>
                      </div>
                    )}
                    {property.attomData.taxInfo.millRate && (
                      <div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">Mill Rate</div>
                        <div className="font-medium text-yellow-800 dark:text-yellow-200">{property.attomData.taxInfo.millRate}</div>
                      </div>
                    )}
                    {property.attomData.taxInfo.exemptions && property.attomData.taxInfo.exemptions.length > 0 && (
                      <div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">Exemptions</div>
                        <div className="text-xs">
                          {property.attomData.taxInfo.exemptions.map((exemption, index) => (
                            <Badge key={index} variant="outline" className="mr-1 mb-1 text-xs">
                              {exemption}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Demographics & Neighborhood Data */}
              {property.attomData.demographics && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold mb-3 text-purple-800 dark:text-purple-200">Neighborhood Demographics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {property.attomData.demographics.medianHouseholdIncome && (
                      <div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">Median Income</div>
                        <div className="font-bold text-purple-900 dark:text-purple-100">
                          {formatPrice(property.attomData.demographics.medianHouseholdIncome)}
                        </div>
                      </div>
                    )}
                    {property.attomData.demographics.medianAge && (
                      <div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">Median Age</div>
                        <div className="font-medium text-purple-800 dark:text-purple-200">{property.attomData.demographics.medianAge} years</div>
                      </div>
                    )}
                    {property.attomData.demographics.populationDensity && (
                      <div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">Pop. Density</div>
                        <div className="font-medium text-purple-800 dark:text-purple-200">{property.attomData.demographics.populationDensity}/sq mi</div>
                      </div>
                    )}
                    {property.attomData.demographics.crimeIndex && (
                      <div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">Crime Index</div>
                        <div className={`font-medium ${property.attomData.demographics.crimeIndex > 50 ? 'text-red-600' : 'text-green-600'}`}>
                          {property.attomData.demographics.crimeIndex}
                        </div>
                      </div>
                    )}
                    {property.attomData.demographics.schoolRating && (
                      <div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">School Rating</div>
                        <div className="font-medium text-purple-800 dark:text-purple-200">{property.attomData.demographics.schoolRating}/10</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Foreclosure & Distress Indicators */}
              {(property.attomData.foreclosureStatus || property.attomData.preForeclosure || property.attomData.motivatedSeller) && (
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <h4 className="font-semibold mb-3 text-red-800 dark:text-red-200 flex items-center gap-2">
                    ⚠️ Distress Indicators & Opportunities
                  </h4>
                  <div className="space-y-3">
                    {property.attomData.foreclosureStatus && (
                      <div>
                        <Badge variant="destructive" className="mb-2">
                          Foreclosure Status: {property.attomData.foreclosureStatus}
                        </Badge>
                      </div>
                    )}
                    
                    {property.attomData.preForeclosure && (
                      <Badge variant="destructive">
                        Pre-Foreclosure
                      </Badge>
                    )}
                    
                    {property.attomData.motivatedSeller && (
                      <div>
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 mb-2">
                          🎯 Motivated Seller Detected
                        </Badge>
                        {property.attomData.distressIndicators && property.attomData.distressIndicators.length > 0 && (
                          <div className="mt-2">
                            <div className="text-sm text-red-600 dark:text-red-400 mb-1">Distress Signals:</div>
                            <div className="flex flex-wrap gap-1">
                              {property.attomData.distressIndicators.map((indicator, index) => (
                                <Badge key={index} variant="outline" className="text-xs text-red-700 border-red-300">
                                  {indicator}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {property.attomData.priceReductions && property.attomData.priceReductions > 0 && (
                      <div>
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          📉 {property.attomData.priceReductions} Price Reduction{property.attomData.priceReductions > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Property History & Comparables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {property.attomData.saleHistory && property.attomData.saleHistory.length > 0 && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-3 text-foreground">Sale History</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {property.attomData.saleHistory.map((sale, index) => (
                        <div key={index} className="p-2 bg-background rounded border">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {sale.salePrice ? formatPrice(sale.salePrice) : 'Price N/A'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'Date N/A'}
                            </span>
                          </div>
                          {(sale.saleType || sale.deed) && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {sale.saleType && <span>{sale.saleType}</span>}
                              {sale.deed && <span> • {sale.deed}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.attomData.comparables && property.attomData.comparables.length > 0 && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-3 text-foreground">Recent Comparables</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {property.attomData.comparables.map((comp, index) => (
                        <div key={index} className="p-2 bg-background rounded border">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {comp.salePrice ? formatPrice(comp.salePrice) : 'Price N/A'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {comp.distance ? `${comp.distance.toFixed(1)}mi` : 'Distance N/A'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {comp.address && <div>{comp.address}</div>}
                            {comp.saleDate && (
                              <span>Sold: {new Date(comp.saleDate).toLocaleDateString()}</span>
                            )}
                            {comp.livingAreaSqFt && (
                              <span> • {formatNumber(comp.livingAreaSqFt)} sq ft</span>
                            )}
                          </div>
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
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={async () => {
                setActionLoading(true);
                await exportLead(property);
                setActionLoading(false);
              }}
              disabled={exportLoading || actionLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {exportLoading || actionLoading ? 'Exporting...' : 'Export Lead'}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={async () => {
                if (!user) {
                  window.location.href = '/auth';
                  return;
                }
                setActionLoading(true);
                if (isFavorite(property.id)) {
                  await removeFromFavorites(property.id);
                } else {
                  await addToFavorites(property);
                }
                setActionLoading(false);
              }}
              disabled={actionLoading}
            >
              {isFavorite(property.id) ? (
                <>
                  <StarIcon className="h-4 w-4 mr-2 fill-current" />
                  {actionLoading ? 'Removing...' : 'Remove from Favorites'}
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Adding...' : 'Save to Favorites'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}