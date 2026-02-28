/**
 * Seed script: Loads all territory data into Supabase
 *
 * Usage:
 *   npx ts-node --esm scripts/seed.ts
 *
 * Or via the Next.js API route: POST /api/seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Path to territory engine data
const DATA_DIR = path.resolve(__dirname, '../../territory_engine')

function loadJSON(filename: string) {
  const fp = path.join(DATA_DIR, filename)
  if (!fs.existsSync(fp)) {
    console.warn(`  Warning: ${filename} not found at ${fp}`)
    return null
  }
  return JSON.parse(fs.readFileSync(fp, 'utf-8'))
}

async function seed() {
  console.log('=== EMG Territory Seed Script ===\n')

  const deployData = loadJSON('deploy_data.json')
  const eligData = loadJSON('eligibility_by_zip.json')
  const zipProfiles = loadJSON('zip_profiles.json')
  const thresholds = loadJSON('va_benefits_thresholds.json')

  if (!deployData) { console.error('deploy_data.json is required'); process.exit(1) }

  const zones = deployData.zones

  // 1. Clear existing data (in reverse dependency order)
  console.log('[1] Clearing existing data...')
  for (const table of ['daily_logs', 'rep_assignments', 'streets', 'zone_eligibility', 'zone_demographics', 'subsidized_complexes', 'zones', 'reps', 'benefits_thresholds', 'scoring_config', 'model_state']) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  Warning clearing ${table}: ${error.message}`)
  }

  // 2. Insert zones
  console.log(`[2] Inserting ${zones.length} zones...`)
  const zoneRows = zones.map((z: Record<string, unknown>) => ({
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
  if (zErr) { console.error('Zone insert error:', zErr.message); process.exit(1) }
  console.log(`  Inserted ${insertedZones!.length} zones`)

  // Build ZIP -> UUID map
  const zipToId = new Map(insertedZones!.map((z: { id: string; zip_code: string }) => [z.zip_code, z.id]))

  // 3. Insert zone demographics
  console.log('[3] Inserting demographics...')
  const demoRows = zones.map((z: Record<string, unknown>) => {
    const zoneUuid = zipToId.get(z.zip as string)
    if (!zoneUuid) return null
    // Try to get from zip_profiles first, fall back to deploy_data fields
    const profile = zipProfiles?.[z.zip as string]
    return {
      zone_id: zoneUuid,
      population: (z.population as number) ?? profile?.population ?? 0,
      households: (z.households as number) ?? profile?.households ?? 0,
      median_income: (z.median_income as number) ?? profile?.median_income ?? 0,
      median_home_value: (z.median_home_value as number) ?? profile?.median_home_value ?? 0,
      electric_heat_pct: (z.electric_heat_pct as number) ?? profile?.electric_heat_pct ?? 0,
      renter_pct: (z.renter_pct as number) ?? profile?.renter_pct ?? 0,
      avg_hh_size: (z.avg_hh_size as number) ?? profile?.avg_hh_size ?? 0,
      kids_pct: (z.kids_pct as number) ?? profile?.kids_pct ?? 0,
      large_family_pct: (z.large_family_pct as number) ?? profile?.large_family_pct ?? 0,
      apt_pct: (z.apt_pct as number) ?? profile?.apt_pct ?? 0,
      sfh_count: (z.sfh_count as number) ?? profile?.sfh ?? 0,
      apt_10plus_count: (z.apt_10plus_count as number) ?? profile?.apartments_10plus ?? 0,
      mobile_homes: (z.mobile_homes as number) ?? profile?.mobile_homes ?? 0,
      white_pct: (z.white_pct as number) ?? profile?.white_pct ?? 0,
      black_pct: (z.black_pct as number) ?? profile?.black_pct ?? 0,
      hispanic_pct: (z.hispanic_pct as number) ?? profile?.hispanic_pct ?? 0,
      asian_pct: (z.asian_pct as number) ?? profile?.asian_pct ?? 0,
      dominant_demo: (z.dominant_demo as string) ?? 'diverse',
      rep_match_note: (z.rep_match_note as string) ?? null,
    }
  }).filter(Boolean)

  const { error: dErr } = await supabase.from('zone_demographics').insert(demoRows)
  if (dErr) console.error('Demographics insert error:', dErr.message)
  else console.log(`  Inserted ${demoRows.length} demographics rows`)

  // 4. Insert zone eligibility
  console.log('[4] Inserting eligibility data...')
  if (eligData) {
    const eligRows = Object.entries(eligData).map(([zip, e]: [string, unknown]) => {
      const zoneUuid = zipToId.get(zip)
      if (!zoneUuid) return null
      const ed = e as Record<string, number>
      return {
        zone_id: zoneUuid,
        total_hh: ed.total_hh,
        avg_hh_size: ed.avg_hh_size,
        medicaid_pct: ed.medicaid_pct,
        medicaid_eligible_hh: ed.medicaid_eligible_hh,
        medicaid_threshold: ed.medicaid_threshold,
        snap_pct: ed.snap_pct,
        snap_eligible_hh: ed.snap_eligible_hh,
        snap_threshold: ed.snap_threshold,
        liheap_pct: ed.liheap_pct,
        liheap_eligible_hh: ed.liheap_eligible_hh,
        liheap_threshold: ed.liheap_threshold,
        lifeline_pct: ed.lifeline_pct,
        lifeline_eligible_hh: ed.lifeline_eligible_hh,
        lifeline_threshold: ed.lifeline_threshold,
        free_lunch_pct: ed.free_lunch_pct,
        free_lunch_eligible_hh: ed.free_lunch_eligible_hh,
        reduced_lunch_pct: ed.reduced_lunch_pct,
        reduced_lunch_eligible_hh: ed.reduced_lunch_eligible_hh,
        any_program_pct: ed.any_program_pct,
        any_program_eligible_hh: ed.any_program_eligible_hh,
        any_program_threshold: ed.any_program_threshold,
        target_hh_broad: ed.target_hh_broad,
        target_hh_conservative: ed.target_hh_conservative,
        target_pct_broad: ed.target_pct_broad,
        target_pct_conservative: ed.target_pct_conservative,
      }
    }).filter(Boolean)

    const { error: eErr } = await supabase.from('zone_eligibility').insert(eligRows)
    if (eErr) console.error('Eligibility insert error:', eErr.message)
    else console.log(`  Inserted ${eligRows.length} eligibility rows`)
  }

  // 5. Insert streets
  console.log('[5] Inserting streets...')
  let streetCount = 0
  for (const z of zones) {
    const zoneUuid = zipToId.get(z.zip)
    if (!zoneUuid || !z.top_streets) continue
    const streetRows = z.top_streets.map((s: Record<string, unknown>) => ({
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
      const { error } = await supabase.from('streets').insert(streetRows)
      if (error) console.warn(`  Street insert for ${z.zip}: ${error.message}`)
      else streetCount += streetRows.length
    }
  }
  console.log(`  Inserted ${streetCount} street records`)

  // 6. Insert subsidized complexes
  console.log('[6] Inserting subsidized complexes...')
  let complexCount = 0
  for (const z of zones) {
    const zoneUuid = zipToId.get(z.zip)
    if (!zoneUuid || !z.subsidized_complexes || z.subsidized_complexes.length === 0) continue
    const rows = z.subsidized_complexes.map((c: Record<string, unknown>) => ({
      zone_id: zoneUuid,
      name: (c.name as string) ?? 'Unknown',
      address: (c.address as string) ?? null,
      unit_count: (c.units as number) ?? null,
      program_type: (c.program as string) ?? null,
    }))
    const { error } = await supabase.from('subsidized_complexes').insert(rows)
    if (error) console.warn(`  Complex insert for ${z.zip}: ${error.message}`)
    else complexCount += rows.length
  }
  console.log(`  Inserted ${complexCount} subsidized complexes`)

  // 7. Insert benefits thresholds
  console.log('[7] Inserting benefits thresholds...')
  if (thresholds?.programs) {
    const thresholdRows = Object.entries(thresholds.programs).map(([key, prog]: [string, unknown]) => {
      const p = prog as Record<string, unknown>
      return {
        program_key: key,
        program_name: (p.program_name as string) ?? key,
        fpl_pct: (p.fpl_pct as number) ?? (p.gross_income_fpl_pct as number) ?? (p.free_meals_fpl_pct as number) ?? null,
        income_type: (p.income_type as string) ?? (p.gross_income_type as string) ?? 'gross',
        thresholds_by_hh_size: p,
        source: (p.source as string) ?? null,
        effective_date: (p.effective_date as string) ?? null,
      }
    })
    const { error } = await supabase.from('benefits_thresholds').insert(thresholdRows)
    if (error) console.error('Thresholds insert error:', error.message)
    else console.log(`  Inserted ${thresholdRows.length} threshold records`)
  }

  // 8. Insert scoring config
  console.log('[8] Inserting scoring config...')
  const configRows = [
    { config_key: 'weights', config_value: deployData.weights, description: 'Deploy scoring weights' },
    { config_key: 'rest_period_days', config_value: { value: 60 }, description: 'Min days before revisiting territory' },
    { config_key: 'min_untapped_pct', config_value: { value: 0.40 }, description: 'Min % untapped before revisit' },
    { config_key: 'min_sales_for_scoring', config_value: { value: 5 }, description: 'Min sales to score a ZIP reliably' },
    { config_key: 'learning_rate', config_value: { value: 0.05 }, description: 'How fast weights shift per cycle' },
  ]
  const { error: cErr } = await supabase.from('scoring_config').insert(configRows)
  if (cErr) console.error('Config insert error:', cErr.message)
  else console.log(`  Inserted ${configRows.length} config records`)

  console.log('\n=== Seed complete! ===')
  console.log(`  Zones: ${insertedZones!.length}`)
  console.log(`  Streets: ${streetCount}`)
  console.log(`  Complexes: ${complexCount}`)
}

seed().catch(console.error)
