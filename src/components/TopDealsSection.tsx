import { useState, useEffect } from 'react';
import { PropertyCard } from './PropertyCard';
import { PropertyModal } from './PropertyModal';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Property } from '@/types/zillow';
import { zillowAPI } from '@/lib/zillow-api';
import { TrendingUp, MapPin, RefreshCw } from 'lucide-react';

const TOP_MARKETS = [
  // Alabama
  'Birmingham, AL', 'Montgomery, AL', 'Mobile, AL', 'Huntsville, AL',
  
  // Alaska
  'Anchorage, AK', 'Fairbanks, AK',
  
  // Arizona
  'Phoenix, AZ', 'Tucson, AZ', 'Mesa, AZ', 'Chandler, AZ', 'Scottsdale, AZ',
  
  // Arkansas
  'Little Rock, AR', 'Fort Smith, AR', 'Fayetteville, AR',
  
  // California
  'Los Angeles, CA', 'San Diego, CA', 'San Jose, CA', 'San Francisco, CA',
  'Fresno, CA', 'Sacramento, CA', 'Long Beach, CA', 'Oakland, CA',
  'Bakersfield, CA', 'Anaheim, CA', 'Santa Ana, CA', 'Riverside, CA',
  'Stockton, CA', 'Irvine, CA', 'Fremont, CA', 'San Bernardino, CA',
  'Modesto, CA', 'Fontana, CA', 'Oxnard, CA', 'Moreno Valley, CA',
  
  // Colorado
  'Denver, CO', 'Colorado Springs, CO', 'Aurora, CO', 'Fort Collins, CO',
  'Lakewood, CO', 'Thornton, CO', 'Arvada, CO', 'Westminster, CO',
  
  // Connecticut
  'Bridgeport, CT', 'New Haven, CT', 'Hartford, CT', 'Stamford, CT',
  'Waterbury, CT',
  
  // Delaware
  'Wilmington, DE', 'Dover, DE',
  
  // Florida
  'Jacksonville, FL', 'Miami, FL', 'Tampa, FL', 'Orlando, FL',
  'St. Petersburg, FL', 'Hialeah, FL', 'Tallahassee, FL', 'Fort Lauderdale, FL',
  'Port St. Lucie, FL', 'Cape Coral, FL', 'Pembroke Pines, FL', 'Hollywood, FL',
  'Gainesville, FL', 'Miami Gardens, FL', 'Clearwater, FL', 'Brandon, FL',
  
  // Georgia
  'Atlanta, GA', 'Augusta, GA', 'Columbus, GA', 'Macon, GA',
  'Savannah, GA', 'Athens, GA', 'Sandy Springs, GA', 'Roswell, GA',
  
  // Hawaii
  'Honolulu, HI', 'Pearl City, HI', 'Hilo, HI',
  
  // Idaho
  'Boise, ID', 'Meridian, ID', 'Nampa, ID', 'Idaho Falls, ID',
  
  // Illinois
  'Chicago, IL', 'Aurora, IL', 'Rockford, IL', 'Joliet, IL',
  'Naperville, IL', 'Springfield, IL', 'Peoria, IL', 'Elgin, IL',
  
  // Indiana
  'Indianapolis, IN', 'Fort Wayne, IN', 'Evansville, IN', 'South Bend, IN',
  'Carmel, IN', 'Fishers, IN', 'Bloomington, IN', 'Hammond, IN',
  
  // Iowa
  'Des Moines, IA', 'Cedar Rapids, IA', 'Davenport, IA', 'Sioux City, IA',
  
  // Kansas
  'Wichita, KS', 'Overland Park, KS', 'Kansas City, KS', 'Topeka, KS',
  'Olathe, KS', 'Lawrence, KS',
  
  // Kentucky
  'Louisville, KY', 'Lexington, KY', 'Bowling Green, KY', 'Owensboro, KY',
  
  // Louisiana
  'New Orleans, LA', 'Baton Rouge, LA', 'Shreveport, LA', 'Lafayette, LA',
  'Lake Charles, LA', 'Kenner, LA',
  
  // Maine
  'Portland, ME', 'Lewiston, ME', 'Bangor, ME',
  
  // Maryland
  'Baltimore, MD', 'Frederick, MD', 'Rockville, MD', 'Gaithersburg, MD',
  'Bowie, MD', 'Hagerstown, MD',
  
  // Massachusetts
  'Boston, MA', 'Worcester, MA', 'Springfield, MA', 'Lowell, MA',
  'Cambridge, MA', 'New Bedford, MA', 'Brockton, MA', 'Quincy, MA',
  
  // Michigan
  'Detroit, MI', 'Grand Rapids, MI', 'Warren, MI', 'Sterling Heights, MI',
  'Lansing, MI', 'Ann Arbor, MI', 'Flint, MI', 'Dearborn, MI',
  
  // Minnesota
  'Minneapolis, MN', 'St. Paul, MN', 'Rochester, MN', 'Duluth, MN',
  'Bloomington, MN', 'Brooklyn Park, MN',
  
  // Mississippi
  'Jackson, MS', 'Gulfport, MS', 'Southaven, MS', 'Hattiesburg, MS',
  
  // Missouri
  'Kansas City, MO', 'St. Louis, MO', 'Springfield, MO', 'Independence, MO',
  'Columbia, MO', 'Lee\'s Summit, MO', 'O\'Fallon, MO', 'St. Joseph, MO',
  
  // Montana
  'Billings, MT', 'Missoula, MT', 'Great Falls, MT', 'Bozeman, MT',
  
  // Nebraska
  'Omaha, NE', 'Lincoln, NE', 'Bellevue, NE', 'Grand Island, NE',
  
  // Nevada
  'Las Vegas, NV', 'Henderson, NV', 'Reno, NV', 'North Las Vegas, NV',
  'Sparks, NV', 'Carson City, NV',
  
  // New Hampshire
  'Manchester, NH', 'Nashua, NH', 'Concord, NH', 'Derry, NH',
  
  // New Jersey
  'Newark, NJ', 'Jersey City, NJ', 'Paterson, NJ', 'Elizabeth, NJ',
  'Edison, NJ', 'Woodbridge, NJ', 'Lakewood, NJ', 'Toms River, NJ',
  
  // New Mexico
  'Albuquerque, NM', 'Las Cruces, NM', 'Rio Rancho, NM', 'Santa Fe, NM',
  
  // New York
  'New York, NY', 'Buffalo, NY', 'Rochester, NY', 'Yonkers, NY',
  'Syracuse, NY', 'Albany, NY', 'New Rochelle, NY', 'Mount Vernon, NY',
  
  // North Carolina
  'Charlotte, NC', 'Raleigh, NC', 'Greensboro, NC', 'Durham, NC',
  'Winston-Salem, NC', 'Fayetteville, NC', 'Cary, NC', 'Wilmington, NC',
  
  // North Dakota
  'Fargo, ND', 'Bismarck, ND', 'Grand Forks, ND', 'Minot, ND',
  
  // Ohio
  'Columbus, OH', 'Cleveland, OH', 'Cincinnati, OH', 'Toledo, OH',
  'Akron, OH', 'Dayton, OH', 'Parma, OH', 'Canton, OH',
  
  // Oklahoma
  'Oklahoma City, OK', 'Tulsa, OK', 'Norman, OK', 'Broken Arrow, OK',
  'Lawton, OK', 'Edmond, OK',
  
  // Oregon
  'Portland, OR', 'Eugene, OR', 'Salem, OR', 'Gresham, OR',
  'Hillsboro, OR', 'Bend, OR',
  
  // Pennsylvania
  'Philadelphia, PA', 'Pittsburgh, PA', 'Allentown, PA', 'Erie, PA',
  'Reading, PA', 'Scranton, PA', 'Bethlehem, PA', 'Lancaster, PA',
  
  // Rhode Island
  'Providence, RI', 'Warwick, RI', 'Cranston, RI', 'Pawtucket, RI',
  
  // South Carolina
  'Columbia, SC', 'Charleston, SC', 'North Charleston, SC', 'Mount Pleasant, SC',
  'Rock Hill, SC', 'Greenville, SC', 'Summerville, SC', 'Sumter, SC',
  
  // South Dakota
  'Sioux Falls, SD', 'Rapid City, SD', 'Aberdeen, SD', 'Brookings, SD',
  
  // Tennessee
  'Memphis, TN', 'Nashville, TN', 'Knoxville, TN', 'Chattanooga, TN',
  'Clarksville, TN', 'Murfreesboro, TN', 'Franklin, TN', 'Johnson City, TN',
  
  // Texas
  'Houston, TX', 'San Antonio, TX', 'Dallas, TX', 'Austin, TX',
  'Fort Worth, TX', 'El Paso, TX', 'Arlington, TX', 'Corpus Christi, TX',
  'Plano, TX', 'Laredo, TX', 'Lubbock, TX', 'Garland, TX',
  'Irving, TX', 'Amarillo, TX', 'Grand Prairie, TX', 'Brownsville, TX',
  
  // Utah
  'Salt Lake City, UT', 'West Valley City, UT', 'Provo, UT', 'West Jordan, UT',
  'Orem, UT', 'Sandy, UT', 'Ogden, UT', 'St. George, UT',
  
  // Vermont
  'Burlington, VT', 'Essex, VT', 'South Burlington, VT', 'Colchester, VT',
  
  // Virginia
  'Virginia Beach, VA', 'Norfolk, VA', 'Chesapeake, VA', 'Richmond, VA',
  'Newport News, VA', 'Alexandria, VA', 'Hampton, VA', 'Portsmouth, VA',
  
  // Washington
  'Seattle, WA', 'Spokane, WA', 'Tacoma, WA', 'Vancouver, WA',
  'Bellevue, WA', 'Kent, WA', 'Everett, WA', 'Renton, WA',
  
  // West Virginia
  'Charleston, WV', 'Huntington, WV', 'Parkersburg, WV', 'Morgantown, WV',
  
  // Wisconsin
  'Milwaukee, WI', 'Madison, WI', 'Green Bay, WI', 'Kenosha, WI',
  'Racine, WI', 'Appleton, WI', 'Waukesha, WI', 'Eau Claire, WI',
  
  // Wyoming
  'Cheyenne, WY', 'Casper, WY', 'Laramie, WY', 'Gillette, WY'
];

export function TopDealsSection() {
  const [topDeals, setTopDeals] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const identifyWholesaleDeals = (properties: Property[]): Property[] => {
    // Group properties by state for geographic diversity
    const propertiesByState = new Map<string, Property[]>();
    
    const filtered = properties.filter(property => {
      // Basic filtering criteria
      const hasPrice = property.price && property.price > 0;
      const hasSqft = property.sqft && property.sqft > 0;
      const pricePerSqft = hasPrice && hasSqft ? property.price / property.sqft : 0;
      
      return (
        hasPrice &&
        hasSqft &&
        property.price <= 300000 && // Increased max price
        pricePerSqft < 150 && // More flexible price per sqft
        pricePerSqft > 15 && // Lower minimum to catch more deals
        property.yearBuilt && property.yearBuilt >= 1940 // Accept older properties
      );
    });

    // Group by state for diversity
    filtered.forEach(property => {
      const state = property.address?.split(', ').pop() || 'Unknown';
      if (!propertiesByState.has(state)) {
        propertiesByState.set(state, []);
      }
      propertiesByState.get(state)!.push(property);
    });

    // Get top deals from each state for geographic diversity
    const diverseDeals: Property[] = [];
    propertiesByState.forEach((stateProperties, state) => {
      const sortedByScore = stateProperties
        .sort((a, b) => calculateWholesaleScore(b) - calculateWholesaleScore(a))
        .slice(0, 2); // Top 2 from each state
      diverseDeals.push(...sortedByScore);
    });

    // Final sort by score and take top 12
    return diverseDeals
      .sort((a, b) => calculateWholesaleScore(b) - calculateWholesaleScore(a))
      .slice(0, 12);
  };

  const calculateWholesaleScore = (property: Property): number => {
    let score = 0;
    
    if (!property.price || !property.sqft) return 0;
    
    const pricePerSqft = property.price / property.sqft;
    
    // Calculate estimated ARV (After Repair Value) and wholesale margin
    const avgPricePerSqft = 120; // National average
    const estimatedARV = property.sqft * avgPricePerSqft;
    const wholesaleMargin = estimatedARV - property.price;
    const marginPercentage = (wholesaleMargin / property.price) * 100;
    
    // High margin deals get massive bonus
    if (marginPercentage > 100) score += 50; // 100%+ margin
    else if (marginPercentage > 75) score += 40; // 75%+ margin  
    else if (marginPercentage > 50) score += 30; // 50%+ margin
    else if (marginPercentage > 25) score += 20; // 25%+ margin
    else if (marginPercentage > 10) score += 10; // 10%+ margin
    
    // Lower price per sqft = higher score
    if (pricePerSqft < 40) score += 35;
    else if (pricePerSqft < 60) score += 25;
    else if (pricePerSqft < 80) score += 15;
    else if (pricePerSqft < 100) score += 10;
    
    // Price range bonus (sweet spot for wholesaling)
    if (property.price < 80000) score += 25;
    else if (property.price < 120000) score += 20;
    else if (property.price < 180000) score += 15;
    else if (property.price < 250000) score += 10;
    
    // Days on market bonus
    if (property.daysOnMarket && property.daysOnMarket > 90) score += 20;
    else if (property.daysOnMarket && property.daysOnMarket > 60) score += 15;
    else if (property.daysOnMarket && property.daysOnMarket > 30) score += 10;
    
    // FSBO and auction bonus
    if (property.isFSBO) score += 25;
    if (property.isAuction) score += 20;
    
    // Property condition and age
    if (property.yearBuilt && property.yearBuilt >= 2000) score += 15;
    else if (property.yearBuilt && property.yearBuilt >= 1980) score += 10;
    else if (property.yearBuilt && property.yearBuilt >= 1960) score += 5;
    
    return Math.round(score);
  };

  const fetchTopDeals = async () => {
    setIsLoading(true);
    try {
      const allProperties: Property[] = [];
      
      // Randomly shuffle markets and search 8-10 of them for variety
      const shuffledMarkets = [...TOP_MARKETS].sort(() => Math.random() - 0.5);
      const marketsToSearch = shuffledMarkets.slice(0, 10);
      
      console.log('Searching markets:', marketsToSearch);
      
      // Search markets concurrently
      const searchPromises = marketsToSearch.map(market => 
        zillowAPI.searchProperties({
          location: market,
          homeType: 'Houses',
          price_max: '300000'
        }).then(properties => {
          console.log(`${market}: Found ${properties.length} properties`);
          return properties;
        }).catch(error => {
          console.error(`Error searching ${market}:`, error);
          return [];
        })
      );
      
      const results = await Promise.all(searchPromises);
      results.forEach(properties => allProperties.push(...properties));
      
      console.log(`Total properties found: ${allProperties.length}`);
      
      const deals = identifyWholesaleDeals(allProperties);
      console.log(`Wholesale deals identified: ${deals.length}`);
      
      setTopDeals(deals);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching top deals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopDeals();
  }, []);

  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-6">
        <div className="relative">
          <h1 className="text-5xl lg:text-7xl font-bold gradient-text-intense mb-4">
            🔥 TOP DEALS
          </h1>
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-xl -z-10 rounded-full"></div>
        </div>
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
          Elite wholesale opportunities discovered by AI across {TOP_MARKETS.length}+ markets nationwide. 
          Updated in real-time with profit scoring algorithms.
        </p>
        
        {/* Stats Bar */}
        <div className="flex items-center justify-center gap-8 p-6 neon-card rounded-2xl max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">{TOP_MARKETS.length}+</div>
            <div className="text-sm text-muted-foreground font-medium">Markets Monitored</div>
          </div>
          <div className="h-12 w-px bg-border"></div>
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">{topDeals.length}</div>
            <div className="text-sm text-muted-foreground font-medium">Active Deals</div>
          </div>
          <div className="h-12 w-px bg-border"></div>
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">
              {lastUpdated ? formatTimeAgo(lastUpdated) : 'Never'}
            </div>
            <div className="text-sm text-muted-foreground font-medium">Last Updated</div>
          </div>
          <div className="h-12 w-px bg-border"></div>
          <Button
            variant="default"
            size="lg"
            onClick={fetchTopDeals}
            disabled={isLoading}
            className=""
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Scanning...' : 'Refresh Deals'}
          </Button>
        </div>
      </div>

      {/* Deals Grid */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="neon-card p-6 rounded-2xl space-y-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-32 w-full rounded-xl" />
                <div className="space-y-3">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : topDeals.length > 0 ? (
        <div className="space-y-8">
          {/* Top 6 Featured Deals */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <span className="text-4xl flex items-center justify-center w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full">⭐</span>
              Premium Picks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {topDeals.slice(0, 6).map((property, index) => (
                <div key={property.id} className="relative group">
                  <div className="neon-card p-8 rounded-3xl glow-hover cursor-pointer" onClick={() => handlePropertyClick(property)}>
                    {/* Rank Badge */}
                    <div className="absolute -top-4 -left-4 z-20">
                      <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg shadow-intense">
                        #{index + 1}
                      </div>
                    </div>
                    
                    {/* Hot Deal Badge */}
                    <div className="absolute -top-4 -right-4 z-20">
                      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full px-4 py-2 text-sm font-bold shadow-intense animate-pulse">
                        🔥 HOT
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Address & Location */}
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                          {property.address}
                        </h3>
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2 text-primary" />
                          {property.propertyType || 'Property'}
                        </div>
                      </div>

                      {/* Price & Score */}
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-3xl font-bold gradient-text">
                            {property.price ? `$${property.price.toLocaleString()}` : 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground">List Price</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-accent">
                            {calculateWholesaleScore(property)}
                          </div>
                          <div className="text-xs text-muted-foreground">AI Score</div>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-muted/30 rounded-xl">
                          <div className="font-bold text-foreground">{property.bedrooms || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">Beds</div>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-xl">
                          <div className="font-bold text-foreground">{property.bathrooms || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">Baths</div>
                        </div>
                        <div className="text-center p-3 bg-muted/30 rounded-xl">
                          <div className="font-bold text-foreground">
                            {property.sqft ? `${Math.round(property.sqft / 1000)}k` : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">Sqft</div>
                        </div>
                      </div>

                      {/* Profit Potential */}
                      {property.price && property.sqft && (
                        <div className="p-4 bg-gradient-to-r from-success/20 to-primary/20 rounded-xl border border-success/30">
                          <div className="text-sm text-success-foreground font-medium mb-1">💰 Profit Potential</div>
                          <div className="text-lg font-bold text-success">
                            ${Math.round((120 * property.sqft) - property.price).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Est. profit after repairs (ARV: ${Math.round(120 * property.sqft).toLocaleString()})
                          </div>
                        </div>
                      )}

                      <Button 
                        variant="default" 
                        size="lg" 
                        className="w-full"
                        onClick={() => handlePropertyClick(property)}
                      >
                        <TrendingUp className="h-5 w-5 mr-2" />
                        Analyze Deal
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-16 space-y-6">
          <div className="text-6xl">🔍</div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-foreground">No Deals Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Our AI is scanning nationwide markets. Try refreshing to discover new wholesale opportunities.
            </p>
          </div>
          <Button variant="default" size="lg" onClick={fetchTopDeals} className="">
            <RefreshCw className="h-5 w-5 mr-2" />
            Search for Deals
          </Button>
        </div>
      )}

      <PropertyModal
        property={selectedProperty}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}