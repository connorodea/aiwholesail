import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Slider } from '@/components/ui/slider';
import { Target, DollarSign, Sparkles, ChevronRight, BarChart3 } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function OfferPriceCalculator() {
  const [arv, setArv] = useState(250000);
  const [repairEstimate, setRepairEstimate] = useState(35000);
  const [profitMargin, setProfitMargin] = useState(30);
  const [assignmentFee, setAssignmentFee] = useState(10000);
  const [closingCostsPct, setClosingCostsPct] = useState(3);
  const [holdingCosts, setHoldingCosts] = useState(8000);

  const results = useMemo(() => {
    const mao70 = arv * 0.7 - repairEstimate;
    const customMultiplier = (100 - profitMargin) / 100;
    const closingCostsAmt = arv * (closingCostsPct / 100);
    const customMao = arv * customMultiplier - repairEstimate - assignmentFee - closingCostsAmt - holdingCosts;
    const profit70 = arv - mao70 - repairEstimate;
    const profitCustom = arv - customMao - repairEstimate - assignmentFee - closingCostsAmt - holdingCosts;

    const mao70Pct = arv > 0 ? Math.max(0, (mao70 / arv) * 100) : 0;
    const customMaoPct = arv > 0 ? Math.max(0, (customMao / arv) * 100) : 0;
    const repairsPct = arv > 0 ? (repairEstimate / arv) * 100 : 0;

    return {
      mao70: Math.round(mao70),
      customMao: Math.round(customMao),
      profit70: Math.round(profit70),
      profitCustom: Math.round(profitCustom),
      closingCostsAmt: Math.round(closingCostsAmt),
      mao70Pct,
      customMaoPct,
      repairsPct,
    };
  }, [arv, repairEstimate, profitMargin, assignmentFee, closingCostsPct, holdingCosts]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const inputClassNoIcon = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  return (
    <PublicLayout>
      <SEOHead
        title="Free 70% Rule Calculator - MAO Calculator for Real Estate"
        description="Calculate your Maximum Allowable Offer using the 70% rule or custom profit margins. Free MAO calculator for wholesalers and fix-and-flip investors."
        keywords="70 percent rule calculator, mao calculator real estate, maximum allowable offer calculator, wholesale offer calculator, 70% rule, real estate offer calculator, flip deal calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Target className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Offer Price <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate your Maximum Allowable Offer using the industry-standard 70% rule or set a custom profit margin. See exactly how much room you have at every price point.
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
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Property Values</h2>
                <p className="text-sm text-neutral-400 mb-6">The ARV and repair estimate are the foundation of every offer formula.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="arv" className="text-sm text-neutral-300">After Repair Value (ARV)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="arv" type="number" className={inputClass} value={arv} onChange={(e) => setArv(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Estimated market value after all repairs are completed.</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="repairs" className="text-sm text-neutral-300">Repair Estimate</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="repairs" type="number" className={inputClass} value={repairEstimate} onChange={(e) => setRepairEstimate(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Profit & Cost Parameters</h2>
                <p className="text-sm text-neutral-400 mb-6">Adjust your target profit margin and account for all deal costs.</p>
                <div className="space-y-6">
                  {/* Profit margin slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-neutral-300">Desired Profit Margin</label>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/[0.08] text-neutral-300 tabular-nums">{profitMargin}%</span>
                    </div>
                    <Slider
                      value={[profitMargin]}
                      onValueChange={(v) => setProfitMargin(v[0])}
                      min={10}
                      max={50}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>10% (aggressive)</span>
                      <span>30% (standard)</span>
                      <span>50% (conservative)</span>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-5" />

                  <div className="space-y-2">
                    <label htmlFor="assignment" className="text-sm text-neutral-300">Assignment / Wholesale Fee</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="assignment" type="number" className={inputClass} value={assignmentFee} onChange={(e) => setAssignmentFee(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Set to $0 if you are the end buyer (fix-and-flip).</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="closing" className="text-sm text-neutral-300">Closing Costs (% of ARV)</label>
                      <input id="closing" type="number" step={0.5} className={inputClassNoIcon} value={closingCostsPct} onChange={(e) => setClosingCostsPct(Number(e.target.value))} min={0} max={10} />
                      <p className="text-xs text-neutral-500">Typically 2-5% for buy + sell side</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="holding" className="text-sm text-neutral-300">Holding Costs (total)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input id="holding" type="number" className={inputClass} value={holdingCosts} onChange={(e) => setHoldingCosts(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-neutral-500">Loan, insurance, utilities during rehab</p>
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
                    <BarChart3 className="h-5 w-5 text-cyan-400" />
                    Maximum Allowable Offer
                  </h2>
                  <div className="space-y-6">

                    {/* 70% Rule */}
                    <div className="rounded-xl border border-white/[0.08] p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">70% Rule MAO</p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-400">Industry Standard</span>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-white mb-2">
                        {results.mao70 > 0 ? fmt.format(results.mao70) : '$0'}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {fmt.format(arv)} x 70% - {fmt.format(repairEstimate)} = {fmt.format(results.mao70)}
                      </p>
                      <div className="mt-2 text-xs">
                        <span className="text-neutral-400">Spread: </span>
                        <span className={`font-medium ${results.profit70 > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt.format(results.profit70)}
                        </span>
                      </div>
                    </div>

                    {/* Custom MAO */}
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">Custom MAO ({profitMargin}% margin)</p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">Your Numbers</span>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-cyan-400 mb-2">
                        {results.customMao > 0 ? fmt.format(results.customMao) : '$0'}
                      </p>
                      <div className="text-xs text-neutral-500 space-y-0.5">
                        <p>{fmt.format(arv)} x {100 - profitMargin}% = {fmt.format(Math.round(arv * (100 - profitMargin) / 100))}</p>
                        <p>- Repairs: {fmt.format(repairEstimate)}</p>
                        {assignmentFee > 0 && <p>- Assignment fee: {fmt.format(assignmentFee)}</p>}
                        <p>- Closing: {fmt.format(results.closingCostsAmt)}</p>
                        <p>- Holding: {fmt.format(holdingCosts)}</p>
                      </div>
                      <div className="mt-2 text-xs">
                        <span className="text-neutral-400">Target profit: </span>
                        <span className={`font-medium ${results.profitCustom > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt.format(results.profitCustom)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Visual comparison bar */}
                    <div>
                      <p className="text-sm font-medium text-white mb-4">Deal Structure (% of ARV)</p>
                      <div className="space-y-3">
                        {[
                          { label: 'After Repair Value', value: fmt.format(arv), pct: 100, color: 'bg-white/20' },
                          { label: '70% Rule MAO', value: fmt.format(results.mao70), pct: Math.min(100, Math.max(0, results.mao70Pct)), color: 'bg-blue-500' },
                          { label: 'Custom MAO', value: fmt.format(results.customMao), pct: Math.min(100, Math.max(0, results.customMaoPct)), color: 'bg-cyan-500' },
                          { label: 'Repairs', value: fmt.format(repairEstimate), pct: Math.min(100, results.repairsPct), color: 'bg-orange-500' },
                          { label: `Target Profit (${profitMargin}%)`, value: fmt.format(Math.round(arv * profitMargin / 100)), pct: Math.min(100, profitMargin), color: 'bg-emerald-500' },
                        ].map(bar => (
                          <div key={bar.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-neutral-400">{bar.label}</span>
                              <span className="tabular-nums text-white">{bar.value}</span>
                            </div>
                            <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className={`h-full ${bar.color} rounded-full transition-all duration-300`} style={{ width: `${bar.pct}%` }} />
                            </div>
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
                      <p className="font-medium text-sm text-white mb-1">Want AI to calculate offers on every lead?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail auto-calculates MAO, ARV, and repair estimates for every property in your pipeline using AI and real-time comps.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This Offer Price Calculator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                Every profitable real estate deal starts with the right offer price. Offer too high and you kill your margin. Offer too low and you never get deals accepted. This calculator helps you find the sweet spot using two proven methods.
              </p>
              <h3 className="text-white font-semibold text-base">The 70% Rule</h3>
              <p>
                The 70% rule is the most widely used formula in real estate investing. It states that you should pay no more than 70% of the After Repair Value (ARV) minus the estimated repair costs. The remaining 30% covers your profit, closing costs, holding costs, and margin of error.
              </p>
              <p className="font-mono text-xs bg-white/[0.03] border border-white/[0.08] p-3 rounded-xl text-neutral-300">
                MAO = ARV x 70% - Repair Costs
              </p>
              <h3 className="text-white font-semibold text-base">Custom MAO</h3>
              <p>
                The 70% rule is a useful shortcut, but serious investors need to account for their actual costs. The custom MAO calculation lets you specify your exact profit margin, wholesale assignment fee, closing costs, and holding costs.
              </p>
              <p className="font-mono text-xs bg-white/[0.03] border border-white/[0.08] p-3 rounded-xl text-neutral-300">
                MAO = ARV x (100% - Profit%) - Repairs - Assignment Fee - Closing - Holding
              </p>
              <h3 className="text-white font-semibold text-base">When to adjust your margin</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong className="text-white">Tighter markets (20-25% margin):</strong> When competition is fierce and deals are scarce.</li>
                <li><strong className="text-white">Standard deals (30% margin):</strong> The default for most fix-and-flip and wholesale deals.</li>
                <li><strong className="text-white">Risky properties (35-50% margin):</strong> Properties with unknown structural issues or long rehab timelines.</li>
              </ul>
              <h3 className="text-white font-semibold text-base">Wholesaling vs. Fix-and-Flip</h3>
              <p>
                If you are wholesaling, include your assignment fee in the calculation. If you are the end buyer doing a fix-and-flip, set the assignment fee to $0 and the custom MAO becomes your maximum purchase price.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
