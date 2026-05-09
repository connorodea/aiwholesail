import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSkipTrace, SkipTraceResult, SkipTracePerson } from '@/hooks/useSkipTrace';
import { Property } from '@/types/zillow';
import { Phone, User, Mail, MapPin, Search, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface SkipTraceModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SkipTraceModal({ property, isOpen, onClose }: SkipTraceModalProps) {
  const { skipTraceProperty, getDetails, searching, loadingDetails, results, quota } = useSkipTrace();
  const [activeResultIdx, setActiveResultIdx] = useState(0);

  const handleSkipTrace = async () => {
    if (!property) return;
    const r = await skipTraceProperty(property);
    if (r) setActiveResultIdx(0);
  };

  const current: SkipTraceResult | undefined = results[activeResultIdx];
  const hasResults = results.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Skip Trace
          </DialogTitle>
          <DialogDescription>
            Find owner contact info for: <span className="text-foreground">{property?.address}</span>
          </DialogDescription>
        </DialogHeader>

        {quota && (
          <div className="text-xs text-muted-foreground border border-border/50 rounded-md px-3 py-2 flex items-center justify-between">
            <span>
              <span className="text-foreground font-medium">{quota.used}</span> / {quota.limit} this month · {quota.tier}
            </span>
            <span>Resets {new Date(quota.resetsAt).toLocaleDateString()}</span>
          </div>
        )}

        {!hasResults && (
          <div className="text-center py-10 space-y-3">
            <Button onClick={handleSkipTrace} disabled={searching || !property} size="lg" className="gap-2">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {searching ? 'Searching...' : 'Run Skip Trace'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Searches public records for the owner of this property. Counts against your monthly quota.
            </p>
          </div>
        )}

        {hasResults && current && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {current.resultCount} {current.resultCount === 1 ? 'person' : 'people'} matched
                  {current.servedFromCache && (
                    <Badge variant="outline" className="ml-2 text-[10px]">cached</Badge>
                  )}
                </p>
                <Button onClick={handleSkipTrace} disabled={searching} variant="outline" size="sm">
                  {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  Search again
                </Button>
              </div>

              {current.people.length === 0 && (
                <Card className="border-border/50">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No people surfaced for this address. Try a different search type from the standalone Skip Trace tool.
                  </CardContent>
                </Card>
              )}

              {current.people.map((p, idx) => (
                <PersonCard
                  key={p.peoId || idx}
                  person={p}
                  loadingDetails={loadingDetails === p.peoId}
                  onLoadDetails={async () => {
                    if (!p.peoId) return;
                    const d = await getDetails(p.peoId);
                    if (d?.details) {
                      // Mutate person in place — cheap UX for now
                      Object.assign(p.raw, d.details as Record<string, unknown>);
                      const merged = mergePerson(p, d.details as Record<string, unknown>);
                      Object.assign(p, merged);
                    }
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function mergePerson(p: SkipTracePerson, details: Record<string, unknown>): Partial<SkipTracePerson> {
  const merged: Partial<SkipTracePerson> = {};
  const phones = arrayOfStrings(details.phones || details.phone_numbers);
  const emails = arrayOfStrings(details.emails || details.email_addresses);
  const relatives = arrayOfStrings(details.relatives);
  if (phones.length) merged.phones = uniq([...(p.phones || []), ...phones]);
  if (emails.length) merged.emails = uniq([...(p.emails || []), ...emails]);
  if (relatives.length) merged.relatives = uniq([...(p.relatives || []), ...relatives]);
  return merged;
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
        (typeof obj.name === 'string' && obj.name) ||
        '';
      if (s) out.push(s);
    }
  }
  return out;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

interface PersonCardProps {
  person: SkipTracePerson;
  onLoadDetails: () => void;
  loadingDetails: boolean;
}

function PersonCard({ person, onLoadDetails, loadingDetails }: PersonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContacts = (person.phones?.length || 0) + (person.emails?.length || 0) > 0;
  const fadedHeader = !person.name && !person.currentAddress;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className={`text-base truncate ${fadedHeader ? 'text-muted-foreground' : ''}`}>
              {person.name || 'Unnamed person'}
            </CardTitle>
            {person.currentAddress && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> {person.currentAddress}
              </p>
            )}
            {person.age && (
              <p className="text-xs text-muted-foreground mt-0.5">Age: {person.age}</p>
            )}
          </div>
          {person.peoId && !hasContacts && (
            <Button onClick={onLoadDetails} disabled={loadingDetails} size="sm" variant="outline" className="gap-1.5 shrink-0">
              {loadingDetails ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Reveal
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {!!person.phones?.length && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phones
            </div>
            <div className="flex flex-wrap gap-1.5">
              {person.phones.map((phone, i) => (
                <a key={i} href={`tel:${phone}`}>
                  <Badge variant="secondary" className="text-xs">{phone}</Badge>
                </a>
              ))}
            </div>
          </div>
        )}
        {!!person.emails?.length && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
              <Mail className="h-3 w-3" /> Emails
            </div>
            <div className="flex flex-wrap gap-1.5">
              {person.emails.map((email, i) => (
                <a key={i} href={`mailto:${email}`}>
                  <Badge variant="secondary" className="text-xs">{email}</Badge>
                </a>
              ))}
            </div>
          </div>
        )}
        {!!person.relatives?.length && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
              <User className="h-3 w-3" /> Relatives
            </div>
            <div className="flex flex-wrap gap-1.5">
              {person.relatives.map((rel, i) => (
                <Badge key={i} variant="outline" className="text-xs">{rel}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Raw debug toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Hide raw data' : 'Show raw data'}
        </button>
        {expanded && (
          <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-48">
            {JSON.stringify(person.raw, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
