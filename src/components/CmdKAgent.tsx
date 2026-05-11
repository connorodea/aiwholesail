import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/platform";
import { runAgent, type AgentEvent, type ChatMessage } from "@/lib/agent-stream";
import { AgentMessageStream, type AgentMessage } from "@/components/agent/AgentMessageStream";
import { Send, Sparkles, X } from "lucide-react";

/**
 * Cmd+K AI agent modal.
 *
 * Global Cmd+K (Mac) / Ctrl+K (Win/Linux) opens a centered Dialog with a
 * chat input. Submitting a message POSTs to /api/ai/agent/chat (SSE) and
 * streams the assistant's response with inline citation chips.
 *
 * Only auth'd users get the keybinding. The route itself is also tier-gated
 * on the server (TRIAL acts as Pro, Pro=100/mo, Elite unlimited).
 */
export function CmdKAgent() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    if (!session?.access_token) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session?.access_token]);

  // Auto-scroll to bottom as messages stream
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Abort in-flight stream when dialog closes
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = input.trim();
      if (!q || busy || !session?.access_token) return;
      setInput("");

      const userMsg: AgentMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: q,
        citations: [],
        toolEvents: [],
        status: "done",
      };
      const asstId = `a-${Date.now()}`;
      const asstMsg: AgentMessage = {
        id: asstId,
        role: "assistant",
        text: "",
        citations: [],
        toolEvents: [],
        status: "streaming",
      };
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setBusy(true);

      const ac = new AbortController();
      abortRef.current = ac;

      const history: ChatMessage[] = [...messages, userMsg]
        .filter((m) => m.status !== "error")
        .map((m) => ({ role: m.role, content: m.text }));

      const update = (mut: (m: AgentMessage) => AgentMessage) => {
        setMessages((prev) => prev.map((m) => (m.id === asstId ? mut(m) : m)));
      };

      const onEvent = (ev: AgentEvent) => {
        switch (ev.type) {
          case "text_delta":
            update((m) => ({ ...m, text: m.text + ev.delta }));
            break;
          case "tool_start":
            update((m) => ({ ...m, toolEvents: [...m.toolEvents, ev.name] }));
            break;
          case "citation":
            update((m) => ({ ...m, citations: [...m.citations, ev.data] }));
            break;
          case "error":
            update((m) => ({ ...m, status: "error", errorMessage: ev.message }));
            break;
          case "done":
            update((m) => (m.status === "error" ? m : { ...m, status: "done" }));
            break;
          default:
            break;
        }
      };

      try {
        await runAgent({
          apiBaseUrl: API_BASE_URL,
          accessToken: session.access_token,
          messages: history,
          signal: ac.signal,
          onEvent,
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [input, busy, messages, session?.access_token]
  );

  if (!session?.access_token) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-neutral-950 border border-neutral-800">
        <DialogTitle className="sr-only">AI Agent</DialogTitle>

        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-neutral-200">AI Agent</span>
            <span className="text-[10px] font-mono text-neutral-500 ml-1 hidden sm:inline">
              ⌘K
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="max-h-[60vh] min-h-[280px] overflow-y-auto px-4 py-4 space-y-1">
          {messages.length === 0 && (
            <div className="text-center text-neutral-500 text-sm py-12">
              <div className="mb-3">
                <Sparkles className="h-6 w-6 mx-auto text-cyan-400/60" />
              </div>
              <div className="font-medium text-neutral-300 mb-1">Ask me anything about real estate</div>
              <div className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Try: "Find deals in 48371" · "What's a fair price for 145 Cistern Way?" ·
                "Is Austin a buyer's market?"
              </div>
            </div>
          )}

          {messages.map((m) => (
            <AgentMessageStream key={m.id} msg={m} />
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-3 py-3 border-t border-neutral-800 bg-neutral-900/40"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "Thinking…" : "Ask the agent…"}
            disabled={busy}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-neutral-100 placeholder:text-neutral-500 disabled:opacity-50"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-800 disabled:text-neutral-600 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
