import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Home, DollarSign, Percent, Shield, Building2, ArrowRight } from 'lucide-react';

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
    <PublicLayout>
      <SEOHead
        title="Free Mortgage Calculator - Monthly Payment & Amortization"
        description="Calculate your monthly mortgage payment, total interest, and see a full amortization breakdown. Free mortgage calculator for home buyers and real estate investors."
        keywords="mortgage calculator, monthly mortgage payment, amortization schedule, home loan calculator, mortgage interest calculator, real estate calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Home className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
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
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
              <h2 className="text-xl font-bold tracking-tight text-white mb-6">Loan Details</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="homePrice" className="text-sm text-neutral-300">Home Price</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      id="homePrice"
                      type="number"
                      value={homePrice}
                      onChange={e => setHomePrice(Number(e.target.value))}
                      className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                      min={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="downPercent" className="text-sm text-neutral-300">Down Payment (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input
                        id="downPercent"
                        type="number"
                        value={downPaymentPercent}
                        onChange={e => setDownPaymentPercent(Number(e.target.value))}
                        className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-400">Down Payment ($)</label>
                    <div className="flex items-center h-[46px] px-3 rounded-md border border-white/[0.08] bg-white/[0.03] text-sm text-neutral-300">
                      {fmt.format(downPaymentDollars)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="interestRate" className="text-sm text-neutral-300">Interest Rate (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input
                        id="interestRate"
                        type="number"
                        value={interestRate}
                        onChange={e => setInterestRate(Number(e.target.value))}
                        className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                        min={0}
                        max={30}
                        step={0.125}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="loanTerm" className="text-sm text-neutral-300">Loan Term</label>
                    <select
                      id="loanTerm"
                      value={loanTerm}
                      onChange={e => setLoanTerm(e.target.value)}
                      className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                    >
                      <option value="15">15 Years</option>
                      <option value="30">30 Years</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-5" />

                <div className="space-y-2">
                  <label htmlFor="propertyTax" className="text-sm text-neutral-300">Property Tax (Annual)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      id="propertyTax"
                      type="number"
                      value={propertyTax}
                      onChange={e => setPropertyTax(Number(e.target.value))}
                      className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="insurance" className="text-sm text-neutral-300">Homeowners Insurance (Annual)</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      id="insurance"
                      type="number"
                      value={insurance}
                      onChange={e => setInsurance(Number(e.target.value))}
                      className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="hoa" className="text-sm text-neutral-300">HOA (Monthly)</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      id="hoa"
                      type="number"
                      value={hoa}
                      onChange={e => setHoa(Number(e.target.value))}
                      className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-6">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-6">Monthly Payment</h2>
                {results ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-5xl font-semibold tracking-tight text-cyan-400">
                        {fmtDecimal.format(results.totalMonthly)}
                      </p>
                      <p className="text-sm text-neutral-400 mt-1">per month</p>
                    </div>

                    <div className="border-t border-white/[0.06] pt-5" />

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Principal & Interest</span>
                        <span className="font-medium text-white">{fmtDecimal.format(results.monthlyPI)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Property Tax</span>
                        <span className="font-medium text-white">{fmtDecimal.format(results.monthlyTax)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Insurance</span>
                        <span className="font-medium text-white">{fmtDecimal.format(results.monthlyInsurance)}</span>
                      </div>
                      {results.monthlyHOA > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">HOA</span>
                          <span className="font-medium text-white">{fmtDecimal.format(results.monthlyHOA)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/[0.06] pt-5" />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <p className="text-xs text-neutral-400 mb-1">Total Cost of Loan</p>
                        <p className="text-lg font-semibold text-white">{fmt.format(results.totalCost)}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <p className="text-xs text-neutral-400 mb-1">Total Interest Paid</p>
                        <p className="text-lg font-semibold text-white">{fmt.format(results.totalInterest)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-8">Enter valid loan details to see your results.</p>
                )}
              </div>

              {/* Amortization Summary */}
              {results && results.amortizationSummary.length > 0 && (
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                  <h2 className="text-lg font-bold tracking-tight text-white mb-4">Amortization Summary</h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 text-xs text-neutral-400 font-medium pb-2 border-b border-white/[0.06]">
                      <span>Year</span>
                      <span className="text-right">Principal</span>
                      <span className="text-right">Interest</span>
                      <span className="text-right">Balance</span>
                    </div>
                    {results.amortizationSummary.map((row: any) => (
                      <div key={row.year} className="grid grid-cols-4 text-sm py-1">
                        <span className="font-medium text-white">Year {row.year}</span>
                        <span className="text-right text-emerald-400">{fmt.format(row.principalPaid)}</span>
                        <span className="text-right text-orange-400">{fmt.format(row.interestPaid)}</span>
                        <span className="text-right text-white">{fmt.format(row.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <div className="border-t border-white/[0.06]" />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">How to Use This Mortgage Calculator</h2>
              <div className="space-y-6 text-neutral-400 font-light leading-relaxed">
                <p>
                  This mortgage calculator helps you estimate the true cost of a home loan. Enter the purchase price, your down payment, the interest rate from your lender, and choose between a 15-year or 30-year term. The calculator factors in property tax, homeowners insurance, and HOA fees to give you the complete monthly picture.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Understanding Your Results</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-white">Principal & Interest</strong> is the core mortgage payment, calculated using the standard amortization formula.</li>
                    <li><strong className="text-white">Property Tax</strong> is your annual tax divided by 12, typically escrowed into your monthly payment.</li>
                    <li><strong className="text-white">Total Interest Paid</strong> shows how much you pay the bank over the life of the loan beyond the original principal.</li>
                    <li><strong className="text-white">Amortization Summary</strong> reveals how much goes to principal vs. interest at key milestones. Early years are interest-heavy; later years shift toward principal.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Tips for Investors</h3>
                  <p>
                    When evaluating rental properties, compare this monthly payment against expected rental income. A common rule of thumb is the 1% rule: monthly rent should be at least 1% of the purchase price. Use our Cash Flow Calculator for a more detailed rental analysis.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="border-t border-white/[0.06]" />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">Want AI to Analyze Deals Automatically?</h2>
              <p className="text-neutral-400 font-light max-w-lg mx-auto">
                AIWholesail uses artificial intelligence to find, analyze, and score real estate deals for you, so you never miss a profitable opportunity.
              </p>
              <Link to="/pricing">
                <button className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-8 py-3 rounded-md text-sm transition-colors mt-2">
                  Try AIWholesail Free
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
