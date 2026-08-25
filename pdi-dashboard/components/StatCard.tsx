'use client'

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'gray'
  large?: boolean
}

const colorMap = {
  blue:  'border-blue-500 text-blue-400',
  green: 'border-emerald-500 text-emerald-400',
  amber: 'border-amber-500 text-amber-400',
  red:   'border-red-500 text-red-400',
  gray:  'border-gray-600 text-gray-400',
}

export default function StatCard({ label, value, sub, color = 'blue', large = false }: StatCardProps) {
  const accent = colorMap[color]
  return (
    <div className={`bg-gray-900 rounded-xl border-l-4 ${accent} p-5 flex flex-col gap-1`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`font-bold ${large ? 'text-5xl' : 'text-3xl'} text-white leading-none`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
