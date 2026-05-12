/**
 * Freeform location → list of US ZIPs.
 *
 * Used by the off-market AbsenteeOwnerSearch and any other surface that
 * needs to fan out PropData zip-keyed queries from a user-typed location
 * string. The on-market Zillow search bypasses this — Zillow's API does
 * its own location resolution.
 *
 * Supported input shapes:
 *   "55101"                       single ZIP
 *   "55101, 55102 55103"          multi-ZIP (comma / space / semicolon / newline)
 *   "MI" | "Michigan"             state → top-N ZIPs by population
 *   "Detroit, MI" | "Detroit MI"  city → all ZIPs in that city
 *   "Oakland County, MI"          county → geocode + radius fallback
 *
 * Everything else falls through to PropData /v1/geocode → radius search.
 */

import { lookupZipCentroid, zipsInState, zipsInCity, parseZipList, resolveOrigin, zipsWithinRadius, MAX_ZIPS_PER_SEARCH } from './zip-search';

// 2-letter abbreviation lookup — built from the same table the on-market search uses.
const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
};
const STATE_ABBREVIATIONS = new Set(Object.values(US_STATES));

function normalizeStateToken(tok: string): string | null {
  const t = tok.trim();
  if (!t) return null;
  if (t.length === 2 && STATE_ABBREVIATIONS.has(t.toUpperCase())) return t.toUpperCase();
  const lc = t.toLowerCase();
  if (US_STATES[lc]) return US_STATES[lc];
  return null;
}

export type LocationKind = 'single-zip' | 'multi-zip' | 'state' | 'city' | 'county' | 'geocode';

export interface ResolvedLocation {
  zips: string[];
  kind: LocationKind;
  label: string;
}

/**
 * Resolve a freeform location string into a deduped list of ZIPs (capped
 * at MAX_ZIPS_PER_SEARCH so fan-out stays bounded). Returns null when the
 * input is empty or fails to resolve to any usable ZIPs.
 *
 * @param topZipsInState  Optional ranking function for state-level
 *                        resolution. The off-market caller passes a
 *                        population-weighted picker so we don't fan out
 *                        to rural ZIPs with no PropData coverage.
 */
export async function resolveLocation(
  input: string,
  opts: { topZipsInState?: (state: string, max: number) => string[] } = {}
): Promise<ResolvedLocation | null> {
  const raw = input.trim();
  if (!raw) return null;

  // 1. Multi-ZIP detection — any string containing 2+ valid ZIPs.
  const parsed = parseZipList(raw);
  if (parsed.valid.length >= 2) {
    const zips = parsed.valid.slice(0, MAX_ZIPS_PER_SEARCH);
    return { zips, kind: 'multi-zip', label: `${zips.length} ZIPs` };
  }
  if (parsed.valid.length === 1 && parsed.invalid.length === 0) {
    return { zips: [parsed.valid[0]], kind: 'single-zip', label: parsed.valid[0] };
  }

  // 2. State alone — "MI" or "Michigan".
  // Merge population-ranked ZIPs with state centroids. The pop-ranked file
  // (zipcodes.json from PR #175) only covers ~1,000 US ZIPs nationwide, so
  // some states have <5 entries (MN had 4 at time of writing). Filling the
  // remainder from centroids ensures the user gets a full 25-ZIP fan-out
  // when they search a whole state.
  const stateAlone = normalizeStateToken(raw);
  if (stateAlone) {
    const top = opts.topZipsInState?.(stateAlone, MAX_ZIPS_PER_SEARCH) ?? [];
    const merged: string[] = [...top];
    const seen = new Set(merged);
    if (merged.length < MAX_ZIPS_PER_SEARCH) {
      const centroids = await zipsInState(stateAlone, MAX_ZIPS_PER_SEARCH);
      for (const c of centroids) {
        if (merged.length >= MAX_ZIPS_PER_SEARCH) break;
        if (seen.has(c.zip)) continue;
        merged.push(c.zip);
        seen.add(c.zip);
      }
    }
    if (merged.length) {
      const label = top.length === merged.length
        ? `${stateAlone} (top ${merged.length} by population)`
        : `${stateAlone} (top ${top.length} by pop + ${merged.length - top.length} more)`;
      return { zips: merged, kind: 'state', label };
    }
  }

  // 3. "Something, ST" — could be City or County. Split, take last token as
  //    state, the rest as the locality.
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const stateTok = normalizeStateToken(parts[parts.length - 1]);
    const locality = parts.slice(0, -1).join(', ');
    if (stateTok && locality) {
      const lower = locality.toLowerCase();
      const isCounty = /\bcounty\b/.test(lower) || /\bparish\b/.test(lower);

      if (isCounty) {
        // 3a. County → geocode + radius fallback.
        const origin = await resolveOrigin(raw);
        if (origin) {
          const matches = await zipsWithinRadius({ lat: origin.lat, lng: origin.lng }, 15, MAX_ZIPS_PER_SEARCH);
          if (matches.length) {
            return {
              zips: matches.map((m) => m.zip),
              kind: 'county',
              label: `${locality}, ${stateTok} (~15mi)`,
            };
          }
        }
      } else {
        // 3b. City — strip "City of" / "City" if present, exact match.
        const cleaned = locality
          .replace(/\bcity\s+of\s+/i, '')
          .replace(/\bcity\b/i, '')
          .trim();
        const cityMatches = await zipsInCity(cleaned, stateTok);
        if (cityMatches.length) {
          const zips = cityMatches.slice(0, MAX_ZIPS_PER_SEARCH).map((c) => c.zip);
          return { zips, kind: 'city', label: `${cleaned}, ${stateTok}` };
        }
      }
    }
  }

  // 4. Last-resort geocode + 10mi radius — handles "Charlotte" alone,
  //    addresses, neighborhood names, etc.
  const origin = await resolveOrigin(raw);
  if (origin) {
    const matches = await zipsWithinRadius({ lat: origin.lat, lng: origin.lng }, 10, MAX_ZIPS_PER_SEARCH);
    if (matches.length) {
      return {
        zips: matches.map((m) => m.zip),
        kind: 'geocode',
        label: origin.label,
      };
    }
  }

  return null;
}

// Re-export so importers can stick to one module.
export { lookupZipCentroid };
