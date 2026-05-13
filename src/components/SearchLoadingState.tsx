import { useEffect, useState } from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { RotatingOrganicLoader } from '@/components/OrganicLoader';

interface SearchLoadingStateProps {
  progress: number;
  status: string;
}

const TIPS = [
  'Each property is cross-checked against its Zestimate to surface real spreads.',
  'Listings with a +$30K gap below market sort to the top automatically.',
  'We pull live MLS data and run AI scoring on every result.',
  'Pro tip: save this search as an alert and we\'ll ping you the moment new deals hit.',
  'Comps are pulled from the most recent sales within a 1-mile radius.',
  'Negative-spread listings are de-prioritized so you see real opportunities first.',
];

export function SearchLoadingState({ progress, status }: SearchLoadingStateProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4500);
    const elapsedTimer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => {
      clearInterval(tipTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  const phaseTitle =
    progress <= 20 ? 'Scanning the market' :
    progress <= 50 ? 'Pulling property data' :
    progress <= 80 ? 'Analyzing listings' :
    progress < 95 ? 'Calculating spreads' :
    'Finalizing results';

  const phaseSubtitle = progress <= 80 ? 'Searching properties' : 'Calculating spreads';

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  };

  return (
    <section className="max-w-xl mx-auto animate-fade-in space-y-4">
      {/* Patience banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/[0.08] via-cyan-500/[0.04] to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ animation: 'shimmer 3s linear infinite', background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.08), transparent)', backgroundSize: '200% 100%' }} />
        <div className="relative flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center" style={{ animation: 'pulse-soft 2s ease-in-out infinite' }}>
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-snug">
              Hang tight — we're crunching through hundreds of listings
            </p>
            <p className="text-xs text-neutral-400 leading-snug mt-0.5">
              This usually takes 30–90 seconds. Big searches can take a couple of minutes.
            </p>
          </div>
          <div className="hidden sm:flex flex-shrink-0 items-center gap-1.5 text-[11px] font-mono text-cyan-400/80 tabular-nums">
            <Clock className="h-3 w-3" />
            {formatElapsed(elapsed)}
          </div>
        </div>
      </div>

      {/* Main loader card */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#0c0d0f] p-8 sm:p-12">
        {/* Ambient gradient + scan line */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-cyan-500/10" style={{ animation: 'loadingGlow 3s ease-in-out infinite alternate' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />
        </div>

        {/* Soft radar sweep behind icon */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-40 h-40 pointer-events-none" aria-hidden>
          <div className="absolute inset-0 rounded-full border border-cyan-400/10" style={{ animation: 'ripple 3s ease-out infinite' }} />
          <div className="absolute inset-0 rounded-full border border-cyan-400/10" style={{ animation: 'ripple 3s ease-out 1s infinite' }} />
          <div className="absolute inset-0 rounded-full border border-cyan-400/10" style={{ animation: 'ripple 3s ease-out 2s infinite' }} />
        </div>

        <div className="relative z-10 space-y-8">
          {/* Rotating organic loader — picks a different real-estate-themed
              animation on each search start (house, pin drop, radar sweep,
              sold stamp, bricks, key, coins, equity ring, etc.) so the
              wait feels intentional and on-brand. */}
          <div className="flex justify-center text-white">
            <RotatingOrganicLoader category="realestate" size={120} aria-label="Searching properties" />
          </div>

          {/* Status text */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-white tracking-tight">{phaseTitle}</h3>
            <p className="text-sm text-neutral-400 min-h-[20px]">{status}</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-3">
            <div className="relative w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #06b6d4, #22d3ee, #06b6d4)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s linear infinite',
                  boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                }}
              />
              {/* Leading edge pulse */}
              {progress > 0 && progress < 100 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-300 transition-all duration-700 ease-out"
                  style={{
                    left: `calc(${progress}% - 6px)`,
                    boxShadow: '0 0 12px rgba(34, 211, 238, 0.9), 0 0 20px rgba(6, 182, 212, 0.5)',
                    animation: 'pulse-soft 1.5s ease-in-out infinite',
                  }}
                />
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-cyan-400/80 tabular-nums">{Math.round(progress)}%</span>
              <span className="text-xs text-neutral-500">{phaseSubtitle}</span>
            </div>
          </div>

          {/* Animated step indicators */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Search', threshold: 0 },
              { label: 'Fetch', threshold: 25 },
              { label: 'Analyze', threshold: 60 },
              { label: 'Score', threshold: 85 },
            ].map((step, i) => {
              const active = progress >= step.threshold;
              const current = active && progress < (i < 3 ? [0,25,60,85][i+1] : 100);
              return (
                <div key={i} className="text-center">
                  <div className={`relative w-full h-1 rounded-full mb-1.5 transition-all duration-500 overflow-hidden ${active ? 'bg-cyan-400' : 'bg-white/[0.06]'}`}>
                    {current && (
                      <div className="absolute inset-0 bg-cyan-200/60" style={{ animation: 'shimmer 1.2s linear infinite', backgroundSize: '200% 100%' }} />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium transition-colors duration-300 ${active ? 'text-cyan-400' : 'text-neutral-600'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rotating tip */}
          <div className="min-h-[40px] flex items-center justify-center">
            <p key={tipIndex} className="text-[12px] text-neutral-400 text-center leading-relaxed max-w-md animate-fade-in">
              <span className="text-cyan-400/70 mr-1.5">&bull;</span>
              {TIPS[tipIndex]}
            </p>
          </div>

          {/* Mobile elapsed time */}
          <div className="sm:hidden text-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 tabular-nums">
              <Clock className="h-3 w-3" />
              {formatElapsed(elapsed)} elapsed
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes loadingGlow {
          0% { opacity: 0.15; }
          100% { opacity: 0.35; }
        }
        @keyframes scanLine {
          0% { transform: translateX(-50%) translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(-50%) translateY(400px); opacity: 0; }
        }
        @keyframes ripple {
          0% { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.95); }
        }
      `}</style>
    </section>
  );
}
