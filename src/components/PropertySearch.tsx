import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PropertySearchParams } from '@/types/zillow';
import { Search, MapPin, Home, Bed, Bath, DollarSign, TrendingDown, MessageSquare } from 'lucide-react';

interface PropertySearchProps {
  onSearch: (params: PropertySearchParams) => void;
  isLoading: boolean;
}

export function PropertySearch({ onSearch, isLoading }: PropertySearchProps) {
  const [searchParams, setSearchParams] = useState<PropertySearchParams>({
    location: '',
    homeType: 'Houses, Townhomes, Multi-family, Condos/Co-ops'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchParams.location.trim()) {
      onSearch(searchParams);
    }
  };

  const updateParam = (key: keyof PropertySearchParams, value: string) => {
    setSearchParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Search className="h-5 w-5 text-primary" />
          Property Search
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Location
              </Label>
              <Input
                id="location"
                value={searchParams.location}
                onChange={(e) => updateParam('location', e.target.value)}
                placeholder="e.g., New York, NY"
                className="bg-background/50"
                required
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
                className="bg-background/50"
              />
            </div>

            {/* Keywords */}
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Wholesaling Keywords
              </Label>
              <Input
                value={searchParams.keywords || ''}
                onChange={(e) => updateParam('keywords', e.target.value || undefined)}
                placeholder="e.g., needs TLC, repairs, fixer upper, motivated seller"
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Search for properties with specific keywords in descriptions (TLC, repairs, motivated, etc.)
              </p>
            </div>
          </div>

          {/* Wholesale Filter */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                <Label htmlFor="wholesale-toggle" className="text-sm font-medium">
                  Wholesale Opportunities Only
                </Label>
              </div>
              <Switch
                id="wholesale-toggle"
                checked={searchParams.wholesaleOnly || false}
                onCheckedChange={(checked) => setSearchParams(prev => ({ ...prev, wholesaleOnly: checked }))}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Only show properties priced below Zestimate (market value)
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
            disabled={isLoading || !searchParams.location.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
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