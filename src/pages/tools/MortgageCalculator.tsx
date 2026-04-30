import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Home, DollarSign, Percent, Calendar, Shield, Building2, ArrowRight } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDecimal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function calcAmortization(principal: number, monthlyRate: number, totalPayments: number) {
  const schedule: { year: number; principalPaid: number; interestPaid: number; balance: number }[] = [];
  let balance = principal;

  for (let year = 1; year <= totalPayments / 12; year++) {
    let yearPrincipal = 0;
    let yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      if (balance <= 0) break;
      const interestPayment = balance * monthlyRate;
      const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
      const principalPayment = monthlyPayment - interestPayment;
      yearInterest += interestPayment;
      yearPrincipal += principalPayment;
      balance -= principalPayment;
    }
    schedule.push({
      year,
      principalPaid: yearPrincipal,
      interestPaid: yearInterest,
      balance: Math.max(0, balance),
    });
  }
  return schedule;
}

export default function MortgageCalculator() {
  const [homePrice, setHomePrice] = useState(350000);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState('30');
  const [propertyTax, setPropertyTax] = useState(4200);
  const [insurance, setInsurance] = useState(1800);
  const [hoa, setHoa] = useState(0);

  const downPaymentDollars = useMemo(() => homePrice * (downPaymentPercent / 100), [homePrice, downPaymentPercent]);
  const loanAmount = useMemo(() => homePrice - downPaymentDollars, [homePrice, downPaymentDollars]);
  const termYears = parseInt(loanTerm);
  const totalPayments = termYears * 12;
  const monthlyRate = interestRate / 100 / 12;

  const results = useMemo(() => {
    if (loanAmount <= 0 || monthlyRate <= 0 || totalPayments <= 0) {
      return null;
    }

    const monthlyPI = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    const monthlyTax = propertyTax / 12;
    const monthlyInsurance = insurance / 12;
    const totalMonthly = monthlyPI + monthlyTax + monthlyInsurance + hoa;
    const totalCost = totalMonthly * totalPayments;
    const totalInterest = (monthlyPI * totalPayments) - loanAmount;

    const schedule = calcAmortization(loanAmount, monthlyRate, totalPayments);
    const milestones = [1, 5, 10, termYears].filter(y => y <= termYears);
    const amortizationSummary = milestones.map(y => {
      const entry = schedule[y - 1];
      return entry ? { year: y, ...entry } : null;
    }).filter(Boolean);

    return {
      monthlyPI,
      monthlyTax,
      monthlyInsurance,
      monthlyHOA: hoa,
      totalMonthly,
      totalCost,
      totalInterest,
      amortizationSummary,
    };
  }, [loanAmount, monthlyRate, totalPayments, propertyTax, insurance, hoa, termYears]);

  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      <SEOHead
        title="Free Mortgage Calculator - Monthly Payment & Amortization"
        description="Calculate your monthly mortgage payment, total interest, and see a full amortization breakdown. Free mortgage calculator for home buyers and real estate investors."
        keywords="mortgage calculator, monthly mortgage payment, amortization schedule, home loan calculator, mortgage interest calculator, real estate calculator"
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
            <Home className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Mortgage Calculator
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Estimate your monthly mortgage payment, total cost of the loan, and see how principal and interest split over time.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Inputs */}
            <Card className="border border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-xl font-medium">Loan Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="homePrice" className="text-sm font-medium">Home Price</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="homePrice"
                      type="number"
                      value={homePrice}
                      onChange={e => setHomePrice(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="downPercent" className="text-sm font-medium">Down Payment (%)</Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        id="downPercent"
                        type="number"
                        value={downPaymentPercent}
                        onChange={e => setDownPaymentPercent(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-neutral-400">Down Payment ($)</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border border-border bg-white/[0.03] text-sm">
                      {fmt.format(downPaymentDollars)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="loanTerm" className="text-sm font-medium">Loan Term</Label>
                    <Select value={loanTerm} onValueChange={setLoanTerm}>
                      <SelectTrigger id="loanTerm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 Years</SelectItem>
                        <SelectItem value="30">30 Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

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
                  <Label htmlFor="insurance" className="text-sm font-medium">Homeowners Insurance (Annual)</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
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

                <div className="space-y-2">
                  <Label htmlFor="hoa" className="text-sm font-medium">HOA (Monthly)</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="hoa"
                      type="number"
                      value={hoa}
                      onChange={e => setHoa(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              <Card className="border border-white/[0.06] bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-xl font-medium">Monthly Payment</CardTitle>
                </CardHeader>
                <CardContent>
                  {results ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-5xl font-semibold tracking-tight text-cyan-400">
                          {fmtDecimal.format(results.totalMonthly)}
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">per month</p>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Principal & Interest</span>
                          <span className="font-medium">{fmtDecimal.format(results.monthlyPI)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Property Tax</span>
                          <span className="font-medium">{fmtDecimal.format(results.monthlyTax)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Insurance</span>
                          <span className="font-medium">{fmtDecimal.format(results.monthlyInsurance)}</span>
                        </div>
                        {results.monthlyHOA > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">HOA</span>
                            <span className="font-medium">{fmtDecimal.format(results.monthlyHOA)}</span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                          <p className="text-xs text-neutral-400 mb-1">Total Cost of Loan</p>
                          <p className="text-lg font-semibold">{fmt.format(results.totalCost)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                          <p className="text-xs text-neutral-400 mb-1">Total Interest Paid</p>
                          <p className="text-lg font-semibold">{fmt.format(results.totalInterest)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-8">Enter valid loan details to see your results.</p>
                  )}
                </CardContent>
              </Card>

              {/* Amortization Summary */}
              {results && results.amortizationSummary.length > 0 && (
                <Card className="border border-white/[0.06]">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Amortization Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 text-xs text-neutral-400 font-medium pb-2 border-b border-border">
                        <span>Year</span>
                        <span className="text-right">Principal</span>
                        <span className="text-right">Interest</span>
                        <span className="text-right">Balance</span>
                      </div>
                      {results.amortizationSummary.map((row: any) => (
                        <div key={row.year} className="grid grid-cols-4 text-sm py-1">
                          <span className="font-medium">Year {row.year}</span>
                          <span className="text-right text-emerald-600">{fmt.format(row.principalPaid)}</span>
                          <span className="text-right text-orange-500">{fmt.format(row.interestPaid)}</span>
                          <span className="text-right">{fmt.format(row.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <Separator />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-medium tracking-tight">How to Use This Mortgage Calculator</h2>
              <div className="space-y-6 text-neutral-400 font-light leading-relaxed">
                <p>
                  This mortgage calculator helps you estimate the true cost of a home loan. Enter the purchase price, your down payment, the interest rate from your lender, and choose between a 15-year or 30-year term. The calculator factors in property tax, homeowners insurance, and HOA fees to give you the complete monthly picture.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Understanding Your Results</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-foreground">Principal & Interest</strong> is the core mortgage payment, calculated using the standard amortization formula.</li>
                    <li><strong className="text-foreground">Property Tax</strong> is your annual tax divided by 12, typically escrowed into your monthly payment.</li>
                    <li><strong className="text-foreground">Total Interest Paid</strong> shows how much you pay the bank over the life of the loan beyond the original principal.</li>
                    <li><strong className="text-foreground">Amortization Summary</strong> reveals how much goes to principal vs. interest at key milestones. Early years are interest-heavy; later years shift toward principal.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Tips for Investors</h3>
                  <p>
                    When evaluating rental properties, compare this monthly payment against expected rental income. A common rule of thumb is the 1% rule: monthly rent should be at least 1% of the purchase price. Use our Cash Flow Calculator for a more detailed rental analysis.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Separator />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-medium tracking-tight">Want AI to Analyze Deals Automatically?</h2>
              <p className="text-neutral-400 font-light max-w-lg mx-auto">
                AIWholesail uses artificial intelligence to find, analyze, and score real estate deals for you, so you never miss a profitable opportunity.
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
