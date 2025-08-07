import React, { useState, useEffect } from 'react';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';

import { Property, PropertySearchParams } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { sortPropertiesByWholesalePotential } from '@/lib/wholesale-calculator';
import { Button } from '@/components/ui/button';
import { Home, User, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';

export default function RealEstateWholesaler() {
  const { user, signOut } = useAuth();
  const { favorites } = useFavorites();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);

  const handleSearch = async (params: PropertySearchParams) => {
    try {
      setIsLoading(true);
      setProperties([]);
      setError(null);

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
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Navigation Header */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Brand Section */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm">
                  <Home className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Wholesaler</h1>
                <p className="text-xs text-muted-foreground">Find profitable deals</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Button
                    variant={showFavorites ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowFavorites(!showFavorites)}
                    className="h-9 px-3 rounded-lg transition-all duration-200"
                  >
                    <User className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Favorites</span>
                    <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-md">
                      {favorites.length}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="h-9 px-3 rounded-lg"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">Sign Out</span>
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => window.location.href = '/auth'}
                  className="h-9 px-4 rounded-lg"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="container mx-auto px-6 py-8 space-y-8">
        {!showFavorites ? (
          <>
            {/* Search Section */}
            <section className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Find Your Next Deal</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Discover profitable wholesale opportunities with advanced search filters and AI-powered analysis
                </p>
              </div>
              
              <div className="max-w-4xl mx-auto">
                <div className="simple-card p-6">
                  <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
                </div>
              </div>
            </section>

            {/* Results Section */}
            {properties.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {properties.some(p => p.price && p.zestimate && p.price < p.zestimate) 
                        ? 'Best Wholesale Deals' 
                        : 'Search Results'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
                    </p>
                  </div>
                </div>
                
                <div className="property-grid">
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

            {/* Error State */}
            {error && (
              <section className="max-w-2xl mx-auto">
                <div className="simple-card p-6 text-center border-destructive/20 bg-destructive/5">
                  <div className="space-y-3">
                    <p className="text-destructive text-sm">{error}</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setError(null)}
                      className="h-8"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          /* Favorites Section */
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Your Favorites</h2>
              <p className="text-muted-foreground">
                Properties you've saved for later review
              </p>
            </div>

            {favorites.length > 0 ? (
              <div className="property-grid">
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
                <div className="simple-card p-8 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">No favorites yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start exploring properties and save the ones you like!
                  </p>
                  <Button onClick={() => setShowFavorites(false)} size="sm">
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