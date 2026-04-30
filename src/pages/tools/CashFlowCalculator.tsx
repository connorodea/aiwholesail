import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Percent, ArrowRight, Wallet, TrendingUp, TrendingDown, Building2 } from 'lucide-react';

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
    const totalPayments = 30 * 12;

    let monthlyMortgage = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    }

    const grossMonthlyIncome = monthlyRent;
    const vacancyLoss = grossMonthlyIncome * (vacancyRate / 100);
    const effectiveMonthlyIncome = grossMonthlyIncome - vacancyLoss;

    const monthlyPropertyTax = propertyTax / 12;
    const monthlyInsurance = insurance / 12;
    const monthlyManagement = effectiveMonthlyIncome * (managementFee / 100);
    const monthlyMaintenance = effectiveMonthlyIncome * (maintenanceReserve / 100);
    const totalMonthlyExpenses = monthlyMortgage + monthlyPropertyTax + monthlyInsurance + hoa + monthlyManagement + monthlyMaintenance + otherExpenses;

    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    const totalCashInvested = downPayment;
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

    const annualNOI = (effectiveMonthlyIncome - monthlyPropertyTax - monthlyInsurance - hoa - monthlyManagement - monthlyMaintenance - otherExpenses) * 12;
    const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

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

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Rental Property Cash Flow Calculator - Free Investment Tool"
        description="Free rental property cash flow calculator. Analyze monthly cash flow, cash-on-cash return, cap rate, and GRM. See a complete expense breakdown for any rental investment property."
        keywords="cash flow calculator, rental property calculator, cash on cash return calculator, cap rate calculator, rental income calculator, investment property analysis, real estate ROI calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Wallet className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
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
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-6">Property & Financing</h2>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="purchasePrice" className="text-sm text-neutral-300">Purchase Price</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="purchasePrice" type="number" value={purchasePrice} onChange={e => setPurchasePrice(Number(e.target.value))} className={inputClass} min={0} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="downPayment" className="text-sm text-neutral-300">Down Payment (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="downPayment" type="number" value={downPaymentPercent} onChange={e => setDownPaymentPercent(Number(e.target.value))} className={inputClass} min={0} max={100} step={1} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="interestRate" className="text-sm text-neutral-300">Interest Rate (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="interestRate" type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} className={inputClass} min={0} max={30} step={0.125} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="monthlyRent" className="text-sm text-neutral-300">Monthly Rent</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="monthlyRent" type="number" value={monthlyRent} onChange={e => setMonthlyRent(Number(e.target.value))} className={inputClass} min={0} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-6">Expenses</h2>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="propertyTax" className="text-sm text-neutral-300">Property Tax (Annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="propertyTax" type="number" value={propertyTax} onChange={e => setPropertyTax(Number(e.target.value))} className={inputClass} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="insurance" className="text-sm text-neutral-300">Insurance (Annual)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="insurance" type="number" value={insurance} onChange={e => setInsurance(Number(e.target.value))} className={inputClass} min={0} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="hoaExpense" className="text-sm text-neutral-300">HOA (Monthly)</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="hoaExpense" type="number" value={hoa} onChange={e => setHoa(Number(e.target.value))} className={inputClass} min={0} />
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-5" />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="vacancy" className="text-sm text-neutral-300">Vacancy (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="vacancy" type="number" value={vacancyRate} onChange={e => setVacancyRate(Number(e.target.value))} className={inputClass} min={0} max={100} step={1} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="mgmt" className="text-sm text-neutral-300">Mgmt Fee (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="mgmt" type="number" value={managementFee} onChange={e => setManagementFee(Number(e.target.value))} className={inputClass} min={0} max={100} step={1} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="maint" className="text-sm text-neutral-300">Maint. (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="maint" type="number" value={maintenanceReserve} onChange={e => setMaintenanceReserve(Number(e.target.value))} className={inputClass} min={0} max={100} step={1} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="otherExpenses" className="text-sm text-neutral-300">Other Expenses (Monthly)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="otherExpenses" type="number" value={otherExpenses} onChange={e => setOtherExpenses(Number(e.target.value))} className={inputClass} min={0} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {/* Cash Flow Hero */}
              <div className={`rounded-xl border-2 p-6 ${
                results && results.monthlyCashFlow >= 0
                  ? 'border-emerald-500/30 bg-emerald-950/20'
                  : results
                    ? 'border-red-500/30 bg-red-950/20'
                    : 'border-white/[0.05]'
              }`}>
                {results ? (
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      {results.monthlyCashFlow >= 0
                        ? <TrendingUp className="h-6 w-6 text-emerald-400" />
                        : <TrendingDown className="h-6 w-6 text-red-400" />
                      }
                      <p className="text-sm text-neutral-400">Monthly Cash Flow</p>
                    </div>
                    <p className={`text-5xl font-semibold tracking-tight ${results.monthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtDecimal.format(results.monthlyCashFlow)}
                    </p>
                    <p className="text-sm text-neutral-400">
                      {fmtDecimal.format(results.annualCashFlow)} / year
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-4">Enter property details to see cash flow.</p>
                )}
              </div>

              {/* Key Metrics */}
              {results && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Cash-on-Cash', value: fmtPct(results.cashOnCash), color: results.cashOnCash >= 0 ? 'text-cyan-400' : 'text-red-400' },
                    { label: 'Cap Rate', value: fmtPct(results.capRate), color: 'text-cyan-400' },
                    { label: 'GRM', value: `${results.grm.toFixed(1)}x`, color: 'text-cyan-400' },
                  ].map(metric => (
                    <div key={metric.label} className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-4 text-center">
                      <p className="text-xs text-neutral-400 mb-1">{metric.label}</p>
                      <p className={`text-xl font-semibold ${metric.color}`}>{metric.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Income vs Expenses */}
              {results && (
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                  <h2 className="text-lg font-bold tracking-tight text-white mb-5">Monthly Breakdown</h2>
                  <div className="space-y-5">
                    {/* Income */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Gross Rent</span>
                        <span className="font-medium text-white">{fmtDecimal.format(results.grossMonthlyIncome)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Vacancy Loss ({vacancyRate}%)</span>
                        <span className="font-medium text-red-400">-{fmtDecimal.format(results.vacancyLoss)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-white/[0.06]">
                        <span className="text-white">Effective Income</span>
                        <span className="text-emerald-400">{fmtDecimal.format(results.effectiveMonthlyIncome)}</span>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Expenses */}
                    <div className="space-y-2">
                      {expenseBreakdown.map(exp => (
                        <div key={exp.label} className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${exp.color}`} />
                            <span className="text-neutral-400">{exp.label}</span>
                          </div>
                          <span className="font-medium text-white">{fmtDecimal.format(exp.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-white/[0.06]">
                        <span className="text-white">Total Expenses</span>
                        <span className="text-red-400">{fmtDecimal.format(results.totalMonthlyExpenses)}</span>
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
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <div className="border-t border-white/[0.06]" />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">How to Use This Cash Flow Calculator</h2>
              <div className="space-y-6 text-neutral-400 font-light leading-relaxed">
                <p>
                  Cash flow is the lifeblood of rental property investing. This calculator helps you determine whether a property will put money in your pocket each month or drain it. A positive cash flow means the property pays for itself and generates profit; negative cash flow means you are subsidizing the investment out of pocket.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Key Metrics Explained</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-white">Cash-on-Cash Return</strong> measures your annual return on the actual cash you invested (down payment). Most investors target 8-12%.</li>
                    <li><strong className="text-white">Cap Rate</strong> (Capitalization Rate) is Net Operating Income divided by purchase price. It measures the property's return independent of financing. Higher cap rates mean higher risk/return.</li>
                    <li><strong className="text-white">GRM</strong> (Gross Rent Multiplier) is purchase price divided by annual rent. Lower GRM means faster payback. Under 10x is generally considered strong.</li>
                    <li><strong className="text-white">Vacancy Rate</strong> accounts for months the unit sits empty between tenants. 5-10% is typical depending on the market.</li>
                    <li><strong className="text-white">Maintenance Reserve</strong> is money set aside for repairs, typically 5-10% of rent. Older properties need more.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Rules of Thumb</h3>
                  <p>
                    The <strong className="text-white">1% Rule</strong>: Monthly rent should be at least 1% of the purchase price. The <strong className="text-white">50% Rule</strong>: Expect about 50% of gross rent to go to expenses (excluding mortgage). These are starting points, not substitutes for running the actual numbers above.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="border-t border-white/[0.06]" />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">Want AI to Analyze Rentals for You?</h2>
              <p className="text-neutral-400 font-light max-w-lg mx-auto">
                AIWholesail provides instant AI-powered analysis on any property, including cash flow projections, comp-based ARV, and deal scoring, so you can make faster, smarter investment decisions.
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
