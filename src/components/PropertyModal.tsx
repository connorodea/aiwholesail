import React, { useState } from 'react';
import { Property } from '@/types/zillow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  DollarSign, 
  Star, 
  X, 
  Bed, 
  Bath, 
  Square, 
  Calendar,
  Brain,
  Heart,
  Phone,
  ExternalLink
} from 'lucide-react';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';
import { PropertyAnalysisChat } from './PropertyAnalysisChat';
import { AIPropertyAnalyzer } from './AIPropertyAnalyzer';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface PropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyModal({ property, isOpen, onClose }: PropertyModalProps) {
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { exportLead } = useLeads();
  
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
  const isPropertyFavorite = isFavorite(property.id || property.zpid || '');

  const handleToggleFavorite = async () => {
    const propertyId = property.id || property.zpid || '';
    try {
      if (isPropertyFavorite) {
        await removeFromFavorites(propertyId);
        toast.success('Removed from favorites');
      } else {
        await addToFavorites(property);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  const handleConvertToLead = async () => {
    try {
      await exportLead(property);
      toast.success('Property converted to lead!');
    } catch (error) {
      toast.error('Failed to convert to lead');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0 bg-gradient-to-br from-background via-background to-muted/5 border-2 border-border/50 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-8 pb-6 border-b border-border/30 bg-gradient-to-r from-background via-muted/5 to-background backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-3 mb-6">
                <Badge variant="outline" className="text-xs font-medium border-border/50 bg-muted/30 rounded-full px-3 py-1.5">
                  {property.status}
                </Badge>
                {property.isFSBO && (
                  <Badge variant="secondary" className="text-xs rounded-full px-3 py-1.5 bg-info/10 text-info border-info/20">FSBO</Badge>
                )}
                <Badge 
                  variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}
                  className="text-xs rounded-full px-3 py-1.5"
                >
                  {wholesalePotential.tier} potential
                </Badge>
              </div>
              <DialogTitle className="text-4xl font-bold mb-4 leading-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                {property.address}
              </DialogTitle>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">{property.propertyType || 'Property'}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold mb-2 text-foreground">
                {property.price ? formatPrice(property.price) : 'Price N/A'}
              </div>
              {property.pricePerSqft && (
                <div className="text-sm text-muted-foreground font-medium mb-4">
                  ${Math.round(property.pricePerSqft)}/sqft
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFavorite}
                  className="gap-2 hover:bg-muted rounded-xl border-border/50 transition-all duration-300 hover:shadow-md"
                >
                  <Heart className={`h-4 w-4 ${isPropertyFavorite ? 'fill-current text-red-500' : ''}`} />
                  {isPropertyFavorite ? 'Saved' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConvertToLead}
                  className="gap-2 hover:bg-muted rounded-xl border-border/50 transition-all duration-300 hover:shadow-md"
                >
                  <Phone className="h-4 w-4" />
                  Convert to Lead
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
            <div className="px-8 pt-6 pb-4 border-b border-border/30 bg-gradient-to-r from-muted/5 to-transparent">
              <TabsList className="grid w-full grid-cols-4 bg-muted/30 rounded-xl p-1 backdrop-blur-sm">
                <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300">
                  Details
                </TabsTrigger>
                <TabsTrigger value="photos" className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300">
                  Photos
                </TabsTrigger>
                <TabsTrigger value="ai-analysis" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300">
                  <Brain className="h-3 w-3" />
                  AI Analysis
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 overflow-auto">
              <div className="p-6 space-y-8">
                {/* Key Stats */}
                <div className="grid grid-cols-4 gap-6">
                  <Card className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Bed className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Bedrooms</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{property.bedrooms || '—'}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Bath className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Bathrooms</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{property.bathrooms || '—'}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Square className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Square Feet</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{property.sqft ? formatNumber(property.sqft) : '—'}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Days on Market</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{property.daysOnMarket || '—'}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Wholesale Analysis */}
                <Card className="border-border shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xl">Wholesale Analysis</span>
                        <Badge 
                          variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}
                          className="ml-3"
                        >
                          {wholesalePotential.tier} deal
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center py-3 border-b border-border">
                          <span className="text-sm font-medium text-muted-foreground">Wholesale Score</span>
                          <span className="text-2xl font-bold text-foreground">{wholesalePotential.score}/100</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-border">
                          <span className="text-sm font-medium text-muted-foreground">Spread Amount</span>
                          <span className="text-2xl font-bold text-emerald-600">
                            ${formatNumber(wholesalePotential.spreadAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                          <span className="text-sm font-medium text-muted-foreground">Spread Percentage</span>
                          <span className="text-2xl font-bold text-foreground">
                            {wholesalePotential.spreadPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex justify-between items-center py-3 border-b border-border">
                          <span className="text-sm font-medium text-muted-foreground">Current Price</span>
                          <span className="text-lg font-semibold">{formatPrice(property.price || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-border">
                          <span className="text-sm font-medium text-muted-foreground">Zestimate</span>
                          <span className="text-lg font-semibold">{formatPrice(property.zestimate || 0)}</span>
                        </div>
                        {wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? (
                          <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center gap-3">
                              <Star className="h-5 w-5 text-emerald-600" />
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Excellent wholesale opportunity!
                              </span>
                            </div>
                          </div>
                        ) : wholesalePotential.tier === 'good' ? (
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 rounded-xl border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-3">
                              <Star className="h-5 w-5 text-blue-600" />
                              <span className="font-semibold text-blue-700 dark:text-blue-300">
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
            </TabsContent>

            <TabsContent value="details" className="mt-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Property Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property Type</span>
                      <span>{property.propertyType || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Year Built</span>
                      <span>{property.yearBuilt || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lot Size</span>
                      <span>{property.lotSize || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stories</span>
                      <span>{property.stories || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parking</span>
                      <span>{property.parking || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Market Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span>{property.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Days on Market</span>
                      <span>{property.daysOnMarket || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price per Sq Ft</span>
                      <span>{property.pricePerSqft ? `$${Math.round(property.pricePerSqft)}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property Tax</span>
                      <span>{property.propertyTaxRate ? `${property.propertyTaxRate}%` : 'N/A'}</span>
                    </div>
                    {property.listingAgent && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Listing Agent</span>
                        <span>{property.listingAgent}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {property.description && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {property.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="photos" className="mt-6">
              {property.images && property.images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {property.images.map((image, index) => (
                    <div key={index} className="aspect-video relative">
                      <img 
                        src={image} 
                        alt={`Property ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-muted-foreground">
                      No photos available for this property
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ai-analysis" className="flex-1 overflow-auto p-6">
              <AIPropertyAnalyzer property={property} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}