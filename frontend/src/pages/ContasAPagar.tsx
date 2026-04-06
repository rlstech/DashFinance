import { useMemo, useEffect } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { FilterSidebar } from '@/components/filters/FilterSidebar'
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
  useEffect(() => { document.title = 'Contas a Pagar | DashFinance' }, [])
  const { data: ALL_DATA, isLoading } = useAP()
  const { empresas, obras, dtInicio, dtFim, origens, bancos, contas } = useFilterStore()

  const filteredData = useMemo(() => {
    if (!ALL_DATA) return []

    const inicio = dtInicio ? new Date(dtInicio + 'T00:00:00') : null
    const fim = dtFim ? new Date(dtFim + 'T23:59:59') : null

    return ALL_DATA.filter((r) => {
      if (empresas.length > 0 && !empresas.includes(r.empresa)) return false
      if (obras.length > 0 && !obras.includes(r.obra)) return false
      if (origens.length > 0 && !origens.includes(r.origem)) return false
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
  }, [ALL_DATA, empresas, obras, dtInicio, dtFim, origens, bancos, contas])

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

  const { categoriasData, fornecedoresData, totalValor } = useMemo(() => {
    if (!filteredData) return { categoriasData: [], fornecedoresData: [], totalValor: 0 }
    const byCat: Record<string, number> = {}
    const byFornecedor: Record<string, number> = {}
    let total = 0

    const CHART_COLORS = ['#2ea043', '#1f6feb', '#d29922', '#8957e5', '#f85149', '#373e47', '#005cc5', '#e36209']
    
    const formatTopN = (arr: [string, number][], n = 6) => {
      let result = arr.slice(0, n)
      const others = arr.slice(n).reduce((acc, curr) => acc + curr[1], 0)
      if (others > 0) result.push(['Outros', others])
      return result.map(([name, value], i) => ({
        name: name || 'N/A',
        value,
        color: CHART_COLORS[i % CHART_COLORS.length]
      }))
    }

    filteredData.forEach((r) => {
      byCat[r.categoria || 'N/A'] = (byCat[r.categoria || 'N/A'] || 0) + r.valor
      byFornecedor[r.fornecedor || 'N/A'] = (byFornecedor[r.fornecedor || 'N/A'] || 0) + r.valor
      total += r.valor
    })

    return {
      categoriasData: formatTopN(Object.entries(byCat).sort((a,b) => b[1] - a[1]), 5),
      fornecedoresData: formatTopN(Object.entries(byFornecedor).sort((a,b) => b[1] - a[1]), 6),
      totalValor: total
    }
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
      <div className="flex h-full">
        <FilterSidebar showOrigem />
        <div className="p-6 space-y-6 flex-1 overflow-auto">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <FilterSidebar showOrigem />

      <div className="p-6 space-y-6 overflow-auto flex-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCompact(kpis.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredData.length} registros
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Emissão
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

          <Card className="rounded-xl shadow-sm">
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

          <Card className="rounded-xl shadow-sm">
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
          <Card className="lg:col-span-2 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineChart
                data={timelineData}
                bars={[
                  { key: 'emissao', color: '#2d6a4f', name: 'Emissão' },
                  { key: 'a_confirmar', color: '#52b788', name: 'A Confirmar' },
                ]}
                height={320}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={categoriasData}
                  centerLabel="Total"
                  centerValue={formatCompact(totalValor)}
                  height={160}
                />
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Por Fornecedor (Top 6)</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={fornecedoresData}
                  centerLabel="Total"
                  centerValue={formatCompact(totalValor)}
                  height={160}
                />
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Table */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Detalhamento</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} className="rounded-lg">
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
