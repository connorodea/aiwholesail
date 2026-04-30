import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, DollarSign, TrendingUp, Sparkles, ChevronRight, Infinity, CheckCircle2, XCircle } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function BRRRRCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(120000);
  const [rehabCosts, setRehabCosts] = useState(35000);
  const [arv, setArv] = useState(220000);
  const [refiLtv, setRefiLtv] = useState(75);
  const [refiRate, setRefiRate] = useState(7.5);
  const [monthlyRent, setMonthlyRent] = useState(1800);

  // Monthly expenses
  const [taxes, setTaxes] = useState(250);
  const [insurance, setInsurance] = useState(120);
  const [maintenance, setMaintenance] = useState(150);
  const [management, setManagement] = useState(180);
  const [vacancy, setVacancy] = useState(90);

  // Holding costs
  const [holdingMonths, setHoldingMonths] = useState(4);
  const [monthlyHolding, setMonthlyHolding] = useState(800);

  const results = useMemo(() => {
    const totalHolding = holdingMonths * monthlyHolding;
    const totalCashInvested = purchasePrice + rehabCosts + totalHolding;

    const refiLoanAmount = Math.round(arv * (refiLtv / 100));
    const cashLeftInDeal = totalCashInvested - refiLoanAmount;
    const moneyOut = refiLoanAmount - 0; // money returned at refi

    // Monthly mortgage payment (PI) on refi loan
    const monthlyRate = refiRate / 100 / 12;
    const numPayments = 360; // 30-year
    let monthlyMortgage = 0;
    if (monthlyRate > 0 && refiLoanAmount > 0) {
      monthlyMortgage = refiLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    const totalMonthlyExpenses = taxes + insurance + maintenance + management + vacancy + monthlyMortgage;
    const monthlyCashFlow = monthlyRent - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // Cash-on-cash return (on cash left in deal)
    let cashOnCash = 0;
    const infiniteReturn = cashLeftInDeal <= 0;
    if (!infiniteReturn && cashLeftInDeal > 0) {
      cashOnCash = (annualCashFlow / cashLeftInDeal) * 100;
    }

    return {
      totalHolding,
      totalCashInvested,
      refiLoanAmount,
      cashLeftInDeal,
      moneyOut: refiLoanAmount,
      monthlyMortgage: Math.round(monthlyMortgage),
      totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
      monthlyCashFlow: Math.round(monthlyCashFlow),
      annualCashFlow: Math.round(annualCashFlow),
      cashOnCash,
      infiniteReturn,
    };
  }, [purchasePrice, rehabCosts, arv, refiLtv, refiRate, monthlyRent, taxes, insurance, maintenance, management, vacancy, holdingMonths, monthlyHolding]);

  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      <SEOHead
        title="Free BRRRR Calculator - BRRRR Method Calculator"
        description="Analyze BRRRR deals with this free calculator. Calculate cash invested, refinance proceeds, monthly cash flow, and cash-on-cash return for Buy-Rehab-Rent-Refinance-Repeat strategies."
        keywords="brrrr calculator, brrrr method calculator, buy rehab rent refinance repeat, brrrr analysis, real estate brrrr, brrrr investment calculator, rental property calculator"
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
              <div className="text-lg font-semibold">AIWholesail</div>
              <Link to="/pricing" className="text-sm font-medium text-cyan-400 hover:text-cyan-400/80 transition-colors">
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Badge variant="secondary" className="mb-4">
            <RefreshCw className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            BRRRR <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Analyze Buy, Rehab, Rent, Refinance, Repeat deals. See how much cash stays in the deal after refinancing and whether you achieve the coveted infinite return.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-8">

            {/* Inputs */}
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Purchase & Rehab</CardTitle>
                  <CardDescription>Enter acquisition and renovation costs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="purchase">Purchase Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="purchase" type="number" className="pl-9" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rehab">Rehab Costs</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="rehab" type="number" className="pl-9" value={rehabCosts} onChange={(e) => setRehabCosts(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arv">After Repair Value (ARV)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input id="arv" type="number" className="pl-9" value={arv} onChange={(e) => setArv(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Refinance Terms</CardTitle>
                  <CardDescription>Expected loan terms after stabilization.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ltv">Refinance LTV (%)</Label>
                      <Input id="ltv" type="number" value={refiLtv} onChange={(e) => setRefiLtv(Number(e.target.value))} min={0} max={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate">Interest Rate (%)</Label>
                      <Input id="rate" type="number" step={0.1} value={refiRate} onChange={(e) => setRefiRate(Number(e.target.value))} min={0} max={20} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Rental Income & Expenses</CardTitle>
                  <CardDescription>Monthly income and recurring costs after rehab is complete.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rent">Monthly Rent</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input id="rent" type="number" className="pl-9" value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} min={0} />
                    </div>
                  </div>

                  <Separator />
                  <p className="text-sm font-medium text-neutral-400">Monthly Expenses</p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expTaxes">Property Taxes</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="expTaxes" type="number" className="pl-9" value={taxes} onChange={(e) => setTaxes(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expIns">Insurance</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="expIns" type="number" className="pl-9" value={insurance} onChange={(e) => setInsurance(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expMaint">Maintenance</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="expMaint" type="number" className="pl-9" value={maintenance} onChange={(e) => setMaintenance(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expMgmt">Management</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="expMgmt" type="number" className="pl-9" value={management} onChange={(e) => setManagement(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expVac">Vacancy Reserve</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="expVac" type="number" className="pl-9" value={vacancy} onChange={(e) => setVacancy(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Holding Costs</CardTitle>
                  <CardDescription>Costs incurred while the property is being rehabbed (before renting).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="holdMonths">Rehab Duration (months)</Label>
                      <Input id="holdMonths" type="number" value={holdingMonths} onChange={(e) => setHoldingMonths(Math.max(0, Number(e.target.value)))} min={0} max={24} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holdCost">Monthly Holding Cost</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input id="holdCost" type="number" className="pl-9" value={monthlyHolding} onChange={(e) => setMonthlyHolding(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-neutral-400">Loan payments, utilities, insurance during rehab</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">
              <div className="lg:sticky lg:top-28">
                <Card className="border-primary/20 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-cyan-400" />
                      BRRRR Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* Infinite return badge */}
                    {results.infiniteReturn && (
                      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Infinity className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-600">Infinite Return</span>
                        </div>
                        <p className="text-xs text-neutral-400">All your cash is returned at refinance. You have none of your own money left in this deal.</p>
                      </div>
                    )}

                    {/* Investment summary */}
                    <div>
                      <p className="text-sm font-medium mb-3">Investment Summary</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Purchase Price</span>
                          <span className="tabular-nums">{fmt.format(purchasePrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Rehab Costs</span>
                          <span className="tabular-nums">{fmt.format(rehabCosts)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Holding Costs ({holdingMonths} mo)</span>
                          <span className="tabular-nums">{fmt.format(results.totalHolding)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total Cash Invested</span>
                          <span className="tabular-nums">{fmt.format(results.totalCashInvested)}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Refinance */}
                    <div>
                      <p className="text-sm font-medium mb-3">Refinance</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">ARV</span>
                          <span className="tabular-nums">{fmt.format(arv)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Loan Amount ({refiLtv}% LTV)</span>
                          <span className="tabular-nums">{fmt.format(results.refiLoanAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Money Back at Refi</span>
                          <span className="tabular-nums font-medium text-green-600">{fmt.format(results.moneyOut)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Cash Left in Deal</span>
                          <span className={`tabular-nums ${results.cashLeftInDeal <= 0 ? 'text-green-600' : ''}`}>
                            {results.cashLeftInDeal <= 0 ? fmt.format(0) : fmt.format(results.cashLeftInDeal)}
                          </span>
                        </div>
                        {results.cashLeftInDeal < 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">Cash Surplus at Refi</span>
                            <span className="tabular-nums text-green-600">{fmt.format(Math.abs(results.cashLeftInDeal))}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Monthly cash flow */}
                    <div>
                      <p className="text-sm font-medium mb-3">Monthly Cash Flow</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Rental Income</span>
                          <span className="tabular-nums text-green-600">+{fmt.format(monthlyRent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Mortgage (P&I)</span>
                          <span className="tabular-nums text-red-500">-{fmt.format(results.monthlyMortgage)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Operating Expenses</span>
                          <span className="tabular-nums text-red-500">-{fmt.format(taxes + insurance + maintenance + management + vacancy)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Net Cash Flow</span>
                          <span className={`tabular-nums ${results.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {fmt.format(results.monthlyCashFlow)}/mo
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Returns */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-xs text-neutral-400 mb-1">Annual Cash Flow</p>
                        <p className={`text-lg font-semibold ${results.annualCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmt.format(results.annualCashFlow)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-xs text-neutral-400 mb-1">Cash-on-Cash</p>
                        <p className="text-lg font-semibold text-cyan-400">
                          {results.infiniteReturn ? (
                            <span className="flex items-center justify-center gap-1"><Infinity className="h-5 w-5" /></span>
                          ) : (
                            fmtPct(results.cashOnCash)
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Quick verdict */}
                    <div className="rounded-lg bg-white/[0.03] p-4 space-y-2">
                      <p className="text-sm font-medium">Quick Checks</p>
                      <div className="flex items-center gap-2 text-sm">
                        {results.monthlyCashFlow > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-neutral-400">Positive cash flow after refi</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {results.infiniteReturn ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-neutral-400">All cash returned at refinance</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {results.cashOnCash > 12 || results.infiniteReturn ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-neutral-400">Cash-on-cash above 12%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CTA */}
                <Card className="mt-6 bg-cyan-500/5 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm mb-1">Want AI to find BRRRR deals automatically?</p>
                        <p className="text-xs text-neutral-400 mb-3">AIWholesail scans off-market properties and runs BRRRR analysis in real time so you can move fast on the best opportunities.</p>
                        <Button asChild size="sm">
                          <Link to="/pricing">
                            Try AIWholesail Free
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Section */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">How to Use This BRRRR Calculator</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none space-y-4 text-neutral-400">
              <p>
                The BRRRR method -- Buy, Rehab, Rent, Refinance, Repeat -- is a strategy for building a rental portfolio by recycling your capital. The goal is to buy undervalued properties, force appreciation through renovation, rent them out, and then refinance to pull your original investment back out so you can do it again.
              </p>
              <h3 className="text-foreground font-semibold text-base">What each section means</h3>
              <ul className="space-y-2">
                <li><strong>Purchase & Rehab:</strong> Your total acquisition cost. In a true BRRRR, you buy with cash or a short-term loan, then refinance into a long-term mortgage after the rehab is complete.</li>
                <li><strong>After Repair Value (ARV):</strong> The appraised value of the property after all renovations. This determines how much a lender will give you at refinance. Research comparable sales within a half-mile radius that closed in the last 90 days.</li>
                <li><strong>Refinance LTV:</strong> Most conventional lenders offer 70-80% LTV on investment properties. The higher the LTV, the more cash you recover -- but the larger your monthly mortgage payment.</li>
                <li><strong>Cash Left in Deal:</strong> This is the key BRRRR metric. If the refinance proceeds cover your total investment, you have zero dollars left in the deal and achieve an "infinite return" -- you are making money on a property with none of your own capital at risk.</li>
              </ul>
              <h3 className="text-foreground font-semibold text-base">Common mistakes</h3>
              <ul className="space-y-1">
                <li>Overestimating ARV -- be conservative with comps. Appraisers are not on your side.</li>
                <li>Underestimating rehab costs -- always add a 10-15% contingency buffer.</li>
                <li>Ignoring holding costs -- every month of rehab costs you money in loan payments, utilities, and insurance.</li>
                <li>Forgetting vacancy -- budget 5-8% of gross rent for vacancy and turnover.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
