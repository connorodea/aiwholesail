import { useEffect, useState } from 'react';
import { Clock, X, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { analytics } from '@/lib/analytics';

/**
 * Persistent banner shown to trial users with ≤3 days remaining.
 * Dismiss key includes the day count so the banner re-shows when the count changes
 * (e.g. dismissed at 3 days → re-appears at 2 days).
 */
export function TrialCountdownBanner() {
  const { user } = useAuth();
  const { isTrialActive, trialDaysRemaining } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const days = trialDaysRemaining ?? null;
  const dismissKey =
    user && days != null ? `aiw_trial_countdown_dismissed_${user.id}_${days}` : null;

  useEffect(() => {
    if (!dismissKey) return;
    try {
      setDismissed(localStorage.getItem(dismissKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  // Fire impression event once per (user, days) — must be unconditionally
  // declared (Rules of Hooks) so it sits before the early return.
  useEffect(() => {
    if (user && isTrialActive && days != null && days <= 3 && !dismissed) {
      analytics.trialCountdownBannerShown(days);
    }
  }, [user, isTrialActive, days, dismissed]);

  // Don't render if no trial, no auth, no day count, or > 3 days, or dismissed
  if (!user || !isTrialActive || days == null || days > 3 || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissKey) {
      try { localStorage.setItem(dismissKey, '1'); } catch {}
    }
  };

  const handleUpgrade = () => {
    analytics.trialUpgradeClicked('banner');
    navigate('/pricing');
  };

  const urgencyTone = days <= 1
    ? { ring: 'border-amber-500/30', glow: 'bg-amber-500/10', icon: 'text-amber-400', iconBg: 'bg-amber-500/15', iconBorder: 'border-amber-500/30' }
    : { ring: 'border-cyan-500/20', glow: 'bg-cyan-500/10', icon: 'text-cyan-400', iconBg: 'bg-cyan-500/15', iconBorder: 'border-cyan-500/30' };

  return (
    <div className={`relative rounded-2xl border ${urgencyTone.ring} bg-gradient-to-br from-cyan-500/[0.06] via-cyan-500/[0.02] to-transparent p-5 sm:p-6 overflow-hidden`}>
      <div aria-hidden className={`absolute -top-12 -right-12 w-48 h-48 rounded-full ${urgencyTone.glow} blur-3xl pointer-events-none`} />
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
        <div className={`w-11 h-11 rounded-xl ${urgencyTone.iconBg} border ${urgencyTone.iconBorder} flex items-center justify-center flex-shrink-0`}>
          <Clock className={`h-5 w-5 ${urgencyTone.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold tracking-tight text-white">
              {days === 0 ? 'Your trial ends today' :
               days === 1 ? 'Your trial ends tomorrow' :
               `${days} days left in your free trial`}
            </h3>
            {days <= 1 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                <Zap className="h-2.5 w-2.5" />
                Ending soon
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Lock in $49/month to keep your alerts, AI deal scoring, and saved searches.
            No card was needed for the trial — adding one now keeps everything running.
          </p>
        </div>
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={handleUpgrade}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
          >
            Upgrade to Pro
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
