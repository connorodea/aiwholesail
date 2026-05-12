/**
 * Build-time feature flags.
 *
 * Read once at module load from Vite env vars. Each flag has a sensible
 * default so the absence of the env var means "current production behavior".
 *
 * To roll a feature back in production:
 *   1. Set the corresponding `VITE_DISABLE_*` env var to `true` in the
 *      production deploy environment.
 *   2. Re-build (CI or `npm run build`).
 *   3. No code revert required.
 *
 * When the runtime `useFeatureFlag` system (PR #feat/feature-flags) lands,
 * these constants can be replaced with `useFeatureFlag(slug).enabled` for
 * per-user / instant-flip control.
 */

function flagFromEnv(envValue: unknown, defaultEnabled: boolean): boolean {
  if (envValue === undefined || envValue === null || envValue === '') {
    return defaultEnabled;
  }
  const v = String(envValue).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return false; // disable env present
  return defaultEnabled;
}

/** Multi-ZIP fan-out + ZIP-radius search on the main /app dashboard.
 *  Build-time disable knob: `VITE_DISABLE_MULTI_LOCATION_SEARCH=true`. */
export const MULTI_LOCATION_SEARCH_BUILD_ENABLED = flagFromEnv(
  import.meta.env.VITE_DISABLE_MULTI_LOCATION_SEARCH,
  true,
);

/** Dogfood allowlist for the main-search multi-location feature. While the
 *  runtime feature-flag system (PR #feat/feature-flags) is still in flight,
 *  we gate the new behavior to a hardcoded list of internal users so the
 *  team can dogfood before flipping it on for everyone.
 *
 *  Lower-cased; compared against `user.email?.toLowerCase()`.
 *  Sourced from `VITE_MULTI_LOCATION_SEARCH_DOGFOOD` (comma-separated) so
 *  ops can extend it without a code change. Defaults to the founder. */
const DOGFOOD_RAW = (import.meta.env.VITE_MULTI_LOCATION_SEARCH_DOGFOOD as string | undefined)
  ?? 'cpodea5@gmail.com';
const DOGFOOD_ALLOWLIST = new Set(
  DOGFOOD_RAW.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
);

/** Returns true when the current user should see multi-location search.
 *  Both gates must pass:
 *   - build-time flag not killed
 *   - user is in the dogfood allowlist (or allowlist is empty = open to all) */
export function isMultiLocationSearchEnabled(userEmail: string | null | undefined): boolean {
  if (!MULTI_LOCATION_SEARCH_BUILD_ENABLED) return false;
  if (DOGFOOD_ALLOWLIST.size === 0) return true; // empty allowlist = open beta
  if (!userEmail) return false;
  return DOGFOOD_ALLOWLIST.has(userEmail.trim().toLowerCase());
}

/** @deprecated Use `isMultiLocationSearchEnabled(user.email)` instead.
 *  Kept temporarily so older call sites compile while migrating. */
export const MULTI_LOCATION_SEARCH_ENABLED = MULTI_LOCATION_SEARCH_BUILD_ENABLED;

/** Main-search layout v2: Location + radius side-by-side, tightened copy.
 *  Default OFF for everyone; ON for the dogfood allowlist while we
 *  validate the new layout on prod. Kill switch:
 *  `VITE_DISABLE_MAIN_SEARCH_LAYOUT_V2=true`. */
const MAIN_SEARCH_LAYOUT_V2_BUILD_ENABLED = flagFromEnv(
  import.meta.env.VITE_DISABLE_MAIN_SEARCH_LAYOUT_V2,
  true,
);

const LAYOUT_V2_DOGFOOD_RAW =
  (import.meta.env.VITE_MAIN_SEARCH_LAYOUT_V2_DOGFOOD as string | undefined)
  ?? 'cpodea5@gmail.com';
const LAYOUT_V2_DOGFOOD_ALLOWLIST = new Set(
  LAYOUT_V2_DOGFOOD_RAW.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
);

/** Returns true when the current user should see the v2 search layout
 *  (Location + radius inline). Empty allowlist = open to all. */
export function isMainSearchLayoutV2Enabled(userEmail: string | null | undefined): boolean {
  if (!MAIN_SEARCH_LAYOUT_V2_BUILD_ENABLED) return false;
  if (LAYOUT_V2_DOGFOOD_ALLOWLIST.size === 0) return true;
  if (!userEmail) return false;
  return LAYOUT_V2_DOGFOOD_ALLOWLIST.has(userEmail.trim().toLowerCase());
}
