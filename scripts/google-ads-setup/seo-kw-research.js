#!/usr/bin/env node
/**
 * seo-kw-research — RapidAPI seo-keyword-research wrapper for the AIWholesail
 * keyword pipeline. Complements keyword-research-gaps.js (which uses Google
 * Ads Keyword Planner and needs Basic Access approval).
 *
 * Usage:
 *   node scripts/google-ads-setup/seo-kw-research.js <seed> [country=us] [--top N] [--csv]
 *   node scripts/google-ads-setup/seo-kw-research.js --single "wholesale real estate"
 *   node scripts/google-ads-setup/seo-kw-research.js --batch keywords.txt  # one keyword per line
 *
 * Requires: RAPIDAPI_SEO_KW_KEY env var. Set in ~/.zshrc:
 *   export RAPIDAPI_SEO_KW_KEY=<your_rapidapi_key>
 *
 * Output:
 *   - JSON: scripts/google-ads-setup/seo-kw-results/<slug>-<YYYYMMDD>.json
 *   - CSV (when --csv): same path with .csv extension
 *   - Appends ROI-ranked keywords to scripts/google-ads-setup/seo-kw-rolling.csv
 *
 * Cross-reference: the resulting CSV interleaves naturally with the Google Ads
 * dataset in keyword-research-report.csv — both have keyword + vol + cpc +
 * competition columns. Combine for cluster analysis.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.RAPIDAPI_SEO_KW_KEY;
if (!API_KEY) {
  console.error('ERROR: RAPIDAPI_SEO_KW_KEY env var not set.');
  console.error('Add this to ~/.zshrc and `source ~/.zshrc`:');
  console.error('  export RAPIDAPI_SEO_KW_KEY=<your_rapidapi_key>');
  process.exit(2);
}

const HOST = 'seo-keyword-research.p.rapidapi.com';
const OUT_DIR = path.join(__dirname, 'seo-kw-results');
const ROLLING_CSV = path.join(__dirname, 'seo-kw-rolling.csv');
fs.mkdirSync(OUT_DIR, { recursive: true });

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function fetchRapid(endpoint, keyword, country) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ keyword, country: country || 'us' });
    const req = https.request({
      hostname: HOST,
      path: `/${endpoint}.php?${params.toString()}`,
      method: 'GET',
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': HOST,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function toRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data.text) return [data];
  return [];
}

function csvLine(r, seed) {
  const kw = String(r.text || '').replace(/"/g, '""');
  return `"${kw}",${r.vol || 0},${r.cpc || ''},${r.competition || ''},${r.score || ''},"${seed}",${new Date().toISOString().slice(0, 10)}`;
}

function appendRolling(rows, seed) {
  const header = 'keyword,volume,cpc,competition,score,seed,date\n';
  if (!fs.existsSync(ROLLING_CSV)) fs.writeFileSync(ROLLING_CSV, header);
  const lines = rows.map((r) => csvLine(r, seed)).join('\n') + '\n';
  fs.appendFileSync(ROLLING_CSV, lines);
}

async function researchOne({ seed, country, topN, csv, single }) {
  const endpoint = single ? 'single' : 'keynew';
  console.log(`[${endpoint}] ${seed} (${country})...`);
  const data = await fetchRapid(endpoint, seed, country);
  let rows = toRows(data);
  rows.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
  if (topN) rows = rows.slice(0, topN);

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = slugify(seed);
  const jsonPath = path.join(OUT_DIR, `${endpoint}-${slug}-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  console.log(`  JSON: ${jsonPath} (${rows.length} keywords)`);

  if (csv) {
    const csvPath = jsonPath.replace(/\.json$/, '.csv');
    const lines = ['keyword,volume,cpc,competition,score'];
    for (const r of rows) {
      const kw = String(r.text || '').replace(/"/g, '""');
      lines.push(`"${kw}",${r.vol || 0},${r.cpc || ''},${r.competition || ''},${r.score || ''}`);
    }
    fs.writeFileSync(csvPath, lines.join('\n') + '\n');
    console.log(`  CSV:  ${csvPath}`);
  }

  if (!single) appendRolling(rows, seed);
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { country: 'us', topN: null, csv: false, single: false, batch: null };
  let positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--top') { opts.topN = parseInt(args[++i], 10); continue; }
    if (a.startsWith('--top=')) { opts.topN = parseInt(a.slice(6), 10); continue; }
    if (a === '--csv') { opts.csv = true; continue; }
    if (a === '--single') { opts.single = true; continue; }
    if (a === '--batch') { opts.batch = args[++i]; continue; }
    positional.push(a);
  }

  if (opts.batch) {
    if (!fs.existsSync(opts.batch)) {
      console.error(`Batch file not found: ${opts.batch}`);
      process.exit(1);
    }
    const seeds = fs.readFileSync(opts.batch, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean).filter((s) => !s.startsWith('#'));
    console.log(`Batch: ${seeds.length} seeds`);
    const totals = [];
    for (const seed of seeds) {
      try {
        const rows = await researchOne({ ...opts, seed });
        totals.push({ seed, count: rows.length });
        await new Promise((r) => setTimeout(r, 1500)); // gentle pacing
      } catch (e) {
        console.error(`  ✗ ${seed}: ${e.message}`);
      }
    }
    console.log('\nBatch summary:');
    totals.forEach((t) => console.log(`  ${t.seed}: ${t.count}`));
    return;
  }

  if (positional.length < 1) {
    console.error('Usage: node seo-kw-research.js <seed> [country=us] [--top N] [--csv] [--single]');
    console.error('       node seo-kw-research.js --batch <file>');
    process.exit(1);
  }
  await researchOne({ ...opts, seed: positional[0], country: positional[1] || opts.country });
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
