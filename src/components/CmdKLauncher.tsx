import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

/**
 * Floating launcher for the Cmd+K AI agent modal.
 *
 * - Bottom-right FAB visible on /app/* routes for authed users.
 * - Click dispatches `aiwholesail:open-cmdk` (CmdKAgent listens for this).
 * - First-time visitors see an intro pulse + tooltip pointing at the button,
 *   dismissed on click or via the local-storage flag `aiw_cmdk_intro_seen`.
 *
 * Hidden on marketing/landing routes ("/", "/pricing", etc.) so the FAB
 * doesn't show to logged-out visitors.
 */

const INTRO_KEY = "aiw_cmdk_intro_seen";

function isAppRoute(pathname: string): boolean {
  // Show the FAB on all in-product routes — everything lives under /app/*.
  // Hide on marketing pages so logged-out flows aren't cluttered.
  return pathname.startsWith("/app");
}

export function CmdKLauncher() {
  const { session } = useAuth();
  const location = useLocation();
  const [showIntro, setShowIntro] = useState(false);
  const [dismissedIntro, setDismissedIntro] = useState(false);

  // Show intro tooltip once per user, after a short delay to avoid stealing
  // attention while the page is still painting.
  useEffect(() => {
    if (!session?.access_token) return;
    if (!isAppRoute(location.pathname)) return;
    try {
      if (localStorage.getItem(INTRO_KEY) === "1") {
        setDismissedIntro(true);
        return;
      }
    } catch {
      // localStorage blocked — just don't show again on next route change
      setDismissedIntro(true);
      return;
    }
    const t = setTimeout(() => setShowIntro(true), 1500);
    return () => clearTimeout(t);
  }, [session?.access_token, location.pathname]);

  const dismissIntro = () => {
    setShowIntro(false);
    setDismissedIntro(true);
    try { localStorage.setItem(INTRO_KEY, "1"); } catch {/* ignore */}
  };

  const launch = () => {
    dismissIntro();
    window.dispatchEvent(new CustomEvent("aiwholesail:open-cmdk"));
  };

  if (!session?.access_token) return null;
  if (!isAppRoute(location.pathname)) return null;

  return (
    <>
      {/* ----- Intro tooltip (first time only) ----- */}
      {showIntro && !dismissedIntro && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-[60] max-w-[280px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative rounded-xl bg-neutral-950 border border-cyan-500/40 ring-1 ring-cyan-500/20 shadow-2xl shadow-cyan-500/10 px-4 py-3">
            <button
              type="button"
              onClick={dismissIntro}
              className="absolute top-1.5 right-1.5 p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                New
              </span>
            </div>
            <div className="text-sm font-semibold text-neutral-100 mb-1">
              Meet your AI Agent
            </div>
            <div className="text-xs text-neutral-400 leading-relaxed">
              Ask anything — find deals in a ZIP, run comps, gauge a market. Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[10px]">⌘K</kbd>
              {" "}or click the spark button.
            </div>
            {/* Arrow pointing down-right at the FAB */}
            <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-neutral-950 border-r border-b border-cyan-500/40" />
          </div>
        </div>
      )}

      {/* ----- Floating launcher button ----- */}
      <button
        type="button"
        onClick={launch}
        title="AI Agent (⌘K)"
        aria-label="Open AI Agent"
        className="group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all flex items-center justify-center text-neutral-950 active:scale-95"
      >
        {/* Pulse ring while intro is unseen */}
        {!dismissedIntro && (
          <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-40" />
        )}
        <Sparkles className="relative h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
        <span className="absolute -top-1 -left-1 hidden sm:flex items-center px-1.5 h-4 rounded-full bg-neutral-950 text-[9px] font-mono font-semibold text-cyan-300 border border-cyan-500/40 opacity-0 group-hover:opacity-100 transition-opacity">
          ⌘K
        </span>
      </button>
    </>
  );
}
