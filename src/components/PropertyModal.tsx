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
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">
                  {property.status}
                </Badge>
                {property.isFSBO && (
                  <Badge variant="secondary" className="text-xs">FSBO</Badge>
                )}
                <Badge 
                  variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {wholesalePotential.tier} potential
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-bold mb-2">
                {property.address}
              </DialogTitle>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{property.propertyType || 'Property'}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold mb-1">
                {property.price ? formatPrice(property.price) : 'Price N/A'}
              </div>
              {property.pricePerSqft && (
                <div className="text-sm text-muted-foreground">
                  ${Math.round(property.pricePerSqft)}/sqft
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFavorite}
                  className="gap-1"
                >
                  <Heart className={`h-4 w-4 ${isPropertyFavorite ? 'fill-current text-red-500' : ''}`} />
                  {isPropertyFavorite ? 'Saved' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConvertToLead}
                  className="gap-1"
                >
                  <Phone className="h-4 w-4" />
                  Convert to Lead
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="ai-analysis" className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                AI Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              {/* Key Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Bedrooms</span>
                    </div>
                    <div className="text-2xl font-bold">{property.bedrooms || '—'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Bathrooms</span>
                    </div>
                    <div className="text-2xl font-bold">{property.bathrooms || '—'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Square className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Square Feet</span>
                    </div>
                    <div className="text-2xl font-bold">{property.sqft ? formatNumber(property.sqft) : '—'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Days on Market</span>
                    </div>
                    <div className="text-2xl font-bold">{property.daysOnMarket || '—'}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Wholesale Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Wholesale Analysis
                    <Badge variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}>
                      {wholesalePotential.tier} deal
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
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

                    <div className="space-y-4">
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

            <TabsContent value="ai-analysis" className="mt-6">
              <PropertyAnalysisChat property={property} isOpen={isOpen} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}