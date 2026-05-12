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
import { isMultiLocationSearchEnabled } from '@/lib/feature-flags';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
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
  // Layout v2 = Location + radius side-by-side with tightened copy.
  // Default OFF; flipped per-user via feature_flag_users (dogfood: cpodea5).
  // While the flag fetch is in flight we render v1 — no skeleton needed,
  // v1 is the safe legacy layout already on prod.
  const { enabled: layoutV2Enabled } = useFeatureFlag('main-search-layout-v2');

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
                 Gated on useFeatureFlag('main-search-layout-v2'). */
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
              /* v1 layout (default + loading state): Location full-width,
                 radius stacked below. Byte-for-byte identical to current
                 prod so non-flagged users see no change. */
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
                      Search radius
                      <span className="text-xs text-muted-foreground font-normal ml-1">optional · single ZIP or address</span>
                    </Label>
                    <Input
                      id="radius-mi"
                      type="number"
                      min={1}
                      max={100}
                      placeholder="e.g. 10 mi"
                      value={searchParams.radiusMi ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchParams((prev) => ({
                          ...prev,
                          radiusMi: v === '' ? undefined : Number(v),
                        }));
                      }}
                      className="bg-background/50 max-w-xs no-spinner"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expands to every ZIP within X miles, then searches each.
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

            {/* Property Type — full width, anchors the row */}
            <div className="space-y-2 sm:col-span-2">
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

            {/* Price range — paired in a single row so Max Price isn't left
                hanging alone on the right (visual asymmetry the v1 layout
                had). The two inputs share one label band. */}
            <div className="space-y-2 sm:col-span-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Price range
                <span className="text-xs text-muted-foreground font-normal ml-1">USD</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Min</span>
                  <Input
                    value={searchParams.price_min || ''}
                    onChange={(e) => updateParam('price_min', e.target.value || undefined)}
                    placeholder="100,000"
                    type="number"
                    min="0"
                    max="50000000"
                    className="bg-background/50 pl-12 no-spinner"
                    aria-label="Minimum price"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Max</span>
                  <Input
                    value={searchParams.price_max || ''}
                    onChange={(e) => updateParam('price_max', e.target.value || undefined)}
                    placeholder="500,000"
                    type="number"
                    min="0"
                    max="50000000"
                    className="bg-background/50 pl-12 no-spinner"
                    aria-label="Maximum price"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Filters — uniform card-style toggle rows, eyebrow label,
              subtle hover state. Motivated Sellers gets a brighter cyan
              wash when enabled (premium accent) but matches the others
              when off so the section reads as one unified list. */}
          <div className="border-t border-border/60 pt-4 sm:pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Filters
              </h3>
              <span className="text-[10px] text-muted-foreground/70">
                Refine your results
              </span>
            </div>

            <div className="space-y-2">
              <ToggleRow
                id="auction-toggle"
                icon={Gavel}
                label="Hide Auction Properties"
                description="Filter out auction listings"
                checked={searchParams.auctionOnly || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, auctionOnly: checked }))}
              />
              <ToggleRow
                id="foreclosure-toggle"
                icon={AlertTriangle}
                label="Hide Foreclosure Properties"
                description="Filter out foreclosure listings"
                checked={searchParams.hideForeclosures || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, hideForeclosures: checked }))}
              />
              <ToggleRow
                id="wholesale-toggle"
                icon={TrendingDown}
                iconClass="text-success"
                label="Most Profitable Only"
                description="Only properties priced below their Zestimate"
                checked={searchParams.wholesaleOnly || false}
                onCheckedChange={(checked) => updateParam('wholesaleOnly', checked)}
              />
              <ToggleRow
                id="fsbo-toggle"
                icon={Building2}
                label="FSBO Properties Only"
                description="Show only For Sale By Owner listings"
                checked={searchParams.fsboOnly || false}
                onCheckedChange={(checked) => updateParam('fsboOnly', checked)}
              />

              {/* Motivated Sellers — premium tier, accent when active */}
              <ToggleRow
                id="motivated-toggle"
                icon={Flame}
                iconClass="text-cyan-400"
                accent
                active={!!searchParams.motivatedSellersOnly}
                label={
                  <span className="flex items-center gap-1.5">
                    Motivated Sellers Only
                    <Badge variant="secondary" className="text-[9px] gap-0.5 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                      <Sparkles className="h-2 w-2" /> Pro / Elite
                    </Badge>
                    {!allowedForProFeatures && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </span>
                }
                description={
                  allowedForProFeatures
                    ? 'FSBO + days-on-market + price cuts + Make Me Move signals'
                    : <>Combine off-market signals into one filtered view. <Link to="/pricing" className="text-cyan-400 hover:underline">Upgrade</Link></>
                }
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
            className="group w-full h-12 sm:h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 text-cyan-950 hover:from-cyan-400 hover:to-cyan-300 shadow-[0_0_0_1px_rgba(6,182,212,0.4),0_8px_24px_-8px_rgba(6,182,212,0.5)] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.5),0_12px_32px_-8px_rgba(6,182,212,0.7)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            disabled={isLoading || !searchParams.location.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-current mr-2 sm:mr-3" />
                <span>Searching Properties…</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 transition-transform group-hover:scale-110" />
                <span>Search Properties</span>
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Uniform toggle row used by the Filters section. Replaces 5 hand-written
 * variants (3 plain + 2 styled) — same hover/active feel, easier to scan,
 * and `accent` opt-in keeps Motivated Sellers visually distinct when active.
 */
function ToggleRow({
  id,
  icon: Icon,
  iconClass = 'text-primary',
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  accent,
  active,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  label: React.ReactNode;
  description: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  accent?: boolean;
  active?: boolean;
}) {
  const accentActive = accent && active;
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150',
        accentActive
          ? 'border-cyan-500/40 bg-cyan-500/[0.05] shadow-[0_0_0_1px_rgba(6,182,212,0.15)]'
          : 'border-border/60 hover:border-border hover:bg-background/40',
      ].join(' ')}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${iconClass}`} />
        <div className="flex flex-col min-w-0">
          <Label htmlFor={id} className="text-sm font-medium leading-tight cursor-pointer">
            {label}
          </Label>
          <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </span>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="shrink-0"
      />
    </div>
  );
}