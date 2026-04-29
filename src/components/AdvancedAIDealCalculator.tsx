import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ai } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const ZILLOW_API_URL = import.meta.env.VITE_ZILLOW_API_URL || 'https://api.aiwholesail.com/zillow';
import { 
  Calculator, 
  Brain, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Clock,
  Target,
  Star,
  Zap,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';

interface PropertyPhoto {
  url: string;
  room_type: string;
  description?: string;
}

interface AdvancedRepairAssessment {
  category: string;
  subcategory?: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical' | 'emergency';
  estimated_cost: number;
  cost_range: { min: number; max: number };
  confidence_score: number;
  description: string;
  location: string;
  priority: number;
  urgency: 'immediate' | 'within_week' | 'within_month' | 'routine';
  detected_materials?: string[];
  safety_concerns?: string[];
  code_violations?: string[];
  recommended_action: string;
  prevention_tips?: string;
  ai_model_used: string;
}

interface PropertyConditionReport {
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor' | 'distressed' | 'condemned';
  total_repair_estimate: number;
  confidence_score: number;
  repairs: AdvancedRepairAssessment[];
  photos_analyzed: number;
  assessment_timestamp: string;
  market_value_impact: number;
  investment_recommendation: 'strong_buy' | 'buy' | 'hold' | 'pass' | 'avoid';
  risk_factors: string[];
  opportunities: string[];
}

interface DealMetrics {
  arv: number;
  original_arv: number;
  market_adjustment: number;
  estimated_repairs: number;
  max_offer: number;
  wholesale_fee: number;
  max_purchase_price: number;
  profit_margin: number;
  deal_grade: string;
  risk_score: number;
  opportunity_score: number;
  roi_potential: number;
  condition_assessment: PropertyConditionReport;
  investment_recommendation: string;
  risk_factors: string[];
  opportunities: string[];
}

interface AdvancedAIDealCalculatorProps {
  property: any; // Property object with zpid, photos, etc.
}

const AdvancedAIDealCalculator: React.FC<AdvancedAIDealCalculatorProps> = ({
  property
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dealMetrics, setDealMetrics] = useState<DealMetrics | null>(null);
  const [progress, setProgress] = useState(0);
  const [arv, setArv] = useState(property.zestimate || property.price || 250000);
  const [acquisitionCosts, setAcquisitionCosts] = useState(2000);
  const [wholesaleFee, setWholesaleFee] = useState(5000);
  const [propertyPhotos, setPropertyPhotos] = useState<PropertyPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const { toast } = useToast();

  // Fetch property photos when component mounts
  const fetchPropertyPhotos = async () => {
    const zpid = property.zpid || property.id;
    if (!zpid) return;

    setLoadingPhotos(true);
    try {
      const response = await fetch(ZILLOW_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'photos',
          searchParams: { zpid }
        })
      });

      const photosResponse = await response.json();

      if (photosResponse?.success && photosResponse?.data?.images) {
        const photos = photosResponse.data.images.slice(0, 8).map((img: any, index: number) => ({
          url: img.url || img.mixedSources?.jpeg?.[0]?.url,
          room_type: img.caption || `Room ${index + 1}`,
          description: img.caption
        })).filter((photo: PropertyPhoto) => photo.url);

        setPropertyPhotos(photos);
        toast({
          title: "Photos Loaded",
          description: `Found ${photos.length} property photos for AI analysis`,
        });
      }
    } catch (error) {
      console.warn('Could not fetch property photos:', error);
      toast({
        title: "Photos Unavailable",
        description: "Property photos could not be loaded. Analysis will proceed without visual data.",
        variant: "destructive"
      });
    }
    setLoadingPhotos(false);
  };

  React.useEffect(() => {
    fetchPropertyPhotos();
  }, [property.zpid, property.id]);

  const runComprehensiveAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 800);

      const response = await ai.advancedPropertyAssessment({
        property: {
          zpid: property.zpid || property.id,
          address: property.address,
          price: property.price,
          zestimate: property.zestimate,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          sqft: property.sqft,
          yearBuilt: property.yearBuilt,
          propertyType: property.propertyType,
          lotSize: property.lotSize,
          photos: propertyPhotos
        },
        arv,
        acquisition_costs: acquisitionCosts,
        wholesale_fee: wholesaleFee,
        analysisOptions: {
          includePhotos: propertyPhotos.length > 0,
          includeMarketAnalysis: true,
          includeInvestmentMetrics: true,
          includeRiskAssessment: true
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.error) throw new Error(response.error);

      if ((response.data as any)?.success) {
        setDealMetrics((response.data as any).deal_metrics);

        toast({
          title: "🎯 Advanced Analysis Complete",
          description: `Deal Grade: ${(response.data as any).deal_metrics.deal_grade} | Investment: ${(response.data as any).deal_metrics.investment_recommendation}`,
        });
      } else {
        throw new Error((response.data as any)?.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Advanced deal analysis error:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to complete comprehensive deal analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600 bg-green-50 border-green-200';
    if (grade.startsWith('B')) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (grade.startsWith('C')) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'emergency':
      case 'critical':
        return 'destructive';
      case 'major':
        return 'default';
      case 'moderate':
        return 'secondary';
      case 'minor':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation.toLowerCase()) {
      case 'strong_buy':
        return <Star className="h-4 w-4 text-green-600" />;
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'hold':
        return <Activity className="h-4 w-4 text-yellow-500" />;
      case 'pass':
        return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case 'avoid':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Input Parameters
            </CardTitle>
            <CardDescription>
              Adjust these values for accurate analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arv">After Repair Value (ARV)</Label>
              <Input
                id="arv"
                type="number"
                value={arv}
                onChange={(e) => setArv(Number(e.target.value))}
                placeholder="Estimated ARV"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acquisition">Acquisition Costs</Label>
              <Input
                id="acquisition"
                type="number"
                value={acquisitionCosts}
                onChange={(e) => setAcquisitionCosts(Number(e.target.value))}
                placeholder="Closing costs, inspections, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wholesale">Wholesale Fee</Label>
              <Input
                id="wholesale"
                type="number"
                value={wholesaleFee}
                onChange={(e) => setWholesaleFee(Number(e.target.value))}
                placeholder="Expected wholesale fee"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Property Photos
            </CardTitle>
            <CardDescription>
              {propertyPhotos.length > 0 
                ? `${propertyPhotos.length} photos loaded for AI analysis` 
                : 'Loading property photos...'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPhotos ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Loading photos...
              </div>
            ) : propertyPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {propertyPhotos.slice(0, 6).map((photo, index) => (
                  <div key={index} className="relative aspect-square">
                    <img 
                      src={photo.url} 
                      alt={photo.room_type}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b-lg truncate">
                      {photo.room_type}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No photos available</p>
                <Button 
                  onClick={fetchPropertyPhotos} 
                  variant="outline" 
                  size="sm"
                  className="mt-2"
                >
                  Try Loading Photos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Advanced AI Deal Calculator
          </CardTitle>
          <CardDescription>
            State-of-the-art property assessment using Claude Sonnet 4 & GPT-4o
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Photos Available: {propertyPhotos.length}</span>
              <span>ZPID: {property.zpid || property.id}</span>
            </div>
            
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Running comprehensive AI analysis...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Analyzing with Claude Sonnet 4 & GPT-4o • Processing {propertyPhotos.length} photos
                </p>
              </div>
            )}
            
            <Button 
              onClick={runComprehensiveAnalysis}
              disabled={isAnalyzing}
              className="w-full"
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Zap className="mr-2 h-4 w-4 animate-pulse" />
                  Analyzing Property...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Run Advanced Deal Analysis
                  {propertyPhotos.length === 0 && (
                    <span className="ml-2 text-xs opacity-75">(without photos)</span>
                  )}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {dealMetrics && (
        <div className="space-y-6">
          {/* Deal Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Deal Grade</p>
                    <div className={`text-2xl font-bold px-3 py-1 rounded-lg border ${getGradeColor(dealMetrics.deal_grade)}`}>
                      {dealMetrics.deal_grade}
                    </div>
                  </div>
                  <Target className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Max Purchase</p>
                    <p className="text-2xl font-bold">{formatCurrency(dealMetrics.max_purchase_price)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
                    <p className="text-2xl font-bold">{Math.round(dealMetrics.risk_score)}/100</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ROI Potential</p>
                    <p className="text-2xl font-bold">{formatPercentage(dealMetrics.roi_potential)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analysis */}
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="metrics">Deal Metrics</TabsTrigger>
              <TabsTrigger value="repairs">Repair Analysis</TabsTrigger>
              <TabsTrigger value="market">Market Impact</TabsTrigger>
              <TabsTrigger value="recommendation">Investment Rec</TabsTrigger>
            </TabsList>
            
            <TabsContent value="metrics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Original ARV:</span>
                        <span className="font-medium">{formatCurrency(dealMetrics.original_arv)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Market Adjustment:</span>
                        <span className={`font-medium ${dealMetrics.market_adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(dealMetrics.market_adjustment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Adjusted ARV:</span>
                        <span className="font-medium">{formatCurrency(dealMetrics.arv)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimated Repairs:</span>
                        <span className="font-medium">{formatCurrency(dealMetrics.estimated_repairs)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Acquisition Costs:</span>
                        <span className="font-medium">{formatCurrency(acquisitionCosts)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Wholesale Fee:</span>
                        <span className="font-medium">{formatCurrency(dealMetrics.wholesale_fee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Offer (70% Rule):</span>
                        <span className="font-medium">{formatCurrency(dealMetrics.max_offer)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">Max Purchase Price:</span>
                        <span className="font-bold text-lg">{formatCurrency(dealMetrics.max_purchase_price)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="repairs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Property Assessment</CardTitle>
                  <CardDescription>
                    Condition: {dealMetrics.condition_assessment.overall_condition} | 
                    Confidence: {Math.round(dealMetrics.condition_assessment.confidence_score * 100)}% |
                    Photos: {dealMetrics.condition_assessment.photos_analyzed}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dealMetrics.condition_assessment.repairs.length > 0 ? (
                      dealMetrics.condition_assessment.repairs.map((repair, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={getSeverityColor(repair.severity)}>
                                {repair.severity}
                              </Badge>
                              <span className="font-medium">{repair.category}</span>
                              {repair.subcategory && (
                                <span className="text-sm text-muted-foreground">• {repair.subcategory}</span>
                              )}
                            </div>
                            <span className="font-semibold">{formatCurrency(repair.estimated_cost)}</span>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">{repair.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Location:</span>
                              <p className="font-medium">{repair.location}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Urgency:</span>
                              <p className="font-medium">{repair.urgency.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Confidence:</span>
                              <p className="font-medium">{Math.round(repair.confidence_score * 100)}%</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">AI Model:</span>
                              <p className="font-medium">{repair.ai_model_used}</p>
                            </div>
                          </div>
                          
                          {repair.safety_concerns && repair.safety_concerns.length > 0 && (
                            <Alert className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Safety Concerns</AlertTitle>
                              <AlertDescription>
                                {repair.safety_concerns.join(', ')}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p>No significant issues detected</p>
                        <p className="text-sm">Property appears to be in good condition</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="market" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Market Impact Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Value Impact</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Market Adjustment:</span>
                          <span className={`font-medium ${dealMetrics.condition_assessment.market_value_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(dealMetrics.condition_assessment.market_value_impact)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Opportunity Score:</span>
                          <span className="font-medium">{Math.round(dealMetrics.opportunity_score)}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Assessment:</span>
                          <span className="font-medium">{Math.round(dealMetrics.risk_score)}/100</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Scoring Breakdown</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Opportunity Score</span>
                            <span>{Math.round(dealMetrics.opportunity_score)}%</span>
                          </div>
                          <Progress value={dealMetrics.opportunity_score} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Risk Score</span>
                            <span>{Math.round(dealMetrics.risk_score)}%</span>
                          </div>
                          <Progress value={dealMetrics.risk_score} className="h-2 bg-red-100" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Confidence</span>
                            <span>{Math.round(dealMetrics.condition_assessment.confidence_score * 100)}%</span>
                          </div>
                          <Progress value={dealMetrics.condition_assessment.confidence_score * 100} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="recommendation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getRecommendationIcon(dealMetrics.investment_recommendation)}
                    Investment Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <Badge variant="outline" className="text-lg px-4 py-2 mb-4">
                        {dealMetrics.investment_recommendation.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3 text-red-600">Risk Factors</h4>
                          <ul className="space-y-2">
                            {dealMetrics.risk_factors.map((risk, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-3 text-green-600">Opportunities</h4>
                          <ul className="space-y-2">
                            {dealMetrics.opportunities.map((opportunity, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{opportunity}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Analysis Summary</h4>
                      <p className="text-sm text-muted-foreground">
                        Based on comprehensive AI analysis of {dealMetrics.condition_assessment.photos_analyzed} photos, 
                        this property has an overall condition of "{dealMetrics.condition_assessment.overall_condition}" 
                        with {dealMetrics.condition_assessment.repairs.length} identified repair items totaling {formatCurrency(dealMetrics.estimated_repairs)}. 
                        The AI models achieved {Math.round(dealMetrics.condition_assessment.confidence_score * 100)}% confidence 
                        in their assessment.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default AdvancedAIDealCalculator;