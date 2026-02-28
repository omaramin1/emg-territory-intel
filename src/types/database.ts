// Auto-generated types for Supabase schema
// Matches 001_initial_schema.sql

export type OrderStatus = 'Test' | 'Draft' | 'Pending' | 'Sent' | 'Payable' | 'Completed' | 'Cancelled' | 'Duplicate' | 'Invalid'
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'paused'
export type DwellingType = 'Single Family Home' | 'Apartment (MDU)' | 'Townhouse' | 'Condo' | 'Mobile Home' | 'Unknown' | 'Commercial'
export type DemographicCategory = 'majority_white' | 'majority_black' | 'majority_hispanic' | 'majority_asian' | 'diverse' | 'unknown'

export interface Zone {
  id: string
  zone_id: string
  zip_code: string
  city: string
  est_doors: number
  doors_touched: number
  doors_enrolled: number
  untapped_est: number
  saturation_pct: number
  close_rate: number
  total_knocks: number
  days_idle: number
  total_streets_worked: number
  doc_lmi_pct: number
  deploy_score: number
  prospect_score: number
  lmi_types_seen: string[]
  last_worked_date: string | null
  created_at: string
  updated_at: string
}

export interface ZoneDemographics {
  id: string
  zone_id: string
  population: number
  households: number
  median_income: number
  median_home_value: number
  electric_heat_pct: number
  renter_pct: number
  avg_hh_size: number
  kids_pct: number
  large_family_pct: number
  apt_pct: number
  sfh_count: number
  apt_10plus_count: number
  mobile_homes: number
  white_pct: number
  black_pct: number
  hispanic_pct: number
  asian_pct: number
  dominant_demo: DemographicCategory
  rep_match_note: string | null
}

export interface ZoneEligibility {
  id: string
  zone_id: string
  total_hh: number
  avg_hh_size: number
  medicaid_pct: number
  medicaid_eligible_hh: number
  medicaid_threshold: number
  snap_pct: number
  snap_eligible_hh: number
  snap_threshold: number
  liheap_pct: number
  liheap_eligible_hh: number
  liheap_threshold: number
  lifeline_pct: number
  lifeline_eligible_hh: number
  lifeline_threshold: number
  free_lunch_pct: number
  free_lunch_eligible_hh: number
  reduced_lunch_pct: number
  reduced_lunch_eligible_hh: number
  any_program_pct: number
  any_program_eligible_hh: number
  any_program_threshold: number
  target_hh_broad: number
  target_hh_conservative: number
  target_pct_broad: number
  target_pct_conservative: number
}

export interface Street {
  id: string
  zone_id: string
  street_name: string
  doors: number
  enrolled: number
  untapped: number
  close_rate: number
  days_idle: number
  dwelling_type: string
  last_worked_date: string | null
}

export interface Rep {
  id: string
  name: string
  email: string | null
  phone: string | null
  active: boolean
  created_at: string
}

export interface RepAssignment {
  id: string
  rep_id: string
  zone_id: string
  assigned_date: string
  status: AssignmentStatus
  notes: string | null
  created_at: string
}

export interface DailyLog {
  id: string
  rep_id: string
  zone_id: string
  log_date: string
  doors_knocked: number
  doors_enrolled: number
  hours_worked: number
  streets_worked: string[]
  lmi_types_collected: string[]
  notes: string | null
  created_at: string
}

// Composite type for the full zone detail popup
export interface ZoneDetail {
  zone: Zone
  demographics: ZoneDemographics | null
  eligibility: ZoneEligibility | null
  streets: Street[]
  recent_assignments: (RepAssignment & { rep_name?: string })[]
  recent_logs: (DailyLog & { rep_name?: string })[]
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      zones: { Row: Zone; Insert: Omit<Zone, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Zone, 'id'>> }
      zone_demographics: { Row: ZoneDemographics; Insert: Omit<ZoneDemographics, 'id'>; Update: Partial<Omit<ZoneDemographics, 'id'>> }
      zone_eligibility: { Row: ZoneEligibility; Insert: Omit<ZoneEligibility, 'id'>; Update: Partial<Omit<ZoneEligibility, 'id'>> }
      streets: { Row: Street; Insert: Omit<Street, 'id'>; Update: Partial<Omit<Street, 'id'>> }
      reps: { Row: Rep; Insert: Omit<Rep, 'id' | 'created_at'>; Update: Partial<Omit<Rep, 'id'>> }
      rep_assignments: { Row: RepAssignment; Insert: Omit<RepAssignment, 'id' | 'created_at'>; Update: Partial<Omit<RepAssignment, 'id'>> }
      daily_logs: { Row: DailyLog; Insert: Omit<DailyLog, 'id' | 'created_at'>; Update: Partial<Omit<DailyLog, 'id'>> }
    }
  }
}
