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
 *   - the event itself is malformed (defensive)
 *
 * @param {{key: string|null, oldValue: string|null, newValue: string|null}|null|undefined} event
 * @returns {boolean}
 */
export function shouldClearOnStorageEvent(event) {
  if (!event || typeof event !== 'object') return false;

  if (event.key === null) {
    return true;
  }

  if (!isAuthCriticalKey(event.key)) return false;

  return event.newValue === null || event.newValue === '';
}
