import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Building2, DollarSign, Sparkles, ChevronRight, TrendingUp, Info } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtGrm = (n: number) => `${n.toFixed(1)}x`;

function getCapRateRating(rate: number): { label: string; color: string; description: string } {
  if (rate <= 0) return { label: 'N/A', color: 'text-muted-foreground', description: 'Enter valid property data to see a rating.' };
  if (rate < 4) return { label: 'Low', color: 'text-orange-500', description: 'Typical of prime urban markets. Lower returns but potentially stronger appreciation and stability.' };
  if (rate < 7) return { label: 'Average', color: 'text-blue-500', description: 'Balanced risk and return. Common in suburban markets with steady demand.' };
  if (rate < 10) return { label: 'Good', color: 'text-green-600', description: 'Strong cash flow relative to price. Often found in secondary markets or value-add properties.' };
  return { label: 'Excellent', color: 'text-green-700', description: 'Very high return. Evaluate whether the high cap rate reflects added risk such as deferred maintenance or declining area.' };
}

export default function CapRateCalculator() {
  const [propertyValue, setPropertyValue] = useState(300000);
  const [grossAnnualRent, setGrossAnnualRent] = useState(36000);
  const [vacancyRate, setVacancyRate] = useState(5);
  const [propertyTax, setPropertyTax] = useState(3600);
  const [insuranceAnnual, setInsuranceAnnual] = useState(1800);
  const [maintenanceAnnual, setMaintenanceAnnual] = useState(2400);
  const [managementFeePct, setManagementFeePct] = useState(8);
  const [otherExpenses, setOtherExpenses] = useState(600);
  const [unitCount, setUnitCount] = useState(1);

  const results = useMemo(() => {
    // Effective Gross Income
    const vacancyLoss = grossAnnualRent * (vacancyRate / 100);
    const effectiveGrossIncome = grossAnnualRent - vacancyLoss;

    // Operating expenses
    const managementFee = effectiveGrossIncome * (managementFeePct / 100);
    const totalExpenses = propertyTax + insuranceAnnual + maintenanceAnnual + managementFee + otherExpenses;

    // NOI
    const noi = effectiveGrossIncome - totalExpenses;

    // Cap Rate
    const capRate = propertyValue > 0 ? (noi / propertyValue) * 100 : 0;

    // GRM
    const grm = grossAnnualRent > 0 ? propertyValue / grossAnnualRent : 0;

    // Price per unit
    const pricePerUnit = unitCount > 0 ? propertyValue / unitCount : 0;

    // Estimated value at different cap rates
    const valueAt5 = noi > 0 ? noi / 0.05 : 0;
    const valueAt7 = noi > 0 ? noi / 0.07 : 0;
    const valueAt10 = noi > 0 ? noi / 0.10 : 0;

    // Rating
    const rating = getCapRateRating(capRate);

    return {
      vacancyLoss: Math.round(vacancyLoss),
      effectiveGrossIncome: Math.round(effectiveGrossIncome),
      managementFee: Math.round(managementFee),
      totalExpenses: Math.round(totalExpenses),
      noi: Math.round(noi),
      capRate,
      grm,
      pricePerUnit: Math.round(pricePerUnit),
      valueAt5: Math.round(valueAt5),
      valueAt7: Math.round(valueAt7),
      valueAt10: Math.round(valueAt10),
      rating,
    };
  }, [propertyValue, grossAnnualRent, vacancyRate, propertyTax, insuranceAnnual, maintenanceAnnual, managementFeePct, otherExpenses, unitCount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEOHead
        title="Free Cap Rate Calculator - Capitalization Rate Calculator"
        description="Calculate cap rate, NOI, and GRM for investment properties. Compare property values at different cap rates. Free capitalization rate calculator for real estate investors."
        keywords="cap rate calculator, capitalization rate calculator, noi calculator, gross rent multiplier, real estate cap rate, investment property calculator, rental property analysis"
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
            <Building2 className="h-3 w-3 mr-1" />
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Cap Rate <span className="text-primary">Calculator</span>
          </h1>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
            Calculate the capitalization rate, net operating income, and gross rent multiplier for any investment property. See what your property would be worth at different cap rates.
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
                  <CardTitle className="text-xl">Property & Income</CardTitle>
                  <CardDescription>Enter the property value and gross annual rental income.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="propValue">Property Value / Purchase Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="propValue" type="number" className="pl-9" value={propertyValue} onChange={(e) => setPropertyValue(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grossRent">Gross Annual Rent</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="grossRent" type="number" className="pl-9" value={grossAnnualRent} onChange={(e) => setGrossAnnualRent(Number(e.target.value))} min={0} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Monthly: {fmt.format(Math.round(grossAnnualRent / 12))}
                      </p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vacancy">Vacancy Rate (%)</Label>
                      <Input id="vacancy" type="number" step={0.5} value={vacancyRate} onChange={(e) => setVacancyRate(Number(e.target.value))} min={0} max={50} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="units">Number of Units</Label>
                      <Input id="units" type="number" value={unitCount} onChange={(e) => setUnitCount(Math.max(1, Number(e.target.value)))} min={1} max={500} />
                      <p className="text-xs text-muted-foreground">For price-per-unit calculation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Operating Expenses</CardTitle>
                  <CardDescription>Annual expenses that reduce your net operating income. Do not include mortgage payments -- cap rate is calculated before debt service.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expTax">Property Tax (annual)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="expTax" type="number" className="pl-9" value={propertyTax} onChange={(e) => setPropertyTax(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expIns">Insurance (annual)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="expIns" type="number" className="pl-9" value={insuranceAnnual} onChange={(e) => setInsuranceAnnual(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expMaint">Maintenance (annual)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="expMaint" type="number" className="pl-9" value={maintenanceAnnual} onChange={(e) => setMaintenanceAnnual(Number(e.target.value))} min={0} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expMgmt">Management Fee (% of rent)</Label>
                      <Input id="expMgmt" type="number" step={0.5} value={managementFeePct} onChange={(e) => setManagementFeePct(Number(e.target.value))} min={0} max={25} />
                      <p className="text-xs text-muted-foreground">{fmt.format(results.managementFee)}/year</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expOther">Other Operating Expenses (annual)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="expOther" type="number" className="pl-9" value={otherExpenses} onChange={(e) => setOtherExpenses(Number(e.target.value))} min={0} />
                    </div>
                    <p className="text-xs text-muted-foreground">Landscaping, HOA, pest control, etc.</p>
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
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Property Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">Cap Rate</p>
                        <p className={`text-xl font-semibold ${results.rating.color}`}>
                          {results.capRate > 0 ? fmtPct(results.capRate) : '--'}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">NOI</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {fmt.format(results.noi)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">GRM</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {results.grm > 0 ? fmtGrm(results.grm) : '--'}
                        </p>
                      </div>
                    </div>

                    {/* Cap rate rating */}
                    <div className={`rounded-lg border p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          Cap Rate: <span className={results.rating.color}>{results.rating.label}</span>
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{results.rating.description}</p>
                    </div>

                    {/* Multi-family price per unit */}
                    {unitCount > 1 && (
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground mb-1">Price Per Unit ({unitCount} units)</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt.format(results.pricePerUnit)}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Income breakdown */}
                    <div>
                      <p className="text-sm font-medium mb-3">Income Breakdown</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gross Rent</span>
                          <span className="tabular-nums">{fmt.format(grossAnnualRent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Vacancy Loss ({vacancyRate}%)</span>
                          <span className="tabular-nums text-red-500">-{fmt.format(results.vacancyLoss)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-medium">
                          <span>Effective Gross Income</span>
                          <span className="tabular-nums">{fmt.format(results.effectiveGrossIncome)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expense breakdown */}
                    <div>
                      <p className="text-sm font-medium mb-3">Expenses</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Property Tax</span>
                          <span className="tabular-nums">-{fmt.format(propertyTax)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Insurance</span>
                          <span className="tabular-nums">-{fmt.format(insuranceAnnual)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Maintenance</span>
                          <span className="tabular-nums">-{fmt.format(maintenanceAnnual)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Management ({managementFeePct}%)</span>
                          <span className="tabular-nums">-{fmt.format(results.managementFee)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Other</span>
                          <span className="tabular-nums">-{fmt.format(otherExpenses)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-medium">
                          <span>Total Expenses</span>
                          <span className="tabular-nums text-red-500">-{fmt.format(results.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* NOI highlight */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Net Operating Income (NOI)</p>
                      <p className="text-2xl font-semibold text-primary tabular-nums">{fmt.format(results.noi)}</p>
                    </div>

                    <Separator />

                    {/* Value at different cap rates */}
                    <div>
                      <p className="text-sm font-medium mb-3">Estimated Value at Different Cap Rates</p>
                      <p className="text-xs text-muted-foreground mb-3">Using your NOI of {fmt.format(results.noi)}, here is what this property would be worth if the market priced it at different cap rates.</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm rounded-lg border p-3">
                          <div>
                            <span className="font-medium">5% Cap</span>
                            <span className="text-xs text-muted-foreground ml-2">(Low risk / A-class)</span>
                          </div>
                          <span className="tabular-nums font-medium">{fmt.format(results.valueAt5)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm rounded-lg border p-3">
                          <div>
                            <span className="font-medium">7% Cap</span>
                            <span className="text-xs text-muted-foreground ml-2">(Average market)</span>
                          </div>
                          <span className="tabular-nums font-medium">{fmt.format(results.valueAt7)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm rounded-lg border p-3">
                          <div>
                            <span className="font-medium">10% Cap</span>
                            <span className="text-xs text-muted-foreground ml-2">(High yield)</span>
                          </div>
                          <span className="tabular-nums font-medium">{fmt.format(results.valueAt10)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cap rate comparison table */}
                    <div>
                      <p className="text-sm font-medium mb-3">What Cap Rates Mean</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline" className="text-orange-500 border-orange-500/30 min-w-[52px] justify-center">2-4%</Badge>
                          <span className="text-muted-foreground">Prime / Gateway markets. Appreciation play.</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline" className="text-blue-500 border-blue-500/30 min-w-[52px] justify-center">5-7%</Badge>
                          <span className="text-muted-foreground">Balanced return. Suburban / stable demand.</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline" className="text-green-600 border-green-600/30 min-w-[52px] justify-center">8-10%</Badge>
                          <span className="text-muted-foreground">Strong cash flow. Secondary / tertiary markets.</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline" className="text-green-700 border-green-700/30 min-w-[52px] justify-center">10%+</Badge>
                          <span className="text-muted-foreground">Excellent yield. Verify risk factors carefully.</span>
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
                        <p className="font-medium text-sm mb-1">Want AI to analyze cap rates across your pipeline?</p>
                        <p className="text-xs text-muted-foreground mb-3">AIWholesail calculates NOI, cap rate, and GRM for every property automatically using real-time rental data and expense estimates.</p>
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
              <CardTitle className="text-2xl">How to Use This Cap Rate Calculator</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
              <p>
                The capitalization rate (cap rate) is one of the most important metrics in real estate investing. It measures the rate of return on an investment property based on the income it generates, independent of how the property is financed.
              </p>
              <h3 className="text-foreground font-semibold text-base">The formula</h3>
              <p className="font-mono text-xs bg-muted p-3 rounded-lg">
                Cap Rate = Net Operating Income (NOI) / Property Value x 100
              </p>
              <p>
                NOI is calculated by taking gross rental income, subtracting vacancy loss, and then subtracting all operating expenses. Critically, NOI does not include mortgage payments or debt service -- it represents the property's pure earning power before financing.
              </p>
              <h3 className="text-foreground font-semibold text-base">Step-by-step</h3>
              <ol className="space-y-2">
                <li><strong>Enter the purchase price or current value</strong> and the total annual rental income. If you have multiple units, enter the combined rent for all units.</li>
                <li><strong>Set vacancy rate.</strong> A 5% vacancy rate means the property is vacant roughly 2.5 weeks per year. For less desirable areas, use 8-10%.</li>
                <li><strong>Enter operating expenses.</strong> Include property tax, insurance, maintenance, management fees, and any other recurring costs. Do not include mortgage payments.</li>
                <li><strong>Review the results.</strong> The cap rate tells you what percentage return the property generates on its value each year. Higher is better for cash flow, but very high cap rates can signal risk.</li>
              </ol>
              <h3 className="text-foreground font-semibold text-base">Gross Rent Multiplier (GRM)</h3>
              <p>
                The GRM is a simpler metric: Property Price / Annual Rent. A lower GRM means you are paying less per dollar of rent. GRM is useful for quick comparisons but does not account for expenses, so it should always be paired with a cap rate analysis.
              </p>
              <h3 className="text-foreground font-semibold text-base">Value estimation</h3>
              <p>
                The "Estimated Value at Different Cap Rates" section reverses the formula. If you know the NOI, you can calculate what the property should be worth at market cap rates. This is particularly useful when evaluating whether a property is overpriced or underpriced relative to its income.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
