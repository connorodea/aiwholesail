import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Sparkles, ChevronRight, TrendingUp, Info, Building2 } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtGrm = (n: number) => `${n.toFixed(1)}x`;

export default function RentalROICalculator() {
  const [purchasePrice, setPurchasePrice] = useState(250000);
  const [downPaymentPct, setDownPaymentPct] = useState(25);
  const [interestRate, setInterestRate] = useState(7);
  const [loanTerm, setLoanTerm] = useState(30);
  const [monthlyRent, setMonthlyRent] = useState(2200);
  const [annualTaxes, setAnnualTaxes] = useState(3000);
  const [annualInsurance, setAnnualInsurance] = useState(1500);
  const [maintenancePct, setMaintenancePct] = useState(5);
  const [vacancyPct, setVacancyPct] = useState(5);
  const [managementPct, setManagementPct] = useState(8);
  const [appreciationPct, setAppreciationPct] = useState(3);
  const [closingCosts, setClosingCosts] = useState(5000);

  const results = useMemo(() => {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;
    const totalCashInvested = downPayment + closingCosts;

    // Monthly mortgage (P&I)
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTerm * 12;
    const monthlyMortgage = monthlyRate > 0 && numPayments > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / Math.max(numPayments, 1);

    // Monthly expenses
    const monthlyTaxes = annualTaxes / 12;
    const monthlyInsurance = annualInsurance / 12;
    const grossAnnualRent = monthlyRent * 12;
    const vacancyLoss = grossAnnualRent * (vacancyPct / 100);
    const effectiveGrossIncome = grossAnnualRent - vacancyLoss;
    const maintenanceCost = effectiveGrossIncome * (maintenancePct / 100);
    const managementCost = effectiveGrossIncome * (managementPct / 100);

    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxes + monthlyInsurance + (maintenanceCost / 12) + (managementCost / 12);
    const effectiveMonthlyIncome = effectiveGrossIncome / 12;
    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // NOI (before debt service)
    const totalOperatingExpenses = annualTaxes + annualInsurance + maintenanceCost + managementCost;
    const noi = effectiveGrossIncome - totalOperatingExpenses;

    // Returns
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    const grm = grossAnnualRent > 0 ? purchasePrice / grossAnnualRent : 0;

    // 5-year projection
    const projection = [];
    let cumulativeCashFlow = 0;
    let propertyVal = purchasePrice;
    let loanBal = loanAmount;

    for (let year = 1; year <= 5; year++) {
      const yearCashFlow = annualCashFlow;
      cumulativeCashFlow += yearCashFlow;
      propertyVal = propertyVal * (1 + appreciationPct / 100);
      // Approximate principal paydown
      const yearlyInterest = loanBal * (interestRate / 100);
      const yearlyPayments = monthlyMortgage * 12;
      const principalPaid = Math.max(0, yearlyPayments - yearlyInterest);
      loanBal = Math.max(0, loanBal - principalPaid);

      const equity = propertyVal - loanBal;
      const appreciation = propertyVal - purchasePrice;
      const totalReturn = cumulativeCashFlow + appreciation + (loanAmount - loanBal) - (loanAmount - loanAmount);
      const totalROI = totalCashInvested > 0 ? ((cumulativeCashFlow + appreciation + (loanAmount - loanBal)) / totalCashInvested) * 100 : 0;

      projection.push({
        year,
        cashFlow: Math.round(yearCashFlow),
        cumulativeCashFlow: Math.round(cumulativeCashFlow),
        propertyValue: Math.round(propertyVal),
        equity: Math.round(equity),
        appreciation: Math.round(appreciation),
        totalROI,
      });
    }

    return {
      downPayment: Math.round(downPayment),
      loanAmount: Math.round(loanAmount),
      totalCashInvested: Math.round(totalCashInvested),
      monthlyMortgage: Math.round(monthlyMortgage),
      monthlyCashFlow: Math.round(monthlyCashFlow),
      annualCashFlow: Math.round(annualCashFlow),
      cashOnCash,
      capRate,
      grm,
      noi: Math.round(noi),
      effectiveGrossIncome: Math.round(effectiveGrossIncome),
      totalOperatingExpenses: Math.round(totalOperatingExpenses),
      vacancyLoss: Math.round(vacancyLoss),
      maintenanceCost: Math.round(maintenanceCost),
      managementCost: Math.round(managementCost),
      projection,
    };
  }, [purchasePrice, downPaymentPct, interestRate, loanTerm, monthlyRent, annualTaxes, annualInsurance, maintenancePct, vacancyPct, managementPct, appreciationPct, closingCosts]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const inputClassNoIcon = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Free Rental ROI Calculator - Cash-on-Cash Return & Cap Rate"
        description="Calculate rental property ROI, cash-on-cash return, cap rate, GRM, and monthly cash flow. See a 5-year projection with appreciation. Free rental ROI calculator for real estate investors."
        keywords="rental roi calculator, cash on cash return calculator, rental property calculator, cap rate calculator, rental cash flow calculator, investment property roi, real estate return calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Building2 className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Rental ROI <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate monthly cash flow, cash-on-cash return, cap rate, and total ROI with appreciation. See a full 5-year projection for your rental property.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-8">

            {/* Inputs */}
            <div className="lg:col-span-3 space-y-6">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Purchase & Financing</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the purchase details and loan terms.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="purchasePrice" className="text-sm text-neutral-300">Purchase Price</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="purchasePrice" type="number" className={inputClass} value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="downPayment" className="text-sm text-neutral-300">Down Payment (%)</label>
                      <input id="downPayment" type="number" step={1} className={inputClassNoIcon} value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} min={0} max={100} />
                      <p className="text-xs text-neutral-500">{fmt.format(purchasePrice * (downPaymentPct / 100))}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="interestRate" className="text-sm text-neutral-300">Interest Rate (%)</label>
                      <input id="interestRate" type="number" step={0.125} className={inputClassNoIcon} value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} min={0} max={20} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="loanTerm" className="text-sm text-neutral-300">Loan Term (years)</label>
                      <input id="loanTerm" type="number" className={inputClassNoIcon} value={loanTerm} onChange={(e) => setLoanTerm(Number(e.target.value))} min={1} max={40} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="closingCosts" className="text-sm text-neutral-300">Closing Costs</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="closingCosts" type="number" className={inputClass} value={closingCosts} onChange={(e) => setClosingCosts(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Rental Income & Expenses</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the monthly rent and annual expenses for the property.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="monthlyRent" className="text-sm text-neutral-300">Monthly Rent</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="monthlyRent" type="number" className={inputClass} value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-neutral-500">Annual: {fmt.format(monthlyRent * 12)}</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="annualTaxes" className="text-sm text-neutral-300">Property Taxes (annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="annualTaxes" type="number" className={inputClass} value={annualTaxes} onChange={(e) => setAnnualTaxes(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="annualInsurance" className="text-sm text-neutral-300">Insurance (annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="annualInsurance" type="number" className={inputClass} value={annualInsurance} onChange={(e) => setAnnualInsurance(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="appreciationPct" className="text-sm text-neutral-300">Annual Appreciation (%)</label>
                      <input id="appreciationPct" type="number" step={0.5} className={inputClassNoIcon} value={appreciationPct} onChange={(e) => setAppreciationPct(Number(e.target.value))} min={-5} max={15} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="maintenancePct" className="text-sm text-neutral-300">Maintenance (%)</label>
                      <input id="maintenancePct" type="number" step={0.5} className={inputClassNoIcon} value={maintenancePct} onChange={(e) => setMaintenancePct(Number(e.target.value))} min={0} max={20} />
                      <p className="text-xs text-neutral-500">{fmt.format(results.maintenanceCost)}/yr</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="vacancyPct" className="text-sm text-neutral-300">Vacancy (%)</label>
                      <input id="vacancyPct" type="number" step={0.5} className={inputClassNoIcon} value={vacancyPct} onChange={(e) => setVacancyPct(Number(e.target.value))} min={0} max={30} />
                      <p className="text-xs text-neutral-500">{fmt.format(results.vacancyLoss)}/yr</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="managementPct" className="text-sm text-neutral-300">Management (%)</label>
                      <input id="managementPct" type="number" step={0.5} className={inputClassNoIcon} value={managementPct} onChange={(e) => setManagementPct(Number(e.target.value))} min={0} max={20} />
                      <p className="text-xs text-neutral-500">{fmt.format(results.managementCost)}/yr</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">
              <div className="lg:sticky lg:top-28">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mb-6">
                    <TrendingUp className="h-5 w-5 text-cyan-400" />
                    Return Analysis
                  </h2>
                  <div className="space-y-6">

                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Cash-on-Cash</p>
                        <p className={`text-lg font-semibold ${results.cashOnCash >= 8 ? 'text-emerald-400' : results.cashOnCash >= 0 ? 'text-white' : 'text-red-400'}`}>
                          {fmtPct(results.cashOnCash)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Cap Rate</p>
                        <p className="text-lg font-semibold text-white">{fmtPct(results.capRate)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">GRM</p>
                        <p className="text-lg font-semibold text-white">{fmtGrm(results.grm)}</p>
                      </div>
                    </div>

                    {/* Monthly cash flow highlight */}
                    <div className={`rounded-xl p-4 text-center ${results.monthlyCashFlow >= 0 ? 'bg-cyan-500/5 border border-cyan-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                      <p className="text-xs text-neutral-400 mb-1">Monthly Cash Flow</p>
                      <p className={`text-2xl font-semibold tabular-nums ${results.monthlyCashFlow >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {fmt.format(results.monthlyCashFlow)}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">Annual: {fmt.format(results.annualCashFlow)}</p>
                    </div>

                    {/* Investment summary */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Investment Summary</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Down Payment</span>
                          <span className="tabular-nums text-white">{fmt.format(results.downPayment)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Closing Costs</span>
                          <span className="tabular-nums text-white">{fmt.format(closingCosts)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Total Cash Invested</span>
                          <span className="tabular-nums text-white">{fmt.format(results.totalCashInvested)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Loan Amount</span>
                          <span className="tabular-nums text-white">{fmt.format(results.loanAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Monthly Mortgage (P&I)</span>
                          <span className="tabular-nums text-white">{fmt.format(results.monthlyMortgage)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Income / Expense breakdown */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Annual Breakdown</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Gross Rent</span>
                          <span className="tabular-nums text-white">{fmt.format(monthlyRent * 12)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Vacancy ({vacancyPct}%)</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.vacancyLoss)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Operating Expenses</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.totalOperatingExpenses)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">NOI</span>
                          <span className="tabular-nums text-white">{fmt.format(results.noi)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Debt Service</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.monthlyMortgage * 12)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Annual Cash Flow</span>
                          <span className={`tabular-nums ${results.annualCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt.format(results.annualCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* 5-year projection */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">5-Year Projection</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.08]">
                              <th className="text-left text-neutral-400 font-medium py-2 pr-2">Year</th>
                              <th className="text-right text-neutral-400 font-medium py-2 px-1">Cash Flow</th>
                              <th className="text-right text-neutral-400 font-medium py-2 px-1">Value</th>
                              <th className="text-right text-neutral-400 font-medium py-2 pl-1">ROI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.projection.map(row => (
                              <tr key={row.year} className="border-b border-white/[0.04]">
                                <td className="py-2 pr-2 text-neutral-400">{row.year}</td>
                                <td className="text-right py-2 px-1 tabular-nums text-white">{fmt.format(row.cumulativeCashFlow)}</td>
                                <td className="text-right py-2 px-1 tabular-nums text-white">{fmt.format(row.propertyValue)}</td>
                                <td className="text-right py-2 pl-1 tabular-nums text-emerald-400">{fmtPct(row.totalROI)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Want AI to analyze rental ROI across your pipeline?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail calculates cash-on-cash return, cap rate, and cash flow for every property automatically using real-time rental data.</p>
                      <Link to="/pricing" className="inline-flex items-center gap-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 rounded-md text-sm transition-colors">
                        Try AIWholesail Free
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Section */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This Rental ROI Calculator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                This calculator gives you a comprehensive view of a rental property's return on investment. It combines cash flow analysis, return metrics, and a multi-year projection to help you make informed investment decisions.
              </p>
              <h3 className="text-white font-semibold text-base">Key metrics explained</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Cash-on-Cash Return:</strong> Annual cash flow divided by total cash invested (down payment + closing costs). Measures the return on your actual out-of-pocket investment. A CoC of 8-12% is generally considered good.</li>
                <li><strong className="text-white">Cap Rate:</strong> NOI divided by purchase price. Measures the property's unlevered return, useful for comparing properties regardless of financing. See our <Link to="/tools/cap-rate-calculator" className="text-cyan-400 hover:underline">Cap Rate Calculator</Link> for deeper analysis.</li>
                <li><strong className="text-white">GRM (Gross Rent Multiplier):</strong> Purchase price divided by annual gross rent. Lower is better. A quick comparison metric but does not account for expenses.</li>
                <li><strong className="text-white">Total ROI:</strong> Combines cash flow, appreciation, and principal paydown to show your true total return over time.</li>
              </ul>
              <h3 className="text-white font-semibold text-base">Understanding the 5-year projection</h3>
              <p>
                The projection table shows cumulative cash flow, estimated property value (based on your appreciation rate), and total ROI for each year. Total ROI includes three sources of wealth building: cash flow, equity from appreciation, and equity from mortgage principal paydown.
              </p>
              <h3 className="text-white font-semibold text-base">Tips for accurate analysis</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Use conservative estimates.</strong> Overestimating rent or underestimating expenses can make a bad deal look good.</li>
                <li><strong className="text-white">Account for vacancy.</strong> Even great properties will have turnover. 5-8% vacancy is standard.</li>
                <li><strong className="text-white">Include management fees</strong> even if you self-manage. Your time has value, and you may hire a manager later.</li>
              </ul>
            </div>

            {/* Internal links */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-sm font-medium text-white mb-3">Related Tools & Guides</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/tools/cap-rate-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Cap Rate Calculator</Link>
                <Link to="/tools/dscr-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">DSCR Calculator</Link>
                <Link to="/tools/cash-flow-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Cash Flow Calculator</Link>
                <Link to="/tools/mortgage-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Mortgage Calculator</Link>
                <Link to="/tools" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">All Calculators</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
