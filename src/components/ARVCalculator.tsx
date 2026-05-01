import React, { useState } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  Percent,
  TrendingUp,
  Calculator,
  Home,
  Hammer,
  Clock,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface ARVCalculatorProps {
  property: Property;
}

interface FlipResults {
  mao: number;
  totalInvestment: number;
  expectedProfit: number;
  roi: number;
  profitPerMonth: number;
  totalHoldingCosts: number;
  totalClosingCostsBuy: number;
  totalClosingCostsSell: number;
  totalFinancingCosts: number;
  mao65: number;
  mao70: number;
  mao75: number;
}

export function ARVCalculator({ property }: ARVCalculatorProps) {
  const { isElite, loading: subLoading } = useSubscription();
  const purchasePrice = property.price || 0;
  const zestimate = property.zestimate || 0;
  const sqft = property.sqft || 0;
  const bedrooms = property.bedrooms;
  const bathrooms = property.bathrooms;
  const yearBuilt = property.yearBuilt;

  // User-editable inputs
  const [arv, setArv] = useState(
    zestimate > 0 ? zestimate : Math.round(purchasePrice * 1.2)
  );
  const [rehabCost, setRehabCost] = useState(
    sqft > 0 ? Math.round(sqft * 25) : 25000
  );
  const [holdingPeriodMonths, setHoldingPeriodMonths] = useState(6);
  const [holdingCostPerMonth, setHoldingCostPerMonth] = useState(
    Math.round(purchasePrice * 0.01) || 1500
  );
  const [closingCostBuyPercent, setClosingCostBuyPercent] = useState(2);
  const [closingCostSellPercent, setClosingCostSellPercent] = useState(6);
  const [loanAmount, setLoanAmount] = useState(
    Math.round(purchasePrice * 0.8)
  );
  const [interestRate, setInterestRate] = useState(10);
  const [loanPoints, setLoanPoints] = useState(2);

  // Show upgrade prompt for non-Elite users (after all hooks)
  if (!subLoading && !isElite) {
    return (
      <UpgradePrompt
        featureName="ARV Calculator & Comps"
        description="Calculate After Repair Value, Maximum Allowable Offer, and analyze comparable sales with advanced flip analysis tools."
      />
    );
  }

  const calculateFlip = (): FlipResults => {
    // Closing costs
    const totalClosingCostsBuy = purchasePrice * (closingCostBuyPercent / 100);
    const totalClosingCostsSell = arv * (closingCostSellPercent / 100);

    // Holding costs
    const totalHoldingCosts = holdingCostPerMonth * holdingPeriodMonths;

    // Financing costs
    const pointsCost = loanAmount * (loanPoints / 100);
    const interestCost =
      loanAmount * (interestRate / 100 / 12) * holdingPeriodMonths;
    const totalFinancingCosts = pointsCost + interestCost;

    // Total investment
    const totalInvestment =
      purchasePrice +
      rehabCost +
      totalHoldingCosts +
      totalClosingCostsBuy +
      totalFinancingCosts;

    // Expected profit
    const expectedProfit = arv - totalInvestment - totalClosingCostsSell;

    // ROI
    const cashInvested =
      purchasePrice -
      loanAmount +
      rehabCost +
      totalHoldingCosts +
      totalClosingCostsBuy +
      totalFinancingCosts;
    const roi = cashInvested > 0 ? (expectedProfit / cashInvested) * 100 : 0;

    // Profit per month
    const profitPerMonth =
      holdingPeriodMonths > 0 ? expectedProfit / holdingPeriodMonths : 0;

    // MAO at different rules
    const mao70 = arv * 0.7 - rehabCost;
    const mao65 = arv * 0.65 - rehabCost;
    const mao75 = arv * 0.75 - rehabCost;

    return {
      mao: mao70,
      totalInvestment,
      expectedProfit,
      roi,
      profitPerMonth,
      totalHoldingCosts,
      totalClosingCostsBuy,
      totalClosingCostsSell,
      totalFinancingCosts,
      mao65,
      mao70,
      mao75,
    };
  };

  const results = calculateFlip();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDealQuality = (roi: number) => {
    if (roi >= 25) return { label: 'Strong Deal', color: 'green' } as const;
    if (roi >= 10) return { label: 'Marginal Deal', color: 'yellow' } as const;
    return { label: 'Bad Deal', color: 'red' } as const;
  };

  const dealQuality = getDealQuality(results.roi);

  // Visual bar: proportional widths
  const totalBarValue = arv > 0 ? arv : 1;
  const purchaseBarWidth = Math.min(
    (purchasePrice / totalBarValue) * 100,
    100
  );
  const rehabBarWidth = Math.min((rehabCost / totalBarValue) * 100, 100);
  const costsBarWidth = Math.min(
    ((results.totalHoldingCosts +
      results.totalClosingCostsBuy +
      results.totalClosingCostsSell +
      results.totalFinancingCosts) /
      totalBarValue) *
      100,
    100
  );
  const profitBarWidth = Math.max(
    (results.expectedProfit / totalBarValue) * 100,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-cyan-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                MAO (70%)
              </span>
            </div>
            <div className="text-xl md:text-2xl font-bold text-cyan-500">
              {formatCurrency(results.mao)}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-gradient-to-br ${
            results.expectedProfit >= 0
              ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
              : 'from-red-500/10 to-red-500/5 border-red-500/20'
          }`}
        >
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Expected Profit
              </span>
            </div>
            <div
              className={`text-xl md:text-2xl font-bold ${
                results.expectedProfit >= 0 ? 'text-cyan-500' : 'text-red-500'
              }`}
            >
              {formatCurrency(results.expectedProfit)}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-gradient-to-br ${
            results.roi >= 25
              ? 'from-green-500/10 to-green-500/5 border-green-500/20'
              : results.roi >= 10
                ? 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20'
                : 'from-red-500/10 to-red-500/5 border-red-500/20'
          }`}
        >
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                ROI
              </span>
            </div>
            <div
              className={`text-xl md:text-2xl font-bold ${
                results.roi >= 25
                  ? 'text-green-500'
                  : results.roi >= 10
                    ? 'text-yellow-500'
                    : 'text-red-500'
              }`}
            >
              {results.roi.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Profit/Month
              </span>
            </div>
            <div
              className={`text-xl md:text-2xl font-bold ${
                results.profitPerMonth >= 0 ? 'text-cyan-500' : 'text-red-500'
              }`}
            >
              {formatCurrency(results.profitPerMonth)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deal Quality Indicator */}
      <Card
        className={`border-2 ${
          dealQuality.color === 'green'
            ? 'border-green-500 bg-green-500/5'
            : dealQuality.color === 'yellow'
              ? 'border-yellow-500 bg-yellow-500/5'
              : 'border-red-500 bg-red-500/5'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {dealQuality.color === 'green' ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <div className="font-semibold text-green-600">
                    Strong Flip Potential
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {results.roi.toFixed(1)}% ROI with{' '}
                    {formatCurrency(results.expectedProfit)} expected profit
                    over {holdingPeriodMonths} months.
                  </div>
                </div>
              </>
            ) : dealQuality.color === 'yellow' ? (
              <>
                <AlertCircle className="h-6 w-6 text-yellow-500" />
                <div>
                  <div className="font-semibold text-yellow-600">
                    Marginal Deal
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Thin margins. Consider negotiating purchase price below{' '}
                    {formatCurrency(results.mao)} or reducing rehab scope.
                  </div>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-red-500" />
                <div>
                  <div className="font-semibold text-red-600">
                    Negative or Low Returns
                  </div>
                  <div className="text-sm text-muted-foreground">
                    This deal loses money or has insufficient margin. Purchase
                    price must be at or below{' '}
                    {formatCurrency(results.mao)} to meet the 70% rule.
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price vs ARV Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Cost vs ARV Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ARV Target</span>
              <span className="font-semibold text-cyan-500">
                {formatCurrency(arv)}
              </span>
            </div>
            <div className="w-full h-8 bg-muted rounded-lg overflow-hidden flex">
              <div
                className="h-full bg-blue-500 flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${purchaseBarWidth}%` }}
                title={`Purchase: ${formatCurrency(purchasePrice)}`}
              >
                {purchaseBarWidth > 12 ? 'Purchase' : ''}
              </div>
              <div
                className="h-full bg-orange-500 flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${rehabBarWidth}%` }}
                title={`Rehab: ${formatCurrency(rehabCost)}`}
              >
                {rehabBarWidth > 10 ? 'Rehab' : ''}
              </div>
              <div
                className="h-full bg-red-500 flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${costsBarWidth}%` }}
                title={`Costs: ${formatCurrency(
                  results.totalHoldingCosts +
                    results.totalClosingCostsBuy +
                    results.totalClosingCostsSell +
                    results.totalFinancingCosts
                )}`}
              >
                {costsBarWidth > 8 ? 'Costs' : ''}
              </div>
              {profitBarWidth > 0 && (
                <div
                  className="h-full bg-green-500 flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ width: `${profitBarWidth}%` }}
                  title={`Profit: ${formatCurrency(results.expectedProfit)}`}
                >
                  {profitBarWidth > 8 ? 'Profit' : ''}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                Purchase
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                Rehab
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                Costs
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
                Profit
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Inputs + Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Input Parameters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Flip Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Property Info (read-only) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Property Info
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Purchase Price</Label>
                  <span className="font-medium">
                    {formatCurrency(purchasePrice)}
                  </span>
                </div>
              </div>
              {zestimate > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Zestimate</Label>
                    <span className="font-medium text-primary">
                      {formatCurrency(zestimate)}
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <div className="text-muted-foreground">Sq Ft</div>
                  <div className="font-medium">
                    {sqft > 0 ? sqft.toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bed/Bath</div>
                  <div className="font-medium">
                    {bedrooms ?? 'N/A'}/{bathrooms ?? 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Year Built</div>
                  <div className="font-medium">{yearBuilt ?? 'N/A'}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ARV & Rehab */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                ARV & Rehab
              </h4>
              <div className="space-y-2">
                <Label>After Repair Value (ARV)</Label>
                <Input
                  type="number"
                  value={arv}
                  onChange={(e) => setArv(Number(e.target.value))}
                />
                <div className="text-xs text-muted-foreground">
                  {zestimate > 0
                    ? `Defaulted to Zestimate (${formatCurrency(zestimate)})`
                    : `Defaulted to purchase price x 1.2`}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rehab Cost Estimate</Label>
                <Input
                  type="number"
                  value={rehabCost}
                  onChange={(e) => setRehabCost(Number(e.target.value))}
                />
                <div className="text-xs text-muted-foreground">
                  {sqft > 0
                    ? `Default: ${sqft.toLocaleString()} sqft x $25/sqft = ${formatCurrency(sqft * 25)}`
                    : 'Enter estimated rehab costs'}
                </div>
              </div>
            </div>

            <Separator />

            {/* Holding Costs */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Holding Costs
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Holding Period</Label>
                  <span className="font-medium">
                    {holdingPeriodMonths} months
                  </span>
                </div>
                <Slider
                  value={[holdingPeriodMonths]}
                  onValueChange={(v) => setHoldingPeriodMonths(v[0])}
                  min={1}
                  max={18}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Holding Costs / Month</Label>
                <Input
                  type="number"
                  value={holdingCostPerMonth}
                  onChange={(e) =>
                    setHoldingCostPerMonth(Number(e.target.value))
                  }
                />
                <div className="text-xs text-muted-foreground">
                  Taxes, insurance, utilities, maintenance
                </div>
              </div>
            </div>

            <Separator />

            {/* Closing Costs */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Closing Costs
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Buy-Side Closing</Label>
                  <span className="font-medium">
                    {closingCostBuyPercent}% (
                    {formatCurrency(
                      purchasePrice * (closingCostBuyPercent / 100)
                    )}
                    )
                  </span>
                </div>
                <Slider
                  value={[closingCostBuyPercent]}
                  onValueChange={(v) => setClosingCostBuyPercent(v[0])}
                  min={0}
                  max={5}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Sell-Side Closing</Label>
                  <span className="font-medium">
                    {closingCostSellPercent}% (
                    {formatCurrency(arv * (closingCostSellPercent / 100))})
                  </span>
                </div>
                <Slider
                  value={[closingCostSellPercent]}
                  onValueChange={(v) => setClosingCostSellPercent(v[0])}
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>

            <Separator />

            {/* Financing */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Financing
              </h4>
              <div className="space-y-2">
                <Label>Loan Amount</Label>
                <Input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                />
                <div className="text-xs text-muted-foreground">
                  Default: 80% of purchase price
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Interest Rate</Label>
                  <span className="font-medium">{interestRate}%</span>
                </div>
                <Slider
                  value={[interestRate]}
                  onValueChange={(v) => setInterestRate(v[0])}
                  min={5}
                  max={18}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Points</Label>
                  <span className="font-medium">
                    {loanPoints} pts (
                    {formatCurrency(loanAmount * (loanPoints / 100))})
                  </span>
                </div>
                <Slider
                  value={[loanPoints]}
                  onValueChange={(v) => setLoanPoints(v[0])}
                  min={0}
                  max={5}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Financial Breakdown */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-primary" />
              Financial Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Purchase & Rehab */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Costs
              </h4>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span>Purchase Price</span>
                <span className="font-medium text-red-500">
                  {formatCurrency(purchasePrice)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span>Rehab Costs</span>
                <span className="font-medium text-red-500">
                  {formatCurrency(rehabCost)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span>
                  Holding Costs ({holdingPeriodMonths} mo)
                </span>
                <span className="font-medium text-red-500">
                  {formatCurrency(results.totalHoldingCosts)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span>Buy-Side Closing ({closingCostBuyPercent}%)</span>
                <span className="font-medium text-red-500">
                  {formatCurrency(results.totalClosingCostsBuy)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span>Sell-Side Closing ({closingCostSellPercent}%)</span>
                <span className="font-medium text-red-500">
                  {formatCurrency(results.totalClosingCostsSell)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span>Financing (Interest + Points)</span>
                <span className="font-medium text-red-500">
                  {formatCurrency(results.totalFinancingCosts)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-3">
              <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-4">
                <span className="font-semibold">Total Investment</span>
                <span className="text-xl font-bold text-foreground">
                  {formatCurrency(
                    results.totalInvestment + results.totalClosingCostsSell
                  )}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-4">
                <span className="font-semibold">After Repair Value</span>
                <span className="text-xl font-bold text-cyan-500">
                  {formatCurrency(arv)}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-primary/10 rounded-lg px-4">
                <span className="font-semibold">Expected Profit</span>
                <span
                  className={`text-xl font-bold ${
                    results.expectedProfit >= 0 ? 'text-cyan-500' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(results.expectedProfit)}
                </span>
              </div>
            </div>

            <Separator />

            {/* MAO Comparison at Different Rules */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Maximum Allowable Offer
              </h4>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="flex items-center gap-2">
                  65% Rule
                  <Badge variant="secondary" className="text-xs">
                    Conservative
                  </Badge>
                </span>
                <span
                  className={`font-medium ${
                    purchasePrice <= results.mao65
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {formatCurrency(results.mao65)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="flex items-center gap-2">
                  70% Rule
                  <Badge variant="default" className="text-xs">
                    Standard
                  </Badge>
                </span>
                <span
                  className={`font-medium ${
                    purchasePrice <= results.mao70
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {formatCurrency(results.mao70)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="flex items-center gap-2">
                  75% Rule
                  <Badge variant="secondary" className="text-xs">
                    Aggressive
                  </Badge>
                </span>
                <span
                  className={`font-medium ${
                    purchasePrice <= results.mao75
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {formatCurrency(results.mao75)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Current purchase price: {formatCurrency(purchasePrice)}
                {purchasePrice <= results.mao70
                  ? ' — Below 70% MAO'
                  : purchasePrice <= results.mao75
                    ? ' — Below 75% MAO only'
                    : ' — Above all MAO thresholds'}
              </div>
            </div>

            <Separator />

            {/* Investment Metrics */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                Key Metrics
              </h4>
              <div className="flex justify-between py-2">
                <span>Return on Investment</span>
                <Badge
                  variant={results.roi >= 25 ? 'default' : 'secondary'}
                >
                  {results.roi.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between py-2">
                <span>Profit per Month</span>
                <span
                  className={`font-medium ${
                    results.profitPerMonth >= 0
                      ? 'text-cyan-500'
                      : 'text-red-500'
                  }`}
                >
                  {formatCurrency(results.profitPerMonth)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span>Cash Required (Equity + Costs)</span>
                <span className="font-medium">
                  {formatCurrency(
                    purchasePrice -
                      loanAmount +
                      rehabCost +
                      results.totalHoldingCosts +
                      results.totalClosingCostsBuy +
                      results.totalFinancingCosts
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span>Price vs ARV Spread</span>
                <span
                  className={`font-medium ${
                    arv - purchasePrice > 0 ? 'text-cyan-500' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(arv - purchasePrice)} (
                  {purchasePrice > 0
                    ? (((arv - purchasePrice) / purchasePrice) * 100).toFixed(1)
                    : '0'}
                  %)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
