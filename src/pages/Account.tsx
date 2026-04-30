import { useState, useEffect } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User, Mail, CreditCard, Calendar, Shield, ExternalLink,
  Crown, Zap, Clock, CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { stripe } from '@/lib/api-client';
import { SEOHead } from '@/components/SEOHead';
import { toast } from 'sonner';

export default function Account() {
  const { user } = useAuth();
  const { subscription, loading: subLoading, isTrialActive, trialDaysRemaining, refreshSubscription } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await stripe.createPortal();
      if (response.error) throw new Error(response.error);
      const url = (response.data as any)?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error: any) {
      // If no Stripe customer exists, direct to pricing
      if (error.message.includes('No Stripe customer')) {
        toast.info('Set up your subscription to manage billing.');
        window.location.href = '/pricing';
      } else {
        toast.error(error.message || 'Failed to open subscription portal');
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const subTier = (subscription as any)?.subscription_tier || 'Free';
  const subEnd = (subscription as any)?.subscription_end;
  const isSubscribed = (subscription as any)?.subscribed;

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <SEOHead title="Account Settings" noIndex={true} />

      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-8 max-w-3xl">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-muted-foreground font-light">Manage your profile and subscription</p>
        </section>

        {/* Profile Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">
                  {user?.email?.slice(0, 2).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="font-semibold">{user?.fullName || 'User'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-primary" /> Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {subLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : (
              <>
                {/* Plan Info */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{subTier}</span>
                      {isTrialActive && (
                        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                          <Clock className="h-3 w-3 mr-1" /> Trial
                        </Badge>
                      )}
                      {isSubscribed && !isTrialActive && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          <CheckCircle className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      )}
                      {!isSubscribed && !isTrialActive && (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    {isTrialActive && trialDaysRemaining != null && (
                      <p className="text-sm text-muted-foreground">
                        {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining in trial
                      </p>
                    )}
                    {subEnd && !isTrialActive && (
                      <p className="text-sm text-muted-foreground">
                        Renews {new Date(subEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Plan Features */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Your plan includes:</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {subTier === 'Elite' || subTier === 'Premium' ? (
                      <>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Unlimited property searches</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Unlimited alert locations</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Advanced AI analysis</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Skip tracing</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Lead scoring</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Priority support</li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Up to 5 alert locations</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> 24-hour updates</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Advanced property matching</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Email notifications</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Basic market analytics</li>
                      </>
                    )}
                  </ul>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {isSubscribed ? (
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                    >
                      <CreditCard className="h-4 w-4" />
                      {portalLoading ? 'Loading...' : 'Manage Billing'}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button className="gap-2 rounded-full" onClick={() => window.location.href = '/pricing'}>
                      <Zap className="h-4 w-4" /> Upgrade Plan
                    </Button>
                  )}
                  {subTier === 'Pro' && isSubscribed && (
                    <Button variant="outline" className="gap-2 rounded-full" onClick={() => window.location.href = '/pricing'}>
                      <Crown className="h-4 w-4" /> Upgrade to Elite
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Your data is encrypted in transit and at rest. We never share your personal information with third parties.</p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.location.href = '/privacy'}>
                Privacy Policy
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.location.href = '/terms'}>
                Terms of Service
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <ChatAssistant />
    </div>
  );
}
