import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Target, DollarSign, Sparkles, ChevronRight, BarChart3 } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function OfferPriceCalculator() {
  const [arv, setArv] = useState(250000);
  const [repairEstimate, setRepairEstimate] = useState(35000);
  const [profitMargin, setProfitMargin] = useState(30);
  const [assignmentFee, setAssignmentFee] = useState(10000);
  const [closingCostsPct, setClosingCostsPct] = useState(3);
  const [holdingCosts, setHoldingCosts] = useState(8000);

  const results = useMemo(() => {
    // 70% rule MAO
    const mao70 = arv * 0.7 - repairEstimate;

    // Custom MAO
    const customMultiplier = (100 - profitMargin) / 100;
    const closingCostsAmt = arv * (closingCostsPct / 100);
    const customMao = arv * customMultiplier - repairEstimate - assignmentFee - closingCostsAmt - holdingCosts;

    // Spread at 70% rule
    const profit70 = arv - mao70 - repairEstimate;

    // Spread at custom MAO
    const profitCustom = arv - customMao - repairEstimate - assignmentFee - closingCostsAmt - holdingCosts;

    // Visual comparison percentages (relative to ARV)
    const mao70Pct = arv > 0 ? Math.max(0, (mao70 / arv) * 100) : 0;
    const customMaoPct = arv > 0 ? Math.max(0, (customMao / arv) * 100) : 0;
    const repairsPct = arv > 0 ? (repairEstimate / arv) * 100 : 0;
    const assignmentPct = arv > 0 ? (assignmentFee / arv) * 100 : 0;
    const closingPct = arv > 0 ? (closingCostsAmt / arv) * 100 : 0;
    const holdingPct = arv > 0 ? (holdingCosts / arv) * 100 : 0;

    return {
      mao70: Math.round(mao70),
      customMao: Math.round(customMao),
      profit70: Math.round(profit70),
      profitCustom: Math.round(profitCustom),
      closingCostsAmt: Math.round(closingCostsAmt),
      mao70Pct,
      customMaoPct,
      repairsPct,
      assignmentPct,
      closingPct,
      holdingPct,
    };
  }, [arv, repairEstimate, profitMargin, assignmentFee, closingCostsPct, holdingCosts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="Free 70% Rule Calculator - MAO Calculator for Real Estate"
        description="Calculate your Maximum Allowable Offer using the 70% rule or custom profit margins. Free MAO calculator for wholesalers and fix-and-flip investors."
        keywords="70 percent rule calculator, mao calculator real estate, maximum allowable offer calculator, wholesale offer calculator, 70% rule, real estate offer calculator, flip deal calculator"
      />

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
              <div className="text-lg font-semibold">AIWholesail</div>
              <Link to="/pricing" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
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
            <Target className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Offer Price <span className="text-primary">Calculator</span>
          </h1>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Property Values</CardTitle>
                  <CardDescription>The ARV and repair estimate are the foundation of every offer formula.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="arv">After Repair Value (ARV)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="arv" type="number" className="pl-9" value={arv} onChange={(e) => setArv(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-muted-foreground">Estimated market value after all repairs are completed.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repairs">Repair Estimate</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="repairs" type="number" className="pl-9" value={repairEstimate} onChange={(e) => setRepairEstimate(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Profit & Cost Parameters</CardTitle>
                  <CardDescription>Adjust your target profit margin and account for all deal costs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Profit margin slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Desired Profit Margin</Label>
                      <Badge variant="outline" className="tabular-nums">{profitMargin}%</Badge>
                    </div>
                    <Slider
                      value={[profitMargin]}
                      onValueChange={(v) => setProfitMargin(v[0])}
                      min={10}
                      max={50}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10% (aggressive)</span>
                      <span>30% (standard)</span>
                      <span>50% (conservative)</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="assignment">Assignment / Wholesale Fee</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="assignment" type="number" className="pl-9" value={assignmentFee} onChange={(e) => setAssignmentFee(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-muted-foreground">Set to $0 if you are the end buyer (fix-and-flip).</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="closing">Closing Costs (% of ARV)</Label>
                      <Input id="closing" type="number" step={0.5} value={closingCostsPct} onChange={(e) => setClosingCostsPct(Number(e.target.value))} min={0} max={10} />
                      <p className="text-xs text-muted-foreground">Typically 2-5% for buy + sell side</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holding">Holding Costs (total)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="holding" type="number" className="pl-9" value={holdingCosts} onChange={(e) => setHoldingCosts(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-muted-foreground">Loan, insurance, utilities during rehab</p>
                    </div>
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
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Maximum Allowable Offer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* 70% Rule */}
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">70% Rule MAO</p>
                        <Badge variant="secondary" className="text-xs">Industry Standard</Badge>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums mb-2">
                        {results.mao70 > 0 ? fmt.format(results.mao70) : '$0'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmt.format(arv)} x 70% - {fmt.format(repairEstimate)} = {fmt.format(results.mao70)}
                      </p>
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">Spread: </span>
                        <span className={`font-medium ${results.profit70 > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmt.format(results.profit70)}
                        </span>
                      </div>
                    </div>

                    {/* Custom MAO */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">Custom MAO ({profitMargin}% margin)</p>
                        <Badge className="text-xs">Your Numbers</Badge>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-primary mb-2">
                        {results.customMao > 0 ? fmt.format(results.customMao) : '$0'}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>{fmt.format(arv)} x {100 - profitMargin}% = {fmt.format(Math.round(arv * (100 - profitMargin) / 100))}</p>
                        <p>- Repairs: {fmt.format(repairEstimate)}</p>
                        {assignmentFee > 0 && <p>- Assignment fee: {fmt.format(assignmentFee)}</p>}
                        <p>- Closing: {fmt.format(results.closingCostsAmt)}</p>
                        <p>- Holding: {fmt.format(holdingCosts)}</p>
                      </div>
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">Target profit: </span>
                        <span className={`font-medium ${results.profitCustom > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmt.format(results.profitCustom)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Visual comparison bar */}
                    <div>
                      <p className="text-sm font-medium mb-4">Deal Structure (% of ARV)</p>
                      <div className="space-y-3">
                        {/* ARV bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">After Repair Value</span>
                            <span className="tabular-nums">{fmt.format(arv)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-foreground/20 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>

                        {/* 70% MAO bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">70% Rule MAO</span>
                            <span className="tabular-nums">{fmt.format(results.mao70)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, results.mao70Pct))}%` }} />
                          </div>
                        </div>

                        {/* Custom MAO bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Custom MAO</span>
                            <span className="tabular-nums">{fmt.format(results.customMao)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, results.customMaoPct))}%` }} />
                          </div>
                        </div>

                        {/* Repairs bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Repairs</span>
                            <span className="tabular-nums">{fmt.format(repairEstimate)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, results.repairsPct)}%` }} />
                          </div>
                        </div>

                        {/* Profit bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Target Profit ({profitMargin}%)</span>
                            <span className="tabular-nums">{fmt.format(Math.round(arv * profitMargin / 100))}</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, profitMargin)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CTA */}
                <Card className="mt-6 bg-primary/5 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm mb-1">Want AI to calculate offers on every lead?</p>
                        <p className="text-xs text-muted-foreground mb-3">AIWholesail auto-calculates MAO, ARV, and repair estimates for every property in your pipeline using AI and real-time comps.</p>
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
              <CardTitle className="text-2xl">How to Use This Offer Price Calculator</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
              <p>
                Every profitable real estate deal starts with the right offer price. Offer too high and you kill your margin. Offer too low and you never get deals accepted. This calculator helps you find the sweet spot using two proven methods.
              </p>
              <h3 className="text-foreground font-semibold text-base">The 70% Rule</h3>
              <p>
                The 70% rule is the most widely used formula in real estate investing. It states that you should pay no more than 70% of the After Repair Value (ARV) minus the estimated repair costs. The remaining 30% covers your profit, closing costs, holding costs, and margin of error.
              </p>
              <p className="font-mono text-xs bg-muted p-3 rounded-lg">
                MAO = ARV x 70% - Repair Costs
              </p>
              <h3 className="text-foreground font-semibold text-base">Custom MAO</h3>
              <p>
                The 70% rule is a useful shortcut, but serious investors need to account for their actual costs. The custom MAO calculation lets you specify your exact profit margin, wholesale assignment fee, closing costs, and holding costs. This gives a more precise offer price tailored to your specific deal structure.
              </p>
              <p className="font-mono text-xs bg-muted p-3 rounded-lg">
                MAO = ARV x (100% - Profit%) - Repairs - Assignment Fee - Closing - Holding
              </p>
              <h3 className="text-foreground font-semibold text-base">When to adjust your margin</h3>
              <ul className="space-y-1">
                <li><strong>Tighter markets (20-25% margin):</strong> When competition is fierce and deals are scarce, you may need to accept a thinner margin to win deals.</li>
                <li><strong>Standard deals (30% margin):</strong> The default for most fix-and-flip and wholesale deals. Provides a healthy buffer for surprises.</li>
                <li><strong>Risky properties (35-50% margin):</strong> Properties with unknown structural issues, title problems, or long rehab timelines demand a larger margin to compensate for risk.</li>
              </ul>
              <h3 className="text-foreground font-semibold text-base">Wholesaling vs. Fix-and-Flip</h3>
              <p>
                If you are wholesaling, include your assignment fee in the calculation -- this is the spread you earn when assigning the contract to an end buyer. If you are the end buyer doing a fix-and-flip, set the assignment fee to $0 and the custom MAO becomes your maximum purchase price.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
