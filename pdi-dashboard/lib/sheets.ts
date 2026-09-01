import Papa from 'papaparse'
import type { VehicleRecord, ProductionStats, DailyCount } from './types'

const SHEETS_CSV_URL      = process.env.SHEETS_CSV_URL      || ''
const SHEETS_PLAN_CSV_URL = process.env.SHEETS_PLAN_CSV_URL || ''

/**
 * Fetches PDI records from the published PDI_Database CSV.
 */
export async function fetchPDIRecords(): Promise<VehicleRecord[]> {
  if (!SHEETS_CSV_URL) {
    throw new Error('SHEETS_CSV_URL environment variable is not set.')
  }

  const url = `${SHEETS_CSV_URL}&cachebust=${Date.now()}`
  const res = await fetch(url, { next: { revalidate: 300 } })

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
 * Fetches the plan lookup from the published Plan_Data CSV.
 * Falls back to an empty map if the URL isn't configured yet.
 * Format: Date (DD-MM-YYYY), Plan (number)
 */
export async function fetchPlanData(): Promise<Record<string, number>> {
  if (!SHEETS_PLAN_CSV_URL) {
    console.warn('SHEETS_PLAN_CSV_URL not set — plan data will be empty.')
    return {}
  }

  const url = `${SHEETS_PLAN_CSV_URL}&cachebust=${Date.now()}`
  const res = await fetch(url, { next: { revalidate: 300 } })

  if (!res.ok) {
    console.error(`Failed to fetch plan data: ${res.status}`)
    return {}
  }

  const csv = await res.text()

  return new Promise((resolve) => {
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const lookup: Record<string, number> = {}
        for (const row of result.data as any[]) {
          const date = (row.Date || '').trim()
          const qty  = parseInt(row.Plan || '0')
          if (date && qty > 0) lookup[date] = qty
        }
        resolve(lookup)
      },
      error: () => resolve({}),
    })
  })
}

/**
 * Compute dashboard stats from raw records + plan lookup, filtered to selected month.
 */
export function computeStats(
  records:  VehicleRecord[],
  month:    string | undefined,
  planData: Record<string, number> = {},
): ProductionStats {
  // If no month specified, include all records
  const filtered = month ? records.filter(r => r.month === month) : records

  // Daily PDI sign-off counts (only signed-off vehicles)
  const dailyMap: Record<string, DailyCount> = {}
  for (const r of filtered) {
    if (!r.pdi_signed_off || !r.pdi_signoff_date) continue
    const d = r.pdi_signoff_date
    if (!dailyMap[d]) dailyMap[d] = { date: d, count: 0, signedOff: 0, plan: 0 }
    dailyMap[d].count++
    dailyMap[d].signedOff++
  }

  // Merge plan for all dates from Aug 2026 onwards (not limited to selected month)
  for (const [date, qty] of Object.entries(planData)) {
    const dm = date.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (!dm) continue
    const planDate = new Date(parseInt(dm[3]), parseInt(dm[2]) - 1, parseInt(dm[1]))
    if (planDate < new Date(2026, 7, 1)) continue   // skip anything before Aug 2026
    if (dailyMap[date]) {
      dailyMap[date].plan = qty
    } else {
      // Plan exists but no actuals yet — show plan bar with zero actual
      dailyMap[date] = { date, count: 0, signedOff: 0, plan: qty }
    }
  }

  // Fill every calendar day between min and max so gaps show as zero
  const allKeys = Object.keys(dailyMap)
  if (allKeys.length > 1) {
    const sorted = allKeys.slice().sort((a, b) =>
      parseDateToSortable(a).localeCompare(parseDateToSortable(b))
    )
    const first = sorted[0]
    const last  = sorted[sorted.length - 1]
    const fm = first.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    const lm = last.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (fm && lm) {
      const cursor = new Date(parseInt(fm[3]), parseInt(fm[2]) - 1, parseInt(fm[1]))
      const end    = new Date(parseInt(lm[3]), parseInt(lm[2]) - 1, parseInt(lm[1]))
      while (cursor <= end) {
        const dd = String(cursor.getDate()).padStart(2, '0')
        const mm = String(cursor.getMonth() + 1).padStart(2, '0')
        const yyyy = String(cursor.getFullYear())
        const key = `${dd}-${mm}-${yyyy}`
        if (!dailyMap[key]) {
          dailyMap[key] = { date: key, count: 0, signedOff: 0, plan: 0 }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  // Sort dates (DD-MM-YYYY → sort as YYYY-MM-DD)
  const dailyCounts = Object.values(dailyMap).sort((a, b) =>
    parseDateToSortable(a.date).localeCompare(parseDateToSortable(b.date))
  )

  // Latest 10 vehicles (by ID descending)
  const latestVehicles = [...filtered].sort((a, b) => b.id - a.id).slice(0, 10)

  return {
    total:      filtered.length,
    signedOff:  filtered.filter(r => r.pdi_signed_off).length,
    pending:    filtered.filter(r => !r.pdi_signed_off).length,
    withIssues: filtered.filter(r => r.has_issues).length,
    allOK:      filtered.filter(r => !r.has_issues).length,
    dailyCounts,
    latestVehicles,
    month: month || 'All',
  }
}

/** "Aug 2026" → "-08-2026" for filtering DD-MM-YYYY strings */
function getMonthSuffix(monthLabel: string): string {
  const monthNums: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const m = monthLabel.match(/^(\w{3})\s+(\d{4})$/)
  if (!m) return ''
  const mm = monthNums[m[1]] || ''
  return mm ? `-${mm}-${m[2]}` : ''
}

function parseDateToSortable(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return ddmmyyyy
}

/**
 * Get the list of unique months from records, most recent first.
 */
export function getMonths(records: VehicleRecord[]): string[] {
  const months = Array.from(new Set(records.map(r => r.month))).filter(Boolean)
  return months.sort((a, b) => parseMonthLabel(b) - parseMonthLabel(a))
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
