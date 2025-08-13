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
    <div className="space-y-8">
      {!analysis && !isLoading && (
        <Card className="border-2 border-dashed border-border/30 bg-gradient-to-br from-muted/5 via-background to-muted/10 rounded-2xl shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 mb-6 shadow-inner">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">AI Property Analysis</h3>
            <p className="text-muted-foreground mb-8 max-w-lg leading-relaxed">
              Get detailed insights about this property's wholesale potential, market positioning, and investment opportunities using advanced AI analysis.
            </p>
            <Button onClick={analyzeProperty} size="lg" className="gap-3 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 py-3">
              <Zap className="h-5 w-5" />
              Analyze Property
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-muted/5">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Brain className="h-6 w-6 animate-pulse text-primary" />
              </div>
              <CardTitle className="text-xl">Analyzing Property...</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <div className="grid grid-cols-2 gap-6 mt-8">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="space-y-8">
          {/* Analysis Overview */}
          <Card className="rounded-2xl shadow-xl border-border/50 bg-gradient-to-br from-background via-background to-primary/5">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                AI Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl border border-border/30 shadow-inner">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">Investment Grade</div>
                  <Badge className={`text-lg font-bold px-4 py-2 rounded-xl ${getGradeColor(analysis.investmentGrade)}`}>
                    {analysis.investmentGrade}
                  </Badge>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl border border-border/30 shadow-inner">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">Wholesale Score</div>
                  <div className={`text-3xl font-bold ${getScoreColor(analysis.wholesaleScore)}`}>
                    {analysis.wholesaleScore}/100
                  </div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl border border-border/30 shadow-inner">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">Opportunity Score</div>
                  <div className={`text-3xl font-bold ${getScoreColor(analysis.opportunityScore)}`}>
                    {analysis.opportunityScore}/100
                  </div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-success/10 to-success/5 rounded-2xl border border-success/20 shadow-inner">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">Potential ARV</div>
                  <div className="text-2xl font-bold text-success">
                    {formatPrice(analysis.potentialARV)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-success/5">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-xl bg-success/10">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.keyInsights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border/30 shadow-sm">
                    <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5">
                      <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                    </div>
                    <span className="text-sm leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-success/5">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-success/10">
                    <DollarSign className="h-6 w-6 text-success" />
                  </div>
                  Financial Estimates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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

            <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-warning/5">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <AlertTriangle className="h-6 w-6 text-warning" />
                  </div>
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.riskFactors.map((risk, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-warning/15 to-warning/5 rounded-xl border border-warning/30 shadow-sm">
                      <div className="p-1.5 rounded-lg bg-warning/20 mt-0.5">
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                      </div>
                      <span className="text-sm leading-relaxed">{risk}</span>
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
          <div className="flex justify-center pt-4">
            <Button 
              variant="outline" 
              onClick={analyzeProperty}
              disabled={isLoading}
              className="gap-3 rounded-xl border-border/50 hover:shadow-md transition-all duration-300 px-6 py-3"
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