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

  const validSaleTimes = priceHistory
    .filter((h) => h && SALE_EVENT_NAMES.has(h.event))
    .map(entryTime)
    .filter((t) => Number.isFinite(t) && t <= nowMs);

  if (validSaleTimes.length === 0) return null;

  // Calendar arithmetic — see backend file for the boundary-bug rationale.
  // Reviewer fix 2026-05-23: 365-day approximation false-fired senior-owner
  // (`>=25`) and tired-landlord (`>=15`) thresholds at off-anniversary dates.
  const saleDate = new Date(Math.max(...validSaleTimes));
  let years = now.getUTCFullYear() - saleDate.getUTCFullYear();
  const beforeAnniversaryMonth = now.getUTCMonth() < saleDate.getUTCMonth();
  const sameMonthBeforeDay =
    now.getUTCMonth() === saleDate.getUTCMonth() &&
    now.getUTCDate() < saleDate.getUTCDate();
  if (beforeAnniversaryMonth || sameMonthBeforeDay) {
    years -= 1;
  }
  return years;
}
