-- Add foreign key relationship between property_alerts and profiles
ALTER TABLE property_alerts 
ADD CONSTRAINT fk_property_alerts_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key relationship between subscribers and profiles  
ALTER TABLE subscribers
ADD CONSTRAINT fk_subscribers_user_id
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add indexes for better performance on alert queries
CREATE INDEX IF NOT EXISTS idx_property_alerts_user_active ON property_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_property_alerts_location ON property_alerts(location) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(user_id, subscribed) WHERE subscribed = true;
CREATE INDEX IF NOT EXISTS idx_alert_matches_alert_property ON property_alert_matches(alert_id, property_id);

-- Update RLS policies to work with the new relationships
DROP POLICY IF EXISTS "System can insert alert matches" ON property_alert_matches;
DROP POLICY IF EXISTS "System can update alert matches" ON property_alert_matches;

-- Create better RLS policies for alert matches
CREATE POLICY "System can manage alert matches" 
ON property_alert_matches 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add trigger to update property_alerts updated_at timestamp
CREATE TRIGGER update_property_alerts_updated_at
    BEFORE UPDATE ON property_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();