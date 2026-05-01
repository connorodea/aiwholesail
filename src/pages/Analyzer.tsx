import { useState } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { AIWholesaleAnalyzer } from '@/components/AIWholesaleAnalyzer';
import { ChatAssistant } from '@/components/ChatAssistant';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, CheckCircle } from 'lucide-react';
import { zillowAPI } from '@/lib/zillow-api';
import { Property } from '@/types/zillow';
import { useToast } from '@/hooks/use-toast';

export default function Analyzer() {
  const [location, setLocation] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!location.trim()) {
      toast({
        title: 'Location Required',
        description: 'Please enter a city, state, or ZIP code to search.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setSearchProgress('Searching for properties...');
    setProperties([]);
    setHasSearched(false);

    try {
      const results = await zillowAPI.searchProperties(
        { location: location.trim(), homeType: 'Houses' },
        3,
        (loaded, total, count) => {
          setSearchProgress(`Loading page ${loaded} of ${total} (${count} properties so far)`);
        }
      );

      if (results.length === 0) {
        toast({
          title: 'No Properties Found',
          description: 'No properties found for this location. Try a different search.',
          variant: 'destructive',
        });
        setHasSearched(true);
        setIsSearching(false);
        setSearchProgress(null);
        return;
      }

      setSearchProgress(`Enriching ${results.length} properties with Zestimates...`);

      const enriched = await zillowAPI.enrichWithZestimates(
        results,
        (completed, total) => {
          setSearchProgress(`Fetching Zestimates: ${completed}/${total}`);
        }
      );

      setProperties(enriched);
      setHasSearched(true);

      const withZestimate = enriched.filter(p => p.zestimate && p.zestimate > 0).length;
      toast({
        title: 'Search Complete',
        description: `Found ${enriched.length} properties (${withZestimate} with Zestimates).`,
      });
    } catch (error) {
      console.error('Property search failed:', error);
      toast({
        title: 'Search Failed',
        description: 'Failed to search for properties. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
      setSearchProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">AI Deal Analyzer</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            AI-powered analysis to rank and score investment opportunities
          </p>
        </section>

        {/* Property Search Section */}
        <section className="max-w-2xl mx-auto animate-fade-in">
          <Card className="simple-card">
            <CardContent className="p-6 space-y-4">
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="e.g., Charlotte, NC or 90210"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !location.trim()}
                size="lg"
                className="w-full h-12"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    {searchProgress || 'Searching...'}
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-3" />
                    Search Properties
                  </>
                )}
              </Button>
              {hasSearched && properties.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{properties.length} properties loaded</span>
                  <Badge variant="secondary" className="text-xs">
                    {properties.filter(p => p.zestimate && p.zestimate > 0).length} with Zestimates
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="max-w-6xl mx-auto animate-fade-in">
          <AIWholesaleAnalyzer properties={properties} market={location} />
        </section>
      </main>
      <ChatAssistant />
    </div>
  );
}
