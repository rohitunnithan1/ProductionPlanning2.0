'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import type { DailyCount } from '@/lib/types'

interface DailyChartProps {
  data: DailyCount[]
  weekMode?: boolean
  onBarClick?: (date: string) => void   // DD-MM-YYYY, only fired in day mode
}

// Format "08-08-2026" → "Aug 8"  (no-op if already a week label)
function formatDate(s: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return s
  return `${months[parseInt(m[2]) - 1]} ${parseInt(m[1])}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold text-white">{p.value}</span>
        </p>
      ))}
      {!payload.every((p: any) => p.value === 0) && (
        <p className="text-gray-500 text-xs mt-1">Click to see vehicles</p>
      )}
    </div>
  )
}

export default function DailyChart({ data, weekMode = false, onBarClick }: DailyChartProps) {
  const chartData = data.map(d => ({
    date:     formatDate(d.date),
    rawDate:  d.date,          // original DD-MM-YYYY — used for click lookup
    'Plan':   d.plan,
    'Actual': d.signedOff,
  }))

  const handleClick = (payload: any) => {
    if (!onBarClick || weekMode) return
    const rawDate = payload?.activePayload?.[0]?.payload?.rawDate
    if (rawDate) onBarClick(rawDate)
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
        barSize={weekMode ? 28 : undefined}
        barCategoryGap={weekMode ? '30%' : '20%'}
        onClick={handleClick}
        style={{ cursor: onBarClick && !weekMode ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={weekMode ? 0 : -35}
          textAnchor={weekMode ? 'middle' : 'end'}
          height={weekMode ? 30 : 50}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
          formatter={(v) => <span style={{ color: '#9ca3af' }}>{v}</span>}
        />
        <Bar dataKey="Plan"   fill="#3b82f6" radius={[4,4,0,0]} />
        <Bar dataKey="Actual" fill="#10b981" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
