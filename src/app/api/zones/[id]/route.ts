import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  // Fetch zone
  const { data: zone, error: zErr } = await supabase.from('zones').select('*').eq('id', id).single()
  if (zErr || !zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })

  // Fetch related data in parallel
  const [demoRes, eligRes, streetsRes, assignRes, logsRes] = await Promise.all([
    supabase.from('zone_demographics').select('*').eq('zone_id', id).single(),
    supabase.from('zone_eligibility').select('*').eq('zone_id', id).single(),
    supabase.from('streets').select('*').eq('zone_id', id).order('untapped', { ascending: false }).limit(50),
    supabase.from('rep_assignments').select('*, reps(name)').eq('zone_id', id).order('assigned_date', { ascending: false }).limit(10),
    supabase.from('daily_logs').select('*, reps(name)').eq('zone_id', id).order('log_date', { ascending: false }).limit(10),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapWithRepName = (items: any[]) => items.map((item) => ({
    ...item,
    rep_name: item.reps?.name ?? undefined,
  }))

  const result = {
    zone,
    demographics: demoRes.data ?? null,
    eligibility: eligRes.data ?? null,
    streets: streetsRes.data ?? [],
    recent_assignments: mapWithRepName(assignRes.data ?? []),
    recent_logs: mapWithRepName(logsRes.data ?? []),
  }

  return NextResponse.json(result)
}
