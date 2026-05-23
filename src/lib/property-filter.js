/**
 * Filter properties by their listing age. Used by the "Listed within" search
 * filter to cut out stale listings — the underlying Zillow / RapidAPI feed
 * returns every active listing regardless of when it hit the MLS, and on a
 * city-wide search that floods the result set with months-old inventory and
 * dilutes the freshest opportunities.
 *
 * Age-source chain (first non-null wins):
 *   1. property.daysOnMarket  (numeric, from Zillow's daysOnZillow field)
 *   2. property.listDate      (ISO-ish string, from MLS on-market date)
 *   3. property.datePostedString (ISO-ish string, from price-change / repost)
 *
 * Why the fallback chain: `daysOnMarket` is the primary field BUT it's only
 * sourced from `property_daysOnZillow` / `days_on_zillow` / `daysOnMarket`
 * variants (zillow-api.ts:394). Zillow's search payload sometimes omits all
 * three (notably on FSBO and recently-relisted properties). Both `listDate`
 * (5 fallback field names) and `datePostedString` (8 fallback field names)
 * have wider source coverage — so parsing them is a more reliable cross-check.
 *
 * Unknown-age policy: when none of the three sources resolve, the property is
 * INCLUDED in the result set (not silently dropped). Rationale — a freshly-
 * listed FSBO with a missing daysOnZillow field is exactly what a user picking
 * "Last 7 days" wants to see, and the cost of one stale listing slipping
 * through is far lower than the cost of hiding a genuine fresh deal.
 *
 * Plain JS / ESM so node:test can run without a transpiler — matches
 * auction-detection.js, comps-similarity.js.
 *
 * @typedef {object} PropertyLike
 * @property {number} [daysOnMarket]
 * @property {string} [listDate]
 * @property {string} [datePostedString]
 *
 * @param {PropertyLike} property
 * @param {Date} [now=new Date()]
 * @returns {number | undefined}
 */
export function effectiveDaysOnMarket(property, now = new Date()) {
  if (typeof property?.daysOnMarket === 'number' && property.daysOnMarket >= 0) {
    return property.daysOnMarket;
  }
  for (const raw of [property?.listDate, property?.datePostedString]) {
    if (typeof raw !== 'string' || raw.length === 0) continue;
    const parsed = new Date(raw);
    const ts = parsed.getTime();
    if (!Number.isFinite(ts)) continue;
    const days = Math.floor((now.getTime() - ts) / (1000 * 60 * 60 * 24));
    if (days < 0) continue; // future-dated → treat as unknown
    return days;
  }
  return undefined;
}

/**
 * @template {PropertyLike} P
 * @param {P[]} properties
 * @param {string | undefined} maxDaysOnMarket - numeric string ("7"/"14"/...)
 * @param {Date} [now=new Date()]
 * @returns {P[]}
 */
export function filterByMaxDaysOnMarket(properties, maxDaysOnMarket, now = new Date()) {
  if (!maxDaysOnMarket || maxDaysOnMarket === 'any') return properties;
  const maxDays = Number(maxDaysOnMarket);
  if (!Number.isFinite(maxDays) || maxDays <= 0) return properties;
  return properties.filter((p) => {
    const age = effectiveDaysOnMarket(p, now);
    // Unknown age → KEEP. The cost of hiding a genuine fresh deal because
    // Zillow's payload didn't include daysOnZillow is higher than the cost
    // of one stale listing slipping through.
    if (age === undefined) return true;
    return age <= maxDays;
  });
}
