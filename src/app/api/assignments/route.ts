import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const zoneId = searchParams.get('zone_id')

  let query = supabase.from('rep_assignments').select('*, reps(name)').order('assigned_date', { ascending: false })
  if (zoneId) query = query.eq('zone_id', zoneId)

  const { data, error } = await query.limit(50)
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
  const { zone_id, rep_id, assigned_date } = body
  if (!zone_id || typeof zone_id !== 'string') {
    return NextResponse.json({ error: 'zone_id is required (UUID string)' }, { status: 400 })
  }
  if (!rep_id || typeof rep_id !== 'string') {
    return NextResponse.json({ error: 'rep_id is required (UUID string)' }, { status: 400 })
  }
  if (!assigned_date || typeof assigned_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(assigned_date)) {
    return NextResponse.json({ error: 'assigned_date is required (YYYY-MM-DD format)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('rep_assignments')
    .insert({
      zone_id,
      rep_id,
      assigned_date,
      status: 'assigned',
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select('*, reps(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
