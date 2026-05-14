// Shared types for the Campaign Builder wizard.
// These are UI-facing types only — the server contract is owned by a peer agent.

export type AudienceSource = 'buyers' | 'agents' | 'csv';

export interface AudienceContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  propertyAddress?: string;
  company?: string;
  tags?: string[];
  location?: string;
}

export interface AudienceFilters {
  tag: string | null;
  location: string | null;
  hasEmail: boolean;
}

export interface AudienceSelection {
  source: AudienceSource;
  contacts: AudienceContact[];
  filters: AudienceFilters;
  csvRaw?: string;
}

export type SequenceChannel = 'sms' | 'email';

export interface CampaignSequenceStep {
  stepOrder: number;
  dayOffset: number;
  channel: SequenceChannel;
  subject?: string;
  messageTemplate: string;
}

export interface CampaignSequence {
  mode: 'template' | 'inline';
  templateId?: string;
  templateName?: string;
  steps: CampaignSequenceStep[];
}

export interface CampaignSender {
  fromAddress: string;
  isCustomDomain: boolean;
}

export interface CampaignContent {
  sender: CampaignSender;
  // Steps as edited in the content step (subject + body may differ from the
  // initial sequence selection).
  steps: CampaignSequenceStep[];
}

export interface CampaignSchedule {
  daysOfWeek: number[]; // 0 = Sunday … 6 = Saturday
  startHour: number; // 0–23, sender local time
  endHour: number; // 0–23, sender local time
  dailyCap: number;
  start: 'now' | 'scheduled';
  scheduledAt?: string; // ISO datetime-local
  abEnabled: boolean;
  variants: string[]; // variant names: ['A', 'B', ...]
}

export interface CampaignDraft {
  name: string;
  audience: AudienceSelection;
  sequence: CampaignSequence;
  content: CampaignContent;
  schedule: CampaignSchedule;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed';
  audienceSize: number;
  sent: number;
  replied: number;
  createdAt: string;
}

export const DEFAULT_DRAFT: CampaignDraft = {
  name: '',
  audience: {
    source: 'buyers',
    contacts: [],
    filters: { tag: null, location: null, hasEmail: false },
  },
  sequence: {
    mode: 'template',
    steps: [],
  },
  content: {
    sender: {
      fromAddress: 'AIWholesail <outreach@send.aiwholesail.com>',
      isCustomDomain: false,
    },
    steps: [],
  },
  schedule: {
    daysOfWeek: [1, 2, 3, 4, 5], // Mon–Fri
    startHour: 9,
    endHour: 17,
    dailyCap: 40,
    start: 'now',
    abEnabled: false,
    variants: ['A'],
  },
};

export const SAMPLE_FALLBACK: AudienceContact = {
  id: 'sample',
  firstName: 'Jordan',
  lastName: 'Reyes',
  email: 'jordan@example.com',
  phone: '+1 (555) 123-4567',
  propertyAddress: '142 Maple St, Phoenix, AZ 85003',
  company: 'Reyes Capital',
};

/**
 * Substitute the supported merge tags using a sample contact.
 * Unknown tags are left in place so the user can see what's missing.
 */
export function renderPreview(
  template: string,
  contact: AudienceContact,
  sender: { yourName?: string; yourPhone?: string; yourCompany?: string } = {},
): string {
  const map: Record<string, string> = {
    '{first_name}': contact.firstName || '',
    '{last_name}': contact.lastName || '',
    '{property_address}': contact.propertyAddress || '',
    '{seller_name}': `${contact.firstName} ${contact.lastName}`.trim(),
    '{your_name}': sender.yourName || 'You',
    '{your_phone}': sender.yourPhone || '(555) 000-0000',
    '{your_company}': sender.yourCompany || 'AIWholesail',
  };
  return Object.entries(map).reduce(
    (out, [key, value]) => out.split(key).join(value),
    template,
  );
}
