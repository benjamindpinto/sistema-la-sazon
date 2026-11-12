'use client'

import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { label: string; value: number }[]
  color?: string
  horizontal?: boolean
}

const TOOLTIP_STYLE = { backgroundColor: '#2a2420', border: '1px solid #3d352b', borderRadius: '6px', color: '#f6f1e7', fontSize: '12px' }

export default function BarChart({ data, color = 'var(--ember)', horizontal = false }: Props) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ReBarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 90, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dfcd" horizontal={false} />
          <XAxis type="number" stroke="#8a7d6a" tick={{ fill: '#5c5244', fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" stroke="#8a7d6a" tick={{ fill: '#5c5244', fontSize: 11 }} width={85} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} fill={color} />
        </ReBarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <ReBarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8dfcd" vertical={false} />
        <XAxis dataKey="label" stroke="#8a7d6a" tick={{ fill: '#5c5244', fontSize: 11 }} />
        <YAxis stroke="#8a7d6a" tick={{ fill: '#5c5244', fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f6f1e7' }} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} fill={color} maxBarSize={26} />
      </ReBarChart>
    </ResponsiveContainer>
  )
}
