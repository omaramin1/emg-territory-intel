# Data Loading Guide - Territory Management System

## Overview

This guide describes how to load data from the territory_engine JSON files into the PostgreSQL schema.

---

## Files to Process

### 1. deploy_data.json
**Source**: `/sessions/festive-loving-gates/territory_engine/deploy_data.json`

**Contents**: 77 zones with:
- Zone metadata (zone_id, ZIP, city, door counts, metrics)
- Top streets data
- LMI types seen
- Census demographics
- Scoring metrics

**Tables to Populate**:
- `zones` (1 row per zone)
- `zone_demographics` (1 row per zone)
- `streets` (multiple rows per zone, from `top_streets` array)

**Python Loading Script Template**:
```python
import json
import uuid
from datetime import datetime, date

# Load the data
with open('deploy_data.json', 'r') as f:
    deploy_data = json.load(f)

zone_records = []
demographics_records = []
streets_records = []

for zone in deploy_data['zones']:
    zone_id = str(uuid.uuid4())

    # Insert into zones
    zone_record = {
        'id': zone_id,
        'zone_id': zone['id'],
        'zip_code': zone['zip'],
        'city': zone['city'],
        'est_doors': zone.get('est_doors', 0),
        'doors_touched': zone.get('doors_touched', 0),
        'doors_enrolled': zone.get('doors_enrolled', 0),
        'untapped_est': zone.get('untapped_est', 0),
        'saturation_pct': zone.get('saturation_pct', 0.0),
        'close_rate': zone.get('our_close_rate', 0.0),
        'total_knocks': zone.get('total_knocks', 0),
        'days_idle': zone.get('days_idle', 0),
        'total_streets_worked': zone.get('total_streets_worked', 0),
        'doc_lmi_pct': zone.get('doc_lmi_pct', 0.0),
        'deploy_score': zone.get('deploy_score', 0.0),
        'prospect_score': zone.get('prospect_score', 0.0),
        'last_worked_date': None,  # Parse if available
    }
    zone_records.append(zone_record)

    # Insert into zone_demographics
    demo_record = {
        'zone_id': zone_id,
        'population': zone.get('population'),
        'households': zone.get('households'),
        'median_income': zone.get('median_income'),
        'median_home_value': zone.get('median_home_value'),
        'electric_heat_pct': zone.get('electric_heat_pct'),
        'renter_pct': zone.get('renter_pct'),
        'avg_hh_size': zone.get('avg_hh_size'),
        'kids_pct': zone.get('kids_pct'),
        'large_family_pct': zone.get('large_family_pct'),
        'apt_pct': zone.get('apt_pct'),
        'sfh_count': zone.get('sfh_count'),
        'apt_10plus_count': zone.get('apt_10plus_count'),
        'mobile_homes': zone.get('mobile_homes'),
        'white_pct': zone.get('white_pct'),
        'black_pct': zone.get('black_pct'),
        'hispanic_pct': zone.get('hispanic_pct'),
        'asian_pct': zone.get('asian_pct'),
        'dominant_demo': zone.get('dominant_demo'),
        'rep_match_note': zone.get('rep_match_note'),
    }
    demographics_records.append(demo_record)

    # Insert streets
    for street in zone.get('top_streets', []):
        street_record = {
            'zone_id': zone_id,
            'street_name': street['name'],
            'doors': street.get('doors', 0),
            'enrolled': street.get('enrolled', 0),
            'untapped': street.get('untapped', 0),
            'close_rate': street.get('rate'),
            'days_idle': street.get('days_idle'),
            'dwelling_type': street.get('dwelling'),
        }
        streets_records.append(street_record)

# Execute bulk inserts
# db.zones.bulk_create(zone_records)
# db.zone_demographics.bulk_create(demographics_records)
# db.streets.bulk_create(streets_records)
```

---

### 2. eligibility_by_zip.json
**Source**: `/sessions/festive-loving-gates/territory_engine/eligibility_by_zip.json`

**Contents**: Keyed by ZIP code with:
- Total households
- Household size
- Medicaid/SNAP/LIHEAP/Lifeline/Lunch program eligibility counts and percentages
- Thresholds and targets

**Tables to Populate**:
- `zone_eligibility` (1 row per zone, matched by ZIP)

**Key Mapping**:
```
ZIP code → zones.zip_code (match)
→ zone_eligibility.zone_id (insert)

medicaid_eligible_hh → zone_eligibility.medicaid_eligible_hh
snap_eligible_hh → zone_eligibility.snap_eligible_hh
liheap_eligible_hh → zone_eligibility.liheap_eligible_hh
lifeline_eligible_hh → zone_eligibility.lifeline_eligible_hh
free_lunch_eligible_hh → zone_eligibility.free_lunch_eligible_hh
reduced_lunch_eligible_hh → zone_eligibility.reduced_lunch_eligible_hh
any_program_eligible_hh → zone_eligibility.any_program_eligible_hh

(all _pct fields, _threshold fields map directly)
```

**SQL Loading Approach**:
```sql
-- Step 1: Create temp table from JSON import
CREATE TEMP TABLE temp_eligibility (
    zip_code VARCHAR(5),
    data JSONB
);

-- Step 2: Load data (via application layer)
-- INSERT INTO temp_eligibility VALUES (...)

-- Step 3: Insert into zone_eligibility
INSERT INTO zone_eligibility (
    zone_id, total_hh, medicaid_eligible_hh, medicaid_pct, medicaid_threshold,
    snap_eligible_hh, snap_pct, snap_threshold,
    liheap_eligible_hh, liheap_pct, liheap_threshold,
    lifeline_eligible_hh, lifeline_pct, lifeline_threshold,
    free_lunch_eligible_hh, free_lunch_pct,
    reduced_lunch_eligible_hh, reduced_lunch_pct,
    any_program_eligible_hh, any_program_pct, any_program_threshold,
    target_hh_conservative, target_hh_broad,
    target_pct_conservative, target_pct_broad
)
SELECT
    z.id,
    (data->>'total_hh')::INT,
    (data->>'medicaid_eligible_hh')::INT,
    (data->>'medicaid_pct')::NUMERIC,
    (data->>'medicaid_threshold')::INT,
    -- ... (repeat for other fields)
FROM temp_eligibility te
JOIN zones z ON z.zip_code = te.zip_code;
```

---

### 3. va_benefits_thresholds.json
**Source**: `/sessions/festive-loving-gates/territory_engine/va_benefits_thresholds.json`

**Contents**: Federal poverty level thresholds and program-specific income limits

**Structure**:
```json
{
  "metadata": {...},
  "fpl_2025": {"1": 15650, "2": 21150, ...},
  "fpl_2026": {"1": 15960, "2": 21620, ...},
  "programs": {
    "medicaid_expansion_aca": {
      "program_name": "...",
      "fpl_pct": 138,
      "income_type": "MAGI",
      "annual_limits_2026": {"1": 21597, "2": 29187, ...},
      ...
    },
    "snap": {...},
    ...
  }
}
```

**Tables to Populate**:
- `benefits_thresholds`

**Python Loading Script**:
```python
import json

with open('va_benefits_thresholds.json', 'r') as f:
    thresholds_data = json.load(f)

threshold_records = []

for program_key, program_data in thresholds_data['programs'].items():
    # Use 2026 thresholds
    annual_limits = program_data.get('annual_limits_2026', {})

    record = {
        'program_key': program_key,
        'program_name': program_data['program_name'],
        'fpl_pct': program_data.get('fpl_pct'),
        'income_type': program_data.get('income_type'),
        'thresholds_by_hh_size': json.dumps(annual_limits),
        'source': thresholds_data['metadata'].get('notes', ''),
        'effective_date': date(2026, 1, 1),
    }
    threshold_records.append(record)

# Bulk insert into benefits_thresholds
```

**Note**: Schema migration includes placeholder thresholds; this script updates with full 2026 data.

---

### 4. config.py
**Source**: `/sessions/festive-loving-gates/territory_engine/config.py`

**Relevant Extracts**:
```python
INITIAL_WEIGHTS = {
    'success_rate': 0.15,
    'avg_kwh': 0.25,
    'dwelling_mix': 0.10,
    'recency_penalty': 0.15,
    'saturation_score': 0.25,
    'rep_affinity': 0.10,
}

LEARNING_RATE = 0.05
WEIGHT_BOUNDS = (0.05, 0.50)
FEEDBACK_WINDOW_DAYS = 30
REST_PERIOD_DAYS = 60
MIN_UNTAPPED_HOUSEHOLD_PCT = 0.40
```

**Load into**: `scoring_config` table (already seeded in migration)

**Manual Update** (if config changes):
```sql
UPDATE scoring_config
SET config_value = '{"success_rate": 0.15, "avg_kwh": 0.25, ...}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'initial_weights';
```

---

### 5. zip_profiles.json & census_income_dist.json
**Advanced Demographics** (optional enrichment)

These files contain detailed census demographics and income distributions.

**Potential Uses**:
- Verify and augment `zone_demographics` values
- Build income distribution histograms for targeting
- Enhance rep matching algorithms

**Loading**: Create separate tables if advanced analytics needed:
```sql
CREATE TABLE zip_income_distribution (
    zip_code VARCHAR(5),
    income_bucket TEXT,
    count INT,
    percentage NUMERIC(5, 2)
);
```

---

## Loading Workflow

### Phase 1: Bootstrap Core Zones
1. Load `deploy_data.json` zones, streets, demographics
2. Verify zone counts: `SELECT COUNT(*) FROM zones;` (expect 77)

### Phase 2: Load Eligibility Data
1. Load `eligibility_by_zip.json` → zone_eligibility
2. Verify no orphaned records: `SELECT COUNT(*) FROM zone_eligibility WHERE zone_id IS NULL;` (expect 0)

### Phase 3: Load Reference Data
1. Load `va_benefits_thresholds.json` → benefits_thresholds
2. Verify 3+ programs: `SELECT COUNT(*) FROM benefits_thresholds;` (expect ≥3)

### Phase 4: Initialize Algorithm
1. Seed `scoring_config` (done in migration)
2. Initialize `model_state` with initial weights

### Phase 5: Load Sales History (Optional)
1. If existing sales records, import via ETL
2. Populate `sales_records` with historical data
3. Link to zones via ZIP code matching

### Phase 6: Setup Rep & Assignment Data (Manual)
1. Create `reps` records via admin UI or script
2. Create `rep_assignments` as needed
3. Initialize `daily_logs` as reps start work

---

## SQL Validation Queries

```sql
-- Zones loaded correctly
SELECT COUNT(*) as zone_count FROM zones;
SELECT COUNT(*) as zones_with_demo FROM zone_demographics;
SELECT COUNT(*) as zones_with_eligibility FROM zone_eligibility;

-- Cross-table integrity
SELECT COUNT(*) FROM zones z
WHERE NOT EXISTS (SELECT 1 FROM zone_demographics WHERE zone_id = z.id);

-- Benefits thresholds present
SELECT program_key, COUNT(*) as hh_sizes
FROM benefits_thresholds, jsonb_object_keys(thresholds_by_hh_size) as sizes
GROUP BY program_key;

-- Streets loaded
SELECT COUNT(DISTINCT street_name) as unique_streets FROM streets;

-- Sample zone data
SELECT z.zone_id, z.zip_code, COUNT(s.id) as street_count,
       zd.population, ze.any_program_eligible_hh
FROM zones z
LEFT JOIN zone_demographics zd ON z.id = zd.zone_id
LEFT JOIN zone_eligibility ze ON z.id = ze.zone_id
LEFT JOIN streets s ON z.id = s.zone_id
GROUP BY z.id, zd.population, ze.any_program_eligible_hh
LIMIT 10;
```

---

## Handling Data Updates

### Refresh Zone Scores (Monthly)
```sql
UPDATE zones
SET deploy_score = <calculated_score>,
    prospect_score = <calculated_score>,
    updated_at = CURRENT_TIMESTAMP
WHERE updated_at < CURRENT_DATE - INTERVAL '30 days';
```

### Update Benefits Thresholds (Annually)
```sql
INSERT INTO benefits_thresholds (program_key, program_name, fpl_pct, income_type,
                                 thresholds_by_hh_size, effective_date)
VALUES ('medicaid_expansion_aca', 'VA Medicaid 2027', 138, 'MAGI',
        '{"1": ...}'::jsonb, '2027-01-01'::DATE)
ON CONFLICT (program_key) DO UPDATE SET
    thresholds_by_hh_size = EXCLUDED.thresholds_by_hh_size,
    effective_date = EXCLUDED.effective_date,
    updated_at = CURRENT_TIMESTAMP;
```

### Append New Sales Records
```sql
-- Nightly batch import
INSERT INTO sales_records (customer_name, address, city, state, zip_code, sale_date,
                           order_status, lmi_type, dwelling_type, kwh, rep_name)
SELECT * FROM <staging_table>
WHERE NOT EXISTS (
    SELECT 1 FROM sales_records sr
    WHERE sr.customer_name = staging.customer_name
    AND sr.sale_date = staging.sale_date
);
```

---

## Performance Tips

1. **Disable Indexes During Bulk Load**:
   ```sql
   ALTER TABLE zones DISABLE TRIGGER ALL;
   -- bulk insert
   ALTER TABLE zones ENABLE TRIGGER ALL;
   ```

2. **Use COPY for Large Files**:
   ```bash
   psql -h localhost -U postgres -d territory_db -c "
   COPY zones FROM STDIN CSV HEADER;
   " < zones.csv
   ```

3. **Analyze After Load**:
   ```sql
   ANALYZE zones;
   ANALYZE zone_demographics;
   ANALYZE zone_eligibility;
   ANALYZE streets;
   ```

4. **Monitor Load Progress**:
   ```sql
   SELECT tablename, n_live_tup as row_count
   FROM pg_stat_user_tables
   ORDER BY tablename;
   ```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| ZIP code mismatch | Verify deploy_data.json uses 5-digit ZIPs; eligibility_by_zip.json must match |
| FK constraint violation | Ensure zones exist before loading zone_eligibility or streets |
| Duplicate street names | Unique constraint on (zone_id, street_name) – check top_streets in deploy_data.json |
| NULL household percentages | Some ZIPs may lack full eligibility data; insert NULLs and review census sources |

---

## Next Steps

After data loading:
1. Run validation queries (above) to confirm integrity
2. Test scoring algorithm against zone scores in deploy_data.json
3. Create rep accounts and test rep_assignments workflow
4. Populate daily_logs with test activity
5. Validate RLS policies with test users
6. Run performance queries and create additional indexes if needed

---

**End of Data Loading Guide**
