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
    return properties
      .filter(property => {
        // Filter criteria for wholesale potential
        const hasPrice = property.price && property.price > 0;
        const hasSqft = property.sqft && property.sqft > 0;
        const pricePerSqft = hasPrice && hasSqft ? property.price / property.sqft : 0;
        
        return (
          hasPrice &&
          hasSqft &&
          property.price <= 200000 && // Under $200k
          pricePerSqft < 100 && // Low price per sqft
          pricePerSqft > 20 && // Not too low to be suspicious
          (property.daysOnMarket === undefined || property.daysOnMarket > 30) && // On market for a while
          property.yearBuilt && property.yearBuilt >= 1950 // Not too old
        );
      })
      .sort((a, b) => {
        // Sort by wholesale potential score
        const scoreA = calculateWholesaleScore(a);
        const scoreB = calculateWholesaleScore(b);
        return scoreB - scoreA;
      })
      .slice(0, 8); // Top 8 deals
  };

  const calculateWholesaleScore = (property: Property): number => {
    let score = 0;
    
    if (!property.price || !property.sqft) return 0;
    
    const pricePerSqft = property.price / property.sqft;
    
    // Lower price per sqft = higher score
    if (pricePerSqft < 50) score += 30;
    else if (pricePerSqft < 75) score += 20;
    else if (pricePerSqft < 100) score += 10;
    
    // Price range bonus
    if (property.price < 100000) score += 20;
    else if (property.price < 150000) score += 15;
    else if (property.price < 200000) score += 10;
    
    // Days on market bonus
    if (property.daysOnMarket && property.daysOnMarket > 60) score += 15;
    else if (property.daysOnMarket && property.daysOnMarket > 30) score += 10;
    
    // FSBO bonus
    if (property.isFSBO) score += 25;
    
    // Property age bonus
    if (property.yearBuilt && property.yearBuilt >= 1980) score += 10;
    else if (property.yearBuilt && property.yearBuilt >= 1960) score += 5;
    
    return score;
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
          price_max: '200000'
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
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Top Deals of the Day</CardTitle>
              <Badge variant="secondary" className="ml-2">
                <MapPin className="h-3 w-3 mr-1" />
                Nationwide
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Updated {formatTimeAgo(lastUpdated)}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTopDeals}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Handpicked properties from top wholesale markets across the US with the highest profit potential.
          </p>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : topDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {topDeals.map((property) => (
                <div key={property.id} className="relative">
                  <div onClick={() => handlePropertyClick(property)} className="cursor-pointer">
                    <PropertyCard 
                      property={property} 
                      onViewDetails={handlePropertyClick}
                    />
                  </div>
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="bg-red-500 text-white">
                      🔥 HOT DEAL
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="text-xs">
                      Score: {calculateWholesaleScore(property)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No deals found. Try refreshing to search for new opportunities.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <PropertyModal
        property={selectedProperty}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}