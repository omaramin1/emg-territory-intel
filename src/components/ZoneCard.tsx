'use client'

interface ZoneCardData {
  id: string
  zone_id: string
  zip_code: string
  city: string
  deploy_score: number
  close_rate: number
  untapped_est: number
  saturation_pct: number
  days_idle: number
  doors_enrolled: number
  total_knocks: number
  est_doors: number
  // Eligibility
  any_program_pct?: number
  any_program_eligible_hh?: number
  target_hh_broad?: number
  target_pct_broad?: number
  electric_heat_pct?: number
  snap_pct?: number
  medicaid_pct?: number
  // Demographics
  dominant_demo?: string
  white_pct?: number
  black_pct?: number
  hispanic_pct?: number
  asian_pct?: number
  median_income?: number
  population?: number
  rep_match_note?: string
}

interface Props {
  zone: ZoneCardData
  rank: number
  onClick: () => void
}

export default function ZoneCard({ zone, rank, onClick }: Props) {
  const z = zone
  const scoreColor = z.deploy_score >= 0.6 ? '#22c55e' : z.deploy_score >= 0.4 ? '#eab308' : '#ef4444'
  const tierLabel = (z.any_program_pct ?? 0) >= 35 ? 'HOT' : (z.any_program_pct ?? 0) >= 20 ? 'WARM' : 'COOL'
  const tierBg = tierLabel === 'HOT' ? 'bg-red-900/40 border-red-700/50' : tierLabel === 'WARM' ? 'bg-amber-900/40 border-amber-700/50' : 'bg-blue-900/40 border-blue-700/50'

  return (
    <div onClick={onClick}
         className={`cursor-pointer rounded-xl border p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${tierBg}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">#{rank}</span>
            <h3 className="text-lg font-bold text-white">{z.city}</h3>
          </div>
          <span className="text-xs font-mono text-gray-400">{z.zip_code}</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-black font-mono" style={{ color: scoreColor }}>{z.deploy_score.toFixed(2)}</div>
          <div className="text-[9px] text-gray-500 uppercase">Score</div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
        <div className="bg-black/30 rounded-lg py-1.5 px-1">
          <div className="text-sm font-bold text-green-400">{z.target_hh_broad?.toLocaleString() ?? '—'}</div>
          <div className="text-[9px] text-gray-500">Target Doors</div>
        </div>
        <div className="bg-black/30 rounded-lg py-1.5 px-1">
          <div className="text-sm font-bold text-blue-400">{z.any_program_pct?.toFixed(0) ?? '—'}%</div>
          <div className="text-[9px] text-gray-500">Benefits</div>
        </div>
        <div className="bg-black/30 rounded-lg py-1.5 px-1">
          <div className="text-sm font-bold" style={{ color: z.close_rate >= 0.5 ? '#22c55e' : z.close_rate >= 0.3 ? '#eab308' : '#ef4444' }}>
            {(z.close_rate * 100).toFixed(0)}%
          </div>
          <div className="text-[9px] text-gray-500">Close Rate</div>
        </div>
      </div>

      {/* Benefits mini-bar */}
      {z.any_program_pct != null && (
        <div className="mb-3">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
            {z.snap_pct != null && <div style={{ width: `${Math.min(z.snap_pct, 100)}%`, backgroundColor: '#48bb78' }} />}
            {z.medicaid_pct != null && <div style={{ width: `${Math.min(z.medicaid_pct, 100)}%`, backgroundColor: '#4299e1' }} />}
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
            <span>SNAP {z.snap_pct?.toFixed(0)}%</span>
            <span>Medicaid {z.medicaid_pct?.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Demographics mini */}
      <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
        {z.white_pct != null && <div style={{ width: `${z.white_pct}%`, backgroundColor: '#94a3b8' }} />}
        {z.black_pct != null && <div style={{ width: `${z.black_pct}%`, backgroundColor: '#7c3aed' }} />}
        {z.hispanic_pct != null && <div style={{ width: `${z.hispanic_pct}%`, backgroundColor: '#f59e0b' }} />}
        {z.asian_pct != null && <div style={{ width: `${z.asian_pct}%`, backgroundColor: '#10b981' }} />}
      </div>

      {/* Bottom stats */}
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{z.est_doors.toLocaleString()} doors</span>
        <span>{z.electric_heat_pct?.toFixed(0) ?? '—'}% elec heat</span>
        <span>{z.days_idle}d idle</span>
      </div>
    </div>
  )
}
