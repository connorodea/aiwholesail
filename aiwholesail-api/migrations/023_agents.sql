-- Agents Directory Migration
-- Real-estate listing agents scraped from Zillow + manually added.
-- This is the dispo / acquisitions outreach directory — distinct from
-- lead_contacts (003), which is per-lead skip-trace scratch.

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320),
    phone VARCHAR(40),
    brokerage VARCHAR(255),
    brokerage_phone VARCHAR(40),
    license_number VARCHAR(80),
    photo_url TEXT,
    market VARCHAR(120),
    state VARCHAR(8),
    city VARCHAR(120),
    zip VARCHAR(12),
    source VARCHAR(40) DEFAULT 'zillow_scrape',
    last_seen_zpid VARCHAR(40),
    listings_count INTEGER DEFAULT 1,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    last_listing_seen_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partial unique index: dedupe a user's agent directory on (lowercased email,
-- lowercased phone), but only when at least one identifier is present. A row
-- with both email and phone NULL is treated as a manually-entered placeholder
-- and is allowed to repeat — we cannot reliably deduplicate by name alone.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_user_contact_unique
    ON agents (user_id, LOWER(COALESCE(email, '')), LOWER(COALESCE(phone, '')))
    WHERE email IS NOT NULL OR phone IS NOT NULL;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_agents_user_name ON agents(user_id, name);
CREATE INDEX IF NOT EXISTS idx_agents_user_state_market ON agents(user_id, state, market);
CREATE INDEX IF NOT EXISTS idx_agents_last_listing_seen ON agents(last_listing_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents USING GIN(tags);

-- updated_at trigger (reuses the shared function defined in 001_initial_schema.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_agents_updated_at'
    ) THEN
        CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;
