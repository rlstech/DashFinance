import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency, formatCompact } from '@/lib/formatters'

interface CashFlowChartProps {
  data: { label: string; entradas: number; saidas: number; acumulado: number }[]
  height?: number
}

export function CashFlowChart({ data, height = 350 }: CashFlowChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
        <XAxis
          dataKey="label"
          tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCompact(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#3b82f6', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCompact(v)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(222 47% 11%)',
            border: '1px solid hsl(217 33% 17%)',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [formatCurrency(value)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="entradas" name="Entradas" fill="#22c55e" stackId="a" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="saidas" name="Saidas" fill="#ef4444" stackId="a" radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
