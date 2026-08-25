import { NextRequest, NextResponse } from 'next/server'
import { fetchPDIRecords, fetchPlanData, computeStats, getMonths } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || undefined

    // Fetch PDI actuals and plan data in parallel
    const [records, planData] = await Promise.all([
      fetchPDIRecords(),
      fetchPlanData(),
    ])

    const months        = getMonths(records)
    const selected      = month || months[0] || ''
    const stats         = computeStats(records, selected, planData)

    return NextResponse.json({ stats, months, selectedMonth: selected })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
