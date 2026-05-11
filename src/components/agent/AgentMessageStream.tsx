import { CitationChip } from "./CitationChip";
import type { CitationData } from "@/lib/agent-stream";

/**
 * Renders one assistant message. The agent's output is plain text streamed
 * token-by-token, with citation events arriving alongside. We render the
 * text and append citation chips in the order they arrived (1-indexed
 * superscripts), with click-through to the source URL.
 *
 * The visual model is intentionally simple — no markdown rendering for V1.
 * Wholesalers want fast skimmable answers; markdown comes later.
 */
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: CitationData[];
  toolEvents: string[]; // names of tools that were invoked, in order
  status: "streaming" | "done" | "error";
  errorMessage?: string;
}

interface Props {
  msg: AgentMessage;
}

export function AgentMessageStream({ msg }: Props) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] rounded-2xl bg-cyan-500/15 border border-cyan-500/30 px-4 py-2 text-sm text-neutral-100 whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[92%] space-y-2">
        {msg.toolEvents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            {msg.toolEvents.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-800 border border-neutral-700 text-neutral-300"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed">
          {msg.text}
          {msg.citations.map((c, i) => (
            <CitationChip key={`${msg.id}-cite-${i}`} index={i + 1} citation={c} />
          ))}
          {msg.status === "streaming" && (
            <span className="inline-block w-2 h-4 bg-cyan-400 align-middle ml-1 animate-pulse" />
          )}
        </div>

        {msg.status === "error" && (
          <div className="text-xs text-red-400 mt-1">
            Error: {msg.errorMessage || "unknown"}
          </div>
        )}

        {msg.status === "done" && msg.citations.length > 0 && (
          <div className="text-[10px] text-neutral-500 mt-1">
            {msg.citations.length} source
            {msg.citations.length === 1 ? "" : "s"} · click to view
          </div>
        )}
      </div>
    </div>
  );
}
