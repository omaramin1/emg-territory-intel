'use client'

import type { ZoneCardData } from '@/types/database'
import { getZoneTier, getScoreColor, getCloseRateColor, TIER_STYLES, DEMO_COLORS } from '@/lib/constants'

interface Props {
  zone: ZoneCardData
  rank: number
  onClick: () => void
}

export default function ZoneCard({ zone, rank, onClick }: Props) {
  const z = zone
  const scoreColor = getScoreColor(z.deploy_score)
  const tier = getZoneTier(z.any_program_pct)
  const tierStyle = TIER_STYLES[tier]

  return (
    <div onClick={onClick}
         className={`cursor-pointer rounded-xl border p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${tierStyle.bg}`}>
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
          <div className="text-sm font-bold" style={{ color: getCloseRateColor(z.close_rate) }}>
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
        {z.white_pct != null && <div style={{ width: `${z.white_pct}%`, backgroundColor: DEMO_COLORS.WHITE }} />}
        {z.black_pct != null && <div style={{ width: `${z.black_pct}%`, backgroundColor: DEMO_COLORS.BLACK }} />}
        {z.hispanic_pct != null && <div style={{ width: `${z.hispanic_pct}%`, backgroundColor: DEMO_COLORS.HISPANIC }} />}
        {z.asian_pct != null && <div style={{ width: `${z.asian_pct}%`, backgroundColor: DEMO_COLORS.ASIAN }} />}
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
