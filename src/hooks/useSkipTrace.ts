import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  skipTrace,
  type SkipTraceSearchParams,
  type SkipTraceSearchResponse,
  type SkipTraceQuota,
} from '@/lib/api-client';
import { Property } from '@/types/zillow';

export interface SkipTracePerson {
  peoId?: string;
  name?: string;
  age?: number | string;
  currentAddress?: string;
  phones?: string[];
  emails?: string[];
  relatives?: string[];
  raw: Record<string, unknown>;
}

export interface SkipTraceResult {
  searchType: SkipTraceSearchParams['searchType'];
  paramsLabel: string;
  people: SkipTracePerson[];
  resultCount: number;
  servedFromCache: boolean;
  raw: unknown;
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

function arrayOfStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item === 'string') {
      out.push(item);
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const candidate =
        asString(obj.number) ||
        asString(obj.email) ||
        asString(obj.phone) ||
        asString(obj.address) ||
        asString(obj.value) ||
        asString(obj.name);
      if (candidate) out.push(candidate);
    }
  }
  return Array.from(new Set(out));
}

function normalizePerson(node: Record<string, unknown>): SkipTracePerson {
  const name =
    asString(node.name) ||
    asString(node.full_name) ||
    asString(node.fullName) ||
    [asString(node.first_name), asString(node.middle_name), asString(node.last_name)]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    undefined;

  return {
    peoId: asString(node.peo_id) || asString(node.peoId),
    name,
    age: typeof node.age === 'number' || typeof node.age === 'string' ? node.age : undefined,
    currentAddress: asString(node.current_address) || asString(node.currentAddress) || asString(node.address),
    phones: arrayOfStrings(node.phones || node.phone_numbers || node.phoneNumbers),
    emails: arrayOfStrings(node.emails || node.email_addresses || node.emailAddresses),
    relatives: arrayOfStrings(node.relatives || node.relations),
    raw: node,
  };
}

function extractPeople(payload: unknown): SkipTracePerson[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const candidates: Record<string, unknown>[] = [];
  for (const key of ['results', 'data', 'people', 'persons', 'records']) {
    const v = obj[key];
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item && typeof item === 'object') candidates.push(item as Record<string, unknown>);
      });
    }
  }
  // Some endpoints return a single record at the top level (detailsbyID)
  if (candidates.length === 0 && (obj.peo_id || obj.full_name || obj.name)) {
    candidates.push(obj);
  }
  return candidates.map(normalizePerson);
}

function paramsLabel(p: SkipTraceSearchParams): string {
  switch (p.searchType) {
    case 'byname': return p.name || '';
    case 'byaddress': return [p.street, p.citystatezip].filter(Boolean).join(', ');
    case 'bynameaddress': return [p.name, p.citystatezip].filter(Boolean).join(' · ');
    case 'byphone': return p.phoneno || '';
    case 'byemail': return p.email || '';
    default: return '';
  }
}

export function useSkipTrace() {
  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [results, setResults] = useState<SkipTraceResult[]>([]);
  const [quota, setQuota] = useState<SkipTraceQuota | null>(null);

  const fetchQuota = useCallback(async () => {
    const r = await skipTrace.quota();
    if (r.data) setQuota(r.data);
    return r.data ?? null;
  }, []);

  const search = useCallback(
    async (params: SkipTraceSearchParams): Promise<SkipTraceResult | null> => {
      setSearching(true);
      try {
        const r = await skipTrace.search(params);
        if (r.error) {
          toast.error(r.error, {
            description:
              r.code === 'TIER_REQUIRED'
                ? 'Skip tracing requires a Pro or Elite subscription.'
                : r.code === 'QUOTA_EXCEEDED'
                  ? 'You have reached your monthly skip-trace quota.'
                  : undefined,
          });
          return null;
        }
        if (!r.data) return null;
        const result: SkipTraceResult = {
          searchType: r.data.searchType,
          paramsLabel: paramsLabel(params),
          people: extractPeople(r.data.result),
          resultCount: r.data.resultCount,
          servedFromCache: r.data.servedFromCache,
          raw: r.data.result,
        };
        setResults((prev) => [result, ...prev].slice(0, 25));
        if (!r.data.servedFromCache) fetchQuota();
        if (result.resultCount === 0) {
          toast.info('No matches found', {
            description: 'Try a different search type or broaden your query.',
          });
        } else {
          toast.success(`${result.resultCount} match${result.resultCount === 1 ? '' : 'es'} found`);
        }
        return result;
      } finally {
        setSearching(false);
      }
    },
    [fetchQuota]
  );

  /** Convenience wrapper for Property modal — searches by parsed property address. */
  const skipTraceProperty = useCallback(
    async (property: Property): Promise<SkipTraceResult | null> => {
      const parts = (property.address || '').split(',');
      const street = parts[0]?.trim() || '';
      const citystatezip = parts.slice(1).join(',').trim();
      if (!street || !citystatezip) {
        toast.error('Could not parse property address');
        return null;
      }
      return search({ searchType: 'byaddress', street, citystatezip });
    },
    [search]
  );

  const getDetails = useCallback(
    async (peoId: string) => {
      setLoadingDetails(peoId);
      try {
        const r = await skipTrace.details(peoId);
        if (r.error) {
          toast.error(r.error);
          return null;
        }
        if (r.data && !r.data.servedFromCache) fetchQuota();
        return r.data ?? null;
      } finally {
        setLoadingDetails(null);
      }
    },
    [fetchQuota]
  );

  const clearResults = useCallback(() => setResults([]), []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return {
    search,
    skipTraceProperty,
    getDetails,
    fetchQuota,
    clearResults,
    searching,
    loadingDetails,
    results,
    quota,
  };
}
