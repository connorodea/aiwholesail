/**
 * Frontend mirror of `aiwholesail-api/lib/failed-listing.js` (PR #480).
 *
 * The Vite `@/*` alias resolves to `./src/*` only, so the frontend can't
 * reach the backend file directly. Convention (matches lead-types.js /
 * lead-types.ts): both files hold IDENTICAL pure logic, kept in sync by
 * canary tests in `src/lib/__tests__/failed-listing.test.js` and the
 * exhaustive backend suite in `aiwholesail-api/test/lib/failed-listing.test.js`.
 *
 * If you change the predicate semantics in one file, change them in the
 * other in the same PR. Same-day same-PR sync — no flag-gated drift.
 *
 * @typedef {Object} PriceHistoryEntry
 * @property {string} [date]   ISO-ish date
 * @property {number} [price]
 * @property {string} [event]
 *
 * @typedef {Object} ZillowRecordLike
 * @property {string} [homeStatus]
 * @property {PriceHistoryEntry[]} [priceHistory]
 */

export const DEFAULT_LOOKBACK_MONTHS = 18;

export const LISTING_START_EVENTS = new Set([
  'Listed for sale',
  'Back on market',
  'Relisted',
]);

export const SALE_EVENTS = new Set([
  'Sold',
  'Sold to third party',
]);

export const WITHDRAW_EVENTS = new Set([
  'Listing removed',
  'Listing withdrawn',
  'Off market',
  'Cancelled',
]);

export const CURRENTLY_ACTIVE_STATUSES = new Set([
  'FOR_SALE',
  'AUCTION',
  'PENDING',
  'CONTINGENT',
]);

function entryTime(h) {
  if (!h || typeof h.date !== 'string') return NaN;
  const t = new Date(h.date).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function isFailedListing(record, options = {}) {
  if (!record || typeof record !== 'object') return false;
  if (CURRENTLY_ACTIVE_STATUSES.has(record.homeStatus)) return false;
  const history = Array.isArray(record.priceHistory) ? record.priceHistory : [];
  if (history.length === 0) return false;
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const lookbackMonths = Number.isFinite(options.lookbackMonths)
    ? options.lookbackMonths
    : DEFAULT_LOOKBACK_MONTHS;
  // Calendar months (matches backend `aiwholesail-api/lib/failed-listing.js`).
  // Reviewer consistency fix 2026-05-23 — see backend file for rationale.
  const cutoffDate = new Date(nowMs);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - lookbackMonths);
  const cutoffTime = cutoffDate.getTime();
  // Future-dated entries filtered (corrupt Zillow payloads).
  const chronological = [...history]
    .filter((h) => {
      const t = entryTime(h);
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => entryTime(a) - entryTime(b));
  if (chronological.length === 0) return false;
  let lastListedAt = NaN;
  let foundFailedInLookback = false;
  for (const h of chronological) {
    const t = entryTime(h);
    if (LISTING_START_EVENTS.has(h.event)) {
      lastListedAt = t;
      foundFailedInLookback = false;
    } else if (SALE_EVENTS.has(h.event)) {
      lastListedAt = NaN;
      foundFailedInLookback = false;
    } else if (WITHDRAW_EVENTS.has(h.event) && Number.isFinite(lastListedAt)) {
      if (t >= cutoffTime) foundFailedInLookback = true;
    }
  }
  return foundFailedInLookback;
}

export function hasPreviousFailedListing(record, options = {}) {
  if (!record || typeof record !== 'object') return false;
  if (!CURRENTLY_ACTIVE_STATUSES.has(record.homeStatus)) return false;
  const history = Array.isArray(record.priceHistory) ? record.priceHistory : [];
  if (history.length === 0) return false;
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const lookbackMonths = Number.isFinite(options.lookbackMonths)
    ? options.lookbackMonths
    : DEFAULT_LOOKBACK_MONTHS;
  // Calendar months (matches backend `aiwholesail-api/lib/failed-listing.js`).
  // Reviewer consistency fix 2026-05-23 — see backend file for rationale.
  const cutoffDate = new Date(nowMs);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - lookbackMonths);
  const cutoffTime = cutoffDate.getTime();
  // Future-dated entries filtered (corrupt Zillow payloads).
  const chronological = [...history]
    .filter((h) => {
      const t = entryTime(h);
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => entryTime(a) - entryTime(b));
  if (chronological.length === 0) return false;
  let lastListedAt = NaN;
  let hasClosedFailedCycle = false;
  for (const h of chronological) {
    const t = entryTime(h);
    if (LISTING_START_EVENTS.has(h.event)) {
      lastListedAt = t;
    } else if (SALE_EVENTS.has(h.event)) {
      lastListedAt = NaN;
    } else if (WITHDRAW_EVENTS.has(h.event) && Number.isFinite(lastListedAt)) {
      if (t >= cutoffTime) hasClosedFailedCycle = true;
      lastListedAt = NaN;
    }
  }
  return hasClosedFailedCycle;
}
