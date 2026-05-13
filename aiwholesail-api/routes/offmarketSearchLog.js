/**
 * POST /api/offmarket-search-log — emit a structured journald log line
 * summarizing one off-market search.
 *
 * Why this exists:
 *   The off-market search runs entirely in the React component
 *   (AbsenteeOwnerSearch.tsx) and fans out per-ZIP propdata calls. The
 *   backend sees the individual /api/propdata/property and
 *   /api/propdata/preforeclosure requests, but has no way to correlate
 *   them back to a single user-initiated search — so SLIs like
 *   "endpoint diversity per search" and "empty-result rate per search"
 *   can't be computed from the propdata route logs alone.
 *
 *   This endpoint accepts a fire-and-forget summary from the frontend
 *   after each search completes, and emits a single structured log line:
 *
 *     {component:"offmarket-search", user_id, lead_types_selected,
 *      endpoints_dispatched, result_count, region_label, search_id, ts}
 *
 *   That line is read by the off-market routing monitor cron
 *   (lib/offmarket-monitor-thresholds.js) to evaluate:
 *     - SLI-1 offmarket-endpoint-diversity
 *     - SLI-3 offmarket-empty-rate
 *
 * It is NOT inserted into a database — journald is the source of truth.
 * Keeping it journald-only means a misbehaving client can't flood a
 * table; we cap the request body shape instead, and journald rotation
 * handles retention.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const MAX_LEAD_TYPES = 20;       // a sane ceiling above the 12 canonical types
const MAX_ENDPOINTS = 10;        // we have 2 today (property, preforeclosure); leave room
const MAX_LABEL_LEN = 120;       // resolved region label
const MAX_SEARCH_ID_LEN = 40;
const MAX_RESULT_COUNT = 100_000;

function asStringArray(value, maxItems, maxLen = 64) {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  if (value.length > maxItems) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    if (item.length === 0 || item.length > maxLen) return null;
    out.push(item);
  }
  return out;
}

router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const leadTypes = asStringArray(body.lead_types_selected, MAX_LEAD_TYPES);
    const endpoints = asStringArray(body.endpoints_dispatched, MAX_ENDPOINTS);
    if (leadTypes === null || endpoints === null) {
      return res.status(400).json({ error: 'Invalid lead_types_selected or endpoints_dispatched' });
    }

    const resultCount = Number(body.result_count);
    if (!Number.isFinite(resultCount) || resultCount < 0 || resultCount > MAX_RESULT_COUNT) {
      return res.status(400).json({ error: 'Invalid result_count' });
    }

    const regionLabel = typeof body.region_label === 'string' && body.region_label.length <= MAX_LABEL_LEN
      ? body.region_label
      : null;

    const searchId = typeof body.search_id === 'string' && body.search_id.length <= MAX_SEARCH_ID_LEN
      ? body.search_id
      : null;

    // Single-line JSON emission — read by scripts/offmarket-routing-monitor.js.
    // Keep field names stable; the threshold evaluators in
    // lib/offmarket-monitor-thresholds.js destructure them by name.
    console.log(JSON.stringify({
      component: 'offmarket-search',
      ts: new Date().toISOString(),
      user_id: req.user.id,
      lead_types_selected: leadTypes,
      endpoints_dispatched: endpoints,
      result_count: Math.floor(resultCount),
      region_label: regionLabel,
      search_id: searchId,
    }));

    res.json({ ok: true });
  })
);

module.exports = router;
