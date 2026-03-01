import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const zoneId = searchParams.get('zone_id')
  const repId = searchParams.get('rep_id')

  let query = supabase.from('daily_logs').select('*, reps(name), zones(city, zip_code)').order('log_date', { ascending: false })
  if (zoneId) query = query.eq('zone_id', zoneId)
  if (repId) query = query.eq('rep_id', repId)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createServerClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  const { rep_id, zone_id, log_date, doors_knocked, doors_enrolled, hours_worked } = body
  if (!rep_id || typeof rep_id !== 'string') {
    return NextResponse.json({ error: 'rep_id is required (UUID string)' }, { status: 400 })
  }
  if (!zone_id || typeof zone_id !== 'string') {
    return NextResponse.json({ error: 'zone_id is required (UUID string)' }, { status: 400 })
  }
  if (!log_date || typeof log_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(log_date)) {
    return NextResponse.json({ error: 'log_date is required (YYYY-MM-DD format)' }, { status: 400 })
  }
  if (typeof doors_knocked !== 'number' || doors_knocked < 0) {
    return NextResponse.json({ error: 'doors_knocked is required (non-negative number)' }, { status: 400 })
  }
  if (typeof doors_enrolled !== 'number' || doors_enrolled < 0) {
    return NextResponse.json({ error: 'doors_enrolled is required (non-negative number)' }, { status: 400 })
  }
  if (typeof hours_worked !== 'number' || hours_worked < 0) {
    return NextResponse.json({ error: 'hours_worked is required (non-negative number)' }, { status: 400 })
  }

  const insert = {
    rep_id,
    zone_id,
    log_date,
    doors_knocked,
    doors_enrolled,
    hours_worked,
    streets_worked: Array.isArray(body.streets_worked) ? body.streets_worked : [],
    lmi_types_collected: Array.isArray(body.lmi_types_collected) ? body.lmi_types_collected : [],
    notes: typeof body.notes === 'string' ? body.notes : null,
  }

  const { data, error } = await supabase.from('daily_logs').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
