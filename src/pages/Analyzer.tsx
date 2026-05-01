import { useState, useEffect } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { AIWholesaleAnalyzer } from '@/components/AIWholesaleAnalyzer';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { Property } from '@/types/zillow';
import { useNavigate } from 'react-router-dom';

// Shared cache key — the main search page writes to this
const SEARCH_CACHE_KEY = 'aiw_search_results';
const SEARCH_LOCATION_KEY = 'aiw_search_location';

export default function Analyzer() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [qualifiedDeals, setQualifiedDeals] = useState<Property[]>([]);
  const [location, setLocation] = useState('');
  const navigate = useNavigate();

  // Load cached search results from the main search page
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SEARCH_CACHE_KEY);
      const cachedLocation = sessionStorage.getItem(SEARCH_LOCATION_KEY);

      if (cached) {
        const allProperties: Property[] = JSON.parse(cached);
        setProperties(allProperties);
        setLocation(cachedLocation || '');

        // Filter to only $30K+ spread deals
        const deals = allProperties.filter(p =>
          p.price && p.zestimate && (p.zestimate - p.price) >= 30000
        );
        setQualifiedDeals(deals);
      }
    } catch (e) {
      console.error('Failed to load cached search results:', e);
    }
  }, []);

  const totalProperties = properties.length;
  const withZestimates = properties.filter(p => p.zestimate && p.zestimate > 0).length;
  const dealCount = qualifiedDeals.length;
  const totalSpread = qualifiedDeals.reduce((sum, p) =>
    sum + ((p.zestimate || 0) - (p.price || 0)), 0
  );

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-8">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">AI Deal Analyzer</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            AI-powered analysis on your best deals with $30K+ spreads
          </p>
        </section>

        {/* Status Card */}
        <section className="max-w-3xl mx-auto animate-fade-in">
          {dealCount > 0 ? (
            <Card className="border-cyan-500/20 bg-cyan-500/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {dealCount} Qualified Deal{dealCount !== 1 ? 's' : ''} Ready for AI Analysis
                    </h3>
                    <p className="text-xs text-neutral-400">
                      From your search in <span className="text-cyan-400 font-medium">{location}</span> — only properties with $30K+ spreads
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total Searched</div>
                    <div className="text-lg font-bold text-white mt-0.5">{totalProperties}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">With Zestimates</div>
                    <div className="text-lg font-bold text-white mt-0.5">{withZestimates}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-cyan-400/70">$30K+ Deals</div>
                    <div className="text-lg font-bold text-cyan-400 mt-0.5">{dealCount}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-green-400/70">Total Spread</div>
                    <div className="text-lg font-bold text-green-400 mt-0.5">
                      ${totalSpread >= 1000000 ? `${(totalSpread / 1000000).toFixed(1)}M` : `${(totalSpread / 1000).toFixed(0)}K`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/[0.06]">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-xl bg-neutral-800 flex items-center justify-center mx-auto">
                  <AlertTriangle className="h-7 w-7 text-neutral-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">No properties to analyze</h3>
                  <p className="text-sm text-neutral-400 max-w-md mx-auto">
                    Search for properties first, then come back here. The AI Analyzer will automatically
                    pull your search results and focus on deals with $30K+ spreads to save AI tokens.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/app')}
                  className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                >
                  <TrendingUp className="h-4 w-4" /> Search Properties First <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Analyzer — only shows qualified deals */}
        {dealCount > 0 && (
          <section className="max-w-6xl mx-auto animate-fade-in">
            <AIWholesaleAnalyzer properties={qualifiedDeals} market={location} />
          </section>
        )}
      </main>
      <ChatAssistant />
    </div>
  );
}
