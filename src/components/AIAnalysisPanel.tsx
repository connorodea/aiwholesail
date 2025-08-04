import { AIAnalysis } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, BarChart3, PieChart } from 'lucide-react';

interface AIAnalysisPanelProps {
  analysis: AIAnalysis;
}

export function AIAnalysisPanel({ analysis }: AIAnalysisPanelProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{analysis.summary.total_properties}</div>
              <div className="text-sm text-muted-foreground">Properties Found</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{analysis.summary.unique_locations}</div>
              <div className="text-sm text-muted-foreground">Unique Locations</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className={`text-2xl font-bold ${getQualityColor(analysis.summary.data_quality_score)}`}>
                {analysis.summary.data_quality_score}%
              </div>
              <div className="text-sm text-muted-foreground">Data Quality</div>
              <Progress 
                value={analysis.summary.data_quality_score} 
                className="mt-2 h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Analysis */}
      {Object.keys(analysis.market_analysis).length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Market Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(analysis.market_analysis).map(([metric, stats]) => (
                <div key={metric} className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold capitalize mb-3 text-foreground">{metric}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Average</div>
                      <div className="font-semibold">
                        {metric.includes('price') ? formatCurrency(stats.mean) : formatNumber(stats.mean)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Median</div>
                      <div className="font-semibold">
                        {metric.includes('price') ? formatCurrency(stats.median) : formatNumber(stats.median)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Range</div>
                      <div className="font-semibold">
                        {metric.includes('price') ? 
                          `${formatCurrency(stats.min)} - ${formatCurrency(stats.max)}` :
                          `${formatNumber(stats.min)} - ${formatNumber(stats.max)}`
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Std Dev</div>
                      <div className="font-semibold">
                        {metric.includes('price') ? formatCurrency(stats.std) : formatNumber(stats.std)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{insight}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Wholesaling Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border-l-4 border-primary">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{recommendation}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outliers */}
      {analysis.outliers.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Outliers Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.outliers.map((outlier, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <div>
                    <div className="font-semibold capitalize text-foreground">{outlier.column}</div>
                    <div className="text-sm text-muted-foreground">{outlier.description}</div>
                  </div>
                  <Badge variant="outline" className="border-warning text-warning">
                    {outlier.count} ({outlier.percentage}%)
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends */}
      {Object.keys(analysis.trends).length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Market Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(analysis.trends).map(([category, data]) => (
                <div key={category} className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold capitalize mb-3 text-foreground">{category}</h4>
                  <div className="space-y-2">
                    {Object.entries(data as Record<string, number>).slice(0, 5).map(([item, count]) => (
                      <div key={item} className="flex justify-between items-center">
                        <span className="text-sm text-foreground">{item}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}