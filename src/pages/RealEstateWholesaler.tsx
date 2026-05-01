import React, { useState, useEffect, useRef } from 'react';
import { analytics } from '@/lib/analytics';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';

import { Property, PropertySearchParams } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { sortPropertiesByWholesalePotential } from '@/lib/wholesale-calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Download, Bell, MessageSquare } from 'lucide-react';
import { communications } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { PropertyAlertsManager } from '@/components/PropertyAlertsManager';
import { AIWholesaleAnalyzer } from '@/components/AIWholesaleAnalyzer';
import { PropDataMarketPanel } from '@/components/PropDataMarketPanel';
import { PropDataPropertySearch } from '@/components/PropDataPropertySearch';
import { DashboardNav } from '@/components/DashboardNav';
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const { exportAllLeads, loading: exportLoading } = useLeads();
  const { tier, isElite, isSubscribed } = useSubscription();
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
  const [searchMode, setSearchMode] = useState<'on-market' | 'off-market'>('on-market');
  const [showSmsAlert, setShowSmsAlert] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
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
    // Track search event
    analytics.propertySearch(params.location, { propertyType: params.homeType, minPrice: params.price_min, maxPrice: params.price_max });

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

      // Step 1: Fetch pages — more for state-wide searches to find deals
      const isStateSearch = isStateOnlyLocation(params.location);
      const maxPages = isStateSearch ? 10 : 5;

      if (isStateSearch) {
        setLoadingStatus(`State-wide search: fetching properties across ${params.location}... This may take a minute.`);
      }

      const searchResults = await zillowAPI.searchProperties(params, maxPages, (loaded, total, count) => {
        const pct = Math.round((loaded / total) * 60) + 20; // 20-80% range for search
        setLoadingProgress(pct);
        setLoadingStatus(`Fetching page ${loaded}/${total} — ${count} properties found so far...`);
      });

      if (searchResults.length === 0) {
        setError("No properties found. Try adjusting your search criteria.");
        return;
      }

      // Step 2: Filter out properties with no price (can't calculate spreads)
      let results = searchResults.filter(p => p.price && p.price > 0);

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
      setLoadingProgress(80);
      setLoadingStatus(`Found ${sorted.length} properties. Now calculating spreads...`);
      setIsLoading(false); // Hide the blocking loader, show results while enriching

      // Step 3: Enrich with zestimates to calculate spreads
      try {
        console.log('[AIWholesail] Starting zestimate enrichment for', results.length, 'properties');

        const enriched = await zillowAPI.enrichWithZestimates(
          results,
          (completed, total) => {
            const pct = Math.round((completed / total) * 20) + 80; // 80-100% range
            setLoadingProgress(pct);
            setLoadingStatus(`Calculating spreads: ${completed}/${total} Zestimates checked...`);
          },
          // Progressive: re-sort after each chunk so $30K+ deals bubble to top immediately
          (partiallyEnriched) => {
            if (currentSearchId !== searchIdRef.current) return;
            const sorted = sortPropertiesByWholesalePotential(partiallyEnriched);
            setProperties(sorted);
            // Log deals found so far
            const dealsFound = sorted.filter(p => p.zestimate && p.price && (p.zestimate - p.price) >= 30000).length;
            if (dealsFound > 0) {
              toast.success(`${dealsFound} deal${dealsFound > 1 ? 's' : ''} with +$30K spread found so far!`);
            }
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

        // Cache results for the AI Analyzer tab
        try {
          sessionStorage.setItem('aiw_search_results', JSON.stringify(enrichedSorted));
          sessionStorage.setItem('aiw_search_location', params.location);
        } catch {}

        const bigDeals = enrichedSorted.filter(p => p.price && p.zestimate && (p.zestimate - p.price) >= 30000).length;
        const allPositive = enrichedSorted.filter(p => p.price && p.zestimate && p.zestimate > p.price).length;
        const withZest = enrichedSorted.filter(p => p.zestimate).length;

        // Clear progress bar
        setLoadingProgress(0);
        setLoadingStatus('');

        if (bigDeals > 0) {
          toast.success(`Found ${bigDeals} properties with +$30K spreads! (${allPositive} total below market, ${withZest} Zestimates checked)`);
        } else if (allPositive > 0) {
          toast.info(`${allPositive} properties below market value, but none with +$30K spreads yet. Try a different area.`);
        } else {
          toast.info(`No deals found in this area — all ${withZest} properties are at or above Zestimate. Try a different location.`);
        }
      } catch (enrichError) {
        console.warn('Enrichment failed:', enrichError);
        setLoadingProgress(0);
        setLoadingStatus('');
        toast.error('Zestimate enrichment failed. Showing results without spread data.');
      }

    } catch (error) {
      console.error('Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while searching";

      // Check for subscription-related errors
      if (errorMessage.includes('search limit') || errorMessage.includes('SEARCH_LIMIT_REACHED')) {
        toast.error('Daily search limit reached. Upgrade to Elite for unlimited searches.', {
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/pricing'),
          },
        });
      } else if (errorMessage.includes('SUBSCRIPTION_REQUIRED') || errorMessage.includes('Subscription required')) {
        toast.error('A subscription is required to search properties. Start your free trial today.', {
          action: {
            label: 'View Plans',
            onClick: () => navigate('/pricing'),
          },
        });
      } else {
        toast.error(errorMessage);
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
      setLoadingStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />

      {/* Main Content */}
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-20">
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
                  Find profitable real estate deals
                </h1>
                <p className="text-xl text-neutral-400 font-light max-w-2xl mx-auto leading-relaxed">
                  Discover undervalued properties with AI-powered analysis and comprehensive market data
                </p>
              </div>

              {/* Property Search */}
              <div className="feature-card p-8 backdrop-blur-sm">
                <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
              </div>
            </section>

            {/* Loading Animation — visible during search AND enrichment */}
            {(isLoading || loadingProgress > 0) && (
              <section className="max-w-xl mx-auto animate-fade-in">
                <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#0c0d0f] p-8 sm:p-12">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-cyan-500/10" style={{ animation: 'loadingGlow 3s ease-in-out infinite alternate' }} />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />
                  </div>

                  <div className="relative z-10 space-y-8">
                    {/* Animated house icon */}
                    <div className="flex justify-center">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center" style={{ animation: 'breathe 2s ease-in-out infinite' }}>
                          <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                          </svg>
                        </div>
                        {/* Orbiting dots */}
                        {[0, 1, 2].map(i => (
                          <div key={i} className="absolute w-2 h-2 rounded-full bg-cyan-400" style={{
                            animation: `orbit 2.5s linear infinite`,
                            animationDelay: `${i * 0.83}s`,
                            top: '50%', left: '50%',
                            transformOrigin: '0 0',
                          }} />
                        ))}
                      </div>
                    </div>

                    {/* Status text */}
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-semibold text-white tracking-tight">
                        {loadingProgress <= 20 ? 'Scanning the market' :
                         loadingProgress <= 50 ? 'Pulling property data' :
                         loadingProgress <= 80 ? 'Analyzing listings' :
                         loadingProgress < 95 ? 'Calculating spreads' :
                         'Finalizing results'}
                      </h3>
                      <p className="text-sm text-neutral-400 min-h-[20px]">
                        {loadingStatus}
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-3">
                      <div className="relative w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${loadingProgress}%`,
                            background: 'linear-gradient(90deg, #06b6d4, #22d3ee, #06b6d4)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s linear infinite',
                            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-cyan-400/80">{Math.round(loadingProgress)}%</span>
                        <span className="text-xs text-neutral-500">
                          {loadingProgress <= 80 ? 'Searching properties' : 'Calculating spreads'}
                        </span>
                      </div>
                    </div>

                    {/* Animated step indicators */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Search', threshold: 0 },
                        { label: 'Fetch', threshold: 25 },
                        { label: 'Analyze', threshold: 60 },
                        { label: 'Score', threshold: 85 },
                      ].map((step, i) => (
                        <div key={i} className="text-center">
                          <div className={`w-full h-1 rounded-full mb-1.5 transition-all duration-500 ${
                            loadingProgress >= step.threshold ? 'bg-cyan-400' : 'bg-white/[0.06]'
                          }`} />
                          <span className={`text-[10px] font-medium transition-colors duration-300 ${
                            loadingProgress >= step.threshold ? 'text-cyan-400' : 'text-neutral-600'
                          }`}>{step.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Tip */}
                    <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
                      {loadingProgress <= 50
                        ? 'Properties will appear as they load. Deals with +$30K spreads sort to the top.'
                        : 'Comparing each listing price against its Zestimate to find profitable spreads.'}
                    </p>
                  </div>
                </div>

                <style>{`
                  @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                  @keyframes breathe {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                  }
                  @keyframes orbit {
                    0% { transform: rotate(0deg) translateX(44px) rotate(0deg); opacity: 0.8; }
                    50% { opacity: 0.3; }
                    100% { transform: rotate(360deg) translateX(44px) rotate(-360deg); opacity: 0.8; }
                  }
                  @keyframes loadingGlow {
                    0% { opacity: 0.15; }
                    100% { opacity: 0.35; }
                  }
                  @keyframes scanLine {
                    0% { transform: translateX(-50%) translateY(0); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateX(-50%) translateY(400px); opacity: 0; }
                  }
                `}</style>
              </section>
            )}

            {/* Results Section */}
            {!isLoading && properties.length > 0 && (
              <section className="space-y-10 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium tracking-tight">
                      {properties.some(p => p.price && p.zestimate && p.price < p.zestimate) 
                        ? 'Best deals found'
                        : 'Search results'}
                    </h2>
                    <p className="text-neutral-400 font-light">
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

                      {/* SMS Alert for deals */}
                      {properties.some(p => p.price && p.zestimate && (p.zestimate - p.price) >= 30000) && (
                        <Button
                          onClick={() => setShowSmsAlert(!showSmsAlert)}
                          variant={showSmsAlert ? 'default' : 'outline'}
                          size="sm"
                          className="gap-2 h-9 px-4 text-sm font-medium smooth-transition"
                        >
                          <MessageSquare className="h-4 w-4" />
                          SMS Alert
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* SMS Alert Input */}
                {showSmsAlert && (
                  <div className="flex items-center gap-3 p-4 bg-white/[0.02] rounded-xl border border-border">
                    <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
                    <Input
                      placeholder="Your phone number (e.g., +1234567890)"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      className="max-w-xs bg-background"
                    />
                    <Button
                      size="sm"
                      disabled={sendingSms || !smsPhone.trim()}
                      onClick={async () => {
                        const deals = properties.filter(p => p.price && p.zestimate && (p.zestimate - p.price) >= 30000);
                        if (deals.length === 0) return;
                        setSendingSms(true);
                        try {
                          const response = await communications.sendSpreadAlert(
                            deals.map(d => ({ address: d.address, price: d.price, zestimate: d.zestimate })),
                            lastSearchLocation,
                            smsPhone
                          );
                          if ((response as any).error) throw new Error((response as any).error);
                          toast.success(`SMS alert sent with ${deals.length} deals!`);
                          setShowSmsAlert(false);
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to send SMS alert');
                        } finally {
                          setSendingSms(false);
                        }
                      }}
                    >
                      {sendingSms ? 'Sending...' : `Send ${properties.filter(p => p.price && p.zestimate && (p.zestimate - p.price) >= 30000).length} Deals`}
                    </Button>
                  </div>
                )}

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
                          return spread >= 30000;
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
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Your favorites</h1>
              <p className="text-lg text-neutral-400 font-light leading-relaxed">
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
                    <User className="h-8 w-8 text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-3 tracking-tight">No favorites yet</h3>
                  <p className="text-neutral-400 mb-8 font-light leading-relaxed">
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