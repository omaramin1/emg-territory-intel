import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import deployDataRaw from '../../../../data/deploy_data.json'
import eligDataRaw from '../../../../data/eligibility_by_zip.json'
import thresholdsRaw from '../../../../data/va_benefits_thresholds.json'
import zipProfilesRaw from '../../../../data/zip_profiles.json'

export const dynamic = 'force-dynamic'

// POST /api/seed — Seeds the database from bundled JSON data
export async function POST() {
  // Use untyped client for seed operations (schema doesn't perfectly match TS types)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const deployData = deployDataRaw as Record<string, unknown>
  const eligData = eligDataRaw as Record<string, Record<string, number>>
  const thresholds = thresholdsRaw as Record<string, unknown>
  const zipProfiles = zipProfilesRaw as Record<string, Record<string, unknown>>
  const zones = (deployData.zones as Record<string, unknown>[]) ?? []

  const results: string[] = []

  try {
    // Clear tables
    for (const table of ['daily_logs', 'rep_assignments', 'streets', 'zone_eligibility', 'zone_demographics', 'subsidized_complexes', 'zones', 'reps', 'benefits_thresholds', 'scoring_config']) {
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }
    results.push('Cleared existing data')

    // Insert zones
    const zoneRows = zones.map((z) => ({
      zone_id: z.id as string,
      zip_code: z.zip as string,
      city: z.city as string,
      est_doors: z.est_doors as number,
      doors_touched: z.doors_touched as number,
      doors_enrolled: z.doors_enrolled as number,
      untapped_est: z.untapped_est as number,
      saturation_pct: z.saturation_pct as number,
      close_rate: z.our_close_rate as number,
      total_knocks: z.total_knocks as number,
      days_idle: z.days_idle as number,
      total_streets_worked: z.total_streets_worked as number,
      doc_lmi_pct: z.doc_lmi_pct as number,
      deploy_score: z.deploy_score as number,
      prospect_score: (z.prospect_score as number) ?? 0,
      lmi_types_seen: (z.lmi_types_seen as string[]) ?? [],
    }))

    const { data: insertedZones, error: zErr } = await supabase.from('zones').insert(zoneRows).select('id, zip_code')
    if (zErr) throw new Error(`Zone insert: ${zErr.message}`)
    results.push(`Inserted ${insertedZones!.length} zones`)

    const zipToId = new Map(insertedZones!.map((z: { id: string; zip_code: string }) => [z.zip_code, z.id]))

    // Demographics
    const demoRows = zones.map((z) => {
      const zoneUuid = zipToId.get(z.zip as string)
      if (!zoneUuid) return null
      const profile = zipProfiles?.[z.zip as string]
      return {
        zone_id: zoneUuid,
        population: (z.population as number) ?? (profile?.population as number) ?? 0,
        households: (z.households as number) ?? (profile?.households as number) ?? 0,
        median_income: (z.median_income as number) ?? (profile?.median_income as number) ?? 0,
        median_home_value: (z.median_home_value as number) ?? (profile?.median_home_value as number) ?? 0,
        electric_heat_pct: (z.electric_heat_pct as number) ?? (profile?.electric_heat_pct as number) ?? 0,
        renter_pct: (z.renter_pct as number) ?? (profile?.renter_pct as number) ?? 0,
        avg_hh_size: (z.avg_hh_size as number) ?? (profile?.avg_hh_size as number) ?? 0,
        kids_pct: (z.kids_pct as number) ?? (profile?.kids_pct as number) ?? 0,
        large_family_pct: (z.large_family_pct as number) ?? (profile?.large_family_pct as number) ?? 0,
        apt_pct: (z.apt_pct as number) ?? (profile?.apt_pct as number) ?? 0,
        sfh_count: (z.sfh_count as number) ?? (profile?.sfh as number) ?? 0,
        apt_10plus_count: (z.apt_10plus_count as number) ?? (profile?.apartments_10plus as number) ?? 0,
        mobile_homes: (z.mobile_homes as number) ?? (profile?.mobile_homes as number) ?? 0,
        white_pct: (z.white_pct as number) ?? (profile?.white_pct as number) ?? 0,
        black_pct: (z.black_pct as number) ?? (profile?.black_pct as number) ?? 0,
        hispanic_pct: (z.hispanic_pct as number) ?? (profile?.hispanic_pct as number) ?? 0,
        asian_pct: (z.asian_pct as number) ?? (profile?.asian_pct as number) ?? 0,
        dominant_demo: (z.dominant_demo as string) ?? 'diverse',
        rep_match_note: (z.rep_match_note as string) ?? null,
      }
    }).filter(Boolean)

    const { error: dErr } = await supabase.from('zone_demographics').insert(demoRows)
    if (dErr) throw new Error(`Demographics: ${dErr.message}`)
    results.push(`Inserted ${demoRows.length} demographics`)

    // Eligibility
    const eligRows = Object.entries(eligData).map(([zip, e]) => {
      const zoneUuid = zipToId.get(zip)
      if (!zoneUuid) return null
      return {
        zone_id: zoneUuid,
        total_hh: e.total_hh, avg_hh_size: e.avg_hh_size,
        medicaid_pct: e.medicaid_pct, medicaid_eligible_hh: e.medicaid_eligible_hh, medicaid_threshold: e.medicaid_threshold,
        snap_pct: e.snap_pct, snap_eligible_hh: e.snap_eligible_hh, snap_threshold: e.snap_threshold,
        liheap_pct: e.liheap_pct, liheap_eligible_hh: e.liheap_eligible_hh, liheap_threshold: e.liheap_threshold,
        lifeline_pct: e.lifeline_pct, lifeline_eligible_hh: e.lifeline_eligible_hh, lifeline_threshold: e.lifeline_threshold,
        free_lunch_pct: e.free_lunch_pct, free_lunch_eligible_hh: e.free_lunch_eligible_hh,
        reduced_lunch_pct: e.reduced_lunch_pct, reduced_lunch_eligible_hh: e.reduced_lunch_eligible_hh,
        any_program_pct: e.any_program_pct, any_program_eligible_hh: e.any_program_eligible_hh, any_program_threshold: e.any_program_threshold,
        target_hh_broad: e.target_hh_broad, target_hh_conservative: e.target_hh_conservative,
        target_pct_broad: e.target_pct_broad, target_pct_conservative: e.target_pct_conservative,
      }
    }).filter(Boolean)

    const { error: eErr } = await supabase.from('zone_eligibility').insert(eligRows)
    if (eErr) throw new Error(`Eligibility: ${eErr.message}`)
    results.push(`Inserted ${eligRows.length} eligibility records`)

    // Streets
    let streetCount = 0
    for (const z of zones) {
      const zoneUuid = zipToId.get(z.zip as string)
      const topStreets = z.top_streets as Record<string, unknown>[] | undefined
      if (!zoneUuid || !topStreets) continue
      const streetRows = topStreets.map((s) => ({
        zone_id: zoneUuid,
        street_name: s.name as string,
        doors: (s.doors as number) ?? 0,
        enrolled: (s.enrolled as number) ?? 0,
        untapped: (s.untapped as number) ?? 0,
        close_rate: (s.rate as number) ?? 0,
        days_idle: (s.days_idle as number) ?? 0,
        dwelling_type: (s.dwelling as string) ?? 'Unknown',
      }))
      if (streetRows.length > 0) {
        await supabase.from('streets').insert(streetRows)
        streetCount += streetRows.length
      }
    }
    results.push(`Inserted ${streetCount} streets`)

    // Benefits thresholds
    const programs = (thresholds as Record<string, unknown>).programs as Record<string, Record<string, unknown>>
    if (programs) {
      const thresholdRows = Object.entries(programs).map(([key, p]) => ({
        program_key: key,
        program_name: (p.program_name as string) ?? key,
        fpl_pct: (p.fpl_pct as number) ?? null,
        income_type: (p.income_type as string) ?? 'gross',
        thresholds_by_hh_size: p,
        source: (p.source as string) ?? null,
        effective_date: (p.effective_date as string) ?? null,
      }))
      await supabase.from('benefits_thresholds').insert(thresholdRows)
      results.push(`Inserted ${thresholdRows.length} thresholds`)
    }

    // Scoring config
    const weights = deployData.weights as Record<string, string>
    await supabase.from('scoring_config').insert([
      { config_key: 'weights', config_value: weights, description: 'Deploy scoring weights' },
      { config_key: 'rest_period_days', config_value: { value: 60 }, description: 'Min days before revisit' },
      { config_key: 'min_untapped_pct', config_value: { value: 0.40 }, description: 'Min untapped threshold' },
    ])
    results.push('Inserted scoring config')

    return NextResponse.json({ success: true, results })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message, results }, { status: 500 })
  }
}
