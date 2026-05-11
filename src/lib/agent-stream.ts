/**
 * SSE parser for the Cmd+K AI agent stream.
 *
 * Wraps `fetch` (not EventSource — we need POST + Bearer auth) and yields a
 * typed event stream. Pure logic, no React dependencies.
 *
 * Event shapes match the server's `onEvent` payloads in routes/aiAgent.js.
 */

export type AgentEvent =
  | { type: 'ready' }
  | { type: 'text_start' }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string }
  | { type: 'citation'; data: CitationData }
  | { type: 'message_stop' }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface CitationData {
  type: string; // 'search_result_location' | 'char_location' | ...
  cited_text?: string;
  source?: string;            // search_result_location: the search_result's `source` URL
  title?: string;
  document_title?: string;
  document_index?: number;
  start_block_index?: number;
  end_block_index?: number;
  start_char_index?: number;
  end_char_index?: number;
  start_page_number?: number;
  end_page_number?: number;
  search_result_index?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunAgentOptions {
  apiBaseUrl: string;
  accessToken: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onEvent: (ev: AgentEvent) => void;
}

const SSE_DELIMITER = '\n\n';

/**
 * Run the Cmd+K agent. Returns when the stream ends or aborts.
 * Caller-provided onEvent gets every parsed event in order.
 */
export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { apiBaseUrl, accessToken, messages, signal, onEvent } = opts;

  let resp: Response;
  try {
    resp = await fetch(`${apiBaseUrl}/api/ai/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    onEvent({ type: 'error', message: `network error: ${(err as Error).message}` });
    return;
  }

  if (!resp.ok) {
    // Try to parse JSON error body for tier-limit / 503 / 401 cases
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      msg = body?.error || body?.message || msg;
    } catch {
      /* non-JSON body — keep status code as message */
    }
    onEvent({ type: 'error', message: msg });
    return;
  }
  if (!resp.body) {
    onEvent({ type: 'error', message: 'empty response body' });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf(SSE_DELIMITER)) >= 0) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + SSE_DELIMITER.length);
        const dataLine = rawEvent
          .split('\n')
          .find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const payload = dataLine.slice('data:'.length).trim();
        if (!payload) continue;
        try {
          const ev = JSON.parse(payload) as AgentEvent;
          onEvent(ev);
        } catch {
          // malformed line — skip rather than crash the stream
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    onEvent({ type: 'error', message: `stream error: ${(err as Error).message}` });
  }
}

/**
 * Helper: extract the user-facing URL for a citation event.
 * For search_result_location, that's `source`. For others, falls back to title.
 */
export function citationUrl(c: CitationData): string | null {
  if (c.type === 'search_result_location' && c.source) return c.source;
  if (c.source && c.source.startsWith('http')) return c.source;
  return null;
}
