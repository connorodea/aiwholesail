import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { DollarSign, Percent, Clock, ArrowRight, CheckCircle2, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function WholesaleDealCalculator() {
  const [askingPrice, setAskingPrice] = useState(180000);
  const [arv, setArv] = useState(320000);
  const [repairs, setRepairs] = useState(45000);
  const [wholesaleFee, setWholesaleFee] = useState(10000);
  const [closingCostPercent, setClosingCostPercent] = useState(3);
  const [holdingCostsMonthly, setHoldingCostsMonthly] = useState(1500);
  const [holdTime, setHoldTime] = useState(4);

  const results = useMemo(() => {
    if (arv <= 0) return null;

    const mao = arv * 0.70 - repairs - wholesaleFee;
    const closingCosts = askingPrice * (closingCostPercent / 100);
    const totalHoldingCosts = holdingCostsMonthly * holdTime;
    const totalCosts = askingPrice + repairs + wholesaleFee + closingCosts + totalHoldingCosts;
    const spread = arv - totalCosts;
    const spreadPercent = (spread / arv) * 100;
    const yourProfit = wholesaleFee;
    const endBuyerProfit = arv - (askingPrice + wholesaleFee) - repairs - closingCosts - totalHoldingCosts;
    const endBuyerROI = askingPrice + wholesaleFee > 0 ? (endBuyerProfit / (askingPrice + wholesaleFee)) * 100 : 0;

    let dealScore: 'Poor' | 'Fair' | 'Good' | 'Great' | 'Excellent';
    let scoreColor: string;
    let recommendation: 'no-go' | 'caution' | 'go';

    if (spreadPercent >= 30) {
      dealScore = 'Excellent';
      scoreColor = 'text-emerald-400';
      recommendation = 'go';
    } else if (spreadPercent >= 20) {
      dealScore = 'Great';
      scoreColor = 'text-emerald-400';
      recommendation = 'go';
    } else if (spreadPercent >= 12) {
      dealScore = 'Good';
      scoreColor = 'text-blue-400';
      recommendation = 'go';
    } else if (spreadPercent >= 5) {
      dealScore = 'Fair';
      scoreColor = 'text-amber-400';
      recommendation = 'caution';
    } else {
      dealScore = 'Poor';
      scoreColor = 'text-red-400';
      recommendation = 'no-go';
    }

    return {
      mao,
      closingCosts,
      totalHoldingCosts,
      spread,
      spreadPercent,
      yourProfit,
      endBuyerProfit,
      endBuyerROI,
      dealScore,
      scoreColor,
      recommendation,
    };
  }, [askingPrice, arv, repairs, wholesaleFee, closingCostPercent, holdingCostsMonthly, holdTime]);

  return (
    <PublicLayout>
      <SEOHead
        title="Wholesale Deal Calculator - Analyze Real Estate Wholesale Deals"
        description="Free wholesale real estate calculator. Calculate your Maximum Allowable Offer (MAO), assignment fee profit, end buyer ROI, and get a Go/No-Go recommendation on any deal."
        keywords="wholesale deal calculator, wholesale real estate calculator, MAO calculator, maximum allowable offer, assignment fee calculator, real estate wholesale, 70% rule calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <TrendingUp className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Wholesale Deal Calculator
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Instantly analyze any wholesale deal. Calculate your MAO using the 70% rule, estimate profits for both you and the end buyer, and get a clear Go/No-Go recommendation.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Inputs */}
            <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
              <h2 className="text-xl font-bold tracking-tight text-white mb-6">Deal Details</h2>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="askingPrice" className="text-sm text-neutral-300">Property Price (Asking)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input id="askingPrice" type="number" value={askingPrice} onChange={e => setAskingPrice(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="arv" className="text-sm text-neutral-300">After Repair Value (ARV)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input id="arv" type="number" value={arv} onChange={e => setArv(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="repairs" className="text-sm text-neutral-300">Estimated Repairs</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input id="repairs" type="number" value={repairs} onChange={e => setRepairs(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="wholesaleFee" className="text-sm text-neutral-300">Wholesale / Assignment Fee</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input id="wholesaleFee" type="number" value={wholesaleFee} onChange={e => setWholesaleFee(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} />
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-5" />

                <div className="space-y-2">
                  <label htmlFor="closingCosts" className="text-sm text-neutral-300">Closing Costs (%)</label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input id="closingCosts" type="number" value={closingCostPercent} onChange={e => setClosingCostPercent(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} max={20} step={0.5} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="holdingCosts" className="text-sm text-neutral-300">Holding Costs (Monthly)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="holdingCosts" type="number" value={holdingCostsMonthly} onChange={e => setHoldingCostsMonthly(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="holdTime" className="text-sm text-neutral-300">Hold Time (Months)</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input id="holdTime" type="number" value={holdTime} onChange={e => setHoldTime(Number(e.target.value))} className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors" min={0} max={36} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {/* Recommendation */}
              {results && (
                <div className={`rounded-xl border-2 p-6 ${
                  results.recommendation === 'go' ? 'border-emerald-500/30 bg-emerald-950/20' :
                  results.recommendation === 'caution' ? 'border-amber-500/30 bg-amber-950/20' :
                  'border-red-500/30 bg-red-950/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {results.recommendation === 'go' && <CheckCircle2 className="h-8 w-8 text-emerald-400" />}
                      {results.recommendation === 'caution' && <AlertTriangle className="h-8 w-8 text-amber-400" />}
                      {results.recommendation === 'no-go' && <XCircle className="h-8 w-8 text-red-400" />}
                      <div>
                        <p className="text-sm text-neutral-400">Recommendation</p>
                        <p className="text-xl font-semibold capitalize text-white">
                          {results.recommendation === 'go' ? 'Go' : results.recommendation === 'caution' ? 'Proceed with Caution' : 'No-Go'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium px-2.5 py-1 rounded-full border border-white/[0.08] ${results.scoreColor}`}>
                      {results.dealScore}
                    </span>
                  </div>
                </div>
              )}

              {/* Numbers */}
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-6">Deal Analysis</h2>
                {results ? (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10 text-center">
                      <p className="text-xs text-neutral-400 mb-1">Maximum Allowable Offer (MAO)</p>
                      <p className="text-3xl font-semibold text-cyan-400">{fmt.format(results.mao)}</p>
                      <p className="text-xs text-neutral-400 mt-1">ARV x 70% - Repairs - Fee</p>
                    </div>

                    <div className="border-t border-white/[0.06] pt-5" />

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Spread (ARV - All Costs)</span>
                        <span className={`font-semibold ${results.spread >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt.format(results.spread)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Spread %</span>
                        <span className={`font-medium ${results.scoreColor}`}>
                          {fmtPct(results.spreadPercent)}
                        </span>
                      </div>

                      <div className="border-t border-white/[0.06] pt-3" />

                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Your Profit (Assignment Fee)</span>
                        <span className="font-semibold text-emerald-400">{fmt.format(results.yourProfit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">End Buyer Potential Profit</span>
                        <span className={`font-medium ${results.endBuyerProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt.format(results.endBuyerProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">End Buyer ROI</span>
                        <span className="font-medium text-white">{fmtPct(results.endBuyerROI)}</span>
                      </div>

                      <div className="border-t border-white/[0.06] pt-3" />

                      <div className="text-xs text-neutral-400 space-y-1 pt-2">
                        <div className="flex justify-between">
                          <span>Closing Costs</span>
                          <span>{fmt.format(results.closingCosts)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Holding Costs</span>
                          <span>{fmt.format(results.totalHoldingCosts)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-8">Enter a positive ARV to see results.</p>
                )}
              </div>
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <div className="border-t border-white/[0.06]" />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">How to Use This Wholesale Deal Calculator</h2>
              <div className="space-y-6 text-neutral-400 font-light leading-relaxed">
                <p>
                  This calculator uses the industry-standard 70% rule to determine your Maximum Allowable Offer (MAO). The formula is simple: <strong className="text-white">MAO = ARV x 70% - Repair Costs - Your Assignment Fee</strong>. If your purchase price is at or below the MAO, the deal has enough margin for both you and the end buyer to profit.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Understanding the Results</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-white">MAO</strong> is the maximum you (or the end buyer) should pay for the property after accounting for repairs and your fee.</li>
                    <li><strong className="text-white">Spread</strong> is the total profit available in the deal after all costs. A higher spread means more room for everyone.</li>
                    <li><strong className="text-white">Deal Score</strong> is based on spread as a percentage of ARV. Excellent deals have 30%+ spread; Poor deals have under 5%.</li>
                    <li><strong className="text-white">Your Profit</strong> is your assignment fee, collected at closing when you assign the contract to the end buyer.</li>
                    <li><strong className="text-white">End Buyer Profit</strong> is what the flipper or landlord stands to make after all costs. If this is negative, the deal will be hard to sell.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Pro Tips</h3>
                  <p>
                    Always verify your ARV with recent comparable sales (use our ARV Calculator). Overestimating ARV is the number one reason wholesale deals fall through. When in doubt, be conservative on ARV and generous on repair estimates.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="border-t border-white/[0.06]" />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">Want AI to Find Deals Like This for You?</h2>
              <p className="text-neutral-400 font-light max-w-lg mx-auto">
                AIWholesail automatically finds off-market properties, calculates MAO, scores deals, and alerts you when a profitable wholesale opportunity appears.
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
