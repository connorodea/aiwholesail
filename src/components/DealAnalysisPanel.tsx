import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface DealAnalysisResponse {
  analysis: string;
  success: boolean;
  error?: string;
}

export function DealAnalysisPanel() {
  const [propertyUrl, setPropertyUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const { toast } = useToast();

  const analyzeDeal = async () => {
    // Input validation
    if (!propertyUrl.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a property URL.",
        variant: "destructive",
      });
      return;
    }

    // Enhanced URL validation with comprehensive regex
    try {
      const url = new URL(propertyUrl);
      const allowedDomains = [
        'zillow.com',
        'realty.com', 
        'realtor.com',
        'homes.com',
        'redfin.com',
        'trulia.com'
      ];
      
      const isValidDomain = allowedDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith('.' + domain)
      );
      
      if (!isValidDomain) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid property URL from a supported real estate website (Zillow, Realtor.com, Redfin, etc.).",
          variant: "destructive",
        });
        return;
      }

      // Additional URL structure validation
      const propertyPathPattern = /\/(homedetails|property|listing|homes?)\//i;
      if (!propertyPathPattern.test(url.pathname)) {
        toast({
          title: "Invalid Property URL",
          description: "Please ensure the URL is a direct link to a property listing page.",
          variant: "destructive",
        });
        return;
      }
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid property URL.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-deal', {
        body: { property_url: propertyUrl }
      });

      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        setAnalysis(data.analysis);
        toast({
          title: "Analysis Complete",
          description: "Property analysis has been generated successfully.",
        });
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing deal:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the property deal.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI Deal Analysis
          </CardTitle>
          <CardDescription>
            Get comprehensive investment analysis for any property using AI. Enter a Zillow or similar property URL below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property-url">Property URL</Label>
            <Input
              id="property-url"
              type="url"
              placeholder="https://www.zillow.com/homedetails/..."
              value={propertyUrl}
              onChange={(e) => setPropertyUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button 
            onClick={analyzeDeal} 
            disabled={isLoading || !propertyUrl.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Deal...
              </>
            ) : (
              'Analyze Deal'
            )}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Investment Analysis Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}