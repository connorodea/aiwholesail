import { Property } from '@/types/zillow';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Bed, Bath, Square, Calendar, TrendingUp, Home, DollarSign, Star, Phone, Heart, Download, X } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { PropertyAnalysisTabs } from './PropertyAnalysisTabs';
import { CallAgentButton } from './CallAgentButton';
import { LeadScoringPanel } from './LeadScoringPanel';

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

  const calculateWholesaleMetrics = () => {
    if (!property.price || !property.zestimate) return null;
    
    const arv = property.zestimate;
    const estimatedRepairs = arv * 0.15;
    const wholesaleFee = 10000;
    const maxOffer = arv * 0.7 - estimatedRepairs - wholesaleFee;
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

  const handleFavoriteToggle = async () => {
    if (!user || !property.zpid) return;
    
    setActionLoading(true);
    try {
      if (isFavorite(property.zpid)) {
        await removeFromFavorites(property.zpid);
      } else {
        await addToFavorites(property);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportLead = async () => {
    if (!user || !property.zpid) return;
    
    try {
      await exportLead(property);
    } catch (error) {
      console.error('Error exporting lead:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
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
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-2">
              {property.address}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{property.propertyType || 'Property'}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-4xl font-bold text-foreground mb-1">
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
              <div className="text-3xl font-semibold text-foreground mb-2">
                {property.bedrooms || '—'}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                Bedrooms
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-foreground mb-2">
                {property.bathrooms || '—'}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                Bathrooms
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-foreground mb-2">
                {property.sqft ? formatNumber(property.sqft) : '—'}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                Square Feet
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-foreground mb-2">
                {property.yearBuilt || '—'}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                Year Built
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <div className="px-8">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="market">Market Data</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <TabsContent value="overview" className="space-y-8">
                {/* Photos */}
                {property.images && property.images.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Photos</h3>
                    <div className="grid grid-cols-4 gap-4">
                      {property.images.slice(0, 8).map((image, index) => (
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

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-8">
                  {property.zestimate && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Zestimate</span>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatPrice(property.zestimate)}
                        </div>
                        {property.price && (
                          <div className="text-sm mt-1">
                            {property.price > property.zestimate ? (
                              <span className="text-amber-600">
                                ${formatNumber(property.price - property.zestimate)} above estimate
                              </span>
                            ) : (
                              <span className="text-green-600">
                                ${formatNumber(property.zestimate - property.price)} below estimate
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {property.daysOnMarket && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Days on Market</span>
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-semibold">
                          {property.daysOnMarket}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {property.daysOnMarket > 60 ? 'Extended listing' : 'Recent listing'}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Description */}
                {property.description && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Description</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {property.description}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analysis" className="space-y-8">
                {/* Wholesale Analysis */}
                {wholesaleMetrics && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Wholesale Analysis
                        <Badge variant={wholesaleMetrics.profitPotential === 'High' ? 'default' : 'secondary'}>
                          {wholesaleMetrics.profitPotential} Profit
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">ARV (Zestimate)</span>
                            <span className="font-semibold">{formatPrice(wholesaleMetrics.arv)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Est. Repairs (15%)</span>
                            <span className="font-semibold text-amber-600">
                              -{formatPrice(wholesaleMetrics.estimatedRepairs)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Wholesale Fee</span>
                            <span className="font-semibold text-blue-600">
                              -{formatPrice(wholesaleMetrics.wholesaleFee)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-lg">
                            <span className="font-semibold">Max Offer (70% Rule)</span>
                            <span className="font-bold text-green-600">
                              {formatPrice(wholesaleMetrics.maxOffer)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Price</span>
                            <span className="font-semibold">{formatPrice(property.price!)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Your Max Offer</span>
                            <span className="font-semibold">{formatPrice(wholesaleMetrics.maxOffer)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-lg">
                            <span className="font-semibold">Spread</span>
                            <span className={`font-bold ${wholesaleMetrics.spread < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {wholesaleMetrics.spread < 0 ? '+' : ''}
                              {formatPrice(Math.abs(wholesaleMetrics.spread))}
                            </span>
                          </div>
                          {wholesaleMetrics.spread < 0 && (
                            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                  Good wholesale opportunity!
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Lead Scoring */}
                <LeadScoringPanel 
                  leadId={property.zpid || property.id} 
                  propertyData={property}
                />
              </TabsContent>

              <TabsContent value="market" className="space-y-8">
                {/* Market Intelligence */}
                <PropertyAnalysisTabs property={property} />
              </TabsContent>

              <TabsContent value="details" className="space-y-8">
                {/* Property Details */}
                <div className="grid grid-cols-3 gap-6">
                  {property.lotSize && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground mb-1">Lot Size</div>
                        <div className="text-xl font-semibold">
                          {formatNumber(property.lotSize)} sq ft
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {property.property_estimates_rentZestimate && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground mb-1">Rent Estimate</div>
                        <div className="text-xl font-semibold">
                          {formatPrice(property.property_estimates_rentZestimate)}/mo
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {property.property_taxAssessment_taxAssessedValue && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground mb-1">Tax Assessment</div>
                        <div className="text-xl font-semibold">
                          {formatPrice(property.property_taxAssessment_taxAssessedValue)}
                        </div>
                        {property.property_taxAssessment_taxAssessmentYear && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {property.property_taxAssessment_taxAssessmentYear}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Agent Information */}
                {(property.property_propertyDisplayRules_mls_brokerName || property.property_propertyDisplayRules_agent_agentName) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Listing Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        {property.property_propertyDisplayRules_agent_agentName && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Listing Agent</div>
                            <div className="font-medium mb-2">{property.property_propertyDisplayRules_agent_agentName}</div>
                            {(property.property_listing_agentPhone || property.property_contact_phone || property.agent_phone) && (
                              <div className="flex items-center gap-2 mb-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {property.property_listing_agentPhone || property.property_contact_phone || property.agent_phone}
                                </span>
                              </div>
                            )}
                            {(property.property_listing_agentPhone || property.property_contact_phone || property.agent_phone) && (
                              <CallAgentButton 
                                agentPhone={property.property_listing_agentPhone || property.property_contact_phone || property.agent_phone}
                                agentName={property.property_propertyDisplayRules_agent_agentName}
                                propertyAddress={property.address}
                              />
                            )}
                          </div>
                        )}
                        {property.property_propertyDisplayRules_mls_brokerName && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Brokerage</div>
                            <div className="font-medium">{property.property_propertyDisplayRules_mls_brokerName}</div>
                            {property.property_brokerage_phone && (
                              <div className="flex items-center gap-2 mt-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{property.property_brokerage_phone}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-8 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFavoriteToggle}
              disabled={!user || actionLoading}
              className="flex items-center gap-2"
            >
              <Heart className={`h-4 w-4 ${property.zpid && isFavorite(property.zpid) ? 'fill-current text-red-500' : ''}`} />
              {property.zpid && isFavorite(property.zpid) ? 'Remove Favorite' : 'Add Favorite'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLead}
              disabled={!user || exportLoading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Lead
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}