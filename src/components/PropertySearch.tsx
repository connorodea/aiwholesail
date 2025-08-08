import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PropertySearchParams } from '@/types/zillow';
import { Search, Home, Bed, Bath, DollarSign, TrendingDown, MessageSquare, Gavel, Building2, AlertTriangle } from 'lucide-react';
import { LocationAutocomplete } from './LocationAutocomplete';
import { validatePriceRange, sanitizeSearchKeywords, validateLocationInput } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

interface PropertySearchProps {
  onSearch: (params: PropertySearchParams) => void;
  isLoading: boolean;
}

export function PropertySearch({ onSearch, isLoading }: PropertySearchProps) {
  const [searchParams, setSearchParams] = useState<PropertySearchParams>({
    location: '',
    homeType: 'Houses, Townhomes, Multi-family, Condos/Co-ops',
    wholesaleOnly: true // Default to wholesale opportunities only
  });
  const { toast } = useToast();

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
    <Card className="feature-card backdrop-blur-sm bg-gradient-to-br from-card to-card/80 border-border/60">
      <CardHeader className="pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-card-foreground">
              Property Search
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Find the perfect wholesale opportunities
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Location with Autocomplete */}
            <div className="sm:col-span-2">
              <LocationAutocomplete
                value={searchParams.location}
                onChange={(value) => updateParam('location', value)}
                required={true}
              />
            </div>

            {/* Property Type */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <div className="p-1.5 rounded bg-primary/10">
                  <Home className="h-3.5 w-3.5 text-primary" />
                </div>
                Property Type
              </Label>
              <Select value={searchParams.homeType} onValueChange={(value) => updateParam('homeType', value)}>
                <SelectTrigger className="minimal-input h-11 bg-background/50 border-border/60 hover:border-primary/40 transition-colors">
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
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <div className="p-1.5 rounded bg-primary/10">
                  <Bed className="h-3.5 w-3.5 text-primary" />
                </div>
                Min Bedrooms
              </Label>
              <Select value={searchParams.bed_min || 'any'} onValueChange={(value) => updateParam('bed_min', value === 'any' ? undefined : value)}>
                <SelectTrigger className="minimal-input h-11 bg-background/50 border-border/60 hover:border-primary/40 transition-colors">
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
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <div className="p-1.5 rounded bg-primary/10">
                  <Bath className="h-3.5 w-3.5 text-primary" />
                </div>
                Min Bathrooms
              </Label>
              <Select value={searchParams.bathrooms || 'any'} onValueChange={(value) => updateParam('bathrooms', value === 'any' ? undefined : value)}>
                <SelectTrigger className="minimal-input h-11 bg-background/50 border-border/60 hover:border-primary/40 transition-colors">
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
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <div className="p-1.5 rounded bg-primary/10">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
                Min Price
              </Label>
              <Input
                value={searchParams.price_min || ''}
                onChange={(e) => updateParam('price_min', e.target.value || undefined)}
                placeholder="e.g., 100,000"
                type="number"
                min="0"
                max="50000000"
                className="minimal-input h-11 bg-background/50 border-border/60 hover:border-primary/40 transition-colors"
              />
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <div className="p-1.5 rounded bg-primary/10">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
                Max Price
              </Label>
              <Input
                value={searchParams.price_max || ''}
                onChange={(e) => updateParam('price_max', e.target.value || undefined)}
                placeholder="e.g., 500,000"
                type="number"
                min="0"
                max="50000000"
                className="minimal-input h-11 bg-background/50 border-border/60 hover:border-primary/40 transition-colors"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="border-t border-border/30 pt-6 space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px bg-gradient-to-r from-primary/60 to-transparent flex-1" />
              <span className="text-sm font-medium text-muted-foreground px-3">Advanced Filters</span>
              <div className="h-px bg-gradient-to-l from-primary/60 to-transparent flex-1" />
            </div>

            {/* Auction Filter */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/40">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gavel className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="auction-toggle" className="text-sm font-medium text-card-foreground">
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
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* Foreclosure Filter */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/40">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="foreclosure-toggle" className="text-sm font-medium text-card-foreground">
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
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* FSBO Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/40">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Building2 className="h-4 w-4 text-success" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="fsbo-toggle" className="text-sm font-medium text-card-foreground">
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
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          <Button
            type="submit" 
            variant="default"
            size="lg"
            className="w-full h-12 bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow transition-all duration-300 font-medium text-base"
            disabled={isLoading || !searchParams.location.trim()}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground" />
                <span>Searching Properties...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Search className="h-5 w-5" />
                <span>Search Properties</span>
              </div>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}