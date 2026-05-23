/**
 * URL builders for the spread-alert email worker.
 *
 * Extracted from scripts/spread-alert-worker.js so the URL logic is
 * unit-testable in isolation. The fix added by this extraction:
 * `buildPrimaryUrl(deal)` returns `null` when no valid URL can be built
 * (deal lacks both `listing_url` and `zpid`). The pre-extraction worker
 * built a broken URL in that case — `?zpid=&utm_source=alert-email` —
 * which sent users to the in-app page with no property context.
 *
 * Theoretical today (all 22.8K cache rows have both fields), latent as
 * the cache grows. Surfaced by the retrospective code review of #380.
 */

/**
 * Returns the Zillow listing URL for a deal, or null if one can't be
 * built. Order of precedence:
 *   1. `deal.listing_url` if it's an http(s) URL  →  use as-is
 *   2. `deal.listing_url` if it starts with "/"   →  prefix with https://www.zillow.com
 *   3. `deal.zpid` if present                     →  build /homedetails/<zpid>_zpid/ URL
 *   4. otherwise                                  →  null
 *
 * Non-http(s) protocols in `listing_url` (e.g. `javascript:`, `data:`,
 * `file:`) are treated as invalid and fall through. This guards against
 * a malicious cache row embedding XSS into email links.
 *
 * @param {{listing_url?: string|null, zpid?: string|number|null}} deal
 * @returns {string|null}
 */
function zillowUrl(deal) {
  if (!deal || typeof deal !== 'object') return null;
  const lu = typeof deal.listing_url === 'string' ? deal.listing_url.trim() : null;
  if (lu && /^https?:\/\//.test(lu)) return lu;
  if (lu && lu.startsWith('/')) return `https://www.zillow.com${lu}`;
  if (deal.zpid) return `https://www.zillow.com/homedetails/${encodeURIComponent(deal.zpid)}_zpid/`;
  return null;
}

/**
 * Returns the in-app deep-link URL for a given zpid. Used as the
 * "Analyze" CTA in the alert email (secondary action). Callers must
 * gate on `zpid` truthy — passing falsy here produces a broken URL.
 *
 * @param {string|number} zpid
 * @returns {string}
 */
function appPropUrl(zpid) {
  return `https://aiwholesail.com/app?zpid=${encodeURIComponent(zpid)}&utm_source=alert-email`;
}

/**
 * Returns the primary card-click URL for a deal in the alert email.
 * Returns null when no valid URL can be built (the bug fix: pre-
 * extraction the worker emitted a broken `?zpid=&...` URL in that case).
 *
 * Caller renders the image / address cells without a clickable wrapper
 * when this returns null.
 *
 * @param {{listing_url?: string|null, zpid?: string|number|null}} deal
 * @returns {string|null}
 */
function buildPrimaryUrl(deal) {
  return zillowUrl(deal);
}

module.exports = { zillowUrl, appPropUrl, buildPrimaryUrl };
