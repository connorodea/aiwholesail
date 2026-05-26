#!/usr/bin/env node
/**
 * Reddit discovery scraper for real estate investing keyword + question mining.
 *
 * No API key. Uses Reddit's public JSON endpoint:
 *   https://www.reddit.com/search.json?q=<seed>&sort=relevance&t=year
 *
 * Defaults: limits to real-estate investing subreddits and ranks by engagement
 * (score + comments * 2). Question-style titles are flagged for PAA-snippet
 * mining.
 *
 * Modes:
 *   - Single seed:        node reddit-discovery.js "subject to real estate"
 *   - Batch:              node reddit-discovery.js --batch seeds.txt
 *   - Questions only:     ... --questions
 *   - All subreddits:     ... --no-subreddit-filter
 *   - CSV output:         ... --csv
 *
 * Polite: 1.2s delay between requests (Reddit asks for <= 60 req/min on
 * anonymous endpoints).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const RESULTS_DIR = path.join(__dirname, 'seo-kw-results');
const DELAY_MS = 1200;
const USER_AGENT =
  'aiwholesail-seo-research/1.0 (research; contact: connor@upscaledinc.com)';

// Substring patterns (case-insensitive) that flag a subreddit as real-estate
// relevant. Lower-friction than maintaining an exact-name allowlist — catches
// new subs like 'TorontoRealEstate', 'realestatetech', 'realestate2', etc.
const DEFAULT_SUBS = [
  'estate',
  'wholesal',
  'landlord',
  'flip',
  'brrrr',
  'rental',
  'passive',
  'subjectto',
  'subject-to',
  'creativefinance',
  'taxlien',
  'taxdeed',
  'airbnb',
  'str',
  'mortgage',
  'foreclosure',
  'realtor',
  'reit',
];

// ---------------------------------------------------------------------------
// Pure functions (unit-tested in reddit-discovery.test.js)
// ---------------------------------------------------------------------------

function parseRedditSearchResponse(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const children = parsed?.data?.children;
  if (!Array.isArray(children)) return [];
  return children
    .filter((c) => c?.kind === 't3' && c?.data)
    .map((c) => ({
      title: c.data.title || '',
      subreddit: c.data.subreddit || '',
      score: Number(c.data.score) || 0,
      num_comments: Number(c.data.num_comments) || 0,
      url: c.data.url || `https://reddit.com${c.data.permalink || ''}`,
      created_utc: Number(c.data.created_utc) || 0,
      author: c.data.author || '',
    }));
}

const QUESTION_STARTERS = [
  'how',
  'what',
  'why',
  'when',
  'where',
  'who',
  'which',
  'can',
  'should',
  'do',
  'does',
  'is',
  'are',
  'will',
  'would',
  'could',
  'anyone',
  'has anyone',
  'best',
];

function isQuestionTitle(title) {
  if (!title) return false;
  const lower = String(title).trim().toLowerCase();
  if (lower.includes('?')) return true;
  return QUESTION_STARTERS.some(
    (q) => lower === q || lower.startsWith(`${q} `) || lower.startsWith(`${q},`)
  );
}

function rankByEngagement(posts) {
  return [...posts]
    .map((p) => ({ ...p, engagement: p.score + p.num_comments * 2 }))
    .sort((a, b) => b.engagement - a.engagement);
}

function filterRelevantSubs(posts, allowedSubs) {
  const patterns = allowedSubs.map((s) => String(s).toLowerCase());
  return posts.filter((p) => {
    const name = String(p.subreddit).toLowerCase();
    return patterns.some((pat) => name.includes(pat));
  });
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows) {
  const header = 'seed,subreddit,score,comments,engagement,question,title,url';
  const body = rows
    .map((r) =>
      [
        csvEscape(r.seed),
        csvEscape(r.subreddit),
        csvEscape(r.score),
        csvEscape(r.num_comments),
        csvEscape(r.engagement ?? r.score + r.num_comments * 2),
        r.is_question ? 'yes' : 'no',
        csvEscape(r.title),
        csvEscape(r.url),
      ].join(',')
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

function fetchRedditSearch(seed, { sort = 'relevance', t = 'year', limit = 50 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://www.reddit.com/search.json');
    url.searchParams.set('q', seed);
    url.searchParams.set('sort', sort);
    url.searchParams.set('t', t);
    url.searchParams.set('limit', String(limit));
    https
      .get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 429) {
            return reject(new Error(`Reddit rate-limited (429) for "${seed}"`));
          }
          resolve(parseRedditSearchResponse(body));
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discoverForSeed(seed, opts) {
  const posts = await fetchRedditSearch(seed);
  let rows = posts.map((p) => ({
    ...p,
    seed,
    is_question: isQuestionTitle(p.title),
  }));
  if (opts.subreddits && !opts.allSubs) {
    rows = filterRelevantSubs(rows, opts.subreddits);
  }
  if (opts.questionsOnly) {
    rows = rows.filter((r) => r.is_question);
  }
  return rankByEngagement(rows);
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
    questionsOnly: args.includes('--questions') || args.includes('-q'),
    csv: args.includes('--csv'),
    allSubs: args.includes('--no-subreddit-filter'),
  };

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
    seeds = args.filter((a, i) => {
      if (a.startsWith('-')) return false;
      // skip values that follow flags expecting an argument
      const prev = args[i - 1];
      if (prev === '--batch') return false;
      return true;
    });
  }

  if (seeds.length === 0) {
    console.error('Usage: reddit-discovery.js "<seed>" [--questions] [--no-subreddit-filter] [--csv]');
    console.error('       reddit-discovery.js --batch seeds.txt [--csv]');
    process.exit(1);
  }

  ensureDir(RESULTS_DIR);
  const date = new Date().toISOString().split('T')[0];
  const allRows = [];

  for (const seed of seeds) {
    process.stderr.write(`[reddit] ${seed}…\n`);
    try {
      const rows = await discoverForSeed(seed, {
        subreddits: DEFAULT_SUBS,
        allSubs: flags.allSubs,
        questionsOnly: flags.questionsOnly,
      });
      allRows.push(...rows);
      process.stderr.write(`         +${rows.length} posts (${rows.filter((r) => r.is_question).length} questions)\n`);
    } catch (err) {
      process.stderr.write(`         ! ${err.message}\n`);
    }
    if (seeds.length > 1) await sleep(DELAY_MS);
  }

  if (flags.csv) {
    const slug = seeds.length === 1 ? slugifySeed(seeds[0]) : 'batch';
    const csvPath = path.join(RESULTS_DIR, `reddit-${slug}-${date}.csv`);
    fs.writeFileSync(csvPath, toCsv(allRows));
    process.stderr.write(`\n[reddit] wrote ${allRows.length} rows -> ${csvPath}\n`);
  } else {
    console.log(JSON.stringify(allRows, null, 2));
  }
}

module.exports = {
  parseRedditSearchResponse,
  isQuestionTitle,
  rankByEngagement,
  filterRelevantSubs,
  toCsv,
  fetchRedditSearch,
  discoverForSeed,
  DEFAULT_SUBS,
};

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });
}
