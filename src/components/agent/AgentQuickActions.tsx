import { Search, Building2, TrendingUp, Flame } from "lucide-react";

/**
 * Tappable quick-action cards shown in the Cmd+K empty state.
 *
 * Replaces the prior inert "Try: ..." text. Each card is one click → auto-
 * submitted query that maps to one of the agent's specialist subagents:
 *
 *   Find deals       → run_deal_hunter
 *   Run comps        → run_comp_analyst   (asks for zpid in chat)
 *   Market check     → run_market_watcher
 *   Score a seller   → run_seller_motivator (asks for zpid)
 *
 * Designed to bridge the "what do I even ask?" gap that the
 * popular-markets empty-state work on the main search page already
 * solved for property search — same activation playbook.
 */

const ACTIONS: Array<{
  icon: typeof Search;
  label: string;
  hint: string;
  prompt: string;
  tone: 'cyan' | 'green' | 'amber' | 'rose';
}> = [
  {
    icon: Search,
    label: "Find deals",
    hint: "Top spreads in a ZIP",
    prompt: "Find me the top 5 wholesale deals in 48371 — sort by spread, anything over $20K.",
    tone: 'cyan',
  },
  {
    icon: Building2,
    label: "Run comps",
    hint: "Fair value for one home",
    prompt: "Run comps for ",
    tone: 'green',
  },
  {
    icon: TrendingUp,
    label: "Market check",
    hint: "Buyer's or seller's?",
    prompt: "Is Austin TX a buyer's or seller's market right now?",
    tone: 'amber',
  },
  {
    icon: Flame,
    label: "Motivated seller",
    hint: "Score one listing 0–100",
    prompt: "How motivated is the seller of zpid ",
    tone: 'rose',
  },
];

const TONE_STYLES: Record<string, string> = {
  cyan: 'border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/10 [&_svg]:text-cyan-400',
  green: 'border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10 [&_svg]:text-emerald-400',
  amber: 'border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/10 [&_svg]:text-amber-400',
  rose: 'border-rose-500/30 hover:border-rose-400/60 hover:bg-rose-500/10 [&_svg]:text-rose-400',
};

interface Props {
  onPick: (prompt: string, autoSend: boolean) => void;
}

export function AgentQuickActions({ onPick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
      {ACTIONS.map((a) => {
        // If the prompt ends with a space, it's a half-finished prompt that
        // needs the user to type a zpid/address — fill the input but don't auto-send.
        const autoSend = !a.prompt.endsWith(' ');
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => onPick(a.prompt, autoSend)}
            className={`group text-left rounded-xl border bg-neutral-900/40 px-3.5 py-3 transition-all ${TONE_STYLES[a.tone]}`}
          >
            <Icon className="h-4 w-4 mb-2 transition-colors" />
            <div className="text-sm font-medium text-neutral-100 group-hover:text-white">{a.label}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5 group-hover:text-neutral-400">{a.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
