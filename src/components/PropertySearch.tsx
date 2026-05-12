import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PropertySearchParams } from '@/types/zillow';
import { Search, Home, Bed, Bath, DollarSign, TrendingDown, MessageSquare, Gavel, Building2, AlertTriangle, Flame, Sparkles, Lock, Radius } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LocationAutocomplete } from './LocationAutocomplete';
import { CountyBrowserDialog } from './CountyBrowserDialog';
import { validatePriceRange, sanitizeSearchKeywords, validateLocationInput } from '@/lib/security';
import { isMultiLocationSearchEnabled, isMainSearchLayoutV2Enabled } from '@/lib/feature-flags';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface PropertySearchProps {
  onSearch: (params: PropertySearchParams) => void;
  isLoading: boolean;
}

export function PropertySearch({ onSearch, isLoading }: PropertySearchProps) {
  const [searchParams, setSearchParams] = useState<PropertySearchParams>({
    location: '',
    homeType: 'Houses, Townhomes, Multi-family, Condos/Co-ops',
    wholesaleOnly: true // Default: only show properties priced below Zestimate
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const [countyBrowserOpen, setCountyBrowserOpen] = useState(false);
  const { isElite, isPro } = useSubscription();
  const allowedForProFeatures = isElite || isPro;
  const multiLocationEnabled = isMultiLocationSearchEnabled(user?.email);
  const layoutV2Enabled = isMainSearchLayoutV2Enabled(user?.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate and sanitize inputs
    const sanitizedLocation = validateLocationInput(searchParams.location);
    if (!sanitizedLocation.trim()) {
      toast({
        title: "Invalid Location",
        description: "Please enter a valid location to search.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate price range
    const priceValidation = validatePriceRange(searchParams.price_min, searchParams.price_max);
    if (priceValidation.error) {
      toast({
        title: "Invalid Price Range",
        description: priceValidation.error,
        variant: "destructive"
      });
      return;
    }
    
    // Sanitize keywords
    const sanitizedKeywords = searchParams.keywords ? sanitizeSearchKeywords(searchParams.keywords) : undefined;
    
    // Create sanitized search params
    const sanitizedParams = {
      ...searchParams,
      location: sanitizedLocation,
      keywords: sanitizedKeywords,
      price_min: priceValidation.min?.toString(),
      price_max: priceValidation.max?.toString()
    };
    
    onSearch(sanitizedParams);
  };

  const updateParam = (key: keyof PropertySearchParams, value: string | boolean) => {
    setSearchParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="simple-card">
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl text-foreground">
          <Search className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Property Search
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {layoutV2Enabled ? (
              /* v2 layout: Location + radius side-by-side, tightened copy.
                 Gated on isMainSearchLayoutV2Enabled (dogfood: cpodea5). */
              <div className="sm:col-span-2">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start">
                  <div className="flex-1 min-w-0">
                    <LocationAutocomplete
                      value={searchParams.location}
                      onChange={(value) => updateParam('location', value)}
                      required={true}
                    />
                  </div>
                  {multiLocationEnabled && (
                    <div className="space-y-2 sm:w-40 sm:shrink-0">
                      <Label htmlFor="radius-mi" className="flex items-center gap-2">
                        <Radius className="h-4 w-4 text-primary" />
                        Within (mi)
                      </Label>
                      <Input
                        id="radius-mi"
                        type="number"
                        min={1}
                        max={100}
                        placeholder="e.g. 10"
                        value={searchParams.radiusMi ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSearchParams((prev) => ({
                            ...prev,
                            radiusMi: v === '' ? undefined : Number(v),
                          }));
                        }}
                        className="bg-background/50"
                      />
                      <p className="text-xs text-muted-foreground">Single ZIP or address</p>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {multiLocationEnabled && (
                    <span className="text-muted-foreground">
                      Tip: paste multiple ZIPs (<span className="font-mono">33101, 33102, 33125</span>) to search several at once.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCountyBrowserOpen(true)}
                    className="inline-flex items-center gap-1.5 font-medium text-cyan-400 hover:text-cyan-300 hover:underline underline-offset-4 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Don&rsquo;t know the county? Browse counties by state →
                  </button>
                </div>
              </div>
            ) : (
              /* v1 layout (default): Location full-width, radius stacked below. */
              <>
                <div className="sm:col-span-2">
                  <LocationAutocomplete
                    value={searchParams.location}
                    onChange={(value) => updateParam('location', value)}
                    required={true}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {multiLocationEnabled && (
                      <span className="text-muted-foreground">
                        Tip: paste multiple ZIPs (<span className="font-mono">33101, 33102, 33125</span>) to search several at once.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCountyBrowserOpen(true)}
                      className="inline-flex items-center gap-1.5 font-medium text-cyan-400 hover:text-cyan-300 hover:underline underline-offset-4 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Don&rsquo;t know the county? Browse counties by state →
                    </button>
                  </div>
                </div>

                {multiLocationEnabled && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="radius-mi" className="flex items-center gap-2">
                      <Radius className="h-4 w-4 text-primary" />
                      Search radius (mi) <span className="text-xs text-muted-foreground font-normal">— optional, single ZIP/address only</span>
                    </Label>
                    <Input
                      id="radius-mi"
                      type="number"
                      min={1}
                      max={100}
                      placeholder="e.g. 10"
                      value={searchParams.radiusMi ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchParams((prev) => ({
                          ...prev,
                          radiusMi: v === '' ? undefined : Number(v),
                        }));
                      }}
                      className="bg-background/50 max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expands a single ZIP or address into every ZIP within X miles, then searches each one.
                    </p>
                  </div>
                )}
              </>
            )}

            <CountyBrowserDialog
              open={countyBrowserOpen}
              onOpenChange={setCountyBrowserOpen}
              onSelectCounty={(loc) => updateParam('location', loc)}
            />

            {/* Property Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                Property Type
              </Label>
              <Select value={searchParams.homeType} onValueChange={(value) => updateParam('homeType', value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Houses">Houses Only</SelectItem>
                  <SelectItem value="Condos/Co-ops, Apartments">Condos/Apartments Only</SelectItem>
                  <SelectItem value="Houses, Townhomes, Multi-family, Condos/Co-ops">All Types</SelectItem>
                  <SelectItem value="Townhomes">Townhomes</SelectItem>
                  <SelectItem value="Multi-family">Multi-family</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bedrooms Min */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Bed className="h-4 w-4 text-primary" />
                Min Bedrooms
              </Label>
              <Select value={searchParams.bed_min || 'any'} onValueChange={(value) => updateParam('bed_min', value === 'any' ? undefined : value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="5">5+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bathrooms */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Bath className="h-4 w-4 text-primary" />
                Min Bathrooms
              </Label>
              <Select value={searchParams.bathrooms || 'any'} onValueChange={(value) => updateParam('bathrooms', value === 'any' ? undefined : value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="1.5">1.5+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="2.5">2.5+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Min Price
              </Label>
              <Input
                value={searchParams.price_min || ''}
                onChange={(e) => updateParam('price_min', e.target.value || undefined)}
                placeholder="e.g., 100000"
                type="number"
                min="0"
                max="50000000"
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Max Price
              </Label>
              <Input
                value={searchParams.price_max || ''}
                onChange={(e) => updateParam('price_max', e.target.value || undefined)}
                placeholder="e.g., 500000"
                type="number"
                min="0"
                max="50000000"
                className="bg-background/50"
              />
            </div>

          </div>

          {/* Filters */}
          <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">

            {/* Auction Filter */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <Gavel className="h-4 w-4 text-primary" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="auction-toggle" className="text-sm font-medium">
                    Hide Auction Properties
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Filter out auction properties from search results
                  </span>
                </div>
              </div>
              <Switch
                id="auction-toggle"
                checked={searchParams.auctionOnly || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, auctionOnly: checked }))}
              />
            </div>

            {/* Foreclosure Filter */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="foreclosure-toggle" className="text-sm font-medium">
                    Hide Foreclosure Properties
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Filter out foreclosure properties from search results
                  </span>
                </div>
              </div>
              <Switch
                id="foreclosure-toggle"
                checked={searchParams.hideForeclosures || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, hideForeclosures: checked }))}
              />
            </div>

            {/* Wholesale Deals Only Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-success" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="wholesale-toggle" className="text-sm font-medium">
                    Most Profitable Only
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Only show properties priced below their Zestimate
                  </span>
                </div>
              </div>
              <Switch
                id="wholesale-toggle"
                checked={searchParams.wholesaleOnly || false}
                onCheckedChange={(checked) => updateParam('wholesaleOnly', checked)}
              />
            </div>

            {/* FSBO Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-primary" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="fsbo-toggle" className="text-sm font-medium">
                    FSBO Properties Only
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Show only For Sale By Owner properties
                  </span>
                </div>
              </div>
              <Switch
                id="fsbo-toggle"
                checked={searchParams.fsboOnly || false}
                onCheckedChange={(checked) => updateParam('fsboOnly', checked)}
              />
            </div>

            {/* Motivated Sellers Toggle — Pro / Elite (pure client-side scoring, no API cost) */}
            <div className={`flex items-center justify-between space-x-2 rounded-lg border p-3 transition-colors ${
              searchParams.motivatedSellersOnly
                ? 'border-cyan-500/40 bg-cyan-500/[0.04]'
                : 'border-border/60'
            }`}>
              <div className="flex items-center space-x-2 min-w-0">
                <Flame className="h-4 w-4 text-cyan-400 shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
                  <Label htmlFor="motivated-toggle" className="text-sm font-medium flex items-center gap-1.5">
                    Motivated Sellers Only
                    <Badge variant="secondary" className="text-[9px] gap-0.5 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                      <Sparkles className="h-2 w-2" /> Pro / Elite
                    </Badge>
                    {!allowedForProFeatures && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {allowedForProFeatures
                      ? 'FSBO + days-on-market + price cuts + Make Me Move signals'
                      : <>Combine off-market signals into one filtered view. <Link to="/pricing" className="text-cyan-400 hover:underline">Upgrade</Link></>}
                  </span>
                </div>
              </div>
              <Switch
                id="motivated-toggle"
                checked={searchParams.motivatedSellersOnly || false}
                disabled={!allowedForProFeatures}
                onCheckedChange={(checked) => {
                  if (!allowedForProFeatures) {
                    toast({
                      title: 'Pro / Elite feature',
                      description: 'Upgrade to Pro or Elite to use the motivated-seller pipeline.',
                    });
                    return;
                  }
                  updateParam('motivatedSellersOnly', checked);
                }}
              />
            </div>
          </div>

          <Button
            type="submit" 
            variant="default"
            size="lg"
            className="w-full h-12 sm:h-auto text-base sm:text-sm"
            disabled={isLoading || !searchParams.location.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-primary-foreground mr-2 sm:mr-3" />
                <span className="text-sm sm:text-base">Searching Properties...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                <span className="text-sm sm:text-base">Search Properties</span>
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}