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
  // Midwest
  'Detroit, MI',
  'Cleveland, OH', 
  'Indianapolis, IN',
  'Kansas City, MO',
  'St. Louis, MO',
  'Milwaukee, WI',
  'Columbus, OH',
  'Cincinnati, OH',
  
  // South
  'Memphis, TN',
  'Birmingham, AL',
  'Jacksonville, FL',
  'Tampa, FL',
  'Atlanta, GA',
  'New Orleans, LA',
  'Louisville, KY',
  'Nashville, TN',
  
  // Southwest
  'Houston, TX',
  'Dallas, TX',
  'San Antonio, TX',
  'Phoenix, AZ',
  'Tucson, AZ',
  'Oklahoma City, OK',
  
  // West
  'Las Vegas, NV',
  'Fresno, CA',
  'Bakersfield, CA',
  'Stockton, CA',
  
  // Northeast
  'Buffalo, NY',
  'Rochester, NY',
  'Pittsburgh, PA',
  'Baltimore, MD'
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