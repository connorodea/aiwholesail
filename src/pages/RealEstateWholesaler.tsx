import { useState } from 'react';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';
import { AIAnalysisPanel } from '@/components/AIAnalysisPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Property, PropertySearchParams, AIAnalysis } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { aiAnalyzer } from '@/lib/ai-analyzer';
import { Brain, Home, Download, Zap, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

export default function RealEstateWholesaler() {
  console.log('RealEstateWholesaler component is rendering');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const { toast } = useToast();

  const testAPIConnection = async () => {
    try {
      setIsLoading(true);
      const connected = await zillowAPI.testConnection();
      setIsConnected(connected);
      
      if (connected) {
        toast({
          title: "API Connected",
          description: "Successfully connected to Zillow API",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to Zillow API. Please check your connection.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
      toast({
        title: "Connection Error",
        description: "Failed to test API connection",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (params: PropertySearchParams) => {
    try {
      setIsLoading(true);
      setProperties([]);
      setAnalysis(null);

      toast({
        title: "Searching Properties",
        description: `Looking for properties in ${params.location}...`,
      });

      const searchResults = await zillowAPI.searchProperties(params);
      
      if (searchResults.length === 0) {
        toast({
          title: "No Properties Found",
          description: "Try adjusting your search criteria or location",
          variant: "destructive"
        });
        return;
      }

      // Filter for wholesale opportunities and keywords
      let filteredResults = searchResults;
      
      // Filter by wholesale opportunities (price < zestimate)
      if (params.wholesaleOnly) {
        filteredResults = filteredResults.filter(property => {
          return property.price && property.zestimate && property.price < property.zestimate;
        });
      }

      // Filter by keywords in description
      if (params.keywords && params.keywords.trim()) {
        const keywords = params.keywords.toLowerCase().split(',').map(k => k.trim());
        filteredResults = filteredResults.filter(property => {
          const description = (property.description || '').toLowerCase();
          return keywords.some(keyword => description.includes(keyword));
        });
      }

      if (filteredResults.length === 0) {
        let message = "No properties found matching your criteria.";
        if (params.wholesaleOnly && params.keywords) {
          message = "No properties found with wholesale opportunities and matching keywords.";
        } else if (params.wholesaleOnly) {
          message = "No properties found priced below Zestimate.";
        } else if (params.keywords) {
          message = "No properties found with the specified keywords.";
        }
        
        toast({
          title: "No Results Found",
          description: message,
          variant: "destructive"
        });
        return;
      }

      setProperties(filteredResults);
      
      // Generate AI analysis
      const aiAnalysis = aiAnalyzer.analyzeProperties(filteredResults);
      setAnalysis(aiAnalysis);

      toast({
        title: "Search Complete",
        description: params.wholesaleOnly 
          ? `Found ${filteredResults.length} wholesale opportunities out of ${searchResults.length} total properties`
          : `Found ${filteredResults.length} properties with AI analysis`,
      });

    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "An error occurred while searching",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (property: Property) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const exportResults = () => {
    if (properties.length === 0) return;

    const csvContent = [
      // CSV headers
      ['Address', 'Price', 'Bedrooms', 'Bathrooms', 'Sqft', 'Property Type', 'Days on Market', 'Status'].join(','),
      // CSV data
      ...properties.map(property => [
        `"${property.address}"`,
        property.price || '',
        property.bedrooms || '',
        property.bathrooms || '',
        property.sqft || '',
        `"${property.propertyType || ''}"`,
        property.daysOnMarket || '',
        `"${property.status}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `properties_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Properties exported to CSV file",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Home className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI Real Estate Wholesaler
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find and analyze wholesale real estate opportunities using AI-powered market insights
          </p>
          
          {/* API Status */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              {isConnected === null ? (
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              ) : isConnected ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm">
                API Status: {isConnected === null ? 'Unknown' : isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testAPIConnection}
              disabled={isLoading}
            >
              <Zap className="h-4 w-4 mr-1" />
              Test Connection
            </Button>
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-8">
          <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Results Section */}
        {(properties.length > 0 || analysis) && (
          <Tabs defaultValue="properties" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="properties" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Home className="h-4 w-4 mr-2" />
                  Properties ({properties.length})
                </TabsTrigger>
                <TabsTrigger value="analysis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Brain className="h-4 w-4 mr-2" />
                  AI Analysis
                </TabsTrigger>
              </TabsList>

              {properties.length > 0 && (
                <Button onClick={exportResults} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>

            <TabsContent value="properties" className="space-y-6">
              {properties.length > 0 ? (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Properties</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">{properties.length}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Price</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">
                          {properties.filter(p => p.price).length > 0 
                            ? `$${Math.round(properties.filter(p => p.price).reduce((sum, p) => sum + (p.price || 0), 0) / properties.filter(p => p.price).length).toLocaleString()}`
                            : 'N/A'
                          }
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Below Market</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-success">
                          {properties.filter(p => p.price && p.zestimate && p.price < p.zestimate).length}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Long on Market</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-warning">
                          {properties.filter(p => p.daysOnMarket && p.daysOnMarket > 60).length}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Property Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Home className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Properties Found</h3>
                    <p className="text-muted-foreground text-center">
                      Start by searching for properties in your target area using the search form above.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              {analysis ? (
                <AIAnalysisPanel analysis={analysis} />
              ) : (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Brain className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Analysis Available</h3>
                    <p className="text-muted-foreground text-center">
                      Search for properties first to generate AI-powered market analysis and insights.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Property Details Modal */}
        <PropertyModal
          property={selectedProperty}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  );
}