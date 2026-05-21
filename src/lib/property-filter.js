/**
 * Filter properties by their listing age. Used by the "Listed within" search
 * filter to cut out stale listings — the underlying Zillow / RapidAPI feed
 * returns every active listing regardless of when it hit the MLS, and on a
 * city-wide search that floods the result set with months-old inventory and
 * dilutes the freshest opportunities.
 *
 * Properties without a `daysOnMarket` value are excluded when the filter is
 * active — a missing field is treated as "unknown age," and a user asking
 * for "listed within N days" almost certainly does not want unknowns mixed
 * in. When the filter is not active (undefined / empty / "any"), the input
 * array is returned unchanged.
 *
 * Plain JS / ESM so node:test can run without a transpiler — matches
 * auction-detection.js, comps-similarity.js.
 *
 * @template {{ daysOnMarket?: number }} P
 * @param {P[]} properties
 * @param {string | undefined} maxDaysOnMarket - numeric string ("7"/"14"/...)
 * @returns {P[]}
 */
export function filterByMaxDaysOnMarket(properties, maxDaysOnMarket) {
  if (!maxDaysOnMarket || maxDaysOnMarket === 'any') return properties;
  const maxDays = Number(maxDaysOnMarket);
  if (!Number.isFinite(maxDays) || maxDays <= 0) return properties;
  return properties.filter(
    (p) => typeof p.daysOnMarket === 'number' && p.daysOnMarket <= maxDays,
  );
}
