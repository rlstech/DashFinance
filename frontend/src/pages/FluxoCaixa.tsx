import { useMemo, useEffect, useState } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Download, FileText, Sheet } from 'lucide-react'
import { exportPivotPDF, exportPivotXLSX } from '@/lib/exportPivot'
import { FilterSidebar } from '@/components/filters/FilterSidebar'
import { CashFlowChart } from '@/components/charts/CashFlowChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { DataTable } from '@/components/tables/DataTable'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAP, useReceitas, useSaldoBanco } from '@/hooks/useFinanceiro'
import { useFilterStore } from '@/hooks/useFilters'
import { formatCurrency, formatCompact, parseDate, compareDates, exportCSV } from '@/lib/formatters'
import { EMPRESA_COLORS } from '@/types'

interface DiaData {
  data: string
  entradas: number
  saidas: number
  saldo_dia: number
  acumulado: number
  saldo_banco: number | null
  saldo_anterior: number | null
}

const col = createColumnHelper<DiaData>()

function valCell(getValue: () => number | null, positive = false) {
  const v = getValue()
  if (v === null || v === undefined) return <span className="text-muted-foreground">-</span>
  const color = v >= 0 ? 'text-emerald-400' : 'text-red-400'
  return <span className={`font-medium tabular-nums block text-right ${positive ? '' : color}`}>{formatCurrency(v)}</span>
}

const columns = [
  col.accessor('data', { header: 'Data' }),
  col.accessor('saldo_anterior', { header: 'Saldo Anterior', cell: (info) => valCell(info.getValue as () => number | null) }),
  col.accessor('entradas', { header: 'Entradas', cell: (info) => <span className="font-medium tabular-nums block text-right text-emerald-400">{formatCurrency(info.getValue())}</span> }),
  col.accessor('saidas', { header: 'Saídas', cell: (info) => <span className="font-medium tabular-nums block text-right text-red-400">{formatCurrency(info.getValue())}</span> }),
  col.accessor('saldo_dia', { header: 'Saldo do Dia', cell: (info) => valCell(info.getValue as () => number | null) }),
  col.accessor('acumulado', { header: 'Saldo Acumulado', cell: (info) => valCell(info.getValue as () => number | null) }),
  col.accessor('saldo_banco', { header: 'Saldo Bancário', cell: (info) => valCell(info.getValue as () => number | null) }),
]

export default function FluxoCaixa() {
  useEffect(() => { document.title = 'Fluxo de Caixa | DashFinance' }, [])
  const { data: apData, isLoading: apLoading } = useAP()
  const { data: recData, isLoading: recLoading } = useReceitas()
  const { data: saldoData, isLoading: saldoLoading } = useSaldoBanco()
  const filters = useFilterStore()
  const isLoading = apLoading || recLoading || saldoLoading

  const diasData = useMemo(() => {
    if (!apData || !recData || !saldoData) return []
    const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
    const d2 = filters.dtFim ? new Date(filters.dtFim + 'T23:59:59') : null
    
    // Convert old single selections to handles on the arrays
    // FluxoCaixa supports filtering but note that `saidas` / `entradas` might have specific visibility rules
    const emps = filters.empresas
    const obs = filters.obras
    const visList = filters.vis

    const hasRealizado = visList.includes('realizado') || visList.includes('todos') || visList.length === 0
    const hasProjetado = visList.includes('projetado') || visList.includes('todos') || visList.length === 0

    // Filter saidas (AP)
    const saidas = apData.filter((r) => {
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      if (emps.length > 0 && !emps.includes(r.empresa)) return false
      if (obs.length > 0 && !obs.includes(r.obra)) return false
      if (filters.bancos.length > 0 && !filters.bancos.includes(r.banco)) return false
      if (filters.contas.length > 0 && !filters.contas.includes(r.conta)) return false
      
      const isRealizado = r.origem === 'Pago'
      if (isRealizado && !hasRealizado) return false
      if (!isRealizado && !hasProjetado) return false
      return true
    })

    // Filter entradas (Receitas)
    const entradas = recData.filter((r) => {
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      if (emps.length > 0 && !emps.includes(r.empresa)) return false
      if (obs.length > 0 && !obs.includes(r.obra)) return false
      if (filters.bancos.length > 0 && r.banco && !filters.bancos.includes(r.banco)) return false
      if (filters.contas.length > 0 && r.conta && !filters.contas.includes(r.conta)) return false
      
      const isRealizado = r.status === 'Recebida'
      if (isRealizado && !hasRealizado) return false
      if (!isRealizado && !hasProjetado) return false
      return true
    })

    // Aggregate by date
    const byDate: Record<string, { e: number; s: number }> = {}
    entradas.forEach((r) => {
      if (!byDate[r.data]) byDate[r.data] = { e: 0, s: 0 }
      byDate[r.data].e += r.valor
    })
    saidas.forEach((r) => {
      if (!byDate[r.data]) byDate[r.data] = { e: 0, s: 0 }
      byDate[r.data].s += r.valor
    })

    const sortedDates = Object.keys(byDate).sort(compareDates)

    // Build saldo bancário timelines first so we can derive saldoPrimeiroDia
    const saldoFiltered = saldoData.filter((r) => {
      if (emps.length > 0 && !emps.includes(r.empresa)) return false
      if (filters.bancos.length > 0 && !filters.bancos.includes(r.banco)) return false
      if (filters.contas.length > 0 && !filters.contas.includes(r.conta)) return false
      return true
    })

    const timelines: Record<string, { dateObj: Date; saldo: number }[]> = {}
    saldoFiltered.forEach((r) => {
      const key = `${r.empresa}|${r.banco}|${r.conta}`
      if (!timelines[key]) timelines[key] = []
      const d = parseDate(r.data)
      if (d) timelines[key].push({ dateObj: d, saldo: r.saldo })
    })
    Object.values(timelines).forEach((arr) => arr.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()))

    const keys = Object.keys(timelines)
    const pointers: Record<string, number> = {}
    const current: Record<string, number | null> = {}
    keys.forEach((k) => { pointers[k] = 0; current[k] = null })

    function computeSaldoBanco(targetDate: Date): number | null {
      keys.forEach((k) => {
        const tl = timelines[k]
        while (pointers[k] < tl.length && tl[pointers[k]].dateObj <= targetDate) {
          current[k] = tl[pointers[k]].saldo
          pointers[k]++
        }
      })
      let total = 0
      let hasAny = false
      keys.forEach((k) => { if (current[k] !== null) { total += current[k]!; hasAny = true } })
      return hasAny ? total : null
    }

    // Saldo bancário no dia anterior ao primeiro dia do período
    let saldoPrimeiroDia: number | null = null
    if (sortedDates.length > 0) {
      const firstDate = parseDate(sortedDates[0])
      if (firstDate) {
        const dayBefore = new Date(firstDate)
        dayBefore.setDate(dayBefore.getDate() - 1)
        let total = 0
        let hasAny = false
        keys.forEach((k) => {
          const tl = timelines[k]
          for (let i = tl.length - 1; i >= 0; i--) {
            if (tl[i].dateObj <= dayBefore) { total += tl[i].saldo; hasAny = true; break }
          }
        })
        saldoPrimeiroDia = hasAny ? total : null
      }
    }

    // Acumulado começa pelo saldo bancário do dia anterior (inclui dias futuros projetados)
    let acumulado = saldoPrimeiroDia ?? 0
    let dias = sortedDates.map((data) => {
      const saldo_dia = byDate[data].e - byDate[data].s
      acumulado += saldo_dia
      return { data, entradas: byDate[data].e, saidas: byDate[data].s, saldo_dia, acumulado, saldo_banco: null as number | null, saldo_anterior: null as number | null }
    })

    // Compute saldo_banco for each day
    dias = dias.map((d) => ({ ...d, saldo_banco: computeSaldoBanco(parseDate(d.data)!) }))
    // Compute saldo_anterior
    dias = dias.map((d, i) => ({ ...d, saldo_anterior: i > 0 ? dias[i - 1].saldo_banco : saldoPrimeiroDia }))

    return dias
  }, [apData, recData, saldoData, filters])

  const kpis = useMemo(() => {
    const totalEntradas = diasData.reduce((s, d) => s + d.entradas, 0)
    const totalSaidas = diasData.reduce((s, d) => s + d.saidas, 0)
    const saldo = totalEntradas - totalSaidas
    const diasPositivos = diasData.filter((d) => d.saldo_dia >= 0).length
    return { totalEntradas, totalSaidas, saldo, diasPositivos, totalDias: diasData.length }
  }, [diasData])

  const [chartMode, setChartMode] = useState<'diario' | 'mensal'>('diario')

  const chartData = useMemo(() =>
    diasData.map((d) => ({ label: d.data, entradas: d.entradas, saidas: d.saidas, acumulado: d.acumulado })),
    [diasData]
  )

  const chartDataMensal = useMemo(() => {
    const byMonth: Record<string, { entradas: number; saidas: number }> = {}
    const order: string[] = []
    diasData.forEach((d) => {
      const parts = d.data.split('/')
      const key = `${parts[1]}/${parts[2]}`
      if (!byMonth[key]) { byMonth[key] = { entradas: 0, saidas: 0 }; order.push(key) }
      byMonth[key].entradas += d.entradas
      byMonth[key].saidas += d.saidas
    })
    let acumulado = 0
    return order.map((key) => {
      acumulado += byMonth[key].entradas - byMonth[key].saidas
      return { label: key, ...byMonth[key], acumulado }
    })
  }, [diasData])

  const necessidadeAporte = useMemo(() => {
    let acumAnterior = 0
    return diasData.map((d) => {
      const necessidade = d.saidas - d.entradas - Math.max(acumAnterior, 0)
      acumAnterior = d.acumulado
      return necessidade > 0 ? -necessidade : null
    })
  }, [diasData])

  const obrasBreakdown = useMemo(() => {
    if (!apData || !recData) return { entradasByObra: {}, saidasByObra: {}, obrasEntrada: [], obrasSaida: [] }
    const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
    const d2 = filters.dtFim ? new Date(filters.dtFim + 'T23:59:59') : null
    const emps = filters.empresas
    const obs = filters.obras
    const hasRealizado = filters.vis.includes('realizado') || filters.vis.includes('todos') || filters.vis.length === 0
    const hasProjetado = filters.vis.includes('projetado') || filters.vis.includes('todos') || filters.vis.length === 0

    // obra -> date -> value
    const entradasByObra: Record<string, Record<string, number>> = {}
    const saidasByObra: Record<string, Record<string, number>> = {}

    recData.forEach((r) => {
      if (d1 || d2) { const rd = parseDate(r.data); if (!rd || (d1 && rd < d1) || (d2 && rd > d2)) return }
      if (emps.length > 0 && !emps.includes(r.empresa)) return
      if (obs.length > 0 && !obs.includes(r.obra)) return
      if (filters.bancos.length > 0 && r.banco && !filters.bancos.includes(r.banco)) return
      if (filters.contas.length > 0 && r.conta && !filters.contas.includes(r.conta)) return
      const isRealizado = r.status === 'Recebida'
      if (isRealizado && !hasRealizado) return
      if (!isRealizado && !hasProjetado) return
      const obra = r.obra || 'N/A'
      if (!entradasByObra[obra]) entradasByObra[obra] = {}
      entradasByObra[obra][r.data] = (entradasByObra[obra][r.data] || 0) + r.valor
    })

    apData.forEach((r) => {
      if (d1 || d2) { const rd = parseDate(r.data); if (!rd || (d1 && rd < d1) || (d2 && rd > d2)) return }
      if (emps.length > 0 && !emps.includes(r.empresa)) return
      if (obs.length > 0 && !obs.includes(r.obra)) return
      if (filters.bancos.length > 0 && !filters.bancos.includes(r.banco)) return
      if (filters.contas.length > 0 && !filters.contas.includes(r.conta)) return
      const isRealizado = r.origem === 'Pago'
      if (isRealizado && !hasRealizado) return
      if (!isRealizado && !hasProjetado) return
      const obra = r.obra || 'N/A'
      if (!saidasByObra[obra]) saidasByObra[obra] = {}
      saidasByObra[obra][r.data] = (saidasByObra[obra][r.data] || 0) + r.valor
    })

    const obrasEntrada = Object.keys(entradasByObra).sort()
    const obrasSaida = Object.keys(saidasByObra).sort()
    return { entradasByObra, saidasByObra, obrasEntrada, obrasSaida }
  }, [apData, recData, filters])

  const [donutMode, setDonutMode] = useState<'entradas' | 'saidas'>('entradas')

  const { obrasData, totalRecebimento, obrasSaidaData, totalSaidas: totalSaidasObra } = useMemo(() => {
    const CHART_COLORS = ['#2ea043', '#1f6feb', '#d29922', '#8957e5', '#f85149', '#373e47', '#005cc5', '#e36209']
    const formatTopN = (arr: [string, number][], n = 5) => {
      let result = arr.slice(0, n)
      const others = arr.slice(n).reduce((acc, curr) => acc + curr[1], 0)
      if (others > 0) result.push(['Outros', others])
      return result.map(([name, value], i) => ({ name: name || 'N/A', value, color: CHART_COLORS[i % CHART_COLORS.length] }))
    }

    const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
    const d2 = filters.dtFim ? new Date(filters.dtFim + 'T23:59:59') : null
    const hasRealizado = filters.vis.includes('realizado') || filters.vis.includes('todos') || filters.vis.length === 0
    const hasProjetado = filters.vis.includes('projetado') || filters.vis.includes('todos') || filters.vis.length === 0

    const byObraRec: Record<string, number> = {}
    let totalRec = 0
    if (recData) {
      recData.filter((r) => {
        if (d1 || d2) { const rd = parseDate(r.data); if (!rd || (d1 && rd < d1) || (d2 && rd > d2)) return false }
        if (filters.empresas.length > 0 && !filters.empresas.includes(r.empresa)) return false
        if (filters.obras.length > 0 && !filters.obras.includes(r.obra)) return false
        if (filters.bancos.length > 0 && r.banco && !filters.bancos.includes(r.banco)) return false
        if (filters.contas.length > 0 && r.conta && !filters.contas.includes(r.conta)) return false
        const isRealizado = r.status === 'Recebida'
        if (isRealizado && !hasRealizado) return false
        if (!isRealizado && !hasProjetado) return false
        return true
      }).forEach((r) => { byObraRec[r.obra || 'N/A'] = (byObraRec[r.obra || 'N/A'] || 0) + r.valor; totalRec += r.valor })
    }

    const byObraAP: Record<string, number> = {}
    let totalAP = 0
    if (apData) {
      apData.filter((r) => {
        if (d1 || d2) { const rd = parseDate(r.data); if (!rd || (d1 && rd < d1) || (d2 && rd > d2)) return false }
        if (filters.empresas.length > 0 && !filters.empresas.includes(r.empresa)) return false
        if (filters.obras.length > 0 && !filters.obras.includes(r.obra)) return false
        if (filters.bancos.length > 0 && !filters.bancos.includes(r.banco)) return false
        if (filters.contas.length > 0 && !filters.contas.includes(r.conta)) return false
        const isRealizado = r.origem === 'Pago'
        if (isRealizado && !hasRealizado) return false
        if (!isRealizado && !hasProjetado) return false
        return true
      }).forEach((r) => { byObraAP[r.obra || 'N/A'] = (byObraAP[r.obra || 'N/A'] || 0) + r.valor; totalAP += r.valor })
    }

    return {
      obrasData: formatTopN(Object.entries(byObraRec).sort((a, b) => b[1] - a[1]), 5),
      totalRecebimento: totalRec,
      obrasSaidaData: formatTopN(Object.entries(byObraAP).sort((a, b) => b[1] - a[1]), 5),
      totalSaidas: totalAP,
    }
  }, [recData, apData, filters])

  const handleExport = () => {
    exportCSV('fluxo_caixa.csv',
      ['Data', 'Entradas', 'Saidas', 'Saldo do Dia', 'Saldo Acumulado'],
      diasData.map((d) => [d.data, String(d.entradas).replace('.', ','), String(d.saidas).replace('.', ','), String(d.saldo_dia).replace('.', ','), String(d.acumulado).replace('.', ',')])
    )
  }

  const buildPivotExportData = () => {
    const empresaLabel = filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Todas as Empresas'
    const fmtIso = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
    const periodoLabel = filters.dtInicio && filters.dtFim
      ? `${fmtIso(filters.dtInicio)} a ${fmtIso(filters.dtFim)}`
      : diasData.length > 0 ? `${diasData[0].data} a ${diasData[diasData.length - 1].data}` : ''
    return {
      diasData,
      entradasByObra: obrasBreakdown.entradasByObra,
      saidasByObra: obrasBreakdown.saidasByObra,
      obrasEntrada: obrasBreakdown.obrasEntrada,
      obrasSaida: obrasBreakdown.obrasSaida,
      necessidadeAporte,
      empresaLabel,
      periodoLabel,
      saldoBancario: diasData[0]?.saldo_anterior ?? null,
    }
  }

  const handleExportPDF = () => exportPivotPDF(buildPivotExportData())
  const handleExportXLSX = () => exportPivotXLSX(buildPivotExportData())

  if (isLoading) {
    return (
      <div className="flex h-full">
        <FilterSidebar showVis />
        <div className="px-6 pt-4 pb-6 space-y-4 flex-1 overflow-auto">
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <FilterSidebar showVis />
      
      <div className="px-6 pt-4 pb-6 space-y-4 overflow-auto flex-1">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Entradas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-400">{formatCompact(kpis.totalEntradas)}</div></CardContent></Card>
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Saídas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-400">{formatCompact(kpis.totalSaidas)}</div></CardContent></Card>
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Saldo do Período</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${kpis.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCompact(kpis.saldo)}</div></CardContent></Card>
          <Card className="rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Dias Positivos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{kpis.diasPositivos} <span className="text-sm font-normal text-muted-foreground">/ {kpis.totalDias}</span></div></CardContent></Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <Card className="lg:col-span-2 rounded-xl shadow-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Fluxo de Caixa {chartMode === 'diario' ? 'Diário' : 'Mensal'}</CardTitle>
              <div className="flex gap-1">
                <Button variant={chartMode === 'diario' ? 'default' : 'outline'} size="sm" className="rounded-lg h-7 text-xs px-3" onClick={() => setChartMode('diario')}>Diário</Button>
                <Button variant={chartMode === 'mensal' ? 'default' : 'outline'} size="sm" className="rounded-lg h-7 text-xs px-3" onClick={() => setChartMode('mensal')}>Mensal</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <CashFlowChart data={chartMode === 'diario' ? chartData : chartDataMensal} height={350} />
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{donutMode === 'entradas' ? 'Entradas' : 'Saídas'} por Obra</CardTitle>
              <div className="flex gap-1">
                <Button variant={donutMode === 'entradas' ? 'default' : 'outline'} size="sm" className="rounded-lg h-7 text-xs px-3" onClick={() => setDonutMode('entradas')}>Entradas</Button>
                <Button variant={donutMode === 'saidas' ? 'default' : 'outline'} size="sm" className="rounded-lg h-7 text-xs px-3" onClick={() => setDonutMode('saidas')}>Saídas</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <DonutChart
                data={donutMode === 'entradas' ? obrasData : obrasSaidaData}
                centerLabel={donutMode === 'entradas' ? 'Entradas' : 'Saídas'}
                centerValue={formatCompact(donutMode === 'entradas' ? totalRecebimento : totalSaidasObra)}
                height={220}
              />
            </CardContent>
          </Card>
        </div>

        {/* Pivot table */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Fluxo de Caixa por Dia</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handleExportXLSX} className="rounded-lg h-7 text-xs px-3"><Sheet className="h-3.5 w-3.5 mr-1.5" />XLSX</Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-lg h-7 text-xs px-3"><FileText className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 bg-card z-10 text-left px-4 py-2 font-medium text-muted-foreground min-w-[160px]">Rótulos de Linha</th>
                    {diasData.map((d) => (
                      <th key={d.data} className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap min-w-[100px]">{d.data}</th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap min-w-[110px]">Total Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Entrada — total */}
                  <tr className="border-b border-border/50 bg-emerald-950/20">
                    <td className="sticky left-0 z-10 px-4 py-2 font-semibold" style={{background: 'color-mix(in srgb, hsl(var(--card)) 85%, #065f46 15%)'}}>— Entrada</td>
                    {diasData.map((d) => (
                      <td key={d.data} className="text-right px-3 py-2 tabular-nums font-semibold text-emerald-400">
                        {d.entradas > 0 ? formatCurrency(d.entradas) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 tabular-nums font-semibold text-emerald-400">
                      {formatCurrency(diasData.reduce((s, d) => s + d.entradas, 0))}
                    </td>
                  </tr>
                  {/* Entrada — por obra */}
                  {obrasBreakdown.obrasEntrada.map((obra) => {
                    const byDate = obrasBreakdown.entradasByObra[obra]
                    const total = Object.values(byDate).reduce((s: number, v) => s + v, 0)
                    return (
                      <tr key={`e-${obra}`} className="border-b border-border/30">
                        <td className="sticky left-0 z-10 px-4 py-1.5 pl-8 text-muted-foreground" style={{background: 'hsl(var(--card))'}}>
                          {obra}
                        </td>
                        {diasData.map((d) => (
                          <td key={d.data} className="text-right px-3 py-1.5 tabular-nums text-emerald-400/80">
                            {byDate[d.data] ? formatCurrency(byDate[d.data]) : <span className="text-muted-foreground/30">-</span>}
                          </td>
                        ))}
                        <td className="text-right px-3 py-1.5 tabular-nums text-emerald-400/80 font-medium">
                          {formatCurrency(total)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Saída — total */}
                  <tr className="border-b border-border/50 bg-red-950/20">
                    <td className="sticky left-0 z-10 px-4 py-2 font-semibold" style={{background: 'color-mix(in srgb, hsl(var(--card)) 85%, #7f1d1d 15%)'}}>— Saída</td>
                    {diasData.map((d) => (
                      <td key={d.data} className="text-right px-3 py-2 tabular-nums font-semibold text-red-400">
                        {d.saidas > 0 ? formatCurrency(d.saidas) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 tabular-nums font-semibold text-red-400">
                      {formatCurrency(diasData.reduce((s, d) => s + d.saidas, 0))}
                    </td>
                  </tr>
                  {/* Saída — por obra */}
                  {obrasBreakdown.obrasSaida.map((obra) => {
                    const byDate = obrasBreakdown.saidasByObra[obra]
                    const total = Object.values(byDate).reduce((s: number, v) => s + v, 0)
                    return (
                      <tr key={`s-${obra}`} className="border-b border-border/30">
                        <td className="sticky left-0 z-10 px-4 py-1.5 pl-8 text-muted-foreground" style={{background: 'hsl(var(--card))'}}>
                          {obra}
                        </td>
                        {diasData.map((d) => (
                          <td key={d.data} className="text-right px-3 py-1.5 tabular-nums text-red-400/80">
                            {byDate[d.data] ? formatCurrency(byDate[d.data]) : <span className="text-muted-foreground/30">-</span>}
                          </td>
                        ))}
                        <td className="text-right px-3 py-1.5 tabular-nums text-red-400/80 font-medium">
                          {formatCurrency(total)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Saldo Acumulado */}
                  <tr className="border-b border-border/50">
                    <td className="sticky left-0 bg-card z-10 px-4 py-2 font-semibold" style={{background: 'hsl(var(--card))'}}>Saldo Acumulado</td>
                    {diasData.map((d) => (
                      <td key={d.data} className={`text-right px-3 py-2 tabular-nums font-semibold ${d.acumulado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(d.acumulado)}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 tabular-nums font-semibold text-muted-foreground">-</td>
                  </tr>
                  {/* Necessidade de Aporte */}
                  <tr className="bg-orange-950/20">
                    <td className="sticky left-0 z-10 px-4 py-2 font-semibold" style={{background: 'color-mix(in srgb, hsl(var(--card)) 85%, #431407 15%)'}}>Necessidade de Aporte</td>
                    {necessidadeAporte.map((v, i) => (
                      <td key={diasData[i].data} className="text-right px-3 py-2 tabular-nums font-semibold text-red-400">
                        {v !== null ? formatCurrency(v) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 tabular-nums font-semibold text-red-400">
                      {(() => { const t = necessidadeAporte.reduce((s: number, v) => s + (v ?? 0), 0); return t !== 0 ? formatCurrency(t) : <span className="text-muted-foreground/40">-</span> })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Saldo por Dia</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} className="rounded-lg"><Download className="h-4 w-4 mr-2" />Exportar</Button>
          </CardHeader>
          <CardContent>
            <DataTable data={diasData} columns={columns as ColumnDef<DiaData, unknown>[]} searchPlaceholder="Buscar data..." />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
