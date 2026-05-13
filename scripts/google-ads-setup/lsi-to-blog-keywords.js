#!/usr/bin/env node
/**
 * lsi-to-blog-keywords.js — Bridge the LSI low-comp queue into the
 * /seo-blog skill's keywords.csv contract.
 *
 * Usage:
 *   node scripts/google-ads-setup/lsi-to-blog-keywords.js
 *
 * Flags:
 *   --queue <path>     Override LSI queue CSV (default lsi-low-comp-queue.csv)
 *   --out <path>       Override output keywords.csv (default ./keywords.csv at project root)
 *   --dry-run          Print resulting row count without writing
 *
 * Column mapping (LSI queue → keywords.csv):
 *   keyword             → keyword
 *   volume              → volume
 *   competition         → difficulty
 *   suggested_page_type → intent (tool→transactional, blog→informational,
 *                                  blog-comparison→commercial, location→local)
 *   source_seed         → cluster
 *
 * Merge semantics:
 *   - Rows in the existing keywords.csv with non-empty `status` are preserved
 *     verbatim (do not overwrite published / in_progress work).
 *   - Brand-new keywords from the LSI queue are appended.
 *   - Within a cluster, rows are sorted by volume desc.
 *
 * Exports the pure functions for tests (see lsi-to-blog-keywords.test.js).
 */
const fs = require('fs');
const path = require('path');

const KEYWORDS_HEADER = 'keyword,volume,difficulty,intent,cluster,status,published_url,published_at';

const INTENT_MAP = {
  'tool': 'transactional',
  'blog': 'informational',
  'blog-comparison': 'commercial',
  'location': 'local',
};

function mapIntent(pageType) {
  return INTENT_MAP[pageType] || 'informational';
}

function mapRow(lsiRow) {
  return {
    keyword: String(lsiRow.keyword || '').trim(),
    volume: Number(lsiRow.volume) || 0,
    difficulty: String(lsiRow.competition || 'low').trim().toLowerCase(),
    intent: mapIntent(String(lsiRow.suggested_page_type || '').trim().toLowerCase()),
    cluster: String(lsiRow.source_seed || '').trim(),
    status: '',
    published_url: '',
    published_at: '',
  };
}

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

function parseKeywordsCsv(filePath) {
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
      difficulty: String(r.difficulty || '').trim().toLowerCase(),
      intent: String(r.intent || '').trim().toLowerCase(),
      cluster: String(r.cluster || '').trim(),
      status: String(r.status || '').trim().toLowerCase(),
      published_url: String(r.published_url || '').trim(),
      published_at: String(r.published_at || '').trim(),
    });
  }
  return rows;
}

function parseLsiQueueCsv(filePath) {
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
    rows.push(r);
  }
  return rows;
}

// ---- Merge: preserve in-flight/published, append new keywords. ----
function mergeQueues(existing, incoming) {
  const byKey = new Map();
  // Existing rows with any status take precedence and are preserved verbatim.
  for (const r of existing) {
    if (!r.keyword) continue;
    byKey.set(r.keyword.toLowerCase(), { ...r });
  }
  // Incoming rows are added only if no existing row with the same keyword.
  for (const r of incoming) {
    if (!r.keyword) continue;
    const k = r.keyword.toLowerCase();
    if (!byKey.has(k)) byKey.set(k, { ...r });
  }
  const all = [...byKey.values()];
  // Sort by cluster, then volume desc within cluster.
  all.sort((a, b) => {
    if (a.cluster !== b.cluster) return a.cluster.localeCompare(b.cluster);
    return (b.volume || 0) - (a.volume || 0);
  });
  return all;
}

// ---- Render CSV with proper quoting. ----
function csvEscape(field) {
  const s = String(field ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toKeywordsCsv(rows) {
  const lines = [KEYWORDS_HEADER];
  for (const r of rows) {
    lines.push([
      csvEscape(r.keyword),
      csvEscape(r.volume),
      csvEscape(r.difficulty),
      csvEscape(r.intent),
      csvEscape(r.cluster),
      csvEscape(r.status || ''),
      csvEscape(r.published_url || ''),
      csvEscape(r.published_at || ''),
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

// ---- CLI. ----
function parseArgs(argv) {
  const opts = {
    queue: path.join(__dirname, 'lsi-low-comp-queue.csv'),
    out: path.join(__dirname, '..', '..', 'keywords.csv'),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--queue': opts.queue = next; i++; break;
      case '--out': opts.out = next; i++; break;
      case '--dry-run': opts.dryRun = true; break;
      default: break;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const lsiRows = parseLsiQueueCsv(opts.queue);
  if (lsiRows.length === 0) {
    console.error(`No LSI queue rows found at ${opts.queue}. Run aggregate-lsi.js first.`);
    process.exit(1);
  }
  const incoming = lsiRows.map(mapRow);
  const existing = parseKeywordsCsv(opts.out);
  const merged = mergeQueues(existing, incoming);
  const preserved = merged.filter((r) => r.status).length;
  const fresh = merged.length - preserved;
  console.log(`LSI queue rows: ${lsiRows.length}`);
  console.log(`Existing keywords.csv rows: ${existing.length} (preserved: ${preserved})`);
  console.log(`Total after merge:           ${merged.length} (${fresh} new)`);
  if (opts.dryRun) {
    console.log('--dry-run: not writing');
    return;
  }
  fs.writeFileSync(opts.out, toKeywordsCsv(merged));
  console.log(`Wrote: ${opts.out}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  mapRow,
  mapIntent,
  mergeQueues,
  toKeywordsCsv,
  parseKeywordsCsv,
  parseLsiQueueCsv,
};
