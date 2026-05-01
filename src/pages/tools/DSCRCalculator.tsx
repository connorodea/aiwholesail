import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Sparkles, ChevronRight, TrendingUp, Info, Shield } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtRatio = (n: number) => n.toFixed(2);

function getDSCRRating(dscr: number): { label: string; color: string; bgColor: string; description: string } {
  if (dscr <= 0) return { label: 'N/A', color: 'text-neutral-400', bgColor: 'bg-neutral-500/10', description: 'Enter valid data to see a rating.' };
  if (dscr < 1.0) return { label: 'Below Breakeven', color: 'text-red-400', bgColor: 'bg-red-500/10', description: 'The property does not generate enough income to cover debt payments. Most lenders will decline this loan.' };
  if (dscr < 1.2) return { label: 'Marginal', color: 'text-orange-400', bgColor: 'bg-orange-500/10', description: 'Barely covers debt service. Very few lenders will approve at this ratio. High risk of negative cash flow.' };
  if (dscr < 1.25) return { label: 'Acceptable', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', description: 'Meets minimum requirements for some lenders. Limited margin for unexpected expenses or vacancy.' };
  if (dscr < 1.5) return { label: 'Good', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', description: 'Meets standard DSCR loan requirements. Healthy buffer above debt service obligations.' };
  return { label: 'Excellent', color: 'text-emerald-300', bgColor: 'bg-emerald-500/10', description: 'Strong income relative to debt. Easily qualifies for DSCR loans and offers significant cash flow margin.' };
}

export default function DSCRCalculator() {
  const [monthlyRent, setMonthlyRent] = useState(2500);
  const [otherIncome, setOtherIncome] = useState(0);
  const [monthlyPrincipal, setMonthlyPrincipal] = useState(600);
  const [monthlyInterest, setMonthlyInterest] = useState(700);
  const [monthlyTaxes, setMonthlyTaxes] = useState(250);
  const [monthlyInsurance, setMonthlyInsurance] = useState(150);
  const [monthlyHOA, setMonthlyHOA] = useState(0);

  const results = useMemo(() => {
    const totalIncome = monthlyRent + otherIncome;
    const piti = monthlyPrincipal + monthlyInterest + monthlyTaxes + monthlyInsurance + monthlyHOA;
    const dscr = piti > 0 ? totalIncome / piti : 0;
    const rating = getDSCRRating(dscr);

    // What rent needed for common thresholds
    const rentFor100 = piti * 1.0 - otherIncome;
    const rentFor120 = piti * 1.2 - otherIncome;
    const rentFor125 = piti * 1.25 - otherIncome;
    const rentFor150 = piti * 1.5 - otherIncome;

    const monthlyCashFlow = totalIncome - piti;
    const annualCashFlow = monthlyCashFlow * 12;

    // Thresholds
    const thresholds = [
      { ratio: 1.0, label: 'Breakeven', met: dscr >= 1.0, rentNeeded: Math.max(0, Math.round(rentFor100)), color: 'text-red-400 border-red-400/30' },
      { ratio: 1.2, label: 'Minimum Lender', met: dscr >= 1.2, rentNeeded: Math.max(0, Math.round(rentFor120)), color: 'text-orange-400 border-orange-400/30' },
      { ratio: 1.25, label: 'Standard DSCR', met: dscr >= 1.25, rentNeeded: Math.max(0, Math.round(rentFor125)), color: 'text-cyan-400 border-cyan-400/30' },
      { ratio: 1.5, label: 'Strong', met: dscr >= 1.5, rentNeeded: Math.max(0, Math.round(rentFor150)), color: 'text-emerald-400 border-emerald-400/30' },
    ];

    return {
      totalIncome: Math.round(totalIncome),
      piti: Math.round(piti),
      dscr,
      rating,
      monthlyCashFlow: Math.round(monthlyCashFlow),
      annualCashFlow: Math.round(annualCashFlow),
      thresholds,
    };
  }, [monthlyRent, otherIncome, monthlyPrincipal, monthlyInterest, monthlyTaxes, monthlyInsurance, monthlyHOA]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  // Visual gauge position (0 to 2.0 range, capped)
  const gaugePosition = Math.min(Math.max(results.dscr, 0), 2.0);
  const gaugePercent = (gaugePosition / 2.0) * 100;

  return (
    <PublicLayout>
      <SEOHead
        title="Free DSCR Calculator - Debt Service Coverage Ratio Calculator"
        description="Calculate your DSCR ratio for investment property loans. See if your rental income meets lender requirements at 1.0, 1.2, and 1.25 thresholds. Free DSCR calculator."
        keywords="dscr calculator, debt service coverage ratio calculator, dscr loan calculator, investment property dscr, rental property dscr, dscr ratio calculator, real estate dscr"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Shield className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            DSCR <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate the debt service coverage ratio for your investment property. See whether your rental income meets lender requirements and what rent you need to qualify.
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
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Monthly Income</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the gross monthly rental income and any other recurring income from the property.</p>
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
                      <label htmlFor="otherIncome" className="text-sm text-neutral-300">Other Monthly Income</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="otherIncome" type="number" className={inputClass} value={otherIncome} onChange={(e) => setOtherIncome(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-neutral-500">Parking, laundry, storage, etc.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Monthly Debt Service (PITI)</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the monthly principal, interest, taxes, and insurance. Together these form your PITI payment.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="principal" className="text-sm text-neutral-300">Principal</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="principal" type="number" className={inputClass} value={monthlyPrincipal} onChange={(e) => setMonthlyPrincipal(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="interest" className="text-sm text-neutral-300">Interest</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="interest" type="number" className={inputClass} value={monthlyInterest} onChange={(e) => setMonthlyInterest(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="taxes" className="text-sm text-neutral-300">Property Taxes</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="taxes" type="number" className={inputClass} value={monthlyTaxes} onChange={(e) => setMonthlyTaxes(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="insurance" className="text-sm text-neutral-300">Insurance</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="insurance" type="number" className={inputClass} value={monthlyInsurance} onChange={(e) => setMonthlyInsurance(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="hoa" className="text-sm text-neutral-300">HOA / Other Obligations (monthly)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="hoa" type="number" className={inputClass} value={monthlyHOA} onChange={(e) => setMonthlyHOA(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Some lenders include HOA in debt service calculations</p>
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
                    DSCR Analysis
                  </h2>
                  <div className="space-y-6">

                    {/* DSCR ratio highlight */}
                    <div className={`rounded-xl p-6 text-center ${results.rating.bgColor} border border-white/[0.08]`}>
                      <p className="text-xs text-neutral-400 mb-2">Debt Service Coverage Ratio</p>
                      <p className={`text-4xl font-bold tabular-nums ${results.rating.color}`}>
                        {results.dscr > 0 ? fmtRatio(results.dscr) : '--'}
                      </p>
                      <p className={`text-sm font-medium mt-2 ${results.rating.color}`}>{results.rating.label}</p>
                    </div>

                    {/* Visual gauge */}
                    <div className="space-y-2">
                      <div className="relative h-3 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-emerald-500/30 rounded-full overflow-visible">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-neutral-800 transition-all"
                          style={{ left: `calc(${gaugePercent}% - 8px)` }}
                        />
                        {/* Threshold markers */}
                        <div className="absolute top-full mt-1 text-[10px] text-neutral-500" style={{ left: '50%', transform: 'translateX(-50%)' }}>1.0</div>
                        <div className="absolute top-full mt-1 text-[10px] text-neutral-500" style={{ left: '62.5%', transform: 'translateX(-50%)' }}>1.25</div>
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-500">
                        <span>0</span>
                        <span>2.0</span>
                      </div>
                    </div>

                    {/* Rating description */}
                    <div className="rounded-xl border border-white/[0.08] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-neutral-500" />
                        <p className="text-sm font-medium text-white">
                          Rating: <span className={results.rating.color}>{results.rating.label}</span>
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400">{results.rating.description}</p>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Income vs debt service */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Income vs. Debt Service</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Total Monthly Income</span>
                          <span className="tabular-nums text-emerald-400">{fmt.format(results.totalIncome)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Total PITI + Obligations</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.piti)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Monthly Cash Flow</span>
                          <span className={`tabular-nums ${results.monthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt.format(results.monthlyCashFlow)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Annual Cash Flow</span>
                          <span className={`tabular-nums ${results.annualCashFlow >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {fmt.format(results.annualCashFlow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Lender thresholds */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Lender Thresholds</p>
                      <div className="space-y-2">
                        {results.thresholds.map(t => (
                          <div key={t.ratio} className="flex items-center justify-between text-sm rounded-xl border border-white/[0.08] p-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded-full border text-xs ${t.color}`}>
                                {t.ratio}x
                              </span>
                              <span className="text-neutral-400">{t.label}</span>
                            </div>
                            <div className="text-right">
                              {t.met ? (
                                <span className="text-emerald-400 text-xs font-medium">Meets</span>
                              ) : (
                                <span className="text-red-400 text-xs font-medium">Need {fmt.format(t.rentNeeded)}/mo</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rent needed for 1.25 highlight */}
                    {!results.thresholds[2].met && (
                      <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4 text-center">
                        <p className="text-xs text-neutral-400 mb-1">Rent Needed for 1.25 DSCR</p>
                        <p className="text-2xl font-semibold text-orange-400 tabular-nums">
                          {fmt.format(results.thresholds[2].rentNeeded)}
                          <span className="text-sm font-normal text-neutral-500">/mo</span>
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {fmt.format(results.thresholds[2].rentNeeded - monthlyRent)} more than current rent
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Want DSCR calculated on every property?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail calculates DSCR, cash flow, and lender eligibility automatically for every property in your pipeline.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Understanding DSCR for Real Estate Investors</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                The Debt Service Coverage Ratio (DSCR) measures whether a property generates enough income to cover its debt obligations. It is the primary metric lenders use to evaluate DSCR loans, which qualify borrowers based on property income rather than personal income.
              </p>
              <h3 className="text-white font-semibold text-base">The formula</h3>
              <p className="font-mono text-xs bg-white/[0.03] border border-white/[0.08] p-3 rounded-xl text-neutral-300">
                DSCR = Gross Monthly Rental Income / Monthly PITI Payment
              </p>
              <p>
                PITI stands for Principal, Interest, Taxes, and Insurance. Some lenders also include HOA fees and other recurring property obligations.
              </p>
              <h3 className="text-white font-semibold text-base">What the numbers mean</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">DSCR below 1.0:</strong> The property does not generate enough income to cover debt payments. You would need to subsidize it from other sources.</li>
                <li><strong className="text-white">DSCR of 1.0:</strong> Breakeven. Income exactly covers debt service with zero margin.</li>
                <li><strong className="text-white">DSCR of 1.2:</strong> The minimum some lenders will accept. Very tight margin.</li>
                <li><strong className="text-white">DSCR of 1.25:</strong> The standard threshold for most DSCR loan programs. This means the property earns 25% more than needed to cover the mortgage.</li>
                <li><strong className="text-white">DSCR of 1.5+:</strong> Strong. The property significantly outearns its debt service, providing a healthy cash flow cushion.</li>
              </ul>
              <h3 className="text-white font-semibold text-base">DSCR loans explained</h3>
              <p>
                A DSCR loan is a type of investment property loan that qualifies borrowers based on the rental income of the property rather than the borrower's personal income (W-2s, tax returns). This makes them popular with self-employed investors, investors with multiple properties, or anyone who has strong rental properties but complex personal tax situations.
              </p>
              <h3 className="text-white font-semibold text-base">How to improve your DSCR</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Increase rent</strong> through property improvements, better marketing, or adding amenities.</li>
                <li><strong className="text-white">Reduce PITI</strong> by putting more money down (lower loan amount), shopping for lower rates, or appealing property taxes.</li>
                <li><strong className="text-white">Add income sources</strong> such as parking, laundry, or storage fees.</li>
              </ul>
            </div>

            {/* Internal links */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-sm font-medium text-white mb-3">Related Tools & Guides</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/tools/rental-roi-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Rental ROI Calculator</Link>
                <Link to="/tools/cap-rate-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Cap Rate Calculator</Link>
                <Link to="/tools/mortgage-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Mortgage Calculator</Link>
                <Link to="/tools/cash-flow-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Cash Flow Calculator</Link>
                <Link to="/tools" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">All Calculators</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
