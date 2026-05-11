/**
 * Cmd+K AI agent — SSE streaming endpoint.
 *
 * POST /api/ai/agent/chat
 *   body: { messages: [{role:'user'|'assistant', content:string|blocks}, ...] }
 *   auth: Bearer JWT
 *   gating: requireTierWithLimit (TRIAL acts as Pro; Pro = 100/mo; Elite unlimited)
 *
 * Streams text-delta + citation + tool-start events as SSE.
 *
 * Kill switch: set AI_AGENT_ENABLED=false on the server to return 503
 * without invoking the router (useful for cost containment).
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { attachSubscription, requireTierWithLimit } = require('../middleware/subscription');
const { logEvent, EVENTS } = require('../lib/events');
const { runRouter } = require('../lib/agent/router');

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

    const { messages } = req.body || {};
    if (!isMessagesArrayValid(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders?.();

    // Hook up client-abort -> AbortController
    const ac = new AbortController();
    req.on('close', () => ac.abort());

    const send = (ev) => {
      try {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      } catch {
        // socket closed mid-write; safe to ignore — the abort will clean up
      }
    };

    // Initial ping so the client knows we connected
    send({ type: 'ready' });

    logEvent(req.user.id, EVENTS.AI_AGENT_CHAT, {
      message_count: messages.length,
      last_user_chars: typeof messages[messages.length - 1]?.content === 'string'
        ? messages[messages.length - 1].content.length
        : 0,
    });

    try {
      await runRouter({
        messages,
        signal: ac.signal,
        onEvent: send,
      });
    } catch (err) {
      send({ type: 'error', message: err.message || 'router error' });
    } finally {
      try { res.end(); } catch { /* socket closed */ }
    }
  })
);

module.exports = router;
