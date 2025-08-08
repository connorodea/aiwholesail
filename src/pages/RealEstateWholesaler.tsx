import React, { useState, useEffect } from 'react';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';

import { Property, PropertySearchParams } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { sortPropertiesByWholesalePotential } from '@/lib/wholesale-calculator';
import { Button } from '@/components/ui/button';
import { Home, User, LogOut, LogIn, Download, Bell, Timer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { EnhancedPropertySearch } from '@/components/EnhancedPropertySearch';
import { PropertyAlertsManager } from '@/components/PropertyAlertsManager';
import { SubscriptionPlans } from '@/components/SubscriptionPlans';
import { processPropertyAlerts } from '@/lib/propertyAlerts';
import { OffMarketSearch } from '@/components/OffMarketSearch';
import { OffMarketPropertyCard } from '@/components/OffMarketPropertyCard';
import { OffMarketAnalyticsDashboard } from '@/components/OffMarketAnalyticsDashboard';
import { offMarketAPI, type OffMarketProperty, type OffMarketSearchParams, type OffMarketSearchResult } from '@/lib/off-market-api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target } from 'lucide-react';

export default function RealEstateWholesaler() {
  const { user, signOut } = useAuth();
  const { subscription, isTrialActive, trialDaysRemaining } = useSubscription();
  const { favorites } = useFavorites();
  const { exportAllLeads, loading: exportLoading } = useLeads();
  const [properties, setProperties] = useState<Property[]>([]);
  const [offMarketProperties, setOffMarketProperties] = useState<OffMarketProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedOffMarketProperty, setSelectedOffMarketProperty] = useState<OffMarketProperty | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffMarketLoading, setIsOffMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offMarketError, setOffMarketError] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'on-market' | 'off-market'>('on-market');
  const [offMarketResults, setOffMarketResults] = useState<OffMarketSearchResult | null>(null);
  const [lastSearchLocation, setLastSearchLocation] = useState<string>('');

  const handleSearch = async (params: PropertySearchParams) => {
    try {
      setIsLoading(true);
      setProperties([]);
      setError(null);
      setLastSearchLocation(params.location);

      toast.success(`Searching for properties in ${params.location}...`);

      // Fetch up to 10 pages for comprehensive results (about 200+ properties)
      const maxPages = params.wholesaleOnly ? 15 : 10;
      const searchResults = await zillowAPI.searchProperties(params, maxPages);
      
      if (searchResults.length === 0) {
        setError("No properties found. Try adjusting your search criteria.");
        return;
      }

      // Filter for wholesale opportunities if requested
      let filteredResults = searchResults;
      if (params.wholesaleOnly) {
        filteredResults = filteredResults.filter(property => {
          // Must have both price and zestimate, and price must be below zestimate
          return property.price && property.zestimate && property.price < property.zestimate;
        });
        
        // If no wholesale deals found but properties exist, inform user
        if (filteredResults.length === 0 && searchResults.length > 0) {
          setError(`Found ${searchResults.length} properties, but none have wholesale potential (price below Zestimate). Try removing the wholesale filter or searching different areas.`);
          return;
        }
        
        // Sort by wholesale potential when wholesale filter is enabled
        filteredResults = sortPropertiesByWholesalePotential(filteredResults);
      }

      // Filter for FSBO properties only if requested
      if (params.fsboOnly) {
        filteredResults = filteredResults.filter(property => property.isFSBO);
      }

      // Filter by keywords if provided
      if (params.keywords && params.keywords.trim()) {
        const keywords = params.keywords.toLowerCase().split(',').map(k => k.trim());
        filteredResults = filteredResults.filter(property => {
          const description = (property.description || '').toLowerCase();
          return keywords.some(keyword => description.includes(keyword));
        });
      }

      if (filteredResults.length === 0) {
        setError("No properties found matching your criteria.");
        return;
      }

      setProperties(filteredResults);
      toast.success(`Found ${filteredResults.length} properties${params.wholesaleOnly ? ' with wholesale potential' : ''}`);

      // Process property alerts if user is authenticated
      if (user && filteredResults.length > 0) {
        try {
          const alertResult = await processPropertyAlerts(params.location, filteredResults);
          if (alertResult.success && alertResult.emailsSent > 0) {
            toast.success(`Found ${alertResult.matches} new opportunities! ${alertResult.emailsSent} email alerts sent.`);
          }
        } catch (alertError) {
          console.error('Error processing property alerts:', alertError);
          // Don't show error to user as this is a background process
        }
      }

    } catch (error) {
      console.error('Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while searching";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOffMarketSearch = async (params: OffMarketSearchParams) => {
    try {
      setIsOffMarketLoading(true);
      setOffMarketProperties([]);
      setOffMarketError(null);
      setOffMarketResults(null);
      setLastSearchLocation(params.location);

      toast.success(`Searching for off-market opportunities in ${params.location}...`);

      const searchResults = await offMarketAPI.searchOffMarketProperties(params);
      
      if (searchResults.properties.length === 0) {
        setOffMarketError("No off-market properties found. Try adjusting your search criteria or enabling more distress indicators.");
        return;
      }

      setOffMarketProperties(searchResults.properties);
      setOffMarketResults(searchResults);
      
      toast.success(
        `Found ${searchResults.properties.length} off-market opportunities! ` +
        `Processed ${searchResults.totalProcessed} properties for $${searchResults.totalCost.toFixed(2)} ` +
        `(${searchResults.savings.savingsPercentage}% savings)`
      );

    } catch (error) {
      console.error('Off-market search failed:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while searching off-market properties";
      setOffMarketError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsOffMarketLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      setShowFavorites(false);
      setShowAlerts(false);
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Minimal Navigation Header - OpenAI Style */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto mobile-padding py-4">
          <div className="flex items-center justify-between">
            {/* Clean Brand Identity */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-glow">
                <Home className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-medium tracking-tight">AIWholesail</h1>
            </div>
            
            {/* Minimal Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Trial Status Indicator */}
              {isTrialActive && trialDaysRemaining !== null && (
                <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {trialDaysRemaining}d trial
                </div>
              )}
              
              {user ? (
                <>
                  <Button
                    variant={showFavorites ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setShowFavorites(!showFavorites);
                      setShowAlerts(false);
                    }}
                    className="h-9 px-3 text-sm font-medium smooth-transition"
                  >
                    Favorites {favorites.length > 0 && <span className="ml-1 text-xs opacity-75">({favorites.length})</span>}
                  </Button>
                  <Button
                    variant={showAlerts ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setShowAlerts(!showAlerts);
                      setShowFavorites(false);
                    }}
                    className="h-9 px-3 text-sm font-medium smooth-transition"
                  >
                    <Bell className="h-3.5 w-3.5 mr-1.5" />
                    Alerts
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="h-9 px-3 text-sm font-medium smooth-transition"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => window.location.href = '/auth'}
                  className="h-9 px-4 text-sm font-medium smooth-transition"
                >
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - OpenAI Clean Layout */}
      <main className="container mx-auto mobile-padding py-16 space-y-20">
        {showAlerts ? (
          <section className="animate-fade-in">
            <PropertyAlertsManager />
          </section>
        ) : !showFavorites ? (
          <>
            {/* Hero Search Section with Tabs */}
            <section className="text-center space-y-10 max-w-6xl mx-auto animate-fade-in">
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">
                  Find profitable wholesale deals
                </h1>
                <p className="text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
                  Discover undervalued properties with AI-powered analysis and comprehensive market data
                </p>
              </div>
              
              <div className="feature-card p-8 backdrop-blur-sm">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'on-market' | 'off-market')} className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto sm:mx-0">
                      <TabsTrigger value="on-market" className="text-sm font-medium">
                        <Target className="h-4 w-4 mr-2" />
                        On-Market
                      </TabsTrigger>
                      <TabsTrigger value="off-market" className="text-sm font-medium">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Off-Market
                        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">95% Savings</Badge>
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* Analytics Button for Off-Market */}
                    {activeTab === 'off-market' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAnalytics(true)}
                        className="gap-2 h-9 px-4 text-sm font-medium"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Analytics
                      </Button>
                    )}
                  </div>
                  
                  <TabsContent value="on-market" className="mt-0">
                    <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
                  </TabsContent>
                  
                  <TabsContent value="off-market" className="mt-0">
                    <OffMarketSearch onSearch={handleOffMarketSearch} isLoading={isOffMarketLoading} />
                  </TabsContent>
                </Tabs>
              </div>
            </section>

            {/* On-Market Results Section */}
            {activeTab === 'on-market' && properties.length > 0 && (
              <section className="space-y-10 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium tracking-tight">
                      {properties.some(p => p.price && p.zestimate && p.price < p.zestimate) 
                        ? 'Best wholesale deals' 
                        : 'On-market results'}
                    </h2>
                    <p className="text-muted-foreground font-light">
                      {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
                    </p>
                  </div>
                  
                  {user && properties.length > 0 && (
                    <Button
                      onClick={() => exportAllLeads(properties, lastSearchLocation)}
                      disabled={exportLoading}
                      variant="outline"
                      size="sm"
                      className="gap-2 h-9 px-4 text-sm font-medium smooth-transition"
                    >
                      <Download className="h-4 w-4" />
                      {exportLoading ? 'Exporting...' : 'Export CSV'}
                    </Button>
                  )}
                </div>
                
                <div className="property-grid">
                  {properties.map((property, index) => (
                    <div 
                      key={property.id}
                      className="animate-fade-in hover-scale"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <PropertyCard
                        property={property}
                        onViewDetails={() => setSelectedProperty(property)}
                        highlightWholesaleDeals={true}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Off-Market Results Section */}
            {activeTab === 'off-market' && offMarketProperties.length > 0 && (
              <section className="space-y-10 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
                      <Target className="h-6 w-6 text-primary" />
                      Off-Market Opportunities
                    </h2>
                    <p className="text-muted-foreground font-light">
                      {offMarketProperties.length} {offMarketProperties.length === 1 ? 'property' : 'properties'} found
                    </p>
                    {offMarketResults && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Processed: {offMarketResults.totalProcessed.toLocaleString()}</span>
                        <span>•</span>
                        <span>Cost: ${offMarketResults.totalCost.toFixed(2)}</span>
                        <span>•</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {offMarketResults.savings.savingsPercentage}% cost savings vs traditional
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {user && offMarketProperties.length > 0 && (
                      <Button
                        onClick={() => {
                          // Convert off-market properties to Property format for export
                          const exportProperties = offMarketProperties.map(prop => ({
                            ...prop,
                            id: prop.id,
                            address: prop.address,
                            city: prop.city,
                            state: prop.state,
                            price: prop.estimatedValue,
                            status: 'OFF_MARKET',
                            // Add other required Property fields with sensible defaults
                            zpid: prop.id,
                            listingType: 'OFF_MARKET',
                            homeType: prop.propertyType,
                            daysOnZillow: 0,
                            isZillowOwned: false,
                            isFSBO: false,
                            hasImage: false,
                            cardsInfo: {},
                            isShowcaseListing: false,
                            shouldHighlight: false,
                            currency: 'USD',
                            country: 'USA',
                            taxHistory: [],
                            priceHistory: [],
                            hdpData: {}
                          }));
                          exportAllLeads(exportProperties as Property[], lastSearchLocation);
                        }}
                        disabled={exportLoading}
                        variant="outline"
                        size="sm"
                        className="gap-2 h-9 px-4 text-sm font-medium smooth-transition"
                      >
                        <Download className="h-4 w-4" />
                        {exportLoading ? 'Exporting...' : 'Export CSV'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAnalytics(true)}
                      className="gap-2 h-9 px-4 text-sm font-medium"
                    >
                      <BarChart3 className="h-4 w-4" />
                      View Analytics
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {offMarketProperties.map((property, index) => (
                    <div 
                      key={property.id}
                      className="animate-fade-in hover-scale"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <OffMarketPropertyCard
                        property={property}
                        onViewDetails={() => setSelectedOffMarketProperty(property)}
                        onContact={() => toast.success(`Contact info: ${property.phones?.[0] || property.emails?.[0] || 'No contact found'}`)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Enhanced Error States */}
            {((activeTab === 'on-market' && error) || (activeTab === 'off-market' && offMarketError)) && (
              <section className="max-w-lg mx-auto animate-scale-in">
                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 text-center feature-card">
                  <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-destructive text-lg">⚠</span>
                  </div>
                  <h3 className="font-medium mb-2">
                    {activeTab === 'on-market' ? 'On-Market Search Error' : 'Off-Market Search Error'}
                  </h3>
                  <p className="text-sm text-destructive mb-6 leading-relaxed">
                    {activeTab === 'on-market' ? error : offMarketError}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (activeTab === 'on-market') {
                        setError(null);
                      } else {
                        setOffMarketError(null);
                      }
                    }}
                    className="h-9 px-4 text-sm font-medium smooth-transition"
                  >
                    Try Again
                  </Button>
                </div>
              </section>
            )}
          </>
        ) : (
          /* Enhanced Favorites Section */
          <section className="space-y-10 animate-fade-in">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Your favorites</h1>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Properties you've saved for later review
              </p>
            </div>

            {favorites.length > 0 ? (
              <div className="property-grid">
                {favorites.map((property, index) => (
                  <div 
                    key={property.id}
                    className="animate-fade-in hover-scale"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <PropertyCard
                      property={property}
                      onViewDetails={() => setSelectedProperty(property)}
                      highlightWholesaleDeals={true}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-md mx-auto animate-scale-in">
                <div className="feature-card p-10 text-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-3 tracking-tight">No favorites yet</h3>
                  <p className="text-muted-foreground mb-8 font-light leading-relaxed">
                    Start exploring properties and save the ones you like for later review
                  </p>
                  <Button 
                    onClick={() => setShowFavorites(false)} 
                    size="sm"
                    className="h-10 px-6 text-sm font-medium smooth-transition"
                  >
                    Browse Properties
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Property Modals */}
      <PropertyModal
        property={selectedProperty}
        isOpen={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
      
      {/* Off-Market Property Modal */}
      {selectedOffMarketProperty && (
        <PropertyModal
          property={selectedOffMarketProperty as any}
          isOpen={!!selectedOffMarketProperty}
          onClose={() => setSelectedOffMarketProperty(null)}
        />
      )}

      {/* Off-Market Analytics Dashboard */}
      <OffMarketAnalyticsDashboard
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />
    </div>
  );
}