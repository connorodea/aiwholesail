import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Mail, MessageSquare, Plus, Trash2, Clock } from 'lucide-react';
import { sequences as seqApi } from '@/lib/api-client';
import type { CampaignSequence, CampaignSequenceStep } from './types';

interface SequenceStepProps {
  value: CampaignSequence;
  onChange: (next: CampaignSequence) => void;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  steps: CampaignSequenceStep[];
}

function mapTemplate(raw: any): TemplateOption {
  const steps: CampaignSequenceStep[] = (raw.steps || []).map((s: any, i: number) => ({
    stepOrder: s.step_order ?? s.stepOrder ?? i + 1,
    dayOffset: s.day_offset ?? s.dayOffset ?? 0,
    channel: (s.channel || 'sms') as 'sms' | 'email',
    subject: s.subject || undefined,
    messageTemplate: s.message_template || s.messageTemplate || '',
  }));
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description || '',
    steps,
  };
}

export function SequenceStep({ value, onChange }: SequenceStepProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    seqApi.listTemplates().then(res => {
      if (cancelled) return;
      const data = res.data as any;
      const list = Array.isArray(data) ? data : data?.templates || [];
      setTemplates(list.map(mapTemplate));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setTemplates([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const pickTemplate = (tpl: TemplateOption) => {
    onChange({
      mode: 'template',
      templateId: tpl.id,
      templateName: tpl.name,
      steps: tpl.steps,
    });
  };

  const setMode = (mode: 'template' | 'inline') => {
    if (mode === 'inline' && value.steps.length === 0) {
      onChange({
        mode,
        templateId: undefined,
        templateName: undefined,
        steps: [{ stepOrder: 1, dayOffset: 0, channel: 'email', subject: '', messageTemplate: '' }],
      });
    } else {
      onChange({ ...value, mode });
    }
  };

  const updateInlineStep = (idx: number, patch: Partial<CampaignSequenceStep>) => {
    const steps = value.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, steps });
  };

  const addInlineStep = () => {
    const last = value.steps[value.steps.length - 1];
    const nextOffset = (last?.dayOffset ?? -3) + 3;
    onChange({
      ...value,
      steps: [
        ...value.steps,
        {
          stepOrder: value.steps.length + 1,
          dayOffset: nextOffset,
          channel: 'email',
          subject: '',
          messageTemplate: '',
        },
      ],
    });
  };

  const removeInlineStep = (idx: number) => {
    if (value.steps.length <= 1) return;
    const steps = value.steps
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, stepOrder: i + 1 }));
    onChange({ ...value, steps });
  };

  return (
    <Tabs value={value.mode} onValueChange={v => setMode(v as 'template' | 'inline')} className="space-y-4">
      <TabsList>
        <TabsTrigger value="template">Pick template</TabsTrigger>
        <TabsTrigger value="inline">Build inline</TabsTrigger>
      </TabsList>

      <TabsContent value="template" className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading templates...</p>}
        {!loading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No templates yet. Switch to "Build inline" to create one for this campaign.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(tpl => {
            const active = value.templateId === tpl.id;
            return (
              <Card
                key={tpl.id}
                onClick={() => pickTemplate(tpl)}
                className={`cursor-pointer transition-all ${
                  active
                    ? 'border-primary/60 ring-1 ring-primary/30'
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{tpl.name}</div>
                    <Badge variant="outline" className="text-[10px]">
                      {tpl.steps.length} step{tpl.steps.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {tpl.steps.some(s => s.channel === 'email') && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                    )}
                    {tpl.steps.some(s => s.channel === 'sms') && (
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> SMS</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tpl.steps.length > 0 ? Math.max(...tpl.steps.map(s => s.dayOffset)) : 0}d
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="inline" className="space-y-3">
        {value.steps.map((step, idx) => (
          <Card key={idx} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">Step {idx + 1}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeInlineStep(idx)}
                  disabled={value.steps.length <= 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Day offset</Label>
                  <Input
                    type="number"
                    min={0}
                    value={step.dayOffset}
                    onChange={e => updateInlineStep(idx, { dayOffset: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Channel</Label>
                  <Select
                    value={step.channel}
                    onValueChange={v => updateInlineStep(idx, { channel: v as 'sms' | 'email' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {step.channel === 'email' && (
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={step.subject || ''}
                    onChange={e => updateInlineStep(idx, { subject: e.target.value })}
                    placeholder="Quick question about {property_address}"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Message template</Label>
                <Textarea
                  value={step.messageTemplate}
                  onChange={e => updateInlineStep(idx, { messageTemplate: e.target.value })}
                  placeholder="Hi {first_name}, ..."
                  className="min-h-[80px] text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" className="w-full gap-2" onClick={addInlineStep}>
          <Plus className="h-4 w-4" /> Add step
        </Button>
      </TabsContent>
    </Tabs>
  );
}
