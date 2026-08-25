'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import DailyChart from '@/components/DailyChart'
import type { ProductionStats, DailyCount, VehicleRecord } from '@/lib/types'

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

/** "DD-MM-YYYY" → "25 Aug 2026" for display */
function displayDate(ddmmyyyy: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return ddmmyyyy
  return `${parseInt(m[1])} ${months[parseInt(m[2]) - 1]} ${m[3]}`
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
    map[key].count     += d.count
    map[key].signedOff += d.signedOff
    map[key].plan      += d.plan
    map[key]._dates.push(d.date)
  }

  return Object.values(map)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => {
      const firstDate = parseDDMMYYYY(w._dates[0])
      const lastDate  = parseDDMMYYYY(w._dates[w._dates.length - 1])
      const months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const label = firstDate && lastDate
        ? `${months[firstDate.getMonth()]} ${firstDate.getDate()}–${lastDate.getDate()}`
        : w.date
      return { date: label, count: w.count, signedOff: w.signedOff, plan: w.plan }
    })
}

/** Download an array of VehicleRecords as CSV */
function downloadCSV(records: VehicleRecord[], dateLabel: string) {
  const headers = ['Sr No', 'VIN', 'VCU', 'Motor No', 'EVCC', 'MCU', 'PDI Remarks', 'Sign-off Date']
  const escape  = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
  const rows = [
    headers.join(','),
    ...records.map(r =>
      [r.sr_no, r.vin, r.vcu, r.motor_no, r.evcc, r.mcu, r.pdi_remarks, r.pdi_signoff_date]
        .map(String).map(escape).join(',')
    ),
  ].join('\n')

  const blob = new Blob([rows], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `pdi-signoffs-${dateLabel}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const [months, setMonths]               = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [stats, setStats]                 = useState<ProductionStats | null>(null)
  const [allRecords, setAllRecords]       = useState<VehicleRecord[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [lastUpdated, setLastUpdated]     = useState<string>('')

  // Chart controls
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo]     = useState<string>('')

  // Drill-down modal
  const [clickedDate, setClickedDate] = useState<string | null>(null)  // DD-MM-YYYY

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
      setAllRecords(data.records || [])
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }))
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

  // Filter + aggregate chart data
  const chartData = useMemo(() => {
    if (!stats) return []

    let data = stats.dailyCounts

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

    return viewMode === 'week' ? aggregateByWeek(data) : data
  }, [stats, viewMode, dateFrom, dateTo])

  // Date range bounds for the pickers
  const dateBounds = useMemo(() => {
    if (!stats?.dailyCounts.length) return { min: '', max: '' }
    const dates = stats.dailyCounts.map(d => toInputDate(d.date)).filter(Boolean).sort()
    return { min: dates[0], max: dates[dates.length - 1] }
  }, [stats])

  // Records for the clicked date (signed-off vehicles only)
  const modalRecords = useMemo(() => {
    if (!clickedDate) return []
    return allRecords.filter(r => r.pdi_signoff_date === clickedDate)
  }, [allRecords, clickedDate])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              PDI Production Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Plan vs Actual — PDI sign-off tracker</p>
          </div>
          <p className="text-sm text-gray-400 font-medium hidden md:block">PDI signed off by Zeno team</p>
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

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-5 text-red-300">
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
            {/* Chart header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Plan vs Actual — Daily PDI Sign-offs</h2>
                {lastUpdated && (
                  <p className="text-xs text-gray-600 mt-0.5">Updated {lastUpdated}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Day / Week toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {(['day', 'week'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setViewMode(mode); setClickedDate(null) }}
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
              <DailyChart
                data={chartData}
                weekMode={viewMode === 'week'}
                onBarClick={viewMode === 'day' ? setClickedDate : undefined}
              />
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-600 text-sm">
                No data for the selected range
              </div>
            )}

            {viewMode === 'day' && !clickedDate && (
              <p className="text-center text-xs text-gray-700 mt-3">
                Click any bar to see vehicle details
              </p>
            )}
          </div>
        )}

        {/* Drill-down panel */}
        {clickedDate && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Sign-offs — {displayDate(clickedDate)}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {modalRecords.length} vehicle{modalRecords.length !== 1 ? 's' : ''} signed off
                </p>
              </div>
              <div className="flex items-center gap-3">
                {modalRecords.length > 0 && (
                  <button
                    onClick={() => downloadCSV(modalRecords, clickedDate)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg px-3 py-2 transition-colors"
                  >
                    ↓ Download CSV
                  </button>
                )}
                <button
                  onClick={() => setClickedDate(null)}
                  className="text-gray-500 hover:text-gray-300 text-lg leading-none px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Table */}
            {modalRecords.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-600 text-sm">
                No sign-offs recorded for this date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sr No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">VIN</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">VCU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motor No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PDI Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRecords.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-gray-800/20'
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{r.sr_no}</td>
                        <td className="px-4 py-3 text-white font-mono text-xs">{r.vin}</td>
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">{r.vcu || '—'}</td>
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">{r.motor_no || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                            ${r.has_issues
                              ? 'bg-amber-900/40 text-amber-300 border border-amber-800/50'
                              : 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                            }`}>
                            {r.pdi_remarks || 'All QC OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
