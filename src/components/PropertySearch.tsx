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
                <Label htmlFor="auction-toggle" className="text-sm font-medium">
                  Hide Auction Properties
                </Label>
              </div>
              <Switch
                id="auction-toggle"
                checked={searchParams.auctionOnly || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, auctionOnly: checked }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Filter out auction properties from search results
            </p>

            {/* Foreclosure Filter */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <Label htmlFor="foreclosure-toggle" className="text-sm font-medium">
                  Hide Foreclosure Properties
                </Label>
              </div>
              <Switch
                id="foreclosure-toggle"
                checked={searchParams.hideForeclosures || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, hideForeclosures: checked }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Filter out foreclosure properties from search results
            </p>

            {/* FSBO Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-primary" />
                <Label htmlFor="fsbo-toggle" className="text-sm font-medium">
                  FSBO Properties Only
                </Label>
              </div>
              <Switch
                id="fsbo-toggle"
                checked={searchParams.fsboOnly || false}
                onCheckedChange={(checked) => updateParam('fsboOnly', checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Show only For Sale By Owner properties
            </p>
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