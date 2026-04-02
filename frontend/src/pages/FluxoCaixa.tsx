import { useMemo } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { FilterBar } from '@/components/filters/FilterBar'
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
  col.accessor('saidas', { header: 'Saidas', cell: (info) => <span className="font-medium tabular-nums block text-right text-red-400">{formatCurrency(info.getValue())}</span> }),
  col.accessor('saldo_dia', { header: 'Saldo do Dia', cell: (info) => valCell(info.getValue as () => number | null) }),
  col.accessor('acumulado', { header: 'Saldo Acumulado', cell: (info) => valCell(info.getValue as () => number | null) }),
  col.accessor('saldo_banco', { header: 'Saldo Bancario', cell: (info) => valCell(info.getValue as () => number | null) }),
]

export default function FluxoCaixa() {
  const { data: apData, isLoading: apLoading } = useAP()
  const { data: recData, isLoading: recLoading } = useReceitas()
  const { data: saldoData, isLoading: saldoLoading } = useSaldoBanco()
  const filters = useFilterStore()
  const isLoading = apLoading || recLoading || saldoLoading

  const diasData = useMemo(() => {
    if (!apData || !recData || !saldoData) return []
    const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
    const d2 = filters.dtFim ? new Date(filters.dtFim + 'T00:00:00') : null
    const emp = filters.empresa
    const obra = filters.obra
    const vis = filters.vis

    // Filter saidas (AP)
    const saidas = apData.filter((r) => {
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      if (emp && r.empresa !== emp) return false
      if (obra && r.obra !== obra) return false
      if (filters.bancos.length > 0 && !filters.bancos.includes(r.banco)) return false
      if (filters.contas.length > 0 && !filters.contas.includes(r.conta)) return false
      if (vis === 'realizado' && r.origem !== 'Pago') return false
      if (vis === 'projetado' && r.origem === 'Pago') return false
      return true
    })

    // Filter entradas (Receitas) — empty banco passes through
    const entradas = recData.filter((r) => {
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      if (emp && r.empresa !== emp) return false
      if (obra && r.obra !== obra) return false
      if (filters.bancos.length > 0 && r.banco && !filters.bancos.includes(r.banco)) return false
      if (filters.contas.length > 0 && r.conta && !filters.contas.includes(r.conta)) return false
      if (vis === 'realizado' && r.status !== 'Recebida') return false
      if (vis === 'projetado' && r.status !== 'A Receber') return false
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

    // Sort and compute acumulado
    let acumulado = 0
    let dias = Object.keys(byDate)
      .sort(compareDates)
      .map((data) => {
        const saldo_dia = byDate[data].e - byDate[data].s
        acumulado += saldo_dia
        return { data, entradas: byDate[data].e, saidas: byDate[data].s, saldo_dia, acumulado, saldo_banco: null as number | null, saldo_anterior: null as number | null }
      })

    // Forward-fill saldo bancario
    const saldoFiltered = saldoData.filter((r) => {
      if (emp && r.empresa !== emp) return false
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

    // saldoPrimeiroDia
    let saldoPrimeiroDia: number | null = null
    if (dias.length > 0) {
      const firstDate = parseDate(dias[0].data)
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

  const chartData = useMemo(() =>
    diasData.map((d) => ({ label: d.data, entradas: d.entradas, saidas: d.saidas, acumulado: d.acumulado })),
    [diasData]
  )

  const donutData = useMemo(() => {
    if (!recData) return []
    const byEmp: Record<string, number> = {}
    diasData.forEach(() => {}) // unused, use filtered entradas
    recData.filter((r) => {
      const d1 = filters.dtInicio ? new Date(filters.dtInicio + 'T00:00:00') : null
      const d2 = filters.dtFim ? new Date(filters.dtFim + 'T00:00:00') : null
      if (d1 || d2) {
        const rd = parseDate(r.data)
        if (!rd) return false
        if (d1 && rd < d1) return false
        if (d2 && rd > d2) return false
      }
      if (filters.empresa && r.empresa !== filters.empresa) return false
      return true
    }).forEach((r) => { byEmp[r.empresa] = (byEmp[r.empresa] || 0) + r.valor })
    return Object.entries(byEmp).map(([name, value]) => ({ name, value, color: EMPRESA_COLORS[name] || '#607D8B' }))
  }, [recData, filters, diasData])

  const handleExport = () => {
    exportCSV('fluxo_caixa.csv',
      ['Data', 'Entradas', 'Saidas', 'Saldo do Dia', 'Saldo Acumulado'],
      diasData.map((d) => [d.data, String(d.entradas).replace('.', ','), String(d.saidas).replace('.', ','), String(d.saldo_dia).replace('.', ','), String(d.acumulado).replace('.', ',')])
    )
  }

  if (isLoading) {
    return (
      <div><Header title="Fluxo de Caixa" />
        <div className="p-6 space-y-6">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Fluxo de Caixa" />
      <div className="p-6 space-y-6 overflow-auto flex-1">
        <FilterBar showVis />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle>Total Entradas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-400">{formatCompact(kpis.totalEntradas)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle>Total Saidas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-400">{formatCompact(kpis.totalSaidas)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle>Saldo do Periodo</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${kpis.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCompact(kpis.saldo)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle>Dias Positivos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{kpis.diasPositivos} <span className="text-sm font-normal text-muted-foreground">/ {kpis.totalDias}</span></div></CardContent></Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Fluxo de Caixa Diario</CardTitle></CardHeader>
            <CardContent>
              <CashFlowChart data={chartData} height={350} />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Entradas por Empresa</CardTitle></CardHeader>
              <CardContent>
                <DonutChart data={donutData} centerLabel="Entradas" centerValue={formatCompact(kpis.totalEntradas)} height={200} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Estatisticas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Maior entrada</span><span className="font-medium text-emerald-400">{formatCompact(Math.max(0, ...diasData.map((d) => d.entradas)))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Maior saida</span><span className="font-medium text-red-400">{formatCompact(Math.max(0, ...diasData.map((d) => d.saidas)))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dias positivos</span><span className="font-medium">{kpis.diasPositivos}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dias negativos</span><span className="font-medium">{kpis.totalDias - kpis.diasPositivos}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Saldo por Dia</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Exportar</Button>
          </CardHeader>
          <CardContent>
            <DataTable data={diasData} columns={columns as ColumnDef<DiaData, unknown>[]} searchPlaceholder="Buscar data..." />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
