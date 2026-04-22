import React, { useState, useEffect, useRef } from 'react';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';

import { Property, PropertySearchParams } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { sortPropertiesByWholesalePotential } from '@/lib/wholesale-calculator';
import { Button } from '@/components/ui/button';
import { Home, User, LogOut, LogIn, Download, Bell, Timer, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { stripe } from '@/lib/api-client';
import { toast } from 'sonner';
import { EnhancedPropertySearch } from '@/components/EnhancedPropertySearch';
import { PropertyAlertsManager } from '@/components/PropertyAlertsManager';
import { SubscriptionPlans } from '@/components/SubscriptionPlans';
import { processPropertyAlerts } from '@/lib/propertyAlerts';
import { AIWholesaleAnalyzer } from '@/components/AIWholesaleAnalyzer';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RealEstateWholesaler() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { subscription, isTrialActive, trialDaysRemaining } = useSubscription();
  const { favorites } = useFavorites();
  const { exportAllLeads, loading: exportLoading } = useLeads();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [lastSearchLocation, setLastSearchLocation] = useState<string>('');
  const [sortBy, setSortBy] = useState<'price-high' | 'price-low' | 'newest' | 'oldest' | 'default'>('default');
  const [isSearchingFSBO, setIsSearchingFSBO] = useState<boolean>(false);
  const searchIdRef = useRef(0);

  // US States lookup
  const US_STATES: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY'
  };
  const STATE_ABBREVIATIONS = Object.values(US_STATES);

  // Check if location is just a state name or abbreviation
  const isStateOnlyLocation = (location: string): boolean => {
    const trimmed = location.trim().toLowerCase();
    // Check full state name
    if (US_STATES[trimmed]) return true;
    // Check abbreviation (2 letters only)
    if (trimmed.length === 2 && STATE_ABBREVIATIONS.includes(trimmed.toUpperCase())) return true;
    // Check "State, United States" format
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length === 2 && (parts[1] === 'united states' || parts[1] === 'usa' || parts[1] === 'us')) {
      if (US_STATES[parts[0]]) return true;
    }
    return false;
  };

  // Check if it's a county search without a state
  const isCountyWithoutState = (location: string): boolean => {
    const trimmed = location.trim().toLowerCase();
    if (!trimmed.includes('county')) return false;

    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Check if any part after the county name is a valid state
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].toLowerCase();
        if (part === 'united states' || part === 'usa' || part === 'us') continue;
        if (US_STATES[part] || STATE_ABBREVIATIONS.includes(parts[i].toUpperCase())) {
          return false; // Has a valid state
        }
      }
    }
    return true; // County without state
  };

  const handleSearch = async (params: PropertySearchParams) => {
    // Validate location - block state-only searches
    if (isStateOnlyLocation(params.location)) {
      setError("State-wide searches are not supported. Please enter a specific city (e.g., 'Detroit, MI'), ZIP code, or county name with state.");
      toast.error("Please enter a city, ZIP code, or county with state - state-wide searches are not supported.");
      return;
    }

    // Validate county searches have a state
    if (isCountyWithoutState(params.location)) {
      setError("Please include a state with county searches. Example: 'Oakland County, MI' or 'Oakland County, Michigan'");
      toast.error("Please add a state to your county search (e.g., 'Oakland County, MI')");
      return;
    }

    // Increment search ID to prevent stale enrichment overwrites
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;

    try {
      setIsLoading(true);
      setLoadingStatus(`Searching for properties in ${params.location}...`);
      setLoadingProgress(20);
      setProperties([]);
      setError(null);
      setLastSearchLocation(params.location);
      setIsSearchingFSBO(params.fsboOnly || false);

      // Step 1: Fetch all pages
      const searchResults = await zillowAPI.searchProperties(params, 20);

      if (searchResults.length === 0) {
        setError("No properties found. Try adjusting your search criteria.");
        return;
      }

      // Step 2: Show results immediately
      let results = searchResults;

      // Apply keyword filter if provided
      if (params.keywords?.trim()) {
        const keywords = params.keywords.toLowerCase().split(',').map(k => k.trim());
        results = results.filter(p => {
          const desc = (p.description || '').toLowerCase();
          return keywords.some(kw => desc.includes(kw));
        });
      }

      // Apply FSBO filter
      if (params.fsboOnly && results.length === 0) {
        setError("No FSBO properties found. Try a different location.");
        return;
      }

      const sorted = sortPropertiesByWholesalePotential(results);
      setProperties(sorted);
      setIsLoading(false);
      setLoadingProgress(0);
      setLoadingStatus('');
      toast.success(`Found ${sorted.length} properties. Fetching Zestimates...`);

      // Step 3: Enrich with zestimates in background (progressive updates)
      try {
        console.log('[AIWholesail] Starting zestimate enrichment for', results.length, 'properties (capped at 50)');

        const enriched = await zillowAPI.enrichWithZestimates(
          results,
          (completed, total) => {
            toast.info(`Zestimates: ${completed}/${total} checked`);
          },
          // Progressive: update UI after each chunk so deals appear immediately
          (partiallyEnriched) => {
            if (currentSearchId !== searchIdRef.current) return;
            const sorted = sortPropertiesByWholesalePotential(partiallyEnriched);
            setProperties(sorted);
          }
        );

        if (currentSearchId !== searchIdRef.current) {
          console.log('[AIWholesail] Discarding stale enrichment results');
          return;
        }

        let enrichedSorted = sortPropertiesByWholesalePotential(enriched);

        if (params.wholesaleOnly) {
          const deals = enrichedSorted.filter(p => p.price && p.zestimate && p.price < p.zestimate);
          if (deals.length > 0) enrichedSorted = deals;
        }

        setProperties(enrichedSorted);

        const dealCount = enrichedSorted.filter(p => p.price && p.zestimate && p.zestimate > p.price).length;
        const withZest = enrichedSorted.filter(p => p.zestimate).length;
        toast.success(`Done! ${dealCount} deals below market value (${withZest}/${enrichedSorted.length} Zestimates found)`);
      } catch (enrichError) {
        console.warn('Enrichment failed:', enrichError);
        toast.error('Zestimate enrichment failed. Showing results without spread data.');
      }

    } catch (error) {
      console.error('Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while searching";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
      setLoadingStatus('');
    }
  };


  const handleSignOut = async () => {
    try {
      await signOut();
      setShowFavorites(false);
      setShowAlerts(false);
      
      // Wait a brief moment for the auth state to clear, then redirect
      setTimeout(() => {
        navigate('/');
        toast.success('Signed out successfully');
      }, 100);
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
                    onClick={async () => {
                      try {
                        const response = await stripe.createPortal();
                        if (response.error) throw new Error(response.error);
                        window.open(response.data?.url, '_blank');
                      } catch (error) {
                        console.error('Error opening customer portal:', error);
                        toast.error('Failed to open subscription portal');
                      }
                    }}
                    className="h-9 px-3 text-sm font-medium transition-colors"
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    Manage
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
            {/* Hero Search Section */}
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
                <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
              </div>
            </section>

            {/* Loading Progress Bar */}
            {isLoading && (
              <section className="max-w-2xl mx-auto animate-fade-in">
                <div className="feature-card p-8 backdrop-blur-sm rounded-2xl">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <p className="text-sm font-medium text-foreground">{loadingStatus}</p>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {loadingProgress < 50 ? 'Fetching listings from Zillow...' :
                       loadingProgress < 90 ? 'Fetching Zestimates to calculate wholesale spreads...' :
                       'Almost done...'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Results Section */}
            {!isLoading && properties.length > 0 && (
              <section className="space-y-10 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium tracking-tight">
                      {properties.some(p => p.price && p.zestimate && p.price < p.zestimate) 
                        ? 'Best wholesale deals' 
                        : 'Search results'}
                    </h2>
                    <p className="text-muted-foreground font-light">
                      {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
                    </p>
                  </div>
                  
                  {user && properties.length > 0 && (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-9 px-4 text-sm font-medium smooth-transition"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                            Sort by
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setSortBy('default')}>
                            Best Spreads First
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('price-low')}>
                            Price: Low to High
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('price-high')}>
                            Price: High to Low
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('newest')}>
                            Newest on Market
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                            Oldest on Market
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
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
                    </div>
                  )}
                </div>
                
                <div className="property-grid">
                  {[...properties].sort((a, b) => {
                    switch (sortBy) {
                      case 'price-high':
                        return (b.price || 0) - (a.price || 0);
                      case 'price-low':
                        return (a.price || 0) - (b.price || 0);
                      case 'newest':
                        return (a.daysOnMarket || 0) - (b.daysOnMarket || 0);
                      case 'oldest':
                        return (b.daysOnMarket || 0) - (a.daysOnMarket || 0);
                      default:
                        // Default sorting: highest spreads first, prioritizing High-Value Wholesale Deals
                        const getSpread = (property: any) => {
                          if (!property.price || !property.zestimate) return -Infinity;
                          return property.zestimate - property.price;
                        };
                        
                        const getIsHighValue = (property: any) => {
                          const spread = getSpread(property);
                          return spread >= 35000;
                        };
                        
                        const aSpread = getSpread(a);
                        const bSpread = getSpread(b);
                        const aIsHighValue = getIsHighValue(a);
                        const bIsHighValue = getIsHighValue(b);
                        
                        // First, prioritize High-Value Wholesale Deals
                        if (aIsHighValue && !bIsHighValue) return -1;
                        if (!aIsHighValue && bIsHighValue) return 1;
                        
                        // Then sort by spread (highest to lowest)
                        return bSpread - aSpread;
                    }
                  }).map((property, index) => (
                    <div 
                      key={property.id}
                      className="animate-fade-in hover-scale"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <PropertyCard
                        property={property}
                        onViewDetails={() => setSelectedProperty(property)}
                        highlightWholesaleDeals={true}
                        showFSBOBadge={isSearchingFSBO}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Enhanced Error States */}
            {error && (
              <section className="max-w-lg mx-auto animate-scale-in">
                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 text-center feature-card">
                  <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-destructive text-lg">⚠</span>
                  </div>
                  <h3 className="font-medium mb-2">Search Error</h3>
                  <p className="text-sm text-destructive mb-6 leading-relaxed">
                    {error}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setError(null)}
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
      
    </div>
  );
}