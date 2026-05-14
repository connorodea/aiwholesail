// Pure helper: rank fallback comps by closeness in beds + sqft to the
// subject property. Lives in plain JS (ESM) so node:test can run
// without a transpiler, mirroring src/lib/seo/comparison-meta.js.
//
// Used by ZillowAPI.getPropertyComps' recently-sold fallback path —
// when the scraper returns many comps in the search radius, we want
// the ones structurally similar to the subject (same-ish bed count,
// same-ish square footage), not just the geographically closest.
//
// Rework note: this is the net-new value extracted from PR #93. The
// stale PR also re-implemented radius capping and ZIP-first search,
// both of which already shipped to main. This helper is the *only*
// piece that didn't make it in.
//
// Scoring (lower = more similar):
//   beds penalty  = |comp.beds - subject.beds| * BEDS_WEIGHT
//   sqft penalty  = |comp.sqft - subject.sqft| / 1000 * SQFT_WEIGHT
//   total         = beds penalty + sqft penalty
//
// Comps missing beds OR sqft skip the corresponding penalty rather
// than getting nuked from the ranking — distance order then carries
// them. Subjects missing beds/sqft are a no-op (sort by distance only).

const BEDS_WEIGHT = 1.0;
const SQFT_WEIGHT = 1.0;

function similarityScore(subject, comp) {
  let score = 0;
  if (subject?.beds && comp?.bedrooms) {
    score += Math.abs(comp.bedrooms - subject.beds) * BEDS_WEIGHT;
  }
  if (subject?.sqft && comp?.sqft) {
    score += (Math.abs(comp.sqft - subject.sqft) / 1000) * SQFT_WEIGHT;
  }
  return score;
}

/**
 * Sort comps by (similarity-to-subject, then distance). Returns a new
 * array — does not mutate input. Subject's beds/sqft are optional;
 * when absent the function falls back to distance-only ordering.
 *
 * @param {{ beds?: number; sqft?: number }} subject
 * @param {Array<object>} comps
 * @returns {Array<object>}
 */
export function rankCompsBySimilarity(subject, comps) {
  if (!Array.isArray(comps) || comps.length === 0) return [];

  // Don't touch the input. The fallback path in getPropertyComps
  // already sorted by distance — we add similarity as the primary key
  // and use distance as the tiebreaker.
  return [...comps]
    .map((c) => ({ comp: c, score: similarityScore(subject, c) }))
    .sort((a, b) => {
      // Primary: similarity score (lower wins).
      if (a.score !== b.score) return a.score - b.score;
      // Tiebreaker: original distance. Null distance treated as far.
      const da = a.comp?.distance ?? 999;
      const db = b.comp?.distance ?? 999;
      return da - db;
    })
    .map((entry) => entry.comp);
}
