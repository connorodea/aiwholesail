import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Sparkles, ChevronRight, TrendingUp, Info, Clock } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function HoldingCostCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(200000);
  const [loanAmount, setLoanAmount] = useState(160000);
  const [interestRate, setInterestRate] = useState(8);
  const [monthlyTaxes, setMonthlyTaxes] = useState(300);
  const [monthlyInsurance, setMonthlyInsurance] = useState(150);
  const [monthlyUtilities, setMonthlyUtilities] = useState(200);
  const [holdPeriod, setHoldPeriod] = useState(6);
  const [monthlyMaintenance, setMonthlyMaintenance] = useState(100);
  const [expectedProfit, setExpectedProfit] = useState(40000);

  const results = useMemo(() => {
    const monthlyInterest = (loanAmount * (interestRate / 100)) / 12;
    const totalInterest = monthlyInterest * holdPeriod;
    const totalTaxes = monthlyTaxes * holdPeriod;
    const totalInsurance = monthlyInsurance * holdPeriod;
    const totalUtilities = monthlyUtilities * holdPeriod;
    const totalMaintenance = monthlyMaintenance * holdPeriod;

    const totalHoldingCosts = totalInterest + totalTaxes + totalInsurance + totalUtilities + totalMaintenance;
    const costPerMonth = holdPeriod > 0 ? totalHoldingCosts / holdPeriod : 0;
    const costPerDay = holdPeriod > 0 ? totalHoldingCosts / (holdPeriod * 30) : 0;
    const holdingCostPctOfPrice = purchasePrice > 0 ? (totalHoldingCosts / purchasePrice) * 100 : 0;
    const profitAfterHolding = expectedProfit - totalHoldingCosts;

    const breakdown = [
      { label: 'Interest', monthly: Math.round(monthlyInterest), total: Math.round(totalInterest), pct: totalHoldingCosts > 0 ? (totalInterest / totalHoldingCosts) * 100 : 0 },
      { label: 'Taxes', monthly: monthlyTaxes, total: Math.round(totalTaxes), pct: totalHoldingCosts > 0 ? (totalTaxes / totalHoldingCosts) * 100 : 0 },
      { label: 'Insurance', monthly: monthlyInsurance, total: Math.round(totalInsurance), pct: totalHoldingCosts > 0 ? (totalInsurance / totalHoldingCosts) * 100 : 0 },
      { label: 'Utilities', monthly: monthlyUtilities, total: Math.round(totalUtilities), pct: totalHoldingCosts > 0 ? (totalUtilities / totalHoldingCosts) * 100 : 0 },
      { label: 'Maintenance', monthly: monthlyMaintenance, total: Math.round(totalMaintenance), pct: totalHoldingCosts > 0 ? (totalMaintenance / totalHoldingCosts) * 100 : 0 },
    ];

    return {
      totalHoldingCosts: Math.round(totalHoldingCosts),
      costPerMonth: Math.round(costPerMonth),
      costPerDay: Math.round(costPerDay),
      holdingCostPctOfPrice,
      profitAfterHolding: Math.round(profitAfterHolding),
      breakdown,
    };
  }, [purchasePrice, loanAmount, interestRate, monthlyTaxes, monthlyInsurance, monthlyUtilities, holdPeriod, monthlyMaintenance, expectedProfit]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const inputClassNoIcon = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Free Holding Cost Calculator - Real Estate Carrying Cost Calculator"
        description="Calculate total holding costs for fix-and-flip or rental properties. See monthly interest, taxes, insurance, utilities, and maintenance costs. Free holding cost calculator."
        keywords="holding cost calculator, carrying cost calculator, real estate holding costs, fix and flip costs, property carrying costs, interest cost calculator, investor holding costs"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Clock className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Holding Cost <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate total carrying costs for your real estate deal. See how interest, taxes, insurance, utilities, and maintenance eat into your profit over time.
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
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Loan & Property</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the purchase price, loan amount, and interest rate for your deal.</p>
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
                      <label htmlFor="loanAmount" className="text-sm text-neutral-300">Loan Amount</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="loanAmount" type="number" className={inputClass} value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-neutral-500">LTV: {purchasePrice > 0 ? fmtPct((loanAmount / purchasePrice) * 100) : '0%'}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="interestRate" className="text-sm text-neutral-300">Annual Interest Rate (%)</label>
                      <input id="interestRate" type="number" step={0.25} className={inputClassNoIcon} value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} min={0} max={30} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="holdPeriod" className="text-sm text-neutral-300">Hold Period (months)</label>
                      <input id="holdPeriod" type="number" className={inputClassNoIcon} value={holdPeriod} onChange={(e) => setHoldPeriod(Math.max(1, Number(e.target.value)))} min={1} max={60} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Monthly Expenses</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the monthly costs you will carry while holding the property.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="monthlyTaxes" className="text-sm text-neutral-300">Property Taxes (monthly)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="monthlyTaxes" type="number" className={inputClass} value={monthlyTaxes} onChange={(e) => setMonthlyTaxes(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="monthlyInsurance" className="text-sm text-neutral-300">Insurance (monthly)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="monthlyInsurance" type="number" className={inputClass} value={monthlyInsurance} onChange={(e) => setMonthlyInsurance(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="monthlyUtilities" className="text-sm text-neutral-300">Utilities (monthly)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="monthlyUtilities" type="number" className={inputClass} value={monthlyUtilities} onChange={(e) => setMonthlyUtilities(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="monthlyMaintenance" className="text-sm text-neutral-300">Maintenance (monthly)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="monthlyMaintenance" type="number" className={inputClass} value={monthlyMaintenance} onChange={(e) => setMonthlyMaintenance(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="expectedProfit" className="text-sm text-neutral-300">Expected Gross Profit (before holding costs)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="expectedProfit" type="number" className={inputClass} value={expectedProfit} onChange={(e) => setExpectedProfit(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Used to show impact of holding costs on your profit</p>
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
                    Holding Cost Analysis
                  </h2>
                  <div className="space-y-6">

                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Total</p>
                        <p className="text-lg font-semibold tabular-nums text-red-400">{fmt.format(results.totalHoldingCosts)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Per Month</p>
                        <p className="text-lg font-semibold tabular-nums text-white">{fmt.format(results.costPerMonth)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Per Day</p>
                        <p className="text-lg font-semibold tabular-nums text-white">{fmt.format(results.costPerDay)}</p>
                      </div>
                    </div>

                    {/* Holding cost as % of price */}
                    <div className="rounded-xl border border-white/[0.08] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-neutral-500" />
                        <p className="text-sm font-medium text-white">
                          {fmtPct(results.holdingCostPctOfPrice)} of purchase price
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Over {holdPeriod} month{holdPeriod !== 1 ? 's' : ''}, holding costs equal {fmtPct(results.holdingCostPctOfPrice)} of your purchase price.
                      </p>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Breakdown by category */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Cost Breakdown ({holdPeriod} months)</p>
                      <div className="space-y-2">
                        {results.breakdown.map(item => (
                          <div key={item.label} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-400">{item.label}</span>
                              <span className="tabular-nums text-white">{fmt.format(item.total)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-500/50 rounded-full transition-all"
                                style={{ width: `${Math.min(item.pct, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-neutral-500">
                              <span>{fmt.format(item.monthly)}/mo</span>
                              <span>{fmtPct(item.pct)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Total Holding Costs</span>
                          <span className="tabular-nums text-red-400">{fmt.format(results.totalHoldingCosts)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Impact on profit */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Impact on Profit</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Expected Gross Profit</span>
                          <span className="tabular-nums text-white">{fmt.format(expectedProfit)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Holding Costs</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.totalHoldingCosts)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Net Profit After Holding</span>
                          <span className={`tabular-nums ${results.profitAfterHolding >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt.format(results.profitAfterHolding)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Net profit highlight */}
                    <div className={`rounded-xl p-4 text-center ${results.profitAfterHolding >= 0 ? 'bg-cyan-500/5 border border-cyan-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                      <p className="text-xs text-neutral-400 mb-1">Net Profit After Holding Costs</p>
                      <p className={`text-2xl font-semibold tabular-nums ${results.profitAfterHolding >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {fmt.format(results.profitAfterHolding)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Track holding costs automatically?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail factors holding costs into every deal analysis so you never overlook carrying expenses.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This Holding Cost Calculator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                Holding costs (also called carrying costs) are the ongoing expenses you pay while you own a property. For fix-and-flip investors, holding costs directly reduce your profit. For buy-and-hold investors, understanding carrying costs helps you plan your budget during vacancy or renovation periods.
              </p>
              <h3 className="text-white font-semibold text-base">What counts as a holding cost?</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Loan interest:</strong> Usually the largest holding cost. Hard money loans at 8-12% can cost thousands per month.</li>
                <li><strong className="text-white">Property taxes:</strong> Due regardless of whether the property is occupied or generating income.</li>
                <li><strong className="text-white">Insurance:</strong> Builder's risk or vacant property insurance during renovation.</li>
                <li><strong className="text-white">Utilities:</strong> Electric, water, gas needed for contractors and to prevent pipe freezing.</li>
                <li><strong className="text-white">Maintenance:</strong> Lawn care, snow removal, or minor repairs during the hold period.</li>
              </ul>
              <h3 className="text-white font-semibold text-base">Why speed matters</h3>
              <p>
                Every extra month you hold a property adds to your costs. A 6-month flip with $2,000/month in holding costs will eat $12,000 of your profit. Reducing your hold time by even one month can meaningfully increase your return.
              </p>
              <h3 className="text-white font-semibold text-base">Pro tip</h3>
              <p>
                Always add holding costs into your MAO calculation. If you expect to hold for 6 months at $2,000/month, subtract $12,000 from your maximum offer before committing to the deal.
              </p>
            </div>

            {/* Internal links */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-sm font-medium text-white mb-3">Related Tools & Guides</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/tools/wholesale-fee-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Wholesale Fee Calculator</Link>
                <Link to="/tools/mortgage-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Mortgage Calculator</Link>
                <Link to="/tools/brrrr-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">BRRRR Calculator</Link>
                <Link to="/tools/rehab-estimator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Rehab Cost Estimator</Link>
                <Link to="/tools" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">All Calculators</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
