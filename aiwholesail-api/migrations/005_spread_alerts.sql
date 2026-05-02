-- Migration: Add tables and columns required by the spread-alert-worker
-- and property alerts with phone/SMS support

-- 1. Add phone_number and min_spread columns to property_alerts
ALTER TABLE property_alerts ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
ALTER TABLE property_alerts ADD COLUMN IF NOT EXISTS min_spread NUMERIC DEFAULT 30000;

-- 2. Add sms_sent column to property_alert_matches
ALTER TABLE property_alert_matches ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT FALSE;

-- 3. Property search cache table (used by spread-alert-worker to deduplicate searches)
CREATE TABLE IF NOT EXISTS property_search_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location VARCHAR(255) NOT NULL,
    zpid VARCHAR(255) NOT NULL,
    address TEXT,
    price NUMERIC,
    zestimate NUMERIC,
    spread NUMERIC GENERATED ALWAYS AS (COALESCE(zestimate, 0) - COALESCE(price, 0)) STORED,
    bedrooms INTEGER,
    bathrooms NUMERIC,
    sqft INTEGER,
    property_type VARCHAR(100),
    days_on_market INTEGER,
    listing_url TEXT,
    image_url TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(location, zpid)
);

CREATE INDEX IF NOT EXISTS idx_property_search_cache_location ON property_search_cache(location);
CREATE INDEX IF NOT EXISTS idx_property_search_cache_spread ON property_search_cache(spread);

-- 4. Alert sent deals table (deduplication: which deals were already sent per alert)
CREATE TABLE IF NOT EXISTS alert_sent_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES property_alerts(id) ON DELETE CASCADE NOT NULL,
    zpid VARCHAR(255) NOT NULL,
    spread NUMERIC,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(alert_id, zpid)
);

CREATE INDEX IF NOT EXISTS idx_alert_sent_deals_alert_id ON alert_sent_deals(alert_id);

-- 5. Alert job runs table (tracks worker execution history)
CREATE TABLE IF NOT EXISTS alert_job_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(50) DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    locations_searched INTEGER DEFAULT 0,
    properties_found INTEGER DEFAULT 0,
    deals_found INTEGER DEFAULT 0,
    alerts_sent INTEGER DEFAULT 0,
    errors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
