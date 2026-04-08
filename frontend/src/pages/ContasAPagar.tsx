import { useMemo, useEffect, useState } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
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
import { formatCurrency, formatCompact, parseDate } from '@/lib/formatters'
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

  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily')

  const timelineData = useMemo(() => {
    const map = new Map<string, { emissao: number; a_confirmar: number }>()
    filteredData.forEach((r) => {
      const d = parseDate(r.data)
      if (!d) return
      const key = chartMode === 'daily'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = map.get(key) ?? { emissao: 0, a_confirmar: 0 }
      if (r.origem === 'Emissao') entry.emissao += r.valor
      else if (r.origem === 'A Confirmar') entry.a_confirmar += r.valor
      map.set(key, entry)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        if (chartMode === 'daily') {
          const [, m, dd] = key.split('-')
          return { label: `${dd}/${m}`, emissao: val.emissao, a_confirmar: val.a_confirmar }
        } else {
          const [y, m] = key.split('-')
          return { label: `${m}/${y}`, emissao: val.emissao, a_confirmar: val.a_confirmar }
        }
      })
  }, [filteredData, chartMode])

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


  const empresaLabel = empresas.length > 0 ? empresas.join(', ') : 'Todas as Empresas'
  const periodoLabel = dtInicio && dtFim
    ? `${dtInicio.split('-').reverse().join('/')} a ${dtFim.split('-').reverse().join('/')}`
    : 'Período completo'

  function handleExportXLSX() {
    const aoa = [
      ['CONTAS A PAGAR'],
      [`Empresa: ${empresaLabel}`],
      [`Período: ${periodoLabel}`],
      [`Total: ${formatCurrency(kpis.total)} (${filteredData.length} registros)`],
      [],
      ['Obra', 'Data', 'Fornecedor', 'Banco', 'Conta', 'Categoria', 'Origem', 'Valor'],
      ...filteredData.map((r) => [r.obra, r.data, r.fornecedor, r.banco, r.conta, r.categoria, r.origem, r.valor]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar')
    XLSX.writeFile(wb, `contas_a_pagar_${empresaLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
  }

  function handleExportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const marginX = 10
    let y = 12

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('CONTAS A PAGAR', marginX, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Empresa: ${empresaLabel}`, marginX, y)
    y += 5
    doc.text(`Período: ${periodoLabel}`, marginX, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ${formatCurrency(kpis.total)} (${filteredData.length} registros)`, marginX, y)
    y += 8

    const cols = ['Obra', 'Data', 'Fornecedor', 'Banco', 'Conta', 'Categoria', 'Origem', 'Valor']
    const rows = filteredData.map((r) => [
      r.obra, r.data, r.fornecedor, r.banco, r.conta, r.categoria, r.origem,
      formatCurrency(r.valor),
    ])

    // col widths must sum to exactly 190mm: 33+16+46+20+17+20+16+22 = 190
    autoTable(doc, {
      startY: y,
      head: [cols],
      body: rows,
      foot: [['', '', '', '', '', '', 'TOTAL', formatCurrency(kpis.total)]],
      theme: 'grid',
      tableWidth: 190,
      margin: { left: marginX, right: marginX },
      showFoot: 'lastPage',
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [64, 64, 64], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 33 },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 46 },
        3: { cellWidth: 20 },
        4: { cellWidth: 17 },
        5: { cellWidth: 20 },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 22, halign: 'right' },
      },
    })

    doc.save(`contas_a_pagar_${empresaLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        <FilterSidebar showOrigem />
        <div className="px-3 sm:px-6 pt-4 pb-6 space-y-4 flex-1 overflow-auto">
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

      <div className="px-3 sm:px-6 pt-4 pb-6 space-y-4 overflow-auto flex-1">
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {chartMode === 'daily' ? 'Evolução Diária' : 'Evolução Mensal'}
              </CardTitle>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                <button
                  onClick={() => setChartMode('daily')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    chartMode === 'daily'
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Diário
                </button>
                <button
                  onClick={() => setChartMode('monthly')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    chartMode === 'monthly'
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Mensal
                </button>
              </div>
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportXLSX} className="rounded-lg">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                XLSX
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-lg">
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredData}
              columns={columns as ColumnDef<APRecord, unknown>[]}
              searchPlaceholder="Buscar fornecedor, empresa..."
              footerRow={
                <tr>
                  <td colSpan={6} className="px-4 py-2 text-sm font-semibold text-right text-muted-foreground">
                    Total do Período
                  </td>
                  <td className="px-4 py-2 text-sm font-bold text-right tabular-nums">
                    {formatCurrency(kpis.total)}
                  </td>
                </tr>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
