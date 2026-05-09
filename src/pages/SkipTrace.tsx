import { useState } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, User, MapPin, Phone, Mail, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useSkipTrace, type SkipTracePerson } from '@/hooks/useSkipTrace';
import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';

type Tab = 'byname' | 'byaddress' | 'bynameaddress' | 'byphone' | 'byemail';

export default function SkipTrace() {
  const { isPro, isElite } = useSubscription();
  const allowed = isPro || isElite;

  const { search, getDetails, searching, loadingDetails, results, quota, clearResults } = useSkipTrace();

  const [tab, setTab] = useState<Tab>('byaddress');
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [citystatezip, setCityStateZip] = useState('');
  const [phoneno, setPhoneno] = useState('');
  const [email, setEmail] = useState('');

  const canRun = (() => {
    switch (tab) {
      case 'byname': return name.trim().length >= 3;
      case 'byaddress': return street.trim() && citystatezip.trim();
      case 'bynameaddress': return name.trim() && citystatezip.trim();
      case 'byphone': return phoneno.replace(/\D/g, '').length >= 10;
      case 'byemail': return /\S+@\S+\.\S+/.test(email);
      default: return false;
    }
  })();

  const handleSearch = async () => {
    if (!canRun || searching) return;
    switch (tab) {
      case 'byname':
        await search({ searchType: 'byname', name });
        return;
      case 'byaddress':
        await search({ searchType: 'byaddress', street, citystatezip });
        return;
      case 'bynameaddress':
        await search({ searchType: 'bynameaddress', name, citystatezip });
        return;
      case 'byphone':
        await search({ searchType: 'byphone', phoneno });
        return;
      case 'byemail':
        await search({ searchType: 'byemail', email });
        return;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-8">
        <section className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Skip Trace</h1>
          <p className="text-base md:text-lg text-muted-foreground font-light leading-relaxed">
            Find phone numbers, emails, and addresses for property owners — by name, address, phone, or email.
          </p>
        </section>

        {!allowed ? (
          <UpgradeCard />
        ) : (
          <>
            <div className="max-w-3xl mx-auto">
              {quota && (
                <div className="text-xs text-muted-foreground border border-border/50 rounded-md px-3 py-2 mb-4 flex items-center justify-between">
                  <span>
                    <span className="text-foreground font-medium">{quota.used}</span> / {quota.limit} this month · {quota.tier}
                  </span>
                  <span>Resets {new Date(quota.resetsAt).toLocaleDateString()}</span>
                </div>
              )}

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Run a search</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                    <TabsList className="grid w-full grid-cols-5 h-9">
                      <TabsTrigger value="byaddress" className="text-xs">Address</TabsTrigger>
                      <TabsTrigger value="byname" className="text-xs">Name</TabsTrigger>
                      <TabsTrigger value="bynameaddress" className="text-xs">Name + City</TabsTrigger>
                      <TabsTrigger value="byphone" className="text-xs">Phone</TabsTrigger>
                      <TabsTrigger value="byemail" className="text-xs">Email</TabsTrigger>
                    </TabsList>

                    <TabsContent value="byaddress" className="space-y-3 pt-4">
                      <div>
                        <Label className="text-xs">Street *</Label>
                        <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="3828 Double Oak Ln" />
                      </div>
                      <div>
                        <Label className="text-xs">City, State Zip *</Label>
                        <Input value={citystatezip} onChange={(e) => setCityStateZip(e.target.value)} placeholder="Irving, TX 75061" />
                      </div>
                    </TabsContent>

                    <TabsContent value="byname" className="space-y-3 pt-4">
                      <div>
                        <Label className="text-xs">Full Name *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="James E Whitsitt" />
                      </div>
                    </TabsContent>

                    <TabsContent value="bynameaddress" className="space-y-3 pt-4">
                      <div>
                        <Label className="text-xs">Name *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="James Whitsitt" />
                      </div>
                      <div>
                        <Label className="text-xs">City, State Zip *</Label>
                        <Input value={citystatezip} onChange={(e) => setCityStateZip(e.target.value)} placeholder="Dallas, TX 75228" />
                      </div>
                    </TabsContent>

                    <TabsContent value="byphone" className="space-y-3 pt-4">
                      <div>
                        <Label className="text-xs">Phone Number *</Label>
                        <Input value={phoneno} onChange={(e) => setPhoneno(e.target.value)} placeholder="(214) 349-3972" />
                      </div>
                    </TabsContent>

                    <TabsContent value="byemail" className="space-y-3 pt-4">
                      <div>
                        <Label className="text-xs">Email *</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@example.com" />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border/50">
                    {results.length > 0 && (
                      <Button variant="ghost" onClick={clearResults} disabled={searching}>
                        Clear results
                      </Button>
                    )}
                    <Button onClick={handleSearch} disabled={!canRun || searching} className="gap-2">
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Search
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {results.length > 0 && (
              <div className="max-w-3xl mx-auto space-y-4">
                {results.map((res, idx) => (
                  <Card key={idx} className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span className="truncate">
                          <span className="text-muted-foreground">{labelFor(res.searchType)}:</span> {res.paramsLabel}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {res.servedFromCache && <Badge variant="outline" className="text-[10px]">cached</Badge>}
                          <span className="text-xs text-muted-foreground">{res.resultCount} match{res.resultCount === 1 ? '' : 'es'}</span>
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                      {res.people.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No people surfaced for this query.</p>
                      ) : (
                        res.people.map((p, i) => (
                          <PersonRow
                            key={p.peoId || i}
                            person={p}
                            loadingDetails={loadingDetails === p.peoId}
                            onLoadDetails={async () => {
                              if (!p.peoId) return;
                              const d = await getDetails(p.peoId);
                              if (d?.details) {
                                Object.assign(p.raw, d.details as Record<string, unknown>);
                                Object.assign(p, mergePerson(p, d.details as Record<string, unknown>));
                              }
                            }}
                          />
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <ChatAssistant />
    </div>
  );
}

function UpgradeCard() {
  return (
    <div className="max-w-xl mx-auto">
      <Card className="border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" /> Skip Trace is a Pro / Elite feature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Skip tracing surfaces phone numbers, emails, and addresses for property owners — directly from your dashboard.
            It uses paid public-records lookups, so it&apos;s available on Pro (25/mo) and Elite (200/mo).
          </p>
          <Button asChild>
            <Link to="/pricing">View plans</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function labelFor(t: Tab | string): string {
  switch (t) {
    case 'byname': return 'Name';
    case 'byaddress': return 'Address';
    case 'bynameaddress': return 'Name + city';
    case 'byphone': return 'Phone';
    case 'byemail': return 'Email';
    default: return 'Search';
  }
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

function PersonRow({
  person,
  onLoadDetails,
  loadingDetails,
}: {
  person: SkipTracePerson;
  onLoadDetails: () => void;
  loadingDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContacts = (person.phones?.length || 0) + (person.emails?.length || 0) > 0;

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm flex items-center gap-1.5 truncate">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {person.name || 'Unnamed person'}
          </div>
          {person.currentAddress && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {person.currentAddress}
            </p>
          )}
          {person.age && <p className="text-[11px] text-muted-foreground">Age: {person.age}</p>}
        </div>
        {person.peoId && !hasContacts && (
          <Button onClick={onLoadDetails} disabled={loadingDetails} size="sm" variant="outline" className="gap-1.5 shrink-0">
            {loadingDetails ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Reveal
          </Button>
        )}
      </div>
      {!!person.phones?.length && (
        <div className="flex flex-wrap gap-1.5">
          {person.phones.map((phone, i) => (
            <a key={i} href={`tel:${phone}`}>
              <Badge variant="secondary" className="text-xs gap-1">
                <Phone className="h-3 w-3" /> {phone}
              </Badge>
            </a>
          ))}
        </div>
      )}
      {!!person.emails?.length && (
        <div className="flex flex-wrap gap-1.5">
          {person.emails.map((em, i) => (
            <a key={i} href={`mailto:${em}`}>
              <Badge variant="secondary" className="text-xs gap-1">
                <Mail className="h-3 w-3" /> {em}
              </Badge>
            </a>
          ))}
        </div>
      )}
      {!!person.relatives?.length && (
        <div className="flex flex-wrap gap-1.5">
          {person.relatives.map((rel, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">{rel}</Badge>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Hide raw' : 'Show raw'}
      </button>
      {expanded && (
        <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-48">
          {JSON.stringify(person.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}
