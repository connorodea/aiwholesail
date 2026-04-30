import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { leads } from '@/lib/api-client';
import { Property } from '@/types/zillow';
import { Deal, PipelineStage, PIPELINE_STAGES } from '@/types/pipeline';
import { toast } from 'sonner';

function mapLeadToDeal(lead: any): Deal {
  const propertyData = lead.property_data || {};
  const price = propertyData.price || 0;
  const zestimate = propertyData.zestimate || 0;
  const spread = price && zestimate ? zestimate - price : 0;
  const spreadPercent = zestimate > 0 ? (spread / zestimate) * 100 : 0;

  return {
    id: lead.id,
    propertyId: lead.property_id,
    propertyData,
    status: (lead.status || 'new') as PipelineStage,
    notes: lead.notes || null,
    overallScore: lead.lead_scoring?.overall_score || null,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    spread,
    spreadPercent,
  };
}

export function usePipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchDeals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await leads.list({ limit: 500 });
      if (response.error) throw new Error(response.error);
      const data = response.data as any;
      const leadsList = Array.isArray(data) ? data : data?.leads || [];
      setDeals(leadsList.map(mapLeadToDeal));
    } catch (error) {
      console.error('[Pipeline] Failed to fetch deals:', error);
      toast.error('Failed to load pipeline deals');
    } finally {
      setLoading(false);
    }
  };

  const moveToStage = async (dealId: string, newStage: PipelineStage) => {
    const previousDeals = [...deals];
    const stageName = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage;

    // Optimistic update
    setDeals(prev =>
      prev.map(d =>
        d.id === dealId
          ? { ...d, status: newStage, updatedAt: new Date().toISOString() }
          : d
      )
    );

    try {
      const response = await leads.update(dealId, { status: newStage });
      if (response.error) throw new Error(response.error);
      toast.success(`Moved to ${stageName}`);
    } catch {
      setDeals(previousDeals);
      toast.error('Failed to move deal');
    }
  };

  const addDeal = async (property: Property, notes?: string): Promise<boolean> => {
    if (!user) {
      toast.error('Please sign in first');
      return false;
    }

    try {
      const propertyId = property.zpid || property.id || String(Date.now());
      const response = await leads.create(propertyId, property, notes);
      if (response.error) {
        if (response.error.includes('already exists') || response.error.includes('duplicate')) {
          toast.info('Already in your pipeline');
          return false;
        }
        throw new Error(response.error);
      }
      const newDeal = mapLeadToDeal({
        ...(response.data as any),
        property_data: property,
      });
      setDeals(prev => [newDeal, ...prev]);
      toast.success('Added to pipeline');
      return true;
    } catch (error) {
      toast.error('Failed to add to pipeline');
      return false;
    }
  };

  const updateNotes = async (dealId: string, notes: string) => {
    setDeals(prev =>
      prev.map(d => (d.id === dealId ? { ...d, notes } : d))
    );

    try {
      const response = await leads.update(dealId, { notes });
      if (response.error) throw new Error(response.error);
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
      fetchDeals();
    }
  };

  const removeDeal = async (dealId: string) => {
    const previousDeals = [...deals];
    setDeals(prev => prev.filter(d => d.id !== dealId));

    try {
      const response = await leads.delete(dealId);
      if (response.error) throw new Error(response.error);
      toast.success('Removed from pipeline');
    } catch {
      setDeals(previousDeals);
      toast.error('Failed to remove deal');
    }
  };

  const dealsByStage = useMemo(() => {
    const grouped: Record<PipelineStage, Deal[]> = {
      new: [],
      contacted: [],
      analyzing: [],
      offer_made: [],
      under_contract: [],
      closed: [],
    };
    for (const deal of deals) {
      const stage = grouped[deal.status] ? deal.status : 'new';
      grouped[stage].push(deal);
    }
    // Sort each stage: highest spread first
    for (const stage of Object.keys(grouped) as PipelineStage[]) {
      grouped[stage].sort((a, b) => (b.spread || 0) - (a.spread || 0));
    }
    return grouped;
  }, [deals]);

  useEffect(() => {
    if (user) {
      fetchDeals();
    } else {
      setDeals([]);
    }
  }, [user]);

  return {
    deals,
    dealsByStage,
    loading,
    fetchDeals,
    moveToStage,
    addDeal,
    updateNotes,
    removeDeal,
  };
}
