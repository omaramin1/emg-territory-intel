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
  const body = await req.json()
  const { data, error } = await supabase
    .from('rep_assignments')
    .insert({ ...body, status: 'assigned' })
    .select('*, reps(name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
