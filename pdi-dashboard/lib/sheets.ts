import Papa from 'papaparse'
import type { VehicleRecord, ProductionStats, DailyCount } from './types'

const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL || ''

/**
 * Fetches PDI records from the published Google Sheets CSV URL.
 * The URL comes from: File > Share > Publish to web > PDI_Database sheet > CSV
 */
export async function fetchPDIRecords(): Promise<VehicleRecord[]> {
  if (!SHEETS_CSV_URL) {
    throw new Error('SHEETS_CSV_URL environment variable is not set. See README for setup instructions.')
  }

  // Add cache-busting so we always get fresh data
  const url = `${SHEETS_CSV_URL}&cachebust=${Date.now()}`

  const res = await fetch(url, {
    next: { revalidate: 300 }, // cache for 5 minutes on Vercel
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch sheet data: ${res.status} ${res.statusText}`)
  }

  const csv = await res.text()

  return new Promise((resolve, reject) => {
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const records: VehicleRecord[] = result.data
          .filter((row: any) => row.VIN && row.VIN.startsWith('ME'))
          .map((row: any) => ({
            id:               parseInt(row.ID || '0'),
            month:            row.Month || '',
            sr_no:            row.Sr_No || '',
            production_date:  row.Production_Date || '',
            production_time:  row.Production_Time || '',
            vin:              row.VIN || '',
            vcu:              row.VCU || '',
            motor_no:         row.Motor_No || '',
            evcc:             row.EVCC || '',
            mcu:              row.MCU || '',
            pdi_remarks:      row.PDI_Remarks || '',
            pdi_signoff_date: row.PDI_Signoff_Date || '',
            pdi_signed_off:   row.PDI_Signed_Off?.toLowerCase() === 'true',
            has_issues:       row.Has_Issues?.toLowerCase() === 'true',
            source_sheet:     row.Source_Sheet || '',
          }))
        resolve(records)
      },
      error: reject,
    })
  })
}

/**
 * Compute dashboard stats from raw records, filtered to the selected month.
 */
export function computeStats(records: VehicleRecord[], month: string): ProductionStats {
  const filtered = records.filter(r => r.month === month)

  // Daily production counts (by production date)
  const dailyMap: Record<string, DailyCount> = {}
  for (const r of filtered) {
    const d = r.production_date || 'Unknown'
    if (!dailyMap[d]) dailyMap[d] = { date: d, count: 0, signedOff: 0 }
    dailyMap[d].count++
    if (r.pdi_signed_off) dailyMap[d].signedOff++
  }

  // Sort dates (DD-MM-YYYY → sort as YYYY-MM-DD)
  const dailyCounts = Object.values(dailyMap).sort((a, b) => {
    return parseDateToSortable(a.date).localeCompare(parseDateToSortable(b.date))
  })

  // Latest 10 vehicles (by ID descending = most recently added)
  const latestVehicles = [...filtered].sort((a, b) => b.id - a.id).slice(0, 10)

  return {
    total:      filtered.length,
    signedOff:  filtered.filter(r => r.pdi_signed_off).length,
    pending:    filtered.filter(r => !r.pdi_signed_off).length,
    withIssues: filtered.filter(r => r.has_issues).length,
    allOK:      filtered.filter(r => !r.has_issues).length,
    dailyCounts,
    latestVehicles,
    month,
  }
}

function parseDateToSortable(ddmmyyyy: string): string {
  // "08-08-2026" → "2026-08-08"
  const m = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return ddmmyyyy
}

/**
 * Get the list of unique months from records, most recent first.
 */
export function getMonths(records: VehicleRecord[]): string[] {
  const months = Array.from(new Set(records.map(r => r.month))).filter(Boolean)
  // Sort by parsed date (most recent first)
  return months.sort((a, b) => {
    return parseMonthLabel(b) - parseMonthLabel(a)
  })
}

function parseMonthLabel(label: string): number {
  const monthNames: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  }
  const m = label.match(/^(\w{3})\s+(\d{4})$/)
  if (!m) return 0
  return parseInt(m[2]) * 12 + (monthNames[m[1]] || 0)
}
