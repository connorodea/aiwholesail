import React, { useState, useEffect } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Home,
  MapPin,
  DollarSign,
  Square,
  Calendar,
  TrendingUp,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { zillowAPI } from '@/lib/zillow-api';
import { isAuctionSubject } from '@/lib/auction-detection';
import {
  DEFAULT_COMPS_FILTERS,
  filterComps,
} from '@/lib/comps-filter.js';
import {
  COMPS_FILTER_CONTROLS_FLAG,
  isCompsFilterControlsEnabled,
} from '@/lib/compsFilterFlag.js';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, RotateCcw } from 'lucide-react';

type BedBathTolerance = 'any' | 'exact' | '+/-1';
interface CompsFilters {
  maxDistanceMi: number | null;
  bedTolerance: BedBathTolerance;
  bathTolerance: BedBathTolerance;
  sqftTolerancePct: number | null;
}

interface ComparableSalesTableProps {
  property: Property;
}

interface Comparable {
  address: string;
  price: number;
  sqft: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  distance?: number;
  saleDate?: string;
  zpid?: string;
}

export function ComparableSalesTable({ property }: ComparableSalesTableProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompsFilters>(DEFAULT_COMPS_FILTERS as CompsFilters);
  const compsFilterFlag = useFeatureFlag(COMPS_FILTER_CONTROLS_FLAG);
  const filterControlsEnabled = isCompsFilterControlsEnabled(compsFilterFlag);

  useEffect(() => {
    const fetchComparables = async () => {
      const zpid = property.zpid || property.id;
      if (!zpid) {
        setError('No property ID available');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Build location string for fallback — parse city/state/zip from address
        // Property.address is typically "228 Gumtree Dr, Kannapolis, NC 28083"
        // We need just "Kannapolis, NC 28083" for the search to return correct results
        let location = '';
        const addr = (property as any).city
          ? [(property as any).city, (property as any).state, (property as any).zipcode || (property as any).zip].filter(Boolean).join(', ')
          : '';
        if (!location && property.address) {
          // Parse city/state/zip from full address string
          const parts = property.address.split(',').map(p => p.trim());
          if (parts.length >= 3) {
            // "228 Gumtree Dr, Kannapolis, NC 28083" → "Kannapolis, NC 28083"
            location = parts.slice(1).join(', ');
          } else if (parts.length === 2) {
            // "Kannapolis, NC 28083" → use as-is
            location = property.address;
          } else {
            location = property.address;
          }
        }
        if (addr) location = addr;

        // Pass lat/lng so comps can be sorted by distance from subject,
        // plus beds/sqft so the fallback path can re-rank by structural
        // similarity (closer-by-feature beats closer-by-mile when there
        // are many candidates). New arg is optional and undefined-safe.
        const subjectLat = (property as any).latitude || (property as any).lat;
        const subjectLng = (property as any).longitude || (property as any).lng || (property as any).long;
        const data = await zillowAPI.getPropertyComps(zpid, location, subjectLat, subjectLng, {
          beds: property.bedrooms,
          sqft: property.sqft,
        });

        if (data && Array.isArray(data)) {
          const processed = data
            .filter((comp: any) => comp.price || comp.soldPrice || comp.lastSoldPrice)
            .slice(0, 10)
            .map((comp: any) => ({
              address: comp.address || comp.streetAddress || 'Unknown Address',
              price: comp.price || comp.soldPrice || comp.lastSoldPrice || 0,
              sqft: comp.sqft || comp.livingArea || comp.livingAreaSqFt || 0,
              pricePerSqft: comp.pricePerSqft || (comp.price && comp.sqft ? Math.round(comp.price / comp.sqft) : 0),
              bedrooms: comp.bedrooms || comp.beds || 0,
              bathrooms: comp.bathrooms || comp.baths || 0,
              distance: comp.distance || null,
              saleDate: comp.saleDate || comp.lastSoldDate || comp.dateSold || null,
              zpid: comp.zpid || null
            }));

          setComparables(processed);
        } else if (data?.comps || data?.similar) {
          const compsArray = data.comps || data.similar;
          const processed = compsArray
            .filter((comp: any) => comp.price || comp.soldPrice || comp.lastSoldPrice)
            .slice(0, 10)
            .map((comp: any) => ({
              address: comp.address || comp.streetAddress || 'Unknown Address',
              price: comp.price || comp.soldPrice || comp.lastSoldPrice || 0,
              sqft: comp.sqft || comp.livingArea || comp.livingAreaSqFt || 0,
              pricePerSqft: comp.pricePerSqft || (comp.price && comp.sqft ? Math.round(comp.price / comp.sqft) : 0),
              bedrooms: comp.bedrooms || comp.beds || 0,
              bathrooms: comp.bathrooms || comp.baths || 0,
              distance: comp.distance || null,
              saleDate: comp.saleDate || comp.lastSoldDate || comp.dateSold || null,
              zpid: comp.zpid || null
            }));

          setComparables(processed);
        } else {
          setError('No comparable sales found');
        }
      } catch (err) {
        console.error('Error fetching comparables:', err);
        setError('Could not load comparable sales');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparables();
  }, [property]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Apply user-controlled filters before computing stats. When the flag is
  // OFF or all filters are at "any", filteredComparables === comparables.
  const filteredComparables = filterControlsEnabled
    ? (filterComps(comparables, {
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
      }, filters) as Comparable[])
    : comparables;

  // Calculate ARV statistics off the filtered set so the spread reflects
  // what the user is actually seeing.
  const avgPrice = filteredComparables.length > 0
    ? Math.round(filteredComparables.reduce((sum, c) => sum + c.price, 0) / filteredComparables.length)
    : 0;

  const medianPrice = filteredComparables.length > 0
    ? [...filteredComparables].sort((a, b) => a.price - b.price)[Math.floor(filteredComparables.length / 2)].price
    : 0;

  const avgPricePerSqft = filteredComparables.length > 0
    ? Math.round(filteredComparables.filter(c => c.pricePerSqft > 0).reduce((sum, c) => sum + c.pricePerSqft, 0) / Math.max(1, filteredComparables.filter(c => c.pricePerSqft > 0).length))
    : 0;

  const estimatedARV = property.sqft && avgPricePerSqft > 0
    ? Math.round(property.sqft * avgPricePerSqft)
    : avgPrice;

  const potentialProfit = estimatedARV - (property.price || 0);
  const spreadFromComps = property.price && estimatedARV ? estimatedARV - property.price : 0;

  // Detect foreclosure/auction subjects so we don't render a misleading
  // "Great Deal +$X" verdict against an opening-bid price. Pure detection
  // logic lives in src/lib/auction-detection.js so it can be unit-tested
  // without rendering the component. See PR #94's rationale.
  const isAuctionLike = isAuctionSubject({
    price: property.price,
    sqft: property.sqft,
    description: (property as any).description,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading comparable sales...</span>
      </div>
    );
  }

  if (error && comparables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground mt-2">Try searching for similar properties in this area</p>
      </div>
    );
  }

  // No comps within reasonable radius — surface this clearly instead of showing
  // garbage 50+mi-away listings (the previous behavior).
  if (!isLoading && comparables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
        <AlertCircle className="h-12 w-12 text-amber-400 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">No nearby comps available</h3>
        <p className="text-sm text-muted-foreground">
          We couldn't find recently-sold properties within 10 miles of this address. Rural and small-town listings often have sparse comp data — try the ARV tab for an estimate based on Zestimate trends instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ARV Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Estimated ARV</span>
            </div>
            <div className="text-xl font-bold text-primary">{formatPrice(estimatedARV)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on {filteredComparables.length}
              {filterControlsEnabled && filteredComparables.length !== comparables.length
                ? ` of ${comparables.length}`
                : ''}{' '}comps
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Avg $/SqFt</span>
            </div>
            <div className="text-xl font-bold">${avgPricePerSqft}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Subject: ${property.pricePerSqft ? Math.round(property.pricePerSqft) : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${spreadFromComps > 30000 ? 'from-green-500/10 to-green-500/5 border-green-500/20' : 'from-muted/50 to-muted/30 border-border'}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className={`h-4 w-4 ${spreadFromComps > 30000 ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase">Spread vs ARV</span>
            </div>
            <div className={`text-xl font-bold ${spreadFromComps > 30000 ? 'text-green-500' : spreadFromComps > 0 ? 'text-foreground' : 'text-red-500'}`}>
              {spreadFromComps >= 0 ? '+' : ''}{formatPrice(spreadFromComps)}
            </div>
            {spreadFromComps > 50000 && !isAuctionLike && (
              <Badge className="mt-1 bg-green-500">Great Deal</Badge>
            )}
            {isAuctionLike && (
              <div className="text-xs text-amber-600 mt-1">
                Auction subject — listed price likely an opening bid
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Home className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Median Price</span>
            </div>
            <div className="text-xl font-bold">{formatPrice(medianPrice)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Property Comparison */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="h-5 w-5 text-primary" />
            Subject Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground">Price</div>
              <div className="text-xl font-bold">{formatPrice(property.price || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Sq Ft</div>
              <div className="text-xl font-bold">{property.sqft?.toLocaleString() || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">$/Sq Ft</div>
              <div className="text-xl font-bold">${property.pricePerSqft ? Math.round(property.pricePerSqft) : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Beds</div>
              <div className="text-xl font-bold">{property.bedrooms || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Baths</div>
              <div className="text-xl font-bold">{property.bathrooms || 'N/A'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparables Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Comparable Properties ({filteredComparables.length}
            {filterControlsEnabled && filteredComparables.length !== comparables.length
              ? ` of ${comparables.length}`
              : ''})
          </CardTitle>
        </CardHeader>
        {filterControlsEnabled && (
          <CardContent className="pt-0 pb-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filter comps</span>
                {(filters.maxDistanceMi !== null ||
                  filters.bedTolerance !== 'any' ||
                  filters.bathTolerance !== 'any' ||
                  filters.sqftTolerancePct !== null) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={() => setFilters(DEFAULT_COMPS_FILTERS as CompsFilters)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Within</label>
                  <Select
                    value={filters.maxDistanceMi === null ? 'any' : String(filters.maxDistanceMi)}
                    onValueChange={(v) =>
                      setFilters((prev) => ({ ...prev, maxDistanceMi: v === 'any' ? null : Number(v) }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any distance</SelectItem>
                      <SelectItem value="0.25">≤ 0.25 mi</SelectItem>
                      <SelectItem value="0.5">≤ 0.5 mi</SelectItem>
                      <SelectItem value="1">≤ 1 mi</SelectItem>
                      <SelectItem value="2">≤ 2 mi</SelectItem>
                      <SelectItem value="5">≤ 5 mi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Beds {property.bedrooms ? `(subject: ${property.bedrooms})` : ''}
                  </label>
                  <Select
                    value={filters.bedTolerance}
                    onValueChange={(v) => setFilters((prev) => ({ ...prev, bedTolerance: v as BedBathTolerance }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any beds</SelectItem>
                      <SelectItem value="exact">Exact match</SelectItem>
                      <SelectItem value="+/-1">±1 bed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Baths {property.bathrooms ? `(subject: ${property.bathrooms})` : ''}
                  </label>
                  <Select
                    value={filters.bathTolerance}
                    onValueChange={(v) => setFilters((prev) => ({ ...prev, bathTolerance: v as BedBathTolerance }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any baths</SelectItem>
                      <SelectItem value="exact">Exact match</SelectItem>
                      <SelectItem value="+/-1">±1 bath</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Sqft {property.sqft ? `(subject: ${property.sqft.toLocaleString()})` : ''}
                  </label>
                  <Select
                    value={filters.sqftTolerancePct === null ? 'any' : String(filters.sqftTolerancePct)}
                    onValueChange={(v) =>
                      setFilters((prev) => ({ ...prev, sqftTolerancePct: v === 'any' ? null : Number(v) }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any size</SelectItem>
                      <SelectItem value="10">±10% (tight)</SelectItem>
                      <SelectItem value="20">±20% (similar)</SelectItem>
                      <SelectItem value="30">±30% (loose)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {filteredComparables.length === 0 && comparables.length > 0 && (
                <div className="mt-3 text-xs text-amber-600">
                  No comps match the current filters. Loosen criteria or reset to see all {comparables.length}.
                </div>
              )}
            </div>
          </CardContent>
        )}
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Address</TableHead>
                  <TableHead className="font-semibold text-right">Sale Price</TableHead>
                  <TableHead className="font-semibold text-right">Sq Ft</TableHead>
                  <TableHead className="font-semibold text-right">$/Sq Ft</TableHead>
                  <TableHead className="font-semibold text-center">Beds/Baths</TableHead>
                  <TableHead className="font-semibold text-right">Sale Date</TableHead>
                  <TableHead className="font-semibold text-right">Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComparables.map((comp, index) => {
                  const priceDiff = comp.price - (property.price || 0);
                  const priceDiffPercent = property.price ? ((priceDiff / property.price) * 100) : 0;

                  return (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{comp.address}</span>
                        </div>
                        {comp.distance && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {comp.distance.toFixed(1)} mi away
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPrice(comp.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {comp.sqft > 0 ? comp.sqft.toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${comp.pricePerSqft > 0 ? comp.pricePerSqft : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        {comp.bedrooms}/{comp.bathrooms}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(comp.saleDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={priceDiff > 0 ? 'default' : priceDiff < 0 ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {priceDiff >= 0 ? '+' : ''}{priceDiffPercent.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {comparables.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No comparable sales found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Note */}
      {comparables.length > 0 && spreadFromComps > 30000 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-green-600">Profitable Deal Confirmed</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Based on {comparables.length} comparable sales, this property is priced {formatPrice(spreadFromComps)} below
                  the estimated ARV of {formatPrice(estimatedARV)}. The average $/sqft in this area is ${avgPricePerSqft}.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
