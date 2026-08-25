import { NextRequest, NextResponse } from 'next/server'
import { fetchPDIRecords, fetchPlanData, computeStats, getMonths } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minutes

/** Returns "Aug 2026" style label for the current month */
function currentMonthLabel(): string {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now   = new Date()
  return `${names[now.getMonth()]} ${now.getFullYear()}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || undefined

    // Fetch PDI actuals and plan data in parallel
    const [records, planData] = await Promise.all([
      fetchPDIRecords(),
      fetchPlanData(),
    ])

    const months   = getMonths(records)
    // Fall back to current calendar month so the chart always shows something useful
    const selected = month || months[0] || currentMonthLabel()
    const stats    = computeStats(records, selected, planData)

    return NextResponse.json({ stats, months, selectedMonth: selected })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
