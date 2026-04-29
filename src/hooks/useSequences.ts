import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { sequences as seqApi } from '@/lib/api-client';
import { SequenceTemplate, LeadSequence, SequenceStep } from '@/types/sequences';
import { toast } from 'sonner';

function mapTemplate(raw: any): SequenceTemplate {
  return {
    id: raw.id,
    userId: raw.user_id || null,
    name: raw.name,
    description: raw.description || '',
    category: raw.category || 'custom',
    steps: (raw.steps || []).map((s: any, i: number) => ({
      id: s.id || String(i),
      stepOrder: s.step_order ?? s.stepOrder ?? i + 1,
      dayOffset: s.day_offset ?? s.dayOffset ?? 0,
      channel: s.channel || 'sms',
      subject: s.subject || undefined,
      messageTemplate: s.message_template || s.messageTemplate || '',
    })),
    isPrebuilt: raw.is_prebuilt ?? raw.isPrebuilt ?? false,
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

function mapLeadSequence(raw: any): LeadSequence {
  return {
    id: raw.id,
    leadId: raw.lead_id || raw.leadId || '',
    sequenceTemplateId: raw.sequence_template_id || raw.sequenceTemplateId || '',
    sequenceTemplateName: raw.sequence_template_name || raw.sequenceTemplateName || raw.template_name || '',
    status: raw.status || 'active',
    currentStep: raw.current_step ?? raw.currentStep ?? 0,
    totalSteps: raw.total_steps ?? raw.totalSteps ?? 0,
    nextSendDate: raw.next_send_date || raw.nextSendDate || null,
    startedAt: raw.started_at || raw.startedAt || '',
    completedAt: raw.completed_at || raw.completedAt || null,
    variables: raw.variables || {},
    leadAddress: raw.lead_address || raw.leadAddress || undefined,
  };
}

export function useSequences() {
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [activeSequences, setActiveSequences] = useState<LeadSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchTemplates = async () => {
    try {
      const response = await seqApi.listTemplates();
      if (response.error) throw new Error(response.error);
      const data = response.data as any;
      const list = Array.isArray(data) ? data : data?.templates || [];
      setTemplates(list.map(mapTemplate));
    } catch {
      toast.error('Failed to load sequence templates');
    }
  };

  const fetchActive = async () => {
    try {
      const response = await seqApi.listActive();
      if (response.error) throw new Error(response.error);
      const data = response.data as any;
      const list = Array.isArray(data) ? data : data?.sequences || [];
      setActiveSequences(list.map(mapLeadSequence));
    } catch {
      toast.error('Failed to load active sequences');
    }
  };

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([fetchTemplates(), fetchActive()]);
    setLoading(false);
  };

  const createTemplate = async (data: {
    name: string;
    description?: string;
    category: string;
    steps: Omit<SequenceStep, 'id'>[];
  }): Promise<boolean> => {
    try {
      const response = await seqApi.createTemplate(data);
      if (response.error) throw new Error(response.error);
      const newTemplate = mapTemplate(response.data);
      setTemplates(prev => [newTemplate, ...prev]);
      toast.success('Template created');
      return true;
    } catch {
      toast.error('Failed to create template');
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    const prev = [...templates];
    setTemplates(t => t.filter(x => x.id !== id));
    try {
      const response = await seqApi.deleteTemplate(id);
      if (response.error) throw new Error(response.error);
      toast.success('Template deleted');
      return true;
    } catch {
      setTemplates(prev);
      toast.error('Failed to delete template');
      return false;
    }
  };

  const assignSequence = async (
    leadId: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<boolean> => {
    try {
      const response = await seqApi.assign(leadId, templateId, variables);
      if (response.error) throw new Error(response.error);
      const newSeq = mapLeadSequence(response.data);
      setActiveSequences(prev => [newSeq, ...prev]);
      toast.success('Sequence started');
      return true;
    } catch {
      toast.error('Failed to start sequence');
      return false;
    }
  };

  const pauseSequence = async (id: string) => {
    setActiveSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'paused' as const } : s));
    try {
      const response = await seqApi.pause(id);
      if (response.error) throw new Error(response.error);
      toast.success('Sequence paused');
    } catch {
      fetchActive();
      toast.error('Failed to pause');
    }
  };

  const resumeSequence = async (id: string) => {
    setActiveSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'active' as const } : s));
    try {
      const response = await seqApi.resume(id);
      if (response.error) throw new Error(response.error);
      toast.success('Sequence resumed');
    } catch {
      fetchActive();
      toast.error('Failed to resume');
    }
  };

  const cancelSequence = async (id: string) => {
    setActiveSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' as const } : s));
    try {
      const response = await seqApi.cancel(id);
      if (response.error) throw new Error(response.error);
      toast.success('Sequence cancelled');
    } catch {
      fetchActive();
      toast.error('Failed to cancel');
    }
  };

  useEffect(() => {
    if (user) fetchAll();
    else {
      setTemplates([]);
      setActiveSequences([]);
    }
  }, [user]);

  return {
    templates,
    activeSequences,
    loading,
    fetchAll,
    fetchTemplates,
    fetchActive,
    createTemplate,
    deleteTemplate,
    assignSequence,
    pauseSequence,
    resumeSequence,
    cancelSequence,
  };
}
