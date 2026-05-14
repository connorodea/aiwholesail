import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Rocket, Calendar, Clock, Gauge, FlaskConical } from 'lucide-react';
import type { CampaignSchedule } from './types';

interface ScheduleStepProps {
  value: CampaignSchedule;
  onChange: (next: CampaignSchedule) => void;
  audienceSize: number;
  sequenceStepCount: number;
  maxDayOffset: number;
  onLaunch: () => void;
  launching: boolean;
}

const DAYS = [
  { v: 0, label: 'S' },
  { v: 1, label: 'M' },
  { v: 2, label: 'T' },
  { v: 3, label: 'W' },
  { v: 4, label: 'T' },
  { v: 5, label: 'F' },
  { v: 6, label: 'S' },
];

export function ScheduleStep({
  value, onChange, audienceSize, sequenceStepCount, maxDayOffset, onLaunch, launching,
}: ScheduleStepProps) {
  const toggleDay = (d: number) => {
    const set = new Set(value.daysOfWeek);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({ ...value, daysOfWeek: Array.from(set).sort((a, b) => a - b) });
  };

  const setHour = (key: 'startHour' | 'endHour', raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 23) {
      onChange({ ...value, [key]: n });
    }
  };

  const setDailyCap = (raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 10000) {
      onChange({ ...value, dailyCap: n });
    }
  };

  const setVariantName = (idx: number, name: string) => {
    const variants = value.variants.map((v, i) => (i === idx ? name : v));
    onChange({ ...value, variants });
  };

  const addVariant = () => {
    if (value.variants.length >= 4) return;
    const next = String.fromCharCode(65 + value.variants.length); // 'A'+n
    onChange({ ...value, variants: [...value.variants, next] });
  };

  const removeVariant = (idx: number) => {
    if (value.variants.length <= 1) return;
    onChange({ ...value, variants: value.variants.filter((_, i) => i !== idx) });
  };

  // Estimated days = ceil(audience / dailyCap) - 1 + maxDayOffset, with floors.
  const daysToFinish = (() => {
    if (audienceSize === 0 || sequenceStepCount === 0) return 0;
    const cap = value.dailyCap > 0 ? value.dailyCap : audienceSize;
    const seedDays = Math.max(1, Math.ceil(audienceSize / cap));
    return seedDays + maxDayOffset;
  })();

  return (
    <div className="space-y-6">
      {/* Days of week */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Send days
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const active = value.daysOfWeek.includes(d.v);
            return (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDay(d.v)}
                className={`h-9 w-9 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-primary/20 border-primary/40 text-primary'
                    : 'bg-neutral-800/30 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Default Mon–Fri. Sundays = position 0, Saturdays = position 6.
        </p>
      </div>

      {/* Hour window */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Send window (sender local time)
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Start hour</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={value.startHour}
              onChange={(e) => setHour('startHour', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">End hour (exclusive)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={value.endHour}
              onChange={(e) => setHour('endHour', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Daily cap */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" /> Daily cap
        </Label>
        <Input
          type="number"
          min={1}
          max={10000}
          value={value.dailyCap}
          onChange={(e) => setDailyCap(e.target.value)}
          className="mt-2 max-w-xs"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Roughly how many recipients enter the sequence each day. Default 40 for cold outreach.
        </p>
      </div>

      {/* Start mode */}
      <div>
        <Label className="text-sm font-medium">Start</Label>
        <RadioGroup
          className="mt-2 space-y-2"
          value={value.start}
          onValueChange={(v) => onChange({ ...value, start: v as 'now' | 'scheduled' })}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="now" id="start-now" />
            <Label htmlFor="start-now" className="text-sm font-normal">Send now</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="scheduled" id="start-scheduled" />
            <Label htmlFor="start-scheduled" className="text-sm font-normal">Schedule for</Label>
            {value.start === 'scheduled' && (
              <Input
                type="datetime-local"
                value={value.scheduledAt || ''}
                onChange={(e) => onChange({ ...value, scheduledAt: e.target.value })}
                className="h-8 max-w-xs"
              />
            )}
          </div>
        </RadioGroup>
      </div>

      {/* A/B variants */}
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="ab-enabled"
            checked={value.abEnabled}
            onCheckedChange={(checked) => onChange({ ...value, abEnabled: Boolean(checked) })}
          />
          <Label htmlFor="ab-enabled" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
            <FlaskConical className="h-4 w-4 text-primary" /> Enable A/B variants
          </Label>
        </div>
        {value.abEnabled && (
          <Card className="border-border/50 mt-3">
            <CardContent className="p-3 space-y-2">
              {value.variants.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Variant {idx + 1}</Badge>
                  <Input
                    value={name}
                    onChange={(e) => setVariantName(idx, e.target.value)}
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariant(idx)}
                    disabled={value.variants.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariant}
                disabled={value.variants.length >= 4}
              >
                Add variant
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Variants are stub UI right now — content split happens server-side in a future patch.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-primary/80">Summary</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Audience</div>
              <div className="font-medium">{audienceSize}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Steps</div>
              <div className="font-medium">{sequenceStepCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Daily cap</div>
              <div className="font-medium">{value.dailyCap}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Est. days</div>
              <div className="font-medium">{daysToFinish}</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estimate = ceil(audience / cap) + longest day-offset of any step. Send-window pauses
            (off days / off hours) can push the actual finish later.
          </p>
        </CardContent>
      </Card>

      {/* Launch */}
      <div className="flex justify-end">
        <Button
          onClick={onLaunch}
          disabled={launching || audienceSize === 0 || sequenceStepCount === 0}
          size="lg"
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          {launching ? 'Launching…' : 'Launch Campaign'}
        </Button>
      </div>
    </div>
  );
}
