#!/usr/bin/env node
/**
 * IndexNow submission for AIWholesail.
 *
 * IndexNow is a Microsoft-driven protocol that nudges Bing, Yandex, Seznam, Naver,
 * and Yep to crawl a URL immediately. No auth required — the only setup is a
 * verification key file at the site root (handled here automatically).
 *
 * Per the spec: https://www.indexnow.org/documentation
 *
 * Actions:
 *   1) Generate (or reuse) a verification key, save to ~/.config/aiwholesail/indexnow.key
 *   2) Write public/<key>.txt so Bing can fetch it for ownership verification
 *   3) Parse public/sitemap.xml — collect all URLs
 *   4) Submit URLs in 10K-batch JSON bodies to api.indexnow.org/indexnow
 *
 * Usage:
 *   node scripts/google-ads-setup/indexnow-submit.js              # all sitemap URLs
 *   node scripts/google-ads-setup/indexnow-submit.js --priority   # only the high-priority list
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = 'aiwholesail.com';
const SITEMAP_PATH = path.resolve(__dirname, '../../public/sitemap.xml');
const KEY_DIR = path.join(process.env.HOME, '.config/aiwholesail');
const KEY_FILE = path.join(KEY_DIR, 'indexnow.key');
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const TODAY = new Date().toISOString().slice(0, 10);

const PRIORITY_URLS = [
  'https://aiwholesail.com/',
  'https://aiwholesail.com/pricing',
  'https://aiwholesail.com/markets',
  'https://aiwholesail.com/reviews/propstream-review',
  'https://aiwholesail.com/reviews/dealmachine-review',
  'https://aiwholesail.com/reviews/batchleads-review',
  'https://aiwholesail.com/reviews/privy-review',
  'https://aiwholesail.com/reviews/freedomsoft-review',
  'https://aiwholesail.com/vs/propstream',
  'https://aiwholesail.com/vs/dealmachine',
  'https://aiwholesail.com/vs/batchleads',
  'https://aiwholesail.com/llms.txt',
  'https://aiwholesail.com/llms-full.txt',
  'https://aiwholesail.com/AGENTS.md',
  'https://aiwholesail.com/pricing.md',
  'https://aiwholesail.com/docs/overview.md',
  'https://aiwholesail.com/docs/features.md',
  'https://aiwholesail.com/docs/comparisons.md',
  'https://aiwholesail.com/docs/faq.md',
  'https://aiwholesail.com/docs/glossary.md',
];

function ensureKey() {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true });
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  // IndexNow spec: 8-128 hex chars.
  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE, key + '\n', { mode: 0o600 });
  console.log('Generated new IndexNow key:', KEY_FILE);
  return key;
}

function writeVerificationFile(key) {
  // Place at public root so it gets served at https://aiwholesail.com/<key>.txt
  const verPath = path.join(PUBLIC_DIR, key + '.txt');
  fs.writeFileSync(verPath, key + '\n');
  console.log('Wrote verification file:', verPath);
  return verPath;
}

function parseSitemapUrls(text) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const u = m[1].trim();
    if (u.startsWith('http')) urls.push(u);
  }
  return urls;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function httpsRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function submitBatch(key, urls) {
  const body = JSON.stringify({
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${key}.txt`,
    urlList: urls,
  });
  const res = await httpsRequest({
    hostname: 'api.indexnow.org',
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'AIWholesail-IndexNow/1.0',
    },
  }, body);
  return res;
}

async function main() {
  const priorityOnly = process.argv.includes('--priority');
  const key = ensureKey();
  console.log('IndexNow key (first 8):', key.slice(0, 8) + '…');
  writeVerificationFile(key);

  let urls;
  if (priorityOnly) {
    urls = PRIORITY_URLS;
  } else {
    if (!fs.existsSync(SITEMAP_PATH)) {
      console.error('Sitemap not found:', SITEMAP_PATH);
      process.exit(2);
    }
    const text = fs.readFileSync(SITEMAP_PATH, 'utf8');
    urls = parseSitemapUrls(text);
    if (urls.length === 0) {
      console.error('No URLs parsed from sitemap. Falling back to priority list.');
      urls = PRIORITY_URLS;
    }
  }

  // Dedupe and trim
  urls = Array.from(new Set(urls));
  console.log('URLs to submit:', urls.length);

  // IndexNow accepts up to 10,000 URLs per request
  const batches = chunk(urls, 10000);
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const res = await submitBatch(key, batches[i]);
    const ok = res.status === 200 || res.status === 202;
    console.log(`Batch ${i + 1}/${batches.length}  (${batches[i].length} URLs)  HTTP ${res.status}  ${ok ? '✓' : '✗'}`);
    if (!ok) console.log('  body:', res.body.slice(0, 300));
    results.push({ batch: i + 1, size: batches[i].length, httpStatus: res.status, ok });
  }

  const out = {
    generated: TODAY,
    host: HOST,
    keyFirst8: key.slice(0, 8),
    verificationFile: `https://${HOST}/${key}.txt`,
    submittedCount: urls.length,
    batches: results,
  };
  fs.writeFileSync(path.join(__dirname, 'indexnow-status.json'), JSON.stringify(out, null, 2));
  console.log('\nDone. Status saved:', path.join(__dirname, 'indexnow-status.json'));
  console.log('Remember to commit & deploy the verification file at public/' + key + '.txt');
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
