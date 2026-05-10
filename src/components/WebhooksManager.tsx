import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  webhooks,
  type WebhookEndpoint,
  type WebhookEventType,
} from '@/lib/api-client';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Webhook, Plus, Trash2, Send, AlertTriangle, CheckCircle2, Copy, Sparkles, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const EVENT_LABELS: Record<WebhookEventType, { label: string; description: string; live: boolean }> = {
  property_alert_match: {
    label: 'Property alert match',
    description: 'Fires when a property matches one of your saved alerts.',
    live: true,
  },
  price_change: {
    label: 'Price change',
    description: 'Fires when a tracked property has a price update. (Coming soon)',
    live: false,
  },
  status_change: {
    label: 'Status change',
    description: 'Fires when a property goes pending, sold, or back on market. (Coming soon)',
    live: false,
  },
  owner_update: {
    label: 'Owner update',
    description: 'Fires when skip-trace records change for a saved property. (Coming soon)',
    live: false,
  },
};

export function WebhooksManager() {
  const { isPro, isElite } = useSubscription();
  const allowed = isPro || isElite;

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState<{ endpoint: WebhookEndpoint } | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const r = await webhooks.list();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setEndpoints(r.data?.endpoints || []);
      setLimit(r.data?.limit ?? null);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!allowed) {
    return (
      <Card className="border-cyan-500/30 max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" /> Webhooks are a Pro / Elite feature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Push property and owner updates to your CRM, workflow tool, or custom app the moment they happen.
            Pro includes 3 endpoints; Elite is unlimited.
          </p>
          <Button asChild><Link to="/pricing">View plans</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4 text-cyan-400" />
              Webhooks
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Subscribe your app, CRM, or workflow to property and owner updates. Each delivery is signed with HMAC-SHA256 in the
              <code className="mx-1 px-1 py-0.5 rounded bg-foreground/[0.06] text-foreground text-[10px]">X-AIWholesail-Signature</code>
              header. {limit ? `Pro limit: ${limit} endpoints. ` : 'Unlimited endpoints (Elite). '}
              {endpoints.length} active.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            disabled={limit !== null && endpoints.length >= limit}
            className="gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add webhook
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && endpoints.length === 0 && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {!loading && endpoints.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No webhooks yet. Add one to start receiving property updates.
            </p>
          )}
          {endpoints.map((ep) => (
            <EndpointRow key={ep.id} endpoint={ep} onChange={refresh} />
          ))}
        </CardContent>
      </Card>

      <CreateWebhookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ep) => {
          setCreateOpen(false);
          setSecretOpen({ endpoint: ep });
          refresh();
        }}
      />

      <SecretRevealDialog
        endpoint={secretOpen?.endpoint || null}
        onClose={() => setSecretOpen(null)}
      />
    </div>
  );
}

function EndpointRow({ endpoint, onChange }: { endpoint: WebhookEndpoint; onChange: () => void }) {
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await webhooks.test(endpoint.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.data?.ok) {
        toast.success(`Test delivered (${r.data.status}, ${r.data.durationMs}ms)`);
      } else {
        toast.error(r.data?.message || 'Test failed', {
          description: `HTTP ${r.data?.status} · ${r.data?.durationMs}ms`,
        });
      }
      onChange();
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async () => {
    const r = await webhooks.update(endpoint.id, { active: !endpoint.active });
    if (r.error) toast.error(r.error);
    else onChange();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete webhook to ${endpoint.url}?`)) return;
    const r = await webhooks.remove(endpoint.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success('Webhook removed');
      onChange();
    }
  };

  const status = endpoint.active
    ? endpoint.consecutiveFailures >= 5
      ? 'unhealthy'
      : 'active'
    : 'paused';

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono truncate text-foreground">{endpoint.url}</code>
            {status === 'active' && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-2.5 w-2.5" /> Active
              </Badge>
            )}
            {status === 'unhealthy' && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30">
                <AlertTriangle className="h-2.5 w-2.5" /> {endpoint.consecutiveFailures} failures
              </Badge>
            )}
            {status === 'paused' && (
              <Badge variant="outline" className="text-[10px]">Paused</Badge>
            )}
          </div>
          {endpoint.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{endpoint.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {endpoint.events.map((e) => (
              <Badge key={e} variant="outline" className="text-[9px]">
                {EVENT_LABELS[e]?.label || e}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button onClick={handleTest} disabled={testing} size="sm" variant="outline" className="gap-1 text-xs">
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Test
          </Button>
          <Button onClick={handleToggleActive} size="sm" variant="ghost" className="text-xs">
            {endpoint.active ? 'Pause' : 'Resume'}
          </Button>
          <Button onClick={handleDelete} size="icon" variant="ghost" className="h-8 w-8 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (endpoint: WebhookEndpoint) => void;
}

function CreateWebhookDialog({ open, onOpenChange, onCreated }: CreateDialogProps) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>(['property_alert_match']);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = url.trim().length > 0 && events.length > 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await webhooks.create({
        url: url.trim(),
        events,
        description: description.trim() || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.data?.endpoint) {
        toast.success('Webhook created');
        onCreated(r.data.endpoint);
        setUrl('');
        setDescription('');
        setEvents(['property_alert_match']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add webhook</DialogTitle>
          <DialogDescription>
            We&apos;ll POST a signed JSON payload to your URL when subscribed events happen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">URL *</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/aiwholesail"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Must be HTTPS in production. We send a POST with a JSON body and an
              <code className="mx-1 px-1 py-0.5 rounded bg-foreground/[0.06]">X-AIWholesail-Signature</code> header for HMAC verification.
            </p>
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="HubSpot integration / Make.com / etc."
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Events</Label>
            {(Object.keys(EVENT_LABELS) as WebhookEventType[]).map((e) => {
              const meta = EVENT_LABELS[e];
              const checked = events.includes(e);
              return (
                <label
                  key={e}
                  className={`flex items-start gap-3 p-2.5 rounded-md border transition-colors ${
                    meta.live
                      ? checked
                        ? 'border-cyan-500/40 bg-cyan-500/[0.04] cursor-pointer'
                        : 'border-border/50 hover:border-border cursor-pointer'
                      : 'border-border/30 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!meta.live}
                    onCheckedChange={(v) => {
                      if (!meta.live) return;
                      setEvents((prev) => v ? [...prev, e] : prev.filter((x) => x !== e));
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {meta.label}
                      {!meta.live && <Badge variant="outline" className="text-[9px]">soon</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create webhook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecretRevealDialog({ endpoint, onClose }: { endpoint: WebhookEndpoint | null; onClose: () => void }) {
  if (!endpoint?.secret) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(endpoint.secret || '');
    toast.success('Secret copied to clipboard');
  };

  return (
    <Dialog open={!!endpoint} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Webhook created — save this secret
          </DialogTitle>
          <DialogDescription>
            Use this secret to verify the HMAC signature on every webhook delivery. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-foreground/[0.04] border border-border/60 rounded-md p-3 font-mono text-xs break-all">
            {endpoint.secret}
          </div>
          <Button onClick={handleCopy} variant="outline" className="gap-2 w-full">
            <Copy className="h-3.5 w-3.5" /> Copy secret
          </Button>
          <div className="text-[11px] text-muted-foreground space-y-1.5 pt-2 border-t border-border/50">
            <p className="font-medium text-foreground">Verify on your end:</p>
            <pre className="text-[10px] bg-foreground/[0.04] p-2 rounded overflow-x-auto">{`const expected = crypto
  .createHmac('sha256', SECRET)
  .update(rawBody)
  .digest('hex');
// Compare against req.headers['x-aiwholesail-signature']
// which arrives as: sha256=<hex>`}</pre>
          </div>
          <Button onClick={onClose} className="w-full">I&apos;ve saved the secret</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
