# Integration Examples

## Using the Python Script

### Command Line (Simplest)

```bash
# Install dependencies
pip install -r scripts/requirements.txt

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run the seeder
python scripts/seed_sales.py

# Output:
# EMG Territory App - Sales Orders Seeder
# ======================================================================
# Supabase URL: https://your-project.supabase.co
#
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
# [65/65]   Batch 65: inserted 50 records
#
# ======================================================================
# SEEDING COMPLETE
# ======================================================================
# Total records processed: 32050
# Successful batches: 65
# Failed batches: 0
#
# SUCCESS: All records inserted!
```

## Using the API Endpoint

### Option 1: TypeScript/Frontend with Client Library

```typescript
import { seedSalesRecordsBatch, transformSalesRecord } from '@/lib/seed-sales-client'
import salesDataRaw from '@/data/sales_orders.json'

// Transform all records
const records = salesDataRaw.sales_orders.map(transformSalesRecord)

// Seed with progress reporting
const result = await seedSalesRecordsBatch(records, ({ batch, total, inserted, failed }) => {
  console.log(`Progress: ${batch}/${total} batches, ${inserted} inserted, ${failed} failed`)
})

console.log(`Seeding complete: ${result.totalInserted}/${result.totalRecords} records inserted`)
```

### Option 2: cURL Command

```bash
# Get endpoint info
curl https://your-domain.com/api/seed-sales

# Upload a small batch
curl -X POST https://your-domain.com/api/seed-sales \
  -H 'Content-Type: application/json' \
  -d '{
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
        "rep_name": "Jane Smith",
        "source_file": "Sales Orders Report.xlsx"
      }
    ]
  }'

# Response:
# {
#   "success": true,
#   "inserted": 1,
#   "failed": 0,
#   "message": "Successfully inserted 1 sales record"
# }
```

### Option 3: Node.js Script

```javascript
// Import the raw JSON
const salesData = require('./data/sales_orders.json')

// Helper to transform record
function transform(raw) {
  return {
    customer_name: raw['Customer Name'] || null,
    address: raw['Customer Address'] || null,
    zip_code: extractZip(raw['Customer Address']),
    sale_date: raw['Sale Date']?.split(' ')[0],
    order_status: raw['Order Status'] || 'Draft',
    rep_name: raw['Rep Name'] || null,
    source_file: raw['Source File'] || null,
  }
}

function extractZip(addr) {
  if (!addr) return null
  const parts = addr.split(',')
  for (const p of parts.reverse()) {
    const clean = p.trim()
    if (clean.length === 5 && /^\d+$/.test(clean)) return clean
  }
  return null
}

// Upload in batches
async function seedAll() {
  const records = salesData.sales_orders.map(transform)
  const BATCH = 1000
  let total = 0

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const res = await fetch('/api/seed-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch }),
    })
    const json = await res.json()
    total += json.inserted
    console.log(`Batch ${i / BATCH + 1}: ${json.inserted} records`)
  }

  console.log(`Total: ${total}/${records.length} inserted`)
}

seedAll()
```

## Seeding in Different Environments

### Local Development

```bash
# Python approach (recommended)
python scripts/seed_sales.py

# Verify
curl http://localhost:3000/api/seed-sales  # Check endpoint
```

### Vercel Deployment

Option 1: Use environment variable with JSON (not recommended for 46MB):
```bash
# This won't work - file is too large for env var
```

Option 2: Call API endpoint from client after deployment:
```typescript
// In a setup page or admin panel
import { seedSalesRecordsBatch } from '@/lib/seed-sales-client'
import salesData from '@/data/sales_orders.json'

export default function AdminSetup() {
  const [status, setStatus] = useState('')

  const handleSeed = async () => {
    setStatus('Starting seed...')
    const records = salesData.sales_orders.map(transformSalesRecord)
    const result = await seedSalesRecordsBatch(records, ({ batch, total, inserted }) => {
      setStatus(`Batch ${batch}/${total}: ${inserted} records inserted`)
    })
    setStatus(`Complete: ${result.totalInserted} records`)
  }

  return (
    <div>
      <button onClick={handleSeed}>Seed Sales Data</button>
      <p>{status}</p>
    </div>
  )
}
```

Option 3: Run seeding in GitHub Actions:
```yaml
# .github/workflows/seed.yml
name: Seed Sales Data

on:
  workflow_dispatch:  # Manual trigger

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r scripts/requirements.txt
      - run: python scripts/seed_sales.py
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_KEY }}
```

### Docker / Container

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY scripts/requirements.txt .
RUN pip install -r requirements.txt
COPY data/sales_orders.json .
COPY scripts/seed_sales.py .
CMD ["python", "seed_sales.py"]
```

```bash
# Build and run
docker build -t seed-sales .
docker run -e NEXT_PUBLIC_SUPABASE_URL=... \
           -e SUPABASE_SERVICE_ROLE_KEY=... \
           seed-sales
```

## Verifying Data After Seeding

### In Supabase Dashboard

```sql
-- Count records
SELECT COUNT(*) as total FROM sales_records;
-- Result: 32050

-- Distribution by status
SELECT order_status, COUNT(*) FROM sales_records
GROUP BY order_status
ORDER BY count DESC;

-- Top ZIP codes
SELECT zip_code, COUNT(*) as count
FROM sales_records
WHERE zip_code IS NOT NULL
GROUP BY zip_code
ORDER BY count DESC
LIMIT 10;

-- Distribution by LMI type
SELECT lmi_type, COUNT(*) FROM sales_records
WHERE lmi_type IS NOT NULL
GROUP BY lmi_type
ORDER BY count DESC;
```

### In Your App

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
                              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Get summary
const { data } = await supabase
  .from('sales_records')
  .select('id')
  .limit(1)
  .single()

// Query sales by rep
const { data: repSales } = await supabase
  .from('sales_records')
  .select('*')
  .eq('rep_name', 'Dulani Robinson')
  .order('sale_date', { ascending: false })

// Find by ZIP
const { data: zipSales } = await supabase
  .from('sales_records')
  .select('*')
  .eq('zip_code', '23701')
```

## Linking Sales to Zones

After seeding, link sales records to zones by ZIP code:

```sql
UPDATE sales_records sr
SET zone_id = z.id
FROM zones z
WHERE sr.zip_code = z.zip_code
  AND sr.zone_id IS NULL;

-- Check result
SELECT COUNT(*) as linked FROM sales_records WHERE zone_id IS NOT NULL;
SELECT COUNT(*) as unlinked FROM sales_records WHERE zone_id IS NULL;
```

## Monitoring & Troubleshooting

### Python Script Progress Monitoring

The script outputs progress as it runs:
```
[1/65]   Batch 1: inserted 500 records
[2/65]   Batch 2: inserted 500 records
[3/65]   Batch 3: inserted 500 records
```

If a batch fails:
```
[4/65]   Batch 4: ERROR 409
  Response: {"code":"PGRST102", "message":"duplicate key value"}
```

### API Endpoint Response Codes

- `200/201`: Success
- `400`: Invalid request (missing fields, > 1000 records)
- `500`: Database error
- `401/403`: Auth failure (check service role key)

### Performance Metrics

- JSON loading: ~2 seconds (46MB)
- Transformation: ~5 seconds (32,050 records)
- Database inserts: ~65 seconds (500-record batches)
- Total: ~72 seconds for full seed

## Cleanup/Reset

```sql
-- Delete all sales records
DELETE FROM sales_records;

-- Reset sequences if needed
TRUNCATE TABLE sales_records RESTART IDENTITY;

-- Check if deleted
SELECT COUNT(*) FROM sales_records;
```

Then re-run seeding:
```bash
python scripts/seed_sales.py
```
