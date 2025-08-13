import React, { useState } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Home,
  MapPin,
  Calendar,
  Users,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface AIPropertyAnalyzerProps {
  property: Property;
}

interface AIAnalysisResult {
  wholesaleScore: number;
  investmentGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  keyInsights: string[];
  marketAnalysis: string;
  repairEstimate: number;
  potentialARV: number;
  recommendations: string[];
  riskFactors: string[];
  opportunityScore: number;
  fullAnalysis: string;
}

export function AIPropertyAnalyzer({ property }: AIPropertyAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeProperty = async () => {
    setIsLoading(true);
    try {
      const propertyData = {
        address: property.address,
        price: property.price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        yearBuilt: property.yearBuilt,
        lotSize: property.lotSize,
        daysOnMarket: property.daysOnMarket,
        pricePerSqft: property.pricePerSqft,
        zestimate: property.zestimate,
        propertyType: property.propertyType,
        status: property.status,
        isFSBO: property.isFSBO,
        description: property.description
      };

      const { data, error } = await supabase.functions.invoke('ai-property-analysis', {
        body: { property: propertyData }
      });

      if (error) {
        console.error('AI Analysis Error:', error);
        throw error;
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast.success('AI analysis completed!');
      } else {
        throw new Error('No analysis data received');
      }
    } catch (error) {
      console.error('Error analyzing property:', error);
      toast.error('Failed to analyze property. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-success text-success-foreground';
      case 'B': return 'bg-info text-info-foreground';
      case 'C': return 'bg-warning text-warning-foreground';
      case 'D': return 'bg-destructive/80 text-destructive-foreground';
      case 'F': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-info';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {!analysis && !isLoading && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Property Analysis</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Get detailed insights about this property's wholesale potential, market positioning, and investment opportunities using advanced AI analysis.
            </p>
            <Button onClick={analyzeProperty} size="lg" className="gap-2">
              <Zap className="h-4 w-4" />
              Analyze Property
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 animate-pulse text-primary" />
              <CardTitle>Analyzing Property...</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Analysis Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Investment Grade</div>
                  <Badge className={`text-lg font-bold ${getGradeColor(analysis.investmentGrade)}`}>
                    {analysis.investmentGrade}
                  </Badge>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Wholesale Score</div>
                  <div className={`text-2xl font-bold ${getScoreColor(analysis.wholesaleScore)}`}>
                    {analysis.wholesaleScore}/100
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Opportunity Score</div>
                  <div className={`text-2xl font-bold ${getScoreColor(analysis.opportunityScore)}`}>
                    {analysis.opportunityScore}/100
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Potential ARV</div>
                  <div className="text-lg font-bold text-success">
                    {formatPrice(analysis.potentialARV)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.keyInsights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{insight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-success" />
                  Financial Estimates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-semibold">{formatPrice(property.price || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Estimated Repairs</span>
                  <span className="font-semibold text-warning">{formatPrice(analysis.repairEstimate)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Potential ARV</span>
                  <span className="font-semibold text-success">{formatPrice(analysis.potentialARV)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Estimated Spread</span>
                  <span className="font-bold text-primary">
                    {formatPrice(analysis.potentialARV - (property.price || 0) - analysis.repairEstimate)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.riskFactors.map((risk, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{risk}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Market Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-info" />
                Market Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <ReactMarkdown>{analysis.marketAnalysis}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{recommendation}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          {analysis.fullAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-accent" />
                  Detailed Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <ReactMarkdown>{analysis.fullAnalysis}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regenerate Button */}
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={analyzeProperty}
              disabled={isLoading}
              className="gap-2"
            >
              <Brain className="h-4 w-4" />
              Regenerate Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}