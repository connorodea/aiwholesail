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
 *  Disable knob: `VITE_DISABLE_MULTI_LOCATION_SEARCH=true`. */
export const MULTI_LOCATION_SEARCH_ENABLED = flagFromEnv(
  import.meta.env.VITE_DISABLE_MULTI_LOCATION_SEARCH,
  true,
);
