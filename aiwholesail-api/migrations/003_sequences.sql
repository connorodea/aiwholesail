-- Follow-up Sequences Migration
-- Automated SMS/email drip campaigns for wholesale leads

-- Sequence templates (user-created and prebuilt)
CREATE TABLE IF NOT EXISTS sequence_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'custom',
    is_prebuilt BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Steps within a sequence template
CREATE TABLE IF NOT EXISTS sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_template_id UUID REFERENCES sequence_templates(id) ON DELETE CASCADE NOT NULL,
    step_order INTEGER NOT NULL,
    day_offset INTEGER NOT NULL DEFAULT 0,
    channel VARCHAR(20) NOT NULL DEFAULT 'sms',
    subject VARCHAR(500),
    message_template TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment of a sequence to a lead
CREATE TABLE IF NOT EXISTS lead_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    sequence_template_id UUID REFERENCES sequence_templates(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    current_step INTEGER DEFAULT 0,
    variables JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Execution log for each step
CREATE TABLE IF NOT EXISTS sequence_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_sequence_id UUID REFERENCES lead_sequences(id) ON DELETE CASCADE NOT NULL,
    step_order INTEGER NOT NULL,
    channel VARCHAR(20) NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sequence_templates_user_id ON sequence_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_template_id ON sequence_steps(sequence_template_id);
CREATE INDEX IF NOT EXISTS idx_lead_sequences_lead_id ON lead_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_sequences_user_status ON lead_sequences(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sequence_executions_lead_seq ON sequence_executions(lead_sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_executions_pending ON sequence_executions(status, scheduled_date);

-- Triggers
CREATE TRIGGER update_sequence_templates_updated_at BEFORE UPDATE ON sequence_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_sequences_updated_at BEFORE UPDATE ON lead_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed prebuilt templates
INSERT INTO sequence_templates (id, user_id, name, description, category, is_prebuilt)
VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Initial Outreach', '5-step seller contact sequence over 14 days', 'initial_outreach', TRUE),
  ('00000000-0000-0000-0000-000000000002', NULL, 'Post-Offer Follow-up', '4-step follow-up after submitting an offer', 'post_offer', TRUE),
  ('00000000-0000-0000-0000-000000000003', NULL, 'Re-engagement', '3-step re-engagement for cold leads over 21 days', 'reengagement', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Initial Outreach steps
INSERT INTO sequence_steps (sequence_template_id, step_order, day_offset, channel, message_template) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 0, 'sms', 'Hi {seller_name}, my name is {your_name}. I noticed your property at {property_address} and wanted to reach out. Would you be open to discussing a quick, hassle-free sale?'),
  ('00000000-0000-0000-0000-000000000001', 2, 2, 'sms', 'Hi {seller_name}, just following up on my message about {property_address}. I work with cash buyers and can close quickly. Any interest?'),
  ('00000000-0000-0000-0000-000000000001', 3, 5, 'email', 'Hi {seller_name}, I wanted to follow up regarding your property at {property_address}. We specialize in fast, fair cash offers with no fees or commissions. Would you have a few minutes to chat?'),
  ('00000000-0000-0000-0000-000000000001', 4, 9, 'sms', 'Hi {seller_name}, just checking in one more time about {property_address}. If timing isn''t right now, no worries — I''m here whenever you''re ready.'),
  ('00000000-0000-0000-0000-000000000001', 5, 14, 'sms', 'Hi {seller_name}, last message from me about {property_address}. If you ever want to explore your options, feel free to reach out anytime. - {your_name} {your_phone}');

-- Post-Offer Follow-up steps
INSERT INTO sequence_steps (sequence_template_id, step_order, day_offset, channel, message_template) VALUES
  ('00000000-0000-0000-0000-000000000002', 1, 0, 'sms', 'Hi {seller_name}, I just sent over my offer for {property_address}. Let me know if you have any questions — happy to walk through the numbers.'),
  ('00000000-0000-0000-0000-000000000002', 2, 3, 'sms', 'Hi {seller_name}, following up on my offer for {property_address}. I can be flexible on closing timeline. What works best for you?'),
  ('00000000-0000-0000-0000-000000000002', 3, 6, 'email', 'Hi {seller_name}, I wanted to check in on the offer I submitted for {property_address} at {offer_amount}. I''m available to discuss any concerns or adjustments.'),
  ('00000000-0000-0000-0000-000000000002', 4, 10, 'sms', 'Hi {seller_name}, just a final check-in on {property_address}. My offer still stands if you''re interested. Wishing you the best either way!');

-- Re-engagement steps
INSERT INTO sequence_steps (sequence_template_id, step_order, day_offset, channel, message_template) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 0, 'sms', 'Hi {seller_name}, it''s {your_name}. We spoke a while back about {property_address}. Just checking if your situation has changed — still happy to help if you''re looking to sell.'),
  ('00000000-0000-0000-0000-000000000003', 2, 7, 'email', 'Hi {seller_name}, I hope you''re doing well. I''m reaching out again about {property_address}. Market conditions have shifted and I may be able to offer better terms now.'),
  ('00000000-0000-0000-0000-000000000003', 3, 21, 'sms', 'Hi {seller_name}, just a friendly check-in from {your_name}. If you ever decide to sell {property_address}, I''d love the opportunity to make you a fair offer. {your_phone}');
