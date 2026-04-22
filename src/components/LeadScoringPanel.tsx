import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Phone, 
  Brain,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Target
} from 'lucide-react';
import { ai, leads } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface ScoringFactor {
  factor: string;
  weight: number;
  impact: 'positive' | 'negative';
  description: string;
}

interface LeadScores {
  id: string;
  motivation_score: number;
  urgency_score: number;
  profitability_score: number;
  contactability_score: number;
  overall_score: number;
  confidence_score: number;
  scoring_factors: any; // Using any to handle JSON from database
  last_updated: string;
}

interface LeadScoringPanelProps {
  leadId: string;
  propertyData?: any;
}

export function LeadScoringPanel({ leadId, propertyData }: LeadScoringPanelProps) {
  const [scores, setScores] = useState<LeadScores | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Validate UUID format
  const isValidUUID = (value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  };

  // Generate a safe UUID (browser crypto if available, fallback simple)
  const generateUUID = () => {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      // @ts-ignore
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const loadScores = async (forceRescore = false) => {
    try {
      setIsLoading(true);
      if (forceRescore) setIsRefreshing(true);

      const uuidValid = isValidUUID(leadId);
      const effectiveLeadId = uuidValid ? leadId : generateUUID();

      // Only try to load existing scores from DB when we have a real lead UUID and not forcing rescore
      if (uuidValid && !forceRescore) {
        const response = await leads.get(leadId);
        if (response.data?.overall_score) {
          setScores({
            id: leadId,
            motivation_score: response.data.motivation_score || 0,
            urgency_score: response.data.urgency_score || 0,
            profitability_score: response.data.profitability_score || 0,
            contactability_score: response.data.contactability_score || 0,
            overall_score: response.data.overall_score || 0,
            confidence_score: response.data.confidence_score || 0,
            scoring_factors: response.data.scoring_factors || [],
            last_updated: response.data.last_updated || new Date().toISOString()
          });
          setIsLoading(false);
          return;
        }
      }

      // Call AI scoring function
      const response = await ai.leadScoring(propertyData || generateMockIntelligence(), uuidValid ? effectiveLeadId : undefined);

      if (response.error) throw new Error(response.error);

      const scoringData = response.data?.scoring || {
        overallScore: 500,
        motivationScore: 50,
        urgencyScore: 50,
        profitabilityScore: 50,
        contactabilityScore: 50,
        confidenceScore: 70,
        scoringFactors: []
      };

      const calculatedScore = scoringData.overallScore * 10 || 0;
      setScores({
        id: effectiveLeadId,
        motivation_score: scoringData.motivationScore * 10 || 0,
        urgency_score: scoringData.urgencyScore || 0,
        profitability_score: scoringData.profitabilityScore || 0,
        contactability_score: scoringData.contactabilityScore || 0,
        overall_score: calculatedScore,
        confidence_score: scoringData.confidenceScore || 0,
        scoring_factors: scoringData.scoringFactors || [],
        last_updated: new Date().toISOString()
      });

      if (!response.data?.cached) {
        toast({
          title: 'Lead Scored Successfully',
          description: `Overall score: ${calculatedScore}/1000`,
        });
      }

    } catch (error) {
      console.error('Error loading lead scores:', error);
      toast({
        title: 'Scoring Error',
        description: 'Failed to calculate lead scores. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const generateMockIntelligence = () => {
    // Generate mock intelligence based on property data if available
    return {
      tax_delinquent: false,
      foreclosure_risk: false,
      probate_property: false,
      divorce_related: false,
      bankruptcy_risk: false,
      inheritance_property: false,
      financial_distress: false,
      absentee_owner: propertyData?.ownerOccupied === false,
      occupancy_status: propertyData?.occupancyStatus || 'unknown',
      property_condition: 'fair',
      active_liens: [],
      code_violations: [],
      estimated_equity: propertyData?.equity,
      equity_percentage: propertyData?.equity ? (propertyData.equity / propertyData.price) * 100 : undefined
    };
  };

  useEffect(() => {
    if (leadId) {
      loadScores();
    }
  }, [leadId]);

  const getScoreColor = (score: number, max: number = 1000) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number, max: number = 1000) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return 'default'; // Green
    if (percentage >= 50) return 'secondary'; // Yellow
    return 'destructive'; // Red
  };

  const getPriorityLevel = (score: number) => {
    if (score >= 700) return { level: 'HOT', icon: AlertTriangle, color: 'text-red-500' };
    if (score >= 500) return { level: 'WARM', icon: Target, color: 'text-yellow-500' };
    if (score >= 300) return { level: 'COLD', icon: CheckCircle, color: 'text-blue-500' };
    return { level: 'LOW', icon: CheckCircle, color: 'text-gray-500' };
  };

  if (isLoading && !scores) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Lead Scoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Analyzing lead...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scores) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Lead Scoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Lead scoring data not available</p>
            <Button onClick={() => loadScores(true)}>
              Generate Score
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priority = getPriorityLevel(scores.overall_score);
  const PriorityIcon = priority.icon;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Lead Scoring
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadScores(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PriorityIcon className={`h-5 w-5 ${priority.color}`} />
            <Badge variant={getScoreBadgeVariant(scores.overall_score)} className="text-lg px-3 py-1">
              {priority.level} LEAD
            </Badge>
          </div>
          <div className="text-4xl font-bold mb-2">
            <span className={getScoreColor(scores.overall_score)}>
              {scores.overall_score}
            </span>
            <span className="text-2xl text-muted-foreground">/1000</span>
          </div>
          <Progress value={(scores.overall_score / 1000) * 100} className="h-3 mb-2" />
          <p className="text-sm text-muted-foreground">
            Confidence: {scores.confidence_score}% • Updated {new Date(scores.last_updated).toLocaleDateString()}
          </p>
        </div>

        <Separator />

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Motivation</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={(scores.motivation_score / 1000) * 100} className="flex-1 h-2" />
              <span className={`text-sm font-bold ${getScoreColor(scores.motivation_score)}`}>
                {scores.motivation_score}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Urgency</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={scores.urgency_score} className="flex-1 h-2" />
              <span className={`text-sm font-bold ${getScoreColor(scores.urgency_score, 100)}`}>
                {scores.urgency_score}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Profitability</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={scores.profitability_score} className="flex-1 h-2" />
              <span className={`text-sm font-bold ${getScoreColor(scores.profitability_score, 100)}`}>
                {scores.profitability_score}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Contact</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={scores.contactability_score} className="flex-1 h-2" />
              <span className={`text-sm font-bold ${getScoreColor(scores.contactability_score, 100)}`}>
                {scores.contactability_score}
              </span>
            </div>
          </div>
        </div>

        {/* Scoring Factors */}
        {scores.scoring_factors && scores.scoring_factors.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-3">Key Factors</h4>
              <div className="space-y-2">
                {scores.scoring_factors
                  .sort((a, b) => b.weight - a.weight)
                  .slice(0, 5)
                  .map((factor, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="flex-1">{factor.factor}</span>
                      <Badge variant={factor.impact === 'positive' ? 'default' : 'destructive'} className="text-xs px-1">
                        +{factor.weight}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}