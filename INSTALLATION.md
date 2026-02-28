# Installation & Deployment Guide

## Prerequisites

- PostgreSQL 14+ (Supabase)
- Supabase CLI (optional, for local development)
- Python 3.8+ (for data loading scripts)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Select region (e.g., us-east-1)
4. Copy connection string and database password

---

## Step 2: Apply Database Migration

### Option A: Using Supabase CLI
```bash
# Initialize project (if not already done)
supabase init

# Push migration to remote
supabase db push --remote

# Or locally first
supabase start
supabase db push
```

### Option B: Using Supabase Console
1. Go to SQL Editor in Supabase dashboard
2. Copy entire contents of `supabase/migrations/001_initial_schema.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify success (should see "CREATE EXTENSION" and table creation messages)

### Option C: Using psql CLI
```bash
psql postgresql://postgres:PASSWORD@HOST:5432/postgres < supabase/migrations/001_initial_schema.sql
```

---

## Step 3: Verify Migration Success

Run these queries in Supabase SQL Editor to confirm:

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Should return: benefits_thresholds, daily_logs, model_state, rep_assignments,
--               reps, sales_records, scoring_config, streets, subsidized_complexes,
--               zone_demographics, zone_eligibility, zones

-- Check enum types
SELECT typname FROM pg_type
WHERE typname LIKE '%enum' OR typname LIKE '%_type'
ORDER BY typname;

-- Check row security
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Should show all 12 tables with rowsecurity = true

-- Check triggers
SELECT tgname, relname FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE NOT tgisinternal
ORDER BY relname, tgname;

-- Should see update_updated_at triggers on all tables
```

---

## Step 4: Load Initial Data

### From deploy_data.json

```python
# scripts/load_zones.py
import json
import uuid
from supabase import create_client, Client

url = "https://your-project.supabase.co"
key = "your-anon-key"
supabase: Client = create_client(url, key)

with open('../territory_engine/deploy_data.json', 'r') as f:
    data = json.load(f)

# Load zones
for zone in data['zones']:
    zone_record = {
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
    }
    result = supabase.table('zones').insert(zone_record).execute()

print(f"Loaded {len(data['zones'])} zones")

# Load zone_demographics (after zones are created)
# Load streets (after zones are created)
# Load zone_eligibility (after zones are created)
```

### From eligibility_by_zip.json

```python
# scripts/load_eligibility.py
import json
from supabase import create_client, Client

url = "https://your-project.supabase.co"
key = "your-anon-key"
supabase: Client = create_client(url, key)

with open('../territory_engine/eligibility_by_zip.json', 'r') as f:
    eligibility = json.load(f)

# Fetch all zones to get zone_id for each ZIP
zones = supabase.table('zones').select('id, zip_code').execute().data

zip_to_zone_id = {z['zip_code']: z['id'] for z in zones}

# Load eligibility data
for zip_code, elig_data in eligibility.items():
    zone_id = zip_to_zone_id.get(zip_code)
    if not zone_id:
        print(f"Warning: No zone found for ZIP {zip_code}")
        continue

    record = {
        'zone_id': zone_id,
        'total_hh': elig_data.get('total_hh'),
        'avg_hh_size': elig_data.get('avg_hh_size'),
        'hh_size_used': elig_data.get('hh_size_used', 3),
        'medicaid_pct': elig_data.get('medicaid_pct'),
        'medicaid_eligible_hh': elig_data.get('medicaid_eligible_hh'),
        'medicaid_threshold': elig_data.get('medicaid_threshold'),
        'snap_pct': elig_data.get('snap_pct'),
        'snap_eligible_hh': elig_data.get('snap_eligible_hh'),
        'snap_threshold': elig_data.get('snap_threshold'),
        'liheap_pct': elig_data.get('liheap_pct'),
        'liheap_eligible_hh': elig_data.get('liheap_eligible_hh'),
        'liheap_threshold': elig_data.get('liheap_threshold'),
        'lifeline_pct': elig_data.get('lifeline_pct'),
        'lifeline_eligible_hh': elig_data.get('lifeline_eligible_hh'),
        'lifeline_threshold': elig_data.get('lifeline_threshold'),
        'free_lunch_pct': elig_data.get('free_lunch_pct'),
        'free_lunch_eligible_hh': elig_data.get('free_lunch_eligible_hh'),
        'reduced_lunch_pct': elig_data.get('reduced_lunch_pct'),
        'reduced_lunch_eligible_hh': elig_data.get('reduced_lunch_eligible_hh'),
        'any_program_pct': elig_data.get('any_program_pct'),
        'any_program_eligible_hh': elig_data.get('any_program_eligible_hh'),
        'any_program_threshold': elig_data.get('any_program_threshold'),
        'electric_heat_pct': elig_data.get('electric_heat_pct'),
        'target_hh_conservative': elig_data.get('target_hh_conservative'),
        'target_hh_broad': elig_data.get('target_hh_broad'),
        'target_pct_conservative': elig_data.get('target_pct_conservative'),
        'target_pct_broad': elig_data.get('target_pct_broad'),
    }

    result = supabase.table('zone_eligibility').insert(record).execute()

print(f"Loaded eligibility data for {len(eligibility)} ZIP codes")
```

### From va_benefits_thresholds.json

```python
# scripts/load_thresholds.py
import json
from datetime import date
from supabase import create_client, Client

url = "https://your-project.supabase.co"
key = "your-anon-key"
supabase: Client = create_client(url, key)

with open('../territory_engine/va_benefits_thresholds.json', 'r') as f:
    thresholds_data = json.load(f)

# Load programs
for program_key, program_data in thresholds_data['programs'].items():
    annual_limits = program_data.get('annual_limits_2026', {})

    record = {
        'program_key': program_key,
        'program_name': program_data['program_name'],
        'fpl_pct': program_data.get('fpl_pct'),
        'income_type': program_data.get('income_type'),
        'thresholds_by_hh_size': annual_limits,
        'source': thresholds_data['metadata'].get('notes', ''),
        'effective_date': '2026-01-01',
    }

    # Use upsert in case duplicate
    result = supabase.table('benefits_thresholds').upsert(record).execute()

print(f"Loaded {len(thresholds_data['programs'])} benefit programs")
```

### Run Loading Scripts

```bash
cd scripts/

# Run in order
python load_zones.py
python load_streets.py
python load_demographics.py
python load_eligibility.py
python load_thresholds.py

# Verify results
python validate_data.py
```

---

## Step 5: Initialize Algorithm Configuration

Already seeded in migration, but you can update:

```sql
-- Verify configuration loaded
SELECT config_key, config_value FROM scoring_config;

-- Example: If you need to change weights
UPDATE scoring_config
SET config_value = '{
    "success_rate": 0.15,
    "saturation": 0.25,
    "energy_kwh": 0.25,
    "benefits": 0.15,
    "freshness": 0.10,
    "family": 0.10
}'::jsonb
WHERE config_key = 'initial_weights';

-- Verify model state exists
SELECT id, weights, training_cycles FROM model_state;
```

---

## Step 6: Test Connection from Application

```python
from supabase import create_client, Client

url = "https://your-project.supabase.co"
key = "your-anon-key"  # Use anon key for client, service_role_key for backend

client: Client = create_client(url, key)

# Test query
result = client.table('zones').select('*').limit(1).execute()
print(result.data)
```

---

## Step 7: Configure RLS & Authentication

### Create Supabase Auth Users

In Supabase dashboard:
1. Go to Authentication → Users
2. Click "Add user"
3. Create test user: `rep1@example.com` / `password123`
4. Repeat for more reps

### Test RLS Policy

```python
# Login as user
from supabase import create_client

client = create_client(url, key)
session = client.auth.sign_in_with_password({
    "email": "rep1@example.com",
    "password": "password123"
})

# Now subsequent queries will respect RLS policies
reps = client.table('reps').select('*').execute()
# User can see all reps (read policy allows)

# Try to update another rep's record (should fail)
try:
    result = client.table('reps').update({'phone': '555-1234'}).eq('id', 'other-rep-id').execute()
    print("Update succeeded (unexpected!)")
except Exception as e:
    print(f"Update blocked by RLS: {e}")
```

---

## Step 8: Create Materialized Views (Optional)

Already created in migration, but to refresh nightly:

```python
# scripts/refresh_views.py
from supabase import create_client, Client
import schedule
import time

url = "https://your-project.supabase.co"
key = "your-service-role-key"  # Service role for this operation
client: Client = create_client(url, key)

def refresh_views():
    client.rpc('pg_catalog.exec', {
        'sql': """
        REFRESH MATERIALIZED VIEW CONCURRENTLY zone_summary;
        REFRESH MATERIALIZED VIEW CONCURRENTLY rep_activity;
        REFRESH MATERIALIZED VIEW CONCURRENTLY sales_funnel_by_zone;
        REFRESH MATERIALIZED VIEW CONCURRENTLY lmi_distribution_by_zone;
        """
    }).execute()
    print("Views refreshed at", time.strftime("%Y-%m-%d %H:%M:%S"))

# Schedule nightly refresh
schedule.every().day.at("02:00").do(refresh_views)

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## Step 9: Setup Monitoring & Alerts

### Monitor Table Sizes

```sql
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Monitor Slow Queries

In Supabase dashboard:
1. Go to Logs → Postgres
2. Filter by `duration > 1000` (queries taking >1 second)
3. Set up alert if any queries consistently slow

### Monitor RLS Violations

```sql
-- Check for failed RLS policies
SELECT COUNT(*) FROM pg_stat_statements
WHERE query LIKE '%row level security%';
```

---

## Step 10: Backup & Recovery

### Enable Point-In-Time Recovery (PITR)

In Supabase dashboard:
1. Go to Project Settings → Backups
2. Enable PITR (at least 7 days)

### Manual Backup

```bash
# Using pg_dump
pg_dump postgresql://user:pass@host/database > backup.sql

# Restore from backup
psql postgresql://user:pass@host/database < backup.sql
```

---

## Troubleshooting

### Migration Fails: "Extension uuid-ossp does not exist"
- Supabase usually has this pre-installed
- If not, Supabase admin can enable it
- Comment out the line if not needed

### RLS Policies Not Working
- Ensure Supabase Auth is configured
- Test with authenticated user (not anon key)
- Check `auth.uid()` vs `auth.role()` in policy

### Data Not Loading
- Verify ZIP codes are 5 digits in both zones and eligibility_by_zip.json
- Check for FK constraint violations: `SELECT * FROM zones WHERE zip_code NOT IN (SELECT zip_code FROM zone_eligibility)`
- Examine Supabase logs for detailed errors

### Performance Issues
- Run `ANALYZE` on all tables after large data load
- Check slow query log: `SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;`
- Consider adding indexes if specific queries are slow

---

## Next: Connect Application

Once installation is complete:
1. Build API layer (Supabase Functions or external backend)
2. Create frontend dashboard
3. Implement rep mobile app for daily logging
4. Setup learning algorithm training job

See README_SCHEMA.md for common queries to power your application.

---

**Installation Complete!**

Your PostgreSQL database is now ready for the community solar territory management system.
