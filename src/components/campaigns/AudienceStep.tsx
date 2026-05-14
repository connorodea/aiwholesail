import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, FileUp, Mail, MapPin, Tag } from 'lucide-react';
import { buyers as buyersApi } from '@/lib/api-client';
import type {
  AudienceContact,
  AudienceFilters,
  AudienceSelection,
  AudienceSource,
} from './types';

interface AudienceStepProps {
  value: AudienceSelection;
  onChange: (next: AudienceSelection) => void;
}

const SOURCE_OPTIONS: Array<{ value: AudienceSource; label: string; icon: typeof Users; hint: string }> = [
  { value: 'buyers', label: 'Buyers', icon: Users, hint: 'Pull from your buyer database' },
  { value: 'agents', label: 'Agents', icon: UserCheck, hint: 'Listing agents from recent properties' },
  { value: 'csv', label: 'Upload CSV', icon: FileUp, hint: 'Paste rows or upload a file' },
];

function mapBuyerToContact(raw: any): AudienceContact {
  return {
    id: String(raw.id),
    firstName: raw.first_name || raw.firstName || '',
    lastName: raw.last_name || raw.lastName || '',
    email: raw.email || undefined,
    phone: raw.phone || undefined,
    company: raw.company || undefined,
    tags: raw.tags || [],
    location: (raw.criteria?.locations && raw.criteria.locations[0]) || undefined,
  };
}

function parseCsv(raw: string): AudienceContact[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const hasHeader = header.some(h => ['first_name', 'firstname', 'email', 'name'].includes(h));
  const rows = hasHeader ? lines.slice(1) : lines;
  const cols = hasHeader
    ? header
    : ['first_name', 'last_name', 'email', 'phone', 'property_address'];
  return rows.map((row, idx) => {
    const parts = row.split(',').map(p => p.trim());
    const get = (key: string) => {
      const i = cols.indexOf(key);
      return i >= 0 ? parts[i] || '' : '';
    };
    return {
      id: `csv-${idx}`,
      firstName: get('first_name') || get('firstname') || parts[0] || '',
      lastName: get('last_name') || get('lastname') || parts[1] || '',
      email: get('email') || undefined,
      phone: get('phone') || undefined,
      propertyAddress: get('property_address') || get('address') || undefined,
    };
  });
}

export function AudienceStep({ value, onChange }: AudienceStepProps) {
  const [allBuyers, setAllBuyers] = useState<AudienceContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value.source !== 'buyers') return;
    let cancelled = false;
    setLoading(true);
    buyersApi.list({ limit: 500 }).then(res => {
      if (cancelled) return;
      const data = res.data as any;
      const list = Array.isArray(data) ? data : data?.buyers || [];
      const mapped = list.map(mapBuyerToContact);
      setAllBuyers(mapped);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setAllBuyers([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [value.source]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    allBuyers.forEach(b => (b.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [allBuyers]);

  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    allBuyers.forEach(b => { if (b.location) set.add(b.location); });
    return Array.from(set).sort();
  }, [allBuyers]);

  const filteredBuyers = useMemo(() => {
    return allBuyers.filter(c => {
      if (value.filters.tag && !(c.tags || []).includes(value.filters.tag)) return false;
      if (value.filters.location && c.location !== value.filters.location) return false;
      if (value.filters.hasEmail && !c.email) return false;
      return true;
    });
  }, [allBuyers, value.filters]);

  // Sync the selected contacts whenever the buyer filter result changes.
  useEffect(() => {
    if (value.source !== 'buyers') return;
    onChange({ ...value, contacts: filteredBuyers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBuyers, value.source]);

  const setSource = (source: AudienceSource) => {
    onChange({
      ...value,
      source,
      contacts: source === 'buyers' ? filteredBuyers : [],
      csvRaw: source === 'csv' ? value.csvRaw : undefined,
    });
  };

  const setFilters = (patch: Partial<AudienceFilters>) => {
    onChange({ ...value, filters: { ...value.filters, ...patch } });
  };

  const handleCsvChange = (raw: string) => {
    const parsed = parseCsv(raw);
    onChange({ ...value, csvRaw: raw, contacts: parsed });
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    handleCsvChange(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium">Audience source</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SOURCE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const active = value.source === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSource(opt.value)}
                className={`text-left rounded-lg border p-3 transition-all ${
                  active
                    ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {value.source === 'buyers' && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags:
              </span>
              <Badge
                variant={value.filters.tag === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilters({ tag: null })}
              >
                Any
              </Badge>
              {availableTags.map(t => (
                <Badge
                  key={t}
                  variant={value.filters.tag === t ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setFilters({ tag: t })}
                >
                  {t}
                </Badge>
              ))}
              {availableTags.length === 0 && (
                <span className="text-xs text-muted-foreground">No tags found</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location:
              </span>
              <Badge
                variant={value.filters.location === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilters({ location: null })}
              >
                Any
              </Badge>
              {availableLocations.map(loc => (
                <Badge
                  key={loc}
                  variant={value.filters.location === loc ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setFilters({ location: loc })}
                >
                  {loc}
                </Badge>
              ))}
              {availableLocations.length === 0 && (
                <span className="text-xs text-muted-foreground">No locations found</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={value.filters.hasEmail ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilters({ hasEmail: !value.filters.hasEmail })}
              >
                <Mail className="h-3 w-3 mr-1" /> Has email only
              </Badge>
            </div>

            <div className="text-sm">
              {loading ? (
                <span className="text-muted-foreground">Loading buyers...</span>
              ) : (
                <span>
                  <span className="font-semibold text-primary">{value.contacts.length}</span>
                  {' '}buyer{value.contacts.length === 1 ? '' : 's'} selected
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {value.source === 'agents' && (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-6 text-center space-y-2">
            <UserCheck className="h-8 w-8 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium">Agent list will populate here</p>
            <p className="text-xs text-muted-foreground">
              POST <code className="px-1 py-0.5 bg-muted rounded">/api/agents/backfill-from-listings</code> first to seed.
            </p>
          </CardContent>
        </Card>
      )}

      {value.source === 'csv' && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Upload CSV file</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Or paste CSV rows</Label>
              <Textarea
                value={value.csvRaw || ''}
                onChange={e => handleCsvChange(e.target.value)}
                placeholder={'first_name,last_name,email,phone,property_address\nJane,Doe,jane@example.com,5551234567,123 Main St'}
                className="min-h-[100px] font-mono text-xs"
              />
            </div>
            {value.contacts.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
                <p className="text-xs font-medium">
                  Parsed {value.contacts.length} contact{value.contacts.length === 1 ? '' : 's'}
                </p>
                <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                  {value.contacts.slice(0, 8).map(c => (
                    <div key={c.id}>
                      {c.firstName} {c.lastName}
                      {c.email ? ` · ${c.email}` : ''}
                      {c.propertyAddress ? ` · ${c.propertyAddress}` : ''}
                    </div>
                  ))}
                  {value.contacts.length > 8 && (
                    <div>+{value.contacts.length - 8} more</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
