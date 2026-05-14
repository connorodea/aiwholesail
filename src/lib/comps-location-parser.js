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
  const queries = [zip, cityState, trimmed].filter(Boolean);

  return { zip, cityState, queries };
}
