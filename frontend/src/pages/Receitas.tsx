import { useMemo } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { FilterBar } from '@/components/filters/FilterBar'
import { TimelineChart } from '@/components/charts/TimelineChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { DataTable } from '@/components/tables/DataTable'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useReceitas } from '@/hooks/useFinanceiro'
import { useFilterStore } from '@/hooks/useFilters'
import { formatCurrency, formatCompact, parseDate, exportCSV } from '@/lib/formatters'
import type { ReceitaRecord } from '@/types'
import { EMPRESA_COLORS, TIPO_LABEL } from '@/types'

const col = createColumnHelper<ReceitaRecord>()

const columns = [
  col.accessor('empresa', {
    header: 'Empresa',
    cell: (info) => {
      const emp = info.getValue()
      const color = EMPRESA_COLORS[emp] ?? '#6b7280'
      return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: color }}>{emp.slice(0, 3).toUpperCase()}</span>
    },
  }),
  col.accessor('obra', { header: 'Obra' }),
  col.accessor('cliente', { header: 'Cliente' }),
  col.accessor('tipo', {
    header: 'Tipo',
    cell: (info) => TIPO_LABEL[info.getValue()] || info.getValue(),
  }),
  col.accessor('data', { header: 'Data' }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue()
      return <Badge variant={v === 'Recebida' ? 'success' : 'warning'}>{v}</Badge>
    },
  }),
  col.accessor('valor', {
    header: 'Valor',
    cell: (info) => <span className="font-medium tabular-nums block text-right">{formatCurrency(info.getValue())}</span>,
  }),
]

export default function Receitas() {
  const { data: allData, isLoading } = useReceitas()
  const filters = useFilterStore()

  const filtered = useMemo(() => {
    if (!allData) return []
    const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
    const d2 = filters.dtFim ? new Date(filters.dtFim + 'T00:00:00') : null
    return allData.filter((r) => {
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      if (filters.empresa && r.empresa !== filters.empresa) return false
      if (filters.obra && r.obra !== filters.obra) return false
      if (filters.status && r.status !== filters.status) return false
      if (filters.bancos.length > 0) {
        if (r.banco && !filters.bancos.includes(r.banco)) return false
      }
      if (filters.contas.length > 0) {
        if (r.conta && !filters.contas.includes(r.conta)) return false
      }
      return true
    })
  }, [allData, filters])

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.valor, 0)
    const recebido = filtered.filter((r) => r.status === 'Recebida').reduce((s, r) => s + r.valor, 0)
    const aReceber = filtered.filter((r) => r.status === 'A Receber').reduce((s, r) => s + r.valor, 0)
    const clientes = new Set(filtered.map((r) => r.cliente).filter(Boolean)).size
    const taxa = total > 0 ? (recebido / total) * 100 : 0
    return { total, recebido, aReceber, clientes, taxa }
  }, [filtered])

  const chartData = useMemo(() => {
    const byMonth: Record<string, { recebida: number; a_receber: number }> = {}
    filtered.forEach((r) => {
      const d = parseDate(r.data)
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth[key]) byMonth[key] = { recebida: 0, a_receber: 0 }
      if (r.status === 'Recebida') byMonth[key].recebida += r.valor
      else byMonth[key].a_receber += r.valor
    })
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-')
        return { label: `${m}/${y}`, ...v }
      })
  }, [filtered])

  const donutData = useMemo(() => {
    const byEmp: Record<string, number> = {}
    filtered.forEach((r) => { byEmp[r.empresa] = (byEmp[r.empresa] || 0) + r.valor })
    return Object.entries(byEmp).map(([name, value]) => ({ name, value, color: EMPRESA_COLORS[name] || '#607D8B' }))
  }, [filtered])

  const handleExport = () => {
    exportCSV('receitas.csv',
      ['Empresa', 'Obra', 'Cliente', 'Tipo', 'Data', 'DataVenc', 'Valor', 'Status'],
      filtered.map((r) => [r.empresa, r.obra, r.cliente, r.tipo, r.data, r.data_venc, String(r.valor).replace('.', ','), r.status])
    )
  }

  if (isLoading) {
    return (
      <div><Header title="Receitas" />
        <div className="p-6 space-y-6">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Receitas" />
      <div className="p-6 space-y-6 overflow-auto flex-1">
        <FilterBar showStatus />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle>Total do Periodo</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCompact(kpis.total)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle>Total Recebido</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-400">{formatCompact(kpis.recebido)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle>A Receber</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-400">{formatCompact(kpis.aReceber)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle>Clientes Ativos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{kpis.clientes}</div></CardContent></Card>
        </div>

        {/* Taxa de Recebimento */}
        <Card>
          <CardHeader className="pb-2"><CardTitle>Taxa de Recebimento</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${kpis.taxa}%` }} />
              </div>
              <span className="text-sm font-medium">{kpis.taxa.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Recebido: {formatCompact(kpis.recebido)}</span>
              <span>A Receber: {formatCompact(kpis.aReceber)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Timeline de Recebimentos</CardTitle></CardHeader>
            <CardContent>
              <TimelineChart data={chartData} bars={[
                { key: 'recebida', color: '#065f46', name: 'Recebida' },
                { key: 'a_receber', color: '#f59e0b', name: 'A Receber' },
              ]} height={320} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Por Empresa</CardTitle></CardHeader>
            <CardContent>
              <DonutChart data={donutData} centerLabel="Total" centerValue={formatCompact(kpis.total)} />
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Detalhamento</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Exportar</Button>
          </CardHeader>
          <CardContent>
            <DataTable data={filtered} columns={columns as ColumnDef<ReceitaRecord, unknown>[]} searchPlaceholder="Buscar cliente, obra..." />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
