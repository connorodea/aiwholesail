import { useState } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  User, Mail, CreditCard, Calendar, Shield, ExternalLink,
  Crown, Zap, Clock, CheckCircle, Pencil, X, Check,
  BarChart3, MapPin, Brain, AlertTriangle, Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { auth, stripe } from '@/lib/api-client';
import { SEOHead } from '@/components/SEOHead';
import { toast } from 'sonner';

export default function Account() {
  const { user, signOut } = useAuth();
  const { subscription, loading: subLoading, isTrialActive, trialDaysRemaining, refreshSubscription } = useSubscription();

  const [portalLoading, setPortalLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.fullName || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Subscription info
  const subTier = (subscription as any)?.subscription_tier || 'Free';
  const subEnd = (subscription as any)?.subscription_end;
  const isSubscribed = (subscription as any)?.subscribed;
  const trialEnd = (subscription as any)?.trial_end;

  // Usage limits based on tier
  const isElite = subTier === 'Elite' || subTier === 'Premium';
  const isPro = subTier === 'Pro';
  const dailySearchLimit = isElite ? Infinity : 10;
  const alertLocationLimit = isElite ? Infinity : isPro ? 5 : 1;
  const hasAiAnalysis = isElite;

  // Mock current usage (would come from API in production)
  const dailySearchesUsed = 0;
  const alertLocationsUsed = 0;

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

  const handleSaveName = async () => {
    if (!nameValue.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setNameLoading(true);
    try {
      const response = await auth.updateProfile(nameValue.trim());
      if (response.error) throw new Error(response.error);
      toast.success('Name updated successfully');
      setEditingName(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update name');
    } finally {
      setNameLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteEmail.trim()) {
      toast.error('Please enter your email to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      const response = await auth.deleteAccount(deleteEmail.trim());
      if (response.error) throw new Error(response.error);
      toast.success('Account deleted successfully');
      await signOut();
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const tierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'Elite':
      case 'Premium':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Pro':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <SEOHead title="Account Settings" noIndex={true} />

      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-8 max-w-3xl">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-muted-foreground font-light">Manage your profile, subscription, and usage</p>
        </section>

        {/* ─── 1. Profile Section ─── */}
        <Card className="border-border/50 bg-[#0f1115]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-cyan-400" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-cyan-400">
                  {user?.email?.slice(0, 2).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="h-8 bg-[#1a1d24] border-border/50 text-white max-w-[240px]"
                      placeholder="Your name"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') {
                          setEditingName(false);
                          setNameValue(user?.fullName || '');
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={handleSaveName}
                      disabled={nameLoading}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-500/10"
                      onClick={() => { setEditingName(false); setNameValue(user?.fullName || ''); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{user?.fullName || 'User'}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10"
                      onClick={() => { setNameValue(user?.fullName || ''); setEditingName(true); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" /> {user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── 2. Subscription Section ─── */}
        <Card className="border-border/50 bg-[#0f1115]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-cyan-400" /> Subscription
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
                {/* Plan + Status */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl font-bold">{subTier}</span>
                      <Badge className={tierBadgeColor(subTier)}>
                        {isElite ? <Crown className="h-3 w-3 mr-1" /> : isPro ? <Zap className="h-3 w-3 mr-1" /> : null}
                        {subTier}
                      </Badge>
                      {isTrialActive && (
                        <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                          <Clock className="h-3 w-3 mr-1" /> Trial
                        </Badge>
                      )}
                      {isSubscribed && !isTrialActive && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <CheckCircle className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      )}
                      {!isSubscribed && !isTrialActive && (
                        <Badge variant="outline" className="text-zinc-500 border-zinc-700">Inactive</Badge>
                      )}
                    </div>

                    {/* Trial end date */}
                    {isTrialActive && trialDaysRemaining != null && trialEnd && (
                      <div className="space-y-0.5">
                        <p className="text-sm text-orange-400">
                          {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining in trial
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Trial ends {new Date(trialEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    )}

                    {/* Subscription renewal date */}
                    {subEnd && !isTrialActive && isSubscribed && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Renews {new Date(subEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="bg-border/30" />

                {/* Plan Features */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Your plan includes:</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {isElite ? (
                      <>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Unlimited property searches</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Unlimited alert locations</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Advanced AI analysis</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Skip tracing</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Lead scoring</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Priority support</li>
                      </>
                    ) : isPro ? (
                      <>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> 10 searches per day</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Up to 5 alert locations</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Advanced property matching</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Email notifications</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> Basic market analytics</li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-center gap-2 text-zinc-500"><X className="h-3.5 w-3.5" /> No active subscription</li>
                        <li className="flex items-center gap-2 text-zinc-500"><X className="h-3.5 w-3.5" /> Upgrade to unlock features</li>
                      </>
                    )}
                  </ul>
                </div>

                <Separator className="bg-border/30" />

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {isSubscribed ? (
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full border-border/50 hover:border-cyan-500/50 hover:text-cyan-400"
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                    >
                      <CreditCard className="h-4 w-4" />
                      {portalLoading ? 'Loading...' : 'Manage Billing'}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      className="gap-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white"
                      onClick={() => window.location.href = '/pricing'}
                    >
                      <Zap className="h-4 w-4" /> Upgrade Plan
                    </Button>
                  )}
                  {isPro && isSubscribed && (
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50"
                      onClick={() => window.location.href = '/pricing'}
                    >
                      <Crown className="h-4 w-4" /> Upgrade to Elite
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── 3. Usage & Limits ─── */}
        <Card className="border-border/50 bg-[#0f1115]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-cyan-400" /> Usage & Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {subLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                {/* Daily Searches */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <BarChart3 className="h-4 w-4 text-cyan-400" />
                      Daily Searches
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {isElite ? (
                        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">Unlimited</Badge>
                      ) : (
                        `${dailySearchesUsed} / ${dailySearchLimit}`
                      )}
                    </span>
                  </div>
                  {!isElite && (
                    <Progress
                      value={dailySearchLimit > 0 ? (dailySearchesUsed / dailySearchLimit) * 100 : 0}
                      className="h-2 bg-[#1a1d24] [&>div]:bg-cyan-500"
                    />
                  )}
                </div>

                <Separator className="bg-border/30" />

                {/* Alert Locations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      Alert Locations
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {isElite ? (
                        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">Unlimited</Badge>
                      ) : (
                        `${alertLocationsUsed} / ${alertLocationLimit}`
                      )}
                    </span>
                  </div>
                  {!isElite && (
                    <Progress
                      value={alertLocationLimit > 0 ? (alertLocationsUsed / alertLocationLimit) * 100 : 0}
                      className="h-2 bg-[#1a1d24] [&>div]:bg-cyan-500"
                    />
                  )}
                </div>

                <Separator className="bg-border/30" />

                {/* AI Analysis */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Brain className="h-4 w-4 text-cyan-400" />
                    AI Analysis
                  </div>
                  {hasAiAnalysis ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Available
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-500/10 text-zinc-500 border-zinc-700 text-xs">
                      <X className="h-3 w-3 mr-1" /> Locked
                    </Badge>
                  )}
                </div>

                {!isSubscribed && (
                  <>
                    <Separator className="bg-border/30" />
                    <p className="text-xs text-muted-foreground text-center">
                      <a href="/pricing" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                        Upgrade your plan
                      </a>{' '}
                      to unlock higher limits and AI features.
                    </p>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Security Card ─── */}
        <Card className="border-border/50 bg-[#0f1115]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-cyan-400" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Your data is encrypted in transit and at rest. We never share your personal information with third parties.</p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="rounded-full border-border/50" onClick={() => window.location.href = '/privacy'}>
                Privacy Policy
              </Button>
              <Button variant="outline" size="sm" className="rounded-full border-border/50" onClick={() => window.location.href = '/terms'}>
                Terms of Service
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── 4. Danger Zone ─── */}
        <Card className="border-red-900/30 bg-[#0f1115]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-red-400">
              <AlertTriangle className="h-5 w-5" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all associated data. This action is irreversible.
              All your leads, alerts, favorites, contracts, and subscription data will be permanently removed.
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-red-900/50 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" /> Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#0f1115] border-red-900/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Delete Account
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      This will permanently delete your account and all data. This cannot be undone.
                    </p>
                    <p className="text-red-400/80 font-medium">
                      You will lose all leads, alerts, favorites, contracts, sequences, and subscription data.
                    </p>
                    <div className="pt-2">
                      <label className="text-xs text-muted-foreground block mb-1.5">
                        Type your email <strong className="text-white">{user?.email}</strong> to confirm:
                      </label>
                      <Input
                        value={deleteEmail}
                        onChange={(e) => setDeleteEmail(e.target.value)}
                        placeholder={user?.email || 'your@email.com'}
                        className="bg-[#1a1d24] border-red-900/30 text-white"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    className="rounded-full border-border/50"
                    onClick={() => setDeleteEmail('')}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-full bg-red-600 hover:bg-red-500 text-white border-0"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAccount();
                    }}
                    disabled={deleteLoading || deleteEmail.toLowerCase().trim() !== user?.email?.toLowerCase()}
                  >
                    {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>

      <ChatAssistant />
    </div>
  );
}
