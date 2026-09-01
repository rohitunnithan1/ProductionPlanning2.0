import { NextRequest, NextResponse } from 'next/server'
import { fetchPDIRecords, fetchPlanData, computeStats } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minutes

export async function GET(_req: NextRequest) {
  try {
    // Fetch PDI actuals and plan data in parallel
    const [records, planData] = await Promise.all([
      fetchPDIRecords(),
      fetchPlanData(),
    ])

    // Compute stats across ALL months — no month filter
    const stats = computeStats(records, undefined, planData)

    return NextResponse.json({ stats, records })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
