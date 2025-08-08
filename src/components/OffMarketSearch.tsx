import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { validateLocationInput, validatePriceRange, sanitizeSearchKeywords } from '@/lib/security';
import { Search, AlertTriangle, DollarSign, Target, Home, Building, Users, Calendar, Filter } from 'lucide-react';
import type { OffMarketSearchParams } from '@/lib/off-market-api';

interface OffMarketSearchProps {
  onSearch: (params: OffMarketSearchParams) => void;
  isLoading: boolean;
}

export function OffMarketSearch({ onSearch, isLoading }: OffMarketSearchProps) {
  const [searchParams, setSearchParams] = useState<OffMarketSearchParams>({
    location: '',
    propertyType: 'all',
    filters: {
      taxDelinquent: true,
      foreclosureNotices: true,
      codeViolations: true,
      buildingPermits: false,
      ownerOccupied: false,
      highEquity: true,
    }
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
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
    const priceValidation = validatePriceRange(searchParams.priceMin, searchParams.priceMax);
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
      priceMin: priceValidation.min?.toString(),
      priceMax: priceValidation.max?.toString()
    };
    
    onSearch(sanitizedParams);
  };

  const updateParam = (key: keyof OffMarketSearchParams, value: any) => {
    setSearchParams(prev => ({ ...prev, [key]: value }));
  };

  const updateFilter = (filterKey: keyof OffMarketSearchParams['filters'], value: boolean) => {
    setSearchParams(prev => ({
      ...prev,
      filters: { ...prev.filters, [filterKey]: value }
    }));
  };

  const activeFiltersCount = Object.values(searchParams.filters).filter(Boolean).length;

  return (
    <Card className="simple-card">
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl text-foreground">
          <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Off-Market Property Discovery
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ultra-lean approach: Process 5,000+ properties for under $100/month
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Location */}
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
              <Select value={searchParams.propertyType} onValueChange={(value) => updateParam('propertyType', value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="SFR">Single Family</SelectItem>
                  <SelectItem value="duplex">Duplex</SelectItem>
                  <SelectItem value="townhome">Townhome</SelectItem>
                  <SelectItem value="multi-family">Multi-family</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Price Range
              </Label>
              <div className="flex gap-2">
                <Input
                  value={searchParams.priceMin || ''}
                  onChange={(e) => updateParam('priceMin', e.target.value || undefined)}
                  placeholder="Min (50K)"
                  type="number"
                  min="0"
                  max="10000000"
                  className="bg-background/50"
                />
                <Input
                  value={searchParams.priceMax || ''}
                  onChange={(e) => updateParam('priceMax', e.target.value || undefined)}
                  placeholder="Max (400K)"
                  type="number"
                  min="0"
                  max="10000000"
                  className="bg-background/50"
                />
              </div>
            </div>
          </div>

          {/* Distress Indicators */}
          <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">Distress Indicators</Label>
              </div>
              <Badge variant="outline" className="text-xs">
                {activeFiltersCount} active
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Tax Delinquent */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="taxDelinquent" className="text-sm font-medium cursor-pointer">
                      Tax Delinquent
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      County tax records
                    </span>
                  </div>
                </div>
                <Switch
                  id="taxDelinquent"
                  checked={searchParams.filters.taxDelinquent}
                  onCheckedChange={(checked) => updateFilter('taxDelinquent', checked)}
                />
              </div>

              {/* Foreclosure Notices */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="foreclosureNotices" className="text-sm font-medium cursor-pointer">
                      Foreclosure Notices
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Public filings
                    </span>
                  </div>
                </div>
                <Switch
                  id="foreclosureNotices"
                  checked={searchParams.filters.foreclosureNotices}
                  onCheckedChange={(checked) => updateFilter('foreclosureNotices', checked)}
                />
              </div>

              {/* Code Violations */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-warning" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="codeViolations" className="text-sm font-medium cursor-pointer">
                      Code Violations
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Municipal violations
                    </span>
                  </div>
                </div>
                <Switch
                  id="codeViolations"
                  checked={searchParams.filters.codeViolations}
                  onCheckedChange={(checked) => updateFilter('codeViolations', checked)}
                />
              </div>

              {/* Building Permits */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-info" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="buildingPermits" className="text-sm font-medium cursor-pointer">
                      Recent Permits
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Condition indicators
                    </span>
                  </div>
                </div>
                <Switch
                  id="buildingPermits"
                  checked={searchParams.filters.buildingPermits}
                  onCheckedChange={(checked) => updateFilter('buildingPermits', checked)}
                />
              </div>

              {/* Non-Owner Occupied */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-info" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="ownerOccupied" className="text-sm font-medium cursor-pointer">
                      Non-Owner Occupied
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Investment properties
                    </span>
                  </div>
                </div>
                <Switch
                  id="ownerOccupied"
                  checked={searchParams.filters.ownerOccupied}
                  onCheckedChange={(checked) => updateFilter('ownerOccupied', checked)}
                />
              </div>

              {/* High Equity */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="highEquity" className="text-sm font-medium cursor-pointer">
                      High Equity (70%+)
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Strong equity position
                    </span>
                  </div>
                </div>
                <Switch
                  id="highEquity"
                  checked={searchParams.filters.highEquity}
                  onCheckedChange={(checked) => updateFilter('highEquity', checked)}
                />
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords" className="text-sm font-medium">Additional Keywords (Optional)</Label>
            <Input
              id="keywords"
              value={searchParams.keywords || ''}
              onChange={(e) => updateParam('keywords', e.target.value || undefined)}
              placeholder="e.g., motivated seller, estate sale, divorce"
              className="bg-background/50"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || activeFiltersCount === 0}
            className="w-full h-12 sm:h-auto text-base sm:text-sm"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-primary-foreground mr-2 sm:mr-3" />
                <span className="text-sm sm:text-base">Processing Free Data...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                <span className="text-sm sm:text-base">Find Off-Market Deals</span>
              </>
            )}
          </Button>

          {activeFiltersCount === 0 && (
            <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg border border-warning/20">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p>
                Please enable at least one distress indicator to search for off-market opportunities.
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}