import React, { useState, useEffect } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart
} from 'recharts';
import {
  Receipt,
  Home,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Loader2,
  Wallet,
  Shield,
  Zap,
  Droplets
} from 'lucide-react';
import { zillowAPI } from '@/lib/zillow-api';

interface TaxCarryingCostsProps {
  property: Property;
}

interface TaxRecord {
  year: number;
  taxAmount: number;
  assessedValue?: number;
}

export function TaxCarryingCosts({ property }: TaxCarryingCostsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [taxHistory, setTaxHistory] = useState<TaxRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Editable monthly costs
  const [insurance, setInsurance] = useState(150);
  const [utilities, setUtilities] = useState(200);
  const [hoaFees, setHoaFees] = useState(0);
  const [maintenance, setMaintenance] = useState(100);

  useEffect(() => {
    const fetchTaxHistory = async () => {
      const zpid = property.zpid || property.id;
      if (!zpid) {
        // Use estimated tax based on property price
        const estimatedTax = property.price ? Math.round(property.price * 0.012) : 3000;
        setTaxHistory([{
          year: new Date().getFullYear(),
          taxAmount: estimatedTax,
          assessedValue: property.price || 0
        }]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await zillowAPI.getPropertyTaxes(zpid);

        if (data && Array.isArray(data)) {
          const processed = data
            .filter((item: any) => item.taxPaid || item.taxAmount || item.tax)
            .map((item: any) => ({
              year: item.year || item.taxYear || new Date().getFullYear(),
              taxAmount: item.taxPaid || item.taxAmount || item.tax || 0,
              assessedValue: item.value || item.assessedValue || item.assessment || 0
            }))
            .sort((a: TaxRecord, b: TaxRecord) => a.year - b.year);

          if (processed.length > 0) {
            setTaxHistory(processed);
          } else {
            // Fallback to estimate
            const estimatedTax = property.price ? Math.round(property.price * 0.012) : 3000;
            setTaxHistory([{
              year: new Date().getFullYear(),
              taxAmount: estimatedTax,
              assessedValue: property.price || 0
            }]);
          }
        } else if (data?.taxHistory) {
          const processed = data.taxHistory
            .filter((item: any) => item.taxPaid || item.taxAmount)
            .map((item: any) => ({
              year: item.year || item.taxYear,
              taxAmount: item.taxPaid || item.taxAmount || 0,
              assessedValue: item.value || item.assessedValue || 0
            }))
            .sort((a: TaxRecord, b: TaxRecord) => a.year - b.year);

          if (processed.length > 0) {
            setTaxHistory(processed);
          }
        } else {
          // Fallback to estimate
          const estimatedTax = property.price ? Math.round(property.price * 0.012) : 3000;
          setTaxHistory([{
            year: new Date().getFullYear(),
            taxAmount: estimatedTax,
            assessedValue: property.price || 0
          }]);
        }
      } catch (err) {
        console.error('Error fetching tax history:', err);
        // Use estimate
        const estimatedTax = property.price ? Math.round(property.price * 0.012) : 3000;
        setTaxHistory([{
          year: new Date().getFullYear(),
          taxAmount: estimatedTax,
          assessedValue: property.price || 0
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTaxHistory();
  }, [property]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Calculate current tax (most recent year)
  const currentTax = taxHistory.length > 0
    ? taxHistory[taxHistory.length - 1].taxAmount
    : property.price ? Math.round(property.price * 0.012) : 3000;

  const monthlyTax = Math.round(currentTax / 12);

  // Calculate tax rate if we have assessed value
  const latestRecord = taxHistory.length > 0 ? taxHistory[taxHistory.length - 1] : null;
  const effectiveTaxRate = latestRecord?.assessedValue && latestRecord.assessedValue > 0
    ? ((latestRecord.taxAmount / latestRecord.assessedValue) * 100).toFixed(2)
    : null;

  // Total monthly carrying costs
  const totalMonthlyCarrying = monthlyTax + insurance + utilities + hoaFees + maintenance;
  const totalAnnualCarrying = totalMonthlyCarrying * 12;

  // Calculate tax increase trend
  const taxTrend = taxHistory.length >= 2
    ? ((taxHistory[taxHistory.length - 1].taxAmount - taxHistory[0].taxAmount) / taxHistory[0].taxAmount) * 100
    : 0;

  const avgAnnualIncrease = taxHistory.length >= 2
    ? taxTrend / (taxHistory.length - 1)
    : 0;

  // Monthly breakdown for chart
  const monthlyBreakdown = [
    { name: 'Property Tax', value: monthlyTax, color: 'hsl(var(--chart-1))' },
    { name: 'Insurance', value: insurance, color: 'hsl(var(--chart-2))' },
    { name: 'Utilities', value: utilities, color: 'hsl(var(--chart-3))' },
    { name: 'Maintenance', value: maintenance, color: 'hsl(var(--chart-4))' },
    { name: 'HOA', value: hoaFees, color: 'hsl(var(--chart-5))' }
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{label}</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading tax information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Annual Tax</span>
            </div>
            <div className="text-xl font-bold">{formatCurrency(currentTax)}</div>
            <div className="text-xs text-muted-foreground mt-1">{formatCurrency(monthlyTax)}/mo</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Monthly Carry</span>
            </div>
            <div className="text-xl font-bold">{formatCurrency(totalMonthlyCarrying)}</div>
            <div className="text-xs text-muted-foreground mt-1">{formatCurrency(totalAnnualCarrying)}/yr</div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${avgAnnualIncrease > 5 ? 'from-red-500/10 to-red-500/5 border-red-500/20' : 'from-green-500/10 to-green-500/5 border-green-500/20'}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className={`h-4 w-4 ${avgAnnualIncrease > 5 ? 'text-red-500' : 'text-green-500'}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase">Tax Trend</span>
            </div>
            <div className={`text-xl font-bold ${avgAnnualIncrease > 5 ? 'text-red-500' : 'text-green-500'}`}>
              {avgAnnualIncrease > 0 ? '+' : ''}{avgAnnualIncrease.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">avg/year</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Home className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Tax Rate</span>
            </div>
            <div className="text-xl font-bold">{effectiveTaxRate || '~1.2'}%</div>
            <div className="text-xs text-muted-foreground mt-1">effective rate</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Tax History Chart */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-primary" />
              Tax History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taxHistory.length > 1 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taxHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="taxAmount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Limited tax history available</p>
                  <p className="text-sm mt-1">Showing estimated current tax</p>
                </div>
              </div>
            )}

            {/* Tax History Table */}
            {taxHistory.length > 0 && (
              <div className="mt-4 space-y-2">
                {taxHistory.slice(-5).reverse().map((record) => (
                  <div key={record.year} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <span className="font-medium">{record.year}</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(record.taxAmount)}</span>
                      {record.assessedValue && record.assessedValue > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (assessed: {formatCurrency(record.assessedValue)})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Carrying Costs */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-primary" />
              Monthly Carrying Costs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Property Tax (read-only) */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>Property Tax</span>
              </div>
              <span className="font-semibold">{formatCurrency(monthlyTax)}</span>
            </div>

            {/* Editable Costs */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Label>Insurance</Label>
                </div>
                <Input
                  type="number"
                  value={insurance}
                  onChange={(e) => setInsurance(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <Label>Utilities</Label>
                </div>
                <Input
                  type="number"
                  value={utilities}
                  onChange={(e) => setUtilities(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <Label>HOA Fees</Label>
                </div>
                <Input
                  type="number"
                  value={hoaFees}
                  onChange={(e) => setHoaFees(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <Droplets className="h-4 w-4 text-muted-foreground" />
                  <Label>Maintenance</Label>
                </div>
                <Input
                  type="number"
                  value={maintenance}
                  onChange={(e) => setMaintenance(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </div>

            {/* Totals */}
            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between items-center py-2 bg-primary/10 rounded-lg px-4">
                <span className="font-semibold">Monthly Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(totalMonthlyCarrying)}</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-muted/50 rounded-lg px-4">
                <span className="font-medium">Annual Total</span>
                <span className="font-bold">{formatCurrency(totalAnnualCarrying)}</span>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="pt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Cost Breakdown</h4>
              <div className="space-y-2">
                {monthlyBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex-1 text-sm">{item.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {((item.value / totalMonthlyCarrying) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holding Cost Analysis */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-600">Holding Cost Analysis</div>
              <div className="text-sm text-muted-foreground mt-1">
                At {formatCurrency(totalMonthlyCarrying)}/month in carrying costs, you'll spend {formatCurrency(totalMonthlyCarrying * 3)} over 3 months
                or {formatCurrency(totalMonthlyCarrying * 6)} over 6 months while holding this property.
                Factor these costs into your wholesale or flip calculations.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
