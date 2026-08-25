'use client'

import type { VehicleRecord } from '@/lib/types'

interface VehicleTableProps {
  vehicles: VehicleRecord[]
}

export default function VehicleTable({ vehicles }: VehicleTableProps) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
        Latest Vehicles
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-800">
              <th className="pb-2 pr-4 text-gray-500 font-medium">#</th>
              <th className="pb-2 pr-4 text-gray-500 font-medium">VIN</th>
              <th className="pb-2 pr-4 text-gray-500 font-medium">Prod. Date</th>
              <th className="pb-2 pr-4 text-gray-500 font-medium">PDI Sign-off</th>
              <th className="pb-2 text-gray-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 pr-4 text-gray-500 text-xs">{v.sr_no || i + 1}</td>
                <td className="py-2 pr-4 font-mono text-blue-300 text-xs">{v.vin}</td>
                <td className="py-2 pr-4 text-gray-300 text-xs">{v.production_date}</td>
                <td className="py-2 pr-4 text-gray-300 text-xs">
                  {v.pdi_signoff_date || <span className="text-amber-500">Pending</span>}
                </td>
                <td className="py-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    v.has_issues
                      ? 'bg-amber-900/40 text-amber-400'
                      : 'bg-emerald-900/40 text-emerald-400'
                  }`}>
                    {v.has_issues ? '⚠ Issues' : '✓ OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
