import { useToast } from '@/hooks/use-toast';
import type { LeadType } from '@/lib/lead-types';
import {
  AlertTriangle, Banknote, Building, CalendarClock, Check, Construction, DollarSign,
  Flame, Gavel, Home, Hourglass, Lock, MapPin, ShieldAlert, ShieldCheck, Sparkles,
  TrendingUp, User, Wrench, type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Static icon map — listing each lucide export explicitly preserves
 * tree-shaking. Fallback to <Home/> if a chip references an unknown key.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle, Banknote, Building, CalendarClock, Construction, DollarSign, Flame,
  Gavel, Home, Hourglass, MapPin, ShieldAlert, ShieldCheck, Sparkles, TrendingUp, User, Wrench,
};

const TIER_RANK: Record<'free' | 'pro' | 'elite', number> = { free: 0, pro: 1, elite: 2 };

export interface LeadTypeChipsProps {
  leadTypes: LeadType[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  userTier: 'free' | 'pro' | 'elite';
  className?: string;
}

export function LeadTypeChips({
  leadTypes,
  selected,
  onChange,
  userTier,
  className = '',
}: LeadTypeChipsProps) {
  const { toast } = useToast();
  const userRank = TIER_RANK[userTier];

  const toggle = (chip: LeadType) => {
    const locked = TIER_RANK[chip.tier] > userRank;
    if (locked) {
      const requiredTier = chip.tier === 'pro' ? 'Pro' : 'Elite';
      toast({
        title: `Upgrade to ${requiredTier} to use this filter`,
        description: (
          <span>
            {chip.label} requires {requiredTier}.{' '}
            <Link
              to="/pricing"
              className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
            >
              See pricing
            </Link>
          </span>
        ),
      });
      return;
    }
    const next = new Set(selected);
    if (next.has(chip.slug)) next.delete(chip.slug);
    else next.add(chip.slug);
    onChange(next);
  };

  const count = selected.size;

  return (
    <section className={`flex flex-col gap-3 ${className}`} aria-label="Lead type filters">
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground leading-tight">
          {count > 0
            ? `${count} lead ${count === 1 ? 'type' : 'types'} selected`
            : 'Select one or more lead types'}
        </p>
        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-xs font-medium text-muted-foreground hover:text-cyan-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {leadTypes.map((chip) => {
          const Icon = ICON_MAP[chip.icon] ?? Home;
          const isActive = selected.has(chip.slug);
          const isLocked = TIER_RANK[chip.tier] > userRank;
          const requiredTier = chip.tier === 'pro' ? 'Pro' : 'Elite';
          const ariaLabel = isLocked
            ? `${chip.label} — requires ${requiredTier}`
            : chip.label;

          return (
            <button
              key={chip.slug}
              type="button"
              onClick={() => toggle(chip)}
              title={chip.description}
              aria-pressed={isActive}
              aria-label={ariaLabel}
              className={[
                'group relative flex items-center justify-between gap-2 rounded-lg border px-3 min-h-[46px] text-left tracking-tight transition-all duration-150',
                isLocked
                  ? 'border-border/40 bg-background/20 text-muted-foreground/70 hover:border-border/60'
                  : isActive
                    ? 'border-cyan-500/60 bg-cyan-500/[0.08] shadow-[0_0_0_1px_rgba(6,182,212,0.2)] hover:bg-cyan-500/[0.12]'
                    : 'border-border/60 hover:border-border hover:bg-background/40 hover:-translate-y-px',
              ].join(' ')}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={[
                    'h-3 w-3 shrink-0 transition-colors',
                    isLocked
                      ? 'text-muted-foreground/60'
                      : isActive
                        ? 'text-cyan-300'
                        : chip.badgeColor || 'text-muted-foreground',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span
                  className={[
                    'text-sm font-medium leading-tight truncate',
                    isActive ? 'text-foreground' : isLocked ? 'text-muted-foreground/80' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {chip.label}
                </span>
              </span>

              <span className="flex items-center gap-1.5 shrink-0">
                {isLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                    {requiredTier}
                  </span>
                )}
                {!isLocked && chip.tier !== 'free' && !isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300/80">
                    <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                    {requiredTier}
                  </span>
                )}
                <span
                  className={[
                    'h-5 w-5 rounded-full border flex items-center justify-center transition-all',
                    isActive
                      ? 'border-cyan-400 bg-cyan-400 text-cyan-950'
                      : 'border-transparent text-transparent',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {count === 0 && (
        <p className="text-xs text-muted-foreground/70 leading-snug">
          Select one or more lead types to define your search.
        </p>
      )}
    </section>
  );
}

export default LeadTypeChips;
