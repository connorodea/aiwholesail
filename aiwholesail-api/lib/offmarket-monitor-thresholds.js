/**
 * Pure threshold logic for the off-market routing monitor — separated
 * from the cron script so it's unit-testable without journalctl, Pool,
 * or Resend.
 *
 * Designed to catch the class of regression that produced the 2026-05-13
 * incident: when v2 lead-type selection included Pre-Foreclosure or
 * Auctions, the whole search collapsed to /api/propdata/preforeclosure
 * and 100% of fan-out calls went to that one endpoint. PR #311 fixed it
 * via getSearchPlanForLeads. These SLIs would have alerted ~10 min after
 * the broken deploy, vs. detection only when the user complained.
 *
 * Each evaluator returns either null (no alert) or
 *   { sli, value, severity, details }
 * which the cron then inserts into monitor_alerts + emails via Resend.
 */

/**
 * Parse one journald JSON line emitted by routes/propdata.js. Tolerant
 * of stripped log prefixes — caller passes raw lines, we throw away
 * anything that isn't valid JSON without complaint.
 */
function parsePropDataLog(line) {
  if (typeof line !== 'string') return null;
  // journald lines may have a syslog prefix before the JSON; find the
  // first '{' and try from there.
  const start = line.indexOf('{');
  if (start < 0) return null;
  try {
    const obj = JSON.parse(line.slice(start));
    if (obj && obj.component === 'propdata') return obj;
    return null;
  } catch {
    return null;
  }
}

/**
 * SLI-2: Preforeclosure / property call-ratio anomaly.
 *
 * The preforeclosure feed is the rare one — auctions + pre-foreclosure
 * only, usually <10% of off-market traffic. Bug pushed ratio to 100%.
 *
 * Threshold: ratio > 0.5 over a sample of ≥10 calls. The min-sample
 * guard prevents low-traffic windows from triggering on 1 of 1 calls.
 */
function evaluateFeedRatio(logs, { minSample = 10, ratioThreshold = 0.5 } = {}) {
  const pf = logs.filter((o) => o && o.endpoint === '/v1/preforeclosure/delta').length;
  const prop = logs.filter((o) => o && o.endpoint === '/v1/property').length;
  const total = pf + prop;
  if (total < minSample) return null;
  const ratio = prop === 0 ? 999 : pf / prop;
  if (ratio <= ratioThreshold) return null;
  return {
    sli: 'offmarket-feed-ratio',
    value: Number(ratio.toFixed(4)),
    severity: 'red',
    details: { preforeclosure_calls: pf, property_calls: prop, threshold: ratioThreshold },
  };
}

/**
 * SLI-4: Per-user 429-burst from PropData.
 *
 * The dual-feed routing bug burned through PropData's 60/min limit
 * faster than expected (25 ZIPs × 2 feeds = 50 calls). Healthy users
 * see at most 1-2 throttles in a session. >5 within 5 min is a strong
 * "the client is misrouting or runaway" signal even when results
 * aren't empty.
 *
 * Threshold: any single user_id with >5 status=429 in the supplied window.
 */
function evaluateUser429Burst(logs, { perUserThreshold = 5 } = {}) {
  const byUser = new Map();
  for (const o of logs) {
    if (!o || o.status !== 429) continue;
    const u = o.user_id || 'anonymous';
    byUser.set(u, (byUser.get(u) || 0) + 1);
  }
  let maxUser = null;
  let maxCount = 0;
  for (const [u, c] of byUser) {
    if (c > maxCount) {
      maxCount = c;
      maxUser = u;
    }
  }
  if (maxCount <= perUserThreshold) return null;
  return {
    sli: 'offmarket-429-burst',
    value: maxCount,
    severity: 'yellow',
    details: { user_id: maxUser, count: maxCount, threshold: perUserThreshold },
  };
}

/**
 * SLI-3: Off-market empty-result rate across multiple users.
 *
 * Catches variant bugs (e.g. a frontend filter regression that produces
 * empty results without changing the upstream feed distribution).
 * Requires ≥3 distinct user_ids to fire — rules out one user with a
 * legitimately empty ZIP. Reads `result_count: 0` events emitted by
 * the offmarket-search log line.
 *
 * Threshold: >25% of search events return 0 results across ≥3 users
 * with a min-sample of 8 events.
 */
function evaluateEmptyResultRate(events, { minSample = 8, emptyPctThreshold = 0.25, minUsers = 3 } = {}) {
  const searchEvents = events.filter((o) => o && o.component === 'offmarket-search');
  if (searchEvents.length < minSample) return null;
  const empties = searchEvents.filter((o) => o.result_count === 0);
  const emptyPct = empties.length / searchEvents.length;
  const distinctEmptyUsers = new Set(empties.map((o) => o.user_id).filter(Boolean));
  if (emptyPct < emptyPctThreshold || distinctEmptyUsers.size < minUsers) return null;
  return {
    sli: 'offmarket-empty-rate',
    value: Number(emptyPct.toFixed(4)),
    severity: 'yellow',
    details: {
      empty: empties.length,
      total: searchEvents.length,
      distinct_empty_users: distinctEmptyUsers.size,
      threshold: emptyPctThreshold,
    },
  };
}

/**
 * SLI-1: Endpoint diversity per off-market search.
 *
 * The highest-specificity catch — requires the route to emit a single
 * line per search summarizing the feeds dispatched (see
 * routes/propdata.js logging additions). A search with ≥3 lead types
 * SHOULD hit ≥2 distinct upstream endpoints; the bug forced 100% of
 * such searches to a single endpoint. Zero false-positive risk from
 * upstream API outages (those drive errors, not endpoint diversity).
 *
 * Threshold: >20% of multi-type searches dispatched to exactly 1
 * endpoint, over ≥5 multi-type searches.
 */
function evaluateEndpointDiversity(events, { minSample = 5, singleEndpointPctThreshold = 0.2 } = {}) {
  const multiTypeSearches = events.filter(
    (o) => o && o.component === 'offmarket-search'
      && Array.isArray(o.lead_types_selected)
      && o.lead_types_selected.length >= 3
      && Array.isArray(o.endpoints_dispatched),
  );
  if (multiTypeSearches.length < minSample) return null;
  const singleEndpoint = multiTypeSearches.filter((o) => new Set(o.endpoints_dispatched).size <= 1);
  const pct = singleEndpoint.length / multiTypeSearches.length;
  if (pct <= singleEndpointPctThreshold) return null;
  return {
    sli: 'offmarket-endpoint-diversity',
    value: Number(pct.toFixed(4)),
    severity: 'red',
    details: {
      single_endpoint_searches: singleEndpoint.length,
      total_multi_type_searches: multiTypeSearches.length,
      threshold: singleEndpointPctThreshold,
    },
  };
}

/**
 * Roll up a list of monitor_alerts rows into an at-a-glance dashboard
 * summary. Used by the exec dashboard's "Last 24h monitor alerts" panel
 * (see migrations/021_monitor_alerts.sql for the table shape).
 *
 * Pure function — caller queries the DB and passes the rows. Tolerant
 * of partial rows so a malformed DB row can't crash the dashboard.
 *
 * @param {Array<{sli:string, severity:string, fired_at:string|Date}>} rows
 * @returns {{
 *   total: number,
 *   red: number,
 *   yellow: number,
 *   green: number,
 *   last_fired_at: string|null,
 *   most_recent_sli: string|null,
 * }}
 */
function summarizeRecentAlerts(rows) {
  const empty = {
    total: 0,
    red: 0,
    yellow: 0,
    green: 0,
    last_fired_at: null,
    most_recent_sli: null,
  };
  if (!Array.isArray(rows)) return empty;

  let total = 0;
  let red = 0;
  let yellow = 0;
  let green = 0;
  let mostRecentTs = -Infinity;
  let mostRecentIso = null;
  let mostRecentSli = null;

  for (const row of rows) {
    if (!row || typeof row.sli !== 'string' || typeof row.severity !== 'string') continue;
    if (row.fired_at == null) continue;
    const ts = row.fired_at instanceof Date
      ? row.fired_at.getTime()
      : Date.parse(row.fired_at);
    if (!Number.isFinite(ts)) continue;

    total += 1;
    if (row.severity === 'red') red += 1;
    else if (row.severity === 'yellow') yellow += 1;
    else if (row.severity === 'green') green += 1;

    if (ts > mostRecentTs) {
      mostRecentTs = ts;
      mostRecentIso = new Date(ts).toISOString();
      mostRecentSli = row.sli;
    }
  }

  return {
    total,
    red,
    yellow,
    green,
    last_fired_at: mostRecentIso,
    most_recent_sli: mostRecentSli,
  };
}

module.exports = {
  parsePropDataLog,
  evaluateFeedRatio,
  evaluateUser429Burst,
  evaluateEmptyResultRate,
  evaluateEndpointDiversity,
  summarizeRecentAlerts,
};
