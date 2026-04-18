import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ai } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { 
  Brain, 
  Camera, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Zap,
  Eye,
  Target
} from 'lucide-react';

interface AdvancedDamageAnalysis {
  damage_type: string;
  severity: string;
  cost_estimate: number;
  fusion_confidence: number;
  supporting_models: string[];
  detection_consensus: number;
  timeline_days: number;
  market_adjustments?: {
    labor_multiplier: number;
    material_inflation: number;
    permit_costs: number;
    seasonal_factor: number;
    supply_chain_impact: number;
  };
  adjusted_timeline?: number;
}

interface AdvancedDamageDetectionProps {
  photoUrl: string;
  roomType: string;
  zpid?: string;
}

const AdvancedDamageDetection: React.FC<AdvancedDamageDetectionProps> = ({
  photoUrl,
  roomType,
  zpid
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AdvancedDamageAnalysis[]>([]);
  const [analysisMetadata, setAnalysisMetadata] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const runAdvancedAnalysis = async () => {
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
          return prev + Math.random() * 15;
        });
      }, 500);

      const response = await ai.damageDetection({
        photo_url: photoUrl,
        room_type: roomType,
        zpid
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.error) throw new Error(response.error);

      if (response.data?.success) {
        setAnalysis(response.data.analysis);
        setAnalysisMetadata({
          models_used: response.data.models_used,
          analysis_timestamp: response.data.analysis_timestamp
        });

        toast({
          title: "🔬 Advanced Analysis Complete",
          description: `Detected ${response.data.analysis.length} potential issues using state-of-the-art AI models`,
        });
      } else {
        throw new Error(response.data?.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Advanced damage detection error:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to complete advanced damage detection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
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

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'emergency':
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'major':
        return <TrendingUp className="h-4 w-4" />;
      case 'moderate':
        return <Clock className="h-4 w-4" />;
      case 'minor':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
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

  const totalCost = analysis.reduce((sum, item) => sum + item.cost_estimate, 0);
  const avgConfidence = analysis.length > 0 
    ? analysis.reduce((sum, item) => sum + item.fusion_confidence, 0) / analysis.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            State-of-the-Art Damage Detection
          </CardTitle>
          <CardDescription>
            AI-powered analysis using Claude Sonnet 4, GPT-4o, and Gemini Pro Vision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img 
                src={photoUrl} 
                alt={`${roomType} analysis`}
                className="w-24 h-24 object-cover rounded-lg border"
              />
              <div className="flex-1">
                <p className="font-medium">{roomType}</p>
                <p className="text-sm text-muted-foreground">
                  Multi-model AI analysis with ensemble fusion
                </p>
              </div>
            </div>
            
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Running AI analysis...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Processing with Claude, GPT-4o, and Gemini models
                </p>
              </div>
            )}
            
            <Button 
              onClick={runAdvancedAnalysis}
              disabled={isAnalyzing}
              className="w-full"
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Zap className="mr-2 h-4 w-4 animate-pulse" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Run Advanced Analysis
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis.length > 0 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Repair Cost</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Issues Detected</p>
                    <p className="text-2xl font-bold">{analysis.length}</p>
                  </div>
                  <Camera className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Confidence</p>
                    <p className="text-2xl font-bold">{Math.round(avgConfidence * 100)}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analysis */}
          <Tabs defaultValue="issues" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="issues">Detected Issues</TabsTrigger>
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
            </TabsList>
            
            <TabsContent value="issues" className="space-y-4">
              {analysis.map((issue, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(issue.severity)}
                        <span className="capitalize">{issue.damage_type}</span>
                      </div>
                      <Badge variant={getSeverityColor(issue.severity)}>
                        {issue.severity}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Estimated Cost</p>
                        <p className="text-lg font-semibold">{formatCurrency(issue.cost_estimate)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Timeline</p>
                        <p className="text-lg font-semibold">
                          {issue.adjusted_timeline || issue.timeline_days} days
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Confidence</p>
                        <p className="text-lg font-semibold">
                          {Math.round(issue.fusion_confidence * 100)}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Model Consensus: {Math.round(issue.detection_consensus)}%
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {issue.supporting_models.map((model, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {model}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {issue.market_adjustments && (
                      <Alert className="mt-4">
                        <TrendingUp className="h-4 w-4" />
                        <AlertTitle>Market Adjustments Applied</AlertTitle>
                        <AlertDescription className="text-xs">
                          Labor: +{Math.round((issue.market_adjustments.labor_multiplier - 1) * 100)}% | 
                          Materials: +{Math.round((issue.market_adjustments.material_inflation - 1) * 100)}% | 
                          Seasonal: +{Math.round((issue.market_adjustments.seasonal_factor - 1) * 100)}%
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            
            <TabsContent value="insights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Analysis Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Models Used</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisMetadata?.models_used?.map((model: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {model}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Analysis Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Issues:</span>
                          <span className="ml-2 font-medium">{analysis.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">High Confidence:</span>
                          <span className="ml-2 font-medium">
                            {analysis.filter(a => a.fusion_confidence > 0.8).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Critical/Major:</span>
                          <span className="ml-2 font-medium">
                            {analysis.filter(a => ['critical', 'major'].includes(a.severity.toLowerCase())).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Analyzed:</span>
                          <span className="ml-2 font-medium">
                            {analysisMetadata?.analysis_timestamp ? 
                              new Date(analysisMetadata.analysis_timestamp).toLocaleTimeString() : 
                              'Just now'
                            }
                          </span>
                        </div>
                      </div>
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

export default AdvancedDamageDetection;