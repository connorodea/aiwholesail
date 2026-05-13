#!/usr/bin/env node
/**
 * aggregate-lsi.js — Aggregate, dedupe, filter, classify, and rank keywords
 * from the rolling RapidAPI seo-keyword-research CSV plus per-seed JSON files,
 * producing a low-comp queue the blog automation (/seo-blog) can consume.
 *
 * Usage:
 *   node scripts/google-ads-setup/aggregate-lsi.js
 *
 * Flags:
 *   --rolling <path>     Override rolling CSV (default seo-kw-rolling.csv)
 *   --results-dir <dir>  Override per-seed JSON dir (default seo-kw-results/)
 *   --queue-out <path>   Override output queue CSV
 *   --summary-out <path> Override output summary markdown
 *   --min-vol <n>        Override low-comp volume threshold (default 100)
 *   --min-score <n>      Override low-comp score threshold (default 0.3)
 *   --vl-min-vol <n>     Override very-low-comp volume threshold (default 50)
 *   --vl-max-cpc <n>     Override very-low-comp CPC ceiling (default 5)
 *
 * Outputs:
 *   - lsi-low-comp-queue.csv (columns: keyword, volume, cpc, competition, score,
 *     source_seed, suggested_page_type)
 *   - lsi-aggregate-summary.md (totals + tier counts + page-type breakdown +
 *     top 25 examples)
 *
 * Exports the pure functions for tests (see aggregate-lsi.test.js).
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  rolling: path.join(__dirname, 'seo-kw-rolling.csv'),
  resultsDir: path.join(__dirname, 'seo-kw-results'),
  queueOut: path.join(__dirname, 'lsi-low-comp-queue.csv'),
  summaryOut: path.join(__dirname, 'lsi-aggregate-summary.md'),
  minVol: 100,
  minScore: 0.3,
  vlMinVol: 50,
  vlMaxCpc: 5,
};

// ---- US state list (full names + 2-letter codes) for location classifier. ----
const US_STATES = [
  ['alabama', 'AL'], ['alaska', 'AK'], ['arizona', 'AZ'], ['arkansas', 'AR'],
  ['california', 'CA'], ['colorado', 'CO'], ['connecticut', 'CT'], ['delaware', 'DE'],
  ['florida', 'FL'], ['georgia', 'GA'], ['hawaii', 'HI'], ['idaho', 'ID'],
  ['illinois', 'IL'], ['indiana', 'IN'], ['iowa', 'IA'], ['kansas', 'KS'],
  ['kentucky', 'KY'], ['louisiana', 'LA'], ['maine', 'ME'], ['maryland', 'MD'],
  ['massachusetts', 'MA'], ['michigan', 'MI'], ['minnesota', 'MN'], ['mississippi', 'MS'],
  ['missouri', 'MO'], ['montana', 'MT'], ['nebraska', 'NE'], ['nevada', 'NV'],
  ['new hampshire', 'NH'], ['new jersey', 'NJ'], ['new mexico', 'NM'], ['new york', 'NY'],
  ['north carolina', 'NC'], ['north dakota', 'ND'], ['ohio', 'OH'], ['oklahoma', 'OK'],
  ['oregon', 'OR'], ['pennsylvania', 'PA'], ['rhode island', 'RI'], ['south carolina', 'SC'],
  ['south dakota', 'SD'], ['tennessee', 'TN'], ['texas', 'TX'], ['utah', 'UT'],
  ['vermont', 'VT'], ['virginia', 'VA'], ['washington', 'WA'], ['west virginia', 'WV'],
  ['wisconsin', 'WI'], ['wyoming', 'WY'],
];

// Lightweight city hints — high-population/high-investor cities. Avoid generic
// nouns ("salem", "mobile", "kansas city" → handled by state) that would
// false-positive.
const CITY_HINTS = [
  'atlanta', 'austin', 'baltimore', 'birmingham', 'boise', 'boston', 'buffalo',
  'charlotte', 'chicago', 'cincinnati', 'cleveland', 'columbus', 'dallas',
  'denver', 'detroit', 'el paso', 'fort worth', 'fresno', 'houston',
  'indianapolis', 'jacksonville', 'kansas city', 'las vegas', 'long beach',
  'los angeles', 'louisville', 'memphis', 'mesa', 'miami', 'milwaukee',
  'minneapolis', 'nashville', 'new orleans', 'oakland', 'oklahoma city',
  'omaha', 'orlando', 'philadelphia', 'phoenix', 'pittsburgh', 'portland',
  'raleigh', 'sacramento', 'san antonio', 'san diego', 'san francisco',
  'san jose', 'seattle', 'st louis', 'st. louis', 'tampa', 'tucson', 'tulsa',
  'virginia beach', 'washington dc',
];

// ---- CSV parsing — handles quoted fields containing commas. ----
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else { cur += ch; }
  }
  out.push(cur);
  return out;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split('\n');
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    const r = {};
    for (let j = 0; j < header.length; j++) {
      r[header[j]] = fields[j];
    }
    rows.push({
      keyword: String(r.keyword || '').trim(),
      volume: Number(r.volume) || 0,
      cpc: Number(r.cpc) || 0,
      competition: String(r.competition || '').trim().toLowerCase(),
      score: Number(r.score) || 0,
      seed: String(r.seed || '').trim(),
      date: String(r.date || '').trim(),
    });
  }
  return rows;
}

// ---- Pull additional rows from per-seed JSON files in seo-kw-results/. ----
function loadJsonResults(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    // file naming: <endpoint>-<slug>-<YYYYMMDD>.json
    const parts = f.replace(/\.json$/, '').split('-');
    const seedFromFile = parts.slice(1, -1).join('-').replace(/-/g, ' ');
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (!r || !r.text) continue;
      rows.push({
        keyword: String(r.text).trim(),
        volume: Number(r.vol) || 0,
        cpc: Number(r.cpc) || 0,
        competition: String(r.competition || '').trim().toLowerCase(),
        score: Number(r.score) || 0,
        seed: seedFromFile,
        date: '',
      });
    }
  }
  return rows;
}

// ---- Dedupe case-insensitively, keeping the row with the highest score. ----
function dedupe(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (!r.keyword) continue;
    const k = r.keyword.toLowerCase();
    const existing = byKey.get(k);
    if (!existing || r.score > existing.score) {
      // Normalize keyword display to the variant we keep.
      byKey.set(k, { ...r, keyword: r.keyword });
    }
  }
  return [...byKey.values()];
}

// ---- Filters. ----
function filterLowComp(rows, opts = {}) {
  const minVol = opts.minVol ?? DEFAULTS.minVol;
  const minScore = opts.minScore ?? DEFAULTS.minScore;
  return rows.filter((r) =>
    r.competition === 'low' && r.volume >= minVol && r.score >= minScore
  );
}

function filterVeryLowComp(rows, opts = {}) {
  const minVol = opts.vlMinVol ?? DEFAULTS.vlMinVol;
  const maxCpc = opts.vlMaxCpc ?? DEFAULTS.vlMaxCpc;
  return rows.filter((r) =>
    r.competition === 'low' && r.volume >= minVol && r.cpc <= maxCpc
  );
}

// ---- Suggested page type heuristic. ----
function classifyPageType(keyword) {
  const k = String(keyword).toLowerCase();

  // Tool: any explicit calculator/tool/formula mention.
  if (/\b(calculator|formula|tool|estimator)\b/.test(k)) return 'tool';

  // Comparison: "vs", "versus", "alternative", "alternatives".
  if (/\b(vs|versus|alternative|alternatives|review|comparison)\b/.test(k)) return 'blog-comparison';

  // Location: state full name, state code, or major city.
  for (const [name, code] of US_STATES) {
    const namePattern = new RegExp(`\\b${name}\\b`, 'i');
    const codePattern = new RegExp(`\\b${code}\\b`); // case-sensitive 2-letter
    if (namePattern.test(keyword) || codePattern.test(keyword)) return 'location';
  }
  for (const city of CITY_HINTS) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(k)) return 'location';
  }

  // "how to" / "what is" / question-led -> long-form blog.
  if (/^(how|what|why|when|where|is|are|can|should|does|do)\b/.test(k)) return 'blog';
  if (/\b(how to|what is|guide to)\b/.test(k)) return 'blog';

  return 'blog';
}

// ---- Queue construction. ----
function toQueueRows(rows) {
  const sorted = rows.slice().sort((a, b) => b.score - a.score);
  return sorted.map((r) => ({
    keyword: r.keyword,
    volume: r.volume,
    cpc: r.cpc,
    competition: r.competition,
    score: r.score,
    source_seed: r.seed,
    suggested_page_type: classifyPageType(r.keyword),
  }));
}

function csvQuote(s) {
  const str = String(s ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toQueueCsv(queue) {
  const header = 'keyword,volume,cpc,competition,score,source_seed,suggested_page_type';
  const body = queue.map((q) =>
    [q.keyword, q.volume, q.cpc, q.competition, q.score, q.source_seed, q.suggested_page_type]
      .map(csvQuote).join(',')
  );
  return [header, ...body].join('\n') + '\n';
}

// ---- Markdown summary. ----
function countBy(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = fn(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function buildSummary({ all, low, veryLow }) {
  const queue = toQueueRows(low);
  const byType = countBy(queue, (q) => q.suggested_page_type);
  const top25 = queue.slice(0, 25);

  const lines = [];
  lines.push('# LSI keyword aggregate summary');
  lines.push('');
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push('');
  lines.push('## Totals');
  lines.push(`- Total unique keywords: ${all.length}`);
  lines.push(`- Low-comp tier: ${low.length} (competition=low, volume>=${DEFAULTS.minVol}, score>=${DEFAULTS.minScore})`);
  lines.push(`- Very-low-comp tier: ${veryLow.length} (competition=low, volume>=${DEFAULTS.vlMinVol}, cpc<=$${DEFAULTS.vlMaxCpc})`);
  lines.push('');
  lines.push('## By suggested_page_type (low-comp tier)');
  for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${t}: ${n}`);
  }
  lines.push('');
  lines.push('## Top 25 low-comp keywords by score');
  lines.push('');
  lines.push('| # | keyword | vol | cpc | score | page type |');
  lines.push('|---|---------|-----|-----|-------|-----------|');
  top25.forEach((q, i) => {
    lines.push(`| ${i + 1} | ${q.keyword} | ${q.volume} | $${q.cpc} | ${q.score} | ${q.suggested_page_type} |`);
  });
  lines.push('');
  return lines.join('\n');
}

// ---- CLI entrypoint. ----
function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--rolling': opts.rolling = next; i++; break;
      case '--results-dir': opts.resultsDir = next; i++; break;
      case '--queue-out': opts.queueOut = next; i++; break;
      case '--summary-out': opts.summaryOut = next; i++; break;
      case '--min-vol': opts.minVol = Number(next); i++; break;
      case '--min-score': opts.minScore = Number(next); i++; break;
      case '--vl-min-vol': opts.vlMinVol = Number(next); i++; break;
      case '--vl-max-cpc': opts.vlMaxCpc = Number(next); i++; break;
      default: break;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const csvRows = parseCsv(opts.rolling);
  const jsonRows = loadJsonResults(opts.resultsDir);
  const merged = csvRows.concat(jsonRows);
  const all = dedupe(merged);
  const low = filterLowComp(all, opts);
  const veryLow = filterVeryLowComp(all, opts);
  const queue = toQueueRows(low);
  fs.writeFileSync(opts.queueOut, toQueueCsv(queue));
  fs.writeFileSync(opts.summaryOut, buildSummary({ all, low, veryLow }));
  console.log(`Sources: ${csvRows.length} csv rows + ${jsonRows.length} json rows = ${merged.length} raw`);
  console.log(`Unique:  ${all.length}`);
  console.log(`Low-comp tier:      ${low.length}  -> ${opts.queueOut}`);
  console.log(`Very-low-comp tier: ${veryLow.length}`);
  console.log(`Summary: ${opts.summaryOut}`);
}

// Only run main when invoked directly, not when required by tests.
if (require.main === module) {
  main();
}

module.exports = {
  parseCsv,
  parseCsvLine,
  loadJsonResults,
  dedupe,
  filterLowComp,
  filterVeryLowComp,
  classifyPageType,
  toQueueRows,
  toQueueCsv,
  buildSummary,
  DEFAULTS,
};
