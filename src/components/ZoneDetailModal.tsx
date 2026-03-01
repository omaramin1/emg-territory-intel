'use client'

import { useState } from 'react'
import type { ZoneDetail, Rep } from '@/types/database'
import { getZoneTier, getScoreColor, getCloseRateColor, TIER_STYLES, DEMO_COLORS, REST_PERIOD_DAYS } from '@/lib/constants'

interface Props {
  zone: ZoneDetail
  reps: Rep[]
  onClose: () => void
  onAssignRep: (zoneId: string, repId: string) => Promise<void>
}

function ScoreBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-14 text-right font-mono text-gray-300">{value.toFixed(1)}%</span>
    </div>
  )
}

function DemoBar({ white, black, hispanic, asian }: { white: number; black: number; hispanic: number; asian: number }) {
  const other = Math.max(0, 100 - white - black - hispanic - asian)
  return (
    <div className="space-y-1">
      <div className="flex h-4 rounded-full overflow-hidden">
        {white > 0 && <div style={{ width: `${white}%`, backgroundColor: DEMO_COLORS.WHITE }} title={`White ${white.toFixed(1)}%`} />}
        {black > 0 && <div style={{ width: `${black}%`, backgroundColor: DEMO_COLORS.BLACK }} title={`Black ${black.toFixed(1)}%`} />}
        {hispanic > 0 && <div style={{ width: `${hispanic}%`, backgroundColor: DEMO_COLORS.HISPANIC }} title={`Hispanic ${hispanic.toFixed(1)}%`} />}
        {asian > 0 && <div style={{ width: `${asian}%`, backgroundColor: DEMO_COLORS.ASIAN }} title={`Asian ${asian.toFixed(1)}%`} />}
        {other > 0 && <div style={{ width: `${other}%`, backgroundColor: DEMO_COLORS.OTHER }} title={`Other ${other.toFixed(1)}%`} />}
      </div>
      <div className="flex gap-3 text-[10px] text-gray-400 flex-wrap">
        <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: DEMO_COLORS.WHITE }} />White {white.toFixed(0)}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: DEMO_COLORS.BLACK }} />Black {black.toFixed(0)}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: DEMO_COLORS.HISPANIC }} />Hispanic {hispanic.toFixed(0)}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: DEMO_COLORS.ASIAN }} />Asian {asian.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-white mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  )
}

export default function ZoneDetailModal({ zone, reps, onClose, onAssignRep }: Props) {
  const [selectedRep, setSelectedRep] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showAllStreets, setShowAllStreets] = useState(false)
  const { zone: z, demographics: d, eligibility: e, streets, recent_assignments, recent_logs } = zone

  const scoreColor = getScoreColor(z.deploy_score)
  const tier = getZoneTier(e?.any_program_pct)
  const tierStyle = TIER_STYLES[tier]

  const handleAssign = async () => {
    if (!selectedRep) return
    setAssigning(true)
    try {
      await onAssignRep(z.id, selectedRep)
    } finally {
      setAssigning(false)
    }
  }

  const streetsToShow = showAllStreets ? streets : streets.slice(0, 8)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-[#0f172a] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl mx-4"
           onClick={ev => ev.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{z.city}</h2>
              <span className="text-sm font-mono text-gray-400">ZIP {z.zip_code}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: tierStyle.color, color: '#fff' }}>
                {tierStyle.label}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{z.zone_id}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: scoreColor }}>{z.deploy_score.toFixed(2)}</div>
              <div className="text-[10px] text-gray-500 uppercase">Deploy Score</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* KEY DECISION METRICS */}
          <div className="grid grid-cols-5 gap-2">
            <Stat label="Target Doors" value={e?.target_hh_broad?.toLocaleString() ?? '—'} sub="Eligible + Dominion" />
            <Stat label="Any Benefit %" value={`${e?.any_program_pct?.toFixed(1) ?? '—'}%`} sub={`${e?.any_program_eligible_hh?.toLocaleString() ?? '—'} HH`} />
            <Stat label="Untapped" value={`${(100 - z.saturation_pct).toFixed(1)}%`} sub={`${z.untapped_est.toLocaleString()} doors`} />
            <Stat label="Close Rate" value={`${(z.close_rate * 100).toFixed(1)}%`} sub={`${z.doors_enrolled}/${z.total_knocks}`} />
            <Stat label="Days Idle" value={z.days_idle} sub={z.days_idle >= REST_PERIOD_DAYS ? 'Ready' : `${REST_PERIOD_DAYS - z.days_idle}d until rest`} />
          </div>

          {/* BENEFITS ELIGIBILITY */}
          {e && (
            <div className="bg-gray-900/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                Benefits Eligibility — Estimated Qualifying Households
              </h3>
              <div className="space-y-2">
                <ScoreBar value={e.snap_pct} max={50} color="#48bb78" label="SNAP/EBT" />
                <ScoreBar value={e.medicaid_pct} max={50} color="#4299e1" label="Medicaid" />
                <ScoreBar value={e.liheap_pct} max={50} color="#ed8936" label="LIHEAP" />
                <ScoreBar value={e.lifeline_pct} max={50} color="#9f7aea" label="Lifeline" />
                <ScoreBar value={e.free_lunch_pct} max={50} color="#38b2ac" label="Free Lunch" />
                <ScoreBar value={e.reduced_lunch_pct} max={50} color="#319795" label="Reduced Lunch" />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-3 gap-4 text-xs text-gray-400">
                <div>
                  <span className="block text-white font-bold text-base">{e.any_program_eligible_hh.toLocaleString()}</span>
                  Any-program eligible HH
                </div>
                <div>
                  <span className="block text-white font-bold text-base">{e.target_hh_broad.toLocaleString()}</span>
                  Target (eligible + elec heat)
                </div>
                <div>
                  <span className="block text-white font-bold text-base">{e.target_hh_conservative.toLocaleString()}</span>
                  Conservative target
                </div>
              </div>
              <div className="mt-2 text-[10px] text-gray-500">
                Based on {e.total_hh.toLocaleString()} total HH | Avg HH size: {e.avg_hh_size} |
                Thresholds: SNAP ≤${e.snap_threshold?.toLocaleString()}/yr, Medicaid ≤${e.medicaid_threshold?.toLocaleString()}/yr (HH of {e.avg_hh_size.toFixed(0)})
              </div>
            </div>
          )}

          {/* DEMOGRAPHICS & REP RECOMMENDATION */}
          {d && (
            <div className="bg-gray-900/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                Demographics & Rep Match
              </h3>
              <DemoBar white={d.white_pct} black={d.black_pct} hispanic={d.hispanic_pct} asian={d.asian_pct} />
              {d.rep_match_note && (
                <div className="mt-2 px-3 py-2 bg-blue-900/30 border border-blue-800/50 rounded-lg text-sm text-blue-200">
                  <strong>Rep recommendation:</strong> {d.rep_match_note}
                </div>
              )}
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <Stat label="Population" value={d.population.toLocaleString()} />
                <Stat label="Households" value={d.households.toLocaleString()} />
                <Stat label="Median Income" value={`$${(d.median_income / 1000).toFixed(0)}K`} />
                <Stat label="Elec Heat" value={`${d.electric_heat_pct.toFixed(0)}%`} sub="Dominion proxy" />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <Stat label="Renters" value={`${d.renter_pct.toFixed(0)}%`} />
                <Stat label="Avg HH Size" value={d.avg_hh_size.toFixed(1)} />
                <Stat label="Families w/Kids" value={`${d.kids_pct.toFixed(0)}%`} />
                <Stat label="SFH Count" value={d.sfh_count.toLocaleString()} />
              </div>
            </div>
          )}

          {/* SALES PERFORMANCE & LMI TYPES */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Sales Performance</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Doors Touched</span><span className="text-white font-mono">{z.doors_touched}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Doors Enrolled</span><span className="text-white font-mono">{z.doors_enrolled}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Total Knocks</span><span className="text-white font-mono">{z.total_knocks}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Close Rate</span><span className="font-mono" style={{ color: getCloseRateColor(z.close_rate) }}>{(z.close_rate * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Saturation</span><span className="text-white font-mono">{z.saturation_pct.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-gray-400">LMI Doc Rate</span><span className="text-white font-mono">{(z.doc_lmi_pct * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Streets Worked</span><span className="text-white font-mono">{z.total_streets_worked}</span></div>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">LMI Documents Seen</h3>
              <div className="flex flex-wrap gap-1.5">
                {z.lmi_types_seen && z.lmi_types_seen.length > 0 ? (
                  z.lmi_types_seen.map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-indigo-900/50 border border-indigo-700/50 rounded-full text-[11px] text-indigo-200">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No sales data yet</span>
                )}
              </div>

              {/* Recent assignments */}
              <h3 className="text-sm font-semibold text-gray-300 mt-4 mb-2 uppercase tracking-wider">Recent Assignments</h3>
              {recent_assignments.length > 0 ? (
                <div className="space-y-1">
                  {recent_assignments.map(a => (
                    <div key={a.id} className="flex justify-between text-xs">
                      <span className="text-gray-300">{a.rep_name ?? 'Unknown'}</span>
                      <span className="text-gray-500">{a.assigned_date} · {a.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500 text-sm">No assignments yet</span>
              )}
            </div>
          </div>

          {/* TOP STREETS */}
          <div className="bg-gray-900/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Top Streets {streets.length > 0 && `(${streets.length} tracked)`}
            </h3>
            {streetsToShow.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-1.5 pr-3">Street</th>
                        <th className="text-right px-2">Doors</th>
                        <th className="text-right px-2">Enrolled</th>
                        <th className="text-right px-2">Untapped</th>
                        <th className="text-right px-2">Rate</th>
                        <th className="text-right px-2">Days Idle</th>
                        <th className="text-left pl-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streetsToShow.map((s, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-1.5 pr-3 text-gray-200 font-medium">{s.street_name}</td>
                          <td className="text-right px-2 text-gray-300 font-mono">{s.doors}</td>
                          <td className="text-right px-2 text-gray-300 font-mono">{s.enrolled}</td>
                          <td className="text-right px-2 text-green-400 font-mono">{s.untapped}</td>
                          <td className="text-right px-2 font-mono" style={{ color: getCloseRateColor(s.close_rate) }}>
                            {(s.close_rate * 100).toFixed(0)}%
                          </td>
                          <td className="text-right px-2 text-gray-300 font-mono">{s.days_idle}</td>
                          <td className="pl-2 text-gray-400">{s.dwelling_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {streets.length > 8 && (
                  <button onClick={() => setShowAllStreets(!showAllStreets)}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300">
                    {showAllStreets ? 'Show fewer' : `Show all ${streets.length} streets`}
                  </button>
                )}
              </>
            ) : (
              <span className="text-gray-500 text-sm">No street-level data yet — assign reps to build intel</span>
            )}
          </div>

          {/* ASSIGN REP */}
          <div className="bg-gray-900/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Assign Rep</h3>
            <div className="flex gap-3">
              <select value={selectedRep} onChange={ev => setSelectedRep(ev.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                <option value="">Select a rep...</option>
                {reps.filter(r => r.active).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={!selectedRep || assigning}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg text-sm font-medium text-white transition-colors">
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
