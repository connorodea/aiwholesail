// Kill switch for the recent-searches chip UI (#428 follow-up).
//
// PR #428 shipped the chip UI un-flagged. Reviewer asked for the standard
// flag-first rollout so the change can be flipped at the DB level without
// a redeploy. This module is the pure-JS predicate; the React layer
// passes the `useFeatureFlag(RECENT_SEARCHES_CHIPS_FLAG)` result through it
// before rendering the chip strip.

/**
 * Canonical feature-flag slug. Frozen so a refactor cannot silently rename
 * and disable the kill switch. Slug-stability test in
 * searchHistoryFlag.test.js pins this.
 */
export const RECENT_SEARCHES_CHIPS_FLAG = 'recent-searches-chips';

/**
 * Strict predicate: only `enabled === true` returns true. Fails closed on
 * undefined (hook not yet rendered), loading state, missing DB row, or any
 * truthy-non-true value. Matches the pattern in auth-coherence.js and
 * brand-flags.js.
 *
 * @param {{enabled?: unknown, loading?: unknown} | undefined | null} result
 *   The shape returned by `useFeatureFlag(slug)`.
 * @returns {boolean}
 */
export function isRecentSearchesChipsEnabled(result) {
  if (!result || typeof result !== 'object') return false;
  return result.enabled === true;
}
