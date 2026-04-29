export type SequenceChannel = 'sms' | 'email';
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface SequenceStep {
  id: string;
  stepOrder: number;
  dayOffset: number;
  channel: SequenceChannel;
  subject?: string;
  messageTemplate: string;
}

export interface SequenceTemplate {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  category: 'initial_outreach' | 'post_offer' | 'reengagement' | 'custom';
  steps: SequenceStep[];
  isPrebuilt: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSequence {
  id: string;
  leadId: string;
  sequenceTemplateId: string;
  sequenceTemplateName: string;
  status: SequenceStatus;
  currentStep: number;
  totalSteps: number;
  nextSendDate: string | null;
  startedAt: string;
  completedAt: string | null;
  variables: Record<string, string>;
  leadAddress?: string;
}

export const SEQUENCE_CATEGORIES = [
  { value: 'initial_outreach', label: 'Initial Outreach' },
  { value: 'post_offer', label: 'Post-Offer' },
  { value: 'reengagement', label: 'Re-engagement' },
  { value: 'custom', label: 'Custom' },
] as const;

export const TEMPLATE_VARIABLES = [
  { key: '{seller_name}', label: 'Seller Name' },
  { key: '{property_address}', label: 'Property Address' },
  { key: '{offer_amount}', label: 'Offer Amount' },
  { key: '{your_name}', label: 'Your Name' },
  { key: '{your_phone}', label: 'Your Phone' },
  { key: '{your_company}', label: 'Your Company' },
] as const;
