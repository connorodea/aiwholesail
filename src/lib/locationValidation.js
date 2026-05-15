// Pure location-validation helpers shared between the search form
// (PropertySearch.tsx) and the search container (RealEstateWholesaler.tsx).
//
// Both call sites need to apply the same rejection rules pre-search so
// rejected inputs (e.g. "Oakland County" without a state) never land in
// the recent-searches history. Keeping the logic side-effect-free in a
// .js module makes it node:test-friendly without a transpiler — matches
// the pure-module convention (auth-coherence.js, auction-detection.js,
// comps-similarity.js, brand-flags.js, searchHistoryFlag.js).

/** @type {Record<string, string>} */
const US_STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
};
const STATE_ABBREVIATIONS = Object.values(US_STATES);

/**
 * Returns true if the location string is just a US state — either the full
 * state name, the 2-letter abbreviation, or "State, United States" form.
 * The container uses this to widen the per-page fetch ceiling for
 * state-wide searches.
 *
 * @param {string} location
 * @returns {boolean}
 */
export function isStateOnlyLocation(location) {
  const trimmed = location.trim().toLowerCase();
  if (!trimmed) return false;
  if (US_STATES[trimmed]) return true;
  if (trimmed.length === 2 && STATE_ABBREVIATIONS.includes(trimmed.toUpperCase())) return true;
  const parts = trimmed.split(',').map((p) => p.trim());
  if (parts.length === 2 && (parts[1] === 'united states' || parts[1] === 'usa' || parts[1] === 'us')) {
    if (US_STATES[parts[0]]) return true;
  }
  return false;
}

/**
 * Returns true if the location string mentions "county" but doesn't include
 * a US state. The upstream Zillow search needs a state to disambiguate
 * county names (there are 33 "Washington County"s in the US), so these
 * inputs are rejected before they reach the API.
 *
 * @param {string} location
 * @returns {boolean}
 */
export function isCountyWithoutState(location) {
  const trimmed = location.trim().toLowerCase();
  if (!trimmed.includes('county')) return false;

  const parts = trimmed.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    for (let i = 1; i < parts.length; i += 1) {
      const part = parts[i];
      if (part === 'united states' || part === 'usa' || part === 'us') continue;
      if (US_STATES[part] || STATE_ABBREVIATIONS.includes(part.toUpperCase())) {
        return false;
      }
    }
  }
  return true;
}

export { US_STATES, STATE_ABBREVIATIONS };
