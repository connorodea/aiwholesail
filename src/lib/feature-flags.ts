/**
 * Multi-location search feature flag.
 *
 * The original implementation (PR #176) was build-time + email-allowlist
 * gated via `VITE_*` env vars. That worked but required a redeploy to
 * flip a user in/out.
 *
 * Since the DB-backed feature flag system shipped (PR #174), this file is
 * a thin shim that prefers the DB-backed flag (`main-search-multi-location`)
 * and falls back to the env-var allowlist if the flag cache is cold or
 * the DB row is missing. Existing call sites — both the React component in
 * PropertySearch and the imperative path in RealEstateWholesaler — keep
 * the same `isMultiLocationSearchEnabled(email)` signature.
 *
 * Rollout knobs:
 *   - DB flip (preferred, instant, per-user):
 *       INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
 *         SELECT id, 'main-search-multi-location', true, 'beta'
 *         FROM users WHERE email = '<user>';
 *   - Global rollout %:
 *       UPDATE feature_flag_globals
 *         SET enabled = true, rollout_pct = 50
 *         WHERE slug = 'main-search-multi-location';
 *   - Build-time env-var fallback (legacy, still supported):
 *       VITE_DISABLE_MULTI_LOCATION_SEARCH=true       (master off)
 *       VITE_MULTI_LOCATION_SEARCH_DOGFOOD="a@b,c@d"  (allowlist)
 *
 * The build-time kill switch always wins — short-circuits the DB lookup
 * too — so the "redeploy with kill switch = guaranteed off" rollback
 * guarantee from PR #176 is preserved.
 */

import { getFlagFromCache } from '@/hooks/useFeatureFlag';

const FLAG_SLUG = 'main-search-multi-location';

function flagFromEnv(envValue: unknown, defaultEnabled: boolean): boolean {
  if (envValue === undefined || envValue === null || envValue === '') {
    return defaultEnabled;
  }
  const v = String(envValue).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return false;
  return defaultEnabled;
}

/** Build-time master kill switch (legacy env-var rollback path). */
export const MULTI_LOCATION_SEARCH_BUILD_ENABLED = flagFromEnv(
  import.meta.env.VITE_DISABLE_MULTI_LOCATION_SEARCH,
  true,
);

const DOGFOOD_RAW = (import.meta.env.VITE_MULTI_LOCATION_SEARCH_DOGFOOD as string | undefined)
  ?? 'cpodea5@gmail.com';
const DOGFOOD_ALLOWLIST = new Set(
  DOGFOOD_RAW.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
);

function envAllowlistAllows(userEmail: string | null | undefined): boolean {
  if (DOGFOOD_ALLOWLIST.size === 0) return true; // empty allowlist = open beta
  if (!userEmail) return false;
  return DOGFOOD_ALLOWLIST.has(userEmail.trim().toLowerCase());
}

/**
 * True when the current user should see multi-location search.
 *
 * Resolution:
 *   1. Build-time kill switch off → false. Hard override, no further checks.
 *   2. DB-backed flag cache has a value for this user → use it.
 *   3. Cache cold or no DB row → fall back to env-var allowlist.
 *
 * Once at least one component on the page has mounted `useFeatureFlag(...)`
 * (every PropertySearch render does, transitively), the cache populates and
 * the DB-backed answer takes over.
 */
export function isMultiLocationSearchEnabled(userEmail: string | null | undefined): boolean {
  if (!MULTI_LOCATION_SEARCH_BUILD_ENABLED) return false;
  const dbAnswer = getFlagFromCache(FLAG_SLUG);
  if (dbAnswer !== undefined) return dbAnswer;
  return envAllowlistAllows(userEmail);
}

/** @deprecated Kept so the old re-export keeps compiling. */
export const MULTI_LOCATION_SEARCH_ENABLED = MULTI_LOCATION_SEARCH_BUILD_ENABLED;
