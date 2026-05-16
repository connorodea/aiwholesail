// Pure logic for detecting an "auth-storm" — multiple consecutive auth-coded
// 401 responses fired in a tight window. When the threshold trips, the api
// client clears localStorage + notifies auth listeners proactively, BEFORE
// the render loop forms that triggered the 2026-05-15 PLEASE-FIX incident
// (user trapped in ErrorBoundary because useFavorites + useSubscription kept
// firing → 401 → setState → re-render → 401 again).
//
// Design contract:
//
//   - Stateful detector held in this module. ONE instance per page lifetime
//     (per JS process). HMR-safe because the singleton is allocated lazily
//     inside getDetector() and `_resetForTests()` is the only escape hatch.
//
//   - "Auth-coded" 401 means the response body's `code` field is one of
//     `TOKEN_EXPIRED` / `NOT_AUTHENTICATED` / `INVALID_TOKEN`. A bare 401
//     from an unconfigured service or misrouted endpoint does NOT count.
//     Mitigates the counter-argument that we'd mask a genuine API outage.
//
//   - Window-based, not request-count-based. 5 auth-401s within 10s → trip.
//     Slower bursts (e.g. one 401 every 30s from a flaky background poller)
//     never trip — those are the genuine "stale token, please refresh" case
//     the existing TOKEN_EXPIRED branch already handles.
//
//   - One trip per session. Once the detector trips it is *latched* — won't
//     re-trip until `recordSuccess()` is observed (i.e., the user signs in
//     again successfully and the api client sees a 2xx). Prevents a
//     post-storm-clear cascade from re-tripping immediately while the
//     in-flight retries flush.
//
//   - Pure module. No fetch, no localStorage, no React. Caller passes `now`
//     so tests can advance a virtual clock without sleeping.
//
// JS + JSDoc per the in-repo `auth-coherence.js` / `locationValidation.js`
// convention so the test file can require it directly with node:test.

export const STORM_THRESHOLD = 5;
export const STORM_WINDOW_MS = 10_000;

/** @type {Set<string>} */
export const AUTH_FAILURE_CODES = new Set([
  'TOKEN_EXPIRED',
  'NOT_AUTHENTICATED',
  'INVALID_TOKEN',
]);

/**
 * @typedef {Object} StormState
 * @property {number} count - count of auth-failures inside the current window
 * @property {number} windowStart - epoch ms at which the current window started
 * @property {boolean} tripped - true once the detector has tripped this session
 */

/**
 * @typedef {Object} StormDetector
 * @property {(now: number) => {shouldTrip: boolean}} recordAuthFailure
 * @property {() => void} recordSuccess
 * @property {() => StormState} getState
 */

/** @returns {StormDetector} */
export function createDetector() {
  let count = 0;
  let windowStart = 0;
  let tripped = false;

  return {
    recordAuthFailure(now) {
      // Already tripped this session — don't trip again until the caller
      // observes a 2xx (which clears `tripped`). Prevents in-flight 401s
      // from re-firing the storm response after we've already cleared.
      if (tripped) return { shouldTrip: false };

      // First-ever 401, or 401 outside the previous window → start fresh.
      if (count === 0 || now - windowStart > STORM_WINDOW_MS) {
        count = 1;
        windowStart = now;
        return { shouldTrip: false };
      }

      count += 1;
      if (count >= STORM_THRESHOLD) {
        tripped = true;
        return { shouldTrip: true };
      }
      return { shouldTrip: false };
    },

    recordSuccess() {
      count = 0;
      windowStart = 0;
      tripped = false;
    },

    getState() {
      return { count, windowStart, tripped };
    },
  };
}

// Module-level singleton. Lazy so tests can use createDetector() in isolation.
/** @type {StormDetector|null} */
let _singleton = null;

/** @returns {StormDetector} */
export function getDetector() {
  if (!_singleton) _singleton = createDetector();
  return _singleton;
}

/** Test hook — reset the module singleton. */
export function _resetForTests() {
  _singleton = null;
}
