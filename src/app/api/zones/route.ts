import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()

  // Get all zones with demographics and eligibility joined
  const { data: zones, error: zErr } = await supabase.from('zones').select('*').order('deploy_score', { ascending: false })
  if (zErr) return NextResponse.json({ error: zErr.message }, { status: 500 })

  const { data: demographics } = await supabase.from('zone_demographics').select('*')
  const { data: eligibility } = await supabase.from('zone_eligibility').select('*')

  const demoMap = new Map((demographics ?? []).map(d => [d.zone_id, d]))
  const eligMap = new Map((eligibility ?? []).map(e => [e.zone_id, e]))

  // Flatten for card display
  const result = (zones ?? []).map(z => {
    const d = demoMap.get(z.id)
    const e = eligMap.get(z.id)
    return {
      id: z.id,
      zone_id: z.zone_id,
      zip_code: z.zip_code,
      city: z.city,
      deploy_score: z.deploy_score,
      close_rate: z.close_rate,
      untapped_est: z.untapped_est,
      saturation_pct: z.saturation_pct,
      days_idle: z.days_idle,
      doors_enrolled: z.doors_enrolled,
      total_knocks: z.total_knocks,
      est_doors: z.est_doors,
      // Eligibility
      any_program_pct: e?.any_program_pct ?? null,
      any_program_eligible_hh: e?.any_program_eligible_hh ?? null,
      target_hh_broad: e?.target_hh_broad ?? null,
      target_pct_broad: e?.target_pct_broad ?? null,
      snap_pct: e?.snap_pct ?? null,
      medicaid_pct: e?.medicaid_pct ?? null,
      electric_heat_pct: d?.electric_heat_pct ?? null,
      // Demographics
      dominant_demo: d?.dominant_demo ?? null,
      white_pct: d?.white_pct ?? null,
      black_pct: d?.black_pct ?? null,
      hispanic_pct: d?.hispanic_pct ?? null,
      asian_pct: d?.asian_pct ?? null,
      median_income: d?.median_income ?? null,
      population: d?.population ?? null,
      rep_match_note: d?.rep_match_note ?? null,
    }
  })

  return NextResponse.json(result)
}
