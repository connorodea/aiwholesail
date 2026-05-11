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
import { History, Plus, Send, Sparkles, Trash2, X } from "lucide-react";

/**
 * Cmd+K AI agent modal with saved chat history.
 *
 * Global Cmd+K opens the dialog. Left rail shows recent sessions. Main area
 * shows the current session; submitting POSTs to /api/ai/agent/chat with the
 * session_id so the server appends to it (or creates a fresh session if
 * session_id is omitted).
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    if (!authSession?.access_token) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  // Focus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

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

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = input.trim();
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
            // Refresh session list so the sidebar reflects the new/updated title
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
    [input, busy, messages, sessionId, authSession?.access_token]
  );

  if (!authSession?.access_token) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden bg-neutral-950 border border-neutral-800">
        <DialogTitle className="sr-only">AI Agent</DialogTitle>

        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-neutral-200">AI Agent</span>
            <span className="text-[10px] font-mono text-neutral-500 ml-1 hidden sm:inline">⌘K</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className={`rounded p-1.5 transition-colors ${showHistory ? "bg-neutral-800 text-cyan-300" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"}`}
              title="Chat history"
              aria-label="Toggle history"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={startNewChat}
              className="rounded p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              title="New chat"
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex max-h-[60vh] min-h-[320px]">
          {showHistory && (
            <aside className="w-56 shrink-0 border-r border-neutral-800 bg-neutral-900/40 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                Recent
              </div>
              {sessions.length === 0 && (
                <div className="px-3 py-2 text-xs text-neutral-600">No previous chats.</div>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-start gap-1 px-3 py-2 cursor-pointer hover:bg-neutral-800/60 transition-colors ${
                    s.id === sessionId ? "bg-neutral-800/40" : ""
                  }`}
                  onClick={() => loadHistorySession(s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-neutral-200 truncate">
                      {s.title || "Untitled chat"}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {s.message_count} msg
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity"
                    aria-label="Delete chat"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </aside>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {messages.length === 0 && (
              <div className="text-center text-neutral-500 text-sm py-12">
                <div className="mb-3">
                  <Sparkles className="h-6 w-6 mx-auto text-cyan-400/60" />
                </div>
                <div className="font-medium text-neutral-300 mb-1">Ask me anything about real estate</div>
                <div className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  Try: "Find deals in 48371" · "What's a fair price for zpid 336746838?" ·
                  "Is Austin a buyer's market?"
                </div>
              </div>
            )}

            {messages.map((m) => (
              <AgentMessageStream key={m.id} msg={m} />
            ))}
          </div>
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
