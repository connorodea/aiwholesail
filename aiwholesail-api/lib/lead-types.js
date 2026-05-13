/**
 * Off-market lead-type registry — Phase 1 of the PropStream-parity
 * multi-select system.
 *
 * Pure-function CommonJS module (mirrors lib/tier-resolver.js). Holds:
 *   - LEAD_TYPES         — the 12 canonical lead-type definitions.
 *   - applyLeadFilters   — OR-merge: a record passes if ANY selected
 *                          lead's clientFilter matches.
 *   - tagRecordWithLeadTypes — annotates each record with which lead-type
 *                              slugs it matched (drives badge rendering).
 *   - getServerParamsForLeads — picks the upstream source (property vs
 *                               preforeclosure) and any server params to
 *                               merge into the PropData query.
 *
 * The frontend `src/lib/lead-types.ts` re-exports the same predicate
 * objects with a TS surface for React. Predicates must stay identical
 * between the two files — the test runner exercises THIS file, so it's
 * the source of truth.
 *
 * Why "explicit selection required" semantics? PropStream behaves the
 * same way — an empty chip set should NOT silently flood the UI with
 * every absentee in the country. The caller decides when to default.
 */

/**
 * @typedef {Object} PropDataPropertyRecord
 * Mirror of the TS interface in src/lib/propdata-api.ts. Predicates only
 * read these fields; everything else is passed through.
 *
 * @property {Object} [equity]
 * @property {number} [equity.equity_pct]
 * @property {number} [equity.estimated_equity]
 * @property {number} [equity.est_loan_balance]
 * @property {number} [equity.years_held]
 * @property {Object} [flags]
 * @property {boolean} [flags.is_absentee_owner]
 * @property {boolean} [flags.is_vacant_land]
 * @property {Object} [sale]
 * @property {string} [sale.last_sale_date]
 * @property {string|number} [tax_status]
 * @property {string} [doc_type]    // preforeclosure feed only
 */

/**
 * @typedef {Object} LeadType
 * @property {string} slug             URL/storage-safe identifier. Stable.
 * @property {string} label            Human-readable label for chips.
 * @property {string} description      One-line value prop.
 * @property {'free'|'pro'|'elite'} tier  Plan gate.
 * @property {'property'|'preforeclosure'} primarySource  Which upstream feed.
 * @property {Object} serverParams     Merged into the PropData query.
 * @property {(r: PropDataPropertyRecord) => boolean} clientFilter
 * @property {string} badgeColor       Tailwind classes for the result-card badge.
 * @property {string} icon             lucide-react icon name (frontend lookup).
 */

/**
 * Twelve canonical lead types. Order matters only for UI presentation
 * (free → pro → elite, then approximate "highest-converting first").
 *
 * Tradeoff: predicates favor explicit nullish checks (`?? 0`, `?? 99`)
 * over `||` because legitimate zero values matter — e.g. est_loan_balance
 * of literal 0 IS the free-and-clear signal. The defaults below were
 * chosen so a MISSING field never accidentally matches a tight filter
 * ("years_held missing" should not look like a 25-year senior owner).
 *
 * @type {LeadType[]}
 */
const LEAD_TYPES = [
  {
    slug: 'absentee',
    label: 'Absentee Owners',
    description: 'Out-of-state landlords — highest-converting direct-mail segment',
    tier: 'free',
    primarySource: 'property',
    serverParams: { absentee_only: true },
    clientFilter: (r) => r?.flags?.is_absentee_owner === true,
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'Home',
  },
  {
    slug: 'pre-foreclosure',
    label: 'Pre-Foreclosure',
    description: "NOD, Lis Pendens, Notice of Trustee's Sale",
    tier: 'free',
    primarySource: 'preforeclosure',
    serverParams: {},
    // Server-side mode — once the preforeclosure feed is selected, every
    // record returned IS by definition a pre-foreclosure. Passthrough.
    clientFilter: () => true,
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    icon: 'Flame',
  },
  {
    slug: 'auctions',
    label: 'Auctions',
    description: "Trustee & sheriff sales scheduled in the next 90 days",
    tier: 'free',
    primarySource: 'preforeclosure',
    serverParams: {},
    clientFilter: (r) => /trustee|sheriff/i.test(String(r?.doc_type || '')),
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: 'Gavel',
  },
  {
    slug: 'tax-delinquent',
    label: 'Tax Delinquent',
    description: 'Owners behind on property taxes — strong motivation signal',
    tier: 'pro',
    primarySource: 'property',
    serverParams: {},
    clientFilter: (r) => /delinquent|past[\s_]?due/i.test(String(r?.tax_status ?? '')),
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'AlertTriangle',
  },
  {
    slug: 'high-equity',
    label: 'High Equity',
    description: '50%+ equity or $100k+ estimated equity — room to discount',
    tier: 'free',
    primarySource: 'property',
    serverParams: {},
    clientFilter: (r) =>
      (r?.equity?.equity_pct ?? 0) >= 50 ||
      (r?.equity?.estimated_equity ?? 0) >= 100000,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'TrendingUp',
  },
  {
    slug: 'free-and-clear',
    label: 'Free & Clear',
    description: 'No mortgage — owners with maximum pricing flexibility',
    tier: 'pro',
    primarySource: 'property',
    serverParams: {},
    clientFilter: (r) =>
      r?.equity?.est_loan_balance === 0 || (r?.equity?.equity_pct ?? 0) >= 100,
    badgeColor: 'bg-green-100 text-green-800 border-green-200',
    icon: 'Coins',
  },
  {
    slug: 'upside-down',
    label: 'Upside Down',
    description: 'Negative equity — short-sale and creative-finance candidates',
    tier: 'pro',
    primarySource: 'property',
    serverParams: {},
    // Default to 1 (positive) so a missing equity_pct is NOT treated as
    // upside-down. Without this guard, every record lacking equity data
    // would falsely match.
    clientFilter: (r) => (r?.equity?.equity_pct ?? 1) < 0,
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'TrendingDown',
  },
  {
    slug: 'tired-landlord',
    label: 'Tired Landlords',
    description: 'Absentee owners holding 15+ years — burned out, ready to sell',
    tier: 'pro',
    primarySource: 'property',
    serverParams: { absentee_only: true },
    clientFilter: (r) =>
      r?.flags?.is_absentee_owner === true && (r?.equity?.years_held ?? 0) >= 15,
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: 'RefreshCw',
  },
  {
    slug: 'senior-owner',
    label: 'Senior Owners',
    description: 'Long-tenured owners (25+ years) — downsizing and estate sales',
    tier: 'pro',
    primarySource: 'property',
    serverParams: {},
    clientFilter: (r) => (r?.equity?.years_held ?? 0) >= 25,
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'CalendarClock',
  },
  {
    slug: 'cash-buyer',
    label: 'Cash Buyers',
    description: 'Absentee, free-and-clear, recent purchase — investor profile',
    tier: 'elite',
    primarySource: 'property',
    serverParams: { absentee_only: true },
    clientFilter: (r) =>
      r?.flags?.is_absentee_owner === true &&
      r?.equity?.est_loan_balance === 0 &&
      !!r?.sale?.last_sale_date,
    badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: 'Crown',
  },
  {
    slug: 'vacant-land',
    label: 'Vacant Land',
    description: 'Unimproved parcels — low-competition, high-margin deals',
    tier: 'free',
    primarySource: 'property',
    serverParams: {},
    clientFilter: (r) => r?.flags?.is_vacant_land === true,
    badgeColor: 'bg-lime-100 text-lime-800 border-lime-200',
    icon: 'Trees',
  },
  {
    slug: 'flippers',
    label: 'Flippers',
    description: 'Recent buys (<2yr) — proxy for investor flips (MLS join in Phase 2e)',
    tier: 'elite',
    primarySource: 'property',
    serverParams: {},
    // Default to 99 so missing years_held does NOT match. The "ideal"
    // signal needs an MLS-listing join (active resale within months of
    // purchase) — that's Phase 2e. Until then the years_held<2 proxy is
    // good enough to find sub-2yr re-buyers.
    clientFilter: (r) => (r?.equity?.years_held ?? 99) < 2,
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: 'Banknote',
  },
];

const LEAD_TYPE_BY_SLUG = new Map(LEAD_TYPES.map((lt) => [lt.slug, lt]));

/**
 * OR-merge multiple lead-type filters across a record set.
 *
 * Returns ONLY records matching at least one selected lead type. Empty
 * selection returns an empty array (NOT the full input) — explicit
 * selection required. Mirrors PropStream behavior.
 *
 * @param {PropDataPropertyRecord[]} records
 * @param {string[]} selectedSlugs
 * @returns {PropDataPropertyRecord[]}
 */
function applyLeadFilters(records, selectedSlugs) {
  if (!Array.isArray(records) || !Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
    return [];
  }
  const filters = selectedSlugs
    .map((slug) => LEAD_TYPE_BY_SLUG.get(slug))
    .filter(Boolean)
    .map((lt) => lt.clientFilter);
  if (filters.length === 0) return [];
  return records.filter((r) => filters.some((fn) => {
    try { return fn(r); } catch { return false; }
  }));
}

/**
 * Annotate each record with the list of lead-type slugs it matched.
 * Used by result cards to render multi-badge rows.
 *
 * @param {PropDataPropertyRecord[]} records
 * @returns {Array<PropDataPropertyRecord & { matchedLeadTypes: string[] }>}
 */
function tagRecordWithLeadTypes(records) {
  if (!Array.isArray(records)) return [];
  return records.map((r) => {
    const matched = [];
    for (const lt of LEAD_TYPES) {
      // Skip pre-foreclosure passthrough during tagging — it would
      // false-positive every record in a property-source set. Auctions
      // and pre-foreclosure tagging is only meaningful on records that
      // came back from the preforeclosure feed (which carry doc_type).
      if (lt.slug === 'pre-foreclosure') continue;
      try {
        if (lt.clientFilter(r)) matched.push(lt.slug);
      } catch {
        // Tolerate malformed records — skip the predicate, keep going.
      }
    }
    return { ...r, matchedLeadTypes: matched };
  });
}

/**
 * Resolve the upstream feed + any server-side params for a chip selection.
 *
 * Source resolution: property and preforeclosure are mutually exclusive
 * upstream feeds. If ANY selected lead type uses preforeclosure (pre-
 * foreclosure, auctions), the whole query goes against that feed —
 * property-source filters are then no-ops for that fetch. Callers
 * needing both sources in one UI must issue two parallel fetches.
 *
 * @param {string[]} selectedSlugs
 * @returns {{ absentee_only?: boolean, primarySource: 'property'|'preforeclosure' }}
 */
function getServerParamsForLeads(selectedSlugs) {
  if (!Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
    return { primarySource: 'property' };
  }
  const selected = selectedSlugs
    .map((slug) => LEAD_TYPE_BY_SLUG.get(slug))
    .filter(Boolean);

  const usePreforeclosure = selected.some((lt) => lt.primarySource === 'preforeclosure');
  const primarySource = usePreforeclosure ? 'preforeclosure' : 'property';

  const merged = { primarySource };
  // Only merge property-source server params when we're hitting the
  // property feed. The preforeclosure feed ignores absentee_only.
  if (!usePreforeclosure) {
    for (const lt of selected) {
      if (lt.serverParams && typeof lt.serverParams === 'object') {
        Object.assign(merged, lt.serverParams);
      }
    }
  }
  return merged;
}

module.exports = {
  LEAD_TYPES,
  LEAD_TYPE_BY_SLUG,
  applyLeadFilters,
  tagRecordWithLeadTypes,
  getServerParamsForLeads,
};
