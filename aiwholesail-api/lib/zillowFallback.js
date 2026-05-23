/**
 * Route-layer Zillow fallback wrapper.
 *
 * Mirrors the agent-tool fallback already in lib/agent/zillowProxy.js but
 * exposed as a tiny helper the REST routes can wrap around their existing
 * direct-axios RapidAPI calls. The shape contract:
 *
 *   - `rapidApiFn` is an async function that performs the RapidAPI call
 *     and returns its response data. It MUST throw on any non-success
 *     (callers do this by checking `r.status >= 400` then throwing).
 *   - `scrapeAction` is a key into the `zillowScrapeDo` module — e.g.
 *     'search', 'propertyDetails', 'taxes', 'foreclosures', 'comps',
 *     'photos'. If the action has no handler, the original RapidAPI error
 *     is rethrown immediately and scrape.do is not attempted.
 *   - `scrapeArgs` is the args object passed to the scrape.do handler.
 *
 * Both backends return the same logical shape via
 * `mapPropertyToRapidApiShape` / `mapListingToSummary`, so the route's
 * downstream code does not need to branch on which backend answered.
 *
 * Failure semantics: if both backends fail, we throw the ORIGINAL
 * RapidAPI error — not the scrape.do error — so the route's existing
 * `catch` blocks see the error shape they always have.
 */

const zillowScrapeDo = require('./scrapers/zillowScrapeDo');

/**
 * Run a RapidAPI call; on any error, fall back to the scrape.do handler.
 * Both backends return the same logical shape via mapPropertyToRapidApiShape.
 * Throws the original RapidAPI error if both fail (callers keep their
 * existing error-shape expectations).
 *
 * @param {() => Promise<any>} rapidApiFn  Performs the RapidAPI call.
 * @param {string} scrapeAction            Key into zillowScrapeDo (e.g. 'search').
 * @param {object} scrapeArgs              Args object for the scrape.do handler.
 * @returns {Promise<any>}                 Data from whichever backend succeeded.
 */
async function withZillowFallback(rapidApiFn, scrapeAction, scrapeArgs) {
  let rapidErr;
  try {
    return await rapidApiFn();
  } catch (err) {
    rapidErr = err;
  }
  const handler = zillowScrapeDo[scrapeAction];
  if (!handler) throw rapidErr;
  try {
    const data = await handler(scrapeArgs);
    console.warn(
      `[zillow-fallback] RapidAPI failed (${rapidErr.message}); served ${scrapeAction} from scrape.do`
    );
    return data;
  } catch (scrapeErr) {
    console.warn(
      `[zillow-fallback] both backends failed for ${scrapeAction}: rapid=${rapidErr.message} scrape=${scrapeErr.message}`
    );
    throw rapidErr;
  }
}

module.exports = { withZillowFallback };
