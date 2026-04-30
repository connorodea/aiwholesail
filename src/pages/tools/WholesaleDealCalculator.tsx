import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Percent, Clock, ArrowRight, CheckCircle2, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';

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
      scoreColor = 'text-emerald-600';
      recommendation = 'go';
    } else if (spreadPercent >= 20) {
      dealScore = 'Great';
      scoreColor = 'text-emerald-500';
      recommendation = 'go';
    } else if (spreadPercent >= 12) {
      dealScore = 'Good';
      scoreColor = 'text-blue-500';
      recommendation = 'go';
    } else if (spreadPercent >= 5) {
      dealScore = 'Fair';
      scoreColor = 'text-amber-500';
      recommendation = 'caution';
    } else {
      dealScore = 'Poor';
      scoreColor = 'text-red-500';
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="Wholesale Deal Calculator - Analyze Real Estate Wholesale Deals"
        description="Free wholesale real estate calculator. Calculate your Maximum Allowable Offer (MAO), assignment fee profit, end buyer ROI, and get a Go/No-Go recommendation on any deal."
        keywords="wholesale deal calculator, wholesale real estate calculator, MAO calculator, maximum allowable offer, assignment fee calculator, real estate wholesale, 70% rule calculator"
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
              <Link to="/" className="text-lg font-semibold">AIWholesail</Link>
              <Link to="/pricing" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                Try Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-8 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge variant="secondary" className="mb-4">
            <TrendingUp className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Wholesale Deal Calculator
          </h1>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
            Instantly analyze any wholesale deal. Calculate your MAO using the 70% rule, estimate profits for both you and the end buyer, and get a clear Go/No-Go recommendation.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Inputs */}
            <Card className="border border-border/50">
              <CardHeader>
                <CardTitle className="text-xl font-medium">Deal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="askingPrice" className="text-sm font-medium">Property Price (Asking)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="askingPrice"
                      type="number"
                      value={askingPrice}
                      onChange={e => setAskingPrice(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arv" className="text-sm font-medium">After Repair Value (ARV)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="arv"
                      type="number"
                      value={arv}
                      onChange={e => setArv(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repairs" className="text-sm font-medium">Estimated Repairs</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="repairs"
                      type="number"
                      value={repairs}
                      onChange={e => setRepairs(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wholesaleFee" className="text-sm font-medium">Wholesale / Assignment Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="wholesaleFee"
                      type="number"
                      value={wholesaleFee}
                      onChange={e => setWholesaleFee(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="closingCosts" className="text-sm font-medium">Closing Costs (%)</Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="closingCosts"
                      type="number"
                      value={closingCostPercent}
                      onChange={e => setClosingCostPercent(Number(e.target.value))}
                      className="pl-9"
                      min={0}
                      max={20}
                      step={0.5}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="holdingCosts" className="text-sm font-medium">Holding Costs (Monthly)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="holdingCosts"
                        type="number"
                        value={holdingCostsMonthly}
                        onChange={e => setHoldingCostsMonthly(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holdTime" className="text-sm font-medium">Hold Time (Months)</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="holdTime"
                        type="number"
                        value={holdTime}
                        onChange={e => setHoldTime(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                        max={36}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {/* Recommendation */}
              {results && (
                <Card className={`border-2 ${
                  results.recommendation === 'go' ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' :
                  results.recommendation === 'caution' ? 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20' :
                  'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                }`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {results.recommendation === 'go' && <CheckCircle2 className="h-8 w-8 text-emerald-500" />}
                        {results.recommendation === 'caution' && <AlertTriangle className="h-8 w-8 text-amber-500" />}
                        {results.recommendation === 'no-go' && <XCircle className="h-8 w-8 text-red-500" />}
                        <div>
                          <p className="text-sm text-muted-foreground">Recommendation</p>
                          <p className="text-xl font-semibold capitalize">
                            {results.recommendation === 'go' ? 'Go' : results.recommendation === 'caution' ? 'Proceed with Caution' : 'No-Go'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={results.scoreColor}>
                        {results.dealScore}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Numbers */}
              <Card className="border border-border/50">
                <CardHeader>
                  <CardTitle className="text-xl font-medium">Deal Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  {results ? (
                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Maximum Allowable Offer (MAO)</p>
                        <p className="text-3xl font-semibold text-primary">{fmt.format(results.mao)}</p>
                        <p className="text-xs text-muted-foreground mt-1">ARV x 70% - Repairs - Fee</p>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spread (ARV - All Costs)</span>
                          <span className={`font-semibold ${results.spread >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt.format(results.spread)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spread %</span>
                          <span className={`font-medium ${results.scoreColor}`}>
                            {fmtPct(results.spreadPercent)}
                          </span>
                        </div>

                        <Separator />

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Your Profit (Assignment Fee)</span>
                          <span className="font-semibold text-emerald-600">{fmt.format(results.yourProfit)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">End Buyer Potential Profit</span>
                          <span className={`font-medium ${results.endBuyerProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt.format(results.endBuyerProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">End Buyer ROI</span>
                          <span className="font-medium">{fmtPct(results.endBuyerROI)}</span>
                        </div>

                        <Separator />

                        <div className="text-xs text-muted-foreground space-y-1 pt-2">
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
                    <p className="text-sm text-muted-foreground text-center py-8">Enter a positive ARV to see results.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <Separator />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-medium tracking-tight">How to Use This Wholesale Deal Calculator</h2>
              <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
                <p>
                  This calculator uses the industry-standard 70% rule to determine your Maximum Allowable Offer (MAO). The formula is simple: <strong className="text-foreground">MAO = ARV x 70% - Repair Costs - Your Assignment Fee</strong>. If your purchase price is at or below the MAO, the deal has enough margin for both you and the end buyer to profit.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Understanding the Results</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-foreground">MAO</strong> is the maximum you (or the end buyer) should pay for the property after accounting for repairs and your fee.</li>
                    <li><strong className="text-foreground">Spread</strong> is the total profit available in the deal after all costs. A higher spread means more room for everyone.</li>
                    <li><strong className="text-foreground">Deal Score</strong> is based on spread as a percentage of ARV. Excellent deals have 30%+ spread; Poor deals have under 5%.</li>
                    <li><strong className="text-foreground">Your Profit</strong> is your assignment fee, collected at closing when you assign the contract to the end buyer.</li>
                    <li><strong className="text-foreground">End Buyer Profit</strong> is what the flipper or landlord stands to make after all costs. If this is negative, the deal will be hard to sell.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Pro Tips</h3>
                  <p>
                    Always verify your ARV with recent comparable sales (use our ARV Calculator). Overestimating ARV is the number one reason wholesale deals fall through. When in doubt, be conservative on ARV and generous on repair estimates.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Separator />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-medium tracking-tight">Want AI to Find Deals Like This for You?</h2>
              <p className="text-muted-foreground font-light max-w-lg mx-auto">
                AIWholesail automatically finds off-market properties, calculates MAO, scores deals, and alerts you when a profitable wholesale opportunity appears.
              </p>
              <Link to="/pricing">
                <Button size="lg" className="mt-2">
                  Try AIWholesail Free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
