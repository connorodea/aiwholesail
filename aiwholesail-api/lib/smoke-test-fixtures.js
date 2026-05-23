/**
 * Per-action ZPID resolver for scripts/smoke-test-zillow-actions.js.
 *
 * Why this exists: three of the 27 smoke-test actions (walkScore,
 * climateRisk, rentalComps) require properties that Zillow has the
 * specific widget for. The default ZPID is an Austin TX listing that
 * does not surface those widgets, so the smoke test produces
 * predictable false-negative "no_data_in_payload" failures. This
 * helper lets operators inject real per-action fixtures via env vars
 * without editing the script.
 *
 * Operator workflow:
 *   1. Find a property on zillow.com that has walkScore data (urban,
 *      transit-served). Copy the zpid from the URL.
 *   2. Set the env var before running the smoke test:
 *        AIW_SMOKE_ZPID_WALKSCORE=12345678 node scripts/smoke-test-zillow-actions.js
 *   3. Repeat for AIW_SMOKE_ZPID_CLIMATERISK (a coastal property) and
 *      AIW_SMOKE_ZPID_RENTALCOMPS (a rentable property).
 *
 * Without env overrides, all actions use DEFAULT_ZPID and the 3
 * problematic actions are expected to fail with no_data_in_payload —
 * that's not a bug, it's a fixture mismatch.
 *
 * Filed as task #49 after PR #358 surfaced the noise during live
 * smoke-test runs.
 *
 * Baseline override (TD-106, May 2026):
 *   The baseline DEFAULT_ZPID is also env-overridable via
 *   AIW_SMOKE_DEFAULT_ZPID. Set this to re-point the entire smoke run
 *   at a different listing (e.g. a more-detailed urban property that
 *   populates more Tier A fields) without editing this file. Empty
 *   string or whitespace-only values fall back to FALLBACK_ZPID so
 *   a broken Zillow URL never ships. Per-action overrides
 *   (AIW_SMOKE_ZPID_*) still take precedence for their specific
 *   actions — the baseline override only affects actions without
 *   their own override.
 */

// Known-good Austin, TX listing — long-tenured and stable. If this gets
// delisted, swap for another. Live as of 2026-05-12.
const FALLBACK_ZPID = '145656008';

// Operator-overridable baseline. Reads AIW_SMOKE_DEFAULT_ZPID at module-load
// time. Empty/whitespace-only values fall through to FALLBACK_ZPID so the
// smoke test never constructs a broken Zillow URL.
const DEFAULT_ZPID = (() => {
  const raw = process.env.AIW_SMOKE_DEFAULT_ZPID;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return FALLBACK_ZPID;
})();

// Per-action env-var names. Adding a new entry here documents the
// override convention for operators; the helper does the env lookup
// at call time so test/runtime env injection works.
const ACTION_ZPID_ENV = {
  walkScore: 'AIW_SMOKE_ZPID_WALKSCORE',
  climateRisk: 'AIW_SMOKE_ZPID_CLIMATERISK',
  rentalComps: 'AIW_SMOKE_ZPID_RENTALCOMPS',
};

/**
 * Resolve the ZPID for a given action.
 *
 * If the action has an env-var convention in ACTION_ZPID_ENV and the
 * env var is set to a non-empty value, return it (trimmed). Otherwise
 * return DEFAULT_ZPID.
 *
 * Whitespace trimming handles shells that quote env values with
 * trailing whitespace. Empty string falls back to DEFAULT_ZPID rather
 * than producing a broken Zillow URL.
 *
 * @param {string} action — action name (walkScore, climateRisk, …)
 * @returns {string} ZPID
 */
function zpidFor(action) {
  const envName = ACTION_ZPID_ENV[action];
  if (envName) {
    const raw = process.env[envName];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }
  }
  return DEFAULT_ZPID;
}

module.exports = { DEFAULT_ZPID, ACTION_ZPID_ENV, zpidFor };
