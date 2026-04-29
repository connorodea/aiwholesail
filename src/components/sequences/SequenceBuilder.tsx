import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Mail, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import { SequenceStep, SEQUENCE_CATEGORIES, TEMPLATE_VARIABLES } from '@/types/sequences';

interface SequenceBuilderProps {
  onSave: (data: {
    name: string;
    description?: string;
    category: string;
    steps: Omit<SequenceStep, 'id'>[];
  }) => Promise<boolean>;
  onCancel: () => void;
}

export function SequenceBuilder({ onSave, onCancel }: SequenceBuilderProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [steps, setSteps] = useState<Omit<SequenceStep, 'id'>[]>([
    { stepOrder: 1, dayOffset: 0, channel: 'sms', messageTemplate: '' },
  ]);
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);

  const addStep = () => {
    const lastOffset = steps.length > 0 ? steps[steps.length - 1].dayOffset : 0;
    setSteps([
      ...steps,
      {
        stepOrder: steps.length + 1,
        dayOffset: lastOffset + 3,
        channel: 'sms',
        messageTemplate: '',
      },
    ]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i + 1 })));
  };

  const updateStep = (idx: number, updates: Partial<Omit<SequenceStep, 'id'>>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
  };

  const moveStep = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
    setSteps(newSteps.map((s, i) => ({ ...s, stepOrder: i + 1 })));
  };

  const insertVariable = (variable: string) => {
    if (activeStepIdx === null) return;
    const step = steps[activeStepIdx];
    updateStep(activeStepIdx, {
      messageTemplate: step.messageTemplate + variable,
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (steps.some(s => !s.messageTemplate.trim())) return;
    setSaving(true);
    const success = await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      steps,
    });
    setSaving(false);
    if (success) onCancel();
  };

  return (
    <div className="space-y-6">
      {/* Template Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Template Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Initial Seller Outreach" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEQUENCE_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this sequence" />
      </div>

      {/* Variable Helper */}
      <div>
        <Label className="text-xs text-muted-foreground">Insert variable (click a step's message first)</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {TEMPLATE_VARIABLES.map(v => (
            <Badge
              key={v.key}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 text-xs"
              onClick={() => insertVariable(v.key)}
            >
              {v.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <Label>Steps</Label>
        {steps.map((step, idx) => (
          <Card key={idx} className={`border-border/50 ${activeStepIdx === idx ? 'ring-1 ring-primary/30' : ''}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Step {step.stepOrder}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Day {step.dayOffset}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(idx, 'up')} disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(idx, 'down')} disabled={idx === steps.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStep(idx)} disabled={steps.length <= 1}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Day Offset</Label>
                  <Input
                    type="number"
                    min={0}
                    value={step.dayOffset}
                    onChange={e => updateStep(idx, { dayOffset: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Channel</Label>
                  <Select value={step.channel} onValueChange={val => updateStep(idx, { channel: val as 'sms' | 'email' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">
                        <span className="flex items-center gap-2"><MessageSquare className="h-3 w-3" /> SMS</span>
                      </SelectItem>
                      <SelectItem value="email">
                        <span className="flex items-center gap-2"><Mail className="h-3 w-3" /> Email</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {step.channel === 'email' && (
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={step.subject || ''}
                    onChange={e => updateStep(idx, { subject: e.target.value })}
                    placeholder="Email subject line"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={step.messageTemplate}
                  onChange={e => updateStep(idx, { messageTemplate: e.target.value })}
                  onFocus={() => setActiveStepIdx(idx)}
                  placeholder={step.channel === 'sms'
                    ? "Hi {seller_name}, I noticed your property at {property_address}..."
                    : "Dear {seller_name},\n\nI'm reaching out regarding your property at {property_address}..."}
                  className="min-h-[80px] resize-none text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full gap-2" onClick={addStep}>
          <Plus className="h-4 w-4" /> Add Step
        </Button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || steps.some(s => !s.messageTemplate.trim())}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Template
        </Button>
      </div>
    </div>
  );
}
