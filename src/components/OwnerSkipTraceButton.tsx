import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { skipTrace } from '@/lib/api-client';
import { Phone, Mail, Search, RefreshCw, Lock } from 'lucide-react';

/**
 * Skip-trace button + inline result strip for one owner record.
 *
 * Uses the existing /api/skip-trace endpoints (RapidAPI skip-tracing-working
 * provider behind a Pro/Elite gate, monthly quota, 24h dedup, 30-day shared
 * peo_id cache). The flow is two-step:
 *   1. POST /api/skip-trace/search { searchType: 'bynameaddress', name, citystatezip }
 *      → returns peoIds[]
 *   2. GET  /api/skip-trace/details/:peoId
 *      → returns full phones / emails / relatives
 *
 * Result is held in local state so re-clicks don't burn the user's monthly
 * quota (the backend already caches, but we skip the round-trip too).
 */

interface OwnerInfo {
  name?: string;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
}

interface SkipTraceResult {
  phones: string[];
  emails: string[];
  relatives: string[];
}

function arrayOfStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item === 'string') out.push(item);
    else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const s =
        (typeof obj.number === 'string' && obj.number) ||
        (typeof obj.email === 'string' && obj.email) ||
        (typeof obj.phone === 'string' && obj.phone) ||
        (typeof obj.value === 'string' && obj.value) ||
        '';
      if (s) out.push(s);
    }
  }
  return out;
}

export function OwnerSkipTraceButton({ owner }: { owner?: OwnerInfo }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkipTraceResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Need at least owner.name and SOMETHING resolvable as citystatezip.
  // PropData fills owner.mailing_zip but sometimes city/state are null;
  // the upstream API will still accept ZIP-only "12345".
  const canTrace = Boolean(owner?.name && (owner?.mailing_zip || owner?.mailing_city));

  const handleTrace = async () => {
    if (!owner?.name) return;
    setLoading(true);
    setNotFound(false);
    try {
      const citystatezip = [owner.mailing_city, owner.mailing_state, owner.mailing_zip]
        .filter(Boolean)
        .join(' ')
        .trim();
      const searchRes = await skipTrace.search({
        searchType: 'bynameaddress',
        name: owner.name,
        citystatezip: citystatezip || owner.mailing_zip || '',
      });

      if (searchRes.error) {
        const msg = searchRes.error.toLowerCase();
        if (msg.includes('tier') || msg.includes('upgrade') || msg.includes('pro')) {
          toast({
            title: 'Skip-trace requires Pro / Elite',
            description: 'Upgrade your plan to surface owner phone + email from /app/skip-trace.',
            variant: 'destructive',
          });
        } else if (msg.includes('quota')) {
          toast({
            title: 'Monthly skip-trace quota hit',
            description: searchRes.error,
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Skip-trace failed', description: searchRes.error, variant: 'destructive' });
        }
        return;
      }

      const peoIds = searchRes.data?.peoIds ?? [];
      if (peoIds.length === 0) {
        setNotFound(true);
        toast({ title: 'No skip-trace match', description: `No record for "${owner.name}" at ${citystatezip || 'this address'}.` });
        return;
      }

      // Fetch details for the top match. Multi-match handling could be a
      // future enhancement (today we just take the first).
      const detailsRes = await skipTrace.details(peoIds[0]);
      if (detailsRes.error || !detailsRes.data) {
        toast({ title: 'Details lookup failed', description: detailsRes.error || 'No details returned', variant: 'destructive' });
        return;
      }
      const details = detailsRes.data.details as Record<string, unknown>;
      const phones = arrayOfStrings(details.phones || details.phone_numbers);
      const emails = arrayOfStrings(details.emails || details.email_addresses);
      const relatives = arrayOfStrings(details.relatives);
      setResult({ phones, emails, relatives });

      if (phones.length === 0 && emails.length === 0) {
        toast({ title: 'Match found but no contact data', description: 'The provider has the person but no phone/email on file.' });
      }
    } catch (err) {
      console.error('[OwnerSkipTraceButton]', err);
      toast({ title: 'Skip-trace error', description: 'See console.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-1.5 text-xs">
        {result.phones.length === 0 && result.emails.length === 0 && (
          <div className="text-muted-foreground">Trace found but no contact data on file.</div>
        )}
        {result.phones.slice(0, 3).map((p) => (
          <div key={p} className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-emerald-400" />
            <a href={`tel:${p}`} className="hover:underline">{p}</a>
          </div>
        ))}
        {result.emails.slice(0, 2).map((e) => (
          <div key={e} className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-cyan-400" />
            <a href={`mailto:${e}`} className="hover:underline break-all">{e}</a>
          </div>
        ))}
        {result.relatives.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {result.relatives.length} relative{result.relatives.length === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
    );
  }

  if (notFound) {
    return <div className="text-xs text-muted-foreground italic">No skip-trace match.</div>;
  }

  if (!canTrace) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        Owner data incomplete — can't skip-trace
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleTrace}
      disabled={loading}
      className="h-7 text-xs"
    >
      {loading ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Search className="h-3 w-3 mr-1.5" />}
      {loading ? 'Tracing…' : 'Skip Trace'}
    </Button>
  );
}
