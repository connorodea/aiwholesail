import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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
    if (!propertyUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a property URL to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/supabase/functions/v1/analyze-deal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ property_url: propertyUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze deal');
      }

      const data: DealAnalysisResponse = await response.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        toast({
          title: "Analysis Complete",
          description: "AI deal analysis has been generated successfully",
        });
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze deal",
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