-- Enhanced Lead Scoring System Tables
CREATE TABLE public.lead_scoring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  motivation_score INTEGER NOT NULL DEFAULT 0, -- 0-1000 scale like XLeads
  urgency_score INTEGER NOT NULL DEFAULT 0, -- 0-100 scale
  profitability_score INTEGER NOT NULL DEFAULT 0, -- 0-100 scale
  contactability_score INTEGER NOT NULL DEFAULT 0, -- 0-100 scale
  overall_score INTEGER NOT NULL DEFAULT 0, -- 0-1000 weighted score
  confidence_score INTEGER NOT NULL DEFAULT 0, -- 0-100 AI confidence
  scoring_factors JSONB DEFAULT '[]'::jsonb, -- Array of scoring factors
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Property Intelligence Data
CREATE TABLE public.property_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT NOT NULL,
  zpid TEXT, -- Zillow Property ID for reference
  
  -- Tax Information
  assessed_value NUMERIC,
  market_value NUMERIC,
  tax_amount NUMERIC,
  tax_year INTEGER,
  tax_delinquent BOOLEAN DEFAULT false,
  delinquent_amount NUMERIC,
  tax_history JSONB DEFAULT '[]'::jsonb,
  
  -- Ownership Information
  owner_name TEXT,
  owner_address JSONB,
  absentee_owner BOOLEAN DEFAULT false,
  corporate_owned BOOLEAN DEFAULT false,
  trust_owned BOOLEAN DEFAULT false,
  
  -- Property Details
  occupancy_status TEXT, -- 'owner-occupied', 'tenant-occupied', 'vacant', 'unknown'
  property_condition TEXT, -- 'poor', 'fair', 'good', 'excellent'
  year_built INTEGER,
  square_footage INTEGER,
  lot_size NUMERIC,
  
  -- Motivation Factors
  foreclosure_risk BOOLEAN DEFAULT false,
  probate_property BOOLEAN DEFAULT false,
  divorce_related BOOLEAN DEFAULT false,
  bankruptcy_risk BOOLEAN DEFAULT false,
  inheritance_property BOOLEAN DEFAULT false,
  financial_distress BOOLEAN DEFAULT false,
  
  -- Liens and Violations
  active_liens JSONB DEFAULT '[]'::jsonb,
  code_violations JSONB DEFAULT '[]'::jsonb,
  
  -- Mortgage Information
  mortgage_info JSONB DEFAULT '[]'::jsonb,
  estimated_equity NUMERIC,
  equity_percentage NUMERIC,
  
  -- Market Data
  estimated_arv NUMERIC, -- After Repair Value
  estimated_rehab_cost NUMERIC,
  market_trends JSONB,
  comparable_sales JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contact Information
CREATE TABLE public.lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  contact_type TEXT NOT NULL, -- 'phone', 'email', 'mobile', 'work'
  contact_value TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  skip_traced BOOLEAN DEFAULT false,
  skip_trace_confidence INTEGER DEFAULT 0, -- 0-100
  skip_trace_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Marketing Campaign History
CREATE TABLE public.campaign_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  campaign_type TEXT NOT NULL, -- 'sms', 'email', 'direct-mail', 'cold-call'
  message_content TEXT,
  sent_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response_received BOOLEAN DEFAULT false,
  response_date TIMESTAMP WITH TIME ZONE,
  response_content TEXT,
  campaign_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.lead_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_history ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for lead_scoring
CREATE POLICY "Users can view lead scoring for their leads" 
ON public.lead_scoring 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_scoring.lead_id 
    AND leads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create lead scoring for their leads" 
ON public.lead_scoring 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_scoring.lead_id 
    AND leads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update lead scoring for their leads" 
ON public.lead_scoring 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_scoring.lead_id 
    AND leads.user_id = auth.uid()
  )
);

-- Create RLS Policies for property_intelligence
CREATE POLICY "Property intelligence is viewable by authenticated users" 
ON public.property_intelligence 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Property intelligence can be created by authenticated users" 
ON public.property_intelligence 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property intelligence can be updated by authenticated users" 
ON public.property_intelligence 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create RLS Policies for lead_contacts
CREATE POLICY "Users can view contacts for their leads" 
ON public.lead_contacts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_contacts.lead_id 
    AND leads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create contacts for their leads" 
ON public.lead_contacts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_contacts.lead_id 
    AND leads.user_id = auth.uid()
  )
);

-- Create RLS Policies for campaign_history
CREATE POLICY "Users can view campaign history for their leads" 
ON public.campaign_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = campaign_history.lead_id 
    AND leads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create campaign history for their leads" 
ON public.campaign_history 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = campaign_history.lead_id 
    AND leads.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_lead_scoring_lead_id ON public.lead_scoring(lead_id);
CREATE INDEX idx_lead_scoring_overall_score ON public.lead_scoring(overall_score DESC);
CREATE INDEX idx_property_intelligence_property_id ON public.property_intelligence(property_id);
CREATE INDEX idx_property_intelligence_zpid ON public.property_intelligence(zpid);
CREATE INDEX idx_lead_contacts_lead_id ON public.lead_contacts(lead_id);
CREATE INDEX idx_campaign_history_lead_id ON public.campaign_history(lead_id);

-- Create updated_at trigger for property_intelligence
CREATE TRIGGER update_property_intelligence_updated_at
BEFORE UPDATE ON public.property_intelligence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();