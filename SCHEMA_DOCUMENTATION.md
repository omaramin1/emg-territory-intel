# Community Solar Territory Management System - Schema Documentation

## Overview

This PostgreSQL schema (optimized for Supabase) manages door-to-door sales operations for community solar programs. It tracks territories (zones), demographics, LMI eligibility, sales records, and representative activity.

**Schema Version**: 1.0
**Generated**: 2026-02-28
**Database**: PostgreSQL 14+ / Supabase

---

## Table of Contents

1. [Core Entity Tables](#core-entity-tables)
2. [Enum Types](#enum-types)
3. [Utility Functions](#utility-functions)
4. [View Layer](#view-layer)
5. [Indexing Strategy](#indexing-strategy)
6. [Row Level Security](#row-level-security)
7. [Data Model Relationships](#data-model-relationships)
8. [Common Queries](#common-queries)

---

## Core Entity Tables

### 1. `zones`

**Purpose**: Primary deployment units, one per ZIP code.

**Columns**:
- `id` (UUID, PK): Unique identifier
- `zone_id` (TEXT, UNIQUE): Human-readable zone code (e.g., "ZONE-22553")
- `zip_code` (VARCHAR(5), UNIQUE, INDEXED): 5-digit ZIP code
- `city` (TEXT): City name
- `est_doors` (INT): Estimated total doors in zone
- `doors_touched` (INT): Number of doors contacted
- `doors_enrolled` (INT): Number of successful enrollments
- `untapped_est` (INT): Remaining untapped doors
- `saturation_pct` (NUMERIC): Penetration rate (0.0-1.0)
- `close_rate` (NUMERIC): Historical conversion rate (0.0-1.0)
- `total_knocks` (INT): Cumulative door knocks
- `days_idle` (INT): Days since last activity
- `total_streets_worked` (INT): Number of streets covered
- `doc_lmi_pct` (NUMERIC): Documented LMI household percentage
- `deploy_score` (NUMERIC, INDEXED): Composite deployment priority (0.0-1.0)
- `prospect_score` (NUMERIC, INDEXED): Prospect quality score (0.0-1.0)
- `last_worked_date` (DATE, INDEXED): Most recent activity date
- `created_at`, `updated_at` (TIMESTAMP): Audit timestamps

**Indexes**:
- `zone_id`, `zip_code`, `deploy_score DESC`, `prospect_score DESC`, `last_worked_date`

**Notes**:
- ZIP codes are primary grouping for sales analytics
- Scores are calculated by learning algorithm (see `model_state` table)

---

### 2. `zone_demographics`

**Purpose**: Census-sourced demographic data per zone.

**Columns**:
- `id` (UUID, PK)
- `zone_id` (UUID, UNIQUE, FK → zones.id)
- `population` (INT): Total population
- `households` (INT): Total households
- `avg_hh_size` (NUMERIC): Average household size
- `median_income` (INT): Median household income
- `median_home_value` (INT): Median home sale price
- `electric_heat_pct` (NUMERIC): % using electric heating
- `renter_pct` (NUMERIC): % renting vs owning
- `kids_pct` (NUMERIC): % households with minors
- `large_family_pct` (NUMERIC): % families with 3+ kids
- `apt_pct` (NUMERIC): % in apartments
- `sfh_count` (INT): Single-family home count
- `apt_10plus_count` (INT): Apartment complexes 10+ units
- `mobile_homes` (INT): Mobile home count
- `white_pct`, `black_pct`, `hispanic_pct`, `asian_pct` (NUMERIC): Race/ethnicity distribution
- `dominant_demo` (demographic_category): Majority demographic
- `rep_match_note` (TEXT): Strategic rep assignment notes

**Relationship**: One-to-one with zones

**Notes**:
- Drives targeting strategy based on household composition
- Demographic matching can affect rep assignment effectiveness

---

### 3. `zone_eligibility`

**Purpose**: LMI program eligibility counts and percentages per zone.

**Key Columns**:
- `zone_id` (UUID, UNIQUE, FK)
- `total_hh` (INT): Total households in zone
- `medicaid_eligible_hh` (INT): Count meeting medicaid income threshold
- `medicaid_pct` (NUMERIC): Percentage eligible for medicaid
- `medicaid_threshold` (INT): Income ceiling for reference
- `snap_eligible_hh`, `snap_pct`, `snap_threshold`: SNAP program eligibility
- `liheap_eligible_hh`, `liheap_pct`, `liheap_threshold`: LIHEAP (energy assistance)
- `lifeline_eligible_hh`, `lifeline_pct`, `lifeline_threshold`: Lifeline (utility discount)
- `free_lunch_eligible_hh`, `free_lunch_pct`: Free school lunch eligibility
- `reduced_lunch_eligible_hh`, `reduced_lunch_pct`: Reduced lunch eligibility
- `any_program_eligible_hh` (INT): Union of all programs (broadest target)
- `any_program_pct`, `any_program_threshold`
- `target_hh_conservative` (INT): Conservative targeting count
- `target_hh_broad` (INT): Aggressive targeting count
- `target_pct_conservative`, `target_pct_broad` (NUMERIC)

**Data Source**: `eligibility_by_zip.json`

**Notes**:
- Multiple benefit programs = multiple targeting strategies
- Conservative = households in 2+ programs (more committed)
- Broad = households in any 1+ program (higher reach)

---

### 4. `streets`

**Purpose**: Street-level granularity within zones.

**Columns**:
- `id`, `zone_id` (FK): Identification
- `street_name` (TEXT, UNIQUE per zone): Street identifier
- `doors` (INT): Houses on street
- `enrolled` (INT): Successful sales
- `untapped` (INT): Not yet contacted
- `close_rate` (NUMERIC): Street-specific conversion
- `days_idle` (INT): Inactivity duration
- `dwelling_type` (dwelling_type_enum): Apartment/House/Townhouse/Mobile
- `last_worked_date` (DATE): Most recent knock

**Indexes**: `zone_id`, `close_rate DESC`, `last_worked_date`

**Notes**:
- Enables street-by-street rep routing and performance tracking
- Dwelling type drives different outreach strategies

---

### 5. `sales_records`

**Purpose**: Individual customer records and transactions.

**Columns**:
- `id` (UUID, PK)
- `customer_name`, `address`, `city`, `state`, `zip_code`
- `sale_date` (DATE, INDEXED): Transaction date
- `order_status` (order_status_enum, INDEXED): Payable/Sent/Completed/Test/Duplicate/etc.
- `lmi_type` (lmi_program_type, INDEXED): Program documented (Medicaid/SNAP/LIHEAP/etc.)
- `dwelling_type` (dwelling_type_enum): House/Apartment/Condo/etc.
- `kwh` (NUMERIC): System size (influences commission)
- `rep_name` (TEXT, INDEXED): Sales representative
- `source_file` (TEXT): Data origin for audit
- `zone_id` (UUID, FK → zones.id): Link to zone (nullable for orphaned records)

**Indexes**: `zip_code`, `zone_id`, `sale_date DESC`, `order_status`, `rep_name`, `lmi_type`

**Notes**:
- Status values affect success rate calculations (see `config.py`)
- "Test" and "Duplicate" excluded from performance metrics
- LMI type drives program revenue and impact reporting

---

### 6. `reps`

**Purpose**: Sales representative master records.

**Columns**:
- `id` (UUID, PK)
- `name`, `email` (UNIQUE), `phone`
- `active` (BOOLEAN): Currently working
- `hire_date` (DATE): Employment start
- `notes` (TEXT): Performance notes
- `created_at`, `updated_at`

**Indexes**: `name`, `active`

**Notes**:
- One rep can work multiple zones (see `rep_assignments`)
- Email uniqueness prevents duplicate user registrations

---

### 7. `rep_assignments`

**Purpose**: Assignment of reps to zones with status tracking.

**Columns**:
- `id` (UUID, PK)
- `rep_id` (UUID, FK → reps.id)
- `zone_id` (UUID, FK → zones.id)
- `assigned_date` (DATE): When assignment started
- `status` (assignment_status_enum): assigned/in_progress/completed/cancelled/paused
- `completion_date` (DATE): When finished (nullable)
- `notes` (TEXT): Assignment-specific notes
- `created_at`, `updated_at`

**Indexes**: `rep_id`, `zone_id`, `assigned_date DESC`, `status`, `(status IN (...))` partial index for active

**Relationships**: Many-to-many between reps and zones (via this junction table)

**Notes**:
- Enables tracking of which rep worked where and when
- Status drives workflow (do not reassign while in_progress)

---

### 8. `daily_logs`

**Purpose**: Rep activity tracking for payroll, performance, and audits.

**Columns**:
- `id` (UUID, PK)
- `rep_id` (UUID, FK), `zone_id` (UUID, FK)
- `log_date` (DATE): Activity date (UNIQUE per rep-zone combination)
- `doors_knocked` (INT): Daily count
- `doors_enrolled` (INT): Successful pitches
- `hours_worked` (NUMERIC): Time spent
- `streets_worked` (TEXT[]): Array of street names
- `lmi_types_collected` (lmi_program_type[]): Programs identified
- `notes` (TEXT): Field notes
- `created_at`, `updated_at`

**Indexes**: `rep_id`, `zone_id`, `log_date DESC`, `(rep_id, log_date DESC)`

**Constraints**: Unique per `(rep_id, zone_id, log_date)` - one log per rep per zone per day

**Notes**:
- UNIQUE constraint prevents duplicate logging
- Used for commission calculations and performance analysis
- Arrays support multi-valued fields efficiently

---

### 9. `subsidized_complexes`

**Purpose**: Known multi-unit housing with subsidy programs.

**Columns**:
- `id` (UUID, PK)
- `zone_id` (UUID, FK)
- `name` (TEXT): Complex name
- `address` (TEXT): Location
- `unit_count` (INT): Number of units
- `program_type` (TEXT): HUD/Section 8/Public Housing/etc.
- `created_at`, `updated_at`

**Indexes**: `zone_id`

**Notes**:
- High-value targets for MDU strategy
- Bulk engagement can drive volume in qualified buildings

---

### 10. `benefits_thresholds`

**Purpose**: Federal and state benefit program income thresholds.

**Columns**:
- `id` (UUID, PK)
- `program_key` (TEXT, UNIQUE): System identifier (medicaid_expansion_aca, snap, liheap)
- `program_name` (TEXT): Display name
- `fpl_pct` (INT): % of Federal Poverty Level (e.g., 138%)
- `income_type` (TEXT): Gross Income, MAGI, Net Income, etc.
- `thresholds_by_hh_size` (JSONB): `{"1": 15960, "2": 21620, ...}` annual thresholds per household size
- `source` (TEXT): Data source reference
- `effective_date` (DATE): When rates became active
- `created_at`, `updated_at`

**Data Source**: `va_benefits_thresholds.json`

**Indexes**: `program_key`, `effective_date DESC`

**Notes**:
- Stored as JSONB for flexible household size ranges
- Enables automatic eligibility verification based on customer income
- Updated annually (2026 thresholds provided)

---

### 11. `scoring_config`

**Purpose**: Algorithm weights and hyperparameters persisted in database.

**Columns**:
- `id` (UUID, PK)
- `config_key` (TEXT, UNIQUE): Identifier (initial_weights, learning_rate, etc.)
- `config_value` (JSONB): Configuration object
- `description` (TEXT): What this setting controls
- `created_at`, `updated_at`

**Example Entries**:
```json
{
  "initial_weights": {
    "success_rate": 0.15,
    "saturation": 0.25,
    "energy_kwh": 0.25,
    "benefits": 0.15,
    "freshness": 0.10,
    "family": 0.10
  }
}
```

**Notes**:
- Central configuration source (prevents hardcoding)
- Can be modified without code deployment
- Learning algorithm reads/updates weights here

---

### 12. `model_state`

**Purpose**: Self-learning model weights and prediction history.

**Columns**:
- `id` (UUID, PK)
- `weights` (JSONB): Current weight distribution matching `scoring_config`
- `training_cycles` (INT): Number of learning iterations completed
- `last_training_date` (TIMESTAMP): When last updated
- `prediction_history` (JSONB): Array of past predictions with actuals
- `mae` (NUMERIC): Mean Absolute Error (performance metric)
- `rmse` (NUMERIC): Root Mean Squared Error (performance metric)
- `created_at`, `updated_at`

**Indexes**: `last_training_date DESC`

**Notes**:
- Single row (or minimal rows) for current model state
- Prediction history retained for validation/backtesting
- Used to drive continuous improvement in zone prioritization

---

## Enum Types

### `order_status_enum`
Status values for sales records:
- `Test`: Quality assurance record (excluded from metrics)
- `Draft`: Work in progress
- `Pending`: Awaiting processing
- `Sent`: Submitted to utility/program
- `Payable`: Approved, rep eligible for commission (SUCCESS)
- `Completed`: Fully executed
- `Cancelled`: Withdrawn
- `Duplicate`: Data quality issue (excluded from metrics)
- `Invalid`: Does not meet program requirements

### `assignment_status_enum`
Workflow states for rep assignments:
- `assigned`: Just allocated, awaiting start
- `in_progress`: Actively working
- `completed`: Finished successfully
- `cancelled`: Stopped (e.g., injury, termination)
- `paused`: Temporarily suspended (rest period, weather, etc.)

### `dwelling_type_enum`
Housing types:
- `Single Family Home`
- `Apartment (MDU)`: Multi-Dwelling Unit
- `Townhouse`
- `Condo`
- `Mobile Home`
- `Unknown`
- `Commercial`

### `lmi_program_type`
Low-to-Moderate Income programs:
- `Medicaid`
- `SNAP`
- `LIHEAP`
- `Lifeline`
- `Free Lunch`
- `Reduced Lunch`
- `Other`

### `demographic_category`
Zone demographics classification:
- `majority_white`, `majority_black`, `majority_hispanic`, `majority_asian`
- `diverse`
- `unknown`

---

## Utility Functions

### `update_updated_at_column()`
Trigger function that automatically sets `updated_at = CURRENT_TIMESTAMP` on INSERT/UPDATE.

**Usage**: Attached to all major tables via `BEFORE UPDATE` trigger.

### `days_since(timestamp_col TIMESTAMP) RETURNS INT`
Calculates days elapsed from a timestamp.

**Example**:
```sql
SELECT days_since(last_worked_date) as days_idle FROM zones;
```

### `parse_percentage(pct_text TEXT) RETURNS NUMERIC`
Converts percentage strings ("15%") to decimals (0.15).

**Example**:
```sql
SELECT parse_percentage('25%') as saturation; -- 0.25
```

---

## View Layer

### `zone_summary`
Comprehensive zone profile combining zones, demographics, and eligibility.

**Columns**:
- All zone columns
- `population`, `households`, `median_income` (from demographics)
- `benefits_eligible_hh`, `any_program_pct` (from eligibility)

**Use**: Dashboard, zone selection, territory planning

---

### `rep_activity`
Current rep activity with this month's metrics.

**Columns**:
- `id`, `name`, `email`, `active`
- `zone_id`, `status` (current assignment)
- `total_doors_knocked_this_month`, `total_enrolled_this_month`, `total_hours_this_month`
- `last_activity_date`

**Filter**: Last 30 days of activity

**Use**: Rep leaderboard, performance dashboards, activity alerts

---

### `sales_funnel_by_zone`
Conversion metrics aggregated by zone.

**Columns**:
- `zone_id`, `zip_code`, `city`
- `total_records`, `successful_sales`, `valid_attempts`
- `conversion_rate`, `avg_kwh`

**Calculations**:
- `valid_attempts` = exclude "Test" and "Duplicate" orders
- `successful_sales` = "Payable", "Sent", "Completed" (per config)
- `conversion_rate` = successful_sales / valid_attempts

**Use**: Zone performance analysis, learning algorithm feedback

---

### `lmi_distribution_by_zone`
Breakdown of LMI programs captured per zone.

**Columns**:
- `zone_id`, `zip_code`, `lmi_type`
- `count`, `percentage`

**Use**: Impact reporting, program-specific metrics, equity analysis

---

## Indexing Strategy

**Design Principles**:
1. **Query Performance**: Indexes on frequently filtered/sorted columns
2. **Write Performance**: Minimal overhead (only essential indexes)
3. **Space Efficiency**: Partial indexes where possible (e.g., active assignments)

**Key Indexes**:
- `zones(zip_code)` - Direct lookup and JOIN
- `zones(deploy_score DESC)` - Ranking queries
- `sales_records(zone_id, sale_date DESC)` - Funnel analysis by zone and time
- `sales_records(order_status)` - Filter by status
- `rep_assignments(status)` - Active assignment queries
- `daily_logs(rep_id, log_date DESC)` - Activity history per rep

**Partial Indexes**:
- `rep_assignments WHERE status IN ('assigned', 'in_progress')` - Active assignments only

---

## Row Level Security

**RLS Status**: ENABLED on all tables

**Policy Model**: Authenticated users can read/write most tables. Sensitive operations (e.g., rep profile updates) may be restricted to own records.

**Examples**:
```sql
-- Rep can update own profile
CREATE POLICY reps_update_policy ON reps
    FOR UPDATE USING (auth.role() = 'authenticated_user' OR auth.uid() = id);

-- Rep can only log own daily activity
CREATE POLICY daily_logs_update_policy ON daily_logs
    FOR UPDATE USING (auth.role() = 'authenticated_user' OR auth.uid() = rep_id);
```

**Note**: RLS policies reference Supabase `auth` schema. Adjust authentication logic as needed.

---

## Data Model Relationships

```
zones (1) ──────────────── (1) zone_demographics
     │
     ├─────────────────── (1) zone_eligibility
     │
     ├─────────────────── (N) streets
     │
     ├─────────────────── (N) subsidized_complexes
     │
     ├─────────────────── (N) sales_records
     │
     └─────────────────── (N) rep_assignments
                               │
                               └──────── (N) reps
                                         │
                                         └──── (N) daily_logs

scoring_config ─────────────── (referenced by learning algorithm)
                    │
                    └─────────── model_state

benefits_thresholds ─────────── (reference for eligibility calculations)
```

---

## Common Queries

### Find Top Deployment Opportunities
```sql
SELECT zone_id, zip_code, city, deploy_score, prospect_score, untapped_est
FROM zone_summary
ORDER BY deploy_score DESC
LIMIT 20;
```

### Rep Performance This Month
```sql
SELECT name, email, total_doors_knocked_this_month,
       total_enrolled_this_month, total_hours_this_month
FROM rep_activity
WHERE active = TRUE
ORDER BY total_enrolled_this_month DESC;
```

### Zone Conversion Funnel
```sql
SELECT zone_id, zip_code, conversion_rate, avg_kwh, total_records
FROM sales_funnel_by_zone
WHERE conversion_rate > 0
ORDER BY conversion_rate DESC;
```

### Daily Detailed Activity Log
```sql
SELECT rep_id, zone_id, log_date, doors_knocked, doors_enrolled, hours_worked
FROM daily_logs
WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY log_date DESC, rep_id;
```

### LMI Targeting Opportunities
```sql
SELECT z.zone_id, z.zip_code, ze.any_program_eligible_hh, ze.any_program_pct
FROM zone_eligibility ze
JOIN zones z ON ze.zone_id = z.id
ORDER BY ze.any_program_eligible_hh DESC;
```

### Idle Zones Needing Re-engagement
```sql
SELECT zone_id, zip_code, city, days_idle, last_worked_date
FROM zones
WHERE days_idle > 60
ORDER BY days_idle DESC;
```

---

## Data Loading Strategy

### Initial Load (from JSON files)
1. **deploy_data.json** → zones, streets, zone_demographics (most fields)
2. **eligibility_by_zip.json** → zone_eligibility
3. **va_benefits_thresholds.json** → benefits_thresholds
4. **config.py** → scoring_config (weights)
5. **zip_profiles.json** → additional zone demographic enrichment
6. **census_income_dist.json** → advanced demographic analysis (optional)

### Ongoing Data Ingestion
- Daily logs → daily_logs table (via rep app)
- Sales records → sales_records table (via CRM/sales system)
- Rep master data → reps table (manual + HRIS sync)
- Model updates → model_state table (algorithm execution)

---

## Performance Considerations

1. **Partition Strategy** (future): Consider partitioning `sales_records` by `sale_date` for large datasets
2. **Archive**: Move sales records >2 years old to archive schema
3. **Materialized Views**: Pre-calculate zone scorecards nightly if dashboard load becomes heavy
4. **Connection Pooling**: Use Supabase connection pooling for high-concurrency applications
5. **Query Optimization**: Add ANALYZE periodically for the query planner

---

## Maintenance

### Regular Tasks
- **Weekly**: Validate RLS policies, check failed auth attempts
- **Monthly**: Review slow query log, update table statistics (ANALYZE)
- **Quarterly**: Review and optimize indexes based on actual query patterns
- **Annually**: Update benefits thresholds from federal guidelines

### Backups
- Supabase provides automated backups; ensure Point-In-Time Recovery (PITR) is enabled
- Export critical zones/sales data weekly to cold storage

---

## Security Notes

1. **Authentication**: Connect Supabase auth schema to RLS policies
2. **Sensitive Data**: No PII encryption by default; add if required by compliance
3. **Audit Trail**: `created_at`, `updated_at`, `source_file` provide basic audit capability
4. **API Keys**: Never expose database directly; use Supabase GraphQL/REST APIs with auth

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| RLS blocking valid queries | Check auth role context; verify user is authenticated |
| Slow zone rankings | Add indexes on `deploy_score`; consider materialized view |
| Duplicate sales records | Check `sales_records` for same customer+sale_date; mark as Duplicate status |
| Missing zone data | Verify ZIP code format (5 digits); check FK constraints |

---

**End of Documentation**

For questions or schema modifications, contact the data engineering team.
