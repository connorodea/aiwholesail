#!/usr/bin/env node
/**
 * Submit AIWholesail sitemaps to Google Search Console + inspect top URLs.
 *
 * Uses the unified OAuth token from oauth-refresh-multi.js (needs the full
 * "webmasters" scope, not the read-only variant).
 *
 * Actions:
 *   1) List currently registered sitemaps for sc-domain:aiwholesail.com
 *   2) Submit /sitemap.xml and /sitemap-index.xml (idempotent — Google handles re-pings)
 *   3) Run URL Inspection on the top 10 pages from gsc-opportunity-report.json
 *      (or a default list of high-priority pages if that report doesn't exist)
 *   4) Write gsc-indexing-status.json + a markdown summary
 *
 * Usage:
 *   node scripts/google-ads-setup/gsc-sitemap-submit.js [--site sc-domain:aiwholesail.com]
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(process.env.HOME, '.config/gcloud/aiw-oauth-tokens.json');
const OUTPUT_DIR = __dirname;
const TODAY = new Date().toISOString().slice(0, 10);

const SITEMAPS_TO_SUBMIT = [
  'https://aiwholesail.com/sitemap.xml',
  'https://aiwholesail.com/sitemap-index.xml',
];

const DEFAULT_PAGES_TO_INSPECT = [
  'https://aiwholesail.com/',
  'https://aiwholesail.com/pricing',
  'https://aiwholesail.com/markets',
  'https://aiwholesail.com/reviews/propstream-review',
  'https://aiwholesail.com/vs/propstream',
  'https://aiwholesail.com/vs/dealmachine',
  'https://aiwholesail.com/vs/batchleads',
  'https://aiwholesail.com/tools',
  'https://aiwholesail.com/faq',
  'https://aiwholesail.com/how-it-works',
];

function httpsRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (!data) return resolve({ status: res.statusCode, body: null });
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
  if (!res.body || !res.body.access_token) {
    throw new Error('Refresh failed: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

async function gscRequest(accessToken, urlPath, method, body) {
  const data = body ? JSON.stringify(body) : null;
  return httpsRequest({
    hostname: 'searchconsole.googleapis.com',
    path: urlPath,
    method,
    headers: {
      Authorization: 'Bearer ' + accessToken,
      ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
    },
  }, data);
}

async function main() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('Token file missing. Run: node scripts/google-ads-setup/oauth-refresh-multi.js');
    process.exit(2);
  }
  const tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  if (!tok.scope || tok.scope.includes('webmasters.readonly') || !tok.scope.includes('webmasters')) {
    if (tok.scope && tok.scope.includes('webmasters.readonly')) {
      console.error('Token has READ-ONLY webmasters scope. Re-auth needed for sitemap submission.');
      console.error('Run: node scripts/google-ads-setup/oauth-refresh-multi.js');
      process.exit(2);
    }
  }
  console.log('Refreshing access token…');
  const accessToken = await refreshAccessToken(tok);

  const argIdx = process.argv.indexOf('--site');
  const site = argIdx >= 0 ? process.argv[argIdx + 1] : 'sc-domain:aiwholesail.com';
  console.log('Site:', site);

  // 1) List current sitemaps
  console.log('\n=== Current sitemaps in GSC ===');
  const listed = await gscRequest(accessToken, '/webmasters/v3/sites/' + encodeURIComponent(site) + '/sitemaps', 'GET');
  if (listed.status !== 200) {
    console.error('list failed:', listed.status, JSON.stringify(listed.body).slice(0, 300));
  } else {
    const sitemaps = listed.body.sitemap || [];
    console.log('Registered sitemaps:', sitemaps.length);
    sitemaps.forEach((s) => {
      console.log(`  ${s.path}`);
      console.log(`    lastSubmitted: ${s.lastSubmitted || '—'}  ·  lastDownloaded: ${s.lastDownloaded || '—'}`);
      console.log(`    isPending: ${s.isPending}  ·  errors: ${s.errors || 0}  ·  warnings: ${s.warnings || 0}`);
    });
  }

  // 2) Submit sitemaps
  console.log('\n=== Submitting sitemaps ===');
  const submissions = [];
  for (const sm of SITEMAPS_TO_SUBMIT) {
    const enc = encodeURIComponent(sm);
    const res = await gscRequest(
      accessToken,
      '/webmasters/v3/sites/' + encodeURIComponent(site) + '/sitemaps/' + enc,
      'PUT'
    );
    const ok = res.status === 200 || res.status === 204;
    console.log(`  ${ok ? '✓' : '✗'} ${sm}  (HTTP ${res.status})`);
    if (!ok) console.log('    body:', JSON.stringify(res.body).slice(0, 300));
    submissions.push({ url: sm, httpStatus: res.status, ok });
  }

  // 3) URL Inspection on top pages
  console.log('\n=== URL Inspection (top pages) ===');
  let pagesToInspect = DEFAULT_PAGES_TO_INSPECT;
  const gscJsonPath = path.join(OUTPUT_DIR, 'gsc-opportunity-report.json');
  if (fs.existsSync(gscJsonPath)) {
    const rpt = JSON.parse(fs.readFileSync(gscJsonPath, 'utf8'));
    if (rpt.topPages && rpt.topPages.length > 0) {
      pagesToInspect = rpt.topPages.slice(0, 10).map((p) => p.page);
    }
  }

  const inspections = [];
  for (const url of pagesToInspect) {
    const res = await gscRequest(
      accessToken,
      '/v1/urlInspection/index:inspect',
      'POST',
      { inspectionUrl: url, siteUrl: site, languageCode: 'en-US' }
    );
    if (res.status !== 200) {
      console.log(`  ✗ ${url}  (HTTP ${res.status})`);
      inspections.push({ url, error: true, httpStatus: res.status, body: res.body });
      continue;
    }
    const r = res.body.inspectionResult || {};
    const idx = r.indexStatusResult || {};
    const verdict = idx.verdict || '?';
    const coverage = idx.coverageState || '—';
    const indexingState = idx.indexingState || '—';
    const lastCrawl = idx.lastCrawlTime || '—';
    const userCanonical = idx.userCanonical || '—';
    const googleCanonical = idx.googleCanonical || '—';

    console.log(`  ${verdict === 'PASS' ? '✓' : '?'} ${url}`);
    console.log(`    verdict: ${verdict}  ·  coverage: ${coverage}`);
    console.log(`    indexingState: ${indexingState}  ·  lastCrawl: ${lastCrawl}`);
    if (userCanonical !== googleCanonical) {
      console.log(`    canonical mismatch — user: ${userCanonical}  ·  google: ${googleCanonical}`);
    }

    inspections.push({
      url,
      verdict,
      coverage,
      indexingState,
      lastCrawl,
      userCanonical,
      googleCanonical,
      mobileVerdict: r.mobileUsabilityResult?.verdict,
      richResults: (r.richResultsResult?.detectedItems || []).map((it) => it.richResultType),
    });
  }

  const out = {
    generated: TODAY,
    site,
    sitemapsListedBefore: (listed.body && listed.body.sitemap) || [],
    sitemapsSubmitted: submissions,
    urlInspections: inspections,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'gsc-indexing-status.json'), JSON.stringify(out, null, 2));
  console.log('\nWrote:', path.join(OUTPUT_DIR, 'gsc-indexing-status.json'));

  const md = [
    `# AIWholesail GSC Indexing Status — ${TODAY}`,
    '',
    `Site: \`${site}\``,
    '',
    '## Sitemaps submitted',
    '',
    '| URL | HTTP | Result |',
    '|---|---:|---|',
    ...submissions.map((s) => `| ${s.url} | ${s.httpStatus} | ${s.ok ? '✓ submitted' : '✗ failed'} |`),
    '',
    '## URL Inspection — top pages',
    '',
    '| URL | Verdict | Coverage | Indexing State | Last Crawl |',
    '|---|---|---|---|---|',
    ...inspections.filter((i) => !i.error).map((i) =>
      `| \`${i.url.replace(/\|/g, '\\|')}\` | ${i.verdict} | ${i.coverage} | ${i.indexingState} | ${i.lastCrawl} |`
    ),
    '',
    '## Canonical mismatches',
    '',
    ...inspections
      .filter((i) => !i.error && i.userCanonical && i.googleCanonical && i.userCanonical !== i.googleCanonical)
      .map((i) => `- \`${i.url}\` — user says \`${i.userCanonical}\`, Google chose \`${i.googleCanonical}\``),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, `GSC_INDEXING_STATUS_${TODAY}.md`), md);
  console.log('Wrote markdown summary.');
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
