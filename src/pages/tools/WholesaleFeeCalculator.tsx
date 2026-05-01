import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Sparkles, ChevronRight, TrendingUp, Info, Receipt } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function WholesaleFeeCalculator() {
  const [arv, setArv] = useState(250000);
  const [purchasePrice, setPurchasePrice] = useState(120000);
  const [repairCosts, setRepairCosts] = useState(35000);

  const results = useMemo(() => {
    const mao65 = arv * 0.65 - repairCosts;
    const mao70 = arv * 0.70 - repairCosts;
    const mao75 = arv * 0.75 - repairCosts;

    const assignmentFee70 = mao70 - purchasePrice;
    const assignmentFeeLow = Math.max(0, mao65 - purchasePrice);
    const assignmentFeeHigh = Math.max(0, mao75 - purchasePrice);

    const wholesalerProfit = mao70 - purchasePrice;
    const feeAsPercentOfArv = arv > 0 ? (assignmentFee70 / arv) * 100 : 0;

    const buyerProfitAt65 = arv - mao65 - repairCosts;
    const buyerProfitAt70 = arv - mao70 - repairCosts;
    const buyerProfitAt75 = arv - mao75 - repairCosts;

    return {
      mao65: Math.round(mao65),
      mao70: Math.round(mao70),
      mao75: Math.round(mao75),
      assignmentFee70: Math.round(assignmentFee70),
      assignmentFeeLow: Math.round(assignmentFeeLow),
      assignmentFeeHigh: Math.round(assignmentFeeHigh),
      wholesalerProfit: Math.round(wholesalerProfit),
      feeAsPercentOfArv,
      buyerProfitAt65: Math.round(buyerProfitAt65),
      buyerProfitAt70: Math.round(buyerProfitAt70),
      buyerProfitAt75: Math.round(buyerProfitAt75),
    };
  }, [arv, purchasePrice, repairCosts]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Free Wholesale Fee Calculator - Assignment Fee & MAO Calculator"
        description="Calculate your wholesale assignment fee, MAO using the 70% rule, and wholesaler profit. Compare fees at 65%, 70%, and 75% rules. Free wholesale fee calculator for real estate wholesalers."
        keywords="wholesale fee calculator, assignment fee calculator, wholesale profit calculator, MAO calculator, 70 percent rule, real estate wholesale, wholesaling calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Receipt className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Wholesale Fee <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate your maximum allowable offer, assignment fee range, and wholesaler profit using the 70% rule. Compare results at 65%, 70%, and 75% thresholds.
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
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Deal Details</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the after repair value, your purchase price, and estimated repair costs.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="arv" className="text-sm text-neutral-300">After Repair Value (ARV)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="arv" type="number" className={inputClass} value={arv} onChange={(e) => setArv(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">What the property will be worth after repairs are complete</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="purchasePrice" className="text-sm text-neutral-300">Your Purchase Price (Contract Price)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="purchasePrice" type="number" className={inputClass} value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">The price you have the property under contract for</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="repairCosts" className="text-sm text-neutral-300">Estimated Repair Costs</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="repairCosts" type="number" className={inputClass} value={repairCosts} onChange={(e) => setRepairCosts(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Total rehab budget the end buyer will need to spend</p>
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
                    Fee Analysis
                  </h2>
                  <div className="space-y-6">

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">MAO (70%)</p>
                        <p className="text-xl font-semibold tabular-nums text-white">{fmt.format(results.mao70)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] p-3">
                        <p className="text-xs text-neutral-400 mb-1">Your Profit</p>
                        <p className={`text-xl font-semibold tabular-nums ${results.wholesalerProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt.format(results.wholesalerProfit)}
                        </p>
                      </div>
                    </div>

                    {/* Fee as % of ARV */}
                    <div className="rounded-xl border border-white/[0.08] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-neutral-500" />
                        <p className="text-sm font-medium text-white">
                          Fee as % of ARV: <span className={results.feeAsPercentOfArv <= 10 ? 'text-emerald-400' : 'text-orange-400'}>{fmtPct(results.feeAsPercentOfArv)}</span>
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {results.feeAsPercentOfArv <= 5
                          ? 'Very reasonable fee. Easy sell to end buyers.'
                          : results.feeAsPercentOfArv <= 10
                          ? 'Standard wholesale fee range. Most buyers will accept this.'
                          : 'High fee relative to ARV. May be harder to assign to an end buyer.'}
                      </p>
                    </div>

                    {/* Assignment fee range */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Assignment Fee Range</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Conservative (65% rule)</span>
                          <span className="tabular-nums text-white">{fmt.format(results.assignmentFeeLow)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-white">Standard (70% rule)</span>
                          <span className="tabular-nums text-cyan-400">{fmt.format(results.assignmentFee70)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Aggressive (75% rule)</span>
                          <span className="tabular-nums text-white">{fmt.format(results.assignmentFeeHigh)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Comparison at different rules */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">MAO Comparison</p>
                      <div className="space-y-2">
                        {[
                          { rule: '65%', mao: results.mao65, profit: results.buyerProfitAt65, color: 'text-emerald-400 border-emerald-400/30' },
                          { rule: '70%', mao: results.mao70, profit: results.buyerProfitAt70, color: 'text-cyan-400 border-cyan-400/30' },
                          { rule: '75%', mao: results.mao75, profit: results.buyerProfitAt75, color: 'text-orange-400 border-orange-400/30' },
                        ].map(row => (
                          <div key={row.rule} className="flex items-center justify-between text-sm rounded-xl border border-white/[0.08] p-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded-full border text-xs ${row.color}`}>{row.rule}</span>
                              <span className="text-neutral-400">MAO</span>
                            </div>
                            <div className="text-right">
                              <span className="tabular-nums font-medium text-white">{fmt.format(row.mao)}</span>
                              <p className="text-xs text-neutral-500">Buyer profit: {fmt.format(row.profit)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wholesaler profit highlight */}
                    <div className={`rounded-xl p-4 text-center ${results.wholesalerProfit >= 0 ? 'bg-cyan-500/5 border border-cyan-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                      <p className="text-xs text-neutral-400 mb-1">Wholesaler Profit (70% Rule)</p>
                      <p className={`text-2xl font-semibold tabular-nums ${results.wholesalerProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {fmt.format(results.wholesalerProfit)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Want AI to calculate fees on every deal?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail calculates MAO, assignment fees, and profit margins automatically for every property in your pipeline.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This Wholesale Fee Calculator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                A wholesale fee (also called an assignment fee) is the profit a wholesaler earns by assigning a purchase contract to an end buyer. This calculator helps you determine whether a deal has enough margin to be profitable for both you and your buyer.
              </p>
              <h3 className="text-white font-semibold text-base">The 70% Rule</h3>
              <p className="font-mono text-xs bg-white/[0.03] border border-white/[0.08] p-3 rounded-xl text-neutral-300">
                MAO = ARV x 70% - Repair Costs
              </p>
              <p>
                The 70% rule states that an investor should pay no more than 70% of a property's after repair value (ARV), minus repair costs. The remaining 30% covers profit, holding costs, closing costs, and a margin of safety.
              </p>
              <h3 className="text-white font-semibold text-base">How your fee is calculated</h3>
              <p>
                Your wholesale fee is the difference between your contract price (what you agreed to pay the seller) and the MAO (what a buyer is willing to pay). The larger the gap, the larger your fee. However, if your fee is too large relative to the ARV, buyers may walk away.
              </p>
              <h3 className="text-white font-semibold text-base">Tips for healthy deals</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Keep your fee under 10% of ARV</strong> for the smoothest assignments.</li>
                <li><strong className="text-white">Use the 65% rule</strong> in hot markets where buyers are more selective.</li>
                <li><strong className="text-white">Use the 75% rule</strong> only in buyer-friendly markets with experienced investors.</li>
                <li><strong className="text-white">Always verify ARV</strong> with recent comparable sales, not listing prices.</li>
              </ul>
            </div>

            {/* Internal links */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-sm font-medium text-white mb-3">Related Tools & Guides</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/tools/70-percent-rule-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">70% Rule Calculator</Link>
                <Link to="/tools/arv-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">ARV Calculator</Link>
                <Link to="/tools/wholesale-deal-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Wholesale Deal Calculator</Link>
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
