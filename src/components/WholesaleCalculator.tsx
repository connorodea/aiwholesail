import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WholesaleCalculatorProps {
  property: Property;
}

interface CalculatorInputs {
  arv: number;
  repairCosts: number;
  wholesaleFee: number;
  desiredMargin: number;
}

interface CalculatorResults {
  maxOffer: number;
  currentSpread: number;
  profitPotential: number;
  dealQuality: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

export function WholesaleCalculator({ property }: WholesaleCalculatorProps) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    arv: property.zestimate || property.price || 0,
    repairCosts: 0,
    wholesaleFee: 10000,
    desiredMargin: 0.7 // 70% rule
  });

  const [results, setResults] = useState<CalculatorResults | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const calculateResults = (): CalculatorResults => {
    const maxOffer = inputs.arv * inputs.desiredMargin - inputs.repairCosts - inputs.wholesaleFee;
    const currentSpread = maxOffer - (property.price || 0);
    const profitPotential = currentSpread > 0 ? currentSpread : 0;
    
    // Determine deal quality
    let dealQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (currentSpread > 30000) dealQuality = 'excellent';
    else if (currentSpread > 15000) dealQuality = 'good';
    else if (currentSpread > 5000) dealQuality = 'fair';

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (currentSpread <= 0) {
      recommendations.push('Consider negotiating the asking price down');
      recommendations.push('Look for ways to reduce repair cost estimates');
      recommendations.push('This deal may not meet the 70% rule');
    } else {
      recommendations.push('This property shows positive wholesale potential');
      if (property.daysOnMarket && property.daysOnMarket > 60) {
        recommendations.push('Long time on market suggests motivated seller');
      }
      if (property.isFSBO) {
        recommendations.push('FSBO property allows direct owner negotiation');
      }
    }

    if (inputs.arv && property.price && property.price < inputs.arv * 0.85) {
      recommendations.push('Property is priced below estimated ARV');
    }

    return {
      maxOffer,
      currentSpread,
      profitPotential,
      dealQuality,
      recommendations
    };
  };

  useEffect(() => {
    setResults(calculateResults());
  }, [inputs, property]);

  const updateInput = (field: keyof CalculatorInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const resetToDefaults = () => {
    setInputs({
      arv: property.zestimate || property.price || 0,
      repairCosts: (property.zestimate || property.price || 0) * 0.15,
      wholesaleFee: 10000,
      desiredMargin: 0.7
    });
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-success text-success-foreground';
      case 'good': return 'bg-primary text-primary-foreground';
      case 'fair': return 'bg-warning text-warning-foreground';
      default: return 'bg-destructive text-destructive-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Wholesale Deal Calculator
          {results && (
            <Badge className={getQualityColor(results.dealQuality)}>
              {results.dealQuality.charAt(0).toUpperCase() + results.dealQuality.slice(1)} Deal
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="arv">After Repair Value (ARV)</Label>
            <Input
              id="arv"
              type="number"
              value={inputs.arv}
              onChange={(e) => updateInput('arv', parseFloat(e.target.value) || 0)}
              placeholder="Enter ARV"
            />
            <p className="text-xs text-muted-foreground">
              Current estimate: {formatPrice(property.zestimate || property.price || 0)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repairCosts">Estimated Repair Costs</Label>
            <Input
              id="repairCosts"
              type="number"
              value={inputs.repairCosts}
              onChange={(e) => updateInput('repairCosts', parseFloat(e.target.value) || 0)}
              placeholder="Enter repair costs"
            />
            <p className="text-xs text-muted-foreground">
              Suggested: {formatPrice(inputs.arv * 0.15)} (15% of ARV)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wholesaleFee">Wholesale Fee</Label>
            <Input
              id="wholesaleFee"
              type="number"
              value={inputs.wholesaleFee}
              onChange={(e) => updateInput('wholesaleFee', parseFloat(e.target.value) || 0)}
              placeholder="Enter wholesale fee"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="margin">Purchase Margin</Label>
            <Input
              id="margin"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={inputs.desiredMargin}
              onChange={(e) => updateInput('desiredMargin', parseFloat(e.target.value) || 0)}
              placeholder="0.70 for 70% rule"
            />
            <p className="text-xs text-muted-foreground">
              0.70 = 70% rule, 0.65 = 65% rule
            </p>
          </div>
        </div>

        <Button onClick={resetToDefaults} variant="outline" size="sm">
          Reset to Suggested Values
        </Button>

        {/* Results Section */}
        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Max Offer</span>
                </div>
                <div className="text-xl font-bold">{formatPrice(results.maxOffer)}</div>
                <div className="text-xs text-muted-foreground">
                  Based on {(inputs.desiredMargin * 100).toFixed(0)}% rule
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Current Spread</span>
                </div>
                <div className={`text-xl font-bold ${results.currentSpread > 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPrice(results.currentSpread)}
                </div>
                <div className="text-xs text-muted-foreground">
                  vs asking {formatPrice(property.price || 0)}
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Profit Potential</span>
                </div>
                <div className="text-xl font-bold text-primary">
                  {formatPrice(results.profitPotential)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Wholesale opportunity
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {results.recommendations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Deal Analysis & Recommendations
                </h4>
                <div className="space-y-2">
                  {results.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deal Summary */}
            <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2">Deal Breakdown</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>ARV:</span>
                  <span className="font-medium">{formatPrice(inputs.arv)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Purchase at {(inputs.desiredMargin * 100).toFixed(0)}%:</span>
                  <span className="font-medium">{formatPrice(inputs.arv * inputs.desiredMargin)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>- Repair Costs:</span>
                  <span className="font-medium">-{formatPrice(inputs.repairCosts)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>- Wholesale Fee:</span>
                  <span className="font-medium">-{formatPrice(inputs.wholesaleFee)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-bold">
                  <span>Max Offer:</span>
                  <span>{formatPrice(results.maxOffer)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}