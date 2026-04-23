import { useMemo, useEffect, useState } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from '@e965/xlsx'
import { FilterSidebar } from '@/components/filters/FilterSidebar'
import { TimelineChart } from '@/components/charts/TimelineChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { DataTable } from '@/components/tables/DataTable'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useReceitas } from '@/hooks/useFinanceiro'
import { useFilterStore } from '@/hooks/useFilters'
import { formatCurrency, formatCompact, parseDate } from '@/lib/formatters'
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
  useEffect(() => { document.title = 'Receitas | DashFinance' }, [])
  const { data: allData, isLoading } = useReceitas()
  const filters = useFilterStore()

  const filtered = useMemo(() => {
    if (!allData) return []
    const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
    const d2 = filters.dtFim ? new Date(filters.dtFim + 'T23:59:59') : null
    
    return allData.filter((r) => {
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      
      if (filters.empresas.length > 0 && !filters.empresas.includes(r.empresa)) return false
      if (filters.obras.length > 0 && !filters.obras.includes(r.obra)) return false
      if (filters.status_list.length > 0 && !filters.status_list.includes(r.status)) return false
      
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
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const emAtraso = filtered
      .filter((r) => r.status === 'A Receber' && (() => { const d = parseDate(r.data_venc); return d !== null && d < hoje })())
      .reduce((s, r) => s + r.valor, 0)
    const taxa = total > 0 ? (recebido / total) * 100 : 0
    return { total, recebido, aReceber, emAtraso, taxa }
  }, [filtered])

  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily')

  const chartData = useMemo(() => {
    const byPeriod: Record<string, { recebida: number; a_receber: number }> = {}
    filtered.forEach((r) => {
      const d = parseDate(r.data)
      if (!d) return
      const key = chartMode === 'daily'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byPeriod[key]) byPeriod[key] = { recebida: 0, a_receber: 0 }
      if (r.status === 'Recebida') byPeriod[key].recebida += r.valor
      else byPeriod[key].a_receber += r.valor
    })
    return Object.entries(byPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        if (chartMode === 'daily') {
          const [, m, dd] = key.split('-')
          return { label: `${dd}/${m}`, ...v }
        } else {
          const [y, m] = key.split('-')
          return { label: `${m}/${y}`, ...v }
        }
      })
  }, [filtered, chartMode])

  const { obrasData, clientesData, totalRecebido } = useMemo(() => {
    if (!filtered) return { obrasData: [], clientesData: [], totalRecebido: 0 }
    const byObra: Record<string, number> = {}
    const byCliente: Record<string, number> = {}
    let total = 0

    const CHART_COLORS = ['#2ea043', '#1f6feb', '#d29922', '#8957e5', '#f85149', '#373e47', '#005cc5', '#e36209']
    
    const formatTopN = (arr: [string, number][], n = 5) => {
      let result = arr.slice(0, n)
      const others = arr.slice(n).reduce((acc, curr) => acc + curr[1], 0)
      if (others > 0) result.push(['Outros', others])
      return result.map(([name, value], i) => ({
        name: name || 'N/A',
        value,
        color: CHART_COLORS[i % CHART_COLORS.length]
      }))
    }

    filtered.forEach((r) => {
      byObra[r.obra || 'N/A'] = (byObra[r.obra || 'N/A'] || 0) + r.valor
      byCliente[r.cliente || 'N/A'] = (byCliente[r.cliente || 'N/A'] || 0) + r.valor
      total += r.valor
    })

    return {
      obrasData: formatTopN(Object.entries(byObra).sort((a,b) => b[1] - a[1]), 5),
      clientesData: formatTopN(Object.entries(byCliente).sort((a,b) => b[1] - a[1]), 6),
      totalRecebido: total
    }
  }, [filtered])


  const empresaLabel = filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Todas as Empresas'
  const periodoLabel = filters.dtInicio && filters.dtFim
    ? `${filters.dtInicio.split('-').reverse().join('/')} a ${filters.dtFim.split('-').reverse().join('/')}`
    : 'Período completo'

  const handleExportXLSX = () => {
    const aoa = [
      ['RECEITAS'],
      [`Empresa: ${empresaLabel}`],
      [`Período: ${periodoLabel}`],
      [`Total: ${formatCurrency(kpis.total)} (${filtered.length} registros)`],
      [],
      ['Obra', 'Cliente', 'Tipo', 'Data', 'Data Venc.', 'Status', 'Valor'],
      ...filtered.map((r) => [r.obra, r.cliente, TIPO_LABEL[r.tipo] || r.tipo, r.data, r.data_venc, r.status, r.valor]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 35 }, { wch: 45 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Receitas')
    XLSX.writeFile(wb, `receitas_${empresaLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const marginX = 10
    let y = 12

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('RECEITAS', marginX, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Empresa: ${empresaLabel}`, marginX, y)
    y += 5
    doc.text(`Período: ${periodoLabel}`, marginX, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ${formatCurrency(kpis.total)} (${filtered.length} registros)`, marginX, y)
    y += 8

    const cols = ['Obra', 'Cliente', 'Tipo', 'Data', 'Data Venc.', 'Status', 'Valor']
    const rows = filtered.map((r) => [
      r.obra, r.cliente, TIPO_LABEL[r.tipo] || r.tipo, r.data, r.data_venc, r.status,
      formatCurrency(r.valor),
    ])

    // col widths must sum to exactly 190mm: 38+58+22+18+18+16+20 = 190
    autoTable(doc, {
      startY: y,
      head: [cols],
      body: rows,
      foot: [['', '', '', '', '', 'TOTAL', formatCurrency(kpis.total)]],
      theme: 'grid',
      tableWidth: 190,
      margin: { left: marginX, right: marginX },
      showFoot: 'lastPage',
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [64, 64, 64], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 58 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 20, halign: 'right' },
      },
    })

    doc.save(`receitas_${empresaLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        <FilterSidebar showStatus />
        <div className="px-3 sm:px-6 pt-4 pb-6 space-y-4 flex-1 overflow-auto">
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <FilterSidebar showStatus />
      
      <div className="px-3 sm:px-6 pt-4 pb-6 space-y-4 overflow-auto flex-1">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total do Período</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCompact(kpis.total)}</div></CardContent></Card>
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Recebido</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-400">{formatCompact(kpis.recebido)}</div></CardContent></Card>
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">A Receber</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-400">{formatCompact(kpis.aReceber)}</div></CardContent></Card>
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Em Atraso</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-500">{formatCompact(kpis.emAtraso)}</div></CardContent></Card>
        </div>

        {/* Taxa de Recebimento */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Taxa de Recebimento</CardTitle></CardHeader>
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
          <Card className="lg:col-span-2 rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {chartMode === 'daily' ? 'Timeline Diário de Recebimentos' : 'Timeline Mensal de Recebimentos'}
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
              <TimelineChart data={chartData} bars={[
                { key: 'recebida', color: '#065f46', name: 'Recebida' },
                { key: 'a_receber', color: '#f59e0b', name: 'A Receber' },
              ]} height={320} />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader><CardTitle className="text-sm font-medium">Por Obra</CardTitle></CardHeader>
              <CardContent>
                <DonutChart data={obrasData} centerLabel="Total" centerValue={formatCompact(totalRecebido)} height={160} />
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardHeader><CardTitle className="text-sm font-medium">Por Cliente (Top 6)</CardTitle></CardHeader>
              <CardContent>
                <DonutChart data={clientesData} centerLabel="Total" centerValue={formatCompact(totalRecebido)} height={160} />
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
              data={filtered}
              columns={columns as ColumnDef<ReceitaRecord, unknown>[]}
              searchPlaceholder="Buscar cliente, obra..."
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
