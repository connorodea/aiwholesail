import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, DollarSign, Ruler, Plus, X, ArrowRight, BarChart3, Target } from 'lucide-react';

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

    // Confidence based on number of valid comps
    let confidence: 'Low' | 'Medium' | 'High';
    let confidenceColor: string;
    if (validComps.length >= 4) {
      confidence = 'High';
      confidenceColor = 'text-emerald-600';
    } else if (validComps.length >= 2) {
      confidence = 'Medium';
      confidenceColor = 'text-amber-500';
    } else {
      confidence = 'Low';
      confidenceColor = 'text-red-500';
    }

    // Range: +/- based on standard deviation of price/sqft
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="ARV Calculator - After Repair Value Estimator"
        description="Free ARV calculator for real estate investors. Estimate the After Repair Value of any property using comparable sales, condition adjustments, and market trends. Get a confidence-rated valuation range."
        keywords="arv calculator, after repair value calculator, property value estimator, real estate comps calculator, comparable sales analysis, fix and flip calculator"
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
            <Target className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            ARV Calculator
          </h1>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
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
              <Card className="border border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-medium">Comparable Sales</CardTitle>
                    <Badge variant="outline" className="text-xs">{comps.length}/5</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comps.map((comp, i) => (
                    <div key={comp.id} className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 mr-3">
                          <Input
                            value={comp.label}
                            onChange={e => updateComp(comp.id, 'label', e.target.value)}
                            placeholder={`Comp ${i + 1} address`}
                            className="text-sm h-8 border-0 bg-transparent p-0 font-medium focus-visible:ring-0"
                          />
                        </div>
                        {comps.length > 1 && (
                          <button
                            onClick={() => removeComp(comp.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            aria-label={`Remove ${comp.label}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sale Price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="number"
                              value={comp.price || ''}
                              onChange={e => updateComp(comp.id, 'price', Number(e.target.value))}
                              className="pl-8 h-9 text-sm"
                              placeholder="0"
                              min={0}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sq Ft</Label>
                          <div className="relative">
                            <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="number"
                              value={comp.sqft || ''}
                              onChange={e => updateComp(comp.id, 'sqft', Number(e.target.value))}
                              className="pl-8 h-9 text-sm"
                              placeholder="0"
                              min={0}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {comps.length < 5 && (
                    <Button variant="outline" size="sm" onClick={addComp} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Comparable
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Subject & Adjustments */}
              <Card className="border border-border/50">
                <CardHeader>
                  <CardTitle className="text-xl font-medium">Subject Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="subjectSqft" className="text-sm font-medium">Square Footage</Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="subjectSqft"
                        type="number"
                        value={subjectSqft}
                        onChange={e => setSubjectSqft(Number(e.target.value))}
                        className="pl-9"
                        min={0}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Condition Adjustment</Label>
                      <span className={`text-sm font-semibold ${conditionAdj > 0 ? 'text-emerald-600' : conditionAdj < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
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
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Below avg (-20%)</span>
                      <span>Average</span>
                      <span>Above avg (+20%)</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Market Trend Adjustment</Label>
                      <span className={`text-sm font-semibold ${marketAdj > 0 ? 'text-emerald-600' : marketAdj < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
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
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Declining (-10%)</span>
                      <span>Stable</span>
                      <span>Appreciating (+10%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="space-y-6">
              <Card className="border border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-xl font-medium">Estimated ARV</CardTitle>
                </CardHeader>
                <CardContent>
                  {results ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-5xl font-semibold tracking-tight text-primary">
                          {fmt.format(results.estimatedARV)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Mid-point estimate</p>
                      </div>

                      {/* Range Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Low</span>
                          <span>Mid</span>
                          <span>High</span>
                        </div>
                        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="absolute inset-y-0 bg-gradient-to-r from-amber-400 via-emerald-500 to-blue-500 rounded-full"
                            style={{ left: '0%', right: '0%' }}
                          />
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span>{fmt.format(results.lowARV)}</span>
                          <span>{fmt.format(results.highARV)}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Avg Price / Sq Ft (Comps)</span>
                          <span className="font-medium">{fmtPsf.format(results.avgPsf)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Adjusted Price / Sq Ft</span>
                          <span className="font-medium">{fmtPsf.format(results.adjustedPsf)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subject Sq Ft</span>
                          <span className="font-medium">{subjectSqft.toLocaleString()}</span>
                        </div>

                        <Separator />

                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground">Confidence Level</span>
                          <Badge variant="outline" className={results.confidenceColor}>
                            <BarChart3 className="h-3 w-3 mr-1" />
                            {results.confidence} ({results.validCount} comp{results.validCount !== 1 ? 's' : ''})
                          </Badge>
                        </div>
                      </div>

                      {results.confidence === 'Low' && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Add more comparable sales to improve accuracy. At least 3 comps are recommended for a reliable estimate.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Enter at least one comparable sale and the subject square footage to see results.</p>
                  )}
                </CardContent>
              </Card>

              {/* Comp Breakdown */}
              {results && (
                <Card className="border border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Comp Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium pb-2 border-b border-border">
                        <span>Property</span>
                        <span className="text-right">Price</span>
                        <span className="text-right">$/Sq Ft</span>
                      </div>
                      {comps.filter(c => c.price > 0 && c.sqft > 0).map(comp => (
                        <div key={comp.id} className="grid grid-cols-3 text-sm py-1.5">
                          <span className="font-medium truncate pr-2">{comp.label}</span>
                          <span className="text-right">{fmt.format(comp.price)}</span>
                          <span className="text-right text-primary">{fmtPsf.format(comp.price / comp.sqft)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Educational Section */}
          <div className="mt-16 space-y-12">
            <Separator />
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-2xl font-medium tracking-tight">How to Use This ARV Calculator</h2>
              <div className="space-y-6 text-muted-foreground font-light leading-relaxed">
                <p>
                  The After Repair Value (ARV) is the estimated market value of a property after all renovations are complete. It is the single most important number in any fix-and-flip or wholesale deal, because it determines how much you can pay for the property and still make a profit.
                </p>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Step-by-Step Guide</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li><strong className="text-foreground">Find comparable sales (comps)</strong> that sold recently in the same neighborhood. Ideally within 0.5 miles and the last 90 days. Look for similar size, age, and style.</li>
                    <li><strong className="text-foreground">Enter each comp's sale price and square footage.</strong> The calculator will compute the average price per square foot across all your comps.</li>
                    <li><strong className="text-foreground">Enter your subject property's square footage.</strong> This is the property you are evaluating.</li>
                    <li><strong className="text-foreground">Adjust for condition.</strong> If your subject will be renovated to a higher standard than the comps, slide positive. If the comps were in better shape, slide negative.</li>
                    <li><strong className="text-foreground">Adjust for market trends.</strong> If the market is appreciating, slide positive. If declining, slide negative.</li>
                  </ol>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-foreground">Confidence Levels</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-foreground">High (4-5 comps)</strong>: Strong data set. The estimate is reliable for initial analysis.</li>
                    <li><strong className="text-foreground">Medium (2-3 comps)</strong>: Reasonable estimate, but consider finding more comps before committing.</li>
                    <li><strong className="text-foreground">Low (1 comp)</strong>: Directional only. Do not make offers based on a single comp.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Separator />
            <div className="text-center space-y-4 py-8">
              <h2 className="text-2xl font-medium tracking-tight">Want AI to Pull Comps Automatically?</h2>
              <p className="text-muted-foreground font-light max-w-lg mx-auto">
                AIWholesail uses AI-powered comp analysis to estimate ARV instantly, pulling recent sales data and adjusting for dozens of property factors you might miss.
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
