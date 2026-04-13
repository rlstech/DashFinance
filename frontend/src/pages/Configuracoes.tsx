import { useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useStatus, useFilterTree } from '@/hooks/useFinanceiro'
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig'
import { EMPRESA_COLORS } from '@/types'
import { formatCurrency } from '@/lib/formatters'

const EMPRESAS = Object.keys(EMPRESA_COLORS)

function parseBRLInput(raw: string): number {
  // aceita "1.234,56" ou "1234.56" ou "1234,56"
  const cleaned = raw.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export default function Configuracoes() {
  useEffect(() => { document.title = 'Configurações | DashFinance' }, [])
  const { data: status } = useStatus()
  const { data: filterTree, isLoading: treeLoading } = useFilterTree()
  const { configs, setEnabled, setSaldo } = useEmpresaConfig()

  return (
    <div className="flex h-full">
      <div className="p-6 space-y-6 overflow-auto w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-sm font-medium">Status do Sistema</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última sincronização</span>
              <span className="font-medium">{status?.last_sync ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período dos dados</span>
              <span className="font-medium">{status?.de ?? '-'} a {status?.ate ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros AP</span>
              <span className="font-medium">{status?.count_ap ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros Receitas</span>
              <span className="font-medium">{status?.count_receitas ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros Saldo</span>
              <span className="font-medium">{status?.count_saldo ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Bancário Manual */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saldo Bancário Manual</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ativado por empresa, o saldo informado substitui o do banco de dados no card
              <strong> Fluxo de Caixa por Dia</strong>.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {EMPRESAS.map((empresa) => {
              const cfg = configs[empresa]
              const enabled = cfg?.enabled ?? false
              const contasPorBanco = filterTree?.contas_por_empresa_banco?.[empresa] ?? {}
              const bancoCombos = Object.entries(contasPorBanco).flatMap(([banco, contas]) =>
                (contas as string[]).map((conta) => ({ banco, conta, key: `${banco}|${conta}` }))
              )

              return (
                <div key={empresa} className="space-y-3">
                  {/* Cabeçalho da empresa */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: EMPRESA_COLORS[empresa] }}
                      />
                      <span className="text-sm font-medium">{empresa}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {enabled ? 'Saldo manual ativo' : 'Usando banco de dados'}
                      </span>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => setEnabled(empresa, v)}
                      />
                    </div>
                  </div>

                  {/* Contas quando ativado */}
                  {enabled && (
                    <div className="ml-4 border border-border rounded-lg overflow-hidden">
                      {treeLoading ? (
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : bancoCombos.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3">
                          Nenhuma conta disponível para esta empresa.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/40">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Banco</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Conta</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Saldo (R$)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bancoCombos.map(({ banco, conta, key }) => {
                              const currentSaldo = cfg?.saldos?.[key] ?? 0
                              return (
                                <tr key={key} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-2 text-muted-foreground">{banco}</td>
                                  <td className="px-3 py-2">{conta}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      defaultValue={currentSaldo !== 0 ? currentSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                      placeholder="0,00"
                                      onBlur={(e) => {
                                        const val = parseBRLInput(e.target.value)
                                        setSaldo(empresa, key, val)
                                        e.target.value = val !== 0 ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
                                      }}
                                      className="w-full text-right bg-transparent border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/20">
                              <td colSpan={2} className="px-3 py-2 font-medium text-muted-foreground">Total</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {formatCurrency(
                                  bancoCombos.reduce((s, { key }) => s + (cfg?.saldos?.[key] ?? 0), 0)
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Separador entre empresas */}
                  <div className="border-b border-border/40" />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-sm font-medium">Sobre</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>DashFinance v2.0 - Dashboard financeiro Premium</p>
            <p className="mt-1">FastAPI + React + TypeScript</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
