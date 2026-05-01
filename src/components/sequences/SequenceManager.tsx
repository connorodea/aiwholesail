import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Play, Pause, XCircle, Clock, MessageSquare, Mail,
  Trash2, FileText, Repeat, Zap, RefreshCw,
} from 'lucide-react';
import { useSequences } from '@/hooks/useSequences';
import { SequenceTemplate, LeadSequence } from '@/types/sequences';
import { SequenceBuilder } from './SequenceBuilder';
import { SequenceStatusBadge } from './SequenceStatusBadge';

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  initial_outreach: Zap,
  post_offer: FileText,
  reengagement: Repeat,
  custom: MessageSquare,
};

export function SequenceManager() {
  const {
    templates, activeSequences, loading, fetchAll,
    createTemplate, deleteTemplate, pauseSequence, resumeSequence, cancelSequence,
  } = useSequences();
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SequenceTemplate | null>(null);

  const channelSummary = (template: SequenceTemplate) => {
    const sms = template.steps.filter(s => s.channel === 'sms').length;
    const email = template.steps.filter(s => s.channel === 'email').length;
    const parts: string[] = [];
    if (sms) parts.push(`${sms} SMS`);
    if (email) parts.push(`${email} email`);
    return parts.join(', ') || 'No steps';
  };

  const totalDays = (template: SequenceTemplate) => {
    if (template.steps.length === 0) return 0;
    return Math.max(...template.steps.map(s => s.dayOffset));
  };

  // Show template detail view when selected
  if (selectedTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="gap-1">
            <XCircle className="h-4 w-4" /> Back
          </Button>
          <h2 className="text-xl font-semibold">{selectedTemplate.name}</h2>
          {selectedTemplate.isPrebuilt && (
            <Badge variant="outline" className="text-xs">Prebuilt</Badge>
          )}
        </div>

        {selectedTemplate.description && (
          <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> {selectedTemplate.steps.length} steps</span>
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {totalDays(selectedTemplate)} days</span>
          <span>{channelSummary(selectedTemplate)}</span>
        </div>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium mb-4">Sequence Steps</h3>
            <div className="space-y-4">
              {selectedTemplate.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Day {step.dayOffset}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {step.channel === 'sms' ? (
                        <Badge variant="secondary" className="text-[10px]"><MessageSquare className="h-2.5 w-2.5 mr-1" /> SMS</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]"><Mail className="h-2.5 w-2.5 mr-1" /> Email</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{step.messageTemplate}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          To use this sequence, assign it to a lead from the Deal Pipeline.
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="templates" className="space-y-6">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="active">
            Active Sequences
            {activeSequences.filter(s => s.status === 'active').length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                {activeSequences.filter(s => s.status === 'active').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {!showBuilder && (
            <Button size="sm" className="gap-2" onClick={() => setShowBuilder(true)}>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          )}
        </div>
      </div>

      {/* Templates Tab */}
      <TabsContent value="templates" className="space-y-6">
        {showBuilder && (
          <Card className="border-primary/30">
            <CardContent className="p-6">
              <SequenceBuilder
                onSave={createTemplate}
                onCancel={() => setShowBuilder(false)}
              />
            </CardContent>
          </Card>
        )}

        {loading && templates.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        )}

        {!loading && templates.length === 0 && !showBuilder && (
          <div className="text-center py-16">
            <Repeat className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No sequence templates</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create follow-up sequences to automate your seller outreach.
            </p>
            <Button onClick={() => setShowBuilder(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create Your First Template
            </Button>
          </div>
        )}

        {templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(template => {
              const Icon = CATEGORY_ICONS[template.category] || MessageSquare;
              return (
                <Card
                  key={template.id}
                  className="hover:shadow-md hover:border-primary/30 transition-all border-border/50 cursor-pointer"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{template.name}</div>
                          {template.isPrebuilt && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Prebuilt</Badge>
                          )}
                        </div>
                      </div>
                      {!template.isPrebuilt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {totalDays(template)} days
                      </span>
                      <span>{channelSummary(template)}</span>
                    </div>

                    {/* Step Preview */}
                    <div className="space-y-1">
                      {template.steps.slice(0, 3).map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 text-center font-mono">{step.dayOffset}d</div>
                          {step.channel === 'sms' ? (
                            <MessageSquare className="h-3 w-3 text-green-500" />
                          ) : (
                            <Mail className="h-3 w-3 text-blue-500" />
                          )}
                          <span className="truncate">{step.messageTemplate.slice(0, 50)}...</span>
                        </div>
                      ))}
                      {template.steps.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-6">
                          +{template.steps.length - 3} more steps
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* Active Sequences Tab */}
      <TabsContent value="active" className="space-y-4">
        {loading && activeSequences.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {!loading && activeSequences.length === 0 && (
          <div className="text-center py-16">
            <Play className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No active sequences</h3>
            <p className="text-sm text-muted-foreground">
              Assign a sequence template to a lead from the Pipeline to get started.
            </p>
          </div>
        )}

        {activeSequences.map(seq => (
          <Card key={seq.id} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{seq.sequenceTemplateName}</span>
                    <SequenceStatusBadge status={seq.status} />
                  </div>
                  {seq.leadAddress && (
                    <p className="text-xs text-muted-foreground">{seq.leadAddress}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Step {seq.currentStep} of {seq.totalSteps}</span>
                    {seq.nextSendDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Next: {new Date(seq.nextSendDate).toLocaleDateString()}
                      </span>
                    )}
                    <span>Started: {new Date(seq.startedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-48 h-1.5 bg-muted rounded-full mt-1">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${seq.totalSteps > 0 ? (seq.currentStep / seq.totalSteps) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {seq.status === 'active' && (
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => pauseSequence(seq.id)}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {seq.status === 'paused' && (
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => resumeSequence(seq.id)}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(seq.status === 'active' || seq.status === 'paused') && (
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => cancelSequence(seq.id)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
