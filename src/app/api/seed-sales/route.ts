import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Type definitions for the request body
interface SalesRecordInput {
  customer_name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  sale_date: string // ISO date string
  order_status: 'Test' | 'Draft' | 'Pending' | 'Sent' | 'Payable' | 'Completed' | 'Cancelled' | 'Duplicate' | 'Invalid'
  lmi_type?: 'Medicaid' | 'SNAP' | 'LIHEAP' | 'Lifeline' | 'Free Lunch' | 'Reduced Lunch' | 'Other' | null
  dwelling_type?: 'Single Family Home' | 'Apartment (MDU)' | 'Townhouse' | 'Condo' | 'Mobile Home' | 'Unknown' | 'Commercial' | null
  kwh?: number | null
  rep_name?: string | null
  source_file?: string | null
  zone_id?: string | null
}

interface SeedRequest {
  records: SalesRecordInput[]
  clear_first?: boolean
}

interface SeedResponse {
  success: boolean
  inserted: number
  failed: number
  errors?: string[]
  message: string
}

// POST /api/seed-sales — Seeds sales_records table with chunked data
export async function POST(request: NextRequest): Promise<NextResponse<SeedResponse>> {
  try {
    const body = (await request.json()) as SeedRequest

    if (!body.records || !Array.isArray(body.records)) {
      return NextResponse.json(
        { success: false, inserted: 0, failed: 0, message: 'Invalid request: records array required' },
        { status: 400 }
      )
    }

    if (body.records.length === 0) {
      return NextResponse.json(
        { success: false, inserted: 0, failed: 0, message: 'No records provided' },
        { status: 400 }
      )
    }

    if (body.records.length > 1000) {
      return NextResponse.json(
        { success: false, inserted: 0, failed: 0, message: 'Maximum 1000 records per request' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    let successCount = 0
    let failureCount = 0
    const errors: string[] = []

    // Insert records
    const { error } = await supabase.from('sales_records').insert(body.records)

    if (error) {
      // Return partial success if possible
      return NextResponse.json(
        {
          success: false,
          inserted: successCount,
          failed: body.records.length,
          errors: [error.message],
          message: `Insert failed: ${error.message}`,
        },
        { status: 500 }
      )
    }

    successCount = body.records.length

    return NextResponse.json({
      success: true,
      inserted: successCount,
      failed: failureCount,
      message: `Successfully inserted ${successCount} sales records`,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        inserted: 0,
        failed: 0,
        errors: [errorMsg],
        message: `Request processing failed: ${errorMsg}`,
      },
      { status: 500 }
    )
  }
}

// GET /api/seed-sales — Health check and documentation
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/seed-sales',
    method: 'POST',
    description: 'Bulk insert sales records (chunked upload)',
    max_records_per_request: 1000,
    schema: {
      records: [
        {
          customer_name: 'string or null',
          address: 'string or null',
          city: 'string or null',
          state: 'string or null (2 chars)',
          zip_code: 'string or null (5 digits)',
          sale_date: 'ISO date string (required)',
          order_status: 'Test | Draft | Pending | Sent | Payable | Completed | Cancelled | Duplicate | Invalid',
          lmi_type: 'Medicaid | SNAP | LIHEAP | Lifeline | Free Lunch | Reduced Lunch | Other | null',
          dwelling_type: 'Single Family Home | Apartment (MDU) | Townhouse | Condo | Mobile Home | Unknown | Commercial | null',
          kwh: 'number or null',
          rep_name: 'string or null',
          source_file: 'string or null',
          zone_id: 'UUID or null',
        },
      ],
      clear_first: 'boolean (optional, default: false)',
    },
    example: {
      records: [
        {
          customer_name: 'John Doe',
          address: '123 Main St, Springfield, IL, 62701',
          city: 'Springfield',
          state: 'IL',
          zip_code: '62701',
          sale_date: '2026-02-22',
          order_status: 'Sent',
          lmi_type: 'Medicaid',
          dwelling_type: 'Single Family Home',
          kwh: null,
          rep_name: 'Jane Smith',
          source_file: 'Sales Orders Report.xlsx',
          zone_id: null,
        },
      ],
    },
  })
}
