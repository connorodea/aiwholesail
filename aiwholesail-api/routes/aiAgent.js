/**
 * Cmd+K AI agent — SSE streaming endpoint + session-management routes.
 *
 * POST /api/ai/agent/chat
 *   body: { messages: [...], session_id?: uuid }
 *   - If session_id is omitted, a new session is created (title = first user message).
 *   - The new session_id is emitted as the first SSE event ({type:'session', id}).
 *   - User message is persisted before the router runs.
 *   - Assistant final text + citations + tool names are persisted at stream end.
 *
 * GET /api/ai/agent/sessions               — list user's recent sessions (last 20)
 * GET /api/ai/agent/sessions/:id           — load one session (session + messages)
 * DELETE /api/ai/agent/sessions/:id        — delete one session
 *
 * Kill switch: AI_AGENT_ENABLED=false → /chat returns 503.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { attachSubscription, requireTierWithLimit } = require('../middleware/subscription');
const { logEvent, EVENTS } = require('../lib/events');
const { runRouter } = require('../lib/agent/router');
const {
  listSessions,
  loadSession,
  createSession,
  appendUserMessage,
  appendAssistantMessage,
  deleteSession,
} = require('../lib/agent/chatHistory');

const router = express.Router();

function isMessagesArrayValid(m) {
  if (!Array.isArray(m) || m.length === 0 || m.length > 30) return false;
  for (const msg of m) {
    if (!msg || typeof msg !== 'object') return false;
    if (msg.role !== 'user' && msg.role !== 'assistant') return false;
    if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) return false;
    if (typeof msg.content === 'string' && msg.content.length > 4000) return false;
  }
  return true;
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && typeof messages[i].content === 'string') {
      return messages[i].content;
    }
  }
  return '';
}

// -------------------------------------------------------------------------
// POST /api/ai/agent/chat — main SSE endpoint
// -------------------------------------------------------------------------
router.post(
  '/chat',
  authenticate,
  attachSubscription,
  requireTierWithLimit({
    eventType: 'ai_agent_chat',
    proMonthly: 100,
    featureLabel: 'AI Agent (Cmd+K)',
  }),
  asyncHandler(async (req, res) => {
    if (process.env.AI_AGENT_ENABLED === 'false') {
      return res.status(503).json({ error: 'AI Agent temporarily disabled' });
    }

    const { messages, session_id } = req.body || {};
    if (!isMessagesArrayValid(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    // -------- session bookkeeping (before headers) --------
    let session = null;
    const lastUser = lastUserText(messages);
    try {
      if (session_id) {
        const loaded = await loadSession(session_id, req.user.id);
        if (loaded) session = loaded.session;
      }
      if (!session) {
        session = await createSession(req.user.id, lastUser);
      }
      if (lastUser) {
        await appendUserMessage(session.id, lastUser);
      }
    } catch (err) {
      // Persistence failure should not block the agent — log and continue
      console.error(`[aiAgent] session persistence failed: ${err.message}`);
    }

    // -------- SSE setup --------
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const ac = new AbortController();
    req.on('close', () => ac.abort());

    const send = (ev) => {
      try {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      } catch { /* socket closed */ }
    };

    // Hard wall-clock cap. A single Cmd+K turn fans out to up to 8 router
    // iterations × 4 subagents × 6 inner iterations × 1500 max_tokens each.
    // Without this ceiling, a pathological prompt (or attacker) could burn
    // tens of thousands of Anthropic tokens per turn. The Pro 100/mo counter
    // only increments once per turn, so this cap is also revenue-side.
    const AGENT_WALL_CLOCK_MS = parseInt(process.env.AI_AGENT_TIMEOUT_MS || '60000', 10);
    const wallClockTimer = setTimeout(() => {
      try { send({ type: 'error', message: `Agent timed out after ${AGENT_WALL_CLOCK_MS}ms` }); } catch {}
      ac.abort();
    }, AGENT_WALL_CLOCK_MS);

    send({ type: 'ready' });
    if (session) send({ type: 'session', id: session.id, title: session.title });

    logEvent(req.user.id, EVENTS.AI_AGENT_CHAT, {
      message_count: messages.length,
      session_id: session?.id || null,
      last_user_chars: lastUser.length,
    });

    // Accumulate assistant output for persistence
    const accumulated = {
      text: '',
      citations: [],
      tool_events: [],
    };

    const wrappedSend = (ev) => {
      if (ev.type === 'text_delta' && typeof ev.delta === 'string') {
        accumulated.text += ev.delta;
      } else if (ev.type === 'citation' && ev.data) {
        accumulated.citations.push(ev.data);
      } else if (ev.type === 'tool_start' && ev.name) {
        accumulated.tool_events.push(ev.name);
      }
      send(ev);
    };

    try {
      await runRouter({
        messages,
        signal: ac.signal,
        onEvent: wrappedSend,
      });
    } catch (err) {
      send({ type: 'error', message: err.message || 'router error' });
    } finally {
      clearTimeout(wallClockTimer);
      // Persist the final assistant message (best-effort)
      if (session && accumulated.text.trim()) {
        try {
          await appendAssistantMessage(session.id, accumulated);
        } catch (err) {
          console.error(`[aiAgent] assistant persist failed: ${err.message}`);
        }
      }
      try { res.end(); } catch { /* socket closed */ }
    }
  })
);

// -------------------------------------------------------------------------
// GET /api/ai/agent/sessions — list recent sessions
// -------------------------------------------------------------------------
router.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const sessions = await listSessions(req.user.id, limit);
    res.json({ sessions });
  })
);

// -------------------------------------------------------------------------
// GET /api/ai/agent/sessions/:id — load one session
// -------------------------------------------------------------------------
router.get(
  '/sessions/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = await loadSession(req.params.id, req.user.id);
    if (!data) return res.status(404).json({ error: 'Session not found' });
    res.json(data);
  })
);

// -------------------------------------------------------------------------
// DELETE /api/ai/agent/sessions/:id — delete one session
// -------------------------------------------------------------------------
router.delete(
  '/sessions/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const ok = await deleteSession(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    res.json({ deleted: true });
  })
);

module.exports = router;
