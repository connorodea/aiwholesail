import React, { useState, useEffect } from 'react';
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
  Wallet,
  PiggyBank,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { zillowAPI } from '@/lib/zillow-api';

interface InvestmentCalculatorProps {
  property: Property;
}

interface CalculationResults {
  monthlyRent: number;
  monthlyMortgage: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
  grossRentMultiplier: number;
  totalCashNeeded: number;
  noi: number;
}

export function InvestmentCalculator({ property }: InvestmentCalculatorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [rentEstimate, setRentEstimate] = useState<number | null>(null);

  // User inputs
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(7.0);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const [repairCosts, setRepairCosts] = useState(0);
  const [closingCostPercent, setClosingCostPercent] = useState(3);
  const [vacancyRate, setVacancyRate] = useState(8);
  const [propertyManagementPercent, setPropertyManagementPercent] = useState(10);
  const [maintenancePercent, setMaintenancePercent] = useState(5);
  const [insuranceMonthly, setInsuranceMonthly] = useState(150);
  const [propertyTaxMonthly, setPropertyTaxMonthly] = useState(
    property.price ? Math.round(property.price * 0.012 / 12) : 200
  );

  // Fetch rental estimate
  useEffect(() => {
    const fetchRentEstimate = async () => {
      // First check if we have rent estimate in property data
      const existingRent = (property as any).property_estimates_rentZestimate ||
                          (property as any).rentZestimate ||
                          (property as any).rent_zestimate;

      if (existingRent && existingRent > 0) {
        setRentEstimate(existingRent);
        return;
      }

      // Try to fetch from API
      const zpid = property.zpid || property.id;
      if (!zpid) return;

      setIsLoading(true);
      try {
        const data = await zillowAPI.getRentalEstimate(zpid);
        if (data?.rentZestimate) {
          setRentEstimate(data.rentZestimate);
        } else if (data?.rent) {
          setRentEstimate(data.rent);
        }
      } catch (error) {
        console.log('Could not fetch rent estimate, using calculation');
        // Estimate based on price (1% rule as fallback)
        if (property.price) {
          setRentEstimate(Math.round(property.price * 0.008)); // 0.8% of price
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRentEstimate();
  }, [property]);

  const calculateInvestment = (): CalculationResults | null => {
    if (!property.price || !rentEstimate) return null;

    const purchasePrice = property.price;
    const monthlyRent = rentEstimate;

    // Down payment and loan
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const closingCosts = purchasePrice * (closingCostPercent / 100);
    const totalCashNeeded = downPayment + closingCosts + repairCosts;

    // Monthly mortgage payment (P&I)
    const monthlyInterestRate = interestRate / 100 / 12;
    const numberOfPayments = loanTermYears * 12;
    const monthlyMortgage = loanAmount > 0
      ? (loanAmount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
      : 0;

    // Operating expenses
    const vacancyLoss = monthlyRent * (vacancyRate / 100);
    const propertyManagement = monthlyRent * (propertyManagementPercent / 100);
    const maintenance = monthlyRent * (maintenancePercent / 100);
    const monthlyExpenses = vacancyLoss + propertyManagement + maintenance + insuranceMonthly + propertyTaxMonthly;

    // Cash flow calculations
    const effectiveGrossIncome = monthlyRent - vacancyLoss;
    const noi = (effectiveGrossIncome * 12) - ((propertyManagement + maintenance + insuranceMonthly + propertyTaxMonthly) * 12);
    const monthlyCashFlow = monthlyRent - monthlyMortgage - monthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // Investment metrics
    const capRate = (noi / purchasePrice) * 100;
    const cashOnCashReturn = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
    const grossRentMultiplier = (monthlyRent * 12) > 0 ? purchasePrice / (monthlyRent * 12) : 0;

    return {
      monthlyRent,
      monthlyMortgage,
      monthlyExpenses,
      monthlyCashFlow,
      annualCashFlow,
      capRate,
      cashOnCashReturn,
      grossRentMultiplier,
      totalCashNeeded,
      noi
    };
  };

  const results = calculateInvestment();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getCashFlowColor = (cashFlow: number) => {
    if (cashFlow >= 200) return 'text-green-500';
    if (cashFlow >= 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCapRateColor = (capRate: number) => {
    if (capRate >= 8) return 'text-green-500';
    if (capRate >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCoCColor = (coc: number) => {
    if (coc >= 10) return 'text-green-500';
    if (coc >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading rental estimates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      {results && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Monthly Cash Flow</span>
              </div>
              <div className={`text-2xl font-bold ${getCashFlowColor(results.monthlyCashFlow)}`}>
                {formatCurrency(results.monthlyCashFlow)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Percent className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Cap Rate</span>
              </div>
              <div className={`text-2xl font-bold ${getCapRateColor(results.capRate)}`}>
                {results.capRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Cash-on-Cash</span>
              </div>
              <div className={`text-2xl font-bold ${getCoCColor(results.cashOnCashReturn)}`}>
                {results.cashOnCashReturn.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <PiggyBank className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Cash Needed</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(results.totalCashNeeded)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deal Quality Indicator */}
      {results && (
        <Card className={`border-2 ${
          results.monthlyCashFlow >= 200 && results.capRate >= 6
            ? 'border-green-500 bg-green-500/5'
            : results.monthlyCashFlow >= 0
              ? 'border-yellow-500 bg-yellow-500/5'
              : 'border-red-500 bg-red-500/5'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {results.monthlyCashFlow >= 200 && results.capRate >= 6 ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <div>
                    <div className="font-semibold text-green-600">Strong Investment Potential</div>
                    <div className="text-sm text-muted-foreground">
                      Positive cash flow of {formatCurrency(results.monthlyCashFlow)}/mo with {results.capRate.toFixed(1)}% cap rate
                    </div>
                  </div>
                </>
              ) : results.monthlyCashFlow >= 0 ? (
                <>
                  <AlertCircle className="h-6 w-6 text-yellow-500" />
                  <div>
                    <div className="font-semibold text-yellow-600">Marginal Deal</div>
                    <div className="text-sm text-muted-foreground">
                      Break-even or slight cash flow. Consider negotiating price or increasing rent.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <div className="font-semibold text-red-600">Negative Cash Flow</div>
                    <div className="text-sm text-muted-foreground">
                      This property will cost {formatCurrency(Math.abs(results.monthlyCashFlow))}/mo to hold. Not recommended unless significant appreciation expected.
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Parameters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Investment Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Purchase Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">Purchase</h4>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Purchase Price</Label>
                  <span className="font-medium">{formatCurrency(property.price || 0)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Monthly Rent Estimate</Label>
                  <span className="font-medium text-primary">{formatCurrency(rentEstimate || 0)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Down Payment</Label>
                  <span className="font-medium">{downPaymentPercent}%</span>
                </div>
                <Slider
                  value={[downPaymentPercent]}
                  onValueChange={(v) => setDownPaymentPercent(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground text-right">
                  {formatCurrency((property.price || 0) * (downPaymentPercent / 100))}
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
                  min={3}
                  max={12}
                  step={0.25}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Repair/Rehab Costs</Label>
                <Input
                  type="number"
                  value={repairCosts}
                  onChange={(e) => setRepairCosts(Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Closing Costs</Label>
                  <span className="font-medium">{closingCostPercent}%</span>
                </div>
                <Slider
                  value={[closingCostPercent]}
                  onValueChange={(v) => setClosingCostPercent(v[0])}
                  min={0}
                  max={6}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>

            <Separator />

            {/* Operating Expenses */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase">Operating Expenses</h4>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Vacancy Rate</Label>
                  <span className="font-medium">{vacancyRate}%</span>
                </div>
                <Slider
                  value={[vacancyRate]}
                  onValueChange={(v) => setVacancyRate(v[0])}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Property Management</Label>
                  <span className="font-medium">{propertyManagementPercent}%</span>
                </div>
                <Slider
                  value={[propertyManagementPercent]}
                  onValueChange={(v) => setPropertyManagementPercent(v[0])}
                  min={0}
                  max={15}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Maintenance Reserve</Label>
                  <span className="font-medium">{maintenancePercent}%</span>
                </div>
                <Slider
                  value={[maintenancePercent]}
                  onValueChange={(v) => setMaintenancePercent(v[0])}
                  min={0}
                  max={15}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance/mo</Label>
                  <Input
                    type="number"
                    value={insuranceMonthly}
                    onChange={(e) => setInsuranceMonthly(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxes/mo</Label>
                  <Input
                    type="number"
                    value={propertyTaxMonthly}
                    onChange={(e) => setPropertyTaxMonthly(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Breakdown */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-primary" />
              Financial Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {results ? (
              <>
                {/* Monthly Income */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Monthly Income</h4>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Gross Rent</span>
                    <span className="font-medium text-green-600">+{formatCurrency(results.monthlyRent)}</span>
                  </div>
                </div>

                {/* Monthly Expenses */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Monthly Expenses</h4>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Mortgage (P&I)</span>
                    <span className="font-medium text-red-500">-{formatCurrency(results.monthlyMortgage)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Vacancy ({vacancyRate}%)</span>
                    <span className="font-medium text-red-500">-{formatCurrency(results.monthlyRent * (vacancyRate / 100))}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Property Management</span>
                    <span className="font-medium text-red-500">-{formatCurrency(results.monthlyRent * (propertyManagementPercent / 100))}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Maintenance</span>
                    <span className="font-medium text-red-500">-{formatCurrency(results.monthlyRent * (maintenancePercent / 100))}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Insurance</span>
                    <span className="font-medium text-red-500">-{formatCurrency(insuranceMonthly)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Property Taxes</span>
                    <span className="font-medium text-red-500">-{formatCurrency(propertyTaxMonthly)}</span>
                  </div>
                </div>

                <Separator />

                {/* Net Cash Flow */}
                <div className="space-y-3">
                  <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-4">
                    <span className="font-semibold">Monthly Cash Flow</span>
                    <span className={`text-xl font-bold ${getCashFlowColor(results.monthlyCashFlow)}`}>
                      {formatCurrency(results.monthlyCashFlow)}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-4">
                    <span className="font-semibold">Annual Cash Flow</span>
                    <span className={`text-xl font-bold ${getCashFlowColor(results.monthlyCashFlow)}`}>
                      {formatCurrency(results.annualCashFlow)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Investment Metrics */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Investment Metrics</h4>
                  <div className="flex justify-between py-2">
                    <span>Net Operating Income (NOI)</span>
                    <span className="font-medium">{formatCurrency(results.noi)}/yr</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Cap Rate</span>
                    <Badge variant={results.capRate >= 6 ? 'default' : 'secondary'}>
                      {results.capRate.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Cash-on-Cash Return</span>
                    <Badge variant={results.cashOnCashReturn >= 8 ? 'default' : 'secondary'}>
                      {results.cashOnCashReturn.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Gross Rent Multiplier</span>
                    <span className="font-medium">{results.grossRentMultiplier.toFixed(1)}x</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>Unable to calculate. Missing price or rent estimate.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
