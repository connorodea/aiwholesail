import { useEffect, useState } from 'react';
import { Bell, X, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { alerts } from '@/lib/api-client';
import { SaveSearchAsAlertDialog } from './SaveSearchAsAlertDialog';

const DISMISS_KEY = 'aiw_alert_onboarding_dismissed';

interface AlertOnboardingBannerProps {
  /** Pre-fills the alert form with the user's last searched location, if any */
  suggestedLocation?: string;
}

export function AlertOnboardingBanner({ suggestedLocation = '' }: AlertOnboardingBannerProps) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (checked) return;

    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === 'true') {
        setChecked(true);
        return;
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await alerts.list({ active: true });
        if (cancelled) return;
        const data = (res as any)?.data;
        const list = Array.isArray(data) ? data : data?.alerts || [];
        if (list.length === 0) {
          setShow(true);
        }
      } catch {
        // Silent — banner is non-critical
      } finally {
        setChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, checked]);

  const handleDismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {}
  };

  if (!user || !show) return null;

  return (
    <>
      <div className="relative rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-cyan-500/[0.03] to-transparent p-5 sm:p-6 overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"
        />
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Bell className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold tracking-tight text-white">
                Get notified the moment new deals hit your market
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                <Zap className="h-2.5 w-2.5" />
                New
              </span>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              We scan your markets every hour and email you when properties drop with a spread you care about.
              Skip the daily Zillow refresh.
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
            >
              <Bell className="h-4 w-4" />
              Set up first alert
            </button>
          </div>
        </div>
      </div>

      <SaveSearchAsAlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            // After they create their first alert, hide the banner permanently
            handleDismiss();
          }
        }}
        defaultLocation={suggestedLocation}
      />
    </>
  );
}
