import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, LogOut } from 'lucide-react';

// Auth-related localStorage keys — kept in sync with src/lib/api-client.ts
// `tokenStorage`. Hoisted here so the error-boundary recovery CTA can purge
// them without importing the full api-client module (which transitively pulls
// fetch/feature-flag setup into the boundary's bundle).
const AUTH_STORAGE_KEYS = [
  'aiwholesail_access_token',
  'aiwholesail_refresh_token',
  'aiwholesail_user',
];

/**
 * Clear auth state and force a fresh sign-in. Wired to the secondary CTA on
 * the error-boundary fallback so users stuck in an unrecoverable render-loop
 * (e.g. 401 storm with corrupted token state) have a self-service exit.
 *
 * Uses location.href (not navigate) on purpose — we want a HARD page reload
 * so React's module/state singletons (AuthContext cache, query cache,
 * feature-flag cache) all reset. A soft navigate would re-mount the same
 * crashing component tree with the same stale state.
 */
function resetSessionAndSignIn() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  for (const key of AUTH_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* quota-exceeded / iOS ITP */ }
  }
  window.location.href = '/auth?mode=signin';
}

/**
 * React error boundary.
 *
 * The aiwholesail codebase had ZERO error boundaries before this file —
 * confirmed via `grep -rln "ErrorBoundary" src/` returning nothing. That
 * meant any uncaught render error (e.g. naked dereference on a missing
 * Claude response field in AIWholesaleAnalyzer) propagated up to the root,
 * React 18 unmounted the entire tree, and the page went fully black
 * because the body bg `#08090a` was all that remained visible.
 *
 * Wrap any subtree you don't want to take down the whole app with this.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomethingThatMightThrow />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<MyCustomFallback />}>
 *     ...
 *   </ErrorBoundary>
 *
 * Errors are logged to console with the `[ErrorBoundary]` prefix so
 * production can grep for them in browser logs the user shares.
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label for log messages — helps identify which boundary caught it. */
  label?: string;
  /** Optional callback invoked when an error is caught. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Single point of truth for render errors — paste this whole line when
    // reporting a bug and the maintainer has a stack to work from.
    // Prefixed for grep-ability.
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`,
      error,
      info.componentStack
    );
    this.props.onError?.(error, info);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-6 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-100 mb-1">
              Something went wrong on this page
            </h3>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Don't worry — the rest of the app is unaffected. Try refreshing this view first. If the error keeps happening (or you came from a "session expired" toast), use "Sign out & reset" to clear stuck auth state and start fresh. Error details are in your browser console.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={this.retry}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try again
              </button>
              <button
                type="button"
                onClick={resetSessionAndSignIn}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 hover:bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out &amp; reset
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
