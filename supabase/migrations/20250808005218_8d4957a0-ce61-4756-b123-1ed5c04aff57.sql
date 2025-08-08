-- Create property alerts table for user preferences
CREATE TABLE public.property_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  location TEXT NOT NULL,
  max_price NUMERIC,
  min_bedrooms INTEGER,
  max_bedrooms INTEGER,
  min_bathrooms NUMERIC,
  max_bathrooms NUMERIC,
  min_sqft INTEGER,
  max_sqft INTEGER,
  property_types TEXT[] DEFAULT ARRAY['Houses', 'Townhomes', 'Multi-family', 'Condos/Co-ops'],
  alert_frequency TEXT DEFAULT 'immediate' CHECK (alert_frequency IN ('immediate', 'daily', 'weekly')),
  is_active BOOLEAN DEFAULT true,
  last_alert_sent TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.property_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own property alerts" 
ON public.property_alerts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own property alerts" 
ON public.property_alerts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own property alerts" 
ON public.property_alerts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own property alerts" 
ON public.property_alerts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_property_alerts_updated_at
BEFORE UPDATE ON public.property_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create property alert matches table to track what we've already alerted on
CREATE TABLE public.property_alert_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.property_alerts(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  zpid TEXT,
  matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  property_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on alert matches
ALTER TABLE public.property_alert_matches ENABLE ROW LEVEL SECURITY;

-- Create policies for alert matches
CREATE POLICY "Users can view matches for their alerts" 
ON public.property_alert_matches 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.property_alerts 
  WHERE property_alerts.id = property_alert_matches.alert_id 
  AND property_alerts.user_id = auth.uid()
));

CREATE POLICY "System can insert alert matches" 
ON public.property_alert_matches 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update alert matches" 
ON public.property_alert_matches 
FOR UPDATE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_property_alerts_user_id ON public.property_alerts(user_id);
CREATE INDEX idx_property_alerts_location ON public.property_alerts(location);
CREATE INDEX idx_property_alerts_active ON public.property_alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_property_alert_matches_alert_id ON public.property_alert_matches(alert_id);
CREATE INDEX idx_property_alert_matches_property_id ON public.property_alert_matches(property_id);