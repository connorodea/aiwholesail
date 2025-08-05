import { useState } from 'react';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';
import { AIAnalysisPanel } from '@/components/AIAnalysisPanel';
import { TopDealsSection } from '@/components/TopDealsSection';
import { DealAnalysisPanel } from '@/components/DealAnalysisPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Property, PropertySearchParams, AIAnalysis } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { AttomAPI } from '@/lib/attom-api';
import { aiAnalyzer } from '@/lib/ai-analyzer';
import { Brain, Home, Download, Zap, TrendingUp, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

export default function RealEstateWholesaler() {
  console.log('RealEstateWholesaler component is rendering');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [attomConnected, setAttomConnected] = useState<boolean | null>(null);
  const { toast } = useToast();
  
  // Initialize APIs
  const attomAPI = new AttomAPI();

  const testAPIConnection = async () => {
    try {
      setIsLoading(true);
      
      // Test both APIs
      const [zillowConnected, attomConnectedResult] = await Promise.allSettled([
        zillowAPI.testConnection(),
        attomAPI.testConnection()
      ]);
      
      const zillowStatus = zillowConnected.status === 'fulfilled' ? zillowConnected.value : false;
      const attomStatus = attomConnectedResult.status === 'fulfilled' ? attomConnectedResult.value : false;
      
      setIsConnected(zillowStatus);
      setAttomConnected(attomStatus);
      
      if (zillowStatus && attomStatus) {
        toast({
          title: "APIs Connected",
          description: "Successfully connected to both Zillow and AttomData APIs",
        });
      } else if (zillowStatus) {
        toast({
          title: "Partial Connection",
          description: "Connected to Zillow API. AttomData connection failed.",
          variant: "destructive"
        });
      } else if (attomStatus) {
        toast({
          title: "Partial Connection", 
          description: "Connected to AttomData API. Zillow connection failed.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to either API. Please check your connection.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
      setAttomConnected(false);
      toast({
        title: "Connection Error",
        description: "Failed to test API connections",
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
        description: `Looking for properties in ${params.location} (fetching multiple pages)... This may take a moment.`,
      });

      // Fetch up to 5 pages for more comprehensive results
      const maxPages = params.wholesaleOnly ? 5 : 3; // More pages for wholesale searches
      const searchResults = await zillowAPI.searchProperties(params, maxPages);
      
      if (searchResults.length === 0) {
        toast({
          title: "No Properties Found",
          description: "Try adjusting your search criteria or location",
          variant: "destructive"
        });
        return;
      }

      // Enhance properties with AttomData 
      // If wholesale filter is on, enhance ALL properties to get AVM data for comparison
      // Otherwise, enhance first 20 for performance
      const shouldEnhanceAll = params.wholesaleOnly;
      const propertiesForEnhancement = shouldEnhanceAll ? searchResults : searchResults.slice(0, Math.min(20, searchResults.length));
      
      toast({
        title: "Enhancing Data",
        description: shouldEnhanceAll 
          ? "Getting AttomData for all properties to identify wholesale opportunities..." 
          : "Getting additional property data from AttomData...",
      });

      const enhancedResults = await Promise.allSettled(
        propertiesForEnhancement.map(async (property, index) => {
          try {
            // Show progress for large batches
            if (shouldEnhanceAll && index % 10 === 0) {
              console.log(`Enhanced ${index + 1} of ${propertiesForEnhancement.length} properties`);
            }
            
            // Get enhanced AttomData for each property
            const attomData = await attomAPI.getEnhancedPropertyData(property.address);
            
            // Merge AttomData with existing property data
            return { 
              ...property, 
              attomData,
              // Update core fields if AttomData provides better info
              yearBuilt: attomData.yearBuilt || property.yearBuilt,
              sqft: attomData.livingAreaSqFt || property.sqft,
              lotSize: attomData.lotSizeAcres ? attomData.lotSizeAcres * 43560 : property.lotSize, // Convert acres to sqft
            };
          } catch (error) {
            console.error(`Failed to enhance property ${property.address}:`, error);
            return property;
          }
        })
      );

      // Combine enhanced and remaining properties
      const enhancedProperties = enhancedResults.map(result => 
        result.status === 'fulfilled' ? result.value : propertiesForEnhancement[enhancedResults.indexOf(result)]
      );
      
      const finalResults = shouldEnhanceAll 
        ? enhancedProperties  // All properties enhanced
        : [
            ...enhancedProperties,
            ...searchResults.slice(Math.min(20, searchResults.length))
          ];

      // Filter for wholesale opportunities, auctions, and keywords
      let filteredResults = finalResults;
      
      // Filter by wholesale opportunities (price < zestimate OR price < AVM)
      if (params.wholesaleOnly) {
        filteredResults = filteredResults.filter(property => {
          const priceVsZestimate = property.price && property.zestimate && property.price < property.zestimate;
          const priceVsAVM = property.price && property.attomData?.avm?.amount && property.price < property.attomData.avm.amount;
          return priceVsZestimate || priceVsAVM;
        });
      }

      // Filter out auction properties
      if (params.auctionOnly) {
        filteredResults = filteredResults.filter(property => {
          const description = (property.description || '').toLowerCase();
          const listingType = (property.listingSubType?.description || '').toLowerCase();
          return !description.includes('auction') && 
                 !description.includes('foreclosure') &&
                 !description.includes('sheriff') &&
                 !listingType.includes('auction') &&
                 !property.listingSubType?.description?.includes('Auction');
        });
      }

      // Filter for FSBO properties only
      if (params.fsboOnly) {
        filteredResults = filteredResults.filter(property => property.isFSBO);
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
        if (params.wholesaleOnly && params.auctionOnly && params.keywords) {
          message = "No properties found with wholesale opportunities, auction properties, and matching keywords.";
        } else if (params.wholesaleOnly && params.auctionOnly) {
          message = "No properties found with both wholesale opportunities and auction properties.";
        } else if (params.wholesaleOnly && params.keywords) {
          message = "No properties found with wholesale opportunities and matching keywords.";
        } else if (params.auctionOnly && params.keywords) {
          message = "No auction properties found with matching keywords.";
        } else if (params.wholesaleOnly) {
          message = "No properties found priced below Zestimate.";
        } else if (params.auctionOnly) {
          message = "No auction properties found.";
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
            ? `Found ${filteredResults.length} wholesale opportunities out of ${searchResults.length} total properties (enhanced with AttomData)`
            : `Found ${filteredResults.length} properties with AI analysis and AttomData enhancement`,
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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl border border-primary/20">
              <Home className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold gradient-text mb-2">
                AI Real Estate Wholesaler
              </h1>
              <div className="h-1 w-24 bg-gradient-to-r from-primary to-accent rounded-full mx-auto"></div>
            </div>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Discover profitable wholesale opportunities with AI-powered market analysis, 
            enhanced property data, and automated deal scoring
          </p>
          
          {/* API Status */}
          <div className="flex items-center justify-center gap-8 mt-8 p-4 glass-card rounded-2xl max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              {isConnected === null ? (
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              ) : isConnected ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="font-medium">
                Zillow API: {isConnected === null ? 'Unknown' : isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {attomConnected === null ? (
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              ) : attomConnected ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="font-medium">
                AttomData API: {attomConnected === null ? 'Unknown' : attomConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <Button
              variant="default"
              size="sm"
              onClick={testAPIConnection}
              disabled={isLoading}
              className=""
            >
              <Zap className="h-4 w-4 mr-2" />
              Test APIs
            </Button>
          </div>
        </div>

        {/* Top Deals Section - now removed from here, moved to tab */}

        {/* Search Section */}
        <div className="mb-12">
          <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Results Section - Always show tabs, even if no properties searched yet */}
        <Tabs defaultValue="top-deals" className="space-y-8">
          <div className="flex items-center justify-between">
            <TabsList className="glass-card p-1.5 h-auto">
              <TabsTrigger value="top-deals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 py-3 font-medium smooth-hover">
                <TrendingUp className="h-4 w-4 mr-2" />
                🔥 Top Deals
              </TabsTrigger>
              <TabsTrigger value="properties" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 py-3 font-medium smooth-hover">
                <Home className="h-4 w-4 mr-2" />
                Properties ({properties.length})
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 py-3 font-medium smooth-hover">
                <Brain className="h-4 w-4 mr-2" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="deal-analysis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-6 py-3 font-medium smooth-hover">
                <TrendingUp className="h-4 w-4 mr-2" />
                Deal Analysis
              </TabsTrigger>
            </TabsList>

            {properties.length > 0 && (
              <Button onClick={exportResults} variant="outline" size="lg" className="shadow-md">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>

          <TabsContent value="top-deals" className="space-y-6">
            <TopDealsSection />
          </TabsContent>

            <TabsContent value="properties" className="space-y-6">
              {properties.length > 0 ? (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card className="glass-card border-0 shadow-card smooth-hover hover:shadow-elegant">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Home className="h-4 w-4 text-primary" />
                          Total Properties
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold gradient-text">{properties.length}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="glass-card border-0 shadow-card smooth-hover hover:shadow-elegant">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          Avg Price
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold gradient-text">
                          {properties.filter(p => p.price).length > 0 
                            ? `$${Math.round(properties.filter(p => p.price).reduce((sum, p) => sum + (p.price || 0), 0) / properties.filter(p => p.price).length).toLocaleString()}`
                            : 'N/A'
                          }
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass-card border-0 shadow-card smooth-hover hover:shadow-elegant">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-success" />
                          Below Market
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-success">
                          {properties.filter(p => p.price && p.zestimate && p.price < p.zestimate).length}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass-card border-0 shadow-card smooth-hover hover:shadow-elegant">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-warning" />
                          Long on Market
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-warning">
                          {properties.filter(p => p.daysOnMarket && p.daysOnMarket > 60).length}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Property Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

            <TabsContent value="deal-analysis" className="space-y-6">
              <DealAnalysisPanel />
            </TabsContent>
          </Tabs>

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