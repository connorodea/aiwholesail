#!/usr/bin/env node
/**
 * Google Autocomplete (Suggest) scraper for keyword discovery.
 *
 * No API key. Uses the same public endpoint Firefox/Chrome hit:
 *   https://suggestqueries.google.com/complete/search?client=firefox&q=X
 *
 * Modes:
 *   - Single seed:     node google-suggest.js "subject to real estate"
 *   - Alphabet expand: node google-suggest.js "subject to" --alphabet
 *   - Modifier expand: node google-suggest.js "brrrr" --modifiers
 *   - Batch file:      node google-suggest.js --batch seeds.txt
 *
 * Output:
 *   - JSON to stdout (default)
 *   - CSV with --csv flag (also written to seo-kw-results/suggest-<seed>-<date>.csv)
 *
 * Polite: 150ms delay between requests.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const RESULTS_DIR = path.join(__dirname, 'seo-kw-results');
const DELAY_MS = 150;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MODIFIERS = [
  'how to',
  'what is',
  'why',
  'when',
  'where',
  'best',
  'cheap',
  'free',
  'top',
  'guide',
  'tips',
  'tutorial',
  'example',
  'vs',
  'for',
  'without',
  'with',
  'near me',
];

// ---------------------------------------------------------------------------
// Pure functions (unit-tested in google-suggest.test.js)
// ---------------------------------------------------------------------------

function parseSuggestResponse(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length < 2) return [];
  const arr = parsed[1];
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => typeof s === 'string');
}

function buildAlphabetQueries(seed) {
  const base = String(seed).trim();
  return ALPHABET.map((letter) => `${base} ${letter}`);
}

function buildModifierQueries(seed) {
  const base = String(seed).trim();
  const out = new Set();
  for (const mod of MODIFIERS) {
    out.add(`${mod} ${base}`);
    out.add(`${base} ${mod}`);
  }
  return [...out];
}

function dedupeSuggestions(arrays) {
  const seen = new Set();
  for (const arr of arrays) {
    for (const s of arr) {
      const norm = String(s).trim().toLowerCase();
      if (norm) seen.add(norm);
    }
  }
  return [...seen];
}

function isExpansion(suggestion, seed) {
  return String(suggestion).trim().toLowerCase() !== String(seed).trim().toLowerCase();
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows) {
  const header = 'seed,suggestion,modifier';
  const body = rows
    .map((r) => [csvEscape(r.seed), csvEscape(r.suggestion), csvEscape(r.modifier)].join(','))
    .join('\n');
  return `${header}\n${body}\n`;
}

// ---------------------------------------------------------------------------
// Network (not unit-tested — see live smoke test in google-suggest.smoke.js)
// ---------------------------------------------------------------------------

function fetchSuggest(query, { hl = 'en', gl = 'us' } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://suggestqueries.google.com/complete/search');
    url.searchParams.set('client', 'firefox');
    url.searchParams.set('q', query);
    url.searchParams.set('hl', hl);
    url.searchParams.set('gl', gl);
    https
      .get(
        url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (aiwholesail-seo-research)' } },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve(parseSuggestResponse(body)));
        }
      )
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function expandSeed(seed, { alphabet, modifiers } = {}) {
  const rows = [];
  // The seed itself first.
  const baseSuggestions = await fetchSuggest(seed);
  for (const s of baseSuggestions) {
    if (isExpansion(s, seed)) rows.push({ seed, suggestion: s, modifier: '' });
  }
  await sleep(DELAY_MS);

  if (alphabet) {
    for (const query of buildAlphabetQueries(seed)) {
      const letter = query.slice(seed.length).trim();
      const sugs = await fetchSuggest(query);
      for (const s of sugs) {
        if (isExpansion(s, seed)) rows.push({ seed, suggestion: s, modifier: letter });
      }
      await sleep(DELAY_MS);
    }
  }

  if (modifiers) {
    for (const query of buildModifierQueries(seed)) {
      const sugs = await fetchSuggest(query);
      for (const s of sugs) {
        if (isExpansion(s, seed)) rows.push({ seed, suggestion: s, modifier: query });
      }
      await sleep(DELAY_MS);
    }
  }

  // Dedupe across runs of the same seed.
  const seen = new Set();
  return rows.filter((r) => {
    const key = `${r.seed}|${r.suggestion.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugifySeed(seed) {
  return String(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main(argv) {
  const args = argv.slice(2);
  const flags = {
    alphabet: args.includes('--alphabet') || args.includes('-a'),
    modifiers: args.includes('--modifiers') || args.includes('-m'),
    csv: args.includes('--csv'),
    deep: args.includes('--deep'),
  };
  if (flags.deep) {
    flags.alphabet = true;
    flags.modifiers = true;
  }

  let seeds = [];
  const batchIdx = args.indexOf('--batch');
  if (batchIdx !== -1) {
    const file = args[batchIdx + 1];
    if (!file) {
      console.error('Error: --batch requires a file path');
      process.exit(1);
    }
    seeds = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } else {
    seeds = args.filter((a) => !a.startsWith('--') && !a.startsWith('-'));
  }

  if (seeds.length === 0) {
    console.error('Usage: google-suggest.js "<seed>" [--alphabet] [--modifiers] [--deep] [--csv]');
    console.error('       google-suggest.js --batch seeds.txt [--alphabet] [--csv]');
    process.exit(1);
  }

  ensureDir(RESULTS_DIR);
  const date = new Date().toISOString().split('T')[0];
  const allRows = [];

  for (const seed of seeds) {
    process.stderr.write(`[suggest] ${seed}…\n`);
    const rows = await expandSeed(seed, flags);
    allRows.push(...rows);
    process.stderr.write(`           +${rows.length} expansions\n`);
  }

  if (flags.csv) {
    const slug = seeds.length === 1 ? slugifySeed(seeds[0]) : 'batch';
    const csvPath = path.join(RESULTS_DIR, `suggest-${slug}-${date}.csv`);
    fs.writeFileSync(csvPath, toCsv(allRows));
    process.stderr.write(`\n[suggest] wrote ${allRows.length} rows -> ${csvPath}\n`);
  } else {
    console.log(JSON.stringify(allRows, null, 2));
  }
}

module.exports = {
  parseSuggestResponse,
  buildAlphabetQueries,
  buildModifierQueries,
  dedupeSuggestions,
  isExpansion,
  toCsv,
  fetchSuggest,
  expandSeed,
};

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });
}
