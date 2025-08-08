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
    <Card className="bg-card border border-border/20 shadow-sm">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-card-foreground">
          <Search className="h-5 w-5 text-primary" />
          Property Search
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Find the perfect wholesale opportunities
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Location with Autocomplete */}
            <div className="sm:col-span-2">
              <LocationAutocomplete
                value={searchParams.location}
                onChange={(value) => updateParam('location', value)}
                required={true}
              />
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4 text-muted-foreground" />
                Property Type
              </Label>
              <Select value={searchParams.homeType} onValueChange={(value) => updateParam('homeType', value)}>
                <SelectTrigger className="h-10 border-border/60 focus:border-primary">
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
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Bed className="h-4 w-4 text-muted-foreground" />
                Min Bedrooms
              </Label>
              <Select value={searchParams.bed_min || 'any'} onValueChange={(value) => updateParam('bed_min', value === 'any' ? undefined : value)}>
                <SelectTrigger className="h-10 border-border/60 focus:border-primary">
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
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Bath className="h-4 w-4 text-muted-foreground" />
                Min Bathrooms
              </Label>
              <Select value={searchParams.bathrooms || 'any'} onValueChange={(value) => updateParam('bathrooms', value === 'any' ? undefined : value)}>
                <SelectTrigger className="h-10 border-border/60 focus:border-primary">
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
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Min Price
              </Label>
              <Input
                value={searchParams.price_min || ''}
                onChange={(e) => updateParam('price_min', e.target.value || undefined)}
                placeholder="e.g., 100,000"
                type="number"
                min="0"
                max="50000000"
                className="h-10 border-border/60 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Max Price
              </Label>
              <Input
                value={searchParams.price_max || ''}
                onChange={(e) => updateParam('price_max', e.target.value || undefined)}
                placeholder="e.g., 500,000"
                type="number"
                min="0"
                max="50000000"
                className="h-10 border-border/60 focus:border-primary"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="border-t border-border/20 pt-6 space-y-4">
            <h3 className="text-sm font-medium text-card-foreground mb-4">Filters</h3>

            {/* Auction Filter */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="auction-toggle" className="text-sm font-medium cursor-pointer">
                    Hide Auction Properties
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Filter out auction properties from search results
                  </p>
                </div>
              </div>
              <Switch
                id="auction-toggle"
                checked={searchParams.auctionOnly || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, auctionOnly: checked }))}
              />
            </div>

            {/* Foreclosure Filter */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="foreclosure-toggle" className="text-sm font-medium cursor-pointer">
                    Hide Foreclosure Properties
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Filter out foreclosure properties from search results
                  </p>
                </div>
              </div>
              <Switch
                id="foreclosure-toggle"
                checked={searchParams.hideForeclosures || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, hideForeclosures: checked }))}
              />
            </div>

            {/* FSBO Toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="fsbo-toggle" className="text-sm font-medium cursor-pointer">
                    FSBO Properties Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show only For Sale By Owner properties
                  </p>
                </div>
              </div>
              <Switch
                id="fsbo-toggle"
                checked={searchParams.fsboOnly || false}
                onCheckedChange={(checked) => updateParam('fsboOnly', checked)}
              />
            </div>
          </div>

          <Button
            type="submit" 
            variant="default"
            size="lg"
            className="w-full h-11 font-medium"
            disabled={isLoading || !searchParams.location.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                Searching Properties...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Properties
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}