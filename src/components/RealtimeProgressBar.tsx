import { useEffect, useState } from 'react';

interface Props {
  /** 0-100 — must reflect the actual search/enrichment progress. */
  progress: number;
  /** Optional raw status string from the search pipeline. */
  status?: string;
  /** Compact variant for use inside a horizontal banner. Default false (full width). */
  compact?: boolean;
}

/**
 * Real-time progress bar synced to the property search pipeline.
 *
 * Three composed effects make it feel "alive":
 *  1. Filled gradient with an infinite shimmer sliding across it
 *  2. A pulsing leading-edge dot that glows and slightly breathes
 *  3. A smooth number ticker — the displayed % eases toward the true value
 *     instead of jumping, which masks irregular tick intervals from the
 *     upstream Zillow proxy
 *
 * Phase auto-derives from the progress range so callers don't need to pass
 * extra props, but matches the actual phases in RealEstateWholesaler:
 *   0-20  → Searching   (initial Zillow page fetches starting)
 *   20-80 → Fetching    (paging through every result)
 *   80-99 → Calculating (zestimate enrichment, spreads computing)
 *   100   → Done
 */
export function RealtimeProgressBar({ progress, status, compact = false }: Props) {
  const target = Math.max(0, Math.min(100, progress));

  // Smooth-easing ticker — the displayed number chases the target on rAF
  // so we never jump in big chunks. Looks state-of-the-art and hides the
  // discrete progress jumps from the upstream pipeline.
  const [displayed, setDisplayed] = useState(target);
  useEffect(() => {
    let raf = 0;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setDisplayed(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.4) return target;
        return prev + diff * 0.18;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [target]);

  const phase =
    target < 20 ? 'Searching'   :
    target < 80 ? 'Fetching'    :
    target < 100 ? 'Calculating' :
    'Done';

  // Phase color shifts subtly so the eye notices when we move stages.
  const phaseColor =
    phase === 'Searching'   ? 'text-cyan-300/70'  :
    phase === 'Fetching'    ? 'text-cyan-300'     :
    phase === 'Calculating' ? 'text-emerald-300'  :
                              'text-emerald-400';

  return (
    <div className={compact ? 'w-36 sm:w-44 space-y-1.5 shrink-0' : 'space-y-2'}>
      <div className="relative h-1.5 bg-cyan-950/40 rounded-full overflow-hidden">
        {/* Background ambient shimmer — runs even on the empty track so the
            bar feels alive at 0% while the first Zillow page is loading. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0, 196, 200,0.25), transparent)',
            backgroundSize: '200% 100%',
            animation: 'rpb-shimmer 4s linear infinite',
          }}
        />

        {/* Filled portion — gradient + shimmer + soft outer glow. */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${target}%`,
            background: 'linear-gradient(90deg, #00a0a4, #00c4c8, #5de3e7, #00c4c8, #00a0a4)',
            backgroundSize: '200% 100%',
            animation: 'rpb-shimmer 1.8s linear infinite',
            transition: 'width 700ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 12px rgba(0, 196, 200, 0.55), 0 0 24px rgba(0, 196, 200, 0.25)',
          }}
        />

        {/* Leading-edge pulse — only renders while in motion. */}
        {target > 1 && target < 99.5 && (
          <div
            aria-hidden
            className="absolute top-1/2 h-2.5 w-2.5 rounded-full bg-cyan-100"
            style={{
              left: `calc(${target}% - 5px)`,
              transform: 'translateY(-50%)',
              transition: 'left 700ms cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 0 8px rgba(207, 250, 254, 1), 0 0 18px rgba(0, 196, 200, 0.7)',
              animation: 'rpb-pulse 1.4s ease-in-out infinite',
            }}
          />
        )}
      </div>

      <div className="flex justify-between items-baseline text-[10px] gap-2">
        <span className={`tracking-wider uppercase font-semibold truncate ${phaseColor}`} title={status}>
          {phase}
        </span>
        <span className="text-cyan-200 font-mono tabular-nums font-semibold shrink-0">
          {Math.round(displayed)}%
        </span>
      </div>

      <style>{`
        @keyframes rpb-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes rpb-pulse {
          0%, 100% { transform: translateY(-50%) scale(1);   opacity: 1; }
          50%      { transform: translateY(-50%) scale(1.35); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
