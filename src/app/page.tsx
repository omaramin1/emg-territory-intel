'use client'

import { useState, useEffect, useMemo } from 'react'
import ZoneCard from '@/components/ZoneCard'
import ZoneDetailModal from '@/components/ZoneDetailModal'
import type { ZoneDetail, Rep } from '@/types/database'

// Combined zone data for card display
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
  any_program_pct?: number
  any_program_eligible_hh?: number
  target_hh_broad?: number
  target_pct_broad?: number
  electric_heat_pct?: number
  snap_pct?: number
  medicaid_pct?: number
  dominant_demo?: string
  white_pct?: number
  black_pct?: number
  hispanic_pct?: number
  asian_pct?: number
  median_income?: number
  population?: number
  rep_match_note?: string
}

type SortKey = 'deploy_score' | 'target_hh_broad' | 'close_rate' | 'any_program_pct' | 'untapped_est' | 'days_idle'
type Tier = 'all' | 'hot' | 'warm' | 'cool'

export default function Dashboard() {
  const [zones, setZones] = useState<ZoneCardData[]>([])
  const [reps, setReps] = useState<Rep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('deploy_score')
  const [tier, setTier] = useState<Tier>('all')
  const [selectedZone, setSelectedZone] = useState<ZoneDetail | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Fetch all zones on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [zonesRes, repsRes] = await Promise.all([
          fetch('/api/zones'),
          fetch('/api/reps')
        ])
        if (!zonesRes.ok) throw new Error('Failed to fetch zones')
        const zonesData = await zonesRes.json()
        const repsData = repsRes.ok ? await repsRes.json() : []
        setZones(zonesData)
        setReps(repsData)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...zones]

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(z => z.zip_code.includes(q) || z.city.toLowerCase().includes(q))
    }

    // Tier
    if (tier === 'hot') result = result.filter(z => (z.any_program_pct ?? 0) >= 35)
    else if (tier === 'warm') result = result.filter(z => (z.any_program_pct ?? 0) >= 20 && (z.any_program_pct ?? 0) < 35)
    else if (tier === 'cool') result = result.filter(z => (z.any_program_pct ?? 0) < 20)

    // Sort
    result.sort((a, b) => {
      const av = a[sortBy] ?? 0
      const bv = b[sortBy] ?? 0
      return sortBy === 'days_idle' ? (bv as number) - (av as number) : (bv as number) - (av as number)
    })

    return result
  }, [zones, search, sortBy, tier])

  // Open zone detail
  const openZoneDetail = async (zoneId: string) => {
    setModalLoading(true)
    try {
      const res = await fetch(`/api/zones/${zoneId}`)
      if (!res.ok) throw new Error('Failed to load zone detail')
      const data: ZoneDetail = await res.json()
      setSelectedZone(data)
    } catch {
      console.error('Failed to load zone detail')
    } finally {
      setModalLoading(false)
    }
  }

  // Assign rep
  const handleAssignRep = async (zoneId: string, repId: string) => {
    await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, rep_id: repId, assigned_date: new Date().toISOString().split('T')[0] })
    })
    // Refresh zone detail
    if (selectedZone) openZoneDetail(selectedZone.zone.id)
  }

  // Summary stats
  const totalTarget = zones.reduce((s, z) => s + (z.target_hh_broad ?? 0), 0)
  const totalEligible = zones.reduce((s, z) => s + (z.any_program_eligible_hh ?? 0), 0)
  const avgScore = zones.length > 0 ? zones.reduce((s, z) => s + z.deploy_score, 0) / zones.length : 0

  // CSV export
  const exportCSV = () => {
    const headers = ['Rank', 'ZIP', 'City', 'Deploy Score', 'Target HH', 'Any Program %', 'Close Rate', 'Untapped %', 'Days Idle', 'Electric Heat %', 'Median Income', 'Population']
    const rows = filtered.map((z, i) => [
      i + 1, z.zip_code, z.city, z.deploy_score.toFixed(3), z.target_hh_broad ?? '', `${z.any_program_pct?.toFixed(1) ?? ''}%`,
      `${(z.close_rate * 100).toFixed(1)}%`, `${(100 - z.saturation_pct).toFixed(1)}%`, z.days_idle,
      `${z.electric_heat_pct?.toFixed(0) ?? ''}%`, z.median_income ?? '', z.population ?? ''
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emg_territories_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading territory intelligence...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center bg-red-900/30 border border-red-700 rounded-xl p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Check that your Supabase credentials are configured in .env.local</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-gray-100">
      {/* Header */}
      <header className="bg-[#0f172a] border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">EMG Territory Intelligence</h1>
              <p className="text-sm text-gray-400">Community Solar — Virginia / Dominion Energy</p>
            </div>
            <button onClick={exportCSV} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
              Export CSV
            </button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-[#1a1a2e] rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-white">{zones.length}</div>
              <div className="text-xs text-gray-500">Total Zones</div>
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-green-400">{totalTarget.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Target Households</div>
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-blue-400">{totalEligible.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Benefits-Eligible HH</div>
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-amber-400">{avgScore.toFixed(3)}</div>
              <div className="text-xs text-gray-500">Avg Deploy Score</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <input type="text" placeholder="Search ZIP or city..." value={search} onChange={e => setSearch(e.target.value)}
                   className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none w-48" />

            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
              <option value="deploy_score">Sort: Deploy Score</option>
              <option value="target_hh_broad">Sort: Target HH</option>
              <option value="close_rate">Sort: Close Rate</option>
              <option value="any_program_pct">Sort: Benefits %</option>
              <option value="untapped_est">Sort: Untapped</option>
              <option value="days_idle">Sort: Days Idle</option>
            </select>

            <div className="flex gap-1">
              {(['all', 'hot', 'warm', 'cool'] as Tier[]).map(t => (
                <button key={t} onClick={() => setTier(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          tier === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}>
                  {t === 'all' ? `All (${zones.length})` :
                   t === 'hot' ? `Hot (${zones.filter(z => (z.any_program_pct ?? 0) >= 35).length})` :
                   t === 'warm' ? `Warm (${zones.filter(z => (z.any_program_pct ?? 0) >= 20 && (z.any_program_pct ?? 0) < 35).length})` :
                   `Cool (${zones.filter(z => (z.any_program_pct ?? 0) < 20).length})`}
                </button>
              ))}
            </div>

            <span className="text-sm text-gray-500 ml-auto">
              Showing {filtered.length} of {zones.length} zones
            </span>
          </div>
        </div>
      </header>

      {/* Zone Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((z, i) => (
            <ZoneCard key={z.id} zone={z} rank={i + 1} onClick={() => openZoneDetail(z.id)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No zones match your filters. Try adjusting your search or tier selection.
          </div>
        )}
      </main>

      {/* Loading overlay for modal */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Zone Detail Modal */}
      {selectedZone && (
        <ZoneDetailModal
          zone={selectedZone}
          reps={reps}
          onClose={() => setSelectedZone(null)}
          onAssignRep={handleAssignRep}
        />
      )}
    </div>
  )
}
