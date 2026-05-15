import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { LeadTypeChips } from '@/components/LeadTypeChips';
import {
  LEAD_TYPES,
  applyLeadFilters,
  getSearchPlanForLeads,
  tagRecordWithLeadTypes,
} from '@/lib/lead-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { propDataAPI, PropDataError, type PropDataPropertyListResponse, type PropDataPropertyRecord } from '@/lib/propdata-api';
import { batchdata, type BatchPropertyRecord } from '@/lib/batchdata-api';
import { mapPropDataListToUnified, type PropDataEnrichment } from '@/lib/unifiedPropertyAdapters';
import { resolveLocation } from '@/lib/locationResolver';
import { topZipsInState } from '@/lib/topZipsByState';
import { fanOutZipSearch, MAX_ZIPS_PER_SEARCH } from '@/lib/zip-search';
import { OwnerSkipTraceButton } from '@/components/OwnerSkipTraceButton';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { SearchHistory } from '@/components/SearchHistory';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { buildOffMarketHistoryLabel } from '@/lib/searchHistoryLabels';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useSubscription } from '@/hooks/useSubscription';
import { OwnerDetailModal } from '@/components/OwnerDetailModal';
import { OffMarketPropertyModal } from '@/components/OffMarketPropertyModal';
import { skipTrace } from '@/lib/api-client';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, User, Mail, Building, RefreshCw, Download, Flame, ShieldCheck, Sparkles,
  TrendingUp, AlertTriangle, CalendarClock, X, CheckSquare, Lock,
  Home, Gavel, Coins, TrendingDown, Crown, Trees, Banknote, type LucideIcon,
} from 'lucide-react';

/**
 * Local icon map for the matched-lead-type badges on result cards.
 * Mirrors the chip-side ICON_MAP in LeadTypeChips.tsx but covers ALL 12
 * LEAD_TYPES icons — keeps tree-shaking friendly (explicit imports) and
 * avoids cross-imports. Unknown keys fall back to Home.
 */
const LEAD_TYPE_CARD_ICON_MAP: Record<string, LucideIcon> = {
  Home, Flame, Gavel, AlertTriangle, TrendingUp, Coins, TrendingDown,
  RefreshCw, CalendarClock, Crown, Trees, Banknote,
};

/**
 * sessionStorage key for handing off off-market UnifiedProperty[] records
 * from this component to the AI Deal Analyzer on /app/analyzer. The
 * analyzer reads + clears this key on mount.
 */
export const OFFMARKET_ANALYZER_HANDOFF_KEY = 'aiw_offmarket_for_analyzer';
export const OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY = 'aiw_offmarket_for_analyzer_zip';

/**
 * Absentee Owner Search
 *
 * The killer wholesaler feature: paste a ZIP, get a ranked list of properties
 * where the owner's mailing address is different from the property address —
 * i.e. landlords who own out-of-state, the highest-converting outreach segment
 * for direct mail.
 *
 * Powered by /v1/property?absentee_only=true under the new authenticated
 * backend proxy. Equity %, opportunity zone, and flood flags surface as
 * badges. Export to CSV for direct-mail tools.
 */

interface AbsenteeOwnerSearchProps {
  defaultZip?: string;
}

type EquityFilter = 'any' | 'gte_40' | 'gte_60' | 'gte_80';

const LIMIT_OPTIONS = [25, 50, 100];

const fmtCurrency = (val?: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
    : '—';

const fmtPct = (val?: number | null) => (val != null ? `${Math.round(val)}%` : '—');

function equityThreshold(filter: EquityFilter): number {
  if (filter === 'gte_40') return 40;
  if (filter === 'gte_60') return 60;
  if (filter === 'gte_80') return 80;
  return 0;
}

function joinAddr(rec: PropDataPropertyRecord): string {
  const a = rec.address;
  if (!a) return rec.parcel_id || 'Unknown';
  return [a.street, a.city, a.zip].filter(Boolean).join(', ');
}

function mailingAddr(rec: PropDataPropertyRecord): string {
  const o = rec.owner;
  if (!o) return '';
  return [o.mailing_address, o.mailing_city, o.mailing_state, o.mailing_zip].filter(Boolean).join(', ');
}

/** RFC 4180 CSV row encoder — quote when comma/quote/newline; double internal quotes. */
function csvRow(cols: (string | number | null | undefined)[]): string {
  return cols
    .map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

function toCsv(records: PropDataPropertyRecord[]): string {
  const header = [
    'owner_name', 'property_address', 'property_city', 'property_zip',
    'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
    'market_value', 'last_sale_price', 'last_sale_date',
    'estimated_equity', 'equity_pct', 'years_held',
    'is_absentee', 'parcel_id', 'county',
  ];
  const rows = records.map((r) => [
    r.owner?.name || '',
    r.address?.street || '',
    r.address?.city || '',
    r.address?.zip || '',
    r.owner?.mailing_address || '',
    r.owner?.mailing_city || '',
    r.owner?.mailing_state || '',
    r.owner?.mailing_zip || '',
    r.valuation?.market_value ?? '',
    r.sale?.last_sale_price ?? '',
    r.sale?.last_sale_date || '',
    r.equity?.estimated_equity ?? '',
    r.equity?.equity_pct ?? '',
    r.equity?.years_held ?? '',
    r.flags?.is_absentee_owner ? 'true' : 'false',
    r.parcel_id || '',
    r.county_name || '',
  ]);
  return [header, ...rows].map(csvRow).join('\n');
}

/**
 * Mailing-labels CSV export — Phase 4 of the off-market roadmap.
 *
 * Emits a column shape matching the most common direct-mail tool
 * conventions (Yellow Letter HQ, Click2Mail, Lob). One row per
 * deliverable mailing record:
 *
 *   recipient_name        — owner name (mail-merge "Hi {name},...")
 *   recipient_address     — owner's mailing street
 *   recipient_city        — owner's mailing city
 *   recipient_state       — owner's mailing state
 *   recipient_zip         — owner's mailing zip
 *   property_address      — the off-market property (merge field
 *                           for "your property at {addr}")
 *   property_city
 *   property_state
 *   property_zip
 *   estimated_equity      — for value-anchor merge fields
 *   equity_pct
 *
 * Rows with no recipient_name or recipient_address are SKIPPED at
 * the source — direct-mail tools reject unaddressable rows anyway
 * and counting them in the export wastes downstream credits.
 *
 * Returns { csv, included, skipped } so the caller can show a
 * "Exported X of Y records (Z skipped — no mailing address)" toast.
 */
function toMailingLabelsCsv(records: PropDataPropertyRecord[]): {
  csv: string;
  included: number;
  skipped: number;
} {
  const header = [
    'recipient_name', 'recipient_address', 'recipient_city',
    'recipient_state', 'recipient_zip',
    'property_address', 'property_city', 'property_state', 'property_zip',
    'estimated_equity', 'equity_pct',
  ];
  let skipped = 0;
  const rows: (string | number | null | undefined)[][] = [];
  for (const r of records) {
    const name = (r.owner?.name || '').trim();
    const mailingStreet = (r.owner?.mailing_address || '').trim();
    if (!name || !mailingStreet) {
      skipped += 1;
      continue;
    }
    rows.push([
      name,
      mailingStreet,
      r.owner?.mailing_city || '',
      r.owner?.mailing_state || '',
      r.owner?.mailing_zip || '',
      r.address?.street || '',
      r.address?.city || '',
      r.state || '',
      r.address?.zip || '',
      r.equity?.estimated_equity ?? '',
      r.equity?.equity_pct != null ? Math.round(r.equity.equity_pct) : '',
    ]);
  }
  const csv = [header, ...rows].map(csvRow).join('\n');
  return { csv, included: rows.length, skipped };
}

/**
 * Map a BatchData property record into our PropData-shaped record. This is
 * the adapter layer that lets us swap providers behind the
 * `batchdata_offmarket` flag without touching the rest of the search loop.
 * Only the fields actually consumed downstream (address, owner, valuation,
 * equity, flags) are mapped; extras pass through under their BatchData
 * names for any forward-compat needs.
 */
function mapBatchToPropData(b: BatchPropertyRecord): PropDataPropertyRecord {
  const ql = b.quickLists || {};
  return {
    parcel_id: b.parcelId,
    address: {
      street: b.address?.street,
      city: b.address?.city,
      zip: b.address?.zip,
    },
    state: b.address?.state,
    owner: {
      name: b.owner?.fullName ?? [b.owner?.firstName, b.owner?.lastName].filter(Boolean).join(' '),
      mailing_address: b.owner?.mailingAddress?.street,
      mailing_city: b.owner?.mailingAddress?.city,
      mailing_state: b.owner?.mailingAddress?.state,
      mailing_zip: b.owner?.mailingAddress?.zip,
    },
    valuation: {
      market_value: b.valuation?.estimatedValue,
    },
    sale: {
      last_sale_date: b.valuation?.lastSaleDate,
      last_sale_price: b.valuation?.lastSalePrice,
    },
    characteristics: {
      bedrooms: b.characteristics?.bedrooms ?? null,
      bathrooms: b.characteristics?.bathrooms ?? null,
      sq_ft_living: b.characteristics?.squareFeet ?? null,
      sq_ft_lot: b.characteristics?.lotSize ?? null,
      year_built: b.characteristics?.yearBuilt,
      property_type: b.characteristics?.propertyType,
    },
    equity: b.valuation?.estimatedEquity != null
      ? {
          estimated_equity: b.valuation.estimatedEquity,
          equity_pct: b.valuation?.ltv != null ? Math.max(0, 100 - b.valuation.ltv) : undefined,
        }
      : undefined,
    flags: {
      is_absentee_owner: ql.absenteeOwner ?? b.owner?.isAbsenteeOwner,
      has_owner_data: !!b.owner?.fullName || !!b.owner?.firstName,
      has_phone: false, // BatchData doesn't return phones on /property/search — skip-trace required
    },
    source: 'batchdata',
    // Forward-compat: keep the raw BatchData record under a namespaced field
    // so lead-type-specific UI can read foreclosure/auction details etc.
    batchdata_raw: b,
  };
}

/**
 * Adapter for the property-list call site. Picks BatchData or PropData
 * based on the `batchdata_offmarket` flag and returns the PropData shape
 * so the downstream search loop doesn't have to branch.
 */
async function listPropertiesUnified(
  useBatch: boolean,
  zip: string,
  limit: number,
  absenteeOnly: boolean | undefined,
): Promise<PropDataPropertyListResponse> {
  if (useBatch) {
    const res = absenteeOnly
      ? await batchdata.listAbsenteeOwners({ zip, take: limit })
      : await batchdata.search({
          searchCriteria: { zip },
          options: { take: limit },
        });
    if (res.error) return { error: res.error };
    const props = res.data?.results?.properties ?? res.data?.properties ?? [];
    return { properties: props.map(mapBatchToPropData), count: props.length };
  }
  return propDataAPI.listProperties({ zip, limit, absentee_only: absenteeOnly });
}

async function listPreforeclosuresUnified(
  useBatch: boolean,
  zip: string,
  limit: number,
): Promise<PropDataPropertyListResponse> {
  if (useBatch) {
    const res = await batchdata.listPreforeclosures({ zip, take: limit });
    if (res.error) return { error: res.error };
    const props = res.data?.results?.properties ?? res.data?.properties ?? [];
    return { properties: props.map(mapBatchToPropData), count: props.length };
  }
  return propDataAPI.listPreforeclosures({ zip, limit });
}

export function AbsenteeOwnerSearch({ defaultZip = '' }: AbsenteeOwnerSearchProps) {
  // Free-form input: single ZIP, multi-ZIP list, "City, ST", "County, ST", or "ST".
  // Resolved into a deduped ZIP fan-out list at search time.
  const [locationInput, setLocationInput] = useState(defaultZip);
  const [limit, setLimit] = useState<number>(25);
  const [equityFilter, setEquityFilter] = useState<EquityFilter>('any');
  // Motivation filters (client-side, applied to whatever the server returns).
  // - taxDelinquentOnly: tax_status === 'delinquent' — strongest "must sell" signal
  // - minYearsHeld: 0 / 5 / 10 / 20 — proxy for "tired landlord"
  // - excludeRecentSales: skip parcels sold in the last 12 months (not real motivation)
  const [taxDelinquentOnly, setTaxDelinquentOnly] = useState(false);
  const [minYearsHeld, setMinYearsHeld] = useState<0 | 5 | 10 | 20>(0);
  const [excludeRecentSales, setExcludeRecentSales] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [data, setData] = useState<PropDataPropertyListResponse | null>(null);
  // The resolved label (e.g. "Detroit, MI (12 ZIPs)") shown above results.
  const [resolvedLabel, setResolvedLabel] = useState<string>('');
  // Sticky for handoff to the analyzer + CSV filename.
  const [searchedZips, setSearchedZips] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  // Phase 2 of the off-market roadmap — flag-gated owner portfolio modal.
  // Default OFF, dogfood for cpodea5 via feature_flag_users override.
  const { enabled: ownerDetailEnabled } = useFeatureFlag('off-market-owner-detail');
  const [openOwner, setOpenOwner] = useState<PropDataPropertyRecord | null>(null);
  // Phase 6 — off-market property detail modal. PropData-shaped, no Zillow surface.
  const { enabled: propertyModalEnabled } = useFeatureFlag('off-market-property-modal');
  const [openProperty, setOpenProperty] = useState<PropDataPropertyRecord | null>(null);
  // Phase 3 — bulk skip-trace. Flag-gated and tier-gated (Pro/Elite).
  // When enabled, each result card gets a checkbox; selected records can be
  // bulk-skip-traced in parallel (concurrency 4) from a floating toolbar.
  const { enabled: bulkSkipTraceEnabled } = useFeatureFlag('off-market-bulk-skiptrace');
  const { isPro, isElite } = useSubscription();
  const canBulkSkipTrace = isPro || isElite;
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  // Phase 7 — off-market heatmap. Flag-gated. The Leaflet bundle is loaded
  // lazily so users without the flag never download ~80KB of map code.
  const { enabled: heatmapEnabled } = useFeatureFlag('off-market-heatmap');
  const [view, setView] = useState<'list' | 'map'>('list');
  // Phase 1 — off-market lead-type chips. Flag-gated; when on, the user picks
  // one or more PropStream-parity lead types (absentee, pre-foreclosure, tax-
  // delinquent, high-equity, free-and-clear, etc.) and the search routes to
  // the right PropData endpoint + applies client-side predicates. Default
  // selection is ['absentee'] for backward compat — same results as the
  // pre-v2 behaviour.
  const { enabled: leadTypesV2Enabled } = useFeatureFlag('off-market-search-v2');
  // BatchData vendor swap. When ON, off-market lookups route through
  // /api/batchdata/* (purpose-built off-market vendor with working absentee
  // quicklists). When OFF, /api/propdata/* (which has broken absentee
  // filter as of 2026-05-14 live testing).
  const { enabled: batchDataEnabled } = useFeatureFlag('batchdata_offmarket');
  const [selectedLeadTypes, setSelectedLeadTypes] = useState<Set<string>>(
    new Set(['absentee'])
  );
  const userTier: 'free' | 'pro' | 'elite' = isElite ? 'elite' : isPro ? 'pro' : 'free';
  const HeatmapLazy = useMemo(
    () => lazy(() => import('@/components/OffMarketHeatmap').then(m => ({ default: m.OffMarketHeatmap }))),
    []
  );

  const filtered = useMemo(() => {
    const props = data?.properties || [];
    const threshold = equityThreshold(equityFilter);
    const recentCutoff = excludeRecentSales
      ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      : null;
    return props.filter((p) => {
      if (threshold > 0 && (p.equity?.equity_pct ?? 0) < threshold) return false;
      if (taxDelinquentOnly) {
        const status = String(p.tax_status || '').toLowerCase();
        if (!status.includes('delinquent') && !status.includes('past_due') && !status.includes('past due')) return false;
      }
      if (minYearsHeld > 0 && (p.equity?.years_held ?? 0) < minYearsHeld) return false;
      if (recentCutoff && p.sale?.last_sale_date) {
        const sold = new Date(p.sale.last_sale_date);
        if (isFinite(sold.getTime()) && sold > recentCutoff) return false;
      }
      return true;
    });
  }, [data, equityFilter, taxDelinquentOnly, minYearsHeld, excludeRecentSales]);

  const activeFilterCount =
    (equityFilter !== 'any' ? 1 : 0) +
    (taxDelinquentOnly ? 1 : 0) +
    (minYearsHeld > 0 ? 1 : 0) +
    (excludeRecentSales ? 1 : 0);

  const clearFilters = () => {
    setEquityFilter('any');
    setTaxDelinquentOnly(false);
    setMinYearsHeld(0);
    setExcludeRecentSales(false);
  };

  const enrichment = data?.enrichment;

  // Recent-searches memory — last 4 off-market searches, stored in localStorage.
  interface OffMarketHistoryParams {
    locationInput: string;
    limit: number;
    equityFilter: EquityFilter;
    taxDelinquentOnly: boolean;
    minYearsHeld: 0 | 5 | 10 | 20;
    excludeRecentSales: boolean;
    selectedLeadTypes: string[];
  }
  const {
    history: searchHistory,
    recordSearch: recordSearchHistory,
    removeSearch: removeSearchFromHistory,
    clear: clearSearchHistory,
  } = useSearchHistory<OffMarketHistoryParams>({
    mode: 'off-market',
    buildLabel: buildOffMarketHistoryLabel,
  });

  // Trigger handleSearch on the next render after a history entry restores
  // form state. Using a counter ref keeps the deps array clean — only
  // increments mean replay.
  const replayTokenRef = useRef(0);
  const [replayToken, setReplayToken] = useState(0);
  useEffect(() => {
    if (replayToken === 0) return;
    if (replayToken === replayTokenRef.current) return;
    replayTokenRef.current = replayToken;
    void handleSearch();
    // handleSearch reads from current state, which has been freshly set by
    // handleApplyHistory; intentionally only depends on replayToken.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayToken]);

  const handleApplyHistory = (params: OffMarketHistoryParams) => {
    setLocationInput(params.locationInput);
    setLimit(params.limit);
    setEquityFilter(params.equityFilter);
    setTaxDelinquentOnly(params.taxDelinquentOnly);
    setMinYearsHeld(params.minYearsHeld);
    setExcludeRecentSales(params.excludeRecentSales);
    setSelectedLeadTypes(new Set(params.selectedLeadTypes));
    // handleSearch (fired via the replayToken effect) will record the
    // promoted entry — calling recordSearchHistory here would double-record.
    setReplayToken((t) => t + 1);
  };

  const handleSearch = async () => {
    const input = locationInput.trim();
    if (!input) {
      toast({ title: 'Enter a location', description: 'ZIP, "City, ST", "County, ST", or just "ST".', variant: 'destructive' });
      return;
    }
    recordSearchHistory({
      locationInput: input,
      limit,
      equityFilter,
      taxDelinquentOnly,
      minYearsHeld,
      excludeRecentSales,
      selectedLeadTypes: [...selectedLeadTypes],
    });
    setLoading(true);
    setProgress(null);
    try {
      const resolved = await resolveLocation(input, { topZipsInState });
      if (!resolved || resolved.zips.length === 0) {
        toast({ title: 'Could not resolve location', description: `"${input}" — try a 5-digit ZIP or "City, ST".`, variant: 'destructive' });
        setData({ properties: [], count: 0 });
        setResolvedLabel('');
        setSearchedZips([]);
        return;
      }
      setSearchedZips(resolved.zips);
      setResolvedLabel(resolved.label);

      // Per-ZIP call cap so a state-wide fan-out doesn't return thousands.
      // For single-zip, honor the full user-selected limit. For fan-outs,
      // divide by ZIP count, floor at 5/ZIP so each ZIP still gets meaningful
      // coverage but the aggregate stays sane.
      const perZipLimit = resolved.zips.length === 1
        ? limit
        : Math.max(5, Math.ceil(limit / Math.max(1, resolved.zips.length)));

      setProgress({ done: 0, total: resolved.zips.length });
      let completed = 0;
      // Track per-ZIP outcomes so we can give the user an actionable failure
      // message instead of a generic "coverage may be thin" toast.
      // Classify each ZIP's outcome by PropDataError.code (PR #236).
      // Pre-#236 this was string-matching err.message, which was brittle
      // — message wording drift would silently break the classification
      // and we'd lose visibility into why searches were failing.
      const outcomes = { ok: 0, noCoverage: 0, rateLimited: 0, network: 0, other: 0 };
      // v2: dual-feed planner. When the selection mixes preforeclosure-source
      // leads (pre-foreclosure, auctions) with property-source leads, fan out
      // BOTH feeds per ZIP — the old single-feed planner collapsed to one
      // feed and silently dropped the other half of the selection. v1 keeps
      // the legacy single absentee_only=true call.
      const searchPlan = leadTypesV2Enabled
        ? getSearchPlanForLeads([...selectedLeadTypes])
        : { property: { absentee_only: true } as { absentee_only?: boolean }, preforeclosure: null };

      // Defensive: if neither feed is planned (e.g. all selected slugs are
      // unknown), default to a property-only call so the search isn't a no-op.
      const propertyParams: { absentee_only?: boolean } | null =
        searchPlan.property ?? (searchPlan.preforeclosure ? null : {});
      const preforeclosureRequested = searchPlan.preforeclosure !== null;

      const classify = (err: unknown) => {
        if (err instanceof PropDataError) {
          if (err.code === 'RATE_LIMITED') outcomes.rateLimited += 1;
          else if (err.isCoverageGap) outcomes.noCoverage += 1;
          else if (err.isTransient) outcomes.network += 1;
          else outcomes.other += 1;
        } else {
          outcomes.other += 1;
        }
      };

      const batched = await fanOutZipSearch(resolved.zips, async (z) => {
        // Per-ZIP merge: each ZIP may hit one or two upstream feeds. Coverage
        // gaps on the preforeclosure feed are EXPECTED (most ZIPs have no
        // active pre-foreclosures); don't count those against the user-
        // visible coverage outcome when the property feed succeeded.
        const acc: PropDataPropertyListResponse = { properties: [] };
        let propertyOk = false;
        let preforeclosureOk = false;
        let propertyError: unknown = null;

        if (propertyParams) {
          try {
            const propRes = await listPropertiesUnified(
              batchDataEnabled,
              z,
              perZipLimit,
              propertyParams.absentee_only,
            );
            if ((propRes as { error?: string }).error) {
              propertyError = new PropDataError(
                (propRes as { error?: string }).error || 'no coverage',
                'NO_COVERAGE',
              );
            } else {
              propertyOk = true;
              if (propRes.properties) acc.properties = [...(acc.properties ?? []), ...propRes.properties];
              if (propRes.enrichment) acc.enrichment = propRes.enrichment;
              if (propRes.count != null) acc.count = (acc.count ?? 0) + propRes.count;
            }
          } catch (err) {
            propertyError = err;
          }
        }

        if (preforeclosureRequested) {
          try {
            const preRes = await listPreforeclosuresUnified(batchDataEnabled, z, perZipLimit);
            if (!(preRes as { error?: string }).error) {
              preforeclosureOk = true;
              if (preRes.properties) acc.properties = [...(acc.properties ?? []), ...preRes.properties];
              if (preRes.enrichment && !acc.enrichment) acc.enrichment = preRes.enrichment;
            }
            // Coverage gap on preforeclosure is expected; if property feed
            // succeeded, don't pollute outcomes with a noCoverage tick.
          } catch (err) {
            if (err instanceof PropDataError && err.isCoverageGap && propertyOk) {
              // Silent — property feed carried the ZIP.
            } else if (!propertyParams) {
              // Only-preforeclosure search; surface this error as the ZIP's outcome.
              classify(err);
            } else if (err instanceof PropDataError && err.code === 'RATE_LIMITED') {
              // Rate limits matter regardless of which feed they came from.
              outcomes.rateLimited += 1;
            }
          }
        }

        completed += 1;
        setProgress({ done: completed, total: resolved.zips.length });

        if (propertyOk || preforeclosureOk) {
          outcomes.ok += 1;
          return acc;
        }
        // Both feeds failed (or only property feed was attempted and failed).
        if (propertyError) classify(propertyError);
        return null;
      });

      // Merge results across ZIPs. Dedupe by parcel_id (defensive — PropData
      // shouldn't return the same parcel from two ZIPs, but safer to assume
      // it could).
      const merged: PropDataPropertyRecord[] = [];
      const seenParcels = new Set<string>();
      let mergedEnrichment: PropDataEnrichment | undefined;
      for (const batch of batched) {
        const list = batch.result;
        if (!list?.properties) continue;
        if (!mergedEnrichment) mergedEnrichment = list.enrichment;
        for (const rec of list.properties) {
          // Dedupe only by parcel_id. The prior `address|zip` fallback was
          // unsafe with the dual-feed fan-out: if both the property and
          // preforeclosure feeds returned the same address without a
          // parcel_id, one record would be silently dropped. Better to risk
          // an occasional visible duplicate (rare — PropData almost always
          // emits parcel_id) than to silently lose a lead.
          if (rec.parcel_id) {
            if (seenParcels.has(rec.parcel_id)) continue;
            seenParcels.add(rec.parcel_id);
          }
          merged.push(rec);
        }
      }

      // v2: apply lead-type client predicates over the merged set BEFORE
      // truncating to `limit`. OR semantics across selected slugs — a parcel
      // passes if it matches ANY chosen lead type. v1 behaviour preserved
      // when flag is off (no filter applied).
      const filteredMerged = leadTypesV2Enabled && selectedLeadTypes.size > 0
        ? applyLeadFilters(merged, [...selectedLeadTypes])
        : merged;
      // Tag matched lead types for badge rendering on result cards. Cheap —
      // 12 predicate evals per record. Skipped when flag is off so the
      // legacy card-render path doesn't read undefined props.
      const tagged = leadTypesV2Enabled
        ? tagRecordWithLeadTypes(filteredMerged)
        : filteredMerged;

      setData({
        properties: tagged.slice(0, limit),
        count: filteredMerged.length,
        enrichment: mergedEnrichment,
      });
      setProgress(null);

      // v2-aware noun for the result toast — "off-market lead(s)" when the
      // selection mixes feeds, "absentee owner(s)" for the legacy default.
      const isV2Selection = leadTypesV2Enabled && selectedLeadTypes.size > 0;
      const resultNoun = isV2Selection ? 'off-market lead' : 'absentee owner';

      // Fire-and-forget search-summary log → backend emits a structured
      // journald line that the off-market routing monitor reads to
      // compute SLI-1 (endpoint diversity) and SLI-3 (empty-result rate).
      // Failure-tolerant: search UX is already complete, the log is
      // pure observability.
      const endpointsDispatched: string[] = [];
      if (searchPlan.property !== null) endpointsDispatched.push('property');
      if (searchPlan.preforeclosure !== null) endpointsDispatched.push('preforeclosure');
      void fetch('/api/offmarket-search-log', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_types_selected: [...selectedLeadTypes],
          endpoints_dispatched: endpointsDispatched,
          result_count: filteredMerged.length,
          region_label: resolved.label,
          search_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      }).catch(() => { /* observability is best-effort */ });

      if (merged.length === 0) {
        // Reorder outcome priority so rate-limit only dominates when it
        // actually drove the failure (not when 24 ZIPs returned OK-empty
        // and 1 hit a throttle — that produced misleading "1 of 25 hit
        // rate-limit" toasts that hid the real problem).
        let description: string;
        const totalFailed = outcomes.noCoverage + outcomes.rateLimited + outcomes.network + outcomes.other;
        const allEmpty = outcomes.ok > 0 && outcomes.ok + totalFailed === resolved.zips.length;
        if (allEmpty) {
          description = `Searched ${resolved.zips.length} ZIP${resolved.zips.length === 1 ? '' : 's'} — no ${resultNoun}s matched your filters. Try fewer lead types, lower the equity floor, or pick a different region.`;
        } else if (outcomes.rateLimited >= Math.ceil(resolved.zips.length / 2)) {
          description = `${outcomes.rateLimited} of ${resolved.zips.length} ZIPs hit rate-limit. Wait a minute and try again, or narrow the search.`;
        } else if (outcomes.network > 0 && outcomes.noCoverage === 0) {
          description = `${outcomes.network} of ${resolved.zips.length} ZIPs hit a temporary upstream error. Try again in a moment.`;
        } else if (outcomes.noCoverage === resolved.zips.length) {
          description = `PropData has no parcel coverage in ${resolved.label} yet. Try a different state — Minnesota and Florida have rich data.`;
        } else if (outcomes.noCoverage > 0) {
          description = `${outcomes.noCoverage} of ${resolved.zips.length} ZIPs returned no coverage. Try a different state — Minnesota and Florida have rich data.`;
        } else if (outcomes.rateLimited > 0) {
          description = `${outcomes.rateLimited} of ${resolved.zips.length} ZIPs hit rate-limit. Wait a minute and try again, or narrow the search.`;
        } else {
          description = `Searched ${resolved.zips.length} ZIP${resolved.zips.length === 1 ? '' : 's'} — no ${resultNoun}s matched.`;
        }
        toast({
          title: `No ${resultNoun}s found`,
          description,
          variant: 'destructive',
        });
      } else {
        const okMsg = `${Math.min(merged.length, limit)} ${resultNoun}${merged.length === 1 ? '' : 's'}`
          + ` from ${outcomes.ok}/${resolved.zips.length} ZIP${resolved.zips.length === 1 ? '' : 's'}`;
        const skipped = outcomes.noCoverage + outcomes.rateLimited + outcomes.network;
        toast({
          title: okMsg,
          description: skipped > 0
            ? `${skipped} ZIP${skipped === 1 ? '' : 's'} skipped (no coverage / rate-limited / transient). Filter by equity, export, or send to AI.`
            : 'Filter by equity, export to CSV, or send to the AI analyzer.',
        });
      }
    } catch (err) {
      // Top-level catch — only fires when the whole search throws
      // (location resolver, sessionStorage, etc.). Per-ZIP errors are
      // captured in `outcomes` above. Branch on PropDataError code for
      // a specific message; fall through to generic for anything else.
      console.error('[AbsenteeOwnerSearch]', err);
      if (err instanceof PropDataError) {
        if (err.isCoverageGap) {
          toast({
            title: 'No PropData coverage',
            description: 'PropData doesn’t have parcel data for this region yet. Minnesota and Florida have rich coverage.',
            variant: 'destructive',
          });
        } else if (err.code === 'RATE_LIMITED') {
          toast({
            title: 'Rate limit hit',
            description: 'You’ve made too many off-market searches in a short window. Wait a minute and try again.',
            variant: 'destructive',
          });
        } else if (err.isTransient) {
          toast({
            title: 'PropData temporarily unavailable',
            description: 'Upstream had a hiccup. Try again in a moment — usually clears in under a minute.',
            variant: 'destructive',
          });
        } else if (err.code === 'NOT_CONFIGURED') {
          toast({
            title: 'Off-market search not configured',
            description: 'Backend is missing PropData credentials. Contact support.',
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Search failed', description: 'Could not fetch off-market leads.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  /**
   * Stable key for selection — parcel_id preferred, falls back to address
   * triple. Same shape used elsewhere in this file for dedup.
   */
  const selectionKey = (rec: PropDataPropertyRecord): string =>
    rec.parcel_id || `${rec.address?.street || ''}|${rec.address?.zip || ''}|${rec.owner?.name || ''}`;

  const toggleSelection = (rec: PropDataPropertyRecord) => {
    const key = selectionKey(rec);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedKeys(new Set(filtered.map(selectionKey)));
  };

  const clearSelection = () => setSelectedKeys(new Set());

  /**
   * Phase 3 bulk skip-trace runner.
   *
   * For each selected record:
   *   1. Build a byaddress skip-trace query (street + citystatezip)
   *   2. Fire skipTrace.search(...) — gated server-side on Pro/Elite + quota
   *   3. Concurrency 4 so we don't hammer the upstream
   *   4. Per-call outcome counted (ok / no-match / quota / error)
   *   5. Toast progress + final summary
   *
   * Each NON-cached call counts against the user's monthly quota (server
   * enforces; client doesn't double-check). If the user runs out mid-batch,
   * remaining records are skipped with a quota-exceeded counter.
   */
  const handleBulkSkipTrace = async () => {
    if (!canBulkSkipTrace) {
      toast({
        title: 'Pro / Elite feature',
        description: 'Bulk skip-tracing requires a Pro or Elite subscription.',
        variant: 'destructive',
      });
      return;
    }
    const targets = filtered.filter((rec) => selectedKeys.has(selectionKey(rec)));
    if (targets.length === 0) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });
    const outcomes = { ok: 0, noMatch: 0, quotaExceeded: 0, error: 0 };
    let completed = 0;
    const concurrency = Math.min(4, targets.length);
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < targets.length) {
        const i = cursor++;
        const rec = targets[i];
        const street = rec.address?.street;
        const citystatezip = [rec.address?.city, rec.state, rec.address?.zip].filter(Boolean).join(', ');
        if (!street || !citystatezip) {
          outcomes.error += 1;
          completed += 1;
          setBulkProgress({ done: completed, total: targets.length });
          continue;
        }
        try {
          const r = await skipTrace.search({ searchType: 'byaddress', street, citystatezip });
          if (r.error) {
            if (r.code === 'QUOTA_EXCEEDED') {
              outcomes.quotaExceeded += 1;
            } else {
              outcomes.error += 1;
            }
          } else if ((r.data?.resultCount ?? 0) === 0) {
            outcomes.noMatch += 1;
          } else {
            outcomes.ok += 1;
          }
        } catch {
          outcomes.error += 1;
        }
        completed += 1;
        setBulkProgress({ done: completed, total: targets.length });
      }
    });
    await Promise.all(workers);
    setBulkRunning(false);
    setBulkProgress(null);
    // Summary toast. Lead with the headline (matches found) and surface
    // remaining counts so the user knows why some inputs didn't yield.
    const summary = [
      `${outcomes.ok} matched`,
      outcomes.noMatch > 0 ? `${outcomes.noMatch} no match` : null,
      outcomes.quotaExceeded > 0 ? `${outcomes.quotaExceeded} quota` : null,
      outcomes.error > 0 ? `${outcomes.error} errored` : null,
    ].filter(Boolean).join(' · ');
    toast({
      title: `Bulk skip-trace complete (${targets.length})`,
      description: `${summary}. View matches in Skip Trace history.`,
    });
    // Keep the selection — user may want to retry quota/error rows after waiting.
  };

  /**
   * Hand off the currently-filtered absentee owners to the AI Deal Analyzer.
   * Maps PropData records → UnifiedProperty[] (the analyzer's expected shape
   * since PR #179), stashes in sessionStorage, then navigates. The analyzer
   * picks the stash up on mount and clears it.
   */
  const handleAnalyzeWithAI = () => {
    if (filtered.length === 0) return;
    const unified = mapPropDataListToUnified({
      properties: filtered,
      enrichment: data?.enrichment,
    });
    try {
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_KEY, JSON.stringify(unified));
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY, resolvedLabel || searchedZips.join(','));
    } catch (err) {
      console.error('[AbsenteeOwnerSearch] sessionStorage write failed', err);
      toast({ title: 'Could not hand off to analyzer', description: 'Storage quota?', variant: 'destructive' });
      return;
    }
    toast({
      title: `Sending ${filtered.length} owner${filtered.length === 1 ? '' : 's'} to AI Analyzer`,
      description: 'Running ARV, repair, MAO, and motivation analysis…',
    });
    navigate('/app/analyzer?source=off-market');
  };

  /** Shared blob download helper — used by both CSV exports. */
  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const slugForFilename = () =>
    (resolvedLabel || searchedZips[0] || 'export').replace(/[^a-z0-9-]+/gi, '-').slice(0, 40);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const csv = toCsv(filtered);
    downloadCsv(csv, `absentee-owners-${slugForFilename()}-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: 'CSV exported', description: `${filtered.length} record${filtered.length === 1 ? '' : 's'} downloaded.` });
  };

  /**
   * Phase 4 — Mailing labels export. Direct-mail-tool-ready CSV
   * (Yellow Letter HQ / Click2Mail / Lob compatible column shape).
   * Rows without owner_name or mailing_address are skipped at the
   * source — direct-mail tools reject unaddressable rows anyway.
   */
  const handleExportMailingLabels = () => {
    if (filtered.length === 0) return;
    const { csv, included, skipped } = toMailingLabelsCsv(filtered);
    if (included === 0) {
      toast({
        title: 'No mailable rows',
        description: 'None of the selected records have an owner name + mailing address. Filter to higher-equity or larger ZIPs for richer owner data.',
        variant: 'destructive',
      });
      return;
    }
    downloadCsv(csv, `mailing-labels-${slugForFilename()}-${new Date().toISOString().slice(0, 10)}.csv`);
    const desc = skipped > 0
      ? `${included} mailable · ${skipped} skipped (no mailing address). Ready for Yellow Letter HQ / Click2Mail / Lob.`
      : `${included} mailable rows ready for Yellow Letter HQ / Click2Mail / Lob.`;
    toast({ title: 'Mailing labels exported', description: desc });
  };

  return (
    <div className="space-y-6">
      <Card className="simple-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Flame className="h-5 w-5 text-amber-400" />
            {leadTypesV2Enabled ? 'Off-Market Property Search' : 'Absentee Owner Search'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {leadTypesV2Enabled
              ? 'Search off-market properties using motivation signals — 12 lead types backed by deed-level data. Combine signals to narrow the list.'
              : 'Find landlords whose mailing address is different from the property — the highest-converting direct-mail segment.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchHistory.length > 0 && (
            <SearchHistory<OffMarketHistoryParams>
              entries={searchHistory}
              onApply={(entry) => handleApplyHistory(entry.params)}
              onRemove={removeSearchFromHistory}
              onClear={clearSearchHistory}
            />
          )}
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor="abs-location">Location</Label>
              <LocationAutocomplete
                inputId="abs-location"
                value={locationInput}
                onChange={setLocationInput}
                onSelect={() => {
                  // Auto-fire the search when the user commits a Zillow
                  // suggestion — matches Google Places' "select-to-search"
                  // pattern and skips the extra Enter press.
                  handleSearch();
                }}
                placeholder='ZIP (55101), multi-ZIP, "Detroit, MI", "Oakland County, MI", or just "MI"'
                hideLabel
                hideHelperText
              />
              <p className="text-xs text-muted-foreground">
                Multi-ZIP / city / county / state all fan out across up to {MAX_ZIPS_PER_SEARCH} ZIPs.
              </p>
            </div>

            {/* v2 lead-type chip selector — sits BELOW the Location input so
                the user picks WHERE first, then narrows BY motivation signal.
                Multi-select: combine signals to narrow the list (OR semantics
                applied client-side after the primary-source fetch). Default
                ['absentee'] preserves the legacy single-mode behaviour. */}
            {leadTypesV2Enabled && (
              <div className="pt-1">
                <LeadTypeChips
                  leadTypes={LEAD_TYPES}
                  selected={selectedLeadTypes}
                  onChange={setSelectedLeadTypes}
                  userTier={userTier}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="abs-limit" className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  Max results
                </Label>
                <select
                  id="abs-limit"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md bg-background/50 border border-input text-sm"
                >
                  {LIMIT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="abs-equity" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Min equity
                </Label>
                <select
                  id="abs-equity"
                  value={equityFilter}
                  onChange={(e) => setEquityFilter(e.target.value as EquityFilter)}
                  className="w-full h-10 px-3 rounded-md bg-background/50 border border-input text-sm"
                >
                  <option value="any">Any</option>
                  <option value="gte_40">≥ 40%</option>
                  <option value="gte_60">≥ 60%</option>
                  <option value="gte_80">≥ 80%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Motivation filters — uniform toggle rows matching PR #214 design
              language. Each filter is client-side (server already absentee_only),
              applied to whatever PropData returns. */}
          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Motivation Filters
              </h3>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear {activeFilterCount}
                </button>
              )}
            </div>

            <div className="space-y-2">
              <ToggleRow
                id="absentee-tax-delinquent"
                icon={AlertTriangle}
                iconClass="text-amber-400"
                label="Tax delinquent only"
                description="Owners with past-due property taxes — strongest must-sell signal"
                checked={taxDelinquentOnly}
                onCheckedChange={setTaxDelinquentOnly}
              />
              <ToggleRow
                id="absentee-exclude-recent"
                icon={CalendarClock}
                label="Exclude recently sold (< 12 months)"
                description="Skip parcels with a sale date in the last year"
                checked={excludeRecentSales}
                onCheckedChange={setExcludeRecentSales}
              />
              <div className="rounded-lg border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <Label htmlFor="abs-years-held" className="text-sm font-medium leading-tight">
                      Min years held
                    </Label>
                    <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Filter for tired landlords — longer hold periods skew toward sellable
                    </span>
                  </div>
                  <select
                    id="abs-years-held"
                    value={minYearsHeld}
                    onChange={(e) => setMinYearsHeld(Number(e.target.value) as 0 | 5 | 10 | 20)}
                    className="h-8 px-2 rounded-md bg-background/50 border border-input text-xs shrink-0"
                  >
                    <option value="0">Any</option>
                    <option value="5">≥ 5 yr</option>
                    <option value="10">≥ 10 yr</option>
                    <option value="20">≥ 20 yr</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={loading}
            size="lg"
            className="group w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 text-cyan-950 hover:from-cyan-400 hover:to-cyan-300 shadow-[0_0_0_1px_rgba(0, 196, 200,0.4),0_8px_24px_-8px_rgba(0, 196, 200,0.5)] hover:shadow-[0_0_0_1px_rgba(0, 196, 200,0.5),0_12px_32px_-8px_rgba(0, 196, 200,0.7)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                {progress ? `Searching ${progress.done}/${progress.total} ZIPs…` : 'Searching…'}
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2 transition-transform group-hover:scale-110" />
                {leadTypesV2Enabled
                  ? selectedLeadTypes.size === 1
                    ? `Search ${LEAD_TYPES.find(l => l.slug === [...selectedLeadTypes][0])?.label.toLowerCase() || 'off-market'}`
                    : `Search off-market (${selectedLeadTypes.size} lead types)`
                  : 'Search absentee owners'}
              </>
            )}
          </Button>

          {resolvedLabel && !loading && (data?.properties?.length ?? 0) >= 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Searched: {resolvedLabel} · {searchedZips.length} ZIP{searchedZips.length === 1 ? '' : 's'}</span>
            </div>
          )}

          {enrichment && (data?.properties?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {enrichment.is_opportunity_zone && (
                <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-300">
                  <TrendingUp className="h-3 w-3" /> Opportunity Zone
                </Badge>
              )}
              {enrichment.usda_rural_eligible && (
                <Badge variant="outline" className="text-xs gap-1 border-emerald-500/40 text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> USDA Rural
                </Badge>
              )}
              {enrichment.fema_flood_zone && (
                <Badge variant="outline" className="text-xs border-sky-500/40 text-sky-300">
                  Flood Zone {enrichment.fema_flood_zone}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-medium">
                {filtered.length} absentee owner{filtered.length === 1 ? '' : 's'}
              </h3>
              {/* Active-filter chips — show every applied filter so the count
                  above is always explainable at a glance. */}
              {equityFilter !== 'any' && (
                <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                  <TrendingUp className="h-3 w-3" /> equity ≥ {equityThreshold(equityFilter)}%
                </Badge>
              )}
              {taxDelinquentOnly && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> tax delinquent
                </Badge>
              )}
              {minYearsHeld > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                  <CalendarClock className="h-3 w-3" /> held ≥ {minYearsHeld} yr
                </Badge>
              )}
              {excludeRecentSales && (
                <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                  <CalendarClock className="h-3 w-3" /> not sold &lt; 12 mo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAnalyzeWithAI}
                size="sm"
                className="h-9 bg-amber-400 text-neutral-950 hover:bg-amber-300"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze {filtered.length} with AI
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm" className="h-9">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={handleExportMailingLabels}
                variant="outline"
                size="sm"
                className="h-9"
                title="Direct-mail-ready CSV — Yellow Letter HQ / Click2Mail / Lob format"
              >
                <Mail className="h-4 w-4 mr-2" />
                Mailing labels
              </Button>
              {/* Phase 7 — heatmap view toggle. Flag-gated; lazy-loads
                  Leaflet + react-leaflet + leaflet.heat in its own chunk
                  so users without the flag never download the map deps. */}
              {heatmapEnabled && (
                <div className="inline-flex rounded-md border border-zinc-700 overflow-hidden h-9" role="group" aria-label="Results view">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={`px-3 text-xs font-medium ${view === 'list' ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-400 hover:text-zinc-200'}`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('map')}
                    className={`px-3 text-xs font-medium border-l border-zinc-700 ${view === 'map' ? 'bg-zinc-800 text-zinc-100' : 'bg-transparent text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Map
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Phase 7 heatmap mounted only when flag is on AND user toggled to map.
              React.lazy ensures the bundle isn't pulled until first render. */}
          {heatmapEnabled && view === 'map' && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-96 bg-zinc-900/40 border border-zinc-800 rounded-lg text-zinc-400 text-sm">
                  Loading map…
                </div>
              }
            >
              <HeatmapLazy records={filtered} />
            </Suspense>
          )}

          {/* Phase 3 bulk-action toolbar — sticky-feeling. Only renders
              when the bulk-skip-trace flag is enabled AND at least one
              record is selected. Tier-gated CTA: Pro/Elite click runs
              the bulk fire; lower-tier users see an upgrade nudge. */}
          {bulkSkipTraceEnabled && selectedKeys.size > 0 && (
            <Card className="border-cyan-500/40 bg-cyan-500/[0.04]">
              <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <CheckSquare className="h-4 w-4 text-cyan-400" />
                  <span className="font-medium">{selectedKeys.size} selected</span>
                  {bulkRunning && bulkProgress && (
                    <span className="text-xs text-muted-foreground">
                      · skip-tracing {bulkProgress.done}/{bulkProgress.total}…
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    disabled={bulkRunning}
                    className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                  >
                    Select all {filtered.length}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={bulkRunning}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                  {canBulkSkipTrace ? (
                    <Button
                      onClick={handleBulkSkipTrace}
                      disabled={bulkRunning}
                      size="sm"
                      className="h-9 bg-cyan-500 hover:bg-cyan-400 text-cyan-950 disabled:opacity-50"
                    >
                      {bulkRunning ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Skip-trace {selectedKeys.size}
                    </Button>
                  ) : (
                    <Link to="/pricing">
                      <Button size="sm" variant="outline" className="h-9 border-amber-500/40 text-amber-300">
                        <Lock className="h-3 w-3 mr-2" />
                        Upgrade to bulk skip-trace
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${heatmapEnabled && view === 'map' ? 'hidden' : ''}`}>
            {filtered.map((rec, idx) => {
              const equityPct = rec.equity?.equity_pct;
              const highEquity = (equityPct ?? 0) >= 60;
              const key = selectionKey(rec);
              const isSelected = selectedKeys.has(key);
              return (
                <Card
                  key={rec.parcel_id || idx}
                  className={`simple-card transition-colors ${isSelected ? 'ring-2 ring-cyan-500/40 bg-cyan-500/[0.02]' : ''}`}
                >
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Phase 3 checkbox — only renders when bulk-skip-trace
                          is flag-enabled. Pure additive surface; hidden for
                          users without the flag. */}
                      {bulkSkipTraceEnabled && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(rec)}
                          className="mt-1 shrink-0"
                          aria-label={`Select ${rec.owner?.name || 'owner'}`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          {propertyModalEnabled ? (
                            <button
                              type="button"
                              onClick={() => setOpenProperty(rec)}
                              className="break-words text-left hover:text-cyan-300 hover:underline underline-offset-2 transition-colors"
                              title="View full property detail"
                            >
                              {joinAddr(rec)}
                            </button>
                          ) : (
                            <span className="break-words">{joinAddr(rec)}</span>
                          )}
                        </h4>
                        <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                          {[rec.county_name, rec.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {highEquity && (
                        <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300 flex-shrink-0">
                          <Flame className="h-3 w-3 mr-1" /> {fmtPct(equityPct)} equity
                        </Badge>
                      )}
                    </div>

                    {leadTypesV2Enabled && (() => {
                      // Local widening: tagRecordWithLeadTypes attaches
                      // matchedLeadTypes at runtime; the source type is
                      // intentionally untouched.
                      const matched = (rec as PropDataPropertyRecord & { matchedLeadTypes?: string[] })
                        .matchedLeadTypes ?? [];
                      const visible = matched.filter((s) => s !== 'pre-foreclosure');
                      if (visible.length === 0) return null;
                      const shown = visible.slice(0, 3);
                      const overflow = visible.length - shown.length;
                      return (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {shown.map((slug) => {
                            const lt = LEAD_TYPES.find((x) => x.slug === slug);
                            if (!lt) return null;
                            const Icon = LEAD_TYPE_CARD_ICON_MAP[lt.icon] ?? Home;
                            return (
                              <Badge
                                key={slug}
                                variant="outline"
                                className={`text-[10px] gap-1 ${lt.badgeColor}`}
                              >
                                <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                                {lt.label}
                              </Badge>
                            );
                          })}
                          {overflow > 0 && (
                            <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-300">
                              +{overflow} more
                            </Badge>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-4 w-4 text-primary flex-shrink-0" />
                          {ownerDetailEnabled && rec.owner?.name ? (
                            <button
                              type="button"
                              onClick={() => setOpenOwner(rec)}
                              className="font-medium text-sm break-all text-left hover:text-cyan-300 hover:underline underline-offset-2 transition-colors"
                              title="View this owner's full parcel portfolio"
                            >
                              {rec.owner.name}
                            </button>
                          ) : (
                            <span className="font-medium text-sm break-all">{rec.owner?.name || 'Unknown owner'}</span>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <OwnerSkipTraceButton owner={rec.owner} />
                        </div>
                      </div>
                      {mailingAddr(rec) && (
                        <div className="flex items-start gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span className="break-words">{mailingAddr(rec)}</span>
                        </div>
                      )}
                      {rec.flags?.is_absentee_owner && (
                        <Badge variant="outline" className="text-xs">Absentee</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-muted-foreground">Market</div>
                        <div className="text-sm font-bold">{fmtCurrency(rec.valuation?.market_value)}</div>
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-muted-foreground">Last sale</div>
                        <div className="text-sm font-bold">{fmtCurrency(rec.sale?.last_sale_price)}</div>
                        {rec.sale?.last_sale_date && (
                          <div className="text-[10px] text-muted-foreground">{rec.sale.last_sale_date.slice(0, 7)}</div>
                        )}
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-muted-foreground">Equity</div>
                        <div className="text-sm font-bold">{fmtCurrency(rec.equity?.estimated_equity)}</div>
                        {equityPct != null && (
                          <div className="text-[10px] text-muted-foreground">{fmtPct(equityPct)} · held {rec.equity?.years_held ?? '?'}y</div>
                        )}
                      </div>
                    </div>

                    {(rec.characteristics?.year_built || rec.characteristics?.property_type) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                        <Building className="h-3 w-3" />
                        {[
                          rec.characteristics?.property_type,
                          rec.characteristics?.year_built ? `Built ${rec.characteristics.year_built}` : null,
                          rec.parcel_id ? `APN ${rec.parcel_id}` : null,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {data && filtered.length === 0 && (data.properties?.length ?? 0) > 0 && (
        <Card className="simple-card">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {data.properties?.length} owner{data.properties?.length === 1 ? '' : 's'} returned but none match your equity filter.
            Loosen the filter or try a different ZIP.
          </CardContent>
        </Card>
      )}

      {/* Owner portfolio modal — flag-gated via off-market-owner-detail.
          Trigger lives on the owner name button in each result card. */}
      {openOwner && (
        <OwnerDetailModal
          isOpen={!!openOwner}
          onClose={() => setOpenOwner(null)}
          owner={openOwner.owner || {}}
          fallbackZip={openOwner.address?.zip}
        />
      )}

      {/* Off-market property detail modal — flag-gated via
          off-market-property-modal. Trigger is the property address
          button in each result card. PropData-shaped detail view
          (separate from Zillow-shaped PropertyModal). */}
      {openProperty && (
        <OffMarketPropertyModal
          isOpen={!!openProperty}
          onClose={() => setOpenProperty(null)}
          property={openProperty}
        />
      )}
    </div>
  );
}

/**
 * Uniform toggle row — same component shape as PropertySearch's filters
 * section (PR #214). Locally redefined here so the absentee search owns
 * its own copy without coupling the two files. If we add more filter
 * surfaces, factor into `@/components/ui/toggle-row`.
 */
function ToggleRow({
  id,
  icon: Icon,
  iconClass = 'text-primary',
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  label: React.ReactNode;
  description: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-all duration-150 hover:border-border hover:bg-background/40">
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${iconClass}`} />
        <div className="flex flex-col min-w-0">
          <Label htmlFor={id} className="text-sm font-medium leading-tight cursor-pointer">
            {label}
          </Label>
          <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </span>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
      />
    </div>
  );
}
