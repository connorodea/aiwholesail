import { useEffect, useState, useCallback } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { refreshFeatureFlags } from '@/hooks/useFeatureFlag';
import { useNavigate } from 'react-router-dom';
import { Flag, ToggleLeft, ToggleRight, RefreshCw, Trash2, UserPlus, ArrowLeft } from 'lucide-react';

/**
 * Admin page for feature flags. Lists every global + every per-user
 * override. Lets an admin (per ADMIN_EMAILS env var) flip flags
 * without psql.
 *
 * The /api/flags/admin endpoints already enforce the email allowlist
 * server-side; this page just gives an admin a UI. Non-admins who
 * reach the URL see the same 403 the API returns.
 */

interface GlobalFlag {
  slug: string;
  enabled: boolean;
  rollout_pct: number;
  description?: string;
  updated_at?: string;
}

interface UserOverride {
  user_id: string;
  email: string;
  slug: string;
  enabled: boolean;
  reason?: string;
  created_at?: string;
}

interface AdminPayload {
  globals: GlobalFlag[];
  overrides: UserOverride[];
}

export default function AdminFlags() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [newOverride, setNewOverride] = useState<{ [slug: string]: { email: string; enabled: boolean } }>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdminPayload>('/api/flags/admin');
    if (res.error) {
      if (res.error.toLowerCase().includes('admin')) setForbidden(true);
      else toast({ title: 'Failed to load flags', description: res.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setPayload(res.data ?? { globals: [], overrides: [] });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateGlobal = async (slug: string, patch: Partial<Pick<GlobalFlag, 'enabled' | 'rollout_pct' | 'description'>>) => {
    const res = await apiFetch(`/api/flags/admin/global/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (res.error) {
      toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
      return;
    }
    await refreshFeatureFlags();
    refresh();
  };

  const upsertOverride = async (userId: string, slug: string, enabled: boolean, reason?: string) => {
    const res = await apiFetch(`/api/flags/admin/user/${encodeURIComponent(userId)}/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled, reason }),
    });
    if (res.error) {
      toast({ title: 'Override failed', description: res.error, variant: 'destructive' });
      return;
    }
    await refreshFeatureFlags();
    refresh();
  };

  const deleteOverride = async (userId: string, slug: string) => {
    if (!confirm(`Remove override for this user on "${slug}"?`)) return;
    const res = await apiFetch(`/api/flags/admin/user/${encodeURIComponent(userId)}/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      return;
    }
    await refreshFeatureFlags();
    refresh();
  };

  // Look up a userId by email via the simplest available primitive: query the
  // overrides table for a row with this email. If none exists yet we need to
  // call a server-side lookup. For now, the user-id form expects raw UUID.
  // Future enhancement: add /api/admin/users/by-email.
  const handleAddOverride = async (slug: string) => {
    const state = newOverride[slug];
    if (!state?.email?.trim()) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }
    // For now use the email-as-userId path via the lookup function — but our
    // PUT endpoint requires UUID. So check if existing overrides reveal it.
    const existing = payload?.overrides.find(
      (o) => o.email.toLowerCase() === state.email.trim().toLowerCase()
    );
    if (existing) {
      await upsertOverride(existing.user_id, slug, state.enabled, 'admin-ui');
      setNewOverride((prev) => ({ ...prev, [slug]: { email: '', enabled: state.enabled } }));
      return;
    }
    // Fall back to a /api/auth/lookup-style endpoint via the email itself —
    // our PUT requires UUID. If we can't find the user, surface a clear error.
    toast({
      title: 'User not found in existing overrides',
      description: 'Until /api/admin/users/by-email lands, add the first override via SQL, then this UI can manage the rest.',
      variant: 'destructive',
    });
  };

  if (forbidden) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <DashboardNav />
        <main className="container mx-auto pt-24 pb-16 max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <h1 className="text-2xl font-semibold">Admin only</h1>
              <p className="text-muted-foreground">
                Signed in as <code>{user?.email}</code>. This page is gated by the
                <code className="mx-1">ADMIN_EMAILS</code> backend env var.
              </p>
              <Button variant="outline" onClick={() => navigate('/app')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to app
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNav />
      <main className="container mx-auto pt-24 pb-16 space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
              <Flag className="h-6 w-6 text-cyan-400" /> Feature Flags
            </h1>
            <p className="text-sm text-muted-foreground">
              Toggle features per-user or globally. Changes propagate within 60 seconds (per-user) or instantly (after refresh).
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </header>

        {loading && !payload ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : (
          <ErrorBoundary label="AdminFlags">
            <div className="space-y-6">
              {(payload?.globals ?? []).length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No flags registered yet. Create one via the API:<br />
                    <code className="text-xs">PUT /api/flags/admin/global/your-slug — body: {`{"enabled":false,"description":"..."}`}</code>
                  </CardContent>
                </Card>
              )}

              {(payload?.globals ?? []).map((g) => {
                const overrides = (payload?.overrides ?? []).filter((o) => o.slug === g.slug);
                const draftOverride = newOverride[g.slug] ?? { email: '', enabled: true };
                return (
                  <Card key={g.slug} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-mono">{g.slug}</CardTitle>
                          {g.description && (
                            <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={g.enabled ? 'default' : 'outline'}>
                            {g.enabled ? 'ENABLED' : 'DISABLED'}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-xs">
                            rollout {g.rollout_pct}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-end gap-3 pb-3 border-b border-border/40">
                        <Button
                          size="sm"
                          variant={g.enabled ? 'default' : 'outline'}
                          onClick={() => updateGlobal(g.slug, { enabled: !g.enabled })}
                        >
                          {g.enabled ? <ToggleRight className="h-4 w-4 mr-2" /> : <ToggleLeft className="h-4 w-4 mr-2" />}
                          {g.enabled ? 'Disable globally' : 'Enable globally'}
                        </Button>
                        <div className="space-y-1">
                          <Label htmlFor={`pct-${g.slug}`} className="text-xs">Rollout %</Label>
                          <Input
                            id={`pct-${g.slug}`}
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={g.rollout_pct}
                            className="w-24 h-9 text-sm"
                            onBlur={(e) => {
                              const v = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                              if (v !== g.rollout_pct) updateGlobal(g.slug, { rollout_pct: v });
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Per-user overrides</h4>
                        {overrides.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No overrides — flag resolves from global config above.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {overrides.map((o) => (
                              <div key={`${o.user_id}-${o.slug}`} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30">
                                <div className="min-w-0">
                                  <div className="text-sm truncate">{o.email}</div>
                                  {o.reason && <div className="text-xs text-muted-foreground truncate">{o.reason}</div>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant={o.enabled ? 'default' : 'outline'}
                                    onClick={() => upsertOverride(o.user_id, g.slug, !o.enabled, o.reason || 'admin-ui')}
                                  >
                                    {o.enabled ? 'ON' : 'OFF'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteOverride(o.user_id, g.slug)}
                                    title="Remove override (user falls back to global config)"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-end gap-2 pt-2">
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={`add-${g.slug}`} className="text-xs">Add override (user email — must already exist on a flag)</Label>
                            <Input
                              id={`add-${g.slug}`}
                              type="email"
                              placeholder="user@example.com"
                              value={draftOverride.email}
                              onChange={(e) => setNewOverride((prev) => ({ ...prev, [g.slug]: { ...draftOverride, email: e.target.value } }))}
                              className="h-9 text-sm"
                            />
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleAddOverride(g.slug)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Enable for user
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
