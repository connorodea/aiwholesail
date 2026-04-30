/**
 * Loading components for AIWholesail.
 *
 * Usage:
 *   <LoadingSpinner />                  — default glowing ring
 *   <LoadingSpinner variant="dots" />   — bouncing dots (typing indicator)
 *   <LoadingLogo />                     — brand mark with pulse glow
 *   <FullPageLoader />                  — full-screen dark overlay
 */

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

interface SpinnerProps {
  /** Visual variant */
  variant?: 'default' | 'dots';
  /** Tailwind size class applied to the outer wrapper (e.g. "h-8 w-8") */
  size?: string;
  /** Additional class names */
  className?: string;
}

interface LoadingLogoProps {
  className?: string;
}

interface FullPageLoaderProps {
  /** Optional message shown below the spinner */
  message?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  1. LoadingSpinner — default (ring) and dots variants               */
/* ------------------------------------------------------------------ */

export function LoadingSpinner({
  variant = 'default',
  size,
  className,
}: SpinnerProps) {
  if (variant === 'dots') {
    return <BouncingDots className={className} />;
  }

  return <GlowingRing size={size} className={className} />;
}

/* ------------------------------------------------------------------ */
/*  Glowing Ring                                                       */
/* ------------------------------------------------------------------ */

function GlowingRing({
  size = 'h-10 w-10',
  className,
}: {
  size?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', size, className)}
      role="status"
      aria-label="Loading"
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse"
        style={{ animationDuration: '2s' }}
      />

      {/* Spinning ring with gradient */}
      <svg
        className="animate-spin"
        style={{ animationDuration: '1.1s' }}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="spinner-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--primary))" />
            <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle
          cx="20"
          cy="20"
          r="17"
          stroke="url(#spinner-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="80 27"
        />
      </svg>

      {/* Center dot */}
      <div className="absolute w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />

      <span className="sr-only">Loading</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bouncing Dots                                                      */
/* ------------------------------------------------------------------ */

function BouncingDots({ className }: { className?: string }) {
  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      role="status"
      aria-label="Loading"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-2 h-2 rounded-full bg-primary"
          style={{
            animation: 'aiwholesail-bounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}

      {/* Keyframes injected once via a <style> tag */}
      <style>{`
        @keyframes aiwholesail-bounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      <span className="sr-only">Loading</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. LoadingLogo — brand mark with pulsing glow                      */
/* ------------------------------------------------------------------ */

export function LoadingLogo({ className }: LoadingLogoProps) {
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="status"
      aria-label="Loading"
    >
      {/* Pulsing glow ring */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          animation: 'aiwholesail-logo-glow 2.5s ease-in-out infinite',
          boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)',
        }}
      />

      {/* Subtle radial glow behind the mark */}
      <div
        className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse"
        style={{ animationDuration: '3s' }}
      />

      {/* Brand mark */}
      <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-background border border-border/50 shadow-lg">
        <span className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary via-cyan-400 to-primary bg-clip-text text-transparent select-none">
          AW
        </span>
      </div>

      <style>{`
        @keyframes aiwholesail-logo-glow {
          0% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.35);
          }
          50% {
            box-shadow: 0 0 24px 8px hsl(var(--primary) / 0.15);
          }
          100% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.35);
          }
        }
      `}</style>

      <span className="sr-only">Loading</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. FullPageLoader — overlay with gradient orb + spinner            */
/* ------------------------------------------------------------------ */

export function FullPageLoader({
  message = 'Loading...',
  className,
}: FullPageLoaderProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A]',
        className,
      )}
      role="status"
      aria-label={message}
    >
      {/* Background gradient orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-primary/15 via-cyan-500/8 to-transparent rounded-full blur-[120px] animate-pulse pointer-events-none"
        style={{ animationDuration: '4s' }}
        aria-hidden="true"
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Spinner */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Outer ring (slow, large) */}
        <div className="relative">
          <div className="h-16 w-16">
            <svg
              className="animate-spin h-full w-full"
              style={{ animationDuration: '1.4s' }}
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="fp-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop stopColor="hsl(var(--primary))" />
                  <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                  <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="url(#fp-gradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="130 46"
              />
            </svg>
          </div>

          {/* Inner glowing dot */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_4px_hsl(var(--primary)/0.4)] animate-pulse"
            style={{ animationDuration: '1.5s' }}
          />
        </div>

        {/* Text */}
        <p
          className="text-sm font-medium text-zinc-500 tracking-wide animate-pulse"
          style={{ animationDuration: '2s' }}
        >
          {message}
        </p>
      </div>

      <span className="sr-only">{message}</span>
    </div>
  );
}
