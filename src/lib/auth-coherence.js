// Pure helpers for cross-tab auth-state coherence.
//
// PR #376 self-heals zombie sessions at MOUNT time. This module adds
// the runtime piece: a pure function that decides whether a window
// `storage` event represents the removal of an auth-critical
// localStorage key — i.e. a cross-tab signout, a DevTools clear, or
// a browser quota eviction. The api-client.ts listener consumes
// `shouldClearOnStorageEvent` to push `notifyAuthChange(null)` and
// keep the React user state coherent with localStorage.
//
// Pure JS / ESM so the tests run under `node --test` without a
// transpiler — mirrors auction-detection.js (PR #408),
// comps-similarity.js (PR #371), comps-location-parser.js (PR #380).

export const AUTH_STORAGE_KEYS = Object.freeze({
  ACCESS_TOKEN: 'aiwholesail_access_token',
  REFRESH_TOKEN: 'aiwholesail_refresh_token',
  USER: 'aiwholesail_user',
});

const AUTH_KEY_SET = new Set([
  AUTH_STORAGE_KEYS.ACCESS_TOKEN,
  AUTH_STORAGE_KEYS.REFRESH_TOKEN,
  AUTH_STORAGE_KEYS.USER,
]);

/**
 * Returns true when `key` is one of the localStorage keys that gate the
 * frontend auth coherence check.
 *
 * @param {string|null|undefined} key
 * @returns {boolean}
 */
export function isAuthCriticalKey(key) {
  return typeof key === 'string' && AUTH_KEY_SET.has(key);
}

/**
 * Returns true when a window `storage` event signals that the auth
 * state has been torn down outside of this tab — either:
 *   - `key === null` (full `localStorage.clear()` from any tab / devtools)
 *   - an auth-critical key was removed (`newValue` is null or empty)
 *
 * Returns false when:
 *   - the changed key is unrelated to auth
 *   - the event represents a set/rotation (newValue is a non-empty string)
 *   - the event targets sessionStorage, not localStorage (different area)
 *   - the event itself is malformed (defensive)
 *
 * Defensive against synthetic `dispatchEvent(new StorageEvent(...))` calls
 * from third-party scripts or browser extensions: the native API only
 * sets `storageArea` to the actual `localStorage` reference, so events
 * for other areas (or no area) are ignored. Tests should set
 * `event.storageArea` to a sentinel matching the optional `localStorageRef`
 * parameter to assert this branch.
 *
 * @param {{key: string|null, oldValue: string|null, newValue: string|null, storageArea?: Storage}|null|undefined} event
 * @param {Storage|null} [localStorageRef] Reference used to identify
 *   localStorage events. When omitted, the storageArea check is skipped
 *   (preserves pre-existing test ergonomics — tests that don't care
 *   about area-filtering can pass synthetic events without a storageArea).
 * @returns {boolean}
 */
export function shouldClearOnStorageEvent(event, localStorageRef) {
  if (!event || typeof event !== 'object') return false;

  // If a reference was provided AND the event carries a storageArea,
  // require they match. Synthetic events without `storageArea` fall
  // through to the rest of the predicate — keeps the test surface lean.
  if (localStorageRef !== undefined && localStorageRef !== null) {
    if (event.storageArea !== undefined && event.storageArea !== localStorageRef) {
      return false;
    }
  }

  if (event.key === null) {
    return true;
  }

  if (!isAuthCriticalKey(event.key)) return false;

  return event.newValue === null || event.newValue === '';
}

/**
 * Canonical feature-flag slug for the cross-tab storage listener. Frozen
 * so a refactor can't silently rename and disable the kill switch.
 * DB row lives in `feature_flag_globals`; user overrides in
 * `feature_flag_users`. Default OFF — per the global flag-first workflow,
 * the listener stays inert until the row is flipped on for cpodea5,
 * then ramped via rollout_pct.
 */
export const AUTH_STORAGE_LISTENER_FLAG = 'auth-storage-listener';

/**
 * Decides whether the cross-tab storage listener should act. The listener
 * is registered unconditionally at module load (HMR-safe, idempotent) but
 * its callback body short-circuits via this predicate so it can be killed
 * by flipping the DB flag without a code revert.
 *
 * @param {() => boolean | undefined} getFlag - sync flag-cache lookup
 *   (typically `() => getFlagFromCache(AUTH_STORAGE_LISTENER_FLAG)`).
 *   Must return undefined when the cache is cold; any value other than
 *   strict-equal `true` is treated as off (fail closed).
 * @returns {boolean}
 */
export function isAuthStorageListenerEnabled(getFlag) {
  if (typeof getFlag !== 'function') return false;
  try {
    return getFlag() === true;
  } catch {
    return false;
  }
}
