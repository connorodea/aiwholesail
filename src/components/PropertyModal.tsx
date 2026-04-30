import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  User,
  Building2,
  Mail,
  BadgeCheck,
  FileText,
  Link2,
  Copy,
  CheckCircle2,
  Calculator,
  TrendingUp,
  Image,
  History,
  Home,
  Receipt,
  Loader2
} from 'lucide-react';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';
import { zillowAPI } from '@/lib/zillow-api';
import { PropertyAnalysisChat } from './PropertyAnalysisChat';
import { AIPropertyAnalyzer } from './AIPropertyAnalyzer';
import { InvestmentCalculator } from './InvestmentCalculator';
import { PriceHistoryChart } from './PriceHistoryChart';
import { ComparableSalesTable } from './ComparableSalesTable';
import { PhotosGallery } from './PhotosGallery';
import { TaxCarryingCosts } from './TaxCarryingCosts';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { AddToPipelineButton } from './pipeline/AddToPipelineButton';
import { toast } from 'sonner';

interface PropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyModal({ property, isOpen, onClose }: PropertyModalProps) {
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { exportLead } = useLeads();
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [enrichedProperty, setEnrichedProperty] = useState<Property | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Auto-fetch full property details when modal opens
  useEffect(() => {
    if (!isOpen || !property) {
      setEnrichedProperty(null);
      return;
    }

    const zpid = property.zpid || property.id;
    if (!zpid || !/^\d{5,}$/.test(String(zpid))) {
      setEnrichedProperty(property);
      return;
    }

    let cancelled = false;
    setIsLoadingDetails(true);
    setEnrichedProperty(property); // Show what we have immediately

    zillowAPI.getPropertyDetails(String(zpid))
      .then(details => {
        if (cancelled || !details) return;
        // Merge detailed data into property, preserving search data as fallback
        const merged: Property = {
          ...property,
          description: details.description || details.homeDescription || property.description,
          yearBuilt: details.yearBuilt || details.year_built || property.yearBuilt,
          lotSize: details.lotSize || details.lot_size_sqft || details.lotAreaValue || property.lotSize,
          propertyType: details.homeType || details.propertyType || details.home_type || property.propertyType,
          stories: details.stories || details.resoFacts?.stories || (property as any).stories,
          parking: details.parkingCapacity || details.garageParkingCapacity || details.resoFacts?.parkingCapacity || (property as any).parking,
          // Agent info (details endpoint often has this)
          agentName: details.attributionInfo?.agentName || details.listingAgent?.name || property.agentName,
          agentPhone: details.attributionInfo?.agentPhoneNumber || details.listingAgent?.phone || property.agentPhone,
          agentEmail: details.attributionInfo?.agentEmail || property.agentEmail,
          agentLicenseNumber: details.attributionInfo?.agentLicenseNumber || property.agentLicenseNumber,
          brokerageName: details.attributionInfo?.brokerageName || details.listingAgent?.brokerage || property.brokerageName,
          brokerPhone: details.attributionInfo?.brokerPhoneNumber || property.brokerPhone,
          mlsId: details.attributionInfo?.mlsId || details.mlsId || property.mlsId,
          mlsName: details.attributionInfo?.mlsName || property.mlsName,
          // Images
          images: details.photos || details.responsivePhotos?.map((p: any) => p.mixedSources?.jpeg?.[0]?.url || p.url).filter(Boolean) || property.images,
          // Zestimate (might be more accurate from details)
          zestimate: property.zestimate || details.zestimate,
          // Rent estimate
          rentZestimate: details.rentZestimate || details.rent_zestimate || (property as any).rentZestimate,
          // Tax info
          propertyTaxRate: details.propertyTaxRate || details.taxAnnualAmount ? (details.taxAnnualAmount / (property.price || 1) * 100).toFixed(2) : (property as any).propertyTaxRate,
          // Price per sqft
          pricePerSqft: property.pricePerSqft || (property.price && property.sqft ? property.price / property.sqft : undefined),
          // Preserve listing URL
          listingUrl: details.url || details.hdpUrl || property.listingUrl,
        };
        setEnrichedProperty(merged);
      })
      .catch(err => {
        console.warn('[PropertyModal] Failed to fetch details, using search data:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, property?.id, property?.zpid]);

  if (!property) return null;

  // Use enriched property data (falls back to search data)
  const displayProperty = enrichedProperty || property;

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`${fieldName} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

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

  const wholesalePotential = calculateWholesalePotential(displayProperty);
  const isPropertyFavorite = isFavorite(displayProperty.id || displayProperty.zpid || '');

  const handleToggleFavorite = async () => {
    const propertyId = displayProperty.id || displayProperty.zpid || '';
    try {
      if (isPropertyFavorite) {
        await removeFromFavorites(propertyId);
        toast.success('Removed from favorites');
      } else {
        await addToFavorites(displayProperty);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  const handleConvertToLead = async () => {
    try {
      await exportLead(displayProperty);
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
                  {displayProperty.status}
                </Badge>
                {displayProperty.isFSBO && (
                  <Badge variant="secondary" className="text-xs rounded-full px-3 py-1.5 bg-info/10 text-info border-info/20">FSBO</Badge>
                )}
                <Badge
                  variant={wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? 'default' : 'secondary'}
                  className="text-xs rounded-full px-3 py-1.5"
                >
                  {wholesalePotential.tier} potential
                </Badge>
                {isLoadingDetails && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading details...
                  </div>
                )}
              </div>
              <DialogTitle className="text-4xl font-bold mb-4 leading-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                {displayProperty.address}
              </DialogTitle>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">{displayProperty.propertyType || 'Property'}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold mb-2 text-foreground">
                {displayProperty.price ? formatPrice(displayProperty.price) : 'Price N/A'}
              </div>
              {displayProperty.pricePerSqft && (
                <div className="text-sm text-muted-foreground font-medium mb-4">
                  ${Math.round(displayProperty.pricePerSqft)}/sqft
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
                <AddToPipelineButton property={displayProperty} variant="full" size="sm" />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
            <div className="px-8 pt-6 pb-4 border-b border-border/30 bg-gradient-to-r from-muted/5 to-transparent overflow-x-auto">
              <TabsList className="inline-flex w-auto min-w-full bg-muted/30 rounded-xl p-1 backdrop-blur-sm gap-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="investment" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  <Calculator className="h-3 w-3" />
                  Investment
                </TabsTrigger>
                <TabsTrigger value="comps" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  <Home className="h-3 w-3" />
                  Comps
                </TabsTrigger>
                <TabsTrigger value="price-history" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  <History className="h-3 w-3" />
                  History
                </TabsTrigger>
                <TabsTrigger value="taxes" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  <Receipt className="h-3 w-3" />
                  Taxes
                </TabsTrigger>
                <TabsTrigger value="photos" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  <Image className="h-3 w-3" />
                  Photos
                </TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  Details
                </TabsTrigger>
                <TabsTrigger value="ai-analysis" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all duration-300 text-xs px-3">
                  <Brain className="h-3 w-3" />
                  AI
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
                      <div className="text-3xl font-bold text-foreground">{displayProperty.bedrooms || '—'}</div>
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
                      <div className="text-3xl font-bold text-foreground">{displayProperty.bathrooms || '—'}</div>
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
                      <div className="text-3xl font-bold text-foreground">{displayProperty.sqft ? formatNumber(displayProperty.sqft) : '—'}</div>
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
                      <div className="text-3xl font-bold text-foreground">{displayProperty.daysOnMarket || '—'}</div>
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
                        <span className="text-xl">Deal Analysis</span>
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
                          <span className="text-sm font-medium text-muted-foreground">Deal Score</span>
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
                          <span className="text-lg font-semibold">{formatPrice(displayProperty.price || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-border">
                          <span className="text-sm font-medium text-muted-foreground">Zestimate</span>
                          <span className="text-lg font-semibold">{formatPrice(displayProperty.zestimate || 0)}</span>
                        </div>
                        {wholesalePotential.tier === 'excellent' || wholesalePotential.tier === 'great' ? (
                          <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center gap-3">
                              <Star className="h-5 w-5 text-emerald-600" />
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Excellent investment opportunity!
                              </span>
                            </div>
                          </div>
                        ) : wholesalePotential.tier === 'good' ? (
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 rounded-xl border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-3">
                              <Star className="h-5 w-5 text-blue-600" />
                              <span className="font-semibold text-blue-700 dark:text-blue-300">
                                Good profit potential
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

            <TabsContent value="investment" className="flex-1 overflow-auto p-6">
              <InvestmentCalculator property={displayProperty} />
            </TabsContent>

            <TabsContent value="comps" className="flex-1 overflow-auto p-6">
              <ComparableSalesTable property={displayProperty} />
            </TabsContent>

            <TabsContent value="price-history" className="flex-1 overflow-auto p-6">
              <PriceHistoryChart property={displayProperty} />
            </TabsContent>

            <TabsContent value="taxes" className="flex-1 overflow-auto p-6">
              <TaxCarryingCosts property={displayProperty} />
            </TabsContent>

            <TabsContent value="details" className="mt-6 overflow-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                <Card className="border-border hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Square className="h-4 w-4 text-primary" />
                      </div>
                      Property Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Property Type</span>
                      <span className="font-medium">{displayProperty.propertyType || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Year Built</span>
                      <span className="font-medium">{displayProperty.yearBuilt || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Lot Size</span>
                      <span className="font-medium">{displayProperty.lotSize ? formatNumber(Number(displayProperty.lotSize)) + ' sqft' : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Stories</span>
                      <span className="font-medium">{(displayProperty as any).stories || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Parking</span>
                      <span className="font-medium">{(displayProperty as any).parking || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      Market Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="font-medium">{displayProperty.status}</Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Days on Market</span>
                      <span className="font-medium">{displayProperty.daysOnMarket || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Price per Sq Ft</span>
                      <span className="font-medium">{displayProperty.pricePerSqft ? `$${Math.round(displayProperty.pricePerSqft)}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Property Tax</span>
                      <span className="font-medium">{(displayProperty as any).propertyTaxRate ? `${(displayProperty as any).propertyTaxRate}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">MLS ID</span>
                      <span className="font-medium font-mono text-sm">{displayProperty.mlsId || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Agent & Listing Information */}
              <Card className="mt-6 border-border hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <User className="h-4 w-4 text-blue-500" />
                    </div>
                    Agent & Listing Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-8">
                    {/* Agent Info */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Listing Agent
                      </h4>
                      <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Name</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{displayProperty.agentName || 'Not available'}</span>
                            {displayProperty.agentName && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(displayProperty.agentName!, 'Agent name')}
                              >
                                {copiedField === 'Agent name' ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Phone</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {displayProperty.agentPhone ? (
                              <>
                                <a
                                  href={`tel:${displayProperty.agentPhone}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {displayProperty.agentPhone}
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(displayProperty.agentPhone!, 'Agent phone')}
                                >
                                  {copiedField === 'Agent phone' ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not available</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Email</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {displayProperty.agentEmail ? (
                              <>
                                <a
                                  href={`mailto:${displayProperty.agentEmail}`}
                                  className="font-medium text-primary hover:underline truncate max-w-[200px]"
                                >
                                  {displayProperty.agentEmail}
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(displayProperty.agentEmail!, 'Agent email')}
                                >
                                  {copiedField === 'Agent email' ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not available</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">License #</span>
                          </div>
                          <span className="font-mono text-sm">{displayProperty.agentLicenseNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Brokerage Info */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Brokerage
                      </h4>
                      <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Brokerage</span>
                          </div>
                          <span className="font-medium truncate max-w-[200px]">{displayProperty.brokerageName || displayProperty.brokerName || 'Not available'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Phone</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {displayProperty.brokerPhone ? (
                              <>
                                <a
                                  href={`tel:${displayProperty.brokerPhone}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {displayProperty.brokerPhone}
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(displayProperty.brokerPhone!, 'Broker phone')}
                                >
                                  {copiedField === 'Broker phone' ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not available</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">MLS</span>
                          </div>
                          <span className="font-medium">{displayProperty.mlsName || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Source</span>
                          </div>
                          <span className="font-medium">{displayProperty.listingSource || 'Zillow'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="mt-6 pt-4 border-t border-border/50 flex gap-3">
                    {displayProperty.agentPhone && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(`tel:${displayProperty.agentPhone}`, '_self')}
                      >
                        <Phone className="h-4 w-4" />
                        Call Agent
                      </Button>
                    )}
                    {displayProperty.agentEmail && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(`mailto:${displayProperty.agentEmail}?subject=Inquiry about ${displayProperty.address}`, '_blank')}
                      >
                        <Mail className="h-4 w-4" />
                        Email Agent
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(`https://www.zillow.com/homes/${encodeURIComponent(displayProperty.address)}_rb/`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on Zillow
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {displayProperty.description && (
                <Card className="mt-6 border-border hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {displayProperty.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="photos" className="flex-1 overflow-auto p-6">
              <PhotosGallery property={displayProperty} />
            </TabsContent>

            <TabsContent value="ai-analysis" className="flex-1 overflow-auto p-6">
              <AIPropertyAnalyzer property={displayProperty} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}