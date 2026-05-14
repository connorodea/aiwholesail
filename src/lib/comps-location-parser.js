// Pure helper: parse a free-text location string into a ZIP + cityState
// pair plus a prioritized queries array. Used by ZillowAPI.getPropertyComps
// when the direct comps endpoint returns nothing and we fall back to a
// recently-sold search.
//
// Lives in plain JS (ESM) so node:test runs without a transpiler — mirrors
// src/lib/comps-similarity.js (PR #371) and src/lib/seo/comparison-meta.js.
//
// Rework of stale PR #92: the original branch was based on an older
// getPropertyComps surface. The bug it was trying to fix (3-part comma-
// separated input parsing as cityState=state-only) still exists on current
// main — this rewrite extracts the parser as a pure function and TDD-fixes
// the 3-part case in isolation, leaving the rest of getPropertyComps
// untouched.
//
// Input shapes the parser must handle:
//   "Charlotte, NC 28083"           → 2-part with state+zip glued together
//   "Saint Augustine, FL, 32092"    → 3-part (THE BUG): multi-word city + bare zip
//   "Charlotte, NC, 28083"          → 3-part single-word city
//   "Saint Augustine, FL, 32092-1234" → 3-part with ZIP+4
//   "Asheville, NC"                 → 2-part no zip
//   "28083"                          → bare zip
//   "Charlotte NC 28083"            → no commas
//
// Output: { zip, cityState, queries }
//   zip:       5-digit string or null
//   cityState: "City STATE" (state un-abbreviated to whatever the input had) or null
//   queries:   prioritized search strings (ZIP first, then cityState, then raw),
//              with falsy values filtered. Caller iterates from tightest
//              radius (ZIP) to broadest (raw location).

function isBareZip(segment) {
  return /^\d{5}(?:-\d{4})?$/.test(segment);
}

// US state full names, lowercased for case-insensitive matching. Used to
// detect 4-part "verbose-state" input where the user typed both the
// spelled-out state ("Florida") and the abbreviation ("FL"), e.g.
// "Saint Augustine, Florida, FL, 32092". Without this set, the parser
// would pick "Florida" as the city and scope the fallback comps search
// to the entire state. With this set, the parser detects redundancy and
// uses the segment BEFORE the state name (parts[length-4]) as the city.
//
// District of Columbia included since some Zillow listings use it as a
// state. US territories (Puerto Rico, Guam, etc.) are not included
// because Zillow's coverage there is sparse and the failure mode of
// verbose-state input from those regions is low-impact.
const US_STATE_NAMES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
]);

function isUsStateName(segment) {
  return US_STATE_NAMES.has(String(segment || '').trim().toLowerCase());
}

export function parseCompsLocation(location) {
  if (typeof location !== 'string') {
    return { zip: null, cityState: null, queries: [] };
  }

  const trimmed = location.trim();
  if (!trimmed) {
    return { zip: null, cityState: null, queries: [] };
  }

  // ZIP is the strongest signal — extract from anywhere in the string. The
  // regex captures the 5-digit base even when followed by -1234 (ZIP+4).
  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : null;

  // Split on commas, trim each part, drop empties (handles trailing commas
  // and double-commas from copy-paste).
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);

  let cityState = null;
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    let cityIdx;
    let stateSrcIdx;

    if (isBareZip(lastPart) && parts.length >= 3) {
      // 3-part "City, State, ZIP" — multi-word city case fixed here.
      // Last segment is the bare ZIP (e.g. "32092"), so state is in the
      // second-to-last position and city is third-to-last. This is the
      // case the pre-rework code got wrong: it always treated the last
      // segment as state-plus-zip and second-to-last as city.
      stateSrcIdx = parts.length - 2;
      cityIdx = parts.length - 3;

      // Verbose-state detection (4-part+): when the user typed both the
      // spelled-out state AND the abbreviation, parts[length-3] holds
      // the full state name (e.g. "Florida") which is redundant with
      // parts[length-2] (the abbreviation "FL"). Skip the redundant
      // segment and use parts[length-4] as the city instead. Only
      // applies when length >= 4 — a 3-part input always means parts
      // [length-3] IS the city, never a verbose state.
      if (parts.length >= 4 && isUsStateName(parts[cityIdx])) {
        cityIdx = parts.length - 4;
      }
    } else {
      // 2-part "City, ST ZIP" or "City, State" — state lives in the last
      // segment (digits stripped) and city in the second-to-last. Existing
      // behavior, preserved.
      stateSrcIdx = parts.length - 1;
      cityIdx = parts.length - 2;
    }

    const stateOnly = parts[stateSrcIdx].replace(/\d+/g, '').replace(/[-\s]+$/, '').trim();
    const city = parts[cityIdx];
    const candidate = `${city} ${stateOnly}`.trim();
    cityState = candidate || null;
  }

  // Prioritized fallback queries: ZIP first (tightest), then cityState
  // (city scope), then raw (last resort). filter(Boolean) drops null/empty
  // so the search loop doesn't waste a round-trip on an empty query.
  //
  // Dedupe via Set so the fallback search doesn't issue the same scrape.do
  // request twice. The common case this catches is bare-ZIP input
  // ("28083") where queries[0]=zip and queries[2]=raw resolve to the same
  // string. Pre-dedup the fallback loop hit scrape.do twice and added
  // ~1.5s of wasted latency per bare-ZIP comps lookup.
  const queries = [...new Set([zip, cityState, trimmed].filter(Boolean))];

  return { zip, cityState, queries };
}
