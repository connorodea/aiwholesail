import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Search, Zap, TrendingUp, Users, MapPin, Phone, Mail } from 'lucide-react';
import { rapidAPIService } from '@/lib/rapidapi-service';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EnhancedPropertySearchProps {
  onPropertySelect?: (property: any) => void;
}

export function EnhancedPropertySearch({ onPropertySelect }: EnhancedPropertySearchProps) {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [skipTraceData, setSkipTraceData] = useState<any>(null);
  const [peopleData, setPeopleData] = useState<any>(null);

  const handleEnhancedSearch = async () => {
    if (!address || !city || !state) {
      toast.error('Please enter complete address information');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting enhanced property search...');
      
      // Get enhanced property data
      const propertyResult = await rapidAPIService.getEnhancedPropertyData(address, city, state);
      
      if (propertyResult.success) {
        setSearchResults(propertyResult.data);
        toast.success('Enhanced property data retrieved successfully!');
        
        // Automatically perform skip trace for the property
        const skipResult = await rapidAPIService.getEnhancedSkipTrace(`${address}, ${city}, ${state}`);
        if (skipResult.success) {
          setSkipTraceData(skipResult.data);
          toast.success('Skip trace completed with enhanced data!');
        }
        
      } else {
        toast.error(propertyResult.error || 'Failed to fetch enhanced property data');
      }
    } catch (error) {
      console.error('Enhanced search failed:', error);
      toast.error('Enhanced property search failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePeopleLookup = async (query: { phone?: string; email?: string; name?: string }) => {
    try {
      const result = await rapidAPIService.lookupPersonData(query);
      if (result.success) {
        setPeopleData(result.data);
        toast.success('People data lookup completed!');
      } else {
        toast.error('People data lookup failed');
      }
    } catch (error) {
      console.error('People lookup failed:', error);
      toast.error('People data lookup failed');
    }
  };

  const renderCostSavings = () => (
    <Alert className="mb-4">
      <TrendingUp className="h-4 w-4" />
      <AlertDescription>
        <strong>Cost-Effective API Stack:</strong> Using RapidAPI marketplace for 35-40% savings vs premium providers.
        Enhanced property data (~$0.005), Skip tracing (~$0.05), People lookup (~$0.03) per query.
      </AlertDescription>
    </Alert>
  );

  const renderPropertyResults = () => {
    if (!searchResults) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Enhanced Property Data
            <Badge variant="secondary">{searchResults.source}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Property Features:</h4>
              <ul className="text-sm space-y-1">
                {searchResults.features?.map((feature: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Data Sources:</h4>
              <p className="text-sm text-muted-foreground">
                Aggregated from multiple MLS sources with real-time updates and comprehensive market analysis.
              </p>
              <div className="mt-2">
                <Badge variant="outline">Cost: ${searchResults.costPerQuery}/query</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSkipTraceResults = () => {
    if (!skipTraceData) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Enhanced Skip Trace Results
            <Badge variant="secondary">Skip Tracing Working API</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information:
              </h4>
              {skipTraceData.phones?.length > 0 && (
                <div className="mb-2">
                  <strong>Phones:</strong>
                  {skipTraceData.phones.map((phone: string, index: number) => (
                    <Badge key={index} variant="outline" className="ml-1">
                      {phone}
                    </Badge>
                  ))}
                </div>
              )}
              {skipTraceData.emails?.length > 0 && (
                <div className="mb-2">
                  <strong>Emails:</strong>
                  {skipTraceData.emails.map((email: string, index: number) => (
                    <Badge key={index} variant="outline" className="ml-1">
                      {email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address History:
              </h4>
              {skipTraceData.previousAddresses?.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {skipTraceData.previousAddresses.slice(0, 3).map((addr: string, index: number) => (
                    <li key={index}>{addr}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No previous addresses found</p>
              )}
              <div className="mt-2">
                <Badge variant="outline">Cost: ${skipTraceData.costPerQuery}/query</Badge>
                <Badge variant="outline" className="ml-1">43% cheaper than REISkip</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPeopleData = () => {
    if (!peopleData) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            People Data Lookup Results
            <Badge variant="secondary">People Data Lookup API</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Total Found:</strong> {peopleData.totalFound}</p>
            <p><strong>Cost:</strong> ${peopleData.costPerQuery}/query</p>
            {peopleData.results && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Results:</h4>
                <pre className="bg-muted p-2 rounded text-sm overflow-auto max-h-40">
                  {JSON.stringify(peopleData.results, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {renderCostSavings()}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Enhanced Property Search
            <Badge variant="secondary">RapidAPI Powered</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input
              placeholder="Street Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleEnhancedSearch} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Searching...' : 'Enhanced Search'}
            </Button>
            
            {skipTraceData?.phones?.[0] && (
              <Button
                variant="outline"
                onClick={() => handlePeopleLookup({ phone: skipTraceData.phones[0] })}
              >
                Lookup by Phone
              </Button>
            )}
            
            {skipTraceData?.emails?.[0] && (
              <Button
                variant="outline"
                onClick={() => handlePeopleLookup({ email: skipTraceData.emails[0] })}
              >
                Lookup by Email
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="property" className="space-y-4">
        <TabsList>
          <TabsTrigger value="property">Property Data</TabsTrigger>
          <TabsTrigger value="skiptrace">Skip Trace</TabsTrigger>
          <TabsTrigger value="people">People Lookup</TabsTrigger>
        </TabsList>

        <TabsContent value="property">
          {renderPropertyResults()}
        </TabsContent>

        <TabsContent value="skiptrace">
          {renderSkipTraceResults()}
        </TabsContent>

        <TabsContent value="people">
          {renderPeopleData()}
        </TabsContent>
      </Tabs>
    </div>
  );
}