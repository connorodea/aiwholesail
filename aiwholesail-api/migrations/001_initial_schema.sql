-- AIWholesail Database Schema Migration
-- PostgreSQL schema for Hetzner VPS deployment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (replacing Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in TIMESTAMP WITH TIME ZONE
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email VARCHAR(255),
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscribers table (Stripe integration)
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    subscribed BOOLEAN DEFAULT FALSE,
    subscription_tier VARCHAR(50),
    subscription_end TIMESTAMP WITH TIME ZONE,
    is_trial BOOLEAN DEFAULT FALSE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    property_id VARCHAR(255) NOT NULL,
    property_data JSONB NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    property_id VARCHAR(255) NOT NULL,
    property_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- Lead scoring table
CREATE TABLE IF NOT EXISTS lead_scoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    overall_score NUMERIC DEFAULT 0,
    motivation_score NUMERIC DEFAULT 0,
    urgency_score NUMERIC DEFAULT 0,
    profitability_score NUMERIC DEFAULT 0,
    contactability_score NUMERIC DEFAULT 0,
    confidence_score NUMERIC DEFAULT 0,
    scoring_factors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead contacts table (skip trace results)
CREATE TABLE IF NOT EXISTS lead_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    contact_type VARCHAR(50) NOT NULL,
    contact_value VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    skip_traced BOOLEAN DEFAULT FALSE,
    skip_trace_date TIMESTAMP WITH TIME ZONE,
    skip_trace_confidence NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property alerts table
CREATE TABLE IF NOT EXISTS property_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    location VARCHAR(255) NOT NULL,
    property_types TEXT[],
    min_bedrooms INTEGER,
    max_bedrooms INTEGER,
    min_bathrooms NUMERIC,
    max_bathrooms NUMERIC,
    max_price NUMERIC,
    min_sqft INTEGER,
    max_sqft INTEGER,
    alert_frequency VARCHAR(50) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT TRUE,
    last_alert_sent TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property alert matches table
CREATE TABLE IF NOT EXISTS property_alert_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES property_alerts(id) ON DELETE CASCADE NOT NULL,
    property_id VARCHAR(255) NOT NULL,
    zpid VARCHAR(255),
    property_data JSONB NOT NULL,
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property intelligence table
CREATE TABLE IF NOT EXISTS property_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    property_id VARCHAR(255) NOT NULL,
    zpid VARCHAR(255),
    owner_name VARCHAR(255),
    owner_address JSONB,
    tax_amount NUMERIC,
    tax_year INTEGER,
    tax_history JSONB,
    assessed_value NUMERIC,
    market_value NUMERIC,
    year_built INTEGER,
    square_footage INTEGER,
    lot_size NUMERIC,
    property_condition VARCHAR(50),
    occupancy_status VARCHAR(50),
    mortgage_info JSONB,
    estimated_equity NUMERIC,
    equity_percentage NUMERIC,
    absentee_owner BOOLEAN,
    corporate_owned BOOLEAN,
    trust_owned BOOLEAN,
    foreclosure_risk BOOLEAN,
    tax_delinquent BOOLEAN,
    delinquent_amount NUMERIC,
    bankruptcy_risk BOOLEAN,
    probate_property BOOLEAN,
    inheritance_property BOOLEAN,
    divorce_related BOOLEAN,
    financial_distress BOOLEAN,
    active_liens JSONB,
    code_violations JSONB,
    estimated_arv NUMERIC,
    estimated_rehab_cost NUMERIC,
    comparable_sales JSONB,
    market_trends JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advanced property assessments table
CREATE TABLE IF NOT EXISTS advanced_property_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    zpid VARCHAR(255) NOT NULL,
    photos_analyzed INTEGER,
    overall_condition VARCHAR(50),
    total_repair_estimate NUMERIC DEFAULT 0,
    detailed_assessment JSONB,
    ai_models_used TEXT[],
    confidence_score NUMERIC,
    risk_score NUMERIC,
    opportunity_score NUMERIC,
    market_value_impact NUMERIC,
    investment_recommendation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wholesale deals table
CREATE TABLE IF NOT EXISTS wholesale_deals (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    property_address VARCHAR(500),
    zillow_url VARCHAR(1000),
    arv NUMERIC,
    repair_estimate NUMERIC,
    ppsf NUMERIC,
    ai_score NUMERIC,
    ai_decision TEXT,
    ai_analysis TEXT,
    mao_scenarios JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign history table
CREATE TABLE IF NOT EXISTS campaign_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    campaign_type VARCHAR(50) NOT NULL,
    campaign_id VARCHAR(255),
    message_content TEXT,
    sent_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_received BOOLEAN DEFAULT FALSE,
    response_content TEXT,
    response_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL,
    function_name VARCHAR(100) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert scan logs table
CREATE TABLE IF NOT EXISTS alert_scan_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    alerts_processed INTEGER,
    emails_sent INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table for JWT token management
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_property_id ON favorites(property_id);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_lead_id ON lead_scoring(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_overall_score ON lead_scoring(overall_score);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead_id ON lead_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_property_alerts_user_id ON property_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_property_alerts_is_active ON property_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_property_alert_matches_alert_id ON property_alert_matches(alert_id);
CREATE INDEX IF NOT EXISTS idx_property_intelligence_property_id ON property_intelligence(property_id);
CREATE INDEX IF NOT EXISTS idx_property_intelligence_zpid ON property_intelligence(zpid);
CREATE INDEX IF NOT EXISTS idx_advanced_property_assessments_zpid ON advanced_property_assessments(zpid);
CREATE INDEX IF NOT EXISTS idx_campaign_history_lead_id ON campaign_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_function ON rate_limits(identifier, function_name);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorites_updated_at BEFORE UPDATE ON favorites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_alerts_updated_at BEFORE UPDATE ON property_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_intelligence_updated_at BEFORE UPDATE ON property_intelligence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_advanced_property_assessments_updated_at BEFORE UPDATE ON advanced_property_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for old rate limits
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Create profile automatically when user is created
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.full_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_profile_on_signup AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_profile_for_user();
