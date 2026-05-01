import React, { useState, useEffect } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  Loader2,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Wrench,
  ImageOff,
  Zap,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import { ai } from '@/lib/api-client';
import { zillowAPI } from '@/lib/zillow-api';
import { toast } from 'sonner';

interface AIPhotoAnalysisProps {
  property: Property;
}

interface PhotoIssue {
  category: string;
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  estimatedCost: number;
}

interface PhotoAnalysisResult {
  overallCondition: 'excellent' | 'good' | 'fair' | 'poor';
  conditionScore: number;
  issues: PhotoIssue[];
  totalRehabEstimate: { low: number; high: number };
  prioritizedRepairs: string[];
  investmentAdvice: string;
}

export function AIPhotoAnalysis({ property }: AIPhotoAnalysisProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch property photos on mount
  useEffect(() => {
    const fetchPhotos = async () => {
      setIsLoadingPhotos(true);
      try {
        // Use existing images from property data first
        const existingImages = property.images || [];
        const imageUrl = (property as any).imageUrl || (property as any).imgSrc;

        if (existingImages.length > 0) {
          setPhotos(existingImages.slice(0, 8));
          setIsLoadingPhotos(false);
          return;
        }

        // Fetch from Zillow API
        const zpid = property.zpid || property.id;
        if (!zpid) {
          if (imageUrl) setPhotos([imageUrl]);
          setIsLoadingPhotos(false);
          return;
        }

        const data = await zillowAPI.getPropertyPhotos(zpid);

        if (data && Array.isArray(data)) {
          const photoUrls = data
            .map((photo: any) =>
              photo.url || photo.href || photo.mixedSources?.jpeg?.[0]?.url || photo
            )
            .filter((url: any) => typeof url === 'string' && url.startsWith('http'));
          setPhotos(photoUrls.slice(0, 8));
        } else if (data?.photos) {
          const photoUrls = data.photos
            .map((photo: any) => photo.url || photo.href || photo.mixedSources?.jpeg?.[0]?.url)
            .filter((url: any) => url);
          setPhotos(photoUrls.slice(0, 8));
        } else if (imageUrl) {
          setPhotos([imageUrl]);
        }
      } catch (err) {
        console.error('Error fetching property photos:', err);
        const imageUrl = (property as any).imageUrl || (property as any).imgSrc;
        if (imageUrl) setPhotos([imageUrl]);
      } finally {
        setIsLoadingPhotos(false);
      }
    };

    fetchPhotos();
  }, [property]);

  const analyzePhotos = async () => {
    if (photos.length === 0) {
      toast.error('No photos available to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const propertyData = {
        address: property.address,
        price: property.price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
      };

      const response = await ai.photoAnalysis(propertyData, photos);

      if (response.error) {
        throw new Error(response.error);
      }

      const data = response.data as any;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast.success('Photo analysis completed!');
      } else if (data?.rawResponse) {
        // Try to parse raw response as fallback
        try {
          const jsonMatch = data.rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            setAnalysis(JSON.parse(jsonMatch[0]));
            toast.success('Photo analysis completed!');
          } else {
            throw new Error('Could not parse analysis response');
          }
        } catch {
          throw new Error('Failed to parse analysis results');
        }
      } else {
        throw new Error('No analysis data received');
      }
    } catch (err: any) {
      console.error('Photo analysis error:', err);
      const message = err.message || 'Failed to analyze photos. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'good':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'fair':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'poor':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'minor':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'moderate':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'major':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Loading photos state
  if (isLoadingPhotos) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading property photos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <Card className="rounded-2xl shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-xl bg-primary/10">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              Property Photos
              <Badge variant="secondary" className="ml-auto">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img
                    src={photo}
                    alt={`Property photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Photos State */}
      {photos.length === 0 && (
        <Card className="border-2 border-dashed border-border/30 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ImageOff className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">No photos available for this property</p>
            <p className="text-sm text-muted-foreground mt-1">
              Photo analysis requires property images
            </p>
          </CardContent>
        </Card>
      )}

      {/* Analyze Button (before analysis) */}
      {!analysis && !isAnalyzing && photos.length > 0 && (
        <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 mb-5 shadow-inner">
              <Wrench className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Photo Condition Analysis</h3>
            <p className="text-muted-foreground mb-6 max-w-md leading-relaxed text-sm">
              Analyze property photos with AI to assess condition, identify issues, and estimate
              rehab costs based on current 2026 contractor rates.
            </p>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm max-w-md">
                {error}
              </div>
            )}
            <Button
              onClick={analyzePhotos}
              size="lg"
              className="gap-3 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 py-3"
            >
              <Zap className="h-5 w-5" />
              Analyze Photos with AI
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-muted/5">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Camera className="h-6 w-6 animate-pulse text-primary" />
              </div>
              <CardTitle className="text-xl">Analyzing Property Photos...</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              AI is inspecting {photos.length} photo{photos.length !== 1 ? 's' : ''} for condition issues and estimating rehab costs
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <div className="grid grid-cols-2 gap-6 mt-8">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <Skeleton className="h-40 rounded-xl" />
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Condition Overview */}
          <Card className="rounded-2xl shadow-xl border-border/50 bg-gradient-to-br from-background via-background to-primary/5">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                Photo Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Overall Condition Badge */}
                <div className="text-center p-5 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl border border-border/30">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">
                    Overall Condition
                  </div>
                  <Badge
                    className={`text-base font-bold px-4 py-1.5 rounded-xl capitalize ${getConditionColor(analysis.overallCondition)}`}
                  >
                    {analysis.overallCondition}
                  </Badge>
                </div>

                {/* Condition Score Gauge */}
                <div className="text-center p-5 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl border border-border/30">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">
                    Condition Score
                  </div>
                  <div className={`text-3xl font-bold mb-2 ${getScoreColor(analysis.conditionScore)}`}>
                    {analysis.conditionScore}
                    <span className="text-base text-muted-foreground font-normal">/100</span>
                  </div>
                  <div className="relative h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(analysis.conditionScore)}`}
                      style={{ width: `${analysis.conditionScore}%` }}
                    />
                  </div>
                </div>

                {/* Total Rehab Estimate */}
                <div className="text-center p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-2xl border border-amber-500/20">
                  <div className="text-sm text-muted-foreground mb-2 font-medium">
                    Estimated Rehab Cost
                  </div>
                  <div className="text-lg font-bold text-amber-600">
                    {formatCurrency(analysis.totalRehabEstimate.low)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    to {formatCurrency(analysis.totalRehabEstimate.high)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issues Breakdown */}
          {analysis.issues && analysis.issues.length > 0 && (
            <Card className="rounded-2xl shadow-lg border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  Issue Breakdown
                  <Badge variant="secondary" className="ml-auto">
                    {analysis.issues.length} {analysis.issues.length === 1 ? 'issue' : 'issues'} found
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile-friendly card layout */}
                <div className="space-y-3">
                  {analysis.issues.map((issue, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl border border-border/50 bg-gradient-to-r from-muted/20 to-transparent hover:from-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{issue.category}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${getSeverityBadge(issue.severity)}`}
                          >
                            {issue.severity}
                          </Badge>
                        </div>
                        <span className="font-bold text-sm whitespace-nowrap">
                          {formatCurrency(issue.estimatedCost)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {issue.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Total from issues */}
                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Itemized Cost
                  </span>
                  <span className="font-bold text-lg">
                    {formatCurrency(
                      analysis.issues.reduce((sum, issue) => sum + (issue.estimatedCost || 0), 0)
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prioritized Repairs */}
          {analysis.prioritizedRepairs && analysis.prioritizedRepairs.length > 0 && (
            <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-emerald-500/5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <ArrowUpDown className="h-5 w-5 text-emerald-500" />
                  </div>
                  Repairs Prioritized by ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.prioritizedRepairs.map((repair, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/20 to-transparent border border-border/30"
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-600">{index + 1}</span>
                      </div>
                      <span className="text-sm leading-relaxed">{repair}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Investment Advice */}
          {analysis.investmentAdvice && (
            <Card className="rounded-2xl shadow-lg border-border/50 bg-gradient-to-br from-background to-blue-500/5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <Info className="h-5 w-5 text-blue-500" />
                  </div>
                  Investment Advice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {analysis.investmentAdvice}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Re-analyze Button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={analyzePhotos}
              disabled={isAnalyzing}
              className="gap-3 rounded-xl border-border/50 hover:shadow-md transition-all duration-300 px-6 py-3"
            >
              <Camera className="h-4 w-4" />
              Re-Analyze Photos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
