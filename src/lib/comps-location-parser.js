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

// US state full-name → two-letter abbreviation, lowercased keys for
// case-insensitive matching. Used to detect 4-part "verbose-state" input
// where the user typed both the spelled-out state ("Florida") and the
// abbreviation ("FL"), e.g. "Saint Augustine, Florida, FL, 32092".
//
// Why a Map instead of a Set (PR #385 code review):
//   A Set-only check ("is parts[length-3] a US state name?") fires on
//   addresses where the CITY happens to share a state's name —
//   "123 Main St, Washington, MO, 63090" parses as "123 Main St MO"
//   because Washington is in the Set. The Map lets us additionally
//   require parts[length-2] (the abbreviation slot) to actually match
//   the state-name's abbreviation: "Florida" + "FL" ✓ (verbose, skip);
//   "Washington" + "MO" ✗ (state-named city, keep).
//
// District of Columbia included since some Zillow listings use it as a
// state. US territories (Puerto Rico, Guam, etc.) are not included
// because Zillow's coverage there is sparse and the failure mode of
// verbose-state input from those regions is low-impact.
const STATE_NAME_TO_ABBR = new Map([
  ['alabama', 'AL'], ['alaska', 'AK'], ['arizona', 'AZ'], ['arkansas', 'AR'],
  ['california', 'CA'], ['colorado', 'CO'], ['connecticut', 'CT'],
  ['delaware', 'DE'], ['florida', 'FL'], ['georgia', 'GA'], ['hawaii', 'HI'],
  ['idaho', 'ID'], ['illinois', 'IL'], ['indiana', 'IN'], ['iowa', 'IA'],
  ['kansas', 'KS'], ['kentucky', 'KY'], ['louisiana', 'LA'], ['maine', 'ME'],
  ['maryland', 'MD'], ['massachusetts', 'MA'], ['michigan', 'MI'],
  ['minnesota', 'MN'], ['mississippi', 'MS'], ['missouri', 'MO'],
  ['montana', 'MT'], ['nebraska', 'NE'], ['nevada', 'NV'],
  ['new hampshire', 'NH'], ['new jersey', 'NJ'], ['new mexico', 'NM'],
  ['new york', 'NY'], ['north carolina', 'NC'], ['north dakota', 'ND'],
  ['ohio', 'OH'], ['oklahoma', 'OK'], ['oregon', 'OR'],
  ['pennsylvania', 'PA'], ['rhode island', 'RI'], ['south carolina', 'SC'],
  ['south dakota', 'SD'], ['tennessee', 'TN'], ['texas', 'TX'], ['utah', 'UT'],
  ['vermont', 'VT'], ['virginia', 'VA'], ['washington', 'WA'],
  ['west virginia', 'WV'], ['wisconsin', 'WI'], ['wyoming', 'WY'],
  ['district of columbia', 'DC'],
]);

// True iff `nameCandidate` is a US state full-name AND `abbrCandidate`
// (digits stripped, uppercased) matches that state's two-letter code.
// This is the first gate for treating a 4+-part input as verbose-state.
// The digit-strip handles inputs where the abbreviation segment got
// glued to a ZIP fragment ("FL 32092") — same normalization used
// downstream when building cityState.
function isVerboseStatePair(nameCandidate, abbrCandidate) {
  const name = String(nameCandidate || '').trim().toLowerCase();
  const abbr = String(abbrCandidate || '').replace(/\d+/g, '').trim().toUpperCase();
  return STATE_NAME_TO_ABBR.get(name) === abbr;
}

// Cities named after states are a documented failure mode of the
// verbose-state detector. "New York, NY" passes isVerboseStatePair just
// as well as "Florida, FL" does — both are state-name+abbr matches —
// so we need a second signal to disambiguate. The signal: what does
// parts[length-4] look like? In genuine verbose-state input the slot
// holds a city name ("Saint Augustine", "Austin", "Boise"). When the
// state-name slot is actually a state-named city, parts[length-4] is
// a street/unit prefix ("123 Main St", "Apartment 5", "Unit 4B", "Box 1").
// Heuristic: if parts[length-4] contains digits OR begins with a common
// unit/suite/box/apartment keyword, treat it as address debris — meaning
// parts[length-3] is the real city and the verbose-state branch should
// NOT fire. Otherwise it's a genuine city name and the verbose-state
// branch SHOULD fire.
//
// Keywords list matches USPS Publication 28 secondary-unit designators
// plus common informal spellings ("apartment", "building"). Match is
// case-insensitive against the first whitespace-delimited token to avoid
// false positives on legit city names that happen to contain a keyword
// as a substring.
const ADDRESS_DEBRIS_KEYWORDS = new Set([
  'apt', 'apartment', 'unit', 'suite', 'ste', 'box', 'lot', 'space',
  'spc', 'floor', 'fl', 'rm', 'room', 'bldg', 'building', 'po',
  'trlr', 'trailer', '#',
]);

function looksLikeAddressDebris(segment) {
  const s = String(segment || '').trim();
  if (!s) return false;
  if (/\d/.test(s)) return true;
  const firstToken = s.split(/\s+/)[0].toLowerCase().replace(/[.#]+$/, '');
  return ADDRESS_DEBRIS_KEYWORDS.has(firstToken);
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
      //
      // Pair check (PR #385 review fix, gate 1): require state-name AND
      // abbreviation to match the same state. Without this, addresses
      // where the city shares a state's name
      // ("123 Main St, Washington, MO, 63090") wrongly skipped to
      // parts[length-4] ("123 Main St") because Washington is a US
      // state name. Requiring MO to actually match Washington's abbr
      // (WA — it doesn't) keeps the city correctly.
      //
      // Address-debris check (gate 2): for state-named cities whose
      // abbreviation DOES match ("New York, NY", "Indiana, IN"), the
      // pair check alone isn't enough. We additionally require
      // parts[length-4] to look like a real city name (no digits, no
      // unit keyword) — i.e. genuine verbose-state input has a city in
      // that slot. When parts[length-4] is street/unit debris ("Suite
      // 100", "Apartment 5"), the input is an ADDRESS for a
      // state-named city, not verbose-state, so keep cityIdx at
      // length-3.
      if (
        parts.length >= 4 &&
        isVerboseStatePair(parts[cityIdx], parts[stateSrcIdx]) &&
        !looksLikeAddressDebris(parts[parts.length - 4])
      ) {
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
