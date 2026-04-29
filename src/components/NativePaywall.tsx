import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Crown, Zap } from 'lucide-react';
import { getOfferings, purchasePackage, restorePurchases, hasAnySubscription } from '@/lib/purchases';
import { toast } from 'sonner';

interface NativePaywallProps {
  onSubscribed: () => void;
}

export function NativePaywall({ onSubscribed }: NativePaywallProps) {
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const result = await getOfferings();
      setOfferings(result);
    } catch (err) {
      console.error('Failed to load offerings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: any, planName: string) => {
    setPurchasing(planName);
    try {
      const info = await purchasePackage(pkg);
      if (info) {
        toast.success(`Subscribed to ${planName}!`);
        onSubscribed();
      }
    } catch (err: any) {
      toast.error(err.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      const hasSubscription = await hasAnySubscription();
      if (hasSubscription) {
        toast.success('Subscription restored!');
        onSubscribed();
      } else {
        toast.info('No active subscription found.');
      }
    } catch (err: any) {
      toast.error('Failed to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const proFeatures = [
    '5 search locations',
    'Spread calculations with Zestimates',
    'State-wide property searches',
    'Deal notifications (+$30K spreads)',
    'Export to CSV',
    'Market analytics',
  ];

  const eliteFeatures = [
    'Unlimited search locations',
    'AI-powered property analysis',
    'Skip tracing & lead scoring',
    'Comparable sales data',
    'Investment calculator',
    'Priority support',
    'Everything in Pro',
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentOffering = offerings?.current;
  const proPackage = currentOffering?.availablePackages?.find(
    (p: any) => p.identifier === '$rc_monthly' || p.identifier === 'pro_monthly'
  );
  const elitePackage = currentOffering?.availablePackages?.find(
    (p: any) => p.identifier === 'elite_monthly' || p.identifier === '$rc_annual'
  );

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Find Profitable Wholesale Deals
            </h1>
            <p className="text-muted-foreground">
              Discover properties with +$30K spreads between listing price and Zestimate.
              Choose your plan to get started.
            </p>
          </div>

          {/* Pro Plan */}
          <Card className="border-border hover:border-primary/50 transition-colors">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Pro
                </CardTitle>
                <div className="text-right">
                  <span className="text-2xl font-bold">$29.99</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {proFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                size="lg"
                disabled={!!purchasing || !proPackage}
                onClick={() => proPackage && handlePurchase(proPackage, 'Pro')}
              >
                {purchasing === 'Pro' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {proPackage ? 'Subscribe to Pro' : 'Not available'}
              </Button>
            </CardContent>
          </Card>

          {/* Elite Plan */}
          <Card className="border-primary ring-1 ring-primary/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Elite
                  <Badge className="bg-primary/10 text-primary border-0">Most Popular</Badge>
                </CardTitle>
                <div className="text-right">
                  <span className="text-2xl font-bold">$99.99</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {eliteFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-gradient-to-r from-primary to-primary/80"
                size="lg"
                disabled={!!purchasing || !elitePackage}
                onClick={() => elitePackage && handlePurchase(elitePackage, 'Elite')}
              >
                {purchasing === 'Elite' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {elitePackage ? 'Subscribe to Elite' : 'Not available'}
              </Button>
            </CardContent>
          </Card>

          {/* Restore + Legal */}
          <div className="text-center space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestore}
              disabled={restoring}
              className="text-muted-foreground"
            >
              {restoring ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Restore Purchases
            </Button>
            <p className="text-xs text-muted-foreground px-4">
              Payment will be charged to your Apple ID account. Subscription renews automatically
              unless cancelled at least 24 hours before the end of the current period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
