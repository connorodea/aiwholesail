-- Buyers Database Migration
-- Cash buyer list for wholesale deal matching and outreach

CREATE TABLE IF NOT EXISTS buyers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    deal_count INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_buyers_tags ON buyers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_buyers_criteria ON buyers USING GIN(criteria);
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);

-- Apply updated_at trigger
CREATE TRIGGER update_buyers_updated_at BEFORE UPDATE ON buyers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
