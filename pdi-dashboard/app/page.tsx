'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import DailyChart from '@/components/DailyChart'
import type { ProductionStats, DailyCount } from '@/lib/types'

type ViewMode = 'day' | 'week'

/** "DD-MM-YYYY" → Date object */
function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return null
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
}

/** "DD-MM-YYYY" → "YYYY-MM-DD" (for <input type="date"> value) */
function toInputDate(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** ISO week number for a Date */
function isoWeek(d: Date): number {
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

/** Aggregate daily counts into weekly buckets */
function aggregateByWeek(counts: DailyCount[]): DailyCount[] {
  const map: Record<string, DailyCount & { _dates: string[] }> = {}

  for (const d of counts) {
    const dt = parseDDMMYYYY(d.date)
    if (!dt) continue
    const wk = isoWeek(dt)
    const yr = dt.getFullYear()
    const key = `${yr}-W${String(wk).padStart(2, '0')}`

    if (!map[key]) {
      map[key] = { date: key, count: 0, signedOff: 0, plan: 0, _dates: [] }
    }
    map[key].count    += d.count
    map[key].signedOff += d.signedOff
    map[key].plan     += d.plan
    map[key]._dates.push(d.date)
  }

  // Label as "Aug W1", "Aug W2" etc using the first date in each week
  return Object.values(map)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => {
      const firstDate = parseDDMMYYYY(w._dates[0])
      const lastDate  = parseDDMMYYYY(w._dates[w._dates.length - 1])
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const label = firstDate && lastDate
        ? `${months[firstDate.getMonth()]} ${firstDate.getDate()}–${lastDate.getDate()}`
        : w.date
      return { date: label, count: w.count, signedOff: w.signedOff, plan: w.plan }
    })
}

export default function Dashboard() {
  const [months, setMonths]               = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [stats, setStats]                 = useState<ProductionStats | null>(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [lastUpdated, setLastUpdated]     = useState<string>('')

  // Chart controls
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [dateFrom, setDateFrom] = useState<string>('')   // "YYYY-MM-DD" for input
  const [dateTo, setDateTo]     = useState<string>('')   // "YYYY-MM-DD" for input

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
      // Reset date range when month changes
      setDateFrom('')
      setDateTo('')
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

  // Filter + aggregate chart data based on controls
  const chartData = useMemo(() => {
    if (!stats) return []

    let data = stats.dailyCounts

    // Apply date range filter
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : null
      const to   = dateTo   ? new Date(dateTo)   : null
      data = data.filter(d => {
        const dt = parseDDMMYYYY(d.date)
        if (!dt) return false
        if (from && dt < from) return false
        if (to   && dt > to  ) return false
        return true
      })
    }

    if (viewMode === 'week') {
      return aggregateByWeek(data)
    }
    return data
  }, [stats, viewMode, dateFrom, dateTo])

  // Compute date bounds from current data for the range inputs
  const dateBounds = useMemo(() => {
    if (!stats?.dailyCounts.length) return { min: '', max: '' }
    const dates = stats.dailyCounts.map(d => toInputDate(d.date)).filter(Boolean).sort()
    return { min: dates[0], max: dates[dates.length - 1] }
  }, [stats])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              🚗 PDI Production Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Plan vs Actual — PDI sign-off tracker</p>
          </div>
          <div className="flex items-center gap-3">
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-5 text-red-300 mb-6">
            <p className="font-semibold mb-1">⚠ Data Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !stats && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 h-80 animate-pulse" />
        )}

        {stats && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            {/* Chart header row */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Plan vs Actual — Daily PDI Sign-offs</h2>
                {lastUpdated && (
                  <p className="text-xs text-gray-600 mt-0.5">Updated {lastUpdated}</p>
                )}
              </div>

              {/* Controls row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Day / Week toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {(['day', 'week'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors capitalize
                        ${viewMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Date range */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    min={dateBounds.min}
                    max={dateBounds.max}
                    onChange={e => setDateFrom(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="From date"
                  />
                  <span className="text-gray-600 text-xs">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateBounds.min}
                    max={dateBounds.max}
                    onChange={e => setDateTo(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="To date"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(''); setDateTo('') }}
                      className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                      title="Clear date filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 ? (
              <DailyChart data={chartData} weekMode={viewMode === 'week'} />
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-600 text-sm">
                No data for the selected range
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
