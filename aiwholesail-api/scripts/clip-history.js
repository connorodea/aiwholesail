#!/usr/bin/env node

/**
 * clip-history.js
 *
 * Scans the generated-clips and generated-social-assets directories, normalises
 * each run's manifest into a single record list, and emits CSV / Markdown / JSON
 * suitable for piping to other tools or pasting into a doc.
 *
 * Stdlib only (path, fs). No npm deps.
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.resolve(__dirname, '..');
const DEFAULT_CLIPS_DIR = path.join(API_DIR, 'generated-clips');
const DEFAULT_SHORTS_DIR = path.join(API_DIR, 'generated-social-assets');

const PLATFORMS = ['youtube', 'instagram', 'facebook', 'tiktok'];

// ---------------------------------------------------------------------------
// Argument parsing — mirrors the lightweight parser in bin/aiwholesail-clip.js
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { positionals: [], flags: {} };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      args.positionals.push(token);
      continue;
    }

    if (token.includes('=')) {
      const [key, ...rest] = token.slice(2).split('=');
      args.flags[key] = rest.join('=');
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.flags[key] = true;
      continue;
    }

    args.flags[key] = next;
    index += 1;
  }

  return args;
}

function printHelp() {
  console.log(`AIWholesail Clip History Reporter

Usage:
  node aiwholesail-api/scripts/clip-history.js [flags]

Flags:
  --clips-dir <path>        Override generated-clips dir
                            (default: aiwholesail-api/generated-clips)
  --shorts-dir <path>       Override generated-social-assets dir
                            (default: aiwholesail-api/generated-social-assets)
  --format csv|md|json      Output format (default: csv)
  --since <iso|mm/dd/yyyy>  Drop runs whose generatedAt is older than the value
  --platform <name>         Keep only runs that have any publishResult for this platform
  --status <status>         Match any platform whose status equals this value
                            (e.g. pending|published|failed|skipped|dry-run|not-requested)
  --out <path>              Write to file instead of stdout
  --limit N                 Cap the number of runs (newest-first)
  --help, -h                Show this help text
`);
}

// ---------------------------------------------------------------------------
// Manifest scanning
// ---------------------------------------------------------------------------
function safeReadDir(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    process.stderr.write(`[clip-history] WARN: failed to read ${dir}: ${error.message}\n`);
    return [];
  }
}

function loadManifest(manifestPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    process.stderr.write(
      `[clip-history] WARN: failed to parse manifest ${manifestPath}: ${error.message}\n`
    );
    return null;
  }
}

function scanDir(dir, kind) {
  const entries = safeReadDir(dir);
  const records = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(dir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = loadManifest(manifestPath);
    if (!manifest) continue;

    records.push(normaliseRecord(manifest, kind, manifestPath, entry.name));
  }

  return records;
}

function normaliseRecord(manifest, kind, manifestPath, dirName) {
  const runId = manifest.runId || dirName || '';
  const generatedAt = manifest.generatedAt || '';
  const topic = manifest.topicSlug || manifest.topic || '';
  const theme = manifest.theme || '';
  const assets = manifest.assets || {};
  const videoPath = assets.videoPath || '';
  const publicVideoUrl = assets.publicVideoUrl || '';
  const publishResults = manifest.publishResults || {};

  return {
    runId,
    kind,
    generatedAt,
    topic,
    theme,
    videoPath,
    publicVideoUrl,
    publishResults,
    manifestPath,
  };
}

// ---------------------------------------------------------------------------
// Per-platform URL derivation
// ---------------------------------------------------------------------------
function derivePlatformUrl(platform, result) {
  if (!result || typeof result !== 'object') return '';
  if (typeof result.url === 'string' && result.url) return result.url;

  switch (platform) {
    case 'youtube':
      if (result.videoId) return `https://www.youtube.com/watch?v=${result.videoId}`;
      return '';
    case 'instagram':
      if (result.mediaId) return `https://instagram.com/p/${result.mediaId}`;
      return '';
    case 'facebook':
      if (result.videoId) return `https://www.facebook.com/reel/${result.videoId}`;
      return '';
    case 'tiktok':
      // TikTok publishId isn't a public URL; leave blank unless one is provided.
      return '';
    default:
      return '';
  }
}

function platformStatus(record, platform) {
  const result = record.publishResults?.[platform];
  if (!result || typeof result !== 'object') return '';
  return typeof result.status === 'string' ? result.status : '';
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
function parseSinceFlag(raw) {
  if (raw == null || raw === '' || raw === true) return null;
  const value = String(raw).trim();
  // Try ISO first, then mm/dd/yyyy.
  let date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  const parts = value.split('/');
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts;
    date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(date.getTime())) return date;
  }

  throw new Error(`Could not parse --since value "${value}". Use ISO (2026-05-01) or mm/dd/yyyy.`);
}

function applyFilters(records, flags) {
  let filtered = records;

  const since = parseSinceFlag(flags.since);
  if (since) {
    filtered = filtered.filter((rec) => {
      if (!rec.generatedAt) return false;
      const t = new Date(rec.generatedAt).getTime();
      return Number.isFinite(t) && t >= since.getTime();
    });
  }

  if (flags.platform && flags.platform !== true) {
    const platform = String(flags.platform).toLowerCase();
    filtered = filtered.filter((rec) => {
      const result = rec.publishResults?.[platform];
      return result && typeof result === 'object';
    });
  }

  if (flags.status && flags.status !== true) {
    const wanted = String(flags.status).toLowerCase();
    filtered = filtered.filter((rec) => {
      const results = rec.publishResults || {};
      return Object.values(results).some(
        (result) => result && typeof result.status === 'string'
          && result.status.toLowerCase() === wanted
      );
    });
  }

  return filtered;
}

function sortNewestFirst(records) {
  return records.slice().sort((a, b) => {
    const ta = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
    const tb = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return String(b.runId).localeCompare(String(a.runId));
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const COLUMNS = [
  'runId',
  'kind',
  'generatedAt',
  'topic',
  'theme',
  'videoPath',
  'publicVideoUrl',
  'youtube_status',
  'youtube_url',
  'instagram_status',
  'instagram_url',
  'facebook_status',
  'facebook_url',
  'tiktok_status',
  'tiktok_url',
];

function recordToRow(record) {
  const row = {
    runId: record.runId,
    kind: record.kind,
    generatedAt: record.generatedAt,
    topic: record.topic,
    theme: record.theme,
    videoPath: record.videoPath,
    publicVideoUrl: record.publicVideoUrl,
  };
  for (const platform of PLATFORMS) {
    row[`${platform}_status`] = platformStatus(record, platform);
    row[`${platform}_url`] = derivePlatformUrl(platform, record.publishResults?.[platform]);
  }
  return row;
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (str === '') return '';
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsv(records) {
  const lines = [COLUMNS.join(',')];
  for (const record of records) {
    const row = recordToRow(record);
    lines.push(COLUMNS.map((col) => csvEscape(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function mdEscape(value) {
  const str = value == null ? '' : String(value);
  if (str === '') return '';
  return str.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatMarkdown(records) {
  const header = `| ${COLUMNS.join(' | ')} |`;
  const divider = `| ${COLUMNS.map(() => '---').join(' | ')} |`;
  const lines = [header, divider];
  for (const record of records) {
    const row = recordToRow(record);
    lines.push(`| ${COLUMNS.map((col) => mdEscape(row[col])).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

function formatJson(records) {
  return `${JSON.stringify(records.map(recordToRow), null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.flags.help || parsed.flags.h
      || parsed.positionals.includes('help')
      || parsed.positionals.includes('--help')) {
    printHelp();
    return;
  }

  const clipsDir = parsed.flags['clips-dir'] && parsed.flags['clips-dir'] !== true
    ? path.resolve(String(parsed.flags['clips-dir']))
    : DEFAULT_CLIPS_DIR;
  const shortsDir = parsed.flags['shorts-dir'] && parsed.flags['shorts-dir'] !== true
    ? path.resolve(String(parsed.flags['shorts-dir']))
    : DEFAULT_SHORTS_DIR;

  const formatRaw = parsed.flags.format && parsed.flags.format !== true
    ? String(parsed.flags.format).toLowerCase()
    : 'csv';
  if (!['csv', 'md', 'json'].includes(formatRaw)) {
    throw new Error(`Unknown --format "${formatRaw}". Use csv, md, or json.`);
  }

  const clipRecords = scanDir(clipsDir, 'clip');
  const shortRecords = scanDir(shortsDir, 'short');
  const all = clipRecords.concat(shortRecords);

  const filtered = applyFilters(all, parsed.flags);
  const sorted = sortNewestFirst(filtered);

  let limited = sorted;
  if (parsed.flags.limit && parsed.flags.limit !== true) {
    const limit = Number(parsed.flags.limit);
    if (Number.isFinite(limit) && limit > 0) {
      limited = sorted.slice(0, limit);
    }
  }

  let output;
  if (formatRaw === 'csv') {
    output = formatCsv(limited);
  } else if (formatRaw === 'md') {
    output = formatMarkdown(limited);
  } else {
    output = formatJson(limited);
  }

  if (parsed.flags.out && parsed.flags.out !== true) {
    const outPath = path.resolve(String(parsed.flags.out));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
    process.stderr.write(`[clip-history] wrote ${limited.length} record(s) to ${outPath}\n`);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[clip-history] ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  scanDir,
  normaliseRecord,
  derivePlatformUrl,
  applyFilters,
  sortNewestFirst,
  formatCsv,
  formatMarkdown,
  formatJson,
  recordToRow,
  COLUMNS,
};
