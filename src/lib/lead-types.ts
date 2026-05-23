/**
 * Off-market lead-type registry — frontend surface.
 *
 * The CANONICAL implementation lives in
 *   aiwholesail-api/lib/lead-types.js
 * (pure CommonJS, exercised by node:test). This TS file is a verbatim
 * mirror with React/lucide-friendly typing.
 *
 * If you edit a predicate here, edit it in the .js file too — or the
 * frontend filter result will drift from server-side analytics that
 * import the CommonJS module. The lead-types.test.js suite is the gate.
 *
 * No React imports in this file — it's a pure module so it stays cheap
 * to import from headless contexts (workers, tests, server-side
 * rendering). Hooks belong in the consumer component.
 */

import type { PropDataPropertyRecord } from '@/lib/propdata-api';

export type LeadTypeTier = 'free' | 'pro' | 'elite';
export type LeadTypePrimarySource = 'property' | 'preforeclosure';

/**
 * Server-side params merged into the PropData query. Currently the
 * only field PropData accepts at this layer is `absentee_only`, but
 * the shape is open so Phase 2 can add (e.g.) min_equity, owner_state
 * without re-typing every chip.
 */
export interface LeadTypeServerParams {
  absentee_only?: boolean;
  [key: string]: unknown;
}

export interface LeadType {
  slug: string;
  label: string;
  description: string;
  tier: LeadTypeTier;
  primarySource: LeadTypePrimarySource;
  serverParams: LeadTypeServerParams;
  clientFilter: (r: PropDataPropertyRecord) => boolean;
  badgeColor: string;
  /** lucide-react icon name; the component resolves it dynamically. */
  icon: string;
}

/**
 * Twelve canonical lead types. KEEP IN SYNC with
 * aiwholesail-api/lib/lead-types.js — the test runner exercises that
 * file, not this one.
 */
export const LEAD_TYPES: LeadType[] = [
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
    clientFilter: () => true,
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    icon: 'Flame',
  },
  {
    slug: 'auctions',
    label: 'Auctions',
    description: 'Trustee & sheriff sales scheduled in the next 90 days',
    tier: 'free',
    primarySource: 'preforeclosure',
    serverParams: {},
    clientFilter: (r) => /trustee|sheriff/i.test(String((r as any)?.doc_type ?? '')),
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
    clientFilter: (r) => (r?.equity?.years_held ?? 99) < 2,
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: 'Banknote',
  },
];

const LEAD_TYPE_BY_SLUG = new Map<string, LeadType>(LEAD_TYPES.map((lt) => [lt.slug, lt]));

export function getLeadTypeBySlug(slug: string): LeadType | undefined {
  return LEAD_TYPE_BY_SLUG.get(slug);
}

/**
 * OR-merge across selected lead-type predicates. Empty selection returns
 * an empty array (NOT the full input — PropStream-style explicit
 * selection). Predicates that throw on malformed records are coerced
 * to false so one bad record can't kill the whole list.
 */
export function applyLeadFilters(
  records: PropDataPropertyRecord[],
  selectedSlugs: string[]
): PropDataPropertyRecord[] {
  if (!Array.isArray(records) || !Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
    return [];
  }
  const filters = selectedSlugs
    .map((slug) => LEAD_TYPE_BY_SLUG.get(slug))
    .filter((lt): lt is LeadType => Boolean(lt))
    .map((lt) => lt.clientFilter);
  if (filters.length === 0) return [];
  return records.filter((r) =>
    filters.some((fn) => {
      try {
        return fn(r);
      } catch {
        return false;
      }
    })
  );
}

/**
 * Returns the same records annotated with `matchedLeadTypes: string[]`
 * — every slug whose predicate matched. Drives multi-badge rendering on
 * result cards.
 *
 * Pre-foreclosure is skipped during tagging because its predicate is a
 * passthrough — tagging it would mark every record in a property-source
 * set as pre-foreclosure, which is wrong.
 */
export function tagRecordWithLeadTypes(
  records: PropDataPropertyRecord[]
): Array<PropDataPropertyRecord & { matchedLeadTypes: string[] }> {
  if (!Array.isArray(records)) return [];
  return records.map((r) => {
    const matched: string[] = [];
    for (const lt of LEAD_TYPES) {
      if (lt.slug === 'pre-foreclosure') continue;
      try {
        if (lt.clientFilter(r)) matched.push(lt.slug);
      } catch {
        // tolerate malformed records
      }
    }
    return { ...r, matchedLeadTypes: matched };
  });
}

/**
 * Resolve the upstream feed + server-side params for a chip selection.
 *
 * property and preforeclosure are mutually exclusive upstream feeds.
 * If ANY selected lead uses preforeclosure (pre-foreclosure, auctions)
 * the whole query goes against that feed and property-side server
 * params are dropped (the preforeclosure feed ignores absentee_only).
 */
export function getServerParamsForLeads(
  selectedSlugs: string[]
): { absentee_only?: boolean; primarySource: LeadTypePrimarySource } {
  if (!Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
    return { primarySource: 'property' };
  }
  const selected = selectedSlugs
    .map((slug) => LEAD_TYPE_BY_SLUG.get(slug))
    .filter((lt): lt is LeadType => Boolean(lt));

  const usePreforeclosure = selected.some((lt) => lt.primarySource === 'preforeclosure');
  const primarySource: LeadTypePrimarySource = usePreforeclosure ? 'preforeclosure' : 'property';

  const merged: { absentee_only?: boolean; primarySource: LeadTypePrimarySource } = {
    primarySource,
  };
  if (!usePreforeclosure) {
    for (const lt of selected) {
      if (lt.serverParams && typeof lt.serverParams === 'object') {
        Object.assign(merged, lt.serverParams);
      }
    }
  }
  return merged;
}

export interface LeadSearchPlan {
  /** Property-feed params, or null if no selected lead uses the property feed. */
  property: LeadTypeServerParams | null;
  /** Preforeclosure-feed params, or null if no selected lead uses that feed. */
  preforeclosure: Record<string, unknown> | null;
}

/**
 * Dual-feed planner that replaces `getServerParamsForLeads` for the
 * off-market search component. The old single-feed planner collapsed
 * mixed selections (e.g. Absentee + Pre-Foreclosure) to preforeclosure-
 * only and silently dropped the property-feed leads — that broke
 * off-market entirely whenever any preforeclosure-source lead was
 * selected alongside the rest. See lead-types.test.js for the
 * regression coverage.
 */
export function getSearchPlanForLeads(selectedSlugs: string[]): LeadSearchPlan {
  if (!Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
    return { property: {}, preforeclosure: null };
  }
  const selected = selectedSlugs
    .map((slug) => LEAD_TYPE_BY_SLUG.get(slug))
    .filter((lt): lt is LeadType => Boolean(lt));

  const propertyLeads = selected.filter((lt) => lt.primarySource === 'property');
  const preforeclosureLeads = selected.filter((lt) => lt.primarySource === 'preforeclosure');

  let property: LeadTypeServerParams | null = null;
  if (propertyLeads.length > 0) {
    property = {};
    for (const lt of propertyLeads) {
      if (lt.serverParams && typeof lt.serverParams === 'object') {
        Object.assign(property, lt.serverParams);
      }
    }
  }
  const preforeclosure = preforeclosureLeads.length > 0 ? {} : null;

  return { property, preforeclosure };
}
