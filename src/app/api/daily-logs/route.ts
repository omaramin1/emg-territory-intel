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
  const body = await req.json()
  const { data, error } = await supabase.from('daily_logs').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
