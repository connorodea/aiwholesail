import { useEffect, useRef, useState } from 'react';
import { Lock, ArrowRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { analytics } from '@/lib/analytics';
import { stripe } from '@/lib/api-client';

/**
 * Full-screen blocking modal for users whose trial has expired and who
 * haven't upgraded to a paid plan. No dismiss button — they choose Upgrade
 * or Sign out. Mounts in ProtectedRoute and gates access to /app/*.
 *
 * Logic for showing it:
 *   - User is logged in (auth handled by ProtectedRoute already)
 *   - SubscriptionContext.subscription has trial_end set AND trial_end < now
 *   - subscribed === false (haven't upgraded)
 *
 * Important: never show during initial subscription load to avoid flicker.
 */
export function TrialExpiredModal() {
  const { user, signOut } = useAuth();
  const { subscription, loading } = useSubscription();
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Fallback-redirect timer is held in a ref so the Sign-out path can cancel
  // it. Without this, a user who clicks Sign out during the 1.2s fallback
  // window lands on /pricing instead of /auth (orphaned setTimeout fires
  // after unmount).
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);

  // Derive expired-trial state defensively
  const trialEnd = subscription?.trial_end;
  const subscribed = !!subscription?.subscribed;
  const trialEndPast = !!trialEnd && new Date(trialEnd) < new Date();
  const shouldShow = !!user && !loading && !subscribed && trialEndPast;

  useEffect(() => {
    if (shouldShow) analytics.trialExpired();
  }, [shouldShow]);

  if (!shouldShow) return null;

  // Drop the user straight into Stripe Checkout instead of bouncing through
  // /pricing first. Every extra page is a place to abandon; the modal already
  // shows the price + plan, so the next click should be the card form.
  // Fallback to navigating /pricing on API error so users aren't trapped.
  const handleUpgrade = async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const response = await stripe.createCheckout('Pro');
      if (response.error) {
        throw new Error(response.error);
      }
      const url = (response.data as { url?: string } | undefined)?.url;
      if (url) {
        // Fire the funnel-entry event only after we have a working redirect.
        // Firing on raw click would inflate the conversion-intent rate with
        // network-error / 5xx clicks that never reached Stripe.
        analytics.trialUpgradeClicked('modal');
        window.location.href = url;
        return;
      }
      throw new Error('Checkout session missing redirect URL');
    } catch (err) {
      setCheckoutLoading(false);
      setCheckoutError('Could not start checkout. Redirecting to pricing…');
      // Last-resort fallback so a transient API blip doesn't trap the user.
      // Stored in a ref so Sign-out can cancel it (see useEffect cleanup).
      fallbackTimerRef.current = setTimeout(() => navigate('/pricing'), 1200);
    }
  };

  const handleSignOut = async () => {
    // Cancel any pending "redirect to /pricing" fallback so we don't
    // override the user's choice to leave.
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    try {
      await signOut();
    } finally {
      navigate('/auth');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/20 bg-[#0c0d0f] overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"
        />
        <div className="relative px-6 sm:px-8 pt-8 pb-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-5">
            <Lock className="h-7 w-7 text-cyan-400" />
          </div>
          <h2 id="trial-expired-title" className="text-2xl font-semibold tracking-tight text-white mb-2">
            Your free trial has ended
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed mb-6">
            Upgrade to Pro to restore full access to AI deal scoring, real-time
            alerts, your saved searches, and the deal pipeline. Your account
            stays exactly as you left it — alerts, deals, and history all snap back.
          </p>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 mb-6 text-left">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-white">$49</span>
              <span className="text-sm text-neutral-500">/ month</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                Pro
              </span>
            </div>
            <ul className="space-y-1.5 mt-3 text-xs text-neutral-400">
              <li className="flex items-start gap-2"><span className="text-cyan-400">•</span> AI-powered deal scoring on every property</li>
              <li className="flex items-start gap-2"><span className="text-cyan-400">•</span> Real-time spread alerts in your markets</li>
              <li className="flex items-start gap-2"><span className="text-cyan-400">•</span> Unlimited searches + saved properties</li>
              <li className="flex items-start gap-2"><span className="text-cyan-400">•</span> Deal pipeline + ARV/comps analysis</li>
              <li className="flex items-start gap-2"><span className="text-cyan-400">•</span> Cancel anytime — no contract</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold text-base transition-all shadow-lg shadow-cyan-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {checkoutLoading ? 'Opening secure checkout…' : 'Upgrade to Pro for $49/mo'}
            {!checkoutLoading && <ArrowRight className="h-4 w-4" />}
          </button>
          {checkoutError && (
            <p className="mt-3 text-xs text-red-400" role="alert">{checkoutError}</p>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 h-10 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
