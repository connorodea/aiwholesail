import React, { useState, useEffect } from 'react';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';

import { Property, PropertySearchParams } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { sortPropertiesByWholesalePotential } from '@/lib/wholesale-calculator';
import { Button } from '@/components/ui/button';
import { Home, User, LogOut, LogIn, Download, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { EnhancedPropertySearch } from '@/components/EnhancedPropertySearch';
import { PropertyAlertsManager } from '@/components/PropertyAlertsManager';
import { SubscriptionPlans } from '@/components/SubscriptionPlans';
import { processPropertyAlerts } from '@/lib/propertyAlerts';

export default function RealEstateWholesaler() {
  const { user, signOut } = useAuth();
  const { favorites } = useFavorites();
  const { exportAllLeads, loading: exportLoading } = useLeads();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
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
    <div className="min-h-screen bg-background">
      {/* Minimal Navigation Header - OpenAI Style */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Simple Brand */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Home className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-medium">AIWholesail</h1>
            </div>
            
            {/* Clean Action Buttons */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Button
                    variant={showFavorites ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setShowFavorites(!showFavorites);
                      setShowAlerts(false);
                    }}
                    className="h-8 px-3 text-sm font-medium"
                  >
                    Favorites {favorites.length > 0 && `(${favorites.length})`}
                  </Button>
                  <Button
                    variant={showAlerts ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setShowAlerts(!showAlerts);
                      setShowFavorites(false);
                    }}
                    className="h-8 px-3 text-sm font-medium"
                  >
                    Alerts
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="h-8 px-3 text-sm font-medium"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => window.location.href = '/auth'}
                  className="h-8 px-4 text-sm font-medium"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Spacious and Clean */}
      <main className="container mx-auto px-6 py-12 space-y-16">
        {showAlerts ? (
          <section>
            <PropertyAlertsManager />
          </section>
        ) : !showFavorites ? (
          <>
            {/* Hero Search Section */}
            <section className="text-center space-y-8 max-w-4xl mx-auto">
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
                  Find profitable wholesale deals
                </h1>
                <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
                  Discover undervalued properties with AI-powered analysis and comprehensive market data
                </p>
              </div>
              
              <div className="bg-card border border-border/50 rounded-2xl p-8">
                <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
              </div>
            </section>


            {/* Results Section */}
            {properties.length > 0 && (
              <section className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-medium">
                      {properties.some(p => p.price && p.zestimate && p.price < p.zestimate) 
                        ? 'Best wholesale deals' 
                        : 'Search results'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
                    </p>
                  </div>
                  
                  {user && properties.length > 0 && (
                    <Button
                      onClick={() => exportAllLeads(properties, lastSearchLocation)}
                      disabled={exportLoading}
                      variant="outline"
                      size="sm"
                      className="gap-2 h-8 text-sm font-medium"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {exportLoading ? 'Exporting...' : 'Export CSV'}
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onViewDetails={() => setSelectedProperty(property)}
                      highlightWholesaleDeals={true}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Clean Error State */}
            {error && (
              <section className="max-w-lg mx-auto">
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 text-center">
                  <p className="text-sm text-destructive mb-4">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setError(null)}
                    className="h-8 text-sm font-medium"
                  >
                    Dismiss
                  </Button>
                </div>
              </section>
            )}
          </>
        ) : (
          /* Clean Favorites Section */
          <section className="space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-medium">Your favorites</h1>
              <p className="text-muted-foreground font-light">
                Properties you've saved for later review
              </p>
            </div>

            {favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    onViewDetails={() => setSelectedProperty(property)}
                    highlightWholesaleDeals={true}
                  />
                ))}
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No favorites yet</h3>
                  <p className="text-sm text-muted-foreground mb-6 font-light">
                    Start exploring properties and save the ones you like
                  </p>
                  <Button 
                    onClick={() => setShowFavorites(false)} 
                    size="sm"
                    className="h-8 text-sm font-medium"
                  >
                    Browse Properties
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Property Modal */}
      <PropertyModal
        property={selectedProperty}
        isOpen={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
    </div>
  );
}