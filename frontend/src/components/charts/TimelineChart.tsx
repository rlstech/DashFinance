import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency, formatCompact } from '@/lib/formatters'

interface TimelineChartProps {
  data: { label: string; [key: string]: number | string }[]
  bars: { key: string; color: string; name: string }[]
  height?: number
}

export function TimelineChart({ data, bars, height = 300 }: TimelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#94A3B8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94A3B8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCompact(v)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0F172A',
            border: '2px solid #0F172A',
            borderRadius: 0,
            fontSize: 12,
            color: '#F8FAFC',
          }}
          formatter={(value: number) => [formatCurrency(value)]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#64748B' }}
        />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            stackId="a"
            radius={[0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
