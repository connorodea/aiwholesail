import { Property } from './zillow';

export const PIPELINE_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-500', textColor: 'text-blue-600' },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-500', textColor: 'text-purple-600' },
  { id: 'analyzing', label: 'Analyzing', color: 'bg-amber-500', textColor: 'text-amber-600' },
  { id: 'offer_made', label: 'Offer Made', color: 'bg-orange-500', textColor: 'text-orange-600' },
  { id: 'under_contract', label: 'Under Contract', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
  { id: 'closed', label: 'Closed / Assigned', color: 'bg-green-600', textColor: 'text-green-600' },
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number]['id'];

export interface Deal {
  id: string;
  propertyId: string;
  propertyData: Property;
  status: PipelineStage;
  notes: string | null;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
  spread?: number;
  spreadPercent?: number;
}
