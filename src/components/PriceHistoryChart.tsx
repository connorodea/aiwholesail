import React, { useState, useEffect } from 'react';
import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
  History
} from 'lucide-react';
import { zillowAPI } from '@/lib/zillow-api';

interface PriceHistoryChartProps {
  property: Property;
}

interface PriceEvent {
  date: string;
  price: number;
  event: string;
  priceChange?: number;
  priceChangePercent?: number;
}

export function PriceHistoryChart({ property }: PriceHistoryChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<PriceEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      const zpid = property.zpid || property.id;
      if (!zpid) {
        setError('No property ID available');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await zillowAPI.getPriceHistory(zpid);

        if (data && Array.isArray(data)) {
          // Process price history data
          const processed = data
            .filter((item: any) => item.price && item.date)
            .map((item: any, index: number, arr: any[]) => {
              const prevPrice = index < arr.length - 1 ? arr[index + 1]?.price : null;
              const priceChange = prevPrice ? item.price - prevPrice : 0;
              const priceChangePercent = prevPrice ? ((priceChange / prevPrice) * 100) : 0;

              return {
                date: new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: '2-digit'
                }),
                rawDate: new Date(item.date),
                price: item.price,
                event: item.event || item.priceChangeRate ? 'Price Change' : 'Listed',
                priceChange,
                priceChangePercent
              };
            })
            .sort((a: any, b: any) => a.rawDate.getTime() - b.rawDate.getTime());

          setPriceHistory(processed);
        } else if (data?.priceHistory) {
          // Alternative data structure
          const processed = data.priceHistory
            .filter((item: any) => item.price)
            .map((item: any, index: number, arr: any[]) => {
              const prevPrice = index < arr.length - 1 ? arr[index + 1]?.price : null;
              const priceChange = prevPrice ? item.price - prevPrice : 0;
              const priceChangePercent = prevPrice ? ((priceChange / prevPrice) * 100) : 0;

              return {
                date: item.date ? new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: '2-digit'
                }) : 'N/A',
                rawDate: new Date(item.date || Date.now()),
                price: item.price,
                event: item.event || 'Price Change',
                priceChange,
                priceChangePercent
              };
            })
            .sort((a: any, b: any) => a.rawDate.getTime() - b.rawDate.getTime());

          setPriceHistory(processed);
        } else {
          // No history available, show current listing
          setPriceHistory([{
            date: 'Current',
            price: property.price || 0,
            event: 'Listed',
            priceChange: 0,
            priceChangePercent: 0
          }]);
        }
      } catch (err) {
        console.error('Error fetching price history:', err);
        // Show current price as fallback
        setPriceHistory([{
          date: 'Current',
          price: property.price || 0,
          event: 'Listed',
          priceChange: 0,
          priceChangePercent: 0
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriceHistory();
  }, [property]);

  const formatPrice = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatFullPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Calculate statistics
  const originalPrice = priceHistory.length > 0 ? priceHistory[0].price : property.price || 0;
  const currentPrice = property.price || (priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0);
  const totalPriceChange = currentPrice - originalPrice;
  const totalPriceChangePercent = originalPrice > 0 ? ((totalPriceChange / originalPrice) * 100) : 0;
  const priceDropCount = priceHistory.filter(p => (p.priceChange || 0) < 0).length;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{label}</p>
          <p className="text-lg font-bold text-primary">{formatFullPrice(data.price)}</p>
          <p className="text-sm text-muted-foreground">{data.event}</p>
          {data.priceChange !== 0 && (
            <p className={`text-sm font-medium ${data.priceChange < 0 ? 'text-red-500' : 'text-green-500'}`}>
              {data.priceChange < 0 ? '' : '+'}{formatFullPrice(data.priceChange)} ({data.priceChangePercent.toFixed(1)}%)
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading price history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Current Price</span>
            </div>
            <div className="text-xl font-bold">{formatFullPrice(currentPrice)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <History className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase">Original Price</span>
            </div>
            <div className="text-xl font-bold">{formatFullPrice(originalPrice)}</div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${totalPriceChange < 0 ? 'from-red-500/10 to-red-500/5 border-red-500/20' : 'from-green-500/10 to-green-500/5 border-green-500/20'}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {totalPriceChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              <span className="text-xs font-medium text-muted-foreground uppercase">Total Change</span>
            </div>
            <div className={`text-xl font-bold ${totalPriceChange < 0 ? 'text-red-500' : 'text-green-500'}`}>
              {totalPriceChange < 0 ? '' : '+'}{formatFullPrice(totalPriceChange)}
            </div>
            <div className={`text-xs ${totalPriceChange < 0 ? 'text-red-400' : 'text-green-400'}`}>
              ({totalPriceChangePercent.toFixed(1)}%)
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${priceDropCount > 0 ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20' : 'from-muted/50 to-muted/30 border-border'}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${priceDropCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase">Price Drops</span>
            </div>
            <div className={`text-xl font-bold ${priceDropCount > 0 ? 'text-amber-500' : ''}`}>
              {priceDropCount}
            </div>
            {priceDropCount > 2 && (
              <Badge variant="outline" className="mt-1 text-xs border-amber-500 text-amber-600">
                Motivated Seller
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price Chart */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingDown className="h-5 w-5 text-primary" />
            Price History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {priceHistory.length > 1 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={formatPrice}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    domain={['dataMin - 10000', 'dataMax + 10000']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {property.zestimate && (
                    <ReferenceLine
                      y={property.zestimate}
                      stroke="hsl(var(--chart-2))"
                      strokeDasharray="5 5"
                      label={{
                        value: `Zestimate: ${formatPrice(property.zestimate)}`,
                        position: 'right',
                        fontSize: 11,
                        fill: 'hsl(var(--muted-foreground))'
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No price history available</p>
                <p className="text-sm">This may be a new listing</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price Change Timeline */}
      {priceHistory.length > 1 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Price Change Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {priceHistory.slice().reverse().map((event, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    (event.priceChange || 0) < 0
                      ? 'bg-red-500/20 text-red-500'
                      : (event.priceChange || 0) > 0
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {(event.priceChange || 0) < 0 ? (
                      <TrendingDown className="h-5 w-5" />
                    ) : (event.priceChange || 0) > 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <DollarSign className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.event}</span>
                      <span className="text-sm text-muted-foreground">{event.date}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-lg font-bold">{formatFullPrice(event.price)}</span>
                      {event.priceChange !== 0 && (
                        <Badge variant={event.priceChange! < 0 ? 'destructive' : 'default'} className="text-xs">
                          {event.priceChange! < 0 ? '' : '+'}{formatFullPrice(event.priceChange!)}
                          ({event.priceChangePercent!.toFixed(1)}%)
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
