import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/platform";
import {
  runAgent,
  fetchSessions,
  fetchSession,
  deleteSession,
  type AgentEvent,
  type ChatMessage,
  type ChatSessionSummary,
} from "@/lib/agent-stream";
import { AgentMessageStream, type AgentMessage } from "@/components/agent/AgentMessageStream";
import { AgentQuickActions } from "@/components/agent/AgentQuickActions";
import { ArrowUp, History, Plus, Sparkles, Trash2, X } from "lucide-react";

/**
 * Cmd+K AI agent modal with saved chat history.
 *
 * Global Cmd+K (Mac) / Ctrl+K (Win/Linux) opens a centered Dialog. Left rail
 * (collapsible) shows recent sessions. Main area holds the current chat.
 * Submitting POSTs to /api/ai/agent/chat with the optional session_id so the
 * server appends to it, or creates a fresh session if omitted.
 */
export function CmdKAgent() {
  const { session: authSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Global Cmd+K / Ctrl+K listener + window-event channel for the FAB launcher
  useEffect(() => {
    if (!authSession?.access_token) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onCustomOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("aiwholesail:open-cmdk", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aiwholesail:open-cmdk", onCustomOpen);
    };
  }, [authSession?.access_token]);

  // Load session list when dialog opens
  useEffect(() => {
    if (!open || !authSession?.access_token) return;
    fetchSessions(API_BASE_URL, authSession.access_token, 20)
      .then(setSessions)
      .catch(() => {/* non-fatal */});
  }, [open, authSession?.access_token]);

  // Auto-scroll on stream
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input on open + auto-grow textarea
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Resize textarea as content grows (1–5 rows)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Abort in-flight stream on close
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const loadHistorySession = useCallback(
    async (id: string) => {
      if (!authSession?.access_token) return;
      abortRef.current?.abort();
      try {
        const data = await fetchSession(API_BASE_URL, authSession.access_token, id);
        const mapped: AgentMessage[] = data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          citations: m.citations || [],
          toolEvents: m.tool_events || [],
          status: "done",
        }));
        setMessages(mapped);
        setSessionId(data.session.id);
        setShowHistory(false);
      } catch {/* non-fatal */}
    },
    [authSession?.access_token]
  );

  const removeSession = useCallback(
    async (id: string) => {
      if (!authSession?.access_token) return;
      try {
        await deleteSession(API_BASE_URL, authSession.access_token, id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (sessionId === id) startNewChat();
      } catch {/* non-fatal */}
    },
    [authSession?.access_token, sessionId, startNewChat]
  );

  const submitText = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy || !authSession?.access_token) return;
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
          case "session":
            if (!sessionId) setSessionId(ev.id);
            break;
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
            fetchSessions(API_BASE_URL, authSession.access_token!, 20)
              .then(setSessions)
              .catch(() => {/* ignore */});
            break;
          default:
            break;
        }
      };

      try {
        await runAgent({
          apiBaseUrl: API_BASE_URL,
          accessToken: authSession.access_token,
          messages: history,
          sessionId: sessionId || undefined,
          signal: ac.signal,
          onEvent,
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, sessionId, authSession?.access_token]
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      void submitText(input);
    },
    [input, submitText]
  );

  const handlePickAction = useCallback(
    (prompt: string, autoSend: boolean) => {
      if (autoSend) {
        void submitText(prompt);
      } else {
        setInput(prompt);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(prompt.length, prompt.length);
        }, 10);
      }
    },
    [submitText]
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter or plain Enter (without shift) submits
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitText(input);
    }
  };

  if (!authSession?.access_token) return null;

  const hasChat = messages.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-3xl p-0 gap-0 overflow-hidden border-0 bg-transparent shadow-none"
      >
        <DialogTitle className="sr-only">AI Agent</DialogTitle>

        {/* Cyan glow wrapper — a thin ring + soft drop-shadow gives the modal its brand feel */}
        <div className="rounded-2xl bg-neutral-950 border border-neutral-800 ring-1 ring-cyan-500/10 shadow-2xl shadow-cyan-500/5 overflow-hidden">
          {/* ----- Header ----- */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-gradient-to-b from-neutral-900/50 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <span className="text-sm font-semibold text-neutral-100 tracking-tight">AI Agent</span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-neutral-700 bg-neutral-900 text-[10px] font-mono text-neutral-500">
                ⌘K
              </kbd>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className={`group relative rounded-md p-1.5 transition-colors ${
                  showHistory
                    ? "bg-cyan-500/10 text-cyan-300"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                }`}
                title="Chat history"
                aria-label="Toggle history"
              >
                <History className="h-4 w-4" />
                {sessions.length > 0 && !showHistory && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-cyan-500 text-[9px] font-semibold text-neutral-950 flex items-center justify-center">
                    {sessions.length > 9 ? "9+" : sessions.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={startNewChat}
                disabled={!hasChat && !sessionId}
                className="rounded-md p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="New chat"
                aria-label="New chat"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ----- Body: optional sidebar + main pane ----- */}
          <div className={`flex ${hasChat ? "min-h-[420px]" : "min-h-[360px]"} max-h-[65vh]`}>
            {showHistory && (
              <aside className="w-56 shrink-0 border-r border-neutral-800/80 bg-neutral-900/30 overflow-y-auto">
                <div className="px-3 pt-3 pb-2 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                  Recent
                </div>
                {sessions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-600">No previous chats yet.</div>
                )}
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => loadHistorySession(s.id)}
                    onKeyDown={(e) => e.key === "Enter" && loadHistorySession(s.id)}
                    className={`group flex items-start gap-1 px-3 py-2 cursor-pointer transition-colors ${
                      s.id === sessionId
                        ? "bg-cyan-500/10 border-l-2 border-cyan-400"
                        : "hover:bg-neutral-800/50 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-neutral-200 truncate">
                        {s.title || "Untitled chat"}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {s.message_count} msg
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-all"
                      aria-label="Delete chat"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </aside>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {!hasChat && (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/30 flex items-center justify-center mb-4">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="text-base font-semibold text-neutral-100 mb-1.5">
                    What are we hunting tonight?
                  </div>
                  <div className="text-xs text-neutral-500 mb-5 max-w-sm">
                    Ask anything about a market, property, or deal. I'll pull live Zillow data and cite every source.
                  </div>
                  <AgentQuickActions onPick={handlePickAction} />
                </div>
              )}

              {messages.map((m) => (
                <AgentMessageStream key={m.id} msg={m} />
              ))}
            </div>
          </div>

          {/* ----- Input bar ----- */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-neutral-800/80 bg-neutral-900/40"
          >
            <div className="flex items-end gap-2 px-3 py-2.5 focus-within:bg-neutral-900/70 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={busy ? "Thinking…" : "Ask the agent — or pick a card above"}
                disabled={busy}
                rows={1}
                className="flex-1 resize-none bg-transparent border-0 outline-none text-sm text-neutral-100 placeholder:text-neutral-500 disabled:opacity-50 leading-relaxed py-1.5 max-h-[140px]"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="shrink-0 h-8 w-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 transition-all flex items-center justify-center disabled:cursor-not-allowed group"
              >
                <ArrowUp className="h-4 w-4 group-disabled:opacity-40" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex items-center justify-between px-4 pb-2 pt-0 text-[10px] text-neutral-600">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-neutral-800/60 border border-neutral-700/50 font-mono">↵</kbd>{" "}
                to send · <kbd className="px-1 py-0.5 rounded bg-neutral-800/60 border border-neutral-700/50 font-mono">⇧↵</kbd>{" "}
                newline
              </span>
              <span>
                {input.length > 0 && (
                  <span className={input.length > 450 ? "text-amber-500" : ""}>
                    {input.length}/500
                  </span>
                )}
              </span>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
