'use client'

import { useState, useEffect, useCallback } from 'react'
import StatCard from '@/components/StatCard'
import DailyChart from '@/components/DailyChart'
import VehicleTable from '@/components/VehicleTable'
import type { ProductionStats } from '@/lib/types'

export default function Dashboard() {
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [stats, setStats] = useState<ProductionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async (month?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/production${month ? `?month=${encodeURIComponent(month)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setStats(data.stats)
      setMonths(data.months)
      setSelectedMonth(data.selectedMonth)
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m)
    fetchData(m)
  }

  const pdiRate = stats ? Math.round((stats.signedOff / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              🚗 PDI Production Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Vehicle PDI sign-off tracker</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Month selector */}
            {months.length > 0 && (
              <select
                value={selectedMonth}
                onChange={e => handleMonthChange(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => fetchData(selectedMonth)}
              className="bg-gray-800 border border-gray-700 text-gray-400 text-sm rounded-lg px-3 py-2 hover:bg-gray-700 hover:text-white transition-colors"
              title="Refresh data"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Error state */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-5 text-red-300">
            <p className="font-semibold mb-1">⚠ Data Error</p>
            <p className="text-sm">{error}</p>
            {error.includes('SHEETS_CSV_URL') && (
              <p className="text-sm mt-3 text-red-400">
                Set the <code className="bg-red-900/50 px-1 rounded">SHEETS_CSV_URL</code> environment
                variable in your Vercel project settings. See README for instructions.
              </p>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-5 h-24 animate-pulse border-l-4 border-gray-700" />
            ))}
          </div>
        )}

        {stats && (
          <>
            {/* Month headline */}
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-white">{selectedMonth}</h2>
              {lastUpdated && (
                <span className="text-xs text-gray-600">Updated {lastUpdated}</span>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Produced"
                value={stats.total}
                sub="vehicles this month"
                color="blue"
                large
              />
              <StatCard
                label="PDI Signed Off"
                value={stats.signedOff}
                sub={`${pdiRate}% completion rate`}
                color="green"
              />
              <StatCard
                label="Pending PDI"
                value={stats.pending}
                sub="awaiting sign-off"
                color="amber"
              />
              <StatCard
                label="With Issues"
                value={stats.withIssues}
                sub={`${stats.allOK} vehicles all-OK`}
                color="red"
              />
            </div>

            {/* PDI progress bar */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400 font-medium">PDI Completion</span>
                <span className="text-white font-bold">{pdiRate}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${pdiRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1.5">
                <span>{stats.signedOff} signed off</span>
                <span>{stats.pending} remaining</span>
              </div>
            </div>

            {/* Daily chart */}
            {stats.dailyCounts.length > 0 && (
              <DailyChart data={stats.dailyCounts} />
            )}

            {/* Recent vehicles */}
            {stats.latestVehicles.length > 0 && (
              <VehicleTable vehicles={stats.latestVehicles} />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 mt-8">
        <p className="text-center text-xs text-gray-700">
          Production data sourced from Google Sheets PDI_Database · Refreshes every 5 minutes
        </p>
      </footer>
    </div>
  )
}
