import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { validateLocationInput, validatePriceRange, sanitizeSearchKeywords } from '@/lib/security';
import { Search, AlertCircle, Zap, DollarSign, Target } from 'lucide-react';
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
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
            <Target className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Off-Market Discovery
          </CardTitle>
          <Badge variant="secondary" className="bg-green-100 text-green-800 font-medium">
            <Zap className="h-3 w-3 mr-1" />
            Ultra-Lean
          </Badge>
        </div>
        <CardDescription className="text-base max-w-2xl mx-auto">
          <DollarSign className="inline h-4 w-4 mr-1" />
          Cost-Effective Strategy: Free public records + algorithmic filtering + minimal AI analysis. 
          Target: 5,000+ properties processed for under $100/month with 50+ quality leads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location */}
            <div className="space-y-2">
              <LocationAutocomplete
                value={searchParams.location}
                onChange={(value) => updateParam('location', value)}
              />
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <Label htmlFor="propertyType" className="text-sm font-medium">
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
              <Label className="text-sm font-medium">
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

          {/* Distress Indicators - Free Data Sources */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Distress Indicators (Free Public Data)
              </Label>
              <Badge variant="outline" className="text-xs">
                {activeFiltersCount} active
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tax Delinquency */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="taxDelinquent" className="text-sm font-medium cursor-pointer">
                      Tax Delinquent Properties
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">County tax assessor records</p>
                </div>
                <Switch
                  id="taxDelinquent"
                  checked={searchParams.filters.taxDelinquent}
                  onCheckedChange={(checked) => updateFilter('taxDelinquent', checked)}
                />
              </div>

              {/* Foreclosure Notices */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="foreclosureNotices" className="text-sm font-medium cursor-pointer">
                      Foreclosure Notices
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Public foreclosure filings</p>
                </div>
                <Switch
                  id="foreclosureNotices"
                  checked={searchParams.filters.foreclosureNotices}
                  onCheckedChange={(checked) => updateFilter('foreclosureNotices', checked)}
                />
              </div>

              {/* Code Violations */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="codeViolations" className="text-sm font-medium cursor-pointer">
                      Code Violations
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Municipal code enforcement</p>
                </div>
                <Switch
                  id="codeViolations"
                  checked={searchParams.filters.codeViolations}
                  onCheckedChange={(checked) => updateFilter('codeViolations', checked)}
                />
              </div>

              {/* Building Permits */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="buildingPermits" className="text-sm font-medium cursor-pointer">
                      Recent Building Permits
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Condition indicators</p>
                </div>
                <Switch
                  id="buildingPermits"
                  checked={searchParams.filters.buildingPermits}
                  onCheckedChange={(checked) => updateFilter('buildingPermits', checked)}
                />
              </div>

              {/* Non-Owner Occupied */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ownerOccupied" className="text-sm font-medium cursor-pointer">
                      Non-Owner Occupied
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Investment properties</p>
                </div>
                <Switch
                  id="ownerOccupied"
                  checked={searchParams.filters.ownerOccupied}
                  onCheckedChange={(checked) => updateFilter('ownerOccupied', checked)}
                />
              </div>

              {/* High Equity */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="highEquity" className="text-sm font-medium cursor-pointer">
                      High Equity Properties
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Low loan-to-value ratio</p>
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
            className="w-full h-12 text-base font-medium"
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Processing Free Data...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Off-Market Deals
              </>
            )}
          </Button>

          {activeFiltersCount === 0 && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
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