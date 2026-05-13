import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Send, Sparkles, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { renderPreview, SAMPLE_FALLBACK, type AudienceContact, type CampaignContent, type CampaignSequenceStep } from './types';

interface ContentStepProps {
  value: CampaignContent;
  onChange: (next: CampaignContent) => void;
  sampleContact?: AudienceContact;
}

export function ContentStep({ value, onChange, sampleContact }: ContentStepProps) {
  const [testEmails, setTestEmails] = useState<Record<number, string>>({});
  const [testing, setTesting] = useState<Record<number, boolean>>({});

  const sample: AudienceContact = sampleContact && (sampleContact.email || sampleContact.firstName)
    ? sampleContact
    : SAMPLE_FALLBACK;

  const updateStep = (idx: number, patch: Partial<CampaignSequenceStep>) => {
    const steps = value.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, steps });
  };

  const handleTestSend = async (idx: number) => {
    const step = value.steps[idx];
    const to = testEmails[idx] || sample.email || '';
    if (!to) {
      toast.error('Add a test email address first');
      return;
    }
    setTesting((t) => ({ ...t, [idx]: true }));
    const payload = {
      to,
      subject: step.subject || `Test — step ${idx + 1}`,
      message_template: step.messageTemplate,
      variables: {
        first_name: sample.firstName,
        last_name: sample.lastName,
        seller_name: `${sample.firstName} ${sample.lastName}`.trim(),
        property_address: sample.propertyAddress || '',
        your_company: sample.company || 'AIWholesail',
      },
    };
    try {
      const res = await apiFetch<{ ok: boolean; message_id: string | null }>(
        '/api/campaigns/test-send',
        { method: 'POST', body: JSON.stringify(payload) }
      );
      if (res.error === 'Not found') {
        toast.message('Test-send unavailable', {
          description: 'Campaigns are dogfood-only — the test endpoint is disabled for this account.',
        });
        // eslint-disable-next-line no-console
        console.log('[ContentStep] test-send payload (flag off):', payload);
      } else if (res.error) {
        toast.error(res.error);
        // eslint-disable-next-line no-console
        console.log('[ContentStep] test-send error:', res.error, payload);
      } else {
        toast.success('Test email sent', {
          description: res.data?.message_id ? `Resend id: ${res.data.message_id}` : undefined,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ContentStep] test-send threw', err, payload);
      toast.error('Test send failed — see console.');
    } finally {
      setTesting((t) => ({ ...t, [idx]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Sender selector */}
      <div>
        <Label className="text-sm font-medium">From</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className={`cursor-pointer transition-all ${
              !value.sender.isCustomDomain
                ? 'border-primary/60 ring-1 ring-primary/30'
                : 'border-border/50'
            }`}
            onClick={() => onChange({
              ...value,
              sender: {
                fromAddress: 'AIWholesail <outreach@send.aiwholesail.com>',
                isCustomDomain: false,
              },
            })}
          >
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AIWholesail default</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                outreach@send.aiwholesail.com
              </p>
            </CardContent>
          </Card>
          <Card className="cursor-not-allowed border-dashed border-border/40 opacity-70">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Custom domain</span>
                <Badge variant="outline" className="text-[10px]">Pro add-on · $10/mo</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Send from your own domain. Upgrade to unlock.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {value.steps.length === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Pick a sequence in the previous step to edit content here.
          </CardContent>
        </Card>
      )}

      {value.steps.map((step, idx) => {
        const renderedSubject = renderPreview(step.subject || '', sample);
        const renderedBody = renderPreview(step.messageTemplate, sample);
        const Icon = step.channel === 'email' ? Mail : MessageSquare;
        return (
          <Card key={idx} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Step {idx + 1}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {step.channel === 'email' ? 'Email' : 'SMS'} · day {step.dayOffset}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Editor */}
                <div className="space-y-2">
                  {step.channel === 'email' && (
                    <div>
                      <Label className="text-xs">Subject</Label>
                      <Input
                        value={step.subject || ''}
                        onChange={(e) => updateStep(idx, { subject: e.target.value })}
                        placeholder="Quick question about {property_address}"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={step.messageTemplate}
                      onChange={(e) => updateStep(idx, { messageTemplate: e.target.value })}
                      placeholder="Hi {first_name}, ..."
                      className="min-h-[140px] text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder={sample.email || 'test@example.com'}
                      value={testEmails[idx] || ''}
                      onChange={(e) => setTestEmails((m) => ({ ...m, [idx]: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestSend(idx)}
                      disabled={!!testing[idx]}
                      className="gap-1"
                    >
                      <Send className="h-3 w-3" />
                      {testing[idx] ? 'Sending…' : 'Test send'}
                    </Button>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Preview · {sample.firstName} {sample.lastName}
                  </div>
                  {step.channel === 'email' && renderedSubject && (
                    <div className="text-sm font-medium">{renderedSubject}</div>
                  )}
                  <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90">
                    {renderedBody || '(empty)'}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
