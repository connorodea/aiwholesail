/**
 * Integration health endpoint.
 *
 * GET /api/health/integrations
 *
 * Presence-only audit of every env-var-backed integration. Returns:
 *   - `status` per integration: 'ok' | 'missing' | 'partial'
 *   - `severity` so operators can triage at a glance
 *   - `feature` description so the impact of a missing var is obvious
 *
 * NEVER returns the values of the env vars themselves — only whether
 * they are present and non-empty. Safe to expose to any authenticated
 * operator without leaking credentials.
 *
 * Why this exists:
 *   - Stripe webhook + Meta CAPI + skip-trace + several AI features all
 *     silently no-op if their env vars are missing (by design — the
 *     code paths gracefully degrade so prod doesn't 500). The downside
 *     is operators discover gaps from user complaints rather than from
 *     monitoring.
 *   - One endpoint queryable by curl gives ops a single source of truth
 *     for "which integrations are actually wired right now?".
 *   - Also catches drift: if a key gets rotated and the new value isn't
 *     deployed, this endpoint flips to 'missing' on the next request.
 *
 * Auth: requires a valid JWT (any authenticated user). Doesn't leak
 * value bytes, but the *map* of which integrations are configured is
 * still implementation-detail and shouldn't be public.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/** True iff every var in `names` is set and non-empty. */
function allSet(names) {
  return names.every((n) => {
    const v = process.env[n];
    return typeof v === 'string' && v.length > 0;
  });
}

/** Per-var presence map (booleans only — no values). */
function presence(names) {
  const out = {};
  for (const n of names) {
    out[n] = typeof process.env[n] === 'string' && process.env[n].length > 0;
  }
  return out;
}

/**
 * Integrations registry. Order = display order. Each entry declares
 * the var(s) it needs, what feature it powers, and how bad it is when
 * missing.
 *
 * When adding a new integration to the codebase, ADD A LINE HERE so
 * this endpoint surfaces it. The registry is the single source of
 * truth for "what depends on env vars".
 */
const INTEGRATIONS = [
  {
    name: 'database',
    vars: ['DATABASE_URL'],
    feature: 'Postgres — auth, subscriptions, all persistence',
    severity: 'critical',
  },
  {
    name: 'jwt',
    vars: ['JWT_SECRET'],
    feature: 'Session signing — login/refresh',
    severity: 'critical',
  },
  {
    name: 'stripe',
    vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    feature: 'Subscription billing + webhook verification',
    severity: 'critical',
  },
  {
    name: 'resend',
    vars: ['RESEND_API_KEY'],
    feature: 'Transactional email (signup notifications, alerts, lifecycle)',
    severity: 'high',
  },
  {
    name: 'anthropic',
    vars: ['ANTHROPIC_API_KEY'],
    feature: 'AI Deal Analyzer + property analysis',
    severity: 'high',
  },
  {
    name: 'openai',
    vars: ['OPENAI_API_KEY'],
    feature: 'AI photo analysis + GPT-backed features',
    severity: 'medium',
  },
  {
    name: 'zillow_rapidapi',
    vars: ['ZILLOW_RAPIDAPI_KEY'],
    feature: 'Zillow Scraper proxy — property search, comps, agent data',
    severity: 'critical',
  },
  {
    name: 'propdata_rapidapi',
    vars: ['PROPDATA_RAPIDAPI_KEY'],
    feature: 'Off-market property data (absentee owner search)',
    severity: 'high',
  },
  {
    name: 'skip_trace',
    vars: ['RAPIDAPI_KEY'],
    feature: 'Skip tracing — owner phone/email lookup (Pro/Elite)',
    severity: 'high',
  },
  {
    name: 'meta_ads_reporting',
    vars: ['META_ACCESS_TOKEN'],
    feature: 'Daily Meta ads spend report (read-only)',
    severity: 'low',
  },
  {
    name: 'meta_capi',
    vars: ['META_PIXEL_ID', 'META_CAPI_ACCESS_TOKEN'],
    feature: 'Meta CAPI Purchase events from Stripe — paid-conversion attribution',
    severity: 'high',
  },
  {
    name: 'twilio',
    vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    feature: 'Outbound SMS (sequences)',
    severity: 'medium',
  },
  {
    name: 'plivo',
    vars: ['PLIVO_AUTH_ID', 'PLIVO_AUTH_TOKEN', 'PLIVO_PHONE_NUMBER'],
    feature: 'Alternative SMS provider (sequences)',
    severity: 'medium',
  },
  {
    name: 'mapbox',
    vars: ['MAPBOX_ACCESS_TOKEN'],
    feature: 'Map tiles + geocoding',
    severity: 'medium',
  },
  {
    name: 'mcp',
    vars: ['MCP_API_KEY'],
    feature: 'MCP tool API access',
    severity: 'low',
  },
];

router.get('/integrations', authenticate, asyncHandler(async (_req, res) => {
  const items = INTEGRATIONS.map(({ name, vars, feature, severity }) => {
    const pres = presence(vars);
    const setCount = Object.values(pres).filter(Boolean).length;
    let status;
    if (setCount === vars.length) status = 'ok';
    else if (setCount === 0) status = 'missing';
    else status = 'partial';
    return { name, status, severity, feature, vars: pres };
  });

  // Overall: 'ok' if all critical+high are ok. Used by uptime probes.
  const criticalOrHigh = items.filter((i) => i.severity === 'critical' || i.severity === 'high');
  const anyDegraded = criticalOrHigh.some((i) => i.status !== 'ok');
  const overall = anyDegraded ? 'degraded' : 'ok';

  res.json({
    overall,
    timestamp: new Date().toISOString(),
    integrations: items,
    counts: {
      ok: items.filter((i) => i.status === 'ok').length,
      partial: items.filter((i) => i.status === 'partial').length,
      missing: items.filter((i) => i.status === 'missing').length,
    },
  });
}));

module.exports = router;
