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
  Sparkles,
  Crown,
  Link2,
  Copy,
  CheckCircle2,
  Calculator,
  TrendingUp,
  Image,
  History,
  Home,
  Receipt,
  Loader2,
  Zap
} from 'lucide-react';
import { calculateWholesalePotential } from '@/lib/wholesale-calculator';
import { zillowAPI } from '@/lib/zillow-api';
import { PropertyAnalysisChat } from './PropertyAnalysisChat';
import { AIPropertyAnalyzer } from './AIPropertyAnalyzer';
import { InvestmentCalculator } from './InvestmentCalculator';
import { PriceHistoryChart } from './PriceHistoryChart';
import { ComparableSalesTable } from './ComparableSalesTable';
import { AIRankedComps } from './AIRankedComps';
import { PhotosGallery } from './PhotosGallery';
import { TaxCarryingCosts } from './TaxCarryingCosts';
import { ARVCalculator } from './ARVCalculator';
import { PropertyToolsTab } from './PropertyToolsTab';
import { AIPhotoAnalysis } from './AIPhotoAnalysis';
import { generateDealReport } from './DealReportPDF';
import { generateBuyerPitch } from './BuyerPitchPDF';
import { ListingDescriptionGenerator } from './ListingDescriptionGenerator';
import { FullArvAnalysis } from './FullArvAnalysis';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { analytics } from '@/lib/analytics';
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
  const { isElite, isPro } = useSubscription();
  const allowedForProFeatures = isElite || isPro;
  const { user } = useAuth();

  const handleBuyerPitch = () => {
    if (!allowedForProFeatures) {
      toast.error('Buyer Pitch PDF is a Pro / Elite feature. Upgrade to unlock.');
      return;
    }
    generateBuyerPitch(displayProperty, {
      wholesalerName: user?.fullName || user?.email?.split('@')[0],
      wholesalerEmail: user?.email,
    });
    analytics.dataExport?.('buyer-pitch-pdf', 1);
  };
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [enrichedProperty, setEnrichedProperty] = useState<Property | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [listingCopyOpen, setListingCopyOpen] = useState(false);
  const [fullArvOpen, setFullArvOpen] = useState(false);

  const handleListingCopy = () => {
    if (!allowedForProFeatures) {
      toast.error('AI Listing Copy is a Pro / Elite feature. Upgrade to unlock.');
      return;
    }
    setListingCopyOpen(true);
  };

  const handleFullArv = () => {
    if (!allowedForProFeatures) {
      toast.error('Full ARV Analysis is a Pro / Elite feature. Upgrade to unlock.');
      return;
    }
    setFullArvOpen(true);
  };

  // Fire ViewContent for FB/GA when a property modal opens
  useEffect(() => {
    if (isOpen && property?.id) {
      analytics.viewProperty(
        String(property.id),
        property.address || 'Unknown',
        property.price || undefined,
      );
    }
  }, [isOpen, property?.id, property?.address, property?.price]);

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

  // Humanize backend enum-style strings ("FOR_SALE" → "For Sale", "single_family" → "Single Family")
  const humanize = (raw?: string | null) => {
    if (!raw) return '';
    return raw
      .toString()
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();
  };

  const wholesalePotential = calculateWholesalePotential(displayProperty);
  const propertyImage =
    (displayProperty as any).imageUrl ||
    (displayProperty as any).image_url ||
    (displayProperty as any).imgSrc ||
    (displayProperty as any).hiResImageLink ||
    null;

  // Tier-driven theming (drives ring, badge, callout, spread color)
  const TIER_THEME: Record<string, { label: string; ring: string; ringBg: string; text: string; bg: string; border: string; chip: string; ctaLabel: string }> = {
    excellent: { label: 'Excellent Deal', ring: '#10b981', ringBg: 'rgba(16,185,129,0.10)', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', chip: 'bg-emerald-500 text-black', ctaLabel: 'Top-tier opportunity — strong margin, move fast' },
    great:     { label: 'Great Deal',     ring: '#10b981', ringBg: 'rgba(16,185,129,0.10)', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', chip: 'bg-emerald-500 text-black', ctaLabel: 'Strong margin — well below market' },
    good:      { label: 'Good Deal',      ring: '#06b6d4', ringBg: 'rgba(6,182,212,0.10)',  text: 'text-cyan-400',     bg: 'bg-cyan-500/10',     border: 'border-cyan-500/30',     chip: 'bg-cyan-500 text-black',    ctaLabel: 'Solid spread — worth a closer look' },
    fair:      { label: 'Fair Deal',      ring: '#f59e0b', ringBg: 'rgba(245,158,11,0.10)', text: 'text-amber-400',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    chip: 'bg-amber-500 text-black',   ctaLabel: 'Modest margin — verify comps before pursuing' },
    poor:      { label: 'Weak Deal',      ring: '#737373', ringBg: 'rgba(115,115,115,0.10)',text: 'text-neutral-400',  bg: 'bg-neutral-500/10',  border: 'border-neutral-500/30',  chip: 'bg-neutral-700 text-white', ctaLabel: 'Limited spread — likely not a wholesale fit' },
  };
  const tierTheme = TIER_THEME[wholesalePotential.tier] || TIER_THEME.poor;
  const scorePct = Math.max(0, Math.min(100, wholesalePotential.score));
  // Conic-gradient for the deal-score ring (CSS-only, no extra deps)
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(${tierTheme.ring} ${scorePct * 3.6}deg, rgba(255,255,255,0.06) ${scorePct * 3.6}deg)`,
  };
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
      <DialogContent className="w-full max-w-7xl h-[100dvh] sm:h-auto sm:max-h-[95vh] overflow-hidden p-0 bg-gradient-to-br from-background via-background to-muted/5 border-0 sm:border-2 border-border/50 shadow-2xl rounded-none sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="relative p-4 sm:p-5 lg:p-6 pb-3 sm:pb-4 border-b border-border/30 backdrop-blur-sm overflow-hidden flex-shrink-0">
          {/* Optional hero image with darkening gradient */}
          {propertyImage && (
            <>
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
                style={{ backgroundImage: `url(${propertyImage})` }}
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/20 to-background/95" />
            </>
          )}
          {!propertyImage && (
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-muted/5 to-background" />
          )}

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
            <div className="flex-1 lg:pr-4 min-w-0">
              {/* Single-line badge row */}
              <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-medium border-border/50 bg-muted/30 rounded-full px-2.5 py-0.5">
                  {humanize(displayProperty.status) || 'For Sale'}
                </Badge>
                {displayProperty.isFSBO && (
                  <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 py-0.5 bg-info/10 text-info border-info/20">FSBO</Badge>
                )}
                <Badge className={`text-[10px] rounded-full px-2.5 py-0.5 border-0 font-semibold ${tierTheme.chip}`}>
                  {tierTheme.label}
                </Badge>
                {displayProperty.propertyType && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {humanize(displayProperty.propertyType)}
                  </span>
                )}
                {isLoadingDetails && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>

              {/* Address — single line, truncated, with title attr for full text */}
              <DialogTitle
                title={displayProperty.address}
                className="text-base sm:text-lg lg:text-2xl font-bold leading-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text pr-8 lg:pr-0 truncate"
              >
                {displayProperty.address}
              </DialogTitle>

              {/* Mobile-only inline price */}
              <div className="mt-2 lg:hidden flex items-baseline gap-2">
                <div className="text-xl sm:text-2xl font-bold text-foreground">
                  {displayProperty.price ? formatPrice(displayProperty.price) : 'Price N/A'}
                </div>
                {displayProperty.pricePerSqft && (
                  <div className="text-xs text-muted-foreground font-medium">
                    ${Math.round(displayProperty.pricePerSqft)}/sqft
                  </div>
                )}
                {/* mobile property type — only shows here when sm hidden */}
                {displayProperty.propertyType && (
                  <span className="sm:hidden text-[11px] text-muted-foreground ml-auto">
                    {humanize(displayProperty.propertyType)}
                  </span>
                )}
              </div>
            </div>

            {/* Desktop right cluster — price + actions inline */}
            <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
              <div className="text-right border-r border-border/40 pr-4">
                <div className="text-2xl xl:text-3xl font-bold text-foreground leading-none">
                  {displayProperty.price ? formatPrice(displayProperty.price) : 'Price N/A'}
                </div>
                {displayProperty.pricePerSqft && (
                  <div className="text-xs text-muted-foreground font-medium mt-1">
                    ${Math.round(displayProperty.pricePerSqft)}/sqft
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                {/* Headline CTA — Phase 1.4 "Run Full ARV Analysis" bundle.
                    The ChatARV-parity marketing demo: one click → AI comps,
                    deal math, listing copy in 60 seconds. */}
                <Button
                  size="sm"
                  onClick={handleFullArv}
                  className="gap-1.5 h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-[0_0_18px_rgba(6,182,212,0.25)]"
                >
                  <Zap className="h-4 w-4" />
                  {/* hidden xl:inline matches sibling buttons so the row doesn't overflow at lg width */}
                  <span className="hidden xl:inline">Full ARV Analysis</span>
                  <span className="xl:hidden">Full ARV</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleToggleFavorite} className="gap-1.5 h-9 rounded-lg border-border/50">
                  <Heart className={`h-4 w-4 ${isPropertyFavorite ? 'fill-current text-red-500' : ''}`} />
                  <span className="hidden xl:inline">{isPropertyFavorite ? 'Saved' : 'Save'}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleConvertToLead} className="gap-1.5 h-9 rounded-lg border-border/50">
                  <Phone className="h-4 w-4" />
                  <span className="hidden xl:inline">Lead</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => generateDealReport(displayProperty)} className="gap-1.5 h-9 rounded-lg border-border/50">
                  <FileText className="h-4 w-4" />
                  <span className="hidden xl:inline">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBuyerPitch}
                  title={allowedForProFeatures ? 'Generate buyer-ready deal sheet' : 'Pro / Elite feature — upgrade to unlock'}
                  className={`gap-1.5 h-9 rounded-lg border-cyan-500/40 ${allowedForProFeatures ? 'text-cyan-400 hover:bg-cyan-500/10' : 'text-neutral-500'}`}
                >
                  {allowedForProFeatures ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                  <span className="hidden xl:inline">Buyer Pitch</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleListingCopy}
                  title={allowedForProFeatures ? 'Generate AI listing copy for marketing' : 'Pro / Elite feature — upgrade to unlock'}
                  className={`gap-1.5 h-9 rounded-lg border-cyan-500/40 ${allowedForProFeatures ? 'text-cyan-400 hover:bg-cyan-500/10' : 'text-neutral-500'}`}
                >
                  {allowedForProFeatures ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                  <span className="hidden xl:inline">Listing Copy</span>
                </Button>
                <AddToPipelineButton property={displayProperty} variant="full" size="sm" />
              </div>
            </div>

            {/* Mobile action row — horizontally scrollable */}
            <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-none">
              <div className="flex gap-2 min-w-max pb-1">
                {/* Headline CTA — same Phase 1.4 button as desktop, leading the mobile row */}
                <Button
                  size="sm"
                  onClick={handleFullArv}
                  className="gap-1.5 h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex-shrink-0 shadow-[0_0_18px_rgba(6,182,212,0.25)]"
                >
                  <Zap className="h-4 w-4" />
                  Full ARV
                </Button>
                <Button variant="outline" size="sm" onClick={handleToggleFavorite} className="gap-1.5 h-9 rounded-lg border-border/50 flex-shrink-0">
                  <Heart className={`h-4 w-4 ${isPropertyFavorite ? 'fill-current text-red-500' : ''}`} />
                  {isPropertyFavorite ? 'Saved' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleConvertToLead} className="gap-1.5 h-9 rounded-lg border-border/50 flex-shrink-0">
                  <Phone className="h-4 w-4" />
                  Lead
                </Button>
                <Button variant="outline" size="sm" onClick={() => generateDealReport(displayProperty)} className="gap-1.5 h-9 rounded-lg border-border/50 flex-shrink-0">
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBuyerPitch}
                  className={`gap-1.5 h-9 rounded-lg border-cyan-500/40 flex-shrink-0 ${allowedForProFeatures ? 'text-cyan-400' : 'text-neutral-500'}`}
                >
                  {allowedForProFeatures ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                  Buyer Pitch
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleListingCopy}
                  className={`gap-1.5 h-9 rounded-lg border-cyan-500/40 flex-shrink-0 ${allowedForProFeatures ? 'text-cyan-400' : 'text-neutral-500'}`}
                >
                  {allowedForProFeatures ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                  Listing Copy
                </Button>
                <AddToPipelineButton property={displayProperty} variant="full" size="sm" />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
            <div className="px-3 sm:px-8 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b border-border/30 bg-gradient-to-r from-muted/5 to-transparent overflow-x-auto scrollbar-none">
              <TabsList className="inline-flex w-auto min-w-full bg-muted/30 rounded-xl p-1 backdrop-blur-sm gap-1">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Home className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="investment" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Calculator className="h-3.5 w-3.5" />
                  Investment
                </TabsTrigger>
                <TabsTrigger value="arv" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <TrendingUp className="h-3.5 w-3.5" />
                  ARV
                </TabsTrigger>
                <TabsTrigger value="comps" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Comps
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Calculator className="h-3.5 w-3.5" />
                  Tools
                </TabsTrigger>
                <TabsTrigger value="price-history" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <History className="h-3.5 w-3.5" />
                  History
                </TabsTrigger>
                <TabsTrigger value="taxes" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Receipt className="h-3.5 w-3.5" />
                  Taxes
                </TabsTrigger>
                <TabsTrigger value="photos" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Image className="h-3.5 w-3.5" />
                  Photos
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <FileText className="h-3.5 w-3.5" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="photo-analysis" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Image className="h-3.5 w-3.5" />
                  AI Vision
                </TabsTrigger>
                <TabsTrigger value="ai-analysis" className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-cyan-400 data-[state=active]:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_2px_8px_rgba(0,0,0,0.4)] rounded-lg transition-all duration-200 text-xs font-medium px-3 h-8">
                  <Brain className="h-3.5 w-3.5" />
                  AI
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 overflow-auto mt-0">
              <div className="p-3 sm:p-6 space-y-5 sm:space-y-8">
                {/* Key Stats */}
                {/* Compact key stats — uniform grid, missing values muted */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
                  {([
                    { label: 'Beds',   value: displayProperty.bedrooms ?? null,                     icon: Bed },
                    { label: 'Baths',  value: displayProperty.bathrooms ?? null,                    icon: Bath },
                    { label: 'Sq Ft',  value: displayProperty.sqft ? formatNumber(displayProperty.sqft) : null, icon: Square },
                    { label: '$/sqft', value: displayProperty.pricePerSqft ? `$${Math.round(displayProperty.pricePerSqft)}` : null, icon: TrendingUp },
                    { label: 'Days',   value: displayProperty.daysOnMarket ?? null,                  icon: Calendar },
                  ] as const).map((stat) => {
                    const Icon = stat.icon;
                    const isEmpty = stat.value == null;
                    return (
                      <div key={stat.label} className="rounded-xl border border-border/60 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3 sm:p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Icon className="h-3.5 w-3.5 text-cyan-400/80" />
                          <span className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                        </div>
                        <div className={`text-xl sm:text-2xl font-bold tracking-tight ${isEmpty ? 'text-neutral-700' : 'text-foreground'}`}>
                          {isEmpty ? '—' : stat.value}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Deal Analysis — visual hero card */}
                {(() => {
                  const price = displayProperty.price || 0;
                  const zest = displayProperty.zestimate || 0;
                  const spread = wholesalePotential.spreadAmount;
                  const spreadPos = spread >= 0;
                  // Bar widths: render Current Price vs. Zestimate proportionally
                  const maxVal = Math.max(price, zest, 1);
                  const priceWidth = (price / maxVal) * 100;
                  const zestWidth = (zest / maxVal) * 100;
                  return (
                    <div className={`rounded-2xl border ${tierTheme.border} ${tierTheme.bg} backdrop-blur-sm overflow-hidden`}>
                      {/* Top: tier banner */}
                      <div className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b ${tierTheme.border}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${tierTheme.bg} ${tierTheme.text} flex items-center justify-center border ${tierTheme.border}`}>
                            <DollarSign className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm sm:text-base font-semibold text-foreground leading-tight">Deal Analysis</div>
                            <div className={`text-[11px] sm:text-xs font-medium ${tierTheme.text}`}>{tierTheme.label}</div>
                          </div>
                        </div>
                        <div className="hidden sm:block text-xs text-muted-foreground italic max-w-[60%] text-right">
                          {tierTheme.ctaLabel}
                        </div>
                      </div>

                      {/* Body: ring + spread + bars */}
                      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 sm:gap-8 items-center">
                        {/* Deal score ring */}
                        <div className="flex justify-center md:justify-start">
                          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center" style={ringStyle}>
                            <div className="absolute inset-1.5 rounded-full bg-[#0c0d0f] flex flex-col items-center justify-center">
                              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${tierTheme.text}`}>
                                {wholesalePotential.score}
                              </span>
                              <span className="text-[10px] uppercase tracking-widest text-neutral-500 mt-0.5">/100 score</span>
                            </div>
                          </div>
                        </div>

                        {/* Spread + comparison bars */}
                        <div className="space-y-4 min-w-0">
                          {/* Spread headline */}
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <div>
                              <div className="text-[11px] sm:text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                                {spreadPos ? 'Below market by' : 'Above market by'}
                              </div>
                              <div className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${tierTheme.text}`}>
                                {spreadPos ? '+' : '−'}{formatPrice(Math.abs(spread))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] sm:text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">% Spread</div>
                              <div className={`text-xl sm:text-2xl font-bold ${tierTheme.text}`}>
                                {spreadPos ? '+' : ''}{wholesalePotential.spreadPercentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* Comparison bars */}
                          <div className="space-y-2.5 pt-1">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Current Price</span>
                                <span className="font-semibold text-foreground">{formatPrice(price)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-700" style={{ width: `${priceWidth}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Zestimate</span>
                                <span className="font-semibold text-foreground">{formatPrice(zest)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${spreadPos ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`} style={{ width: `${zestWidth}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mobile-only CTA label */}
                      <div className={`sm:hidden border-t ${tierTheme.border} px-4 py-3 text-xs ${tierTheme.text} bg-black/20`}>
                        {tierTheme.ctaLabel}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="investment" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <InvestmentCalculator property={displayProperty} />
            </TabsContent>

            <TabsContent value="arv" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <ARVCalculator property={displayProperty} />
            </TabsContent>

            <TabsContent value="comps" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <AIRankedComps property={displayProperty} />
            </TabsContent>

            <TabsContent value="tools" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <PropertyToolsTab property={displayProperty} />
            </TabsContent>

            <TabsContent value="price-history" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <PriceHistoryChart property={displayProperty} />
            </TabsContent>

            <TabsContent value="taxes" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <TaxCarryingCosts property={displayProperty} />
            </TabsContent>

            <TabsContent value="details" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
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

            <TabsContent value="photos" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <PhotosGallery property={displayProperty} />
            </TabsContent>

            <TabsContent value="photo-analysis" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <AIPhotoAnalysis property={displayProperty} />
            </TabsContent>

            <TabsContent value="ai-analysis" className="flex-1 overflow-auto p-3 sm:p-6 mt-0">
              <AIPropertyAnalyzer property={displayProperty} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
      {/* AI Listing Copy generator — sibling Dialog */}
      <ListingDescriptionGenerator
        property={displayProperty}
        open={listingCopyOpen}
        onOpenChange={setListingCopyOpen}
      />
      {/* Full ARV Analysis bundle — Phase 1.4. Sibling Dialog. */}
      <FullArvAnalysis
        property={displayProperty}
        open={fullArvOpen}
        onOpenChange={setFullArvOpen}
      />
    </Dialog>
  );
}