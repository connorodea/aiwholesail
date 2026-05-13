/**
 * Pure helpers for shadow-compare-zillow.js.
 *
 * Kept dependency-free so they can be unit-tested without pulling in axios,
 * the scrape.do scraper, or any other runtime config. The driver script
 * (../shadow-compare-zillow.js) handles I/O, HTTP, and orchestration.
 */

/**
 * Canonical field set we diff between RapidAPI and scrape.do, mirroring the
 * shape produced by `mapPropertyToRapidApiShape` in
 * `lib/scrapers/zillowScrapeDo.js`. Keep this in sync with that mapper.
 *
 * Order roughly matches "most load-bearing first" so the markdown table reads
 * top-to-bottom from identity → pricing → physical → metadata.
 */
const CANONICAL_FIELDS = [
  'zpid',
  'address',
  'price',
  'zestimate',
  'rentZestimate',
  'bedrooms',
  'bathrooms',
  'livingArea',
  'lotSize',
  'yearBuilt',
  'homeType',
  'homeStatus',
  'latitude',
  'longitude',
  'daysOnZillow',
];

/**
 * Pull a canonical field from a raw response. The two backends nest things
 * differently — try a few likely paths. Returns `undefined` if not present.
 */
function pickField(data, field) {
  if (data == null || typeof data !== 'object') return undefined;
  // Direct hit
  if (Object.prototype.hasOwnProperty.call(data, field)) return data[field];
  // Common nests in zillow-working-api responses
  const candidates = [
    data.property,
    data.data,
    data.result,
    data.propertyDetails,
    data.address && field === 'address' ? data.address : null,
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && typeof c === 'object' && Object.prototype.hasOwnProperty.call(c, field)) {
      return c[field];
    }
  }
  return undefined;
}

/**
 * Normalize a value for comparison: trim strings, coerce numeric strings to
 * numbers, lowercase address-like strings. Returns the canonical form used by
 * `valuesMatch`.
 */
function normalizeValue(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    // Numeric string → number (helps when one backend returns "450000" and
    // the other 450000)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed.toLowerCase();
  }
  if (typeof v === 'boolean') return v;
  return v; // objects/arrays compared structurally below
}

/**
 * Are two values "the same enough" for parity purposes? Numbers within 1%
 * count as a match (zestimate/price tend to drift over time-of-scrape).
 * Strings are case-insensitive after trim. null/undefined collapse to null.
 */
function valuesMatch(a, b) {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  if (typeof na === 'number' && typeof nb === 'number') {
    if (na === nb) return true;
    const denom = Math.max(Math.abs(na), Math.abs(nb));
    if (denom === 0) return na === nb;
    return Math.abs(na - nb) / denom <= 0.01;
  }
  if (typeof na !== typeof nb) return false;
  if (typeof na === 'object') {
    try {
      return JSON.stringify(na) === JSON.stringify(nb);
    } catch (_e) {
      return false;
    }
  }
  return na === nb;
}

/**
 * Compute a field-level diff between two payloads. Returns an array of diff
 * entries; an empty array means "all canonical fields agree (or are both
 * absent)".
 *
 * @param {object|null} rapidapiData
 * @param {object|null} scrapeDoData
 * @param {string[]} fields  Defaults to CANONICAL_FIELDS.
 * @returns {Array<{field:string, rapidapiValue:any, scrapeDoValue:any, reason:string}>}
 */
function diffFields(rapidapiData, scrapeDoData, fields = CANONICAL_FIELDS) {
  const out = [];
  for (const field of fields) {
    const a = pickField(rapidapiData, field);
    const b = pickField(scrapeDoData, field);
    const aPresent = a !== undefined;
    const bPresent = b !== undefined;
    if (!aPresent && !bPresent) continue; // neither has it → not a discrepancy
    if (aPresent && !bPresent) {
      out.push({ field, rapidapiValue: a, scrapeDoValue: undefined, reason: 'missing_in_scrapedo' });
      continue;
    }
    if (!aPresent && bPresent) {
      out.push({ field, rapidapiValue: undefined, scrapeDoValue: b, reason: 'missing_in_rapidapi' });
      continue;
    }
    if (!valuesMatch(a, b)) {
      out.push({ field, rapidapiValue: a, scrapeDoValue: b, reason: 'value_mismatch' });
    }
  }
  return out;
}

/**
 * Compute a percentile (0..100) over a numeric array. Returns null on empty.
 * Uses linear interpolation between the two nearest ranks.
 */
function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * Roll up per-row results into a summary block (counts, latency percentiles,
 * per-field parity rate). Designed to be the JSON report's top-level shape
 * minus the `rows` array.
 *
 * @param {Array<{rapidapi:{ok:boolean,ms:number}, scrapeDo:{ok:boolean,ms:number}, diff:any[]}>} rows
 * @param {string[]} fields
 */
function aggregate(rows, fields = CANONICAL_FIELDS) {
  const totalRows = rows.length;
  let rapidapiSuccessCount = 0;
  let scrapeDoSuccessCount = 0;
  let bothSucceededCount = 0;
  let bothFailedCount = 0;
  const rapidapiMs = [];
  const scrapeDoMs = [];

  // Per-field parity counts: only counted when both backends succeeded.
  const perFieldAgree = Object.create(null);
  const perFieldEligible = Object.create(null);
  for (const f of fields) {
    perFieldAgree[f] = 0;
    perFieldEligible[f] = 0;
  }

  for (const row of rows) {
    const aOk = !!row.rapidapi?.ok;
    const bOk = !!row.scrapeDo?.ok;
    if (aOk) rapidapiSuccessCount++;
    if (bOk) scrapeDoSuccessCount++;
    if (aOk && bOk) bothSucceededCount++;
    if (!aOk && !bOk) bothFailedCount++;
    if (typeof row.rapidapi?.ms === 'number') rapidapiMs.push(row.rapidapi.ms);
    if (typeof row.scrapeDo?.ms === 'number') scrapeDoMs.push(row.scrapeDo.ms);

    if (aOk && bOk) {
      const mismatchFields = new Set((row.diff || []).map((d) => d.field));
      for (const f of fields) {
        perFieldEligible[f]++;
        if (!mismatchFields.has(f)) perFieldAgree[f]++;
      }
    }
  }

  const perFieldParityRate = Object.create(null);
  for (const f of fields) {
    perFieldParityRate[f] = perFieldEligible[f] === 0 ? null : perFieldAgree[f] / perFieldEligible[f];
  }

  return {
    totalRows,
    rapidapiSuccessCount,
    scrapeDoSuccessCount,
    bothSucceededCount,
    bothFailedCount,
    perFieldParityRate,
    p50Ms: { rapidapi: percentile(rapidapiMs, 50), scrapeDo: percentile(scrapeDoMs, 50) },
    p95Ms: { rapidapi: percentile(rapidapiMs, 95), scrapeDo: percentile(scrapeDoMs, 95) },
  };
}

/**
 * Build a single-row outcome sentence for the markdown summary.
 * Uses ✓ / △ / ✗ markers — kept here so tests can pin the exact format.
 */
function rowOutcomeSentence(row) {
  const addr = row.input?.address || '(unknown address)';
  const aOk = !!row.rapidapi?.ok;
  const bOk = !!row.scrapeDo?.ok;
  if (!aOk && !bOk) {
    return `✗ ${addr} — both failed (rapidapi: ${row.rapidapi?.error || 'error'}; scrape.do: ${row.scrapeDo?.error || 'error'}).`;
  }
  if (aOk && !bOk) {
    return `✗ ${addr} — rapidapi ok, scrape.do failed (${row.scrapeDo?.error || 'error'}).`;
  }
  if (!aOk && bOk) {
    return `✗ ${addr} — rapidapi ${row.rapidapi?.status || 'error'}, scrape.do succeeded.`;
  }
  // both ok
  const diff = row.diff || [];
  if (diff.length === 0) {
    return `✓ ${addr} — both succeeded, all fields match.`;
  }
  const missing = diff.filter((d) => d.reason === 'missing_in_scrapedo').map((d) => d.field);
  const extra = diff.filter((d) => d.reason === 'missing_in_rapidapi').map((d) => d.field);
  const mismatched = diff.filter((d) => d.reason === 'value_mismatch').map((d) => d.field);
  const parts = [];
  if (mismatched.length) parts.push(`${mismatched.length} mismatch (${mismatched.join(', ')})`);
  if (missing.length) parts.push(`scrape.do missing ${missing.join(', ')}`);
  if (extra.length) parts.push(`rapidapi missing ${extra.join(', ')}`);
  return `△ ${addr} — both succeeded, ${parts.join('; ')}.`;
}

/**
 * Format the full markdown summary report (parity table + per-row sentences).
 */
function formatMarkdown(summary, rows, ranAt, fields = CANONICAL_FIELDS) {
  const lines = [];
  lines.push(`# Shadow Compare — RapidAPI vs scrape.do`);
  lines.push('');
  lines.push(`- Ran at: ${ranAt}`);
  lines.push(`- Total rows: ${summary.totalRows}`);
  lines.push(`- RapidAPI success: ${summary.rapidapiSuccessCount}/${summary.totalRows}`);
  lines.push(`- scrape.do success: ${summary.scrapeDoSuccessCount}/${summary.totalRows}`);
  lines.push(`- Both succeeded: ${summary.bothSucceededCount}`);
  lines.push(`- Both failed: ${summary.bothFailedCount}`);
  const fmtMs = (v) => (v == null ? 'n/a' : `${Math.round(v)}ms`);
  lines.push(`- p50 latency: rapidapi=${fmtMs(summary.p50Ms.rapidapi)} scrape.do=${fmtMs(summary.p50Ms.scrapeDo)}`);
  lines.push(`- p95 latency: rapidapi=${fmtMs(summary.p95Ms.rapidapi)} scrape.do=${fmtMs(summary.p95Ms.scrapeDo)}`);
  lines.push('');
  lines.push('## Per-field parity rate (rows where both succeeded)');
  lines.push('');
  lines.push('| Field | Parity |');
  lines.push('| --- | --- |');
  for (const f of fields) {
    const r = summary.perFieldParityRate[f];
    const cell = r == null ? 'n/a' : `${(r * 100).toFixed(1)}%`;
    lines.push(`| ${f} | ${cell} |`);
  }
  lines.push('');
  lines.push('## Per-row outcomes');
  lines.push('');
  for (const row of rows) {
    lines.push(`- ${rowOutcomeSentence(row)}`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  CANONICAL_FIELDS,
  pickField,
  normalizeValue,
  valuesMatch,
  diffFields,
  percentile,
  aggregate,
  rowOutcomeSentence,
  formatMarkdown,
};
