# Community Solar Territory Management System - Database Schema

**Version**: 1.0
**Date**: 2026-02-28
**Database**: PostgreSQL 14+ (Supabase)
**Purpose**: Door-to-door sales territory management, rep performance tracking, and LMI targeting

---

## Quick Start

### 1. Apply the Migration
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase console
# Copy contents of 001_initial_schema.sql and run in SQL Editor
```

### 2. Load Initial Data
```bash
# See DATA_LOADING_GUIDE.md for detailed instructions
python load_data.py  # (example script)
```

### 3. Verify Installation
```sql
-- Should return 77 zones
SELECT COUNT(*) as zones FROM zones;

-- Should return enum types
SELECT * FROM pg_type WHERE typname LIKE '%enum';

-- Should show RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

---

## Schema Overview

### Core Tables (12 primary tables)

| Table | Purpose | Rows | Key Fields |
|-------|---------|------|-----------|
| `zones` | Primary deployment units (1 per ZIP) | 77 | zone_id, zip_code, deploy_score, prospect_score |
| `zone_demographics` | Census data per zone | 77 | population, households, median_income, % demographics |
| `zone_eligibility` | LMI program eligibility counts | 77 | medicaid/SNAP/LIHEAP/Lifeline eligible HH |
| `streets` | Street-level granularity | 150+ | street_name, doors, enrolled, close_rate |
| `sales_records` | Individual customer records | 1000s | customer info, order_status, lmi_type, kwh |
| `reps` | Sales representatives | 10-50 | name, email, phone, active status |
| `rep_assignments` | Rep-to-zone allocation | 100+ | rep_id, zone_id, status, assigned_date |
| `daily_logs` | Rep activity tracking | 1000s | doors_knocked, doors_enrolled, hours_worked |
| `subsidized_complexes` | Known multi-unit housing | 50-100 | name, unit_count, program_type |
| `benefits_thresholds` | Federal program income limits | 10+ | program_key, thresholds_by_hh_size (JSONB) |
| `scoring_config` | Algorithm hyperparameters | 6 | config_key, config_value (JSONB) |
| `model_state` | ML model weights & history | 1 | weights, training_cycles, prediction_history |

### View Layer (4 materialized views)

| View | Purpose | Key Columns |
|------|---------|------------|
| `zone_summary` | Complete zone profile | All zone + demo + eligibility fields |
| `rep_activity` | Current rep metrics | Name, active assignments, this month's KPIs |
| `sales_funnel_by_zone` | Conversion analysis | Conversion rate, avg kwh, record counts |
| `lmi_distribution_by_zone` | Program breakdown | Program type, count, percentage |

---

## Data Model (Simplified)

```
ZONES (77)
├── zone_demographics (1:1)
├── zone_eligibility (1:1)
├── streets (1:N) → ~150+ streets total
├── subsidized_complexes (1:N) → ~50-100 complexes
├── sales_records (1:N) → ~1000s of sales
└── rep_assignments (1:N)
    └── reps (N:1)
        └── daily_logs (1:N) → ~1000s of activity records

Configuration
├── scoring_config → algorithm weights
├── benefits_thresholds → federal income limits
└── model_state → ML model state
```

---

## Key Features

### 1. Comprehensive Scoring
- `deploy_score`: Composite index (0.0-1.0) prioritizing territories
- `prospect_score`: Quality of remaining untapped households
- Weights: success_rate(15%), saturation(25%), energy(25%), benefits(15%), freshness(10%), family(10%)

### 2. Multi-Level Granularity
- **Zone Level** (ZIP code): Overall deployment strategy
- **Street Level**: Granular routing and performance tracking
- **Customer Level**: Individual sales records for funnel analysis

### 3. LMI Program Tracking
- 7 benefit programs tracked: Medicaid, SNAP, LIHEAP, Lifeline, Free Lunch, Reduced Lunch, Other
- Eligibility thresholds by household size
- Percentage of zone qualifying for each program

### 4. Self-Learning Algorithm
- Model weights adapt based on prediction feedback
- Historical predictions stored for backtesting
- MAE/RMSE metrics track model performance

### 5. Rep Performance Analytics
- Daily activity logs (doors knocked, enrolled, hours)
- Monthly KPI aggregation (via view)
- Rep assignment workflow (assigned → in_progress → completed)

### 6. Sales Pipeline Tracking
- Order statuses: Test, Draft, Pending, Sent, Payable (SUCCESS), Completed, Cancelled, Duplicate, Invalid
- LMI type linked to each sale (impacts program revenue)
- Dwelling type (SFH vs MDU strategy)
- Energy system size (kWh → commission calculation)

---

## Key Queries

### Find Top Opportunities (For Dispatch)
```sql
SELECT z.zone_id, z.zip_code, z.city, z.deploy_score, z.prospect_score,
       z.untapped_est, zd.population, ze.any_program_pct
FROM zone_summary z
LEFT JOIN zone_demographics zd ON z.id = zd.zone_id
LEFT JOIN zone_eligibility ze ON z.id = ze.zone_id
ORDER BY z.deploy_score DESC
LIMIT 20;
```

### Rep Leaderboard (This Month)
```sql
SELECT name, email, total_doors_knocked_this_month, total_enrolled_this_month,
       ROUND(100.0 * total_enrolled_this_month / NULLIF(total_doors_knocked_this_month, 0), 1) as conversion_pct
FROM rep_activity
WHERE active = TRUE
ORDER BY total_enrolled_this_month DESC;
```

### Zone Conversion Funnel
```sql
SELECT sfb.zone_id, sfb.zip_code, sfb.city, sfb.total_records,
       sfb.successful_sales, sfb.conversion_rate, sfb.avg_kwh,
       ze.any_program_pct, z.days_idle
FROM sales_funnel_by_zone sfb
LEFT JOIN zones z ON sfb.zone_id = z.id
LEFT JOIN zone_eligibility ze ON z.id = ze.zone_id
ORDER BY sfb.conversion_rate DESC;
```

### Daily Rep Activity (Last 7 Days)
```sql
SELECT rep_id, r.name, zone_id, log_date, doors_knocked, doors_enrolled,
       ROUND(hours_worked, 1) as hours, strings_agg(DISTINCT street, ', ') as streets
FROM daily_logs
LEFT JOIN reps r ON rep_id = r.id
CROSS JOIN LATERAL unnest(streets_worked) AS street
WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY rep_id, r.name, zone_id, log_date, doors_knocked, doors_enrolled, hours_worked
ORDER BY log_date DESC;
```

### LMI Impact by Program
```sql
SELECT lmi_type, COUNT(*) as enrollments, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM sales_records
WHERE order_status IN ('Payable', 'Sent', 'Completed')
AND lmi_type IS NOT NULL
GROUP BY lmi_type
ORDER BY enrollments DESC;
```

---

## Indexing Strategy

**Primary Indexes** (for query performance):
- `zones(zip_code)` - Direct lookups
- `zones(deploy_score DESC)` - Ranking queries
- `sales_records(zone_id, sale_date DESC)` - Time-series analysis
- `sales_records(order_status)` - Funnel filtering
- `daily_logs(rep_id, log_date DESC)` - Activity history
- `rep_assignments(status)` - Active assignment queries

**Partial Indexes** (for active records only):
- `rep_assignments WHERE status IN ('assigned', 'in_progress')`

**Statistics**: ANALYZE tables monthly to keep query planner optimized.

---

## Security & Access Control

### Row Level Security (RLS)
- **Enabled** on all tables
- **Policies**: Authenticated users can read/write
- **Sensitive Operations**: Reps can only update own profile + daily logs

### Example RLS Policy
```sql
-- Rep can only view/log own activity
CREATE POLICY rep_logs_own_data ON daily_logs
    FOR UPDATE USING (auth.uid() = rep_id);
```

### Authentication
- Supabase Auth (email/password, OAuth, SSO)
- Database connects to Supabase `auth.users` table
- Policies check `auth.uid()` and `auth.role()`

---

## Enum Types

```sql
-- Order Status (sales pipeline)
CREATE TYPE order_status_enum AS ENUM (
  'Test', 'Draft', 'Pending', 'Sent', 'Payable', 'Completed', 'Cancelled', 'Duplicate', 'Invalid'
);

-- Assignment Status (rep workflow)
CREATE TYPE assignment_status_enum AS ENUM (
  'assigned', 'in_progress', 'completed', 'cancelled', 'paused'
);

-- Dwelling Type (targeting)
CREATE TYPE dwelling_type_enum AS ENUM (
  'Single Family Home', 'Apartment (MDU)', 'Townhouse', 'Condo', 'Mobile Home', 'Unknown', 'Commercial'
);

-- LMI Program Type
CREATE TYPE lmi_program_type AS ENUM (
  'Medicaid', 'SNAP', 'LIHEAP', 'Lifeline', 'Free Lunch', 'Reduced Lunch', 'Other'
);

-- Demographic Category
CREATE TYPE demographic_category AS ENUM (
  'majority_white', 'majority_black', 'majority_hispanic', 'majority_asian', 'diverse', 'unknown'
);
```

---

## Data Loading

### Sources
1. **deploy_data.json** (77 zones, streets, demographics, scores)
2. **eligibility_by_zip.json** (program eligibility by ZIP)
3. **va_benefits_thresholds.json** (federal income limits)
4. **config.py** (algorithm weights and hyperparameters)
5. **zip_profiles.json** (additional census enrichment)
6. **census_income_dist.json** (income distribution histograms)

### Loading Process
```bash
# Step 1: Run migration (creates tables, triggers, RLS policies)
supabase db push

# Step 2: Load zones, demographics, streets from deploy_data.json
python scripts/load_deploy_data.py

# Step 3: Load eligibility data
python scripts/load_eligibility.py

# Step 4: Load benefits thresholds
python scripts/load_thresholds.py

# Step 5: Verify data integrity
python scripts/validate_schema.py
```

### Validation Queries (See DATA_LOADING_GUIDE.md)
```sql
SELECT COUNT(*) FROM zones;  -- Should be 77
SELECT COUNT(*) FROM zone_demographics;  -- Should be 77
SELECT COUNT(*) FROM zone_eligibility;  -- Should be 77
```

---

## Performance Considerations

### Scalability
- **Current Data**: ~77 zones, ~150+ streets, ~1000s sales records
- **Estimated Growth**: Add 50-100 sales/day + daily logs
- **Partition Strategy**: Consider partitioning `sales_records` by `sale_date` for 2+ years of data

### Query Optimization
- All frequent columns indexed
- Views use LEFT JOIN with aggregation for performance
- Partial indexes reduce B-tree size for large tables

### Connection Pooling
- Supabase handles connection pooling
- Set pool size: `supabase start --workload-optimizer-timeout=0`

### Caching
- Materialized views (for dashboards) can be refreshed nightly:
  ```sql
  REFRESH MATERIALIZED VIEW CONCURRENTLY zone_summary;
  ```

---

## Maintenance

### Weekly
- Monitor slow query log
- Check RLS policy violations

### Monthly
- Run ANALYZE on all tables
- Review index usage statistics
- Validate data integrity (run validation queries)

### Quarterly
- Review slow queries and add indexes if needed
- Archive old sales records (>2 years)

### Annually
- Update benefits thresholds (Federal Poverty Level changes)
- Review and adjust scoring weights based on algorithm performance
- Update census demographics from latest Census Bureau data

---

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| Slow zone rankings | Query takes >5s | Add index on `deploy_score DESC` or use materialized view |
| RLS blocking queries | Auth error "row level security" | Verify user is authenticated; check policy condition |
| Missing zone eligibility | NULL values in `any_program_eligible_hh` | Check ZIP code format (5 digits); re-run eligibility loader |
| Duplicate sales | Same customer appears multiple times | Check for `source_file` identifier; mark older as Duplicate status |
| Stale scoring | Old `deploy_score` values | Run learning algorithm; manually UPDATE zones with new scores |

---

## Files in This Repository

```
emg-territory-app/
├── supabase/migrations/
│   └── 001_initial_schema.sql          ← Main migration (28 KB)
├── SCHEMA_DOCUMENTATION.md              ← Detailed table/view reference
├── DATA_LOADING_GUIDE.md                ← How to populate tables
└── README_SCHEMA.md                     ← This file
```

---

## Next Steps

1. **Apply Migration**
   ```bash
   supabase db push
   ```

2. **Load Data**
   - Follow DATA_LOADING_GUIDE.md
   - Verify counts with validation queries

3. **Test RLS & Auth**
   - Create test user in Supabase Auth
   - Verify can read/write own records only

4. **Setup Application Layer**
   - Build API endpoints (Supabase Functions or external backend)
   - Connect frontend to zone_summary, rep_activity views
   - Implement rep daily logging form

5. **Configure Algorithm**
   - Populate `scoring_config` with initial weights
   - Initialize `model_state` with first training data
   - Setup periodic retraining job (nightly/weekly)

---

## Support & Questions

- **Schema Questions**: See SCHEMA_DOCUMENTATION.md
- **Data Loading**: See DATA_LOADING_GUIDE.md
- **Performance Tuning**: Check PostgreSQL query logs (Supabase dashboard)
- **RLS Issues**: Test policies in Supabase SQL Editor with different user contexts

---

**End of README**

*Schema designed for Supabase. Compatible with PostgreSQL 14+. Optimized for 77-zone territory network with multi-rep management and self-learning scoring algorithm.*
