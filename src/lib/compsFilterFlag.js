// Kill switch for the comps-filter UI controls.
//
// New filters (distance, beds, baths, sqft band) ship default-OFF behind
// this flag. Cpodea5 dogfoods on real properties before global rollout.
// Same strict-true predicate pattern as auth-coherence / brand-flags /
// searchHistoryFlag.

export const COMPS_FILTER_CONTROLS_FLAG = 'comps-filter-controls';

/**
 * @param {{enabled?: unknown, loading?: unknown} | null | undefined} result
 * @returns {boolean}
 */
export function isCompsFilterControlsEnabled(result) {
  if (!result || typeof result !== 'object') return false;
  return result.enabled === true;
}
