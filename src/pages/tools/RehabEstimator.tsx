import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { Hammer, DollarSign, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';

type RenovationLevel = 'none' | 'minor' | 'major' | 'full';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface CostRange {
  low: number;
  mid: number;
  high: number;
}

function getLevelCosts(level: RenovationLevel, ranges: { minor: [number, number]; major: [number, number]; full: [number, number] }): CostRange {
  if (level === 'none') return { low: 0, mid: 0, high: 0 };
  const [low, high] = ranges[level as 'minor' | 'major' | 'full'];
  return { low, mid: Math.round((low + high) / 2), high };
}

export default function RehabEstimator() {
  const [kitchenLevel, setKitchenLevel] = useState<RenovationLevel>('none');
  const [bathroomCount, setBathroomCount] = useState(2);
  const [bathroomLevel, setBathroomLevel] = useState<RenovationLevel>('none');
  const [flooringSqft, setFlooringSqft] = useState(1500);
  const [flooringMaterial, setFlooringMaterial] = useState<'laminate' | 'hardwood' | 'tile'>('laminate');
  const [paintSqft, setPaintSqft] = useState(1800);
  const [roofNeeded, setRoofNeeded] = useState(false);
  const [hvacNeeded, setHvacNeeded] = useState(false);
  const [electricalLevel, setElectricalLevel] = useState<RenovationLevel>('none');
  const [plumbingLevel, setPlumbingLevel] = useState<RenovationLevel>('none');
  const [windowCount, setWindowCount] = useState(0);
  const [landscapingNeeded, setLandscapingNeeded] = useState(false);
  const [totalSqft, setTotalSqft] = useState(1800);

  const flooringRates: Record<string, [number, number]> = {
    laminate: [3, 6],
    hardwood: [6, 12],
    tile: [5, 10],
  };

  const results = useMemo(() => {
    const categories: { name: string; low: number; mid: number; high: number }[] = [];

    const kitchen = getLevelCosts(kitchenLevel, { minor: [5000, 15000], major: [15000, 40000], full: [40000, 80000] });
    categories.push({ name: 'Kitchen', ...kitchen });

    const singleBath = getLevelCosts(bathroomLevel, { minor: [3000, 8000], major: [8000, 20000], full: [20000, 40000] });
    categories.push({ name: `Bathrooms (${bathroomCount})`, low: singleBath.low * bathroomCount, mid: singleBath.mid * bathroomCount, high: singleBath.high * bathroomCount });

    const [floorLow, floorHigh] = flooringRates[flooringMaterial];
    const floorMid = (floorLow + floorHigh) / 2;
    categories.push({ name: 'Flooring', low: Math.round(flooringSqft * floorLow), mid: Math.round(flooringSqft * floorMid), high: Math.round(flooringSqft * floorHigh) });

    categories.push({ name: 'Paint', low: Math.round(paintSqft * 1.5), mid: Math.round(paintSqft * 2.25), high: Math.round(paintSqft * 3) });
    categories.push({ name: 'Roof', low: roofNeeded ? 5000 : 0, mid: roofNeeded ? 10000 : 0, high: roofNeeded ? 15000 : 0 });
    categories.push({ name: 'HVAC', low: hvacNeeded ? 4000 : 0, mid: hvacNeeded ? 7000 : 0, high: hvacNeeded ? 10000 : 0 });

    const electrical = getLevelCosts(electricalLevel, { minor: [1000, 5000], major: [5000, 15000], full: [5000, 15000] });
    categories.push({ name: 'Electrical', ...electrical });

    const plumbing = getLevelCosts(plumbingLevel, { minor: [1000, 5000], major: [5000, 15000], full: [5000, 15000] });
    categories.push({ name: 'Plumbing', ...plumbing });

    categories.push({ name: `Windows (${windowCount})`, low: windowCount * 300, mid: windowCount * 550, high: windowCount * 800 });
    categories.push({ name: 'Landscaping', low: landscapingNeeded ? 1000 : 0, mid: landscapingNeeded ? 3000 : 0, high: landscapingNeeded ? 5000 : 0 });

    const subtotalLow = categories.reduce((s, c) => s + c.low, 0);
    const subtotalMid = categories.reduce((s, c) => s + c.mid, 0);
    const subtotalHigh = categories.reduce((s, c) => s + c.high, 0);

    const contingencyLow = Math.round(subtotalLow * 0.15);
    const contingencyMid = Math.round(subtotalMid * 0.15);
    const contingencyHigh = Math.round(subtotalHigh * 0.15);

    const totalLow = subtotalLow + contingencyLow;
    const totalMid = subtotalMid + contingencyMid;
    const totalHigh = subtotalHigh + contingencyHigh;

    const costPerSqftLow = totalSqft > 0 ? totalLow / totalSqft : 0;
    const costPerSqftMid = totalSqft > 0 ? totalMid / totalSqft : 0;
    const costPerSqftHigh = totalSqft > 0 ? totalHigh / totalSqft : 0;

    return {
      categories: categories.filter(c => c.low > 0 || c.mid > 0 || c.high > 0),
      subtotalLow, subtotalMid, subtotalHigh,
      contingencyLow, contingencyMid, contingencyHigh,
      totalLow, totalMid, totalHigh,
      costPerSqftLow, costPerSqftMid, costPerSqftHigh,
    };
  }, [kitchenLevel, bathroomCount, bathroomLevel, flooringSqft, flooringMaterial, paintSqft, roofNeeded, hvacNeeded, electricalLevel, plumbingLevel, windowCount, landscapingNeeded, totalSqft]);

  const inputClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";
  const selectClass = "w-full bg-neutral-900/50 border border-white/[0.08] text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/30 transition-colors";

  const renderLevelSelect = (value: RenovationLevel, onChange: (v: RenovationLevel) => void, id: string) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value as RenovationLevel)} className={selectClass}>
      <option value="none">Not needed</option>
      <option value="minor">Minor</option>
      <option value="major">Major</option>
      <option value="full">Full gut</option>
    </select>
  );

  return (
    <PublicLayout>
      <SEOHead
        title="Free Rehab Cost Estimator - Renovation Cost Calculator"
        description="Estimate renovation and rehab costs for investment properties. Room-by-room cost breakdown with low, mid, and high estimates. Free rehab cost calculator for real estate investors."
        keywords="rehab cost estimator, renovation cost calculator, rehab budget calculator, property renovation costs, fix and flip cost estimator, real estate rehab costs"
      />

      {/* Hero */}
      <section className="pt-24 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Hammer className="h-3 w-3" />
            Free Tool
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Rehab Cost <span className="text-cyan-400">Estimator</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mx-auto">
            Get a room-by-room renovation cost estimate for your next investment property. See low, mid, and high range projections with a built-in 15% contingency buffer.
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
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Property Details</h2>
                <p className="text-sm text-neutral-400 mb-6">Enter your property's total square footage for cost-per-sqft calculations.</p>
                <div className="space-y-1">
                  <label htmlFor="totalSqft" className="text-sm text-neutral-300">Total Square Footage</label>
                  <input id="totalSqft" type="number" value={totalSqft} onChange={(e) => setTotalSqft(Number(e.target.value))} className={inputClass} min={0} />
                </div>
              </div>

              <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Room-by-Room Scope</h2>
                <p className="text-sm text-neutral-400 mb-6">Select renovation level for each area. Choose "Not needed" for items you will skip.</p>
                <div className="space-y-6">
                  {/* Kitchen */}
                  <div className="space-y-2">
                    <label htmlFor="kitchen" className="text-sm text-neutral-300">Kitchen Renovation</label>
                    {renderLevelSelect(kitchenLevel, setKitchenLevel, 'kitchen')}
                    <p className="text-xs text-neutral-500">Minor $5K-15K / Major $15K-40K / Full $40K-80K</p>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Bathrooms */}
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-300">Bathrooms</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="bathCount" className="text-xs text-neutral-400">Count</label>
                        <input id="bathCount" type="number" value={bathroomCount} onChange={(e) => setBathroomCount(Math.max(0, Number(e.target.value)))} className={inputClass} min={0} max={10} />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="bathLevel" className="text-xs text-neutral-400">Level (each)</label>
                        {renderLevelSelect(bathroomLevel, setBathroomLevel, 'bathLevel')}
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500">Minor $3K-8K / Major $8K-20K / Full $20K-40K each</p>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Flooring */}
                  <div className="space-y-2">
                    <label className="text-sm text-neutral-300">Flooring</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="floorSqft" className="text-xs text-neutral-400">Square Feet</label>
                        <input id="floorSqft" type="number" value={flooringSqft} onChange={(e) => setFlooringSqft(Math.max(0, Number(e.target.value)))} className={inputClass} min={0} />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="floorMat" className="text-xs text-neutral-400">Material</label>
                        <select id="floorMat" value={flooringMaterial} onChange={e => setFlooringMaterial(e.target.value as typeof flooringMaterial)} className={selectClass}>
                          <option value="laminate">Laminate ($3-6/sqft)</option>
                          <option value="hardwood">Hardwood ($6-12/sqft)</option>
                          <option value="tile">Tile ($5-10/sqft)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Paint */}
                  <div className="space-y-2">
                    <label htmlFor="paintSqft" className="text-sm text-neutral-300">Interior Paint (living area sqft)</label>
                    <input id="paintSqft" type="number" value={paintSqft} onChange={(e) => setPaintSqft(Math.max(0, Number(e.target.value)))} className={inputClass} min={0} />
                    <p className="text-xs text-neutral-500">$1.50-$3.00 per sqft</p>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Toggle items */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label htmlFor="roof" className="flex items-center justify-between rounded-xl border border-white/[0.08] p-4 cursor-pointer hover:border-cyan-500/20 transition-colors">
                      <div>
                        <span className="text-sm text-neutral-300">Roof Replacement</span>
                        <p className="text-xs text-neutral-500">$5K - $15K</p>
                      </div>
                      <input id="roof" type="checkbox" checked={roofNeeded} onChange={e => setRoofNeeded(e.target.checked)} className="w-4 h-4 accent-cyan-500 rounded" />
                    </label>
                    <label htmlFor="hvac" className="flex items-center justify-between rounded-xl border border-white/[0.08] p-4 cursor-pointer hover:border-cyan-500/20 transition-colors">
                      <div>
                        <span className="text-sm text-neutral-300">HVAC System</span>
                        <p className="text-xs text-neutral-500">$4K - $10K</p>
                      </div>
                      <input id="hvac" type="checkbox" checked={hvacNeeded} onChange={e => setHvacNeeded(e.target.checked)} className="w-4 h-4 accent-cyan-500 rounded" />
                    </label>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Electrical & Plumbing */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="electrical" className="text-sm text-neutral-300">Electrical</label>
                      {renderLevelSelect(electricalLevel, setElectricalLevel, 'electrical')}
                      <p className="text-xs text-neutral-500">Minor $1K-5K / Major $5K-15K</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="plumbing" className="text-sm text-neutral-300">Plumbing</label>
                      {renderLevelSelect(plumbingLevel, setPlumbingLevel, 'plumbing')}
                      <p className="text-xs text-neutral-500">Minor $1K-5K / Major $5K-15K</p>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Windows */}
                  <div className="space-y-2">
                    <label htmlFor="windows" className="text-sm text-neutral-300">Window Replacements</label>
                    <input id="windows" type="number" value={windowCount} onChange={(e) => setWindowCount(Math.max(0, Number(e.target.value)))} className={inputClass} min={0} max={50} />
                    <p className="text-xs text-neutral-500">$300-$800 per window</p>
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Landscaping */}
                  <label htmlFor="landscaping" className="flex items-center justify-between rounded-xl border border-white/[0.08] p-4 cursor-pointer hover:border-cyan-500/20 transition-colors">
                    <div>
                      <span className="text-sm text-neutral-300">Landscaping</span>
                      <p className="text-xs text-neutral-500">$1K - $5K</p>
                    </div>
                    <input id="landscaping" type="checkbox" checked={landscapingNeeded} onChange={e => setLandscapingNeeded(e.target.checked)} className="w-4 h-4 accent-cyan-500 rounded" />
                  </label>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">
              <div className="lg:sticky lg:top-28">
                <div className="border border-white/[0.05] bg-gradient-to-b from-neutral-900/50 to-transparent rounded-xl p-6 md:p-8">
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-cyan-400" />
                    Estimated Rehab Cost
                  </h2>
                  <p className="text-sm text-neutral-400 mb-6">Low, mid, and high range projections</p>
                  <div className="space-y-6">
                    {/* Total estimates */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-emerald-500/10 p-3">
                        <p className="text-xs text-neutral-400 mb-1">Low</p>
                        <p className="text-lg font-semibold text-emerald-400">{fmt.format(results.totalLow)}</p>
                      </div>
                      <div className="rounded-xl bg-cyan-500/10 p-3">
                        <p className="text-xs text-neutral-400 mb-1">Mid</p>
                        <p className="text-lg font-semibold text-cyan-400">{fmt.format(results.totalMid)}</p>
                      </div>
                      <div className="rounded-xl bg-orange-500/10 p-3">
                        <p className="text-xs text-neutral-400 mb-1">High</p>
                        <p className="text-lg font-semibold text-orange-400">{fmt.format(results.totalHigh)}</p>
                      </div>
                    </div>

                    {/* Cost per sqft */}
                    {totalSqft > 0 && (
                      <div className="rounded-xl border border-white/[0.08] p-4">
                        <p className="text-sm text-neutral-400 mb-2">Cost Per Square Foot</p>
                        <div className="flex justify-between text-sm text-white">
                          <span>{fmt.format(results.costPerSqftLow)}</span>
                          <span className="font-semibold">{fmt.format(results.costPerSqftMid)}</span>
                          <span>{fmt.format(results.costPerSqftHigh)}</span>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-white/[0.06]" />

                    {/* Category breakdown */}
                    <div>
                      <p className="text-sm font-medium text-white mb-3">Breakdown</p>
                      <div className="space-y-2">
                        {results.categories.length === 0 && (
                          <p className="text-sm text-neutral-400 italic">Select renovation items to see a breakdown.</p>
                        )}
                        {results.categories.map((cat) => (
                          <div key={cat.name} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-400">{cat.name}</span>
                            <span className="font-medium tabular-nums text-white">{fmt.format(cat.mid)}</span>
                          </div>
                        ))}
                        {results.categories.length > 0 && (
                          <>
                            <div className="border-t border-white/[0.06] pt-2" />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-neutral-400">Subtotal</span>
                              <span className="font-medium tabular-nums text-white">{fmt.format(results.subtotalMid)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-neutral-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Contingency (15%)
                              </span>
                              <span className="font-medium tabular-nums text-white">{fmt.format(results.contingencyMid)}</span>
                            </div>
                            <div className="border-t border-white/[0.06] pt-2" />
                            <div className="flex items-center justify-between text-sm font-semibold">
                              <span className="text-white">Total (mid estimate)</span>
                              <span className="text-cyan-400 tabular-nums">{fmt.format(results.totalMid)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 border border-white/[0.05] bg-cyan-500/5 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white mb-1">Want AI to estimate rehab costs automatically?</p>
                      <p className="text-xs text-neutral-400 mb-3">AIWholesail analyzes property photos and comps to generate accurate rehab budgets in seconds.</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-white mb-6">How to Use This Rehab Cost Estimator</h2>
            <div className="space-y-4 text-neutral-400 text-sm leading-relaxed">
              <p>
                This rehab cost estimator gives you a ballpark renovation budget organized room-by-room. It is designed for real estate investors evaluating fix-and-flip or BRRRR properties, not for homeowners planning a custom remodel.
              </p>
              <h3 className="text-white font-semibold text-base">Step-by-step</h3>
              <ol className="space-y-2 list-decimal list-inside">
                <li><strong className="text-white">Enter the property square footage</strong> so the calculator can show you a cost-per-sqft figure. This makes it easy to compare against local contractor averages.</li>
                <li><strong className="text-white">Walk through each category</strong> and select the appropriate renovation level. "Minor" means cosmetic updates (paint cabinets, new hardware). "Major" means replacing most components. "Full gut" means tearing everything out and starting fresh.</li>
                <li><strong className="text-white">Toggle roof, HVAC, and landscaping</strong> if the property needs those big-ticket items. These can dramatically shift your budget.</li>
                <li><strong className="text-white">Review the three estimates.</strong> The low figure assumes you are getting favorable contractor pricing and basic materials. The high figure accounts for premium finishes and unexpected issues. The mid estimate is your most likely scenario.</li>
              </ol>
              <h3 className="text-white font-semibold text-base">Why the 15% contingency?</h3>
              <p>
                Experienced investors always budget a contingency buffer. Older properties frequently reveal hidden damage -- water damage behind walls, outdated wiring, or foundation issues -- once demolition begins. The 15% buffer protects your profit margin from these surprises.
              </p>
              <h3 className="text-white font-semibold text-base">Tips for accuracy</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Get at least three contractor bids before committing to a rehab budget.</li>
                <li>Costs vary significantly by market. A kitchen remodel in Phoenix costs 30-50% less than in San Francisco.</li>
                <li>Factor in permit costs for structural, electrical, and plumbing work -- they are not included in this estimate.</li>
                <li>Use the mid estimate for your initial deal analysis, then refine with actual contractor quotes.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
