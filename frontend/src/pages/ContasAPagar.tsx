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
import { useAP } from '@/hooks/useFinanceiro'
import { useFilterStore } from '@/hooks/useFilters'
import { formatCurrency, formatCompact, parseDate, exportCSV } from '@/lib/formatters'
import type { APRecord } from '@/types'
import { EMPRESA_COLORS, EMPRESA_ABBR } from '@/types'

const columnHelper = createColumnHelper<APRecord>()

const columns = [
  columnHelper.accessor('empresa', {
    header: 'Empresa',
    cell: (info) => {
      const emp = info.getValue()
      const color = EMPRESA_COLORS[emp] ?? '#6b7280'
      return (
        <Badge variant="outline" style={{ borderColor: color, color }}>
          {EMPRESA_ABBR[emp] ?? emp}
        </Badge>
      )
    },
  }),
  columnHelper.accessor('obra', { header: 'Obra' }),
  columnHelper.accessor('data', { header: 'Data' }),
  columnHelper.accessor('fornecedor', { header: 'Fornecedor' }),
  columnHelper.accessor('categoria', { header: 'Categoria' }),
  columnHelper.accessor('origem', {
    header: 'Origem',
    cell: (info) => {
      const origem = info.getValue()
      const variant =
        origem === 'Emissao' ? 'default' : origem === 'Pago' ? 'success' : 'outline'
      return <Badge variant={variant}>{origem}</Badge>
    },
  }),
  columnHelper.accessor('valor', {
    header: 'Valor',
    cell: (info) => (
      <span className="text-right block font-medium tabular-nums">
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
]

export default function ContasAPagar() {
  const { data: ALL_DATA, isLoading } = useAP()
  const { empresa, obra, dtInicio, dtFim, origem, bancos, contas } = useFilterStore()

  const filteredData = useMemo(() => {
    if (!ALL_DATA) return []

    const inicio = dtInicio ? new Date(dtInicio + 'T00:00:00') : null
    const fim = dtFim ? new Date(dtFim + 'T23:59:59') : null

    return ALL_DATA.filter((r) => {
      if (empresa && r.empresa !== empresa) return false
      if (obra && r.obra !== obra) return false
      if (origem && r.origem !== origem) return false
      if (bancos.length > 0 && !bancos.includes(r.banco)) return false
      if (contas.length > 0 && !contas.includes(r.conta)) return false

      if (inicio || fim) {
        const d = parseDate(r.data)
        if (!d) return false
        if (inicio && d < inicio) return false
        if (fim && d > fim) return false
      }

      return true
    })
  }, [ALL_DATA, empresa, obra, dtInicio, dtFim, origem, bancos, contas])

  const kpis = useMemo(() => {
    const total = filteredData.reduce((s, r) => s + r.valor, 0)
    const emissao = filteredData
      .filter((r) => r.origem === 'Emissao')
      .reduce((s, r) => s + r.valor, 0)
    const aConfirmar = filteredData
      .filter((r) => r.origem === 'A Confirmar')
      .reduce((s, r) => s + r.valor, 0)
    const pago = filteredData
      .filter((r) => r.origem === 'Pago')
      .reduce((s, r) => s + r.valor, 0)
    return { total, emissao, aConfirmar, pago }
  }, [filteredData])

  const timelineData = useMemo(() => {
    const map = new Map<string, { emissao: number; a_confirmar: number }>()
    filteredData.forEach((r) => {
      const d = parseDate(r.data)
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = map.get(key) ?? { emissao: 0, a_confirmar: 0 }
      if (r.origem === 'Emissao') entry.emissao += r.valor
      else if (r.origem === 'A Confirmar') entry.a_confirmar += r.valor
      map.set(key, entry)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [y, m] = key.split('-')
        return { label: `${m}/${y}`, emissao: val.emissao, a_confirmar: val.a_confirmar }
      })
  }, [filteredData])

  const donutData = useMemo(() => {
    const map = new Map<string, number>()
    filteredData.forEach((r) => {
      map.set(r.empresa, (map.get(r.empresa) ?? 0) + r.valor)
    })
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      color: EMPRESA_COLORS[name] ?? '#6b7280',
    }))
  }, [filteredData])

  function handleExport() {
    const headers = ['Empresa', 'Obra', 'Data', 'Fornecedor', 'Banco', 'Conta', 'Categoria', 'Origem', 'Valor']
    const rows = filteredData.map((r) => [
      r.empresa,
      r.obra,
      r.data,
      r.fornecedor,
      r.banco,
      r.conta,
      r.categoria,
      r.origem,
      r.valor.toFixed(2).replace('.', ','),
    ])
    exportCSV('contas_a_pagar.csv', headers, rows)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Contas a Pagar" />
        <div className="p-6 space-y-6">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="col-span-2 h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Contas a Pagar" />

      <div className="p-6 space-y-6 overflow-auto flex-1">
        <FilterBar showOrigem />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total do Periodo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCompact(kpis.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredData.length} registros
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Emissao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2d6a4f]">
                {formatCompact(kpis.emissao)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.total > 0 ? ((kpis.emissao / kpis.total) * 100).toFixed(1) : '0.0'}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                A Confirmar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#52b788]">
                {formatCompact(kpis.aConfirmar)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.total > 0 ? ((kpis.aConfirmar / kpis.total) * 100).toFixed(1) : '0.0'}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCompact(kpis.pago)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.total > 0 ? ((kpis.pago / kpis.total) * 100).toFixed(1) : '0.0'}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Evolucao Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineChart
                data={timelineData}
                bars={[
                  { key: 'emissao', color: '#2d6a4f', name: 'Emissao' },
                  { key: 'a_confirmar', color: '#52b788', name: 'A Confirmar' },
                ]}
                height={320}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={donutData}
                centerLabel="Total"
                centerValue={formatCompact(kpis.total)}
                height={250}
              />
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Detalhamento</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredData}
              columns={columns as ColumnDef<APRecord, unknown>[]}
              searchPlaceholder="Buscar fornecedor, empresa..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
