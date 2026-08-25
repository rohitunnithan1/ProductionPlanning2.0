'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import type { DailyCount } from '@/lib/types'

interface DailyChartProps {
  data: DailyCount[]
  weekMode?: boolean
}

// Format "08-08-2026" → "Aug 8"  (no-op if already a label like "Aug 8–14")
function formatDate(s: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return s   // already a week label or custom string
  const day = parseInt(m[1])
  const mon = parseInt(m[2]) - 1
  return `${months[mon]} ${day}`
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
    </div>
  )
}

export default function DailyChart({ data, weekMode = false }: DailyChartProps) {
  const chartData = data.map(d => ({
    date:     formatDate(d.date),
    'Plan':   d.plan,
    'Actual': d.signedOff,
  }))

  const barSize = weekMode ? 28 : undefined

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
        barSize={barSize}
        barCategoryGap={weekMode ? '30%' : '20%'}
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
