# Quick Start: Sales Data Seeding

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
pip install -r scripts/requirements.txt
```

### Step 2: Configure Environment
```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
# Get these from: https://app.supabase.com/project/YOUR_PROJECT/settings/api
```

Your `.env.local` should look like:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 3: Run Seed Script
```bash
python scripts/seed_sales.py
```

That's it! The script will:
- Load the 46MB JSON file (takes ~2 seconds)
- Transform 32,050 records with intelligent field mapping
- Insert in batches of 500 (takes ~65 seconds total)
- Report progress and success

## Verification

Check that data loaded:

```bash
# In your Supabase Dashboard (SQL Editor):
SELECT COUNT(*) FROM sales_records;
-- Should return: 32050

# See distribution by status:
SELECT order_status, COUNT(*) FROM sales_records GROUP BY order_status ORDER BY count DESC;

# See by ZIP code:
SELECT zip_code, COUNT(*) FROM sales_records GROUP BY zip_code ORDER BY count DESC LIMIT 10;
```

## What Gets Mapped

| Source → Database |
|---|
| Customer Name → customer_name |
| Customer Address → address, city, state, zip_code |
| Sale Date → sale_date (YYYY-MM-DD format) |
| Order Status → order_status enum |
| LMI Qualification Type → lmi_type enum |
| Dwelling Type → dwelling_type enum |
| Rep Name → rep_name |
| Source File → source_file |

## Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'requests'` | Run `pip install -r scripts/requirements.txt` |
| `Error: SUPABASE_SERVICE_ROLE_KEY not set` | Check `.env.local` exists and has correct keys |
| `ConnectionRefusedError` | Verify Supabase credentials are correct |
| Script runs but says 0 records | Check JSON file path is `data/sales_orders.json` |

## API Alternative

If you prefer not to use Python, see **SEEDING.md** for the `/api/seed-sales` endpoint approach.

## Next Steps

1. **Link to zones:** Run SQL to populate zone_id from zip codes
2. **Generate reports:** Use the built-in views for analysis
3. **Connect frontend:** Query via Supabase client

See **SEEDING.md** for full details.
