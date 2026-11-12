'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface Props {
  data: { label: string; value: number; color: string }[]
}

export default function DonutChart({ data }: Props) {
  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="flex items-center gap-6">
      <div className="w-32 h-32 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" dataKey="value" nameKey="label" paddingAngle={2}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#2a2420', border: '1px solid #3d352b', borderRadius: '6px', color: '#f6f1e7', fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[var(--ink)]">{d.label}</span>
            </div>
            <span className="text-[var(--ink-soft)] text-xs tabular">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
