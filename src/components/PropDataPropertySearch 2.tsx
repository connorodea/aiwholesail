import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { propDataAPI, PropDataPropertyResponse } from '@/lib/propdata-api';
import {
  Search, MapPin, User, Home, DollarSign, Calendar,
  Mail, Phone, Building, FileText, RefreshCw
} from 'lucide-react';

interface PropDataPropertySearchProps {
  onPropertyFound?: (property: PropDataPropertyResponse) => void;
}

export function PropDataPropertySearch({ onPropertyFound }: PropDataPropertySearchProps) {
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [results, setResults] = useState<PropDataPropertyResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (val?: number) =>
    val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const handleSearch = async () => {
    if (!address.trim() && !zip.trim()) {
      toast({ title: 'Enter search criteria', description: 'Please enter an address or ZIP code.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (address.trim()) params.address = address.trim();
      if (zip.trim()) params.zip = zip.trim();

      const result = await propDataAPI.getProperty(params);
      const propertyResults = Array.isArray(result) ? result : [result];
      setResults(propertyResults);

      if (propertyResults.length > 0 && propertyResults[0].address) {
        toast({ title: 'Property found', description: `Found ${propertyResults.length} record(s) from county assessor data.` });
        onPropertyFound?.(propertyResults[0]);
      } else {
        toast({ title: 'No results', description: 'No property records found. Try a different address or ZIP.', variant: 'destructive' });
        setResults([]);
      }
    } catch (error) {
      console.error('[PropDataPropertySearch] Search failed:', error);
      toast({ title: 'Search failed', description: 'Could not fetch property data.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card className="simple-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Search className="h-5 w-5 text-primary" />
            Off-Market Property Lookup
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search 82M+ county assessor records. Get owner info, assessed values, and sale history.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="pd-address">Street Address</Label>
              <Input
                id="pd-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Miami FL"
                className="bg-background/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-full sm:w-32 space-y-2">
              <Label htmlFor="pd-zip">ZIP Code</Label>
              <Input
                id="pd-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="33101"
                className="bg-background/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto h-10">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {results.length} {results.length === 1 ? 'Record' : 'Records'} Found
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((property, idx) => (
              <PropDataPropertyCard key={idx} property={property} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PropDataPropertyCard({ property }: { property: PropDataPropertyResponse }) {
  const formatCurrency = (val?: number) =>
    val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  return (
    <Card className="simple-card hover:shadow-elegant smooth-transition">
      <CardContent className="pt-6 space-y-4">
        {/* Address */}
        <div className="space-y-1">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            {property.address || 'Unknown Address'}
          </h3>
          <p className="text-sm text-muted-foreground ml-6">
            {[property.county, property.state, property.zip].filter(Boolean).join(', ')}
          </p>
        </div>

        {/* Owner Info */}
        {property.owner_name && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Owner Information</span>
            </div>
            <div className="ml-6 space-y-1 text-sm">
              <div><strong>Name:</strong> {property.owner_name}</div>
              {property.mailing_address && (
                <div className="flex items-start gap-1">
                  <Mail className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />
                  <span>{property.mailing_address}{property.mailing_city ? `, ${property.mailing_city}` : ''}{property.mailing_state ? ` ${property.mailing_state}` : ''} {property.mailing_zip || ''}</span>
                </div>
              )}
              {property.owner_occupied != null && (
                <Badge variant="outline" className="text-xs">
                  {property.owner_occupied ? 'Owner Occupied' : 'Non-Owner Occupied'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Property Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {property.property_type && (
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <Home className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{property.property_type}</span>
            </div>
          )}
          {property.year_built && (
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">Built {property.year_built}</span>
            </div>
          )}
          {property.bedrooms != null && (
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <Building className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{property.bedrooms} bed / {property.bathrooms ?? '?'} bath</span>
            </div>
          )}
          {property.sqft != null && (
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{property.sqft.toLocaleString()} sqft</span>
            </div>
          )}
        </div>

        {/* Valuation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {property.assessed_value != null && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="text-xs text-muted-foreground">Assessed Value</div>
              <div className="text-base font-bold">{formatCurrency(property.assessed_value)}</div>
            </div>
          )}
          {property.market_value != null && (
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="text-xs text-muted-foreground">Market Value</div>
              <div className="text-base font-bold text-green-600">{formatCurrency(property.market_value)}</div>
            </div>
          )}
          {property.last_sale_price != null && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="text-xs text-muted-foreground">Last Sale</div>
              <div className="text-base font-bold">{formatCurrency(property.last_sale_price)}</div>
              {property.last_sale_date && (
                <div className="text-xs text-muted-foreground">{property.last_sale_date}</div>
              )}
            </div>
          )}
        </div>

        {/* Tax Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          {property.tax_amount != null && (
            <span>Tax: {formatCurrency(property.tax_amount)}/yr{property.tax_year ? ` (${property.tax_year})` : ''}</span>
          )}
          {property.tax_delinquent && (
            <Badge variant="destructive" className="text-xs">Tax Delinquent</Badge>
          )}
          {property.apn && <span>APN: {property.apn}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
