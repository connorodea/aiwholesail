/**
 * Failed-listing predicate — Phase 2d of the off-market lead-type
 * expansion (PR #281 tracker, "Todoist Phase 2d").
 *
 * A "failed listing" is a property that was on the MLS in the recent past
 * but went off-market WITHOUT selling. Strong motivation signal: the
 * owner tried to sell on retail, couldn't get their price, gave up — but
 * they STILL want out. Direct-to-seller wholesalers target this segment
 * because the seller has already accepted the idea of selling and is now
 * receptive to off-market offers, often at a discount.
 *
 * Why scrape.do, not PropData
 * ---------------------------
 * Listing history is Zillow native. The existing scrape.do-backed Zillow
 * pipeline already returns `priceHistory[]` arrays (aiwholesail-api/lib/
 * scrapers/zillowScrapeDo.js:362). No new vendor needed — this lead type
 * is derivable from data we already collect for on-market search.
 *
 * Data shape — `zillowRecord.priceHistory` is an array of:
 *   { date: 'YYYY-MM-DD', price: number, event: string }
 *
 * Observed `event` values in production Zillow payloads:
 *   - 'Listed for sale'           — start of an active listing window
 *   - 'Listing removed'           — withdrawn / cancelled by seller
 *   - 'Price change'              — mid-listing price drop
 *   - 'Sold'                      — successful close
 *   - 'Listed for rent'           — rental, not for-sale
 *   - 'Pending sale'              — under contract (still a candidate for
 *                                   future failure if it falls through)
 *
 * Lives in plain JS / CommonJS so node:test runs it without a transpiler
 * — matches lead-types.js, auction-detection.js, comps-similarity.js.
 *
 * @typedef {Object} PriceHistoryEntry
 * @property {string} [date]   ISO-ish date
 * @property {number} [price]
 * @property {string} [event]
 *
 * @typedef {Object} ZillowRecordLike
 * @property {string} [homeStatus]              FOR_SALE, RECENTLY_SOLD, etc.
 * @property {PriceHistoryEntry[]} [priceHistory]
 */

// Months of lookback for a listing to count as "recent enough" to signal
// motivation. Listings withdrawn >18 months ago are stale — owner may have
// rented it out, refinanced, or genuinely changed plans. 18mo is the sweet
// spot per PropStream's product copy on the equivalent feature.
const DEFAULT_LOOKBACK_MONTHS = 18;

// Events that mark the start of an active for-sale listing window.
const LISTING_START_EVENTS = new Set([
  'Listed for sale',
  'Back on market',
  'Relisted',
]);

// Events that mark a successful sale — disqualifies the property from
// "failed listing" classification regardless of any subsequent withdrawal.
const SALE_EVENTS = new Set([
  'Sold',
  'Sold to third party',
]);

// Events that mark withdrawal without sale — the "failure" signal.
const WITHDRAW_EVENTS = new Set([
  'Listing removed',
  'Listing withdrawn',
  'Off market',
  'Cancelled',
]);

// homeStatus values that mean "currently for sale" — if currently active,
// the listing hasn't "failed" yet (it's still trying).
const CURRENTLY_ACTIVE_STATUSES = new Set([
  'FOR_SALE',
  'AUCTION',
  'PENDING',
  'CONTINGENT',
]);

/**
 * Parse a priceHistory entry's date into an epoch ms timestamp. Returns
 * NaN for unparseable values so callers can filter them out.
 * @param {PriceHistoryEntry} h
 */
function entryTime(h) {
  if (!h || typeof h.date !== 'string') return NaN;
  const t = new Date(h.date).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Return true iff the Zillow record looks like a failed listing — was
 * listed in the lookback window, then removed, and never sold after
 * the listing started.
 *
 * Inclusive-on-unknown policy: if priceHistory is missing or empty, return
 * FALSE. This is the OPPOSITE of the listed-within filter policy — for
 * failed-listing we'd rather miss a true positive than flood the result
 * set with un-classifiable records that happen to be off-market.
 *
 * @param {ZillowRecordLike} record
 * @param {object} [options]
 * @param {Date} [options.now]
 * @param {number} [options.lookbackMonths]
 * @returns {boolean}
 */
function isFailedListing(record, options = {}) {
  if (!record || typeof record !== 'object') return false;
  if (CURRENTLY_ACTIVE_STATUSES.has(record.homeStatus)) return false;

  const history = Array.isArray(record.priceHistory) ? record.priceHistory : [];
  if (history.length === 0) return false;

  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const lookbackMonths = Number.isFinite(options.lookbackMonths)
    ? options.lookbackMonths
    : DEFAULT_LOOKBACK_MONTHS;
  // Calendar months — matches the calendar-arithmetic in years-held.js so
  // the two predicates interpret "recent" the same way. Earlier 30.44-day
  // approximation drifted ~2 days from a true 18-mo cutoff. (Reviewer
  // consistency fix 2026-05-23.)
  const cutoffDate = new Date(nowMs);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - lookbackMonths);
  const cutoffTime = cutoffDate.getTime();

  // Sort chronologically (oldest first). Filter future-dated entries
  // (corrupt/bad-clock Zillow payloads) — without this guard a future
  // withdrawal trivially satisfies `t >= cutoffTime` and misfires.
  const chronological = [...history]
    .filter((h) => {
      const t = entryTime(h);
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => entryTime(a) - entryTime(b));

  if (chronological.length === 0) return false;

  // Walk forward tracking the most-recent "listed-for-sale" event. When we
  // hit a withdrawal AFTER a listing-start AND we haven't seen a sale in
  // between, we've found a failed-listing window. Restart on each new
  // listing-start so a relisted property whose latest cycle SOLD doesn't
  // count as failed even if an earlier cycle was withdrawn.
  //
  // Lookback semantic: only the WITHDRAWAL's time is gated. A listing
  // started outside the window but withdrawn inside it counts as
  // "seller gave up recently" — that's the motivation signal we want.
  // Pinned by cross-boundary tests.
  let lastListedAt = NaN;
  let foundFailedInLookback = false;
  for (const h of chronological) {
    const t = entryTime(h);
    if (LISTING_START_EVENTS.has(h.event)) {
      lastListedAt = t;
      foundFailedInLookback = false; // reset — new listing window
    } else if (SALE_EVENTS.has(h.event)) {
      lastListedAt = NaN; // a sale closes the current window
      foundFailedInLookback = false;
    } else if (WITHDRAW_EVENTS.has(h.event) && Number.isFinite(lastListedAt)) {
      // Withdrawal after a listing-start with no sale in between.
      // Counts if the WITHDRAW happened inside the lookback window.
      if (t >= cutoffTime) foundFailedInLookback = true;
    }
  }

  return foundFailedInLookback;
}

/**
 * Companion predicate — returns true iff the record IS currently active
 * for sale AND has a PRIOR failed-listing cycle in its priceHistory
 * within the lookback window. This is the "relisted by motivated seller"
 * signal: the owner tried once, gave up, and is now trying again — they're
 * primed for a direct-to-seller offer because they've already accepted
 * the idea of selling.
 *
 * Why a companion, not a flag: Zillow does NOT expose an "off-market" /
 * "withdrawn" filter in its searchQueryState (verified against the
 * filterState flags in zillowScrapeDo.js: isRecentlySold, isComingSoon,
 * isForSaleByAgent/Owner, isAuction, isForSaleForeclosure, isForRent —
 * no withdrawn filter). That means `isFailedListing` itself has NO
 * region-search discovery mechanism via Zillow alone — finding truly-
 * failed listings requires county recorder data or a temporal property
 * cache (separate work, debate Position C's territory).
 *
 * `hasPreviousFailedListing` IS discoverable today because it operates on
 * currently-for-sale properties — every record returned by an existing
 * region search has priceHistory we can inspect. That makes it the
 * shippable subset of the Phase 2d signal until proper failed-listing
 * discovery lands.
 *
 * @param {ZillowRecordLike} record
 * @param {object} [options]
 * @param {Date} [options.now]
 * @param {number} [options.lookbackMonths]
 * @returns {boolean}
 */
function hasPreviousFailedListing(record, options = {}) {
  if (!record || typeof record !== 'object') return false;
  // Inverse of isFailedListing's status guard — we want CURRENTLY active.
  if (!CURRENTLY_ACTIVE_STATUSES.has(record.homeStatus)) return false;

  const history = Array.isArray(record.priceHistory) ? record.priceHistory : [];
  if (history.length === 0) return false;

  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const lookbackMonths = Number.isFinite(options.lookbackMonths)
    ? options.lookbackMonths
    : DEFAULT_LOOKBACK_MONTHS;
  // Calendar months — same as isFailedListing. Reviewer consistency fix.
  const cutoffDate = new Date(nowMs);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - lookbackMonths);
  const cutoffTime = cutoffDate.getTime();

  // Future-dated entries are filtered — see isFailedListing for rationale.
  const chronological = [...history]
    .filter((h) => {
      const t = entryTime(h);
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => entryTime(a) - entryTime(b));

  if (chronological.length === 0) return false;

  // Two-state walk: track when a listing started, and whether the current
  // (still-open) cycle is the CURRENT one. We only care about *closed*
  // failed cycles — i.e., a listing-start followed by a withdrawal with
  // no sale in between. The currently-active cycle (still on the market
  // right now) doesn't count — by definition it hasn't failed yet.
  //
  // We identify "the current cycle" as the LAST listing-start event in
  // the chronological history that doesn't have a subsequent close (sale
  // or withdrawal). Everything before that is a closed historical cycle.
  let lastListedAt = NaN;
  let hasClosedFailedCycle = false;
  for (const h of chronological) {
    const t = entryTime(h);
    if (LISTING_START_EVENTS.has(h.event)) {
      lastListedAt = t;
    } else if (SALE_EVENTS.has(h.event)) {
      lastListedAt = NaN; // closed by sale — not a failure
    } else if (WITHDRAW_EVENTS.has(h.event) && Number.isFinite(lastListedAt)) {
      // A closed failed cycle.
      if (t >= cutoffTime) hasClosedFailedCycle = true;
      lastListedAt = NaN; // close the cycle
    }
  }

  return hasClosedFailedCycle;
}

module.exports = {
  isFailedListing,
  hasPreviousFailedListing,
  DEFAULT_LOOKBACK_MONTHS,
  LISTING_START_EVENTS,
  SALE_EVENTS,
  WITHDRAW_EVENTS,
  CURRENTLY_ACTIVE_STATUSES,
};
