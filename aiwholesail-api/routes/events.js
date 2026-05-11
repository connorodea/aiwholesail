/**
 * POST /api/events — log a user activation event to user_events.
 *
 * The frontend search/property flow doesn't hit any aiwholesail-api route
 * (it talks directly to the /zillow standalone proxy), so server-side
 * routes that call logEvent() never fire for those user actions. The
 * activation funnel table (user_events) had ~13 total rows ever before
 * this endpoint shipped. This route lets the frontend explicitly tell us
 * when an activation-class action happens.
 *
 * Vocabulary is locked to EVENTS so callers can't pollute the table with
 * arbitrary types. Property values get a small sanitize step (string >500
 * chars dropped, arrays >50 entries dropped) so a hostile or buggy client
 * can't bloat a row.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { logEvent, EVENTS } = require('../lib/events');

const router = express.Router();

const ALLOWED_TYPES = new Set(Object.values(EVENTS));
const MAX_STRING_LEN = 500;
const MAX_ARRAY_LEN = 50;
const MAX_PROPS_KEYS = 30;

function sanitizeProperties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  let kept = 0;
  for (const [k, v] of Object.entries(input)) {
    if (kept >= MAX_PROPS_KEYS) break;
    if (typeof k !== 'string' || k.length > 64) continue;
    if (typeof v === 'string') {
      if (v.length > MAX_STRING_LEN) continue;
      out[k] = v;
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v;
    } else if (Array.isArray(v) && v.length <= MAX_ARRAY_LEN) {
      out[k] = v.slice(0, MAX_ARRAY_LEN);
    } else if (typeof v === 'object') {
      // shallow only — don't recurse into nested objects
      try {
        const json = JSON.stringify(v);
        if (json.length <= MAX_STRING_LEN * 2) out[k] = v;
      } catch { /* skip unserializable */ }
    }
    kept++;
  }
  return out;
}

router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, properties } = req.body || {};
    if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }
    const safeProps = sanitizeProperties(properties);
    logEvent(req.user.id, type, safeProps); // fire-and-forget per lib/events.js
    res.json({ ok: true });
  })
);

module.exports = router;
