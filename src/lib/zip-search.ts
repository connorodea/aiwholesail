/**
 * Multi-zip + zip-radius search helpers.
 *
 * Centroid data is fetched lazily from /data/us-zip-centroids.tsv so the
 * ~1.5MB (≈400KB gzipped) file never ships in the initial bundle.
 */

export interface ZipCentroid {
  zip: string;
  lat: number;
  lng: number;
  state: string;
  city: string;
}

export interface RadiusMatch extends ZipCentroid {
  distanceMi: number;
}

export const MAX_ZIPS_PER_SEARCH = 25;
export const MAX_RADIUS_MI = 100;

/**
 * Parse a freeform string of zip codes (comma, space, semicolon, or newline
 * separated) into a deduped, validated list of 5-digit US zips.
 */
export function parseZipList(input: string): { valid: string[]; invalid: string[] } {
  const tokens = input
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const tok of tokens) {
    // Accept 3-, 4-, or 5-digit numeric tokens. Pad to 5 to handle spreadsheets
    // that strip leading zeros (e.g. "501" → "00501" is a real Holtsville ZIP).
    const z = /^\d{3,5}$/.test(tok) ? tok.padStart(5, '0') : null;
    if (z) {
      if (!seen.has(z)) {
        seen.add(z);
        valid.push(z);
      }
    } else {
      invalid.push(tok);
    }
  }

  return { valid, invalid };
}

let centroidCache: Map<string, ZipCentroid> | null = null;
let centroidPromise: Promise<Map<string, ZipCentroid>> | null = null;

async function loadCentroids(): Promise<Map<string, ZipCentroid>> {
  if (centroidCache) return centroidCache;
  if (centroidPromise) return centroidPromise;

  centroidPromise = (async () => {
    const res = await fetch('/data/us-zip-centroids.tsv');
    if (!res.ok) throw new Error(`Failed to load zip centroids: ${res.status}`);
    const text = await res.text();
    const map = new Map<string, ZipCentroid>();
    for (const line of text.split('\n')) {
      if (!line) continue;
      const [zip, latStr, lngStr, state, city] = line.split('\t');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!zip || Number.isNaN(lat) || Number.isNaN(lng)) continue;
      map.set(zip, { zip, lat, lng, state: state || '', city: city || '' });
    }
    centroidCache = map;
    return map;
  })();

  try {
    return await centroidPromise;
  } catch (e) {
    centroidPromise = null;
    throw e;
  }
}

export async function lookupZipCentroid(zip: string): Promise<ZipCentroid | null> {
  const map = await loadCentroids();
  return map.get(zip) ?? null;
}

/** Great-circle distance in miles. */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Return zip centroids within `radiusMi` of `origin`, sorted by distance.
 * Limited to `maxResults` (default 50) to keep downstream fan-out bounded.
 */
export async function zipsWithinRadius(
  origin: { lat: number; lng: number },
  radiusMi: number,
  maxResults = 50,
): Promise<RadiusMatch[]> {
  if (radiusMi <= 0) return [];
  const r = Math.min(radiusMi, MAX_RADIUS_MI);
  const map = await loadCentroids();
  const matches: RadiusMatch[] = [];

  // Bounding-box pre-filter — 1° latitude ≈ 69 mi; longitude scales by cos(lat).
  const latDelta = r / 69;
  const lngDelta = r / (69 * Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.01));
  const minLat = origin.lat - latDelta;
  const maxLat = origin.lat + latDelta;
  const minLng = origin.lng - lngDelta;
  const maxLng = origin.lng + lngDelta;

  for (const c of map.values()) {
    if (c.lat < minLat || c.lat > maxLat || c.lng < minLng || c.lng > maxLng) continue;
    const d = haversineMiles(origin.lat, origin.lng, c.lat, c.lng);
    if (d <= r) matches.push({ ...c, distanceMi: d });
  }

  matches.sort((a, b) => a.distanceMi - b.distanceMi);
  return matches.slice(0, maxResults);
}

/**
 * Resolve an origin (zip or address) to lat/lng.
 * - 5-digit zip → local centroid lookup (no network if cache is warm).
 * - Anything else → PropData /v1/geocode.
 */
export async function resolveOrigin(input: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{5}$/.test(trimmed)) {
    const c = await lookupZipCentroid(trimmed);
    if (c) return { lat: c.lat, lng: c.lng, label: `${trimmed} (${c.city}, ${c.state})` };
  }

  const { propDataAPI } = await import('@/lib/propdata-api');
  const geo = await propDataAPI.geocode(trimmed).catch(() => null);
  if (geo?.lat != null && geo?.lng != null) {
    return { lat: geo.lat, lng: geo.lng, label: geo.formatted_address || trimmed };
  }
  return null;
}

/**
 * Run a per-zip async fn against a list of zips with bounded concurrency.
 * Skips entries that throw or return null.
 */
export async function fanOutZipSearch<T>(
  zips: string[],
  fn: (zip: string) => Promise<T | null>,
  concurrency = 4,
): Promise<{ zip: string; result: T }[]> {
  const results: { zip: string; result: T }[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, zips.length) }, async () => {
    while (i < zips.length) {
      const idx = i++;
      const zip = zips[idx];
      try {
        const r = await fn(zip);
        if (r != null) results.push({ zip, result: r });
      } catch {
        // swallow — one bad zip shouldn't abort the batch
      }
    }
  });
  await Promise.all(workers);
  return results;
}
