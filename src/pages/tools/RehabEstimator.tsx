import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Hammer, DollarSign, Home, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';

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
  // Kitchen
  const [kitchenLevel, setKitchenLevel] = useState<RenovationLevel>('none');

  // Bathrooms
  const [bathroomCount, setBathroomCount] = useState(2);
  const [bathroomLevel, setBathroomLevel] = useState<RenovationLevel>('none');

  // Flooring
  const [flooringSqft, setFlooringSqft] = useState(1500);
  const [flooringMaterial, setFlooringMaterial] = useState<'laminate' | 'hardwood' | 'tile'>('laminate');

  // Paint
  const [paintSqft, setPaintSqft] = useState(1800);

  // Roof
  const [roofNeeded, setRoofNeeded] = useState(false);

  // HVAC
  const [hvacNeeded, setHvacNeeded] = useState(false);

  // Electrical
  const [electricalLevel, setElectricalLevel] = useState<RenovationLevel>('none');

  // Plumbing
  const [plumbingLevel, setPlumbingLevel] = useState<RenovationLevel>('none');

  // Windows
  const [windowCount, setWindowCount] = useState(0);

  // Landscaping
  const [landscapingNeeded, setLandscapingNeeded] = useState(false);

  // Total sqft for cost-per-sqft
  const [totalSqft, setTotalSqft] = useState(1800);

  const flooringRates: Record<string, [number, number]> = {
    laminate: [3, 6],
    hardwood: [6, 12],
    tile: [5, 10],
  };

  const results = useMemo(() => {
    const categories: { name: string; low: number; mid: number; high: number }[] = [];

    // Kitchen
    const kitchen = getLevelCosts(kitchenLevel, {
      minor: [5000, 15000],
      major: [15000, 40000],
      full: [40000, 80000],
    });
    categories.push({ name: 'Kitchen', ...kitchen });

    // Bathrooms
    const singleBath = getLevelCosts(bathroomLevel, {
      minor: [3000, 8000],
      major: [8000, 20000],
      full: [20000, 40000],
    });
    categories.push({
      name: `Bathrooms (${bathroomCount})`,
      low: singleBath.low * bathroomCount,
      mid: singleBath.mid * bathroomCount,
      high: singleBath.high * bathroomCount,
    });

    // Flooring
    const [floorLow, floorHigh] = flooringRates[flooringMaterial];
    const floorMid = (floorLow + floorHigh) / 2;
    categories.push({
      name: 'Flooring',
      low: Math.round(flooringSqft * floorLow),
      mid: Math.round(flooringSqft * floorMid),
      high: Math.round(flooringSqft * floorHigh),
    });

    // Paint
    categories.push({
      name: 'Paint',
      low: Math.round(paintSqft * 1.5),
      mid: Math.round(paintSqft * 2.25),
      high: Math.round(paintSqft * 3),
    });

    // Roof
    categories.push({
      name: 'Roof',
      low: roofNeeded ? 5000 : 0,
      mid: roofNeeded ? 10000 : 0,
      high: roofNeeded ? 15000 : 0,
    });

    // HVAC
    categories.push({
      name: 'HVAC',
      low: hvacNeeded ? 4000 : 0,
      mid: hvacNeeded ? 7000 : 0,
      high: hvacNeeded ? 10000 : 0,
    });

    // Electrical
    const electrical = getLevelCosts(electricalLevel, {
      minor: [1000, 5000],
      major: [5000, 15000],
      full: [5000, 15000],
    });
    categories.push({ name: 'Electrical', ...electrical });

    // Plumbing
    const plumbing = getLevelCosts(plumbingLevel, {
      minor: [1000, 5000],
      major: [5000, 15000],
      full: [5000, 15000],
    });
    categories.push({ name: 'Plumbing', ...plumbing });

    // Windows
    categories.push({
      name: `Windows (${windowCount})`,
      low: windowCount * 300,
      mid: windowCount * 550,
      high: windowCount * 800,
    });

    // Landscaping
    categories.push({
      name: 'Landscaping',
      low: landscapingNeeded ? 1000 : 0,
      mid: landscapingNeeded ? 3000 : 0,
      high: landscapingNeeded ? 5000 : 0,
    });

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
      subtotalLow,
      subtotalMid,
      subtotalHigh,
      contingencyLow,
      contingencyMid,
      contingencyHigh,
      totalLow,
      totalMid,
      totalHigh,
      costPerSqftLow,
      costPerSqftMid,
      costPerSqftHigh,
    };
  }, [kitchenLevel, bathroomCount, bathroomLevel, flooringSqft, flooringMaterial, paintSqft, roofNeeded, hvacNeeded, electricalLevel, plumbingLevel, windowCount, landscapingNeeded, totalSqft]);

  const renderLevelSelect = (value: RenovationLevel, onChange: (v: RenovationLevel) => void, id: string) => (
    <Select value={value} onValueChange={(v) => onChange(v as RenovationLevel)}>
      <SelectTrigger id={id} className="h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Not needed</SelectItem>
        <SelectItem value="minor">Minor</SelectItem>
        <SelectItem value="major">Major</SelectItem>
        <SelectItem value="full">Full gut</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      <SEOHead
        title="Free Rehab Cost Estimator - Renovation Cost Calculator"
        description="Estimate renovation and rehab costs for investment properties. Room-by-room cost breakdown with low, mid, and high estimates. Free rehab cost calculator for real estate investors."
        keywords="rehab cost estimator, renovation cost calculator, rehab budget calculator, property renovation costs, fix and flip cost estimator, real estate rehab costs"
      />

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-neutral-950/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-sm font-medium hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">AIWholesail</div>
              <Link to="/pricing" className="text-sm font-medium text-cyan-400 hover:text-cyan-400/80 transition-colors">
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-8 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Badge variant="secondary" className="mb-4">
            <Hammer className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Property Details</CardTitle>
                  <CardDescription>Enter your property's total square footage for cost-per-sqft calculations.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <Label htmlFor="totalSqft">Total Square Footage</Label>
                    <Input
                      id="totalSqft"
                      type="number"
                      value={totalSqft}
                      onChange={(e) => setTotalSqft(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Room-by-Room Scope</CardTitle>
                  <CardDescription>Select renovation level for each area. Choose "Not needed" for items you will skip.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Kitchen */}
                  <div className="space-y-2">
                    <Label htmlFor="kitchen">Kitchen Renovation</Label>
                    {renderLevelSelect(kitchenLevel, setKitchenLevel, 'kitchen')}
                    <p className="text-xs text-neutral-400">Minor $5K-15K / Major $15K-40K / Full $40K-80K</p>
                  </div>

                  <Separator />

                  {/* Bathrooms */}
                  <div className="space-y-2">
                    <Label htmlFor="bathCount">Bathrooms</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="bathCount" className="text-xs text-neutral-400">Count</Label>
                        <Input
                          id="bathCount"
                          type="number"
                          value={bathroomCount}
                          onChange={(e) => setBathroomCount(Math.max(0, Number(e.target.value)))}
                          min={0}
                          max={10}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="bathLevel" className="text-xs text-neutral-400">Level (each)</Label>
                        {renderLevelSelect(bathroomLevel, setBathroomLevel, 'bathLevel')}
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400">Minor $3K-8K / Major $8K-20K / Full $20K-40K each</p>
                  </div>

                  <Separator />

                  {/* Flooring */}
                  <div className="space-y-2">
                    <Label>Flooring</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="floorSqft" className="text-xs text-neutral-400">Square Feet</Label>
                        <Input
                          id="floorSqft"
                          type="number"
                          value={flooringSqft}
                          onChange={(e) => setFlooringSqft(Math.max(0, Number(e.target.value)))}
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="floorMat" className="text-xs text-neutral-400">Material</Label>
                        <Select value={flooringMaterial} onValueChange={(v) => setFlooringMaterial(v as typeof flooringMaterial)}>
                          <SelectTrigger id="floorMat" className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="laminate">Laminate ($3-6/sqft)</SelectItem>
                            <SelectItem value="hardwood">Hardwood ($6-12/sqft)</SelectItem>
                            <SelectItem value="tile">Tile ($5-10/sqft)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Paint */}
                  <div className="space-y-2">
                    <Label htmlFor="paintSqft">Interior Paint (living area sqft)</Label>
                    <Input
                      id="paintSqft"
                      type="number"
                      value={paintSqft}
                      onChange={(e) => setPaintSqft(Math.max(0, Number(e.target.value)))}
                      min={0}
                    />
                    <p className="text-xs text-neutral-400">$1.50-$3.00 per sqft</p>
                  </div>

                  <Separator />

                  {/* Toggle items */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label htmlFor="roof" className="cursor-pointer">Roof Replacement</Label>
                        <p className="text-xs text-neutral-400">$5K - $15K</p>
                      </div>
                      <Switch id="roof" checked={roofNeeded} onCheckedChange={setRoofNeeded} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label htmlFor="hvac" className="cursor-pointer">HVAC System</Label>
                        <p className="text-xs text-neutral-400">$4K - $10K</p>
                      </div>
                      <Switch id="hvac" checked={hvacNeeded} onCheckedChange={setHvacNeeded} />
                    </div>
                  </div>

                  <Separator />

                  {/* Electrical & Plumbing */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="electrical">Electrical</Label>
                      {renderLevelSelect(electricalLevel, setElectricalLevel, 'electrical')}
                      <p className="text-xs text-neutral-400">Minor $1K-5K / Major $5K-15K</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plumbing">Plumbing</Label>
                      {renderLevelSelect(plumbingLevel, setPlumbingLevel, 'plumbing')}
                      <p className="text-xs text-neutral-400">Minor $1K-5K / Major $5K-15K</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Windows */}
                  <div className="space-y-2">
                    <Label htmlFor="windows">Window Replacements</Label>
                    <Input
                      id="windows"
                      type="number"
                      value={windowCount}
                      onChange={(e) => setWindowCount(Math.max(0, Number(e.target.value)))}
                      min={0}
                      max={50}
                    />
                    <p className="text-xs text-neutral-400">$300-$800 per window</p>
                  </div>

                  <Separator />

                  {/* Landscaping */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label htmlFor="landscaping" className="cursor-pointer">Landscaping</Label>
                      <p className="text-xs text-neutral-400">$1K - $5K</p>
                    </div>
                    <Switch id="landscaping" checked={landscapingNeeded} onCheckedChange={setLandscapingNeeded} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 space-y-6">
              <div className="lg:sticky lg:top-28">
                <Card className="border-primary/20 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-cyan-400" />
                      Estimated Rehab Cost
                    </CardTitle>
                    <CardDescription>Low, mid, and high range projections</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Total estimates */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-green-500/10 p-3">
                        <p className="text-xs text-neutral-400 mb-1">Low</p>
                        <p className="text-lg font-semibold text-green-600">{fmt.format(results.totalLow)}</p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-3">
                        <p className="text-xs text-neutral-400 mb-1">Mid</p>
                        <p className="text-lg font-semibold text-cyan-400">{fmt.format(results.totalMid)}</p>
                      </div>
                      <div className="rounded-lg bg-orange-500/10 p-3">
                        <p className="text-xs text-neutral-400 mb-1">High</p>
                        <p className="text-lg font-semibold text-orange-600">{fmt.format(results.totalHigh)}</p>
                      </div>
                    </div>

                    {/* Cost per sqft */}
                    {totalSqft > 0 && (
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-neutral-400 mb-2">Cost Per Square Foot</p>
                        <div className="flex justify-between text-sm">
                          <span>{fmt.format(results.costPerSqftLow)}</span>
                          <span className="font-semibold">{fmt.format(results.costPerSqftMid)}</span>
                          <span>{fmt.format(results.costPerSqftHigh)}</span>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Category breakdown */}
                    <div>
                      <p className="text-sm font-medium mb-3">Breakdown</p>
                      <div className="space-y-2">
                        {results.categories.length === 0 && (
                          <p className="text-sm text-neutral-400 italic">Select renovation items to see a breakdown.</p>
                        )}
                        {results.categories.map((cat) => (
                          <div key={cat.name} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-400">{cat.name}</span>
                            <span className="font-medium tabular-nums">{fmt.format(cat.mid)}</span>
                          </div>
                        ))}
                        {results.categories.length > 0 && (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-neutral-400">Subtotal</span>
                              <span className="font-medium tabular-nums">{fmt.format(results.subtotalMid)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-neutral-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Contingency (15%)
                              </span>
                              <span className="font-medium tabular-nums">{fmt.format(results.contingencyMid)}</span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between text-sm font-semibold">
                              <span>Total (mid estimate)</span>
                              <span className="text-cyan-400 tabular-nums">{fmt.format(results.totalMid)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CTA */}
                <Card className="mt-6 bg-cyan-500/5 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm mb-1">Want AI to estimate rehab costs automatically?</p>
                        <p className="text-xs text-neutral-400 mb-3">AIWholesail analyzes property photos and comps to generate accurate rehab budgets in seconds.</p>
                        <Button asChild size="sm">
                          <Link to="/pricing">
                            Try AIWholesail Free
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Section */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">How to Use This Rehab Cost Estimator</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none space-y-4 text-neutral-400">
              <p>
                This rehab cost estimator gives you a ballpark renovation budget organized room-by-room. It is designed for real estate investors evaluating fix-and-flip or BRRRR properties, not for homeowners planning a custom remodel.
              </p>
              <h3 className="text-foreground font-semibold text-base">Step-by-step</h3>
              <ol className="space-y-2">
                <li><strong>Enter the property square footage</strong> so the calculator can show you a cost-per-sqft figure. This makes it easy to compare against local contractor averages.</li>
                <li><strong>Walk through each category</strong> and select the appropriate renovation level. "Minor" means cosmetic updates (paint cabinets, new hardware). "Major" means replacing most components. "Full gut" means tearing everything out and starting fresh.</li>
                <li><strong>Toggle roof, HVAC, and landscaping</strong> if the property needs those big-ticket items. These can dramatically shift your budget.</li>
                <li><strong>Review the three estimates.</strong> The low figure assumes you are getting favorable contractor pricing and basic materials. The high figure accounts for premium finishes and unexpected issues. The mid estimate is your most likely scenario.</li>
              </ol>
              <h3 className="text-foreground font-semibold text-base">Why the 15% contingency?</h3>
              <p>
                Experienced investors always budget a contingency buffer. Older properties frequently reveal hidden damage -- water damage behind walls, outdated wiring, or foundation issues -- once demolition begins. The 15% buffer protects your profit margin from these surprises.
              </p>
              <h3 className="text-foreground font-semibold text-base">Tips for accuracy</h3>
              <ul className="space-y-1">
                <li>Get at least three contractor bids before committing to a rehab budget.</li>
                <li>Costs vary significantly by market. A kitchen remodel in Phoenix costs 30-50% less than in San Francisco.</li>
                <li>Factor in permit costs for structural, electrical, and plumbing work -- they are not included in this estimate.</li>
                <li>Use the mid estimate for your initial deal analysis, then refine with actual contractor quotes.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
