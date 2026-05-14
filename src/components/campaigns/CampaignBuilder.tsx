import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Rocket, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { AudienceStep } from './AudienceStep';
import { SequenceStep } from './SequenceStep';
import { ContentStep } from './ContentStep';
import { ScheduleStep } from './ScheduleStep';
import { DEFAULT_DRAFT, type CampaignDraft } from './types';

interface CampaignBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunched: () => void;
}

const STEPS: Array<{ key: 'name' | 'audience' | 'sequence' | 'content' | 'schedule'; label: string }> = [
  { key: 'audience', label: 'Audience' },
  { key: 'sequence', label: 'Sequence' },
  { key: 'content', label: 'Content' },
  { key: 'schedule', label: 'Schedule' },
];

export function CampaignBuilder({ open, onOpenChange, onLaunched }: CampaignBuilderProps) {
  const [draft, setDraft] = useState<CampaignDraft>(() => ({ ...DEFAULT_DRAFT }));
  const [stepIndex, setStepIndex] = useState(0);
  const [launching, setLaunching] = useState(false);

  const reset = () => {
    setDraft({ ...DEFAULT_DRAFT });
    setStepIndex(0);
  };

  const canAdvance = useMemo(() => {
    const step = STEPS[stepIndex];
    if (step.key === 'audience') {
      return draft.name.trim().length > 0 && draft.audience.contacts.length > 0;
    }
    if (step.key === 'sequence') {
      return draft.sequence.steps.length > 0;
    }
    if (step.key === 'content') {
      return draft.content.steps.length > 0
        && draft.content.steps.every((s) => s.messageTemplate.trim().length > 0);
    }
    return true;
  }, [stepIndex, draft]);

  // Mirror sequence steps into content steps when the sequence first lands —
  // ContentStep edits a separate copy so subject/body tweaks don't fight
  // the template selection.
  const syncContentFromSequence = () => {
    if (draft.content.steps.length === 0 && draft.sequence.steps.length > 0) {
      setDraft((d) => ({
        ...d,
        content: { ...d.content, steps: d.sequence.steps.map((s) => ({ ...s })) },
      }));
    }
  };

  const handleNext = () => {
    if (STEPS[stepIndex].key === 'sequence') {
      syncContentFromSequence();
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handleBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const buildPayload = () => {
    const audience_type = draft.audience.source;
    let audience_filter: Record<string, unknown> = {};
    if (audience_type === 'buyers') {
      audience_filter = {
        tag: draft.audience.filters.tag || undefined,
        location: draft.audience.filters.location || undefined,
        has_email: draft.audience.filters.hasEmail || undefined,
      };
    } else if (audience_type === 'agents') {
      audience_filter = {
        tag: draft.audience.filters.tag || undefined,
        location: draft.audience.filters.location || undefined,
      };
    } else if (audience_type === 'csv') {
      audience_filter = {
        csv_rows: draft.audience.contacts.map((c) => ({
          first_name: c.firstName,
          last_name: c.lastName,
          email: c.email,
          phone: c.phone,
          property_address: c.propertyAddress,
        })),
      };
    }

    const startAt = draft.schedule.start === 'scheduled' && draft.schedule.scheduledAt
      ? new Date(draft.schedule.scheduledAt).toISOString()
      : new Date().toISOString();

    return {
      name: draft.name.trim() || 'Untitled campaign',
      audience_type,
      audience_filter,
      sequence_template_id: draft.sequence.templateId,
      sender_category: 'outreach',
      send_window_start_hour: draft.schedule.startHour,
      send_window_end_hour: draft.schedule.endHour,
      send_window_days: draft.schedule.daysOfWeek,
      daily_cap: draft.schedule.dailyCap,
      start_at: startAt,
    };
  };

  const handleLaunch = async () => {
    setLaunching(true);
    const payload = buildPayload();

    try {
      const createRes = await apiFetch<{ campaign: { id: string } }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (createRes.error || !createRes.data?.campaign?.id) {
        // 404 = flag off. Friendly toast + console.log the payload so the
        // operator can still see what would have been sent.
        if (createRes.error === 'Not found') {
          toast.message('Campaigns are dogfood-only right now', {
            description: 'Your campaign was not saved — feature flag is disabled for this account.',
          });
          // eslint-disable-next-line no-console
          console.log('[CampaignBuilder] payload (flag off):', payload);
        } else {
          toast.error(createRes.error || 'Could not create campaign');
          // eslint-disable-next-line no-console
          console.log('[CampaignBuilder] payload (error):', payload, createRes);
        }
        setLaunching(false);
        return;
      }

      const campaignId = createRes.data.campaign.id;
      const launchRes = await apiFetch<{ ok: boolean; stats: Record<string, number> }>(
        `/api/campaigns/${campaignId}/launch`,
        { method: 'POST', body: JSON.stringify({}) }
      );

      if (launchRes.error) {
        toast.error(launchRes.error);
        setLaunching(false);
        return;
      }

      toast.success('Campaign launched', {
        description: launchRes.data?.stats
          ? `${launchRes.data.stats.targets_inserted ?? 0} targets queued`
          : undefined,
      });
      reset();
      onLaunched();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[CampaignBuilder] launch failed', err, payload);
      toast.error('Could not launch campaign — see console for details.');
    } finally {
      setLaunching(false);
    }
  };

  const currentStepKey = STEPS[stepIndex].key;
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Outreach Campaign</DialogTitle>
          <DialogDescription>
            Bulk-send a sequence to buyers, agents, or a CSV import.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-1 mb-4">
          {STEPS.map((s, i) => {
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-medium border ${
                    done
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : active
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-neutral-800/40 border-neutral-700 text-neutral-500'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`text-xs ${active ? 'text-white' : 'text-neutral-500'}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-white/[0.05] mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="space-y-4">
          {currentStepKey === 'audience' && (
            <>
              <div>
                <Label className="text-sm">Campaign name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Q4 absentee owner outreach"
                />
              </div>
              <AudienceStep
                value={draft.audience}
                onChange={(audience) => setDraft((d) => ({ ...d, audience }))}
              />
            </>
          )}

          {currentStepKey === 'sequence' && (
            <SequenceStep
              value={draft.sequence}
              onChange={(sequence) => setDraft((d) => ({ ...d, sequence }))}
            />
          )}

          {currentStepKey === 'content' && (
            <ContentStep
              value={draft.content}
              onChange={(content) => setDraft((d) => ({ ...d, content }))}
              sampleContact={draft.audience.contacts[0]}
            />
          )}

          {currentStepKey === 'schedule' && (
            <ScheduleStep
              value={draft.schedule}
              onChange={(schedule) => setDraft((d) => ({ ...d, schedule }))}
              audienceSize={draft.audience.contacts.length}
              sequenceStepCount={draft.sequence.steps.length}
              maxDayOffset={draft.sequence.steps.length > 0
                ? Math.max(...draft.sequence.steps.map((s) => s.dayOffset))
                : 0}
              onLaunch={handleLaunch}
              launching={launching}
            />
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.05]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={stepIndex === 0 || launching}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {!isLastStep && (
            <Button
              onClick={handleNext}
              disabled={!canAdvance || launching}
              className="gap-1"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {isLastStep && (
            <Button
              onClick={handleLaunch}
              disabled={launching || draft.audience.contacts.length === 0}
              className="gap-1"
            >
              <Rocket className="h-4 w-4" />
              {launching ? 'Launching…' : 'Launch campaign'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
