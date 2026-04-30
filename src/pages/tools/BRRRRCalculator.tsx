import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { RefreshCw, DollarSign, TrendingUp, Sparkles, ChevronRight, Infinity, CheckCircle2, XCircle } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function BRRRRCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(120000);
  const [rehabCosts, setRehabCosts] = useState(35000);
  const [arv, setArv] = useState(220000);
  const [refiLtv, setRefiLtv] = useState(75);
  const [refiRate, setRefiRate] = useState(7.5);
  const [monthlyRent, setMonthlyRent] = useState(1800);
  const [taxes, setTaxes] = useState(250);
  const [insurance, setInsurance] = useState(120);
  const [maintenance, setMaintenance] = useState(150);
  const [management, setManagement] = useState(180);
  const [vacancy, setVacancy] = useState(90);
  const [holdingMonths, setHoldingMonths] = useState(4);
  const [monthlyHolding, setMonthlyHolding] = useState(800);

  const results = useMemo(() => {
    const totalHolding = holdingMonths * monthlyHolding;
    const totalCashInvested = purchasePrice + rehabCosts + totalHolding;
    const refiLoanAmount = Math.round(arv * (refiLtv / 100));
    const cashLeftInDeal = totalCashInvested - refiLoanAmount;

    const monthlyRate = refiRate / 100 / 12;
    const numPayments = 360;
    let monthlyMortgage = 0;
    if (monthlyRate > 0 && refiLoanAmount > 0) {
      monthlyMortgage = refiLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    const totalMonthlyExpenses = taxes + insurance + maintenance + management + vacancy + monthlyMortgage;
    const monthlyCashFlow = monthlyRent - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

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

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const inputClassNoIcon = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Free BRRRR Calculator - BRRRR Method Calculator"
        description="Analyze BRRRR deals with this free calculator. Calculate cash invested, refinance proceeds, monthly cash flow, and cash-on-cash return for Buy-Rehab-Rent-Refinance-Repeat strategies."
        keywords="brrrr calculator, brrrr method calculator, buy rehab rent refinance repeat, brrrr analysis, real estate brrrr, brrrr investment calculator, rental property calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <RefreshCw className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
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
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Purchase & Rehab</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter acquisition and renovation costs.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="purchase" className="text-sm text-neutral-300">Purchase Price</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="purchase" type="number" className={inputClass} value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="rehab" className="text-sm text-neutral-300">Rehab Costs</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="rehab" type="number" className={inputClass} value={rehabCosts} onChange={(e) => setRehabCosts(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="arv" className="text-sm text-neutral-300">After Repair Value (ARV)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="arv" type="number" className={inputClass} value={arv} onChange={(e) => setArv(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Refinance Terms</h2>
                <p className="text-sm text-neutral-400 mb-6">Expected loan terms after stabilization.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="ltv" className="text-sm text-neutral-300">Refinance LTV (%)</label>
                    <input id="ltv" type="number" className={inputClassNoIcon} value={refiLtv} onChange={(e) => setRefiLtv(Number(e.target.value))} min={0} max={100} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="rate" className="text-sm text-neutral-300">Interest Rate (%)</label>
                    <input id="rate" type="number" step={0.1} className={inputClassNoIcon} value={refiRate} onChange={(e) => setRefiRate(Number(e.target.value))} min={0} max={20} />
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Rental Income & Expenses</h2>
                <p className="text-sm text-neutral-400 mb-6">Monthly income and recurring costs after rehab is complete.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="rent" className="text-sm text-neutral-300">Monthly Rent</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="rent" type="number" className={inputClass} value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} min={0} />
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-4" />
                  <p className="text-sm font-medium text-neutral-400">Monthly Expenses</p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { id: 'expTaxes', label: 'Property Taxes', value: taxes, setter: setTaxes },
                      { id: 'expIns', label: 'Insurance', value: insurance, setter: setInsurance },
                      { id: 'expMaint', label: 'Maintenance', value: maintenance, setter: setMaintenance },
                      { id: 'expMgmt', label: 'Management', value: management, setter: setManagement },
                      { id: 'expVac', label: 'Vacancy Reserve', value: vacancy, setter: setVacancy },
                    ].map(exp => (
                      <div key={exp.id} className="space-y-2">
                        <label htmlFor={exp.id} className="text-sm text-neutral-300">{exp.label}</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <input id={exp.id} type="number" className={inputClass} value={exp.value} onChange={(e) => exp.setter(Number(e.target.value))} min={0} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Holding Costs</h2>
                <p className="text-sm text-neutral-400 mb-6">Costs incurred while the property is being rehabbed (before renting).</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="holdMonths" className="text-sm text-neutral-300">Rehab Duration (months)</label>
                    <input id="holdMonths" type="number" className={inputClassNoIcon} value={holdingMonths} onChange={(e) => setHoldingMonths(Math.max(0, Number(e.target.value)))} min={0} max={24} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="holdCost" className="text-sm text-neutral-300">Monthly Holding Cost</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="holdCost" type="number" className={inputClass} value={monthlyHolding} onChange={(e) => setMonthlyHolding(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Loan payments, utilities, insurance during rehab</p>
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
                    BRRRR Analysis
                  </h2>
                  <div className="space-y-6">

                    {results.infiniteReturn && (
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Infinity className="h-5 w-5 text-emerald-400" />
                          <span className="font-semibold text-emerald-400">Infinite Return</span>
                        </div>
                        <p className="text-xs text-neutral-400">All your cash is returned at refinance. You have none of your own money left in this deal.</p>
                      </div>
                    )}

                    {/* Investment summary */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Investment Summary</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Purchase Price', value: fmt.format(purchasePrice) },
                          { label: 'Rehab Costs', value: fmt.format(rehabCosts) },
                          { label: `Holding Costs (${holdingMonths} mo)`, value: fmt.format(results.totalHolding) },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between text-sm">
                            <span className="text-neutral-400">{row.label}</span>
                            <span className="tabular-nums text-white">{row.value}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-white">Total Cash Invested</span>
                          <span className="tabular-nums text-white">{fmt.format(results.totalCashInvested)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Refinance */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Refinance</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">ARV</span>
                          <span className="tabular-nums text-white">{fmt.format(arv)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Loan Amount ({refiLtv}% LTV)</span>
                          <span className="tabular-nums text-white">{fmt.format(results.refiLoanAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Money Back at Refi</span>
                          <span className="tabular-nums font-medium text-emerald-400">{fmt.format(results.moneyOut)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-white">Cash Left in Deal</span>
                          <span className={`tabular-nums ${results.cashLeftInDeal <= 0 ? 'text-emerald-400' : 'text-white'}`}>
                            {results.cashLeftInDeal <= 0 ? fmt.format(0) : fmt.format(results.cashLeftInDeal)}
                          </span>
                        </div>
                        {results.cashLeftInDeal < 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">Cash Surplus at Refi</span>
                            <span className="tabular-nums text-emerald-400">{fmt.format(Math.abs(results.cashLeftInDeal))}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Monthly cash flow */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Monthly Cash Flow</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Rental Income</span>
                          <span className="tabular-nums text-emerald-400">+{fmt.format(monthlyRent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Mortgage (P&I)</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.monthlyMortgage)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Operating Expenses</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(taxes + insurance + maintenance + management + vacancy)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-white">Net Cash Flow</span>
                          <span className={`tabular-nums ${results.monthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt.format(results.monthlyCashFlow)}/mo
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Returns */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/[0.08] p-3 text-center">
                        <p className="text-xs text-neutral-400 mb-1">Annual Cash Flow</p>
                        <p className={`text-lg font-semibold ${results.annualCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt.format(results.annualCashFlow)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3 text-center">
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
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2">
                      <p className="text-sm font-medium text-white">Quick Checks</p>
                      {[
                        { pass: results.monthlyCashFlow > 0, label: 'Positive cash flow after refi' },
                        { pass: results.infiniteReturn, label: 'All cash returned at refinance' },
                        { pass: results.cashOnCash > 12 || results.infiniteReturn, label: 'Cash-on-cash above 12%' },
                      ].map(check => (
                        <div key={check.label} className="flex items-center gap-2 text-sm">
                          {check.pass
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                            : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                          }
                          <span className="text-neutral-400">{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Want AI to find BRRRR deals automatically?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail scans off-market properties and runs BRRRR analysis in real time so you can move fast on the best opportunities.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This BRRRR Calculator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                The BRRRR method -- Buy, Rehab, Rent, Refinance, Repeat -- is a strategy for building a rental portfolio by recycling your capital. The goal is to buy undervalued properties, force appreciation through renovation, rent them out, and then refinance to pull your original investment back out so you can do it again.
              </p>
              <h3 className="text-white font-semibold text-base">What each section means</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Purchase & Rehab:</strong> Your total acquisition cost. In a true BRRRR, you buy with cash or a short-term loan, then refinance into a long-term mortgage after the rehab is complete.</li>
                <li><strong className="text-white">After Repair Value (ARV):</strong> The appraised value of the property after all renovations. This determines how much a lender will give you at refinance.</li>
                <li><strong className="text-white">Refinance LTV:</strong> Most conventional lenders offer 70-80% LTV on investment properties. The higher the LTV, the more cash you recover -- but the larger your monthly mortgage payment.</li>
                <li><strong className="text-white">Cash Left in Deal:</strong> This is the key BRRRR metric. If the refinance proceeds cover your total investment, you have zero dollars left in the deal and achieve an "infinite return."</li>
              </ul>
              <h3 className="text-white font-semibold text-base">Common mistakes</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Overestimating ARV -- be conservative with comps. Appraisers are not on your side.</li>
                <li>Underestimating rehab costs -- always add a 10-15% contingency buffer.</li>
                <li>Ignoring holding costs -- every month of rehab costs you money in loan payments, utilities, and insurance.</li>
                <li>Forgetting vacancy -- budget 5-8% of gross rent for vacancy and turnover.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
