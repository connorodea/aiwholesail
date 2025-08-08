-- Fix RLS policies for advanced_property_assessments to be user-specific
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Advanced assessments are viewable by everyone" ON advanced_property_assessments;
DROP POLICY IF EXISTS "Advanced assessments can be inserted by authenticated users" ON advanced_property_assessments;
DROP POLICY IF EXISTS "Advanced assessments can be updated by authenticated users" ON advanced_property_assessments;

-- Add user_id column to track ownership
ALTER TABLE advanced_property_assessments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create secure user-specific RLS policies
CREATE POLICY "Users can view their own assessments" 
ON advanced_property_assessments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assessments" 
ON advanced_property_assessments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments" 
ON advanced_property_assessments 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Fix property_intelligence policies to be user-specific
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Property intelligence is viewable by authenticated users" ON property_intelligence;
DROP POLICY IF EXISTS "Property intelligence can be created by authenticated users" ON property_intelligence;
DROP POLICY IF EXISTS "Property intelligence can be updated by authenticated users" ON property_intelligence;

-- Add user_id column to track ownership
ALTER TABLE property_intelligence ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create secure user-specific RLS policies
CREATE POLICY "Users can view their own property intelligence" 
ON property_intelligence 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own property intelligence" 
ON property_intelligence 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own property intelligence" 
ON property_intelligence 
FOR UPDATE 
USING (auth.uid() = user_id);