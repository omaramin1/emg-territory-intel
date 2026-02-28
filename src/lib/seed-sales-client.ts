/**
 * Client-side helper for seeding sales records via /api/seed-sales endpoint
 * Use this when you need to upload sales data from the browser or frontend
 */

export interface SalesRecordInput {
  customer_name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  sale_date: string // ISO date string (YYYY-MM-DD)
  order_status: 'Test' | 'Draft' | 'Pending' | 'Sent' | 'Payable' | 'Completed' | 'Cancelled' | 'Duplicate' | 'Invalid'
  lmi_type?: 'Medicaid' | 'SNAP' | 'LIHEAP' | 'Lifeline' | 'Free Lunch' | 'Reduced Lunch' | 'Other' | null
  dwelling_type?: 'Single Family Home' | 'Apartment (MDU)' | 'Townhouse' | 'Condo' | 'Mobile Home' | 'Unknown' | 'Commercial' | null
  kwh?: number | null
  rep_name?: string | null
  source_file?: string | null
  zone_id?: string | null
}

export interface SeedResponse {
  success: boolean
  inserted: number
  failed: number
  message: string
  errors?: string[]
}

/**
 * Seed sales records via API endpoint
 * @param records Array of sales records (max 1000 per request)
 * @returns Response with success status and record counts
 */
export async function seedSalesRecords(records: SalesRecordInput[]): Promise<SeedResponse> {
  if (records.length === 0) {
    throw new Error('No records provided')
  }

  if (records.length > 1000) {
    throw new Error('Maximum 1000 records per request. Split into multiple requests.')
  }

  try {
    const response = await fetch('/api/seed-sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Seed sales records in batches
 * Automatically splits large arrays into 1000-record chunks and uploads sequentially
 * @param records Array of sales records (any size)
 * @param onProgress Optional callback for progress reporting
 * @returns Summary of all batches
 */
export async function seedSalesRecordsBatch(
  records: SalesRecordInput[],
  onProgress?: (status: { batch: number; total: number; inserted: number; failed: number }) => void
): Promise<{
  success: boolean
  totalRecords: number
  totalInserted: number
  totalFailed: number
  batches: SeedResponse[]
}> {
  const BATCH_SIZE = 1000
  const batches: SeedResponse[] = []
  let totalInserted = 0
  let totalFailed = 0

  const totalBatches = Math.ceil(records.length / BATCH_SIZE)

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    try {
      const result = await seedSalesRecords(batch)
      batches.push(result)
      totalInserted += result.inserted
      totalFailed += result.failed

      if (onProgress) {
        onProgress({
          batch: batchNum,
          total: totalBatches,
          inserted: totalInserted,
          failed: totalFailed,
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      batches.push({
        success: false,
        inserted: 0,
        failed: batch.length,
        message: errorMsg,
        errors: [errorMsg],
      })
      totalFailed += batch.length

      if (onProgress) {
        onProgress({
          batch: batchNum,
          total: totalBatches,
          inserted: totalInserted,
          failed: totalFailed,
        })
      }
    }
  }

  return {
    success: totalFailed === 0,
    totalRecords: records.length,
    totalInserted,
    totalFailed,
    batches,
  }
}

/**
 * Transform raw sales order JSON to database schema format
 * Use this to transform records from sales_orders.json before uploading
 */
export interface RawSalesOrder {
  'Sale Date'?: string
  'Customer Name'?: string
  'Customer Address'?: string
  'Order Status'?: string
  'LMI Qualification Type'?: string
  'Program Type'?: string
  'Dwelling Type'?: string
  'Rep Name'?: string
  'Source File'?: string
  [key: string]: string | undefined
}

export function transformSalesRecord(raw: RawSalesOrder): SalesRecordInput {
  return {
    customer_name: raw['Customer Name'] || null,
    address: raw['Customer Address'] || null,
    city: extractCityFromAddress(raw['Customer Address']),
    state: extractStateFromAddress(raw['Customer Address']),
    zip_code: extractZipFromAddress(raw['Customer Address']),
    sale_date: parseDate(raw['Sale Date']) || new Date().toISOString().split('T')[0],
    order_status: mapOrderStatus(raw['Order Status']),
    lmi_type: mapLmiType(raw['LMI Qualification Type'], raw['Program Type']),
    dwelling_type: mapDwellingType(raw['Dwelling Type']),
    kwh: null,
    rep_name: raw['Rep Name'] || null,
    source_file: raw['Source File'] || null,
    zone_id: null,
  }
}

// Helper functions for transformation
function parseDate(dateStr?: string): string | null {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

function extractZipFromAddress(address?: string): string | null {
  if (!address) return null
  const parts = address.split(',')
  for (const part of parts.reverse()) {
    const cleaned = part.trim()
    if (cleaned.length === 5 && /^\d+$/.test(cleaned)) {
      return cleaned
    }
  }
  return null
}

function extractStateFromAddress(address?: string): string | null {
  if (!address) return null
  const parts = address.split(',')
  for (const part of parts) {
    const cleaned = part.trim()
    if (cleaned.length === 2 && /^[A-Z]{2}$/.test(cleaned)) {
      return cleaned
    }
  }
  return null
}

function extractCityFromAddress(address?: string): string | null {
  if (!address) return null
  const parts = address.split(',')
  if (parts.length >= 3) {
    return parts[parts.length - 3].trim()
  } else if (parts.length === 2) {
    return parts[0].trim()
  }
  return null
}

function mapOrderStatus(status?: string): SalesRecordInput['order_status'] {
  if (!status) return 'Draft'
  const s = status.toLowerCase()
  if (s.includes('pending')) return 'Pending'
  if (s.includes('sent')) return 'Sent'
  if (s.includes('payable')) return 'Payable'
  if (s.includes('completed') || s.includes('complete')) return 'Completed'
  if (s.includes('cancelled')) return 'Cancelled'
  if (s.includes('duplicate')) return 'Duplicate'
  if (s.includes('test')) return 'Test'
  if (s.includes('invalid')) return 'Invalid'
  return 'Draft'
}

function mapLmiType(lmi?: string, program?: string): SalesRecordInput['lmi_type'] {
  const combined = `${lmi || ''} ${program || ''}`.toLowerCase()
  if (combined.includes('medicaid')) return 'Medicaid'
  if (combined.includes('snap') || combined.includes('food stamps') || combined.includes('ebt')) return 'SNAP'
  if (combined.includes('liheap') || combined.includes('energy assistance')) return 'LIHEAP'
  if (combined.includes('lifeline') || combined.includes('usac')) return 'Lifeline'
  if (combined.includes('free lunch')) return 'Free Lunch'
  if (combined.includes('reduced lunch')) return 'Reduced Lunch'
  if (combined.includes('lmi')) return 'Other'
  return null
}

function mapDwellingType(dwelling?: string): SalesRecordInput['dwelling_type'] {
  if (!dwelling) return null
  const d = dwelling.toLowerCase()
  if (d.includes('single') || d.includes('sfh')) return 'Single Family Home'
  if (d.includes('apartment') || d.includes('mdu') || d.includes('multi-unit')) return 'Apartment (MDU)'
  if (d.includes('townhouse')) return 'Townhouse'
  if (d.includes('condo')) return 'Condo'
  if (d.includes('mobile')) return 'Mobile Home'
  if (d.includes('commercial')) return 'Commercial'
  return 'Unknown'
}
