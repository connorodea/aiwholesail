import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Percent, ArrowRight, Wallet, TrendingUp, TrendingDown, Building2 } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDecimal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

export default function CashFlowCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(250000);
  const [downPaymentPercent, setDownPaymentPercent] = useState(25);
  const [interestRate, setInterestRate] = useState(7.0);
  const [monthlyRent, setMonthlyRent] = useState(2200);
  const [propertyTax, setPropertyTax] = useState(3000);
  const [insurance, setInsurance] = useState(1500);
  const [hoa, setHoa] = useState(0);
  const [vacancyRate, setVacancyRate] = useState(8);
  const [managementFee, setManagementFee] = useState(10);
  const [maintenanceReserve, setMaintenanceReserve] = useState(5);
  const [otherExpenses, setOtherExpenses] = useState(0);

  const results = useMemo(() => {
    if (purchasePrice <= 0 || monthlyRent <= 0) return null;

    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const totalPayments = 30 * 12; // 30-year fixed

    let monthlyMortgage = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    }

    // Income
    const grossMonthlyIncome = monthlyRent;
    const vacancyLoss = grossMonthlyIncome * (vacancyRate / 100);
    const effectiveMonthlyIncome = grossMonthlyIncome - vacancyLoss;

    // Expenses
    const monthlyPropertyTax = propertyTax / 12;
    const monthlyInsurance = insurance / 12;
    const monthlyManagement = effectiveMonthlyIncome * (managementFee / 100);
    const monthlyMaintenance = effectiveMonthlyIncome * (maintenanceReserve / 100);
    const totalMonthlyExpenses = monthlyMortgage + monthlyPropertyTax + monthlyInsurance + hoa + monthlyManagement + monthlyMaintenance + otherExpenses;

    // Cash flow
    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // Returns
    const totalCashInvested = downPayment; // simplified; closing costs excluded for clarity
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

    // Cap Rate: NOI / Purchase Price (before financing)
    const annualNOI = (effectiveMonthlyIncome - monthlyPropertyTax - monthlyInsurance - hoa - monthlyManagement - monthlyMaintenance - otherExpenses) * 12;
    const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

    // GRM: Purchase Price / Annual Gross Rent
    const annualGrossRent = grossMonthlyIncome * 12;
    const grm = annualGrossRent > 0 ? purchasePrice / annualGrossRent : 0;

    return {
      downPayment,
      loanAmount,
      monthlyMortgage,
      grossMonthlyIncome,
      vacancyLoss,
      effectiveMonthlyIncome,
      monthlyPropertyTax,
      monthlyInsurance,
      monthlyHOA: hoa,
      monthlyManagement,
      monthlyMaintenance,
      monthlyOther: otherExpenses,
      totalMonthlyExpenses,
      monthlyCashFlow,
      annualCashFlow,
      cashOnCash,
      capRate,
      grm,
      annualNOI,
    };
  }, [purchasePrice, downPaymentPercent, interestRate, monthlyRent, propertyTax, insurance, hoa, vacancyRate, managementFee, maintenanceReserve, otherExpenses]);

  const expenseBreakdown = results ? [
    { label: 'Mortgage (P&I)', value: results.monthlyMortgage, color: 'bg-blue-500' },
    { label: 'Property Tax', value: results.monthlyPropertyTax, color: 'bg-amber-500' },
    { label: 'Insurance', value: results.monthlyInsurance, color: 'bg-purple-500' },
    { label: 'HOA', value: results.monthlyHOA, color: 'bg-pink-500' },
    { label: 'Management', value: results.monthlyManagement, color: 'bg-cyan-500' },
    { label: 'Maintenance', value: results.monthlyMaintenance, color: 'bg-orange-500' },
    { label: 'Other', value: results.monthlyOther, color: 'bg-gray-500' },
  ].filter(e => e.value > 0) : [];

  const totalExpenseValue = expenseBreakdown.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      <SEOHead
        title="Rental Property Cash Flow Calculator - Free Investment Tool"
        description="Free rental property cash flow calculator. Analyze monthly cash flow, cash-on-cash return, cap rate, and GRM. See a complete expense breakdown for any rental investment property."
        keywords="cash flow calculator, rental property calculator, cash on cash return calculator, cap rate calculator, rental income calculator, investment property analysis, real estate ROI calculator"
      />

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-neutral-950/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-sm font-medium hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <Link to="/" className="text-lg font-semibold">AIWholesail</Link>
              <Link to="/pricing" className="text-sm font-medium text-cyan-400 hover:text-cyan-400/80 transition-colors">
                Try Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-8 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge variant="secondary" className="mb-4">
            <Wallet className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Cash Flow Calculator
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Analyze any rental property's cash flow, returns, and expense breakdown. See monthly and annual numbers, cash-on-cash return, cap rate, and gross rent multiplier in real time.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Inputs */}
            <div className="space-y-6">
              <Card className="border border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-xl font-medium">Property & Financing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice" className="text-sm font-medium">Purchase Price</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        id="purchasePrice"
                        type="number"
                        value={purchasePrice}
                        onChange={e => setPurchasePrice(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="downPayment" className="text-sm font-medium">Down Payment (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="downPayment"
                          type="number"
                          value={downPaymentPercent}
                          onChange={e => setDownPaymentPercent(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interestRate" className="text-sm font-medium">Interest Rate (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="interestRate"
                          type="number"
                          value={interestRate}
                          onChange={e => setInterestRate(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                          max={30}
                          step={0.125}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyRent" className="text-sm font-medium">Monthly Rent</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        id="monthlyRent"
                        type="number"
                        value={monthlyRent}
                        onChange={e => setMonthlyRent(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-xl font-medium">Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="propertyTax" className="text-sm font-medium">Property Tax (Annual)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="propertyTax"
                          type="number"
                          value={propertyTax}
                          onChange={e => setPropertyTax(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance" className="text-sm font-medium">Insurance (Annual)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="insurance"
                          type="number"
                          value={insurance}
                          onChange={e => setInsurance(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hoaExpense" className="text-sm font-medium">HOA (Monthly)</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        id="hoaExpense"
                        type="number"
                        value={hoa}
                        onChange={e => setHoa(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vacancy" className="text-sm font-medium">Vacancy (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="vacancy"
                          type="number"
                          value={vacancyRate}
                          onChange={e => setVacancyRate(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mgmt" className="text-sm font-medium">Mgmt Fee (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="mgmt"
                          type="number"
                          value={managementFee}
                          onChange={e => setManagementFee(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maint" className="text-sm font-medium">Maint. (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="maint"
                          type="number"
                          value={maintenanceReserve}
                          onChange={e => setMaintenanceReserve(Number(e.target.value))}
                          className="pl-9"
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otherExpenses" className="text-sm font-medium">Other Expenses (Monthly)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        id="otherExpenses"
                        type="number"
                        value={otherExpenses}
                        onChange={e => setOtherExpenses(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {/* Cash Flow Hero */}
              <Card className={`border-2 ${
                results && results.monthlyCashFlow >= 0
                  ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20'
                  : results
                    ? 'border-red-500/30 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/20'
                    : 'border-white/[0.06]'
              }`}>
                <CardContent className="pt-6">
                  {results ? (
                    <div className="text-center space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        {results.monthlyCashFlow >= 0
                          ? <TrendingUp className="h-6 w-6 text-emerald-500" />
                          : <TrendingDown className="h-6 w-6 text-red-500" />
                        }
                        <p className="text-sm text-neutral-400">Monthly Cash Flow</p>
                      </div>
                      <p className={`text-5xl font-semibold tracking-tight ${results.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmtDecimal.format(results.monthlyCashFlow)}
                      </p>
                      <p className="text-sm text-neutral-400">
                        {fmtDecimal.format(results.annualCashFlow)} / year
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-4">Enter property details to see cash flow.</p>
                  )}
                </CardContent>
              </Card>

              {/* Key Metrics */}
              {results && (
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border border-white/[0.06]">
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-neutral-400 mb-1">Cash-on-Cash</p>
                      <p className={`text-xl font-semibold ${results.cashOnCash >= 0 ? 'text-cyan-400' : 'text-red-500'}`}>
                        {fmtPct(results.cashOnCash)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-white/[0.06]">
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-neutral-400 mb-1">Cap Rate</p>
                      <p className="text-xl font-semibold text-cyan-400">{fmtPct(results.capRate)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border border-white/[0.06]">
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-neutral-400 mb-1">GRM</p>
                      <p className="text-xl font-semibold text-cyan-400">{results.grm.toFixed(1)}x</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Income vs Expenses */}
              {results && (
                <Card className="border border-white/[0.06]">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Monthly Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Income */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Gross Rent</span>
                        <span className="font-medium">{fmtDecimal.format(results.grossMonthlyIncome)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Vacancy Loss ({vacancyRate}%)</span>
                        <span className="font-medium text-red-500">-{fmtDecimal.format(results.vacancyLoss)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
                        <span>Effective Income</span>
                        <span className="text-emerald-600">{fmtDecimal.format(results.effectiveMonthlyIncome)}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Expenses */}
                    <div className="space-y-2">
                      {expenseBreakdown.map(exp => (
                        <div key={exp.label} className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${exp.color}`} />
                            <span className="text-neutral-400">{exp.label}</span>
                          </div>
                          <span className="font-medium">{fmtDecimal.format(exp.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
                        <span>Total Expenses</span>
                        <span className="text-red-500">{fmtDecimal.format(results.totalMonthlyExpenses)}</span>
                      </div>
                    </div>

                    {/* Visual Bar */}
                    {totalExpenseValue > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-400">Expense Distribution</p>
                        <div className="flex h-3 rounded-full overflow-hidden">
                          {expenseBreakdown.map(exp => (
                            <div
                              key={exp.label}
                              className={`${exp.color} transition-all duration-300`}
                              style={{ width: `${(exp.value / totalExpenseValue) * 100}%` }}
                              title={`${exp.label}: ${fmtDecimal.format(exp.value)}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <Separator />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-medium tracking-tight">How to Use This Cash Flow Calculator</h2>
              <div className="space-y-6 text-neutral-400 font-light leading-relaxed">
                <p>
                  Cash flow is the lifeblood of rental property investing. This calculator helps you determine whether a property will put money in your pocket each month or drain it. A positive cash flow means the property pays for itself and generates profit; negative cash flow means you are subsidizing the investment out of pocket.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Key Metrics Explained</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-foreground">Cash-on-Cash Return</strong> measures your annual return on the actual cash you invested (down payment). Most investors target 8-12%.</li>
                    <li><strong className="text-foreground">Cap Rate</strong> (Capitalization Rate) is Net Operating Income divided by purchase price. It measures the property's return independent of financing. Higher cap rates mean higher risk/return.</li>
                    <li><strong className="text-foreground">GRM</strong> (Gross Rent Multiplier) is purchase price divided by annual rent. Lower GRM means faster payback. Under 10x is generally considered strong.</li>
                    <li><strong className="text-foreground">Vacancy Rate</strong> accounts for months the unit sits empty between tenants. 5-10% is typical depending on the market.</li>
                    <li><strong className="text-foreground">Maintenance Reserve</strong> is money set aside for repairs, typically 5-10% of rent. Older properties need more.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Rules of Thumb</h3>
                  <p>
                    The <strong className="text-foreground">1% Rule</strong>: Monthly rent should be at least 1% of the purchase price. The <strong className="text-foreground">50% Rule</strong>: Expect about 50% of gross rent to go to expenses (excluding mortgage). These are starting points, not substitutes for running the actual numbers above.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Separator />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-medium tracking-tight">Want AI to Analyze Rentals for You?</h2>
              <p className="text-neutral-400 font-light max-w-lg mx-auto">
                AIWholesail provides instant AI-powered analysis on any property, including cash flow projections, comp-based ARV, and deal scoring, so you can make faster, smarter investment decisions.
              </p>
              <Link to="/pricing">
                <Button size="lg" className="mt-2">
                  Try AIWholesail Free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
