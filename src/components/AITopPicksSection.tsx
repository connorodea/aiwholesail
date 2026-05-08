import { useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Property } from '@/types/zillow';
import { ai } from '@/lib/api-client';
import { toast } from 'sonner';

type DealLabel = 'strong_buy' | 'solid' | 'caution' | 'avoid';

interface RankedDeal {
  id: string;
  ai_score: number;
  label: DealLabel;
  rationale: string;
  red_flags: string[];
  motivated_signals: string[];
}

const LABEL_STYLES: Record<DealLabel, { bg: string; text: string; border: string; label: string }> = {
  strong_buy: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', label: 'Strong buy' },
  solid: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30', label: 'Solid' },
  caution: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', label: 'Caution' },
  avoid: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', label: 'Avoid' },
};

interface AITopPicksSectionProps {
  properties: Property[];
  onSelectProperty: (p: Property) => void;
}

export function AITopPicksSection({ properties, onSelectProperty }: AITopPicksSectionProps) {
  const [running, setRunning] = useState(false);
  const [ranked, setRanked] = useState<RankedDeal[] | null>(null);
  const [expanded, setExpanded] = useState(true);

  const runAI = async () => {
    const candidates = properties
      .filter(p => p.price && p.zestimate && p.zestimate > p.price)
      .sort((a, b) => (b.zestimate! - b.price) - (a.zestimate! - a.price))
      .slice(0, 25);

    if (candidates.length === 0) {
      toast.error('No properties with positive spread to evaluate');
      return;
    }

    setRunning(true);
    try {
      const response = await ai.rankDeals(candidates);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      const list = response.data?.ranked_deals || [];
      setRanked(list);
      const strongCount = list.filter(d => d.label === 'strong_buy' || d.label === 'solid').length;
      toast.success(`AI found ${strongCount} strong picks out of ${candidates.length} candidates`);
    } catch (err: any) {
      toast.error(err.message || 'AI ranking failed');
    } finally {
      setRunning(false);
    }
  };

  if (!ranked) {
    const eligibleCount = properties.filter(p => p.price && p.zestimate && p.zestimate > p.price).length;
    if (eligibleCount === 0) return null;

    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-cyan-500/[0.02] to-transparent p-5 sm:p-6 relative overflow-hidden">
        <div aria-hidden className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-white mb-1">
              Filter top {Math.min(eligibleCount, 25)} spreads through AI
            </h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              We&rsquo;ll read each property&rsquo;s description for motivated-seller language and condition red flags
              (fire damage, structural, teardown). Surfaces real deals; flags false-positive spreads.
            </p>
          </div>
          <button
            type="button"
            onClick={runAI}
            disabled={running}
            className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-black font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run AI top picks
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const propertyById = new Map(properties.map(p => [p.id, p]));
  const enriched = ranked
    .map(r => ({ rank: r, prop: propertyById.get(r.id) }))
    .filter(x => !!x.prop) as { rank: RankedDeal; prop: Property }[];

  const strongCount = enriched.filter(x => x.rank.label === 'strong_buy' || x.rank.label === 'solid').length;

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-transparent overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-white">AI Top Picks</p>
            <p className="text-xs text-neutral-500 truncate">
              {strongCount} strong picks · {enriched.length} candidates evaluated
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-neutral-500">
          <span className="text-xs hidden sm:inline">{expanded ? 'Hide' : 'Show'}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05] px-5 sm:px-6 py-5 space-y-2.5">
          {enriched.map(({ rank, prop }) => {
            const style = LABEL_STYLES[rank.label];
            const spread = prop.zestimate && prop.price ? prop.zestimate - prop.price : 0;
            return (
              <button
                key={prop.id}
                type="button"
                onClick={() => onSelectProperty(prop)}
                className="w-full text-left flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${style.bg} border ${style.border} flex flex-col items-center justify-center flex-shrink-0`}>
                  <span className={`text-base font-bold tabular-nums leading-none ${style.text}`}>{rank.ai_score}</span>
                  <span className="text-[8px] uppercase tracking-wider text-neutral-500 mt-0.5">score</span>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{prop.address || 'Unknown address'}</p>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-snug">{rank.rationale}</p>
                  {(rank.motivated_signals.length > 0 || rank.red_flags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {rank.motivated_signals.map((s, i) => (
                        <span
                          key={`m-${i}`}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/90 border border-emerald-500/20"
                        >
                          <TrendingUp className="h-2.5 w-2.5" />
                          {s}
                        </span>
                      ))}
                      {rank.red_flags.map((f, i) => (
                        <span
                          key={`f-${i}`}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/90 border border-red-500/20"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">
                    +${(spread / 1000).toFixed(0)}K
                  </p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">spread</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
