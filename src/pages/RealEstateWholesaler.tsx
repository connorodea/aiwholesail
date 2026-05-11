import React, { useState, useEffect, useRef } from 'react';
import { analytics } from '@/lib/analytics';
import { PropertySearch } from '@/components/PropertySearch';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyModal } from '@/components/PropertyModal';

import { Property, PropertySearchParams } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { sortPropertiesByWholesalePotential } from '@/lib/wholesale-calculator';
import { scoreAllProperties, filterMotivatedSellers, MIN_MOTIVATED_SCORE } from '@/lib/motivated-seller-score';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Download, Bell, MessageSquare, GitCompareArrows, Check } from 'lucide-react';
import { communications } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useLeads } from '@/hooks/useLeads';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { PropertyAlertsManager } from '@/components/PropertyAlertsManager';
import { PopularMarketsEmptyState } from '@/components/PopularMarketsEmptyState';
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
import { ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PropertyComparison } from '@/components/PropertyComparison';
import { AITopPicksSection } from '@/components/AITopPicksSection';
import { SaveSearchAsAlertDialog } from '@/components/SaveSearchAsAlertDialog';
import { AlertOnboardingBanner } from '@/components/AlertOnboardingBanner';
import { TrialCountdownBanner } from '@/components/TrialCountdownBanner';
import { SearchLoadingState } from '@/components/SearchLoadingState';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<Property[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  // Default: show ALL properties so users know the search is working while
  // zestimates are still being calculated. Toggle ON to hide non-deals.
  const [hideNegativeSpreads, setHideNegativeSpreads] = useState(false);
  const searchIdRef = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const propertyCardsRef = useRef<HTMLDivElement>(null);
  // Tracks whether we've already done the "first-cards-landed" scroll for the
  // current search. Reset on each new submit so a fresh search re-scrolls.
  const firstResultsShownRef = useRef(false);

  // A property is a confirmed non-deal when it has both a price and a
  // zestimate, and the price is at or above the zestimate. Properties still
  // awaiting a zestimate are NOT classified as negative — they're shown so
  // the grid populates immediately during enrichment.
  const isNegativeSpread = (p: Property) =>
    !!p.price && !!p.zestimate && p.price >= p.zestimate;

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

      // Reset the second-scroll tracker so this search can re-trigger.
      firstResultsShownRef.current = false;

      // Smoothly scroll to results region as soon as the search fires.
      // Gives instant feedback that something is happening + carries the
      // user's eye down to where the loader + results will render.
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // Step 1: Fetch every page Zillow has for this query. We pass a high
      // ceiling (100 pages ≈ 4,000+ properties) so the search isn't artificially
      // truncated — Zillow's own totalPages stops the loop at the real end.
      const isStateSearch = isStateOnlyLocation(params.location);
      const maxPages = 100;

      if (isStateSearch) {
        setLoadingStatus(`State-wide search: fetching every listing across ${params.location}... This may take a minute or two.`);
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

      // Second smooth-scroll — carries the user past the loader and lands on
      // the property grid the moment cards mount. Use a double-rAF so we wait
      // for React to commit the new render before measuring/scrolling.
      if (!firstResultsShownRef.current && sorted.length > 0) {
        firstResultsShownRef.current = true;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            propertyCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      }

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
            // Cross-tab cache write — partial data is better than none if the
            // user navigates to /app/analyzer mid-enrichment
            try {
              localStorage.setItem('aiw_search_results', JSON.stringify(sorted));
              localStorage.setItem('aiw_search_location', params.location);
              localStorage.setItem('aiw_search_timestamp', String(Date.now()));
            } catch {
              // Quota exceeded or storage disabled — non-fatal; the UI tab still has the data
            }
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

        // Motivated-seller pipeline (Elite-only). When the toggle is on:
        //  1) score every property,
        //  2) filter to score >= MIN_MOTIVATED_SCORE,
        //  3) re-sort by motivation score descending (best leads first).
        // When OFF: still attach motivation scores so PropertyCard can
        // show subtle badges on any incidental high-motivation listings.
        if (params.motivatedSellersOnly) {
          enrichedSorted = filterMotivatedSellers(enrichedSorted, MIN_MOTIVATED_SCORE);
          const surfaced = enrichedSorted.length;
          if (surfaced > 0) {
            toast.success(`${surfaced} motivated seller${surfaced > 1 ? 's' : ''} surfaced in ${params.location}`);
          } else {
            toast.info('No motivated sellers in this market right now. Try broadening the location or running without the toggle.');
          }
        } else {
          enrichedSorted = scoreAllProperties(enrichedSorted);
        }

        // If the user searched with "wholesale only", auto-flip the
        // hide-negative-spreads toggle ON post-enrichment so deals are
        // surfaced. Otherwise leave it OFF (the default) so all results
        // remain visible.
        setHideNegativeSpreads(!!params.wholesaleOnly);

        setProperties(enrichedSorted);

        // Cache results for the AI Analyzer tab. Use localStorage so the
        // cache survives tab switches, and write to sessionStorage too so
        // any older code paths still find data.
        try {
          const json = JSON.stringify(enrichedSorted);
          localStorage.setItem('aiw_search_results', json);
          localStorage.setItem('aiw_search_location', params.location);
          localStorage.setItem('aiw_search_timestamp', String(Date.now()));
          sessionStorage.setItem('aiw_search_results', json);
          sessionStorage.setItem('aiw_search_location', params.location);
        } catch {
          // Quota exceeded — keep going, in-memory state still works for this tab
        }

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
      <main className="container mx-auto mobile-padding pt-20 sm:pt-24 pb-12 sm:pb-16 space-y-12 sm:space-y-16 lg:space-y-20">
        {showAlerts ? (
          <section className="animate-fade-in">
            <PropertyAlertsManager />
          </section>
        ) : !showFavorites ? (
          <>
            {/* Hero Search Section */}
            <section className="text-center space-y-6 sm:space-y-10 max-w-6xl mx-auto animate-fade-in">
              <div className="space-y-3 sm:space-y-6">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight leading-tight">
                  Find profitable real estate deals
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-neutral-400 font-light max-w-2xl mx-auto leading-relaxed">
                  Discover undervalued properties with AI-powered analysis and comprehensive market data
                </p>
              </div>

              {/* Property Search */}
              <div className="feature-card p-8 backdrop-blur-sm">
                <PropertySearch onSearch={handleSearch} isLoading={isLoading} />
              </div>

              {/* Trial countdown banner — only renders for trial users with ≤3 days remaining */}
              <div className="text-left">
                <TrialCountdownBanner />
              </div>

              {/* Onboarding nudge — only renders if user has 0 alerts */}
              <div className="text-left">
                <AlertOnboardingBanner suggestedLocation={lastSearchLocation} />
              </div>
            </section>

            {/* Anchor for smooth-scroll after Search Properties is clicked.
                scroll-mt-* gives the smooth scroll some breathing room from the sticky header. */}
            <div ref={resultsRef} className="scroll-mt-20 sm:scroll-mt-24" aria-hidden="true" />

            {/* Loading Animation — visible during search AND enrichment */}
            {(isLoading || loadingProgress > 0) && (
              <SearchLoadingState progress={loadingProgress} status={loadingStatus} />
            )}

            {/* First-run empty state — collapses the "what should I search?" decision into one click.
                Only renders when nothing has been searched yet (not loading, no error, no results, no
                cached search). This is the fix for the 77% activation leak surfaced in the trial-results analysis. */}
            {!isLoading && loadingProgress === 0 && !error && properties.length === 0 && !lastSearchLocation && (
              <PopularMarketsEmptyState onSelect={handleSearch} />
            )}

            {/* Anchor for the second smooth-scroll — lands on the property grid
                once cards first mount. scroll-mt-* keeps clear of the sticky header. */}
            <div ref={propertyCardsRef} className="scroll-mt-20 sm:scroll-mt-24" aria-hidden="true" />

            {/* Results Section */}
            {!isLoading && properties.length > 0 && (() => {
              const visibleProperties = hideNegativeSpreads
                ? properties.filter(p => !isNegativeSpread(p))
                : properties;
              const hiddenNegativeCount = properties.length - visibleProperties.length;
              const stillEnriching = loadingProgress > 0 && loadingProgress < 100;
              return (
              <section className="space-y-6 sm:space-y-10 animate-fade-in">
                {/* Progressive-enrichment callout — visible while zestimates are still
                    landing. Explains the "spreads will pop to top automatically" behavior
                    so users don't think the results are static. */}
                {stillEnriching && (
                  <div className="flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] px-4 py-3">
                    <div className="relative shrink-0 mt-1.5">
                      <span className="absolute inset-0 rounded-full bg-cyan-400/40 animate-ping" />
                      <span className="relative block h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-cyan-100">
                        Still calculating spreads — best deals will pop to the top automatically
                      </div>
                      <div className="text-xs text-cyan-300/70 mt-0.5">
                        You can start browsing now. As more Zestimates come in, properties will re-sort so the biggest spreads land at the top.
                      </div>
                    </div>
                    <div className="text-xs font-mono text-cyan-300/80 hidden sm:block tabular-nums shrink-0">
                      {loadingProgress}%
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <h2 className="text-xl sm:text-2xl font-medium tracking-tight">
                      {visibleProperties.some(p => p.price && p.zestimate && p.price < p.zestimate)
                        ? 'Best deals found'
                        : 'Search results'}
                    </h2>
                    <p className="text-sm sm:text-base text-neutral-400 font-light">
                      {visibleProperties.length} {visibleProperties.length === 1 ? 'property' : 'properties'} shown
                      {hideNegativeSpreads && hiddenNegativeCount > 0 && (
                        <span className="text-neutral-500"> · {hiddenNegativeCount} hidden</span>
                      )}
                    </p>
                  </div>

                  {user && properties.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto sm:overflow-visible scrollbar-none">
                      <div
                        className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium smooth-transition ${
                          hideNegativeSpreads
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-transparent border-border text-neutral-300'
                        }`}
                        title={hideNegativeSpreads
                          ? 'Showing only properties priced below their Zestimate (deals)'
                          : 'Hide properties priced at or above their Zestimate'}
                      >
                        {hideNegativeSpreads ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        <Label
                          htmlFor="hide-negative-spreads"
                          className="cursor-pointer text-sm font-medium select-none"
                        >
                          {hideNegativeSpreads ? 'Hiding non-deals' : 'Hide negative spreads'}
                        </Label>
                        <Switch
                          id="hide-negative-spreads"
                          checked={hideNegativeSpreads}
                          onCheckedChange={setHideNegativeSpreads}
                          className="ml-1"
                        />
                      </div>

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

                      {/* Save Search as Alert */}
                      <Button
                        onClick={() => setSaveAlertOpen(true)}
                        size="sm"
                        className="gap-2 h-9 px-4 text-sm font-semibold smooth-transition bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20"
                      >
                        <Bell className="h-4 w-4" />
                        Save as alert
                      </Button>

                      {/* Compare Mode Toggle */}
                      <Button
                        onClick={() => {
                          setCompareMode(!compareMode);
                          if (compareMode) {
                            setCompareSelected([]);
                          }
                        }}
                        variant={compareMode ? 'default' : 'outline'}
                        size="sm"
                        className="gap-2 h-9 px-4 text-sm font-medium smooth-transition"
                      >
                        <GitCompareArrows className="h-4 w-4" />
                        {compareMode ? 'Cancel Compare' : 'Compare'}
                      </Button>

                      {/* Compare Selected Button */}
                      {compareMode && compareSelected.length >= 2 && (
                        <Button
                          onClick={() => setShowComparison(true)}
                          size="sm"
                          className="gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 smooth-transition"
                        >
                          <Check className="h-4 w-4" />
                          Compare {compareSelected.length} Selected
                        </Button>
                      )}

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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white/[0.02] rounded-xl border border-border">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
                      <Input
                        placeholder="Your phone number (e.g., +1234567890)"
                        value={smsPhone}
                        onChange={(e) => setSmsPhone(e.target.value)}
                        className="flex-1 sm:max-w-xs bg-background h-11 sm:h-10"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto h-11 sm:h-9"
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

                <AITopPicksSection
                  properties={visibleProperties}
                  onSelectProperty={setSelectedProperty}
                />

                <div className="property-grid">
                  {[...visibleProperties].sort((a, b) => {
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
                  }).map((property, index) => {
                    const isCompareSelected = compareSelected.some((p) => p.id === property.id);
                    const canCompareSelect = compareSelected.length < 4 || isCompareSelected;
                    return (
                      <div
                        key={property.id}
                        className="animate-fade-in hover-scale relative"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {compareMode && (
                          <div
                            className={`absolute top-3 left-3 z-10 flex items-center justify-center w-6 h-6 rounded-md border-2 cursor-pointer transition-all ${
                              isCompareSelected
                                ? 'bg-emerald-500 border-emerald-500'
                                : canCompareSelect
                                  ? 'bg-black/60 border-neutral-500 hover:border-emerald-400'
                                  : 'bg-black/60 border-neutral-700 opacity-50 cursor-not-allowed'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCompareSelected) {
                                setCompareSelected((prev) =>
                                  prev.filter((p) => p.id !== property.id)
                                );
                              } else if (canCompareSelect) {
                                setCompareSelected((prev) => [...prev, property]);
                              } else {
                                toast.error('You can compare up to 4 properties at a time');
                              }
                            }}
                          >
                            {isCompareSelected && <Check className="h-4 w-4 text-white" />}
                          </div>
                        )}
                        <PropertyCard
                          property={property}
                          onViewDetails={() => setSelectedProperty(property)}
                          highlightWholesaleDeals={true}
                          showFSBOBadge={isSearchingFSBO}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
              );
            })()}

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

      {/* Property Comparison Modal */}
      <PropertyComparison
        properties={compareSelected}
        isOpen={showComparison}
        onClose={() => {
          setShowComparison(false);
          setCompareMode(false);
          setCompareSelected([]);
        }}
      />

      {/* Save Search as Alert */}
      <SaveSearchAsAlertDialog
        open={saveAlertOpen}
        onOpenChange={setSaveAlertOpen}
        defaultLocation={lastSearchLocation}
      />

    </div>
  );
}