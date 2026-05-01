import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Sparkles, ChevronRight, TrendingUp, Info, Percent } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function SeventyPercentRuleCalculator() {
  const [arv, setArv] = useState(300000);
  const [repairCosts, setRepairCosts] = useState(45000);
  const [customPercent, setCustomPercent] = useState(72);

  const results = useMemo(() => {
    const levels = [
      { pct: 60, label: 'Ultra Conservative' },
      { pct: 65, label: 'Conservative' },
      { pct: 70, label: 'Standard' },
      { pct: 75, label: 'Aggressive' },
      { pct: 80, label: 'Very Aggressive' },
      { pct: customPercent, label: `Custom (${customPercent}%)` },
    ];

    const rows = levels.map(level => {
      const mao = arv * (level.pct / 100) - repairCosts;
      const totalInvestment = mao + repairCosts;
      const potentialProfit = arv - totalInvestment;
      const profitMargin = arv > 0 ? (potentialProfit / arv) * 100 : 0;
      return {
        pct: level.pct,
        label: level.label,
        mao: Math.round(mao),
        totalInvestment: Math.round(totalInvestment),
        potentialProfit: Math.round(potentialProfit),
        profitMargin,
      };
    });

    const standardRow = rows.find(r => r.pct === 70)!;

    return { rows, standardRow };
  }, [arv, repairCosts, customPercent]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const inputClassNoIcon = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  function getRowColor(pct: number): string {
    if (pct <= 65) return 'text-emerald-400';
    if (pct <= 70) return 'text-cyan-400';
    if (pct <= 75) return 'text-orange-400';
    return 'text-red-400';
  }

  function getBadgeColor(pct: number): string {
    if (pct <= 65) return 'text-emerald-400 border-emerald-400/30';
    if (pct <= 70) return 'text-cyan-400 border-cyan-400/30';
    if (pct <= 75) return 'text-orange-400 border-orange-400/30';
    return 'text-red-400 border-red-400/30';
  }

  return (
    <PublicLayout>
      <SEOHead
        title="Free 70% Rule Calculator - Maximum Allowable Offer Calculator"
        description="Calculate your maximum allowable offer using the 70% rule. Compare MAO at 60%, 65%, 70%, 75%, 80%, and custom percentages. Free 70 percent rule calculator for real estate investors."
        keywords="70 percent rule calculator, 70% rule calculator, maximum allowable offer, mao calculator, real estate investing calculator, wholesale offer calculator, flip calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Percent className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            70% Rule <span className="text-cyan-400">Calculator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Calculate your maximum allowable offer at multiple percentage levels. Compare profit potential at 60%, 65%, 70%, 75%, 80%, and your own custom percentage.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-8">

            {/* Inputs */}
            <div className="lg:col-span-2 space-y-6">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Property Details</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter the after repair value and estimated repair costs.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="arv" className="text-sm text-neutral-300">After Repair Value (ARV)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="arv" type="number" className={inputClass} value={arv} onChange={(e) => setArv(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-neutral-500">Estimated value after all repairs are complete</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="repairCosts" className="text-sm text-neutral-300">Estimated Repair Costs</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="repairCosts" type="number" className={inputClass} value={repairCosts} onChange={(e) => setRepairCosts(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="customPct" className="text-sm text-neutral-300">Custom Percentage (%)</label>
                    <input id="customPct" type="number" step={1} className={inputClassNoIcon} value={customPercent} onChange={(e) => setCustomPercent(Math.max(1, Math.min(100, Number(e.target.value))))} min={1} max={100} />
                    <p className="text-xs text-neutral-500">Add your own custom % to the comparison table</p>
                  </div>
                </div>
              </div>

              {/* Standard 70% highlight */}
              <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-6 text-center">
                <p className="text-xs text-neutral-400 mb-1">MAO at 70% Rule</p>
                <p className="text-3xl font-semibold text-cyan-400 tabular-nums mb-2">{fmt.format(results.standardRow.mao)}</p>
                <p className="text-sm text-neutral-400">
                  Potential profit: <span className={results.standardRow.potentialProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt.format(results.standardRow.potentialProfit)}</span>
                </p>
              </div>

              {/* Formula */}
              <div className="rounded-xl border border-white/[0.08] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-neutral-500" />
                  <p className="text-sm font-medium text-white">The Formula</p>
                </div>
                <p className="font-mono text-xs bg-white/[0.03] border border-white/[0.08] p-3 rounded-lg text-neutral-300">
                  MAO = ARV x Rule% - Repair Costs
                </p>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3 space-y-6">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mb-6">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                  Comparison at Every Level
                </h2>

                {/* Comparison table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        <th className="text-left text-neutral-400 font-medium py-3 pr-4">Rule</th>
                        <th className="text-right text-neutral-400 font-medium py-3 px-3">Max Offer</th>
                        <th className="text-right text-neutral-400 font-medium py-3 px-3">Total In</th>
                        <th className="text-right text-neutral-400 font-medium py-3 px-3">Profit</th>
                        <th className="text-right text-neutral-400 font-medium py-3 pl-3">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.rows.map((row, idx) => (
                        <tr key={idx} className={`border-b border-white/[0.04] ${row.pct === 70 ? 'bg-cyan-500/5' : ''}`}>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded-full border text-xs font-medium ${getBadgeColor(row.pct)}`}>
                              {row.pct}%
                            </span>
                            <span className="text-xs text-neutral-500 ml-2 hidden sm:inline">{row.label}</span>
                          </td>
                          <td className="text-right py-3 px-3 tabular-nums font-medium text-white">{fmt.format(row.mao)}</td>
                          <td className="text-right py-3 px-3 tabular-nums text-neutral-400">{fmt.format(row.totalInvestment)}</td>
                          <td className={`text-right py-3 px-3 tabular-nums font-medium ${row.potentialProfit >= 0 ? getRowColor(row.pct) : 'text-red-400'}`}>
                            {fmt.format(row.potentialProfit)}
                          </td>
                          <td className="text-right py-3 pl-3 tabular-nums text-neutral-400">{fmtPct(row.profitMargin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visual bar comparison */}
                <div className="mt-8">
                  <p className="text-sm font-medium text-white mb-4">Visual Comparison</p>
                  <div className="space-y-3">
                    {results.rows.slice(0, 5).map(row => {
                      const maxMao = Math.max(...results.rows.map(r => Math.abs(r.mao)));
                      const barWidth = maxMao > 0 ? (Math.max(0, row.mao) / maxMao) * 100 : 0;
                      return (
                        <div key={row.pct} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-400">{row.pct}% Rule</span>
                            <span className="tabular-nums text-white">{fmt.format(row.mao)}</span>
                          </div>
                          <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${row.pct === 70 ? 'bg-cyan-500' : 'bg-cyan-500/40'}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-white mb-1">Want the 70% rule applied to every deal automatically?</p>
                    <p className="text-xs text-neutral-400 mb-3">AIWholesail runs the 70% rule on every property in your pipeline, so you can focus on making offers.</p>
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
      </section>

      {/* Educational Section */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Understanding the 70% Rule in Real Estate</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                The 70% rule is a guideline used by real estate investors and wholesalers to quickly determine the maximum price they should pay for a property. It accounts for profit margin, holding costs, closing costs, and a buffer for unexpected expenses.
              </p>
              <h3 className="text-white font-semibold text-base">How it works</h3>
              <p>
                Take the after repair value (ARV) of a property, multiply by 70%, and subtract the estimated repair costs. The result is your maximum allowable offer (MAO). The 30% margin covers your profit, closing costs on both the buy and sell side, holding costs, and a safety margin.
              </p>
              <h3 className="text-white font-semibold text-base">When to use different percentages</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">60-65% rule:</strong> Best for markets with higher risk, longer hold times, or when you want a larger safety margin. Also recommended for newer investors.</li>
                <li><strong className="text-white">70% rule:</strong> The industry standard. Works well in most markets for experienced investors who can accurately estimate repairs and ARV.</li>
                <li><strong className="text-white">75-80% rule:</strong> Only recommended in very hot markets with fast appreciation, low holding costs, and high confidence in your ARV estimate. Higher risk of losing money if anything goes wrong.</li>
              </ul>
              <h3 className="text-white font-semibold text-base">Important caveats</h3>
              <p>
                The 70% rule is a starting point, not a final answer. Always factor in actual holding costs, closing costs, and local market conditions. Properties with very high or very low ARVs may need different percentages to produce reasonable dollar amounts.
              </p>
            </div>

            {/* Internal links */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-sm font-medium text-white mb-3">Related Tools & Guides</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/tools/wholesale-fee-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Wholesale Fee Calculator</Link>
                <Link to="/tools/offer-price-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Offer Price Calculator</Link>
                <Link to="/tools/arv-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">ARV Calculator</Link>
                <Link to="/tools/holding-cost-calculator" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">Holding Cost Calculator</Link>
                <Link to="/tools" className="text-xs text-cyan-400 hover:text-cyan-300 border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors">All Calculators</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
