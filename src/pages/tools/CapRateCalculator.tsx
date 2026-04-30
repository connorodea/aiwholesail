import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Building2, DollarSign, Sparkles, ChevronRight, TrendingUp, Info } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtGrm = (n: number) => `${n.toFixed(1)}x`;

function getCapRateRating(rate: number): { label: string; color: string; description: string } {
  if (rate <= 0) return { label: 'N/A', color: 'text-neutral-400', description: 'Enter valid property data to see a rating.' };
  if (rate < 4) return { label: 'Low', color: 'text-orange-400', description: 'Typical of prime urban markets. Lower returns but potentially stronger appreciation and stability.' };
  if (rate < 7) return { label: 'Average', color: 'text-blue-400', description: 'Balanced risk and return. Common in suburban markets with steady demand.' };
  if (rate < 10) return { label: 'Good', color: 'text-emerald-400', description: 'Strong cash flow relative to price. Often found in secondary markets or value-add properties.' };
  return { label: 'Excellent', color: 'text-emerald-300', description: 'Very high return. Evaluate whether the high cap rate reflects added risk such as deferred maintenance or declining area.' };
}

export default function CapRateCalculator() {
  const [propertyValue, setPropertyValue] = useState(300000);
  const [grossAnnualRent, setGrossAnnualRent] = useState(36000);
  const [vacancyRate, setVacancyRate] = useState(5);
  const [propertyTax, setPropertyTax] = useState(3600);
  const [insuranceAnnual, setInsuranceAnnual] = useState(1800);
  const [maintenanceAnnual, setMaintenanceAnnual] = useState(2400);
  const [managementFeePct, setManagementFeePct] = useState(8);
  const [otherExpenses, setOtherExpenses] = useState(600);
  const [unitCount, setUnitCount] = useState(1);

  const results = useMemo(() => {
    const vacancyLoss = grossAnnualRent * (vacancyRate / 100);
    const effectiveGrossIncome = grossAnnualRent - vacancyLoss;
    const managementFee = effectiveGrossIncome * (managementFeePct / 100);
    const totalExpenses = propertyTax + insuranceAnnual + maintenanceAnnual + managementFee + otherExpenses;
    const noi = effectiveGrossIncome - totalExpenses;
    const capRate = propertyValue > 0 ? (noi / propertyValue) * 100 : 0;
    const grm = grossAnnualRent > 0 ? propertyValue / grossAnnualRent : 0;
    const pricePerUnit = unitCount > 0 ? propertyValue / unitCount : 0;
    const valueAt5 = noi > 0 ? noi / 0.05 : 0;
    const valueAt7 = noi > 0 ? noi / 0.07 : 0;
    const valueAt10 = noi > 0 ? noi / 0.10 : 0;
    const rating = getCapRateRating(capRate);

    return {
      vacancyLoss: Math.round(vacancyLoss),
      effectiveGrossIncome: Math.round(effectiveGrossIncome),
      managementFee: Math.round(managementFee),
      totalExpenses: Math.round(totalExpenses),
      noi: Math.round(noi),
      capRate,
      grm,
      pricePerUnit: Math.round(pricePerUnit),
      valueAt5: Math.round(valueAt5),
      valueAt7: Math.round(valueAt7),
      valueAt10: Math.round(valueAt10),
      rating,
    };
  }, [propertyValue, grossAnnualRent, vacancyRate, propertyTax, insuranceAnnual, maintenanceAnnual, managementFeePct, otherExpenses, unitCount]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const inputClassNoIcon = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Free Cap Rate Calculator - Capitalization Rate Calculator"
        description="Calculate cap rate, NOI, and GRM for investment properties. Compare property values at different cap rates. Free capitalization rate calculator for real estate investors."
        keywords="cap rate calculator, capitalization rate calculator, noi calculator, gross rent multiplier, real estate cap rate, investment property calculator, rental property analysis"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Building2 className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Cap Rate <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate the capitalization rate, net operating income, and gross rent multiplier for any investment property. See what your property would be worth at different cap rates.
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
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Property & Income</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the property value and gross annual rental income.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="propValue" className="text-sm text-neutral-300">Property Value / Purchase Price</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="propValue" type="number" className={inputClass} value={propertyValue} onChange={(e) => setPropertyValue(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="grossRent" className="text-sm text-neutral-300">Gross Annual Rent</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="grossRent" type="number" className={inputClass} value={grossAnnualRent} onChange={(e) => setGrossAnnualRent(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-neutral-500">
                        Monthly: {fmt.format(Math.round(grossAnnualRent / 12))}
                      </p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="vacancy" className="text-sm text-neutral-300">Vacancy Rate (%)</label>
                      <input id="vacancy" type="number" step={0.5} className={inputClassNoIcon} value={vacancyRate} onChange={(e) => setVacancyRate(Number(e.target.value))} min={0} max={50} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="units" className="text-sm text-neutral-300">Number of Units</label>
                      <input id="units" type="number" className={inputClassNoIcon} value={unitCount} onChange={(e) => setUnitCount(Math.max(1, Number(e.target.value)))} min={1} max={500} />
                      <p className="text-xs text-neutral-500">For price-per-unit calculation</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Operating Expenses</h2>
                <p className="text-sm text-neutral-400 mb-6">Annual expenses that reduce your net operating income. Do not include mortgage payments -- cap rate is calculated before debt service.</p>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="expTax" className="text-sm text-neutral-300">Property Tax (annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="expTax" type="number" className={inputClass} value={propertyTax} onChange={(e) => setPropertyTax(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="expIns" className="text-sm text-neutral-300">Insurance (annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="expIns" type="number" className={inputClass} value={insuranceAnnual} onChange={(e) => setInsuranceAnnual(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="expMaint" className="text-sm text-neutral-300">Maintenance (annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="expMaint" type="number" className={inputClass} value={maintenanceAnnual} onChange={(e) => setMaintenanceAnnual(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="expMgmt" className="text-sm text-neutral-300">Management Fee (% of rent)</label>
                      <input id="expMgmt" type="number" step={0.5} className={inputClassNoIcon} value={managementFeePct} onChange={(e) => setManagementFeePct(Number(e.target.value))} min={0} max={25} />
                      <p className="text-xs text-neutral-500">{fmt.format(results.managementFee)}/year</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="expOther" className="text-sm text-neutral-300">Other Operating Expenses (annual)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="expOther" type="number" className={inputClass} value={otherExpenses} onChange={(e) => setOtherExpenses(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Landscaping, HOA, pest control, etc.</p>
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
                    Property Analysis
                  </h2>
                  <div className="space-y-6">

                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Cap Rate</p>
                        <p className={`text-xl font-semibold ${results.rating.color}`}>
                          {results.capRate > 0 ? fmtPct(results.capRate) : '--'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">NOI</p>
                        <p className="text-xl font-semibold tabular-nums text-white">
                          {fmt.format(results.noi)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">GRM</p>
                        <p className="text-xl font-semibold tabular-nums text-white">
                          {results.grm > 0 ? fmtGrm(results.grm) : '--'}
                        </p>
                      </div>
                    </div>

                    {/* Cap rate rating */}
                    <div className="rounded-xl border border-white/[0.08] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-neutral-500" />
                        <p className="text-sm font-medium text-white">
                          Cap Rate: <span className={results.rating.color}>{results.rating.label}</span>
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400">{results.rating.description}</p>
                    </div>

                    {/* Multi-family price per unit */}
                    {unitCount > 1 && (
                      <div className="rounded-xl border border-white/[0.08] p-4">
                        <p className="text-sm text-neutral-400 mb-1">Price Per Unit ({unitCount} units)</p>
                        <p className="text-lg font-semibold tabular-nums text-white">{fmt.format(results.pricePerUnit)}</p>
                      </div>
                    )}

                    <div className="border-t border-white/[0.06]" />

                    {/* Income breakdown */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Income Breakdown</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Gross Rent</span>
                          <span className="tabular-nums text-white">{fmt.format(grossAnnualRent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Vacancy Loss ({vacancyRate}%)</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.vacancyLoss)}</span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Effective Gross Income</span>
                          <span className="tabular-nums text-white">{fmt.format(results.effectiveGrossIncome)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expense breakdown */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Expenses</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Property Tax', value: propertyTax },
                          { label: 'Insurance', value: insuranceAnnual },
                          { label: 'Maintenance', value: maintenanceAnnual },
                          { label: `Management (${managementFeePct}%)`, value: results.managementFee },
                          { label: 'Other', value: otherExpenses },
                        ].map(exp => (
                          <div key={exp.label} className="flex justify-between text-sm">
                            <span className="text-neutral-400">{exp.label}</span>
                            <span className="tabular-nums text-white">-{fmt.format(exp.value)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/[0.06] pt-2" />
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Total Expenses</span>
                          <span className="tabular-nums text-red-400">-{fmt.format(results.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* NOI highlight */}
                    <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-4 text-center">
                      <p className="text-xs text-neutral-400 mb-1">Net Operating Income (NOI)</p>
                      <p className="text-2xl font-semibold text-cyan-400 tabular-nums">{fmt.format(results.noi)}</p>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Value at different cap rates */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Estimated Value at Different Cap Rates</p>
                      <p className="text-xs text-neutral-400 mb-3">Using your NOI of {fmt.format(results.noi)}, here is what this property would be worth if the market priced it at different cap rates.</p>
                      <div className="space-y-2">
                        {[
                          { rate: '5%', label: 'Low risk / A-class', value: results.valueAt5 },
                          { rate: '7%', label: 'Average market', value: results.valueAt7 },
                          { rate: '10%', label: 'High yield', value: results.valueAt10 },
                        ].map(row => (
                          <div key={row.rate} className="flex items-center justify-between text-sm rounded-xl border border-white/[0.08] p-3">
                            <div>
                              <span className="font-medium text-white">{row.rate} Cap</span>
                              <span className="text-xs text-neutral-500 ml-2">({row.label})</span>
                            </div>
                            <span className="tabular-nums font-medium text-white">{fmt.format(row.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cap rate comparison table */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">What Cap Rates Mean</p>
                      <div className="space-y-1.5">
                        {[
                          { range: '2-4%', color: 'text-orange-400 border-orange-400/30', desc: 'Prime / Gateway markets. Appreciation play.' },
                          { range: '5-7%', color: 'text-blue-400 border-blue-400/30', desc: 'Balanced return. Suburban / stable demand.' },
                          { range: '8-10%', color: 'text-emerald-400 border-emerald-400/30', desc: 'Strong cash flow. Secondary / tertiary markets.' },
                          { range: '10%+', color: 'text-emerald-300 border-emerald-300/30', desc: 'Excellent yield. Verify risk factors carefully.' },
                        ].map(item => (
                          <div key={item.range} className="flex items-center gap-3 text-xs">
                            <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded-full border ${item.color}`}>{item.range}</span>
                            <span className="text-neutral-400">{item.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Want AI to analyze cap rates across your pipeline?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail calculates NOI, cap rate, and GRM for every property automatically using real-time rental data and expense estimates.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This Cap Rate Calculator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                The capitalization rate (cap rate) is one of the most important metrics in real estate investing. It measures the rate of return on an investment property based on the income it generates, independent of how the property is financed.
              </p>
              <h3 className="text-white font-semibold text-base">The formula</h3>
              <p className="font-mono text-xs bg-white/[0.03] border border-white/[0.08] p-3 rounded-xl text-neutral-300">
                Cap Rate = Net Operating Income (NOI) / Property Value x 100
              </p>
              <p>
                NOI is calculated by taking gross rental income, subtracting vacancy loss, and then subtracting all operating expenses. Critically, NOI does not include mortgage payments or debt service -- it represents the property's pure earning power before financing.
              </p>
              <h3 className="text-white font-semibold text-base">Step-by-step</h3>
              <ol className="space-y-2 list-decimal list-inside">
                <li><strong className="text-white">Enter the purchase price or current value</strong> and the total annual rental income. If you have multiple units, enter the combined rent for all units.</li>
                <li><strong className="text-white">Set vacancy rate.</strong> A 5% vacancy rate means the property is vacant roughly 2.5 weeks per year. For less desirable areas, use 8-10%.</li>
                <li><strong className="text-white">Enter operating expenses.</strong> Include property tax, insurance, maintenance, management fees, and any other recurring costs. Do not include mortgage payments.</li>
                <li><strong className="text-white">Review the results.</strong> The cap rate tells you what percentage return the property generates on its value each year.</li>
              </ol>
              <h3 className="text-white font-semibold text-base">Gross Rent Multiplier (GRM)</h3>
              <p>
                The GRM is a simpler metric: Property Price / Annual Rent. A lower GRM means you are paying less per dollar of rent. GRM is useful for quick comparisons but does not account for expenses, so it should always be paired with a cap rate analysis.
              </p>
              <h3 className="text-white font-semibold text-base">Value estimation</h3>
              <p>
                The "Estimated Value at Different Cap Rates" section reverses the formula. If you know the NOI, you can calculate what the property should be worth at market cap rates. This is particularly useful when evaluating whether a property is overpriced or underpriced relative to its income.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
