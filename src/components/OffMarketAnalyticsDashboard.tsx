import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { offMarketAPI, type CostAnalytics } from '@/lib/off-market-api';
import { TrendingUp, TrendingDown, DollarSign, Target, Zap, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';

interface OffMarketAnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OffMarketAnalyticsDashboard({ isOpen, onClose }: OffMarketAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<CostAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      
      // Get last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const data = await offMarketAPI.getCostAnalytics(startDate, endDate);
      setAnalytics(data);
      
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: "Analytics Error",
        description: "Failed to load cost analytics data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Ultra-Lean Cost Analytics</h2>
            <p className="text-muted-foreground">95%+ cost savings vs traditional methods</p>
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        ) : analytics ? (
          <div className="p-6 space-y-6">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Cost Per Lead</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        ${analytics.avgCostPerLead.toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">vs $75+ traditional</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Savings</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {analytics.savings.savingsPercentage}%
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">${analytics.savings.savedAmount.toLocaleString()} saved</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">ROI</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {analytics.efficiency.roi}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Monthly ROI</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Quality Leads</p>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {analytics.efficiency.qualityLeads}
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">{analytics.efficiency.conversionRate} conversion</p>
                    </div>
                    <Target className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Cost Breakdown
                  </CardTitle>
                  <CardDescription>Ultra-lean processing pipeline costs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Free Data Sources</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">FREE</Badge>
                        <span className="font-mono">${analytics.costBreakdown.freeDataSources.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">RapidAPI Validation</span>
                      <span className="font-mono">${analytics.costBreakdown.rapidAPIValidation.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">AI Analysis</span>
                      <span className="font-mono">${analytics.costBreakdown.aiAnalysis.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Skip Tracing</span>
                      <span className="font-mono">${analytics.costBreakdown.skipTracing.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between font-semibold">
                      <span>Total Monthly Cost</span>
                      <span className="font-mono text-lg">${analytics.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Processing Efficiency
                  </CardTitle>
                  <CardDescription>Ultra-lean pipeline performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Properties Processed</span>
                      <span className="font-mono">{analytics.efficiency.propertiesProcessed.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Quality Leads Generated</span>
                      <span className="font-mono">{analytics.efficiency.qualityLeads}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Conversion Rate</span>
                      <span className="font-mono">{analytics.efficiency.conversionRate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Expected Deals</span>
                      <span className="font-mono">{analytics.monthlyProjections.expectedDeals}/month</span>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between font-semibold">
                      <span>Expected Revenue</span>
                      <span className="font-mono text-lg">${analytics.monthlyProjections.expectedRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Performance</CardTitle>
                <CardDescription>Ultra-lean processing results by week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.weeklyBreakdown.map((week, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{week.week}</span>
                        <span className="text-sm text-muted-foreground">
                          {week.propertiesProcessed.toLocaleString()} properties
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">{week.qualityLeads} leads</span>
                        <span className="font-mono">${week.costPerLead.toFixed(2)}/lead</span>
                        <span className="font-mono text-green-600">${week.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Insights & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Key Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analytics.insights.map((insight, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analytics.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Data refreshed every hour • Last updated: {new Date().toLocaleTimeString()}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadAnalytics} disabled={isLoading}>
                  Refresh Data
                </Button>
                <Button onClick={onClose}>
                  Close Dashboard
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No analytics data available</p>
              <Button variant="outline" onClick={loadAnalytics} className="mt-4">
                Load Analytics
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}