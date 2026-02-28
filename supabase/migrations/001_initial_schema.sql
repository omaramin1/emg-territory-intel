-- Community Solar Territory Management System
-- Supabase PostgreSQL Migration
-- Generated: 2026-02-28
-- Purpose: Comprehensive schema for door-to-door sales territory management

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Order status enum - reflects sales pipeline stages
CREATE TYPE order_status_enum AS ENUM (
  'Test',
  'Draft',
  'Pending',
  'Sent',
  'Payable',
  'Completed',
  'Cancelled',
  'Duplicate',
  'Invalid'
);

-- Assignment status enum - rep assignment lifecycle
CREATE TYPE assignment_status_enum AS ENUM (
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'paused'
);

-- Dwelling type enum - housing classification
CREATE TYPE dwelling_type_enum AS ENUM (
  'Single Family Home',
  'Apartment (MDU)',
  'Townhouse',
  'Condo',
  'Mobile Home',
  'Unknown',
  'Commercial'
);

-- LMI (Low-to-Moderate Income) program type enum
CREATE TYPE lmi_program_type AS ENUM (
  'Medicaid',
  'SNAP',
  'LIHEAP',
  'Lifeline',
  'Free Lunch',
  'Reduced Lunch',
  'Other'
);

-- Demographic category enum for zone categorization
CREATE TYPE demographic_category AS ENUM (
  'majority_white',
  'majority_black',
  'majority_hispanic',
  'majority_asian',
  'diverse',
  'unknown'
);


-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update timestamps on modified rows
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Calculate age of a record in days (useful for freshness scoring)
CREATE OR REPLACE FUNCTION days_since(timestamp_col TIMESTAMP)
RETURNS INT AS $$
BEGIN
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - timestamp_col)) / 86400);
END;
$$ language 'plpgsql' IMMUTABLE;

-- Convert percentage string to numeric (e.g., "15%" -> 0.15)
CREATE OR REPLACE FUNCTION parse_percentage(pct_text TEXT)
RETURNS NUMERIC AS $$
BEGIN
    RETURN (SUBSTRING(pct_text FROM 1 FOR LENGTH(pct_text) - 1))::NUMERIC / 100;
END;
$$ language 'plpgsql' IMMUTABLE;


-- ============================================================================
-- MAIN TABLES
-- ============================================================================

-- Zones: Primary deployment units (one per ZIP code)
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id TEXT NOT NULL UNIQUE,
    zip_code VARCHAR(5) NOT NULL UNIQUE,
    city TEXT NOT NULL,

    -- Deployment metrics
    est_doors INTEGER NOT NULL DEFAULT 0,
    doors_touched INTEGER NOT NULL DEFAULT 0,
    doors_enrolled INTEGER NOT NULL DEFAULT 0,
    untapped_est INTEGER NOT NULL DEFAULT 0,
    saturation_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
    close_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
    total_knocks INTEGER NOT NULL DEFAULT 0,
    days_idle INTEGER NOT NULL DEFAULT 0,
    total_streets_worked INTEGER NOT NULL DEFAULT 0,

    -- LMI metrics
    doc_lmi_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.0,

    -- Scoring
    deploy_score NUMERIC(7, 4) NOT NULL DEFAULT 0.0,
    prospect_score NUMERIC(7, 4) NOT NULL DEFAULT 0.0,

    -- Tracking
    last_worked_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zones_zip_code ON zones(zip_code);
CREATE INDEX idx_zones_zone_id ON zones(zone_id);
CREATE INDEX idx_zones_deploy_score ON zones(deploy_score DESC);
CREATE INDEX idx_zones_prospect_score ON zones(prospect_score DESC);
CREATE INDEX idx_zones_last_worked_date ON zones(last_worked_date);

CREATE TRIGGER zones_update_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Zone Demographics: Census and household data
CREATE TABLE zone_demographics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL UNIQUE,

    -- Population and households
    population INTEGER,
    households INTEGER,
    avg_hh_size NUMERIC(4, 2),

    -- Income and property
    median_income INTEGER,
    median_home_value INTEGER,

    -- Housing types
    electric_heat_pct NUMERIC(5, 4),
    renter_pct NUMERIC(5, 4),
    kids_pct NUMERIC(5, 4),
    large_family_pct NUMERIC(5, 4),
    apt_pct NUMERIC(5, 4),
    sfh_count INTEGER,
    apt_10plus_count INTEGER,
    mobile_homes INTEGER,

    -- Race/ethnicity distribution
    white_pct NUMERIC(5, 4),
    black_pct NUMERIC(5, 4),
    hispanic_pct NUMERIC(5, 4),
    asian_pct NUMERIC(5, 4),

    -- Classification
    dominant_demo demographic_category,
    rep_match_note TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE INDEX idx_zone_demographics_zone_id ON zone_demographics(zone_id);

CREATE TRIGGER zone_demographics_update_updated_at BEFORE UPDATE ON zone_demographics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Zone Eligibility: LMI program eligibility by zone
CREATE TABLE zone_eligibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL UNIQUE,

    -- Summary
    total_hh INTEGER,
    avg_hh_size NUMERIC(4, 2),
    hh_size_used INTEGER DEFAULT 3,

    -- Medicaid
    medicaid_pct NUMERIC(5, 4),
    medicaid_eligible_hh INTEGER,
    medicaid_threshold INTEGER,

    -- SNAP
    snap_pct NUMERIC(5, 4),
    snap_eligible_hh INTEGER,
    snap_threshold INTEGER,

    -- LIHEAP
    liheap_pct NUMERIC(5, 4),
    liheap_eligible_hh INTEGER,
    liheap_threshold INTEGER,

    -- Lifeline
    lifeline_pct NUMERIC(5, 4),
    lifeline_eligible_hh INTEGER,
    lifeline_threshold INTEGER,

    -- Free Lunch
    free_lunch_pct NUMERIC(5, 4),
    free_lunch_eligible_hh INTEGER,

    -- Reduced Lunch
    reduced_lunch_pct NUMERIC(5, 4),
    reduced_lunch_eligible_hh INTEGER,

    -- Any Program (Union of all eligible households)
    any_program_pct NUMERIC(5, 4),
    any_program_eligible_hh INTEGER,
    any_program_threshold INTEGER,

    -- Utility-specific
    electric_heat_pct NUMERIC(5, 4),

    -- Targeting
    target_hh_conservative INTEGER,
    target_hh_broad INTEGER,
    target_pct_conservative NUMERIC(5, 4),
    target_pct_broad NUMERIC(5, 4),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE INDEX idx_zone_eligibility_zone_id ON zone_eligibility(zone_id);

CREATE TRIGGER zone_eligibility_update_updated_at BEFORE UPDATE ON zone_eligibility
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Streets: Street-level data within zones
CREATE TABLE streets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL,

    street_name TEXT NOT NULL,
    doors INTEGER NOT NULL DEFAULT 0,
    enrolled INTEGER NOT NULL DEFAULT 0,
    untapped INTEGER NOT NULL DEFAULT 0,

    close_rate NUMERIC(5, 4),
    days_idle INTEGER,
    dwelling_type dwelling_type_enum,

    last_worked_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE(zone_id, street_name)
);

CREATE INDEX idx_streets_zone_id ON streets(zone_id);
CREATE INDEX idx_streets_close_rate ON streets(close_rate DESC);
CREATE INDEX idx_streets_last_worked_date ON streets(last_worked_date);

CREATE TRIGGER streets_update_updated_at BEFORE UPDATE ON streets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Subsidized Housing Complexes: Known multi-unit properties
CREATE TABLE subsidized_complexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL,

    name TEXT NOT NULL,
    address TEXT,
    unit_count INTEGER,
    program_type TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE INDEX idx_subsidized_complexes_zone_id ON subsidized_complexes(zone_id);

CREATE TRIGGER subsidized_complexes_update_updated_at BEFORE UPDATE ON subsidized_complexes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Sales Records: Individual customer records and sales
CREATE TABLE sales_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    customer_name TEXT,
    address TEXT,
    city TEXT,
    state VARCHAR(2),
    zip_code VARCHAR(5),

    sale_date DATE NOT NULL,
    order_status order_status_enum NOT NULL DEFAULT 'Draft',

    -- LMI Information
    lmi_type lmi_program_type,

    -- Physical characteristics
    dwelling_type dwelling_type_enum,

    -- System info
    kwh NUMERIC(8, 2),

    -- Sales info
    rep_name TEXT,
    source_file TEXT,

    -- Linking to zones
    zone_id UUID,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL
);

CREATE INDEX idx_sales_records_zip_code ON sales_records(zip_code);
CREATE INDEX idx_sales_records_zone_id ON sales_records(zone_id);
CREATE INDEX idx_sales_records_sale_date ON sales_records(sale_date DESC);
CREATE INDEX idx_sales_records_order_status ON sales_records(order_status);
CREATE INDEX idx_sales_records_rep_name ON sales_records(rep_name);
CREATE INDEX idx_sales_records_lmi_type ON sales_records(lmi_type);

CREATE TRIGGER sales_records_update_updated_at BEFORE UPDATE ON sales_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Sales Representatives
CREATE TABLE reps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Metadata
    hire_date DATE,
    notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reps_name ON reps(name);
CREATE INDEX idx_reps_active ON reps(active);

CREATE TRIGGER reps_update_updated_at BEFORE UPDATE ON reps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Rep Assignments: Which rep is assigned to which zone
CREATE TABLE rep_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID NOT NULL,
    zone_id UUID NOT NULL,

    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status assignment_status_enum NOT NULL DEFAULT 'assigned',

    completion_date DATE,
    notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (rep_id) REFERENCES reps(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE INDEX idx_rep_assignments_rep_id ON rep_assignments(rep_id);
CREATE INDEX idx_rep_assignments_zone_id ON rep_assignments(zone_id);
CREATE INDEX idx_rep_assignments_assigned_date ON rep_assignments(assigned_date DESC);
CREATE INDEX idx_rep_assignments_status ON rep_assignments(status);
CREATE INDEX idx_rep_assignments_active ON rep_assignments(status)
    WHERE status IN ('assigned', 'in_progress');

CREATE TRIGGER rep_assignments_update_updated_at BEFORE UPDATE ON rep_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Daily Logs: Activity tracking by reps
CREATE TABLE daily_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID NOT NULL,
    zone_id UUID NOT NULL,

    log_date DATE NOT NULL,

    doors_knocked INTEGER DEFAULT 0,
    doors_enrolled INTEGER DEFAULT 0,
    hours_worked NUMERIC(5, 2),

    streets_worked TEXT[],
    lmi_types_collected lmi_program_type[],

    notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (rep_id) REFERENCES reps(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE(rep_id, zone_id, log_date)
);

CREATE INDEX idx_daily_logs_rep_id ON daily_logs(rep_id);
CREATE INDEX idx_daily_logs_zone_id ON daily_logs(zone_id);
CREATE INDEX idx_daily_logs_log_date ON daily_logs(log_date DESC);
CREATE INDEX idx_daily_logs_rep_date ON daily_logs(rep_id, log_date DESC);

CREATE TRIGGER daily_logs_update_updated_at BEFORE UPDATE ON daily_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Benefits Thresholds: Program-specific income thresholds
CREATE TABLE benefits_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    program_key TEXT NOT NULL UNIQUE,
    program_name TEXT NOT NULL,

    fpl_pct INTEGER,
    income_type TEXT,

    -- JSONB object: { "1": 15960, "2": 21620, "3": 27280, ... }
    -- Where keys are household sizes and values are annual income thresholds
    thresholds_by_hh_size JSONB NOT NULL,

    source TEXT,
    effective_date DATE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_benefits_thresholds_program_key ON benefits_thresholds(program_key);
CREATE INDEX idx_benefits_thresholds_effective_date ON benefits_thresholds(effective_date DESC);

CREATE TRIGGER benefits_thresholds_update_updated_at BEFORE UPDATE ON benefits_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Scoring Configuration: Algorithm weights and parameters
CREATE TABLE scoring_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,

    description TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scoring_config_config_key ON scoring_config(config_key);

CREATE TRIGGER scoring_config_update_updated_at BEFORE UPDATE ON scoring_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Model State: Self-learning model weights and history
CREATE TABLE model_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Current weights (JSONB): { "success_rate": 0.15, "saturation": 0.25, ... }
    weights JSONB NOT NULL,

    training_cycles INTEGER DEFAULT 0,
    last_training_date TIMESTAMP,

    -- Historical predictions and actuals for validation
    -- JSONB array: [{ "zone_id": "...", "predicted_score": 0.75, "actual_result": 0.82, "date": "..." }, ...]
    prediction_history JSONB DEFAULT '[]'::jsonb,

    -- Model performance metrics
    mae NUMERIC(7, 4),
    rmse NUMERIC(7, 4),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_model_state_last_training_date ON model_state(last_training_date DESC);

CREATE TRIGGER model_state_update_updated_at BEFORE UPDATE ON model_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- VIEW LAYER
-- ============================================================================

-- Zone Summary: Complete zone profile with demographics and eligibility
CREATE VIEW zone_summary AS
SELECT
    z.id,
    z.zone_id,
    z.zip_code,
    z.city,
    z.est_doors,
    z.doors_touched,
    z.doors_enrolled,
    z.untapped_est,
    z.saturation_pct,
    z.close_rate,
    z.total_knocks,
    z.days_idle,
    z.deploy_score,
    z.prospect_score,
    z.last_worked_date,
    COALESCE(zd.population, 0) as population,
    COALESCE(zd.households, 0) as households,
    COALESCE(zd.median_income, 0) as median_income,
    COALESCE(ze.total_hh, 0) as benefits_eligible_hh,
    COALESCE(ze.any_program_pct, 0) as any_program_pct,
    CAST(COALESCE(z.updated_at, CURRENT_TIMESTAMP) AS TIMESTAMP) as updated_at
FROM zones z
LEFT JOIN zone_demographics zd ON z.id = zd.zone_id
LEFT JOIN zone_eligibility ze ON z.id = ze.zone_id;

-- Rep Activity: Current assignments and recent activity
CREATE VIEW rep_activity AS
SELECT
    r.id,
    r.name,
    r.email,
    r.active,
    ra.zone_id,
    ra.status,
    COALESCE(SUM(dl.doors_knocked), 0) as total_doors_knocked_this_month,
    COALESCE(SUM(dl.doors_enrolled), 0) as total_enrolled_this_month,
    COALESCE(SUM(dl.hours_worked), 0) as total_hours_this_month,
    MAX(dl.log_date) as last_activity_date
FROM reps r
LEFT JOIN rep_assignments ra ON r.id = ra.rep_id
LEFT JOIN daily_logs dl ON r.id = dl.rep_id
    AND dl.log_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY r.id, r.name, r.email, r.active, ra.zone_id, ra.status;

-- Sales Funnel by Zone: Conversion metrics
CREATE VIEW sales_funnel_by_zone AS
SELECT
    sr.zone_id,
    z.zip_code,
    z.city,
    COUNT(*) as total_records,
    SUM(CASE WHEN sr.order_status IN ('Payable', 'Sent', 'Completed') THEN 1 ELSE 0 END) as successful_sales,
    SUM(CASE WHEN sr.order_status NOT IN ('Test', 'Duplicate') THEN 1 ELSE 0 END) as valid_attempts,
    ROUND(
        SUM(CASE WHEN sr.order_status IN ('Payable', 'Sent', 'Completed') THEN 1 ELSE 0 END)::NUMERIC /
        NULLIF(SUM(CASE WHEN sr.order_status NOT IN ('Test', 'Duplicate') THEN 1 ELSE 0 END), 0),
        4
    ) as conversion_rate,
    ROUND(AVG(sr.kwh), 2) as avg_kwh
FROM sales_records sr
LEFT JOIN zones z ON sr.zone_id = z.id
WHERE sr.zone_id IS NOT NULL
GROUP BY sr.zone_id, z.zip_code, z.city;

-- LMI Distribution by Zone
CREATE VIEW lmi_distribution_by_zone AS
SELECT
    sr.zone_id,
    z.zip_code,
    sr.lmi_type,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sr.zone_id), 2) as percentage
FROM sales_records sr
LEFT JOIN zones z ON sr.zone_id = z.id
WHERE sr.lmi_type IS NOT NULL AND sr.zone_id IS NOT NULL
GROUP BY sr.zone_id, z.zip_code, sr.lmi_type
ORDER BY sr.zone_id, count DESC;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE streets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidized_complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefits_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_state ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all zones
CREATE POLICY zones_read_policy ON zones
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY zones_write_policy ON zones
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY zones_update_policy ON zones
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: zone_demographics - read/write for authenticated users
CREATE POLICY zone_demographics_read_policy ON zone_demographics
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY zone_demographics_write_policy ON zone_demographics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY zone_demographics_update_policy ON zone_demographics
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: zone_eligibility - read/write for authenticated users
CREATE POLICY zone_eligibility_read_policy ON zone_eligibility
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY zone_eligibility_write_policy ON zone_eligibility
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY zone_eligibility_update_policy ON zone_eligibility
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: streets - read/write for authenticated users
CREATE POLICY streets_read_policy ON streets
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY streets_write_policy ON streets
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY streets_update_policy ON streets
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: subsidized_complexes - read/write for authenticated users
CREATE POLICY subsidized_complexes_read_policy ON subsidized_complexes
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY subsidized_complexes_write_policy ON subsidized_complexes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY subsidized_complexes_update_policy ON subsidized_complexes
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: sales_records - read/write for authenticated users
CREATE POLICY sales_records_read_policy ON sales_records
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY sales_records_write_policy ON sales_records
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY sales_records_update_policy ON sales_records
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: reps - authenticated can read, limited write for own profile
CREATE POLICY reps_read_policy ON reps
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY reps_write_policy ON reps
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY reps_update_policy ON reps
    FOR UPDATE USING (auth.role() = 'authenticated_user' OR auth.uid() = id);

-- Policy: rep_assignments - read/write for authenticated users
CREATE POLICY rep_assignments_read_policy ON rep_assignments
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY rep_assignments_write_policy ON rep_assignments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY rep_assignments_update_policy ON rep_assignments
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: daily_logs - reps can log own activity, admins can see all
CREATE POLICY daily_logs_read_policy ON daily_logs
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY daily_logs_write_policy ON daily_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY daily_logs_update_policy ON daily_logs
    FOR UPDATE USING (auth.role() = 'authenticated_user' OR auth.uid() = rep_id);

-- Policy: benefits_thresholds - read for authenticated, write admin only
CREATE POLICY benefits_thresholds_read_policy ON benefits_thresholds
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY benefits_thresholds_write_policy ON benefits_thresholds
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY benefits_thresholds_update_policy ON benefits_thresholds
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: scoring_config - admin write, all read
CREATE POLICY scoring_config_read_policy ON scoring_config
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY scoring_config_write_policy ON scoring_config
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY scoring_config_update_policy ON scoring_config
    FOR UPDATE USING (auth.role() = 'authenticated_user');

-- Policy: model_state - admin write, all read
CREATE POLICY model_state_read_policy ON model_state
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY model_state_write_policy ON model_state
    FOR INSERT WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY model_state_update_policy ON model_state
    FOR UPDATE USING (auth.role() = 'authenticated_user');


-- ============================================================================
-- INITIAL DATA SEED (OPTIONAL)
-- ============================================================================

-- Insert scoring configuration from deploy_data.json weights
INSERT INTO scoring_config (config_key, config_value, description) VALUES
('initial_weights',
 '{"success_rate": 0.15, "saturation": 0.25, "energy_kwh": 0.25, "benefits": 0.15, "freshness": 0.10, "family": 0.10}'::jsonb,
 'Initial weight distribution for zone scoring algorithm'),
('learning_rate',
 '{"value": 0.05}'::jsonb,
 'Learning rate for algorithm adaptation'),
('weight_bounds',
 '{"min": 0.05, "max": 0.50}'::jsonb,
 'Min/max bounds for individual weight factors'),
('feedback_window_days',
 '{"value": 30}'::jsonb,
 'Days to consider for feedback cycles'),
('rest_period_days',
 '{"value": 60}'::jsonb,
 'Minimum days before revisiting a territory'),
('min_untapped_pct',
 '{"value": 0.40}'::jsonb,
 'Minimum untapped household percentage threshold')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

-- Insert Virginia benefits thresholds skeleton
-- (Full data should be seeded from va_benefits_thresholds.json via application)
INSERT INTO benefits_thresholds (program_key, program_name, fpl_pct, income_type, thresholds_by_hh_size, source, effective_date) VALUES
('medicaid_expansion_aca', 'Virginia Medicaid (ACA Expansion)', 138, 'MAGI',
 '{"1": 21597, "2": 29187, "3": 36777, "4": 43056, "5": 50480, "6": 57905}'::jsonb,
 '2026 Federal Poverty Level Guidelines', '2026-01-01'::DATE),
('snap', 'SNAP (Food Assistance)', 130, 'Gross Income',
 '{"1": 20792, "2": 28106, "3": 35420, "4": 42734, "5": 50048, "6": 57362}'::jsonb,
 '2026 Federal Guidelines', '2026-01-01'::DATE),
('liheap', 'LIHEAP (Energy Assistance)', 150, 'Gross Income',
 '{"1": 23940, "2": 32430, "3": 40920, "4": 49410, "5": 57900, "6": 66390}'::jsonb,
 '2026 Federal Guidelines', '2026-01-01'::DATE)
ON CONFLICT (program_key) DO UPDATE SET
    thresholds_by_hh_size = EXCLUDED.thresholds_by_hh_size,
    updated_at = CURRENT_TIMESTAMP;

-- Initialize empty model state (will be populated by application)
INSERT INTO model_state (weights, training_cycles, prediction_history) VALUES
('{"success_rate": 0.15, "saturation": 0.25, "energy_kwh": 0.25, "benefits": 0.15, "freshness": 0.10, "family": 0.10}'::jsonb, 0, '[]'::jsonb)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- HELPFUL QUERIES (as comments for reference)
-- ============================================================================

/*
-- Get top deployment opportunities
SELECT zone_id, zip_code, city, deploy_score, prospect_score, untapped_est
FROM zone_summary
ORDER BY deploy_score DESC
LIMIT 20;

-- Get rep activity this month
SELECT name, email, total_doors_knocked_this_month, total_enrolled_this_month, last_activity_date
FROM rep_activity
WHERE active = TRUE
ORDER BY total_enrolled_this_month DESC;

-- Get sales conversion by zone
SELECT zone_id, zip_code, conversion_rate, avg_kwh, total_records
FROM sales_funnel_by_zone
ORDER BY conversion_rate DESC;

-- Get zones with most LMI-eligible households
SELECT z.zone_id, z.zip_code, z.city, ze.any_program_eligible_hh, ze.any_program_pct
FROM zone_eligibility ze
JOIN zones z ON ze.zone_id = z.id
ORDER BY ze.any_program_eligible_hh DESC;

-- Track daily performance by rep and zone
SELECT rep_id, zone_id, log_date, doors_knocked, doors_enrolled, hours_worked
FROM daily_logs
WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY log_date DESC, rep_id;
*/
