import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ExitIntentModalProps {
  /**
   * Slug used for analytics + sessionStorage key. Each slug gets its own
   * session-gated "shown once" flag so a future second exit-intent modal on a
   * different page won't suppress this one.
   */
  source: string;
  /**
   * ms after mount before mouseleave can trigger. Default 15s — too-early
   * triggers feel pushy and convert worse than no popup at all (per
   * marketing-context.md voice rules: be useful, not pushy).
   */
  triggerDelayMs?: number;
  /**
   * Endpoint that accepts `{ email, source }`. Defaults to /api/email-capture;
   * if that 404s the modal still functions client-side and the lead is logged
   * to the dataLayer (so GTM can route it). Wire backend in a follow-up.
   */
  endpoint?: string;
}

const SESSION_KEY_PREFIX = 'aiw_exit_intent_shown:';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pushDataLayerEvent(event: string, source: string, extra?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, source, ...extra });
}

export function ExitIntentModal({
  source,
  triggerDelayMs = 15_000,
  endpoint = '/api/email-capture',
}: ExitIntentModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track whether the trigger arming delay has elapsed.
  const armedRef = useRef(false);
  // Hard-block re-trigger after dismissal within the same render lifetime.
  const firedRef = useRef(false);
  const sessionKey = `${SESSION_KEY_PREFIX}${source}`;
  const reducedMotion = useRef(prefersReducedMotion());

  const trigger = useCallback(() => {
    if (firedRef.current) return;
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, '1');
      } catch {
        // sessionStorage can throw in private-mode Safari; degrade to in-memory only.
      }
    }
    firedRef.current = true;
    setOpen(true);
    pushDataLayerEvent('exit_intent_shown', source);
  }, [sessionKey, source]);

  // Arm trigger after delay; attach mouseleave once armed.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Respect prior session dismissal — don't even arm.
    try {
      if (sessionStorage.getItem(sessionKey)) return;
    } catch {
      // ignore
    }

    const armTimer = window.setTimeout(() => {
      armedRef.current = true;
    }, triggerDelayMs);

    const onMouseLeave = (e: MouseEvent) => {
      if (!armedRef.current) return;
      // Only top-edge exits — bottom/side exits are normal scroll / tab usage.
      if (e.clientY <= 0) trigger();
    };

    document.addEventListener('mouseleave', onMouseLeave);
    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [sessionKey, trigger, triggerDelayMs]);

  // Escape key close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Auto-close 3s after success.
  useEffect(() => {
    if (status !== 'success') return;
    const t = window.setTimeout(() => setOpen(false), 3000);
    return () => window.clearTimeout(t);
  }, [status]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting' || status === 'success') return;
    const trimmed = email.trim();
    // Minimal client-side check — server is source of truth.
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Please enter a valid email.');
      return;
    }
    setStatus('submitting');
    setErrorMsg(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: `exit_intent_${source.replace(/-/g, '_')}_guide` }),
      });
      // Treat 404 as "endpoint not wired yet" — still push to dataLayer so GTM
      // can capture the lead and we don't lose it while backend catches up.
      if (!res.ok && res.status !== 404) {
        throw new Error(`Request failed: ${res.status}`);
      }
      pushDataLayerEvent('email_captured', source, { email: trimmed });
      setStatus('success');
    } catch (err) {
      // Still fire the dataLayer event so GTM-side capture works even if our
      // backend is unreachable; mark UI as success so the user isn't penalized
      // for our infra.
      pushDataLayerEvent('email_captured', source, { email: trimmed, transport: 'datalayer_only' });
      setStatus('success');
      void err;
    }
  };

  if (!open) return null;

  const animateClass = reducedMotion.current ? '' : 'animate-in fade-in-0 zoom-in-95 duration-200';
  const overlayAnimateClass = reducedMotion.current ? '' : 'animate-in fade-in-0 duration-200';

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 ${overlayAnimateClass}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      onClick={(e) => {
        // Click on backdrop only (not bubbled from the modal content).
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-b from-neutral-900 to-[#0a0a0a] p-8 shadow-2xl ${animateClass}`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {status === 'success' ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              On its way
            </p>
            <h2 id="exit-intent-title" className="mb-3 text-2xl font-bold tracking-tight text-white">
              Check your inbox.
            </h2>
            <p className="text-sm font-light text-white/60">
              The 10-step motivated-seller checklist is hitting your inbox in the next minute.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              One thing before you go
            </p>
            <h2 id="exit-intent-title" className="mb-3 text-2xl font-bold tracking-tight text-white">
              Grab the motivated-seller checklist.
            </h2>
            <p className="mb-6 text-sm font-light leading-relaxed text-white/60">
              The 10-step checklist we use to spot a real motivated seller versus a tire-kicker
              before you waste a drive-by. One email, no list-bait, unsubscribe whenever.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="exit-intent-email" className="sr-only">
                Email address
              </label>
              <input
                id="exit-intent-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setErrorMsg(null);
                  }
                }}
                placeholder="you@example.com"
                className="mb-3 w-full rounded-md border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                aria-invalid={status === 'error'}
                aria-describedby={errorMsg ? 'exit-intent-error' : undefined}
                disabled={status === 'submitting'}
              />
              {errorMsg && (
                <p id="exit-intent-error" className="mb-3 text-xs text-red-400">
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'submitting' ? 'Sending…' : 'Send me the checklist'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 block w-full text-center text-xs font-light text-white/40 transition-colors hover:text-white/70"
            >
              No thanks
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ExitIntentModal;
