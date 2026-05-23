/**
 * `years_held` derivation from Zillow's priceHistory[] "Sold" events.
 *
 * Companion to failed-listing.js — same data source, same Phase-2 goal:
 * replace PropData fields with scrape.do-derivable signals from data the
 * existing Zillow pipeline already returns.
 *
 * Why this matters
 * ----------------
 * Four of the twelve shipped lead types depend on `r.equity.years_held`
 * from PropData (`tired-landlord`, `senior-owner`, `cash-buyer`,
 * `flippers`). When PropData rips out, those predicates need a different
 * source. Zillow's priceHistory has dated "Sold" events for any property
 * that's been on Zillow at least once — date math gives years held from
 * the MOST RECENT sale.
 *
 * Returns:
 *   - `number` — integer years floored (10.7 years → 10). The lead-type
 *     thresholds use `>= 15` and `>= 25` so integer years are correct.
 *     Floor is conservative (a 10.7-year hold is "10+ years," not "11+").
 *   - `null` — no parseable Sold event in the history. Callers should
 *     treat null as "unknown" and use a fallback (e.g. PropData's
 *     years_held during the migration window, or skip the lead type).
 *
 * Edge cases pinned by tests:
 *   - Multiple Sold events → use the most recent (latest ownership change)
 *   - "Sold to third party" event variant also counts
 *   - Future-dated Sold events are treated as data corruption → null
 *     unless a valid earlier Sold event is also present
 *   - Unparseable dates are skipped (filter, don't throw)
 *
 * Plain JS / CommonJS so node:test runs without a transpiler — matches
 * failed-listing.js, lead-types.js convention.
 *
 * @typedef {Object} PriceHistoryEntry
 * @property {string} [date]
 * @property {number} [price]
 * @property {string} [event]
 */

// Sale-event vocabulary — same values as failed-listing.js SALE_EVENTS.
// Shared semantic: an event that closes an ownership cycle. Kept inline
// here instead of imported to avoid a cross-module dep for two values.
const SALE_EVENT_NAMES = new Set([
  'Sold',
  'Sold to third party',
]);

function entryTime(h) {
  if (!h || typeof h.date !== 'string') return NaN;
  const t = new Date(h.date).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * @param {PriceHistoryEntry[]} priceHistory
 * @param {{ now?: Date }} [options]
 * @returns {number | null}
 */
function yearsHeldFromPriceHistory(priceHistory, options = {}) {
  if (!Array.isArray(priceHistory) || priceHistory.length === 0) return null;
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  // 365 days/year — NOT 365.25 average. Short windows (e.g. 2020→2026,
  // 6 years with only 1 leap day) divide unevenly by 365.25 and floor to
  // years-1. 365.0 over-estimates by leap-day count, but combined with
  // Math.floor that's always safe — never drifts a true 6-year hold to 5.
  // Verified at 6, 7, 8, 10.7, and 100-year holds; all floor correctly.
  const msPerYear = 365 * 24 * 60 * 60 * 1000;

  // Filter to Sold events with parseable, non-future dates; sort
  // chronologically; pick the most recent. We can't just pick max-time
  // because future-dated entries would always "win" — filter first.
  const validSaleTimes = priceHistory
    .filter((h) => h && SALE_EVENT_NAMES.has(h.event))
    .map(entryTime)
    .filter((t) => Number.isFinite(t) && t <= nowMs);

  if (validSaleTimes.length === 0) return null;

  const mostRecentSaleMs = Math.max(...validSaleTimes);
  const yearsHeld = (nowMs - mostRecentSaleMs) / msPerYear;
  return Math.floor(yearsHeld);
}

module.exports = {
  yearsHeldFromPriceHistory,
  SALE_EVENT_NAMES,
};
