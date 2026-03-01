/**
 * Shared configuration constants for EMG Territory Intelligence.
 * Single source of truth for thresholds, scoring tiers, and display config.
 */

// ---------------------------------------------------------------------------
// Zone Tier Thresholds (based on any-program benefits eligibility %)
// ---------------------------------------------------------------------------

export const TIER_THRESHOLDS = {
  HOT: 35,   // >= 35% any-program eligibility
  WARM: 20,  // >= 20% and < 35%
  // COOL: everything below 20%
} as const

export type Tier = 'all' | 'hot' | 'warm' | 'cool'

export function getZoneTier(anyProgramPct: number | undefined | null): 'HOT' | 'WARM' | 'COOL' {
  const pct = anyProgramPct ?? 0
  if (pct >= TIER_THRESHOLDS.HOT) return 'HOT'
  if (pct >= TIER_THRESHOLDS.WARM) return 'WARM'
  return 'COOL'
}

// ---------------------------------------------------------------------------
// Deploy Score Color Coding
// ---------------------------------------------------------------------------

export const SCORE_THRESHOLDS = {
  HIGH: 0.6,
  MEDIUM: 0.4,
} as const

export const SCORE_COLORS = {
  HIGH: '#22c55e',   // green-500
  MEDIUM: '#eab308', // yellow-500
  LOW: '#ef4444',    // red-500
} as const

export function getScoreColor(deployScore: number): string {
  if (deployScore >= SCORE_THRESHOLDS.HIGH) return SCORE_COLORS.HIGH
  if (deployScore >= SCORE_THRESHOLDS.MEDIUM) return SCORE_COLORS.MEDIUM
  return SCORE_COLORS.LOW
}

// ---------------------------------------------------------------------------
// Close Rate Color Coding
// ---------------------------------------------------------------------------

export const CLOSE_RATE_THRESHOLDS = {
  HIGH: 0.5,
  MEDIUM: 0.3,
} as const

export function getCloseRateColor(closeRate: number): string {
  if (closeRate >= CLOSE_RATE_THRESHOLDS.HIGH) return SCORE_COLORS.HIGH
  if (closeRate >= CLOSE_RATE_THRESHOLDS.MEDIUM) return SCORE_COLORS.MEDIUM
  return SCORE_COLORS.LOW
}

// ---------------------------------------------------------------------------
// Tier Display Styles
// ---------------------------------------------------------------------------

export const TIER_STYLES = {
  HOT: { bg: 'bg-red-900/40 border-red-700/50', color: '#ef4444', label: 'HOT' },
  WARM: { bg: 'bg-amber-900/40 border-amber-700/50', color: '#f59e0b', label: 'WARM' },
  COOL: { bg: 'bg-blue-900/40 border-blue-700/50', color: '#3b82f6', label: 'COOL' },
} as const

// ---------------------------------------------------------------------------
// Demographic Bar Colors
// ---------------------------------------------------------------------------

export const DEMO_COLORS = {
  WHITE: '#94a3b8',
  BLACK: '#7c3aed',
  HISPANIC: '#f59e0b',
  ASIAN: '#10b981',
  OTHER: '#475569',
} as const

// ---------------------------------------------------------------------------
// API & Batch Limits
// ---------------------------------------------------------------------------

export const BATCH_SIZE = 500
export const MAX_RECORDS_PER_REQUEST = 1000
export const REST_PERIOD_DAYS = 60

// ---------------------------------------------------------------------------
// Regions (Vercel deployment)
// ---------------------------------------------------------------------------

export const DEPLOY_REGION = 'iad1' // US East (Virginia) — closest to Dominion territory
