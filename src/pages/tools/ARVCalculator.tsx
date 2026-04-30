import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Slider } from '@/components/ui/slider';
import { DollarSign, Ruler, Plus, X, ArrowRight, BarChart3, Target } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPsf = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Comp {
  id: string;
  label: string;
  price: number;
  sqft: number;
}

function createComp(index: number): Comp {
  return { id: crypto.randomUUID(), label: `Comp ${index + 1}`, price: 0, sqft: 0 };
}

export default function ARVCalculator() {
  const [comps, setComps] = useState<Comp[]>([
    { id: crypto.randomUUID(), label: '123 Oak St', price: 310000, sqft: 1800 },
    { id: crypto.randomUUID(), label: '456 Maple Ave', price: 295000, sqft: 1650 },
    { id: crypto.randomUUID(), label: '789 Elm Dr', price: 325000, sqft: 1900 },
  ]);
  const [subjectSqft, setSubjectSqft] = useState(1750);
  const [conditionAdj, setConditionAdj] = useState(0);
  const [marketAdj, setMarketAdj] = useState(0);

  const addComp = () => {
    if (comps.length < 5) {
      setComps([...comps, createComp(comps.length)]);
    }
  };

  const removeComp = (id: string) => {
    if (comps.length > 1) {
      setComps(comps.filter(c => c.id !== id));
    }
  };

  const updateComp = (id: string, field: keyof Comp, value: string | number) => {
    setComps(comps.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const results = useMemo(() => {
    const validComps = comps.filter(c => c.price > 0 && c.sqft > 0);
    if (validComps.length === 0 || subjectSqft <= 0) return null;

    const pricesPerSqft = validComps.map(c => c.price / c.sqft);
    const avgPsf = pricesPerSqft.reduce((a, b) => a + b, 0) / pricesPerSqft.length;
    const adjustedPsf = avgPsf * (1 + conditionAdj / 100) * (1 + marketAdj / 100);
    const estimatedARV = adjustedPsf * subjectSqft;

    let confidence: 'Low' | 'Medium' | 'High';
    let confidenceColor: string;
    if (validComps.length >= 4) {
      confidence = 'High';
      confidenceColor = 'text-emerald-400';
    } else if (validComps.length >= 2) {
      confidence = 'Medium';
      confidenceColor = 'text-amber-400';
    } else {
      confidence = 'Low';
      confidenceColor = 'text-red-400';
    }

    const variance = pricesPerSqft.reduce((sum, p) => sum + Math.pow(p - avgPsf, 2), 0) / pricesPerSqft.length;
    const stddev = Math.sqrt(variance);
    const spreadFactor = validComps.length < 3 ? 1.5 : 1;
    const lowPsf = (avgPsf - stddev * spreadFactor) * (1 + conditionAdj / 100) * (1 + marketAdj / 100);
    const highPsf = (avgPsf + stddev * spreadFactor) * (1 + conditionAdj / 100) * (1 + marketAdj / 100);

    return {
      avgPsf,
      adjustedPsf,
      estimatedARV,
      lowARV: lowPsf * subjectSqft,
      highARV: highPsf * subjectSqft,
      confidence,
      confidenceColor,
      validCount: validComps.length,
    };
  }, [comps, subjectSqft, conditionAdj, marketAdj]);

  return (
    <PublicLayout>
      <SEOHead
        title="ARV Calculator - After Repair Value Estimator"
        description="Free ARV calculator for real estate investors. Estimate the After Repair Value of any property using comparable sales, condition adjustments, and market trends. Get a confidence-rated valuation range."
        keywords="arv calculator, after repair value calculator, property value estimator, real estate comps calculator, comparable sales analysis, fix and flip calculator"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Target className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            ARV Calculator
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Estimate the After Repair Value of any property using comparable sales data. Adjust for condition and market trends to get a confidence-rated valuation range.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Inputs */}
            <div className="space-y-6">
              {/* Comps */}
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold tracking-tight text-white">Comparable Sales</h2>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/[0.08] text-neutral-400">{comps.length}/5</span>
                </div>
                <div className="space-y-4">
                  {comps.map((comp, i) => (
                    <div key={comp.id} className="space-y-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 mr-3">
                          <input
                            value={comp.label}
                            onChange={e => updateComp(comp.id, 'label', e.target.value)}
                            placeholder={`Comp ${i + 1} address`}
                            className="w-full bg-transparent border-0 text-sm font-medium text-white p-0 focus:outline-none focus:ring-0"
                          />
                        </div>
                        {comps.length > 1 && (
                          <button
                            onClick={() => removeComp(comp.id)}
                            className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                            aria-label={`Remove ${comp.label}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-neutral-400">Sale Price</label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                            <input
                              type="number"
                              value={comp.price || ''}
                              onChange={e => updateComp(comp.id, 'price', Number(e.target.value))}
                              className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                              placeholder="0"
                              min={0}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-neutral-400">Sq Ft</label>
                          <div className="relative">
                            <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                            <input
                              type="number"
                              value={comp.sqft || ''}
                              onChange={e => updateComp(comp.id, 'sqft', Number(e.target.value))}
                              className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                              placeholder="0"
                              min={0}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {comps.length < 5 && (
                    <button onClick={addComp} className="w-full flex items-center justify-center gap-2 border border-white/[0.08] rounded-md py-2.5 text-sm text-neutral-300 hover:border-cyan-500/30 hover:text-cyan-400 transition-colors">
                      <Plus className="h-4 w-4" />
                      Add Comparable
                    </button>
                  )}
                </div>
              </div>

              {/* Subject & Adjustments */}
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-6">Subject Property</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="subjectSqft" className="text-sm text-neutral-300">Square Footage</label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <input
                        id="subjectSqft"
                        type="number"
                        value={subjectSqft}
                        onChange={e => setSubjectSqft(Number(e.target.value))}
                        className="w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                        min={0}
                      />
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-5" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-neutral-300">Condition Adjustment</label>
                      <span className={`text-sm font-semibold ${conditionAdj > 0 ? 'text-emerald-400' : conditionAdj < 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                        {conditionAdj > 0 ? '+' : ''}{conditionAdj}%
                      </span>
                    </div>
                    <Slider
                      value={[conditionAdj]}
                      onValueChange={v => setConditionAdj(v[0])}
                      min={-20}
                      max={20}
                      step={1}
                      aria-label="Condition adjustment percentage"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Below avg (-20%)</span>
                      <span>Average</span>
                      <span>Above avg (+20%)</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-neutral-300">Market Trend Adjustment</label>
                      <span className={`text-sm font-semibold ${marketAdj > 0 ? 'text-emerald-400' : marketAdj < 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                        {marketAdj > 0 ? '+' : ''}{marketAdj}%
                      </span>
                    </div>
                    <Slider
                      value={[marketAdj]}
                      onValueChange={v => setMarketAdj(v[0])}
                      min={-10}
                      max={10}
                      step={1}
                      aria-label="Market trend adjustment percentage"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Declining (-10%)</span>
                      <span>Stable</span>
                      <span>Appreciating (+10%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-6">
              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-6">Estimated ARV</h2>
                {results ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-5xl font-semibold tracking-tight text-cyan-400">
                        {fmt.format(results.estimatedARV)}
                      </p>
                      <p className="text-sm text-neutral-400 mt-1">Mid-point estimate</p>
                    </div>

                    {/* Range Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-neutral-400">
                        <span>Low</span>
                        <span>Mid</span>
                        <span>High</span>
                      </div>
                      <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="absolute inset-y-0 bg-gradient-to-r from-amber-400 via-emerald-500 to-blue-500 rounded-full"
                          style={{ left: '0%', right: '0%' }}
                        />
                      </div>
                      <div className="flex justify-between text-sm font-medium text-white">
                        <span>{fmt.format(results.lowARV)}</span>
                        <span>{fmt.format(results.highARV)}</span>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06] pt-5" />

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Avg Price / Sq Ft (Comps)</span>
                        <span className="font-medium text-white">{fmtPsf.format(results.avgPsf)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Adjusted Price / Sq Ft</span>
                        <span className="font-medium text-white">{fmtPsf.format(results.adjustedPsf)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Subject Sq Ft</span>
                        <span className="font-medium text-white">{subjectSqft.toLocaleString()}</span>
                      </div>

                      <div className="border-t border-white/[0.06] pt-3" />

                      <div className="flex justify-between text-sm items-center">
                        <span className="text-neutral-400">Confidence Level</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-white/[0.08] ${results.confidenceColor}`}>
                          <BarChart3 className="h-3 w-3" />
                          {results.confidence} ({results.validCount} comp{results.validCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>

                    {results.confidence === 'Low' && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30">
                        <p className="text-xs text-amber-300">
                          Add more comparable sales to improve accuracy. At least 3 comps are recommended for a reliable estimate.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-8">Enter at least one comparable sale and the subject square footage to see results.</p>
                )}
              </div>

              {/* Comp Breakdown */}
              {results && (
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                  <h2 className="text-lg font-bold tracking-tight text-white mb-4">Comp Breakdown</h2>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 text-xs text-neutral-400 font-medium pb-2 border-b border-white/[0.06]">
                      <span>Property</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">$/Sq Ft</span>
                    </div>
                    {comps.filter(c => c.price > 0 && c.sqft > 0).map(comp => (
                      <div key={comp.id} className="grid grid-cols-3 text-sm py-1.5">
                        <span className="font-medium truncate pr-2 text-white">{comp.label}</span>
                        <span className="text-right text-white">{fmt.format(comp.price)}</span>
                        <span className="text-right text-cyan-400">{fmtPsf.format(comp.price / comp.sqft)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <div className="border-t border-white/[0.06]" />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">How to Use This ARV Calculator</h2>
              <div className="space-y-6 text-neutral-400 font-light leading-relaxed">
                <p>
                  The After Repair Value (ARV) is the estimated market value of a property after all renovations are complete. It is the single most important number in any fix-and-flip or wholesale deal, because it determines how much you can pay for the property and still make a profit.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Step-by-Step Guide</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li><strong className="text-white">Find comparable sales (comps)</strong> that sold recently in the same neighborhood. Ideally within 0.5 miles and the last 90 days. Look for similar size, age, and style.</li>
                    <li><strong className="text-white">Enter each comp's sale price and square footage.</strong> The calculator will compute the average price per square foot across all your comps.</li>
                    <li><strong className="text-white">Enter your subject property's square footage.</strong> This is the property you are evaluating.</li>
                    <li><strong className="text-white">Adjust for condition.</strong> If your subject will be renovated to a higher standard than the comps, slide positive. If the comps were in better shape, slide negative.</li>
                    <li><strong className="text-white">Adjust for market trends.</strong> If the market is appreciating, slide positive. If declining, slide negative.</li>
                  </ol>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">Confidence Levels</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-white">High (4-5 comps)</strong>: Strong data set. The estimate is reliable for initial analysis.</li>
                    <li><strong className="text-white">Medium (2-3 comps)</strong>: Reasonable estimate, but consider finding more comps before committing.</li>
                    <li><strong className="text-white">Low (1 comp)</strong>: Directional only. Do not make offers based on a single comp.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="border-t border-white/[0.06]" />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">Want AI to Pull Comps Automatically?</h2>
              <p className="text-neutral-400 font-light max-w-lg mx-auto">
                AIWholesail uses AI-powered comp analysis to estimate ARV instantly, pulling recent sales data and adjusting for dozens of property factors you might miss.
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
