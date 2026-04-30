export type ContractType = 'assignment_agreement' | 'purchase_agreement' | 'letter_of_intent';

export interface ContractParty {
  name: string;
  address: string;
  phone: string;
  email: string;
  entity: string;
}

export interface ContractTerms {
  purchasePrice: number;
  earnestMoney: number;
  assignmentFee: number;
  closingDate: string;
  inspectionPeriod: number;
  financingContingency: boolean;
  inspectionContingency: boolean;
  appraisalContingency: boolean;
  additionalTerms: string;
  titleCompany: string;
  closingAgent: string;
}

export interface ContractData {
  contractType: ContractType;
  propertyAddress: string;
  propertyLegalDescription: string;
  seller: ContractParty;
  buyer: ContractParty;
  assignee: ContractParty;
  terms: ContractTerms;
}

export interface GeneratedContract {
  id: string;
  userId: string;
  leadId: string | null;
  contractType: ContractType;
  contractData: ContractData;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CONTRACT_TYPES = [
  {
    type: 'assignment_agreement' as ContractType,
    label: 'Assignment Agreement',
    description: 'Assign your purchase contract to an end buyer for an assignment fee',
    icon: 'FileOutput',
  },
  {
    type: 'purchase_agreement' as ContractType,
    label: 'Purchase Agreement',
    description: 'Standard purchase contract between buyer and seller',
    icon: 'FileText',
  },
  {
    type: 'letter_of_intent' as ContractType,
    label: 'Letter of Intent',
    description: 'Non-binding letter expressing intent to purchase a property',
    icon: 'FileSignature',
  },
] as const;

export const DEFAULT_PARTY: ContractParty = {
  name: '',
  address: '',
  phone: '',
  email: '',
  entity: '',
};

export const DEFAULT_TERMS: ContractTerms = {
  purchasePrice: 0,
  earnestMoney: 1000,
  assignmentFee: 5000,
  closingDate: '',
  inspectionPeriod: 10,
  financingContingency: false,
  inspectionContingency: true,
  appraisalContingency: false,
  additionalTerms: '',
  titleCompany: '',
  closingAgent: '',
};
