/**
 * Address → coordinates with persistent cache.
 *
 * Off-market heatmap (Phase 7) needs lat/lng for each property in the
 * absentee search results. PropData's bulk /v1/property response doesn't
 * include coordinates — we fan out to /v1/geocode per address, but cache
 * each result in `geocode_cache` (migration 015) since addresses don't
 * move. Cache hit → zero upstream calls, sub-millisecond response.
 *
 * Exposed surface:
 *  - normalizeAddress(parts)  → canonical string for hashing
 *  - addressHash(parts)       → sha256 hex digest, 64 chars
 *  - geocodeMany(records, db, fetchGeocoder) → enriches an array of
 *      records in place with .lat / .lng, returning hit/miss counts
 *
 * Pure where it counts (normalize + hash). The geocodeMany function is
 * intentionally injected with its DB query function + geocoder fetcher so
 * the tests can stub both without spinning up Postgres or hitting RapidAPI.
 */

const crypto = require('crypto');

/**
 * Canonicalize the parts of an address for stable hashing.
 * Lowercases, collapses whitespace, joins with single spaces. Numeric ZIP
 * preserved as-is (PropData returns strings); strips '+4' suffix.
 *
 * @param {{ street?: string, city?: string, zip?: string|number }} parts
 * @returns {string} canonical address, or '' if no usable components
 */
function normalizeAddress(parts) {
  if (!parts || typeof parts !== 'object') return '';
  const street = typeof parts.street === 'string' ? parts.street.trim().toLowerCase() : '';
  const city = typeof parts.city === 'string' ? parts.city.trim().toLowerCase() : '';
  const rawZip = parts.zip;
  const zip = typeof rawZip === 'string' || typeof rawZip === 'number'
    ? String(rawZip).trim().split('-')[0]   // strip "+4" suffix on 9-digit ZIPs
    : '';
  const joined = [street, city, zip].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  return joined;
}

/**
 * SHA-256 hex digest of the normalized address. Stable across casing and
 * whitespace. Returns '' when there's nothing to hash (caller should skip).
 */
function addressHash(parts) {
  const norm = normalizeAddress(parts);
  if (!norm) return '';
  return crypto.createHash('sha256').update(norm).digest('hex');
}

/**
 * Batch-geocode an array of records, enriching each with `.lat` and `.lng`
 * from either the persistent cache or a fresh upstream call. Mutates the
 * input records in place. Returns { hits, misses, failed } counts so
 * callers (and tests) can verify behavior.
 *
 * Each record must expose an `.address` sub-object with at least `street`
 * and `zip` (matching PropDataPropertyRecord shape). Records that fail to
 * normalize (no usable address) or that the geocoder can't resolve are
 * left without lat/lng — heatmap code must tolerate missing coords.
 *
 * @param {Array<object>} records
 * @param {{ query: (sql: string, params: any[]) => Promise<{rows: any[]}> }} db
 * @param {(parts: object) => Promise<{lat?: number, lng?: number, formatted_address?: string} | null>} fetchGeocoder
 * @returns {Promise<{hits: number, misses: number, failed: number}>}
 */
async function geocodeMany(records, db, fetchGeocoder) {
  if (!Array.isArray(records) || records.length === 0) {
    return { hits: 0, misses: 0, failed: 0 };
  }

  // Pass 1 — hash every record, build a map address_hash → records list
  // (multiple records can share an address, e.g. units in a building).
  const byHash = new Map();
  for (const rec of records) {
    const hash = addressHash(rec?.address);
    if (!hash) continue;
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(rec);
  }
  const hashes = Array.from(byHash.keys());
  if (hashes.length === 0) return { hits: 0, misses: 0, failed: records.length };

  // Pass 2 — single bulk SELECT against the cache.
  const cacheResult = await db.query(
    `SELECT address_hash, latitude, longitude
     FROM geocode_cache
     WHERE address_hash = ANY($1)`,
    [hashes]
  );

  let hits = 0;
  const cached = new Set();
  for (const row of cacheResult.rows) {
    const recs = byHash.get(row.address_hash) || [];
    for (const r of recs) {
      r.lat = Number(row.latitude);
      r.lng = Number(row.longitude);
      hits++;
    }
    cached.add(row.address_hash);
  }

  // Pass 3 — fan out to the geocoder for cache misses. Sequential to
  // respect upstream rate limits; small N (≤100) keeps latency reasonable.
  let misses = 0;
  let failed = 0;
  for (const hash of hashes) {
    if (cached.has(hash)) continue;
    const recs = byHash.get(hash);
    const sample = recs[0];
    try {
      const result = await fetchGeocoder(sample.address);
      if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
        for (const r of recs) {
          r.lat = result.lat;
          r.lng = result.lng;
        }
        misses++;
        // Fire-and-forget cache write; don't await so a slow INSERT
        // doesn't gate the response. Errors are non-fatal (the upstream
        // call already succeeded; cache write failures degrade to a
        // future re-call).
        db.query(
          `INSERT INTO geocode_cache (address_hash, formatted_address, latitude, longitude, source)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (address_hash) DO NOTHING`,
          [hash, result.formatted_address || normalizeAddress(sample.address), result.lat, result.lng, 'propdata']
        ).catch(err => console.error('[geocode] cache write failed:', err.message));
      } else {
        failed += recs.length;
      }
    } catch (err) {
      console.error('[geocode] upstream failed for', normalizeAddress(sample.address), '-', err.message);
      failed += recs.length;
    }
  }

  return { hits, misses, failed };
}

module.exports = { normalizeAddress, addressHash, geocodeMany };
