// Pure filter helpers for the property comp table.
//
// User-controllable filters on the comp set: distance from subject, beds,
// baths, and a sqft tolerance band ("similar size"). All operate client-side
// on already-fetched comps so the UI feels instant.
//
// Conservative defaults: every filter is "any" so the first render shows
// every comp the API returned. Users opt IN to narrowing.
//
// Defensive policy: if either side of a comparison is missing data we keep
// the comp rather than drop it silently — the row will render with a blank
// cell, which is better than disappearing without explanation.
//
// Pattern matches the other pure-JS modules in src/lib/: comps-similarity.js,
// comps-location-parser.js, auction-detection.js, auth-coherence.js.

/**
 * @typedef {'any' | 'exact' | '+/-1'} BedBathTolerance
 *
 * @typedef {Object} CompsFilters
 * @property {number | null} maxDistanceMi   null = any distance
 * @property {BedBathTolerance} bedTolerance
 * @property {BedBathTolerance} bathTolerance
 * @property {number | null} sqftTolerancePct  null = any sqft; otherwise band is +/- this percent
 *
 * @typedef {Object} Subject
 * @property {number} [bedrooms]
 * @property {number} [bathrooms]
 * @property {number} [sqft]
 *
 * @typedef {Object} Comp
 * @property {number} [bedrooms]
 * @property {number} [bathrooms]
 * @property {number} [sqft]
 * @property {number} [distance]   miles from subject
 */

/** Canonical default — every filter set to "any". */
export const DEFAULT_COMPS_FILTERS = Object.freeze({
  maxDistanceMi: null,
  bedTolerance: 'any',
  bathTolerance: 'any',
  sqftTolerancePct: null,
});

/**
 * Square footage within ±tolerancePct of subject.
 * Returns true (keep) when either side is missing.
 */
export function isSqftWithinTolerance(compSqft, subjectSqft, tolerancePct) {
  if (tolerancePct == null) return true;
  if (subjectSqft == null) return true;
  if (compSqft == null) return true;
  const window = subjectSqft * (Number(tolerancePct) / 100);
  return compSqft >= subjectSqft - window && compSqft <= subjectSqft + window;
}

export function matchesBedFilter(compBeds, subjectBeds, tolerance) {
  if (tolerance === 'any') return true;
  if (subjectBeds == null || compBeds == null) return true;
  if (tolerance === 'exact') return Number(compBeds) === Number(subjectBeds);
  if (tolerance === '+/-1') {
    return Math.abs(Number(compBeds) - Number(subjectBeds)) <= 1;
  }
  return true;
}

export function matchesBathFilter(compBaths, subjectBaths, tolerance) {
  if (tolerance === 'any') return true;
  if (subjectBaths == null || compBaths == null) return true;
  if (tolerance === 'exact') return Number(compBaths) === Number(subjectBaths);
  if (tolerance === '+/-1') {
    return Math.abs(Number(compBaths) - Number(subjectBaths)) <= 1;
  }
  return true;
}

export function matchesDistanceFilter(compDistance, maxDistanceMi) {
  if (maxDistanceMi == null) return true;
  if (compDistance == null) return true;
  return Number(compDistance) <= Number(maxDistanceMi);
}

/**
 * Apply all four filters to a comps array. Pure — returns a new array.
 *
 * @param {Comp[]} comps
 * @param {Subject} subject
 * @param {CompsFilters} filters
 * @returns {Comp[]}
 */
export function filterComps(comps, subject, filters) {
  if (!Array.isArray(comps) || comps.length === 0) return [];
  const f = filters || DEFAULT_COMPS_FILTERS;
  const s = subject || {};
  return comps.filter(
    (c) =>
      matchesDistanceFilter(c?.distance, f.maxDistanceMi) &&
      matchesBedFilter(c?.bedrooms, s.bedrooms, f.bedTolerance || 'any') &&
      matchesBathFilter(c?.bathrooms, s.bathrooms, f.bathTolerance || 'any') &&
      isSqftWithinTolerance(c?.sqft, s.sqft, f.sqftTolerancePct),
  );
}
