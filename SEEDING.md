# Sales Data Seeding Guide

This document explains how to seed the large sales orders dataset (32,050 records, 46MB) into your Supabase database.

## Problem & Solution

The `data/sales_orders.json` file (46MB) is too large to bundle in a Vercel deployment. We provide two approaches:

### Approach 1: Python Script (Recommended for Local Development)

**Pros:**
- Fast (batches of 500 records)
- Direct database connection
- Detailed progress reporting
- Easy to run locally or in CI/CD

**Use this when:**
- Developing locally
- Running in a CI/CD pipeline
- You need to load all 32,050 records quickly

**Setup:**

```bash
# 1. Install Python dependencies
pip install requests python-dotenv

# 2. Create .env.local from template
cp .env.local.example .env.local

# 3. Add your Supabase credentials to .env.local
# Get these from: https://app.supabase.com/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 4. Run the seed script
python scripts/seed_sales.py

# Output:
# EMG Territory App - Sales Orders Seeder
# ======================================================================
# Loading data/sales_orders.json (46.0 MB)...
# Metadata: 32050 records (file says)
# Actual sales_orders array: 32050 records
#
# Transforming records...
#   Transformed: 32050 records (0 skipped)
#
# Inserting records in batches of 500...
# [1/65]   Batch 1: inserted 500 records
# [2/65]   Batch 2: inserted 500 records
# ...
# ======================================================================
# SEEDING COMPLETE
# ======================================================================
# Total records processed: 32050
# Successful batches: 65
# Failed batches: 0
#
# SUCCESS: All records inserted!
```

### Approach 2: API Endpoint (For Chunked Uploads)

**Pros:**
- Can be called from browser or frontend
- Chunked upload (max 1000 records per request)
- No Python dependency

**Use this when:**
- Uploading from Vercel deployment
- Breaking large uploads into smaller chunks
- Need HTTP API access

**Endpoint:**

```
POST /api/seed-sales
```

**Request Body:**

```json
{
  "records": [
    {
      "customer_name": "John Doe",
      "address": "123 Main St, Springfield, IL, 62701",
      "city": "Springfield",
      "state": "IL",
      "zip_code": "62701",
      "sale_date": "2026-02-22",
      "order_status": "Sent",
      "lmi_type": "Medicaid",
      "dwelling_type": "Single Family Home",
      "kwh": null,
      "rep_name": "Jane Smith",
      "source_file": "Sales Orders Report.xlsx",
      "zone_id": null
    }
  ],
  "clear_first": false
}
```

**Response:**

```json
{
  "success": true,
  "inserted": 1000,
  "failed": 0,
  "message": "Successfully inserted 1000 sales records"
}
```

**Limits:**
- Max 1000 records per request
- All timestamps are auto-generated on insert

**Example (JavaScript):**

```javascript
const records = salesOrdersArray.slice(0, 1000); // First 1000 records

const response = await fetch('/api/seed-sales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ records }),
});

const result = await response.json();
console.log(`Inserted ${result.inserted} records`);
```

## Data Mapping

The Python script automatically maps from the source JSON to the database schema:

| Source Field | Database Column | Notes |
|---|---|---|
| Customer Name | customer_name | Direct mapping |
| Customer Address | address, city, state, zip_code | Parsed from address string |
| Sale Date | sale_date | Converted to YYYY-MM-DD |
| Order Status | order_status | Mapped to enum (Test/Draft/Pending/Sent/Payable/Completed/Cancelled/Duplicate/Invalid) |
| LMI Qualification Type | lmi_type | Mapped to enum (Medicaid/SNAP/LIHEAP/Lifeline/Free Lunch/Reduced Lunch/Other) |
| Dwelling Type | dwelling_type | Mapped to enum (Single Family Home/Apartment (MDU)/Townhouse/Condo/Mobile Home/Unknown/Commercial) |
| Rep Name | rep_name | Direct mapping |
| Source File | source_file | Direct mapping |
| All other fields | (not stored) | Additional fields from source not in database |

## Database Schema

The `sales_records` table stores individual customer records:

```sql
CREATE TABLE sales_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT,
    address TEXT,
    city TEXT,
    state VARCHAR(2),
    zip_code VARCHAR(5),
    sale_date DATE NOT NULL,
    order_status order_status_enum NOT NULL DEFAULT 'Draft',
    lmi_type lmi_program_type,
    dwelling_type dwelling_type_enum,
    kwh NUMERIC(8, 2),
    rep_name TEXT,
    source_file TEXT,
    zone_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_sales_records_zip_code ON sales_records(zip_code);
CREATE INDEX idx_sales_records_zone_id ON sales_records(zone_id);
CREATE INDEX idx_sales_records_sale_date ON sales_records(sale_date DESC);
CREATE INDEX idx_sales_records_order_status ON sales_records(order_status);
CREATE INDEX idx_sales_records_rep_name ON sales_records(rep_name);
CREATE INDEX idx_sales_records_lmi_type ON sales_records(lmi_type);
```

## Queries After Seeding

Once data is loaded, use these views to analyze:

```sql
-- Sales funnel by zone
SELECT zone_id, zip_code, city, conversion_rate, avg_kwh, total_records
FROM sales_funnel_by_zone
ORDER BY conversion_rate DESC;

-- LMI distribution
SELECT zone_id, zip_code, lmi_type, count, percentage
FROM lmi_distribution_by_zone
ORDER BY zone_id, percentage DESC;

-- Records by rep
SELECT rep_name, COUNT(*) as total_orders,
       SUM(CASE WHEN order_status IN ('Payable', 'Completed') THEN 1 ELSE 0 END) as successful
FROM sales_records
GROUP BY rep_name
ORDER BY total_orders DESC;
```

## Troubleshooting

### Python script fails with "requests" module not found

```bash
pip install requests python-dotenv
```

### Environment variables not loading

Make sure `.env.local` is in the project root, not in a subdirectory:
```
emg-territory-app/
├── .env.local          ← Should be here
├── scripts/
│   └── seed_sales.py
└── src/
```

### Supabase connection refused

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
2. Check that your IP isn't blocked by Supabase firewall
3. Ensure the `sales_records` table exists (run migrations first)

### Duplicate records

The script doesn't check for duplicates. If you run it multiple times, you'll get duplicates. Clear the table first if re-running:

```bash
# In Supabase SQL Editor
DELETE FROM sales_records;
```

### API endpoint returns 401/403

Make sure `SUPABASE_SERVICE_ROLE_KEY` is set. The service role key has full admin permissions.

## Performance

- **Python script:** ~500 records/sec, ~65 seconds for 32,050 records
- **API endpoint:** ~1000 records/request, suitable for 32 requests total
- **Database inserts:** 500-record batches are optimal for balance between speed and reliability

## Next Steps

After seeding:

1. **Link sales to zones:** Run a query to populate `zone_id` based on `zip_code`
   ```sql
   UPDATE sales_records sr
   SET zone_id = z.id
   FROM zones z
   WHERE sr.zip_code = z.zip_code;
   ```

2. **Generate reports:** Use the `sales_funnel_by_zone` and `lmi_distribution_by_zone` views

3. **Connect to frontend:** Query via Supabase client
   ```typescript
   const { data } = await supabase
     .from('sales_records')
     .select('*')
     .eq('rep_name', 'John Smith')
     .order('sale_date', { ascending: false });
   ```
