/**
 * Frontend mirror of `aiwholesail-api/lib/years-held.js`.
 *
 * The Vite `@/*` alias resolves to `./src/*` only, so the frontend can't
 * reach the backend file directly. Convention (matches lead-types.js /
 * lead-types.ts, failed-listing.js mirror): both files hold IDENTICAL
 * pure logic, kept in sync by canary tests in
 * `src/lib/__tests__/years-held.test.js` plus the exhaustive 14-case
 * suite in `aiwholesail-api/test/lib/years-held.test.js`.
 *
 * If you change the derivation semantics in one file, change them in the
 * other in the same PR. Same-day same-PR sync — no flag-gated drift.
 *
 * @typedef {Object} PriceHistoryEntry
 * @property {string} [date]
 * @property {number} [price]
 * @property {string} [event]
 */

export const SALE_EVENT_NAMES = new Set([
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
export function yearsHeldFromPriceHistory(priceHistory, options = {}) {
  if (!Array.isArray(priceHistory) || priceHistory.length === 0) return null;
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  // 365 days/year — see backend file for the rationale (short windows
  // with varying leap-day counts drift under 365.25 average).
  const msPerYear = 365 * 24 * 60 * 60 * 1000;

  const validSaleTimes = priceHistory
    .filter((h) => h && SALE_EVENT_NAMES.has(h.event))
    .map(entryTime)
    .filter((t) => Number.isFinite(t) && t <= nowMs);

  if (validSaleTimes.length === 0) return null;

  const mostRecentSaleMs = Math.max(...validSaleTimes);
  const yearsHeld = (nowMs - mostRecentSaleMs) / msPerYear;
  return Math.floor(yearsHeld);
}
