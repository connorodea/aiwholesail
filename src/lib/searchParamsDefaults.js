// Default values + merge helper for replaying stored recent-search entries.
//
// Problem this solves: PR #428 stored the full PropertySearchParams object in
// localStorage. When the params shape gains a new field later (e.g. a new
// toggle defaults to ON), older entries replay with that key MISSING —
// React's setSearchParams(stored) then drops the new default and the user
// silently gets the wrong behavior. Reviewer Issue #10 on PR #428.
//
// Fix: shallow-merge stored entry over defaults so missing keys fall back.
// Caller passes ON_MARKET_DEFAULTS to applyHistoryDefaults at replay time;
// the initial useState in PropertySearch.tsx also references this constant
// so the defaults stay in lockstep.

/**
 * Canonical defaults for the on-market property-search form. Must match the
 * initial useState in src/components/PropertySearch.tsx — the test pins the
 * presence of the load-bearing keys.
 *
 * Frozen so the module-level constant cannot be accidentally mutated by a
 * caller. Both `useState(() => ({ ...ON_MARKET_DEFAULTS }))` and
 * `applyHistoryDefaults` already produce fresh objects, but freezing makes
 * that defense-in-depth rather than load-bearing on every call site
 * remembering to spread.
 *
 * @type {Readonly<{ location: string; homeType: string; wholesaleOnly: boolean }>}
 */
export const ON_MARKET_DEFAULTS = Object.freeze({
  location: '',
  homeType: 'Houses, Townhomes, Multi-family, Condos/Co-ops',
  wholesaleOnly: true,
});

/**
 * Shallow-merge a stored history entry over the current defaults. Stored
 * values win for keys they have; missing keys come from defaults. Always
 * returns a fresh object — safe to mutate, safe to pass to a state setter.
 *
 * @template T
 * @param {Partial<T>} stored
 * @param {T} defaults
 * @returns {T}
 */
export function applyHistoryDefaults(stored, defaults) {
  return { ...defaults, ...stored };
}
