#!/usr/bin/env node
/**
 * Google Search Console opportunity report for aiwholesail.com.
 *
 * Pulls the last 90 days of query-level data from GSC and surfaces:
 *  - "Striking distance" queries (avg position 5-30, page-1 within reach)
 *  - High-impression low-CTR queries (snippet rewrite candidates)
 *  - Top queries by clicks (defend & deepen)
 *  - Top pages by impressions (extractable target pages)
 *
 * Reads the unified token file written by oauth-refresh-multi.js.
 *
 * Outputs:
 *  - gsc-opportunity-report.csv  (all queries)
 *  - gsc-opportunity-report.json (summary + buckets)
 *  - GSC_OPPORTUNITY_REPORT_<date>.md (human-readable summary)
 *
 * Usage:
 *   node scripts/google-ads-setup/gsc-opportunity-report.js [--site sc-domain:aiwholesail.com|https://aiwholesail.com/]
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(process.env.HOME, '.config/gcloud/aiw-oauth-tokens.json');
const OUTPUT_DIR = __dirname;
const TODAY = new Date().toISOString().slice(0, 10);

function httpsRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function refreshAccessToken(tok) {
  const form =
    'client_id=' + encodeURIComponent(tok.client_id) +
    '&client_secret=' + encodeURIComponent(tok.client_secret) +
    '&refresh_token=' + encodeURIComponent(tok.refresh_token) +
    '&grant_type=refresh_token';

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(form),
    },
  }, form);

  if (!res.body.access_token) {
    throw new Error('Refresh failed: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

async function gscRequest(accessToken, urlPath, body) {
  const data = body ? JSON.stringify(body) : null;
  const res = await httpsRequest({
    hostname: 'searchconsole.googleapis.com',
    path: urlPath,
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
    },
  }, data);
  return res;
}

async function listSites(accessToken) {
  const res = await gscRequest(accessToken, '/webmasters/v3/sites');
  if (res.status !== 200) {
    throw new Error('list sites failed: ' + JSON.stringify(res.body));
  }
  return (res.body.siteEntry || []).map((s) => s.siteUrl);
}

async function fetchQueries(accessToken, site, days, dimensions) {
  const endDate = TODAY;
  const startDate = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const all = [];
  const ROW_LIMIT = 25000;
  let startRow = 0;
  while (true) {
    const res = await gscRequest(
      accessToken,
      '/webmasters/v3/sites/' + encodeURIComponent(site) + '/searchAnalytics/query',
      {
        startDate,
        endDate,
        dimensions,
        rowLimit: ROW_LIMIT,
        startRow,
        type: 'web',
      }
    );
    if (res.status !== 200) {
      throw new Error('searchAnalytics.query failed: ' + JSON.stringify(res.body));
    }
    const rows = res.body.rows || [];
    all.push(...rows);
    if (rows.length < ROW_LIMIT) break;
    startRow += ROW_LIMIT;
    if (startRow > 100_000) break; // hard cap
  }
  return all;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('Token file not found: ' + TOKEN_PATH);
    console.error('Run: node scripts/google-ads-setup/oauth-refresh-multi.js');
    process.exit(2);
  }

  const tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  if (!tok.scope || !tok.scope.includes('webmasters')) {
    console.error('Token file does not include webmasters scope: ' + tok.scope);
    console.error('Re-run: node scripts/google-ads-setup/oauth-refresh-multi.js');
    process.exit(2);
  }

  console.log('Refreshing access token…');
  const accessToken = await refreshAccessToken(tok);

  console.log('Listing GSC properties…');
  const sites = await listSites(accessToken);
  console.log('Properties found:', sites);

  // Pick site: CLI arg, then domain property, then https://aiwholesail.com/.
  const argIdx = process.argv.indexOf('--site');
  const arg = argIdx >= 0 ? process.argv[argIdx + 1] : null;
  const site =
    arg ||
    sites.find((s) => s === 'sc-domain:aiwholesail.com') ||
    sites.find((s) => s.includes('aiwholesail.com')) ||
    sites[0];

  if (!site) {
    console.error('No GSC property found for aiwholesail.com. Verify ownership at https://search.google.com/search-console');
    process.exit(2);
  }
  console.log('Using site:', site);

  console.log('\nFetching last 90 days of query-level data…');
  const queries = await fetchQueries(accessToken, site, 90, ['query']);
  console.log('Query rows:', queries.length);

  console.log('Fetching last 90 days of query+page data (top 25K)…');
  const queryPage = await fetchQueries(accessToken, site, 90, ['query', 'page']);
  console.log('Query+Page rows:', queryPage.length);

  console.log('Fetching last 90 days of page-level data…');
  const pages = await fetchQueries(accessToken, site, 90, ['page']);
  console.log('Page rows:', pages.length);

  // Process queries — main analysis is at query level.
  const enriched = queries.map((r) => ({
    query: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: +((r.ctr || 0) * 100).toFixed(2),
    position: +(r.position || 0).toFixed(1),
  }));

  // BUCKETS
  const strikingDistance = enriched
    .filter((r) => r.position >= 5 && r.position <= 30 && r.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions);

  const highImpressionLowCtr = enriched
    .filter((r) => r.impressions >= 200 && r.position <= 10 && r.ctr < 2)
    .sort((a, b) => b.impressions - a.impressions);

  const topClicks = [...enriched]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 25);

  const topImpressions = [...enriched]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25);

  const pagesEnriched = pages.map((r) => ({
    page: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: +((r.ctr || 0) * 100).toFixed(2),
    position: +(r.position || 0).toFixed(1),
  })).sort((a, b) => b.impressions - a.impressions);

  // CSV — full query dump
  const csvPath = path.join(OUTPUT_DIR, 'gsc-opportunity-report.csv');
  const csvHeader = 'Query,Clicks,Impressions,CTR(%),AvgPosition,Bucket\n';
  const bucketOf = (r) => {
    if (r.position >= 5 && r.position <= 30 && r.impressions >= 50) return 'striking-distance';
    if (r.impressions >= 200 && r.position <= 10 && r.ctr < 2) return 'snippet-rewrite';
    if (r.position <= 3) return 'defending';
    return '';
  };
  const csvRows = enriched
    .sort((a, b) => b.impressions - a.impressions)
    .map((r) => [csvEscape(r.query), r.clicks, r.impressions, r.ctr, r.position, bucketOf(r)].join(','))
    .join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);
  console.log('\nCSV saved:', csvPath);

  // JSON — summary
  const summary = {
    generated: TODAY,
    site,
    windowDays: 90,
    totals: {
      uniqueQueries: enriched.length,
      totalClicks: enriched.reduce((s, r) => s + r.clicks, 0),
      totalImpressions: enriched.reduce((s, r) => s + r.impressions, 0),
      avgCtr: +(
        100 * enriched.reduce((s, r) => s + r.clicks, 0) /
        Math.max(1, enriched.reduce((s, r) => s + r.impressions, 0))
      ).toFixed(2),
      avgPosition: +(
        enriched.reduce((s, r) => s + r.position * r.impressions, 0) /
        Math.max(1, enriched.reduce((s, r) => s + r.impressions, 0))
      ).toFixed(1),
    },
    buckets: {
      strikingDistance: strikingDistance.slice(0, 50),
      snippetRewrite: highImpressionLowCtr.slice(0, 30),
      topClicks,
      topImpressions,
    },
    topPages: pagesEnriched.slice(0, 25),
  };

  const jsonPath = path.join(OUTPUT_DIR, 'gsc-opportunity-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log('JSON saved:', jsonPath);

  // Markdown report
  const md = [
    '# AIWholesail GSC Opportunity Report',
    '',
    '> Generated: ' + TODAY + '  ·  Window: 90 days  ·  Property: ' + site,
    '',
    '## Headline',
    '',
    '| Metric | Value |',
    '|---|---|',
    '| Unique queries | ' + summary.totals.uniqueQueries + ' |',
    '| Total clicks | ' + summary.totals.totalClicks + ' |',
    '| Total impressions | ' + summary.totals.totalImpressions + ' |',
    '| Average CTR | ' + summary.totals.avgCtr + '% |',
    '| Average position (impression-weighted) | ' + summary.totals.avgPosition + ' |',
    '',
    '## Striking distance (position 5-30, ≥50 impressions) — top 20',
    '',
    'These queries are within one or two position jumps of page 1. Each row is a content depth opportunity.',
    '',
    '| Query | Impressions | Position | CTR |',
    '|---|---:|---:|---:|',
    ...strikingDistance.slice(0, 20).map((r) =>
      '| ' + r.query.replace(/\|/g, '\\|') + ' | ' + r.impressions + ' | ' + r.position + ' | ' + r.ctr + '% |'
    ),
    '',
    '## Snippet rewrite candidates (top-10 position, low CTR)',
    '',
    'Already ranking — but the snippet isn\'t earning clicks. Rewrite title/meta/H1.',
    '',
    '| Query | Impressions | Position | CTR |',
    '|---|---:|---:|---:|',
    ...highImpressionLowCtr.slice(0, 20).map((r) =>
      '| ' + r.query.replace(/\|/g, '\\|') + ' | ' + r.impressions + ' | ' + r.position + ' | ' + r.ctr + '% |'
    ),
    '',
    '## Top pages by impressions',
    '',
    '| Page | Impressions | Clicks | CTR | Avg position |',
    '|---|---:|---:|---:|---:|',
    ...pagesEnriched.slice(0, 15).map((r) =>
      '| ' + r.page + ' | ' + r.impressions + ' | ' + r.clicks + ' | ' + r.ctr + '% | ' + r.position + ' |'
    ),
    '',
  ].join('\n');

  const mdPath = path.join(OUTPUT_DIR, 'GSC_OPPORTUNITY_REPORT_' + TODAY + '.md');
  fs.writeFileSync(mdPath, md);
  console.log('Markdown saved:', mdPath);

  console.log('\n=== SUMMARY ===');
  console.log('Clicks (90d):       ', summary.totals.totalClicks);
  console.log('Impressions (90d):  ', summary.totals.totalImpressions);
  console.log('Avg CTR:            ', summary.totals.avgCtr + '%');
  console.log('Avg position:       ', summary.totals.avgPosition);
  console.log('Striking-distance:  ', strikingDistance.length, 'queries');
  console.log('Snippet-rewrite:    ', highImpressionLowCtr.length, 'queries');
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
