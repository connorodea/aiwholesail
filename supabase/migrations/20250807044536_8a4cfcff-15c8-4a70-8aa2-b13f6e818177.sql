-- Create table for advanced property assessments
CREATE TABLE IF NOT EXISTS public.advanced_property_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zpid TEXT NOT NULL,
  overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor', 'distressed', 'condemned')),
  total_repair_estimate DECIMAL(10,2) NOT NULL DEFAULT 0,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  market_value_impact DECIMAL(5,2) DEFAULT 0,
  investment_recommendation TEXT CHECK (investment_recommendation IN ('strong_buy', 'buy', 'hold', 'pass', 'avoid')),
  detailed_assessment JSONB,
  ai_models_used TEXT[] DEFAULT ARRAY['claude-sonnet-4', 'gpt-4o'],
  photos_analyzed INTEGER DEFAULT 0,
  risk_score DECIMAL(5,2) CHECK (risk_score >= 0 AND risk_score <= 100),
  opportunity_score DECIMAL(5,2) CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_advanced_assessments_zpid ON public.advanced_property_assessments(zpid);
CREATE INDEX IF NOT EXISTS idx_advanced_assessments_condition ON public.advanced_property_assessments(overall_condition);
CREATE INDEX IF NOT EXISTS idx_advanced_assessments_created_at ON public.advanced_property_assessments(created_at);

-- Enable RLS
ALTER TABLE public.advanced_property_assessments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Advanced assessments are viewable by everyone" 
  ON public.advanced_property_assessments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Advanced assessments can be inserted by authenticated users" 
  ON public.advanced_property_assessments 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Advanced assessments can be updated by authenticated users" 
  ON public.advanced_property_assessments 
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_advanced_assessments_updated_at
  BEFORE UPDATE ON public.advanced_property_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();