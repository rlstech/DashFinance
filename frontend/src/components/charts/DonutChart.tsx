import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency, formatCompact } from '@/lib/formatters'

interface DonutChartProps {
  data: { name: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
  centerValue?: string
}

export function DonutChart({ data, height = 250, centerLabel, centerValue }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222 47% 11%)',
                border: '1px solid hsl(217 33% 17%)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [formatCurrency(value)]}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
            <span className="text-lg font-semibold">{centerValue ?? formatCompact(total)}</span>
          </div>
        )}
      </div>
      <div className="space-y-1 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
            </div>
            <span className="font-medium">{formatCompact(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
