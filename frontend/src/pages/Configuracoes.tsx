import { useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useStatus, useFilterTree } from '@/hooks/useFinanceiro'
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig'
import { EMPRESA_COLORS } from '@/types'
import { formatCurrency } from '@/lib/formatters'

const EMPRESAS = Object.keys(EMPRESA_COLORS)

function parseBRLInput(raw: string): number {
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
      <div className="p-8 overflow-auto w-full">
        <div className="max-w-4xl mx-auto space-y-8">

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black uppercase tracking-tight">Configurações</h1>
          </div>

          {/* Status do Sistema */}
          <div className="bg-white block-border shadow-hard p-8">
            <div className="absolute top-0 left-0" />
            <h2 className="text-sm font-black uppercase tracking-widest mb-6">Status do Sistema</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-grid pb-3">
                <span className="font-bold uppercase text-xs text-muted-foreground">Última sincronização</span>
                <span className="font-black">{status?.last_sync ?? '-'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-grid pb-3">
                <span className="font-bold uppercase text-xs text-muted-foreground">Período dos dados</span>
                <span className="font-black">{status?.de ?? '-'} a {status?.ate ?? '-'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-grid pb-3">
                <span className="font-bold uppercase text-xs text-muted-foreground">Registros AP</span>
                <span className="font-black">{status?.count_ap ?? 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-grid pb-3">
                <span className="font-bold uppercase text-xs text-muted-foreground">Registros Receitas</span>
                <span className="font-black">{status?.count_receitas ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-xs text-muted-foreground">Registros Saldo</span>
                <span className="font-black">{status?.count_saldo ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Saldo Bancário Manual */}
          <div className="bg-white block-border shadow-hard p-8">
            <h2 className="text-sm font-black uppercase tracking-widest mb-2">Saldo Bancário Manual</h2>
            <p className="text-xs text-muted-foreground font-medium mb-6">
              Quando ativado por empresa, o saldo informado substitui o do banco de dados no card
              <strong className="text-dark"> Fluxo de Caixa por Dia</strong>.
            </p>
            <div className="space-y-6">
              {EMPRESAS.map((empresa) => {
                const cfg = configs[empresa]
                const enabled = cfg?.enabled ?? false
                const contasPorBanco = filterTree?.contas_por_empresa_banco?.[empresa] ?? {}
                const bancoCombos = Object.entries(contasPorBanco).flatMap(([banco, contas]) =>
                  (contas as string[]).map((conta) => ({ banco, conta, key: `${banco}|${conta}` }))
                )

                return (
                  <div key={empresa} className="space-y-3 border-b border-grid pb-6 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 border border-dark"
                          style={{ backgroundColor: EMPRESA_COLORS[empresa] }}
                        />
                        <span className="text-sm font-black uppercase">{empresa}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          {enabled ? 'Saldo manual ativo' : 'Usando banco de dados'}
                        </span>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => setEnabled(empresa, v)}
                        />
                      </div>
                    </div>

                    {enabled && (
                      <div className="ml-5 block-border overflow-hidden">
                        {treeLoading ? (
                          <div className="p-3 space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </div>
                        ) : bancoCombos.length === 0 ? (
                          <p className="text-xs text-muted-foreground font-bold uppercase p-3">
                            Nenhuma conta disponível para esta empresa.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b-2 border-dark bg-bgBase">
                                <th className="text-left px-3 py-2 font-black uppercase text-dark">Banco</th>
                                <th className="text-left px-3 py-2 font-black uppercase text-dark">Conta</th>
                                <th className="text-right px-3 py-2 font-black uppercase text-dark">Saldo (R$)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bancoCombos.map(({ banco, conta, key }) => {
                                const currentSaldo = cfg?.saldos?.[key] ?? 0
                                return (
                                  <tr key={key} className="border-b border-grid last:border-0">
                                    <td className="px-3 py-2 text-muted-foreground font-medium">{banco}</td>
                                    <td className="px-3 py-2 font-medium">{conta}</td>
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
                                        className="w-full text-right bg-white border-2 border-dark px-2 py-1 text-xs font-bold focus:outline-none focus:border-brand tabular-nums"
                                      />
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-bgBase border-t-2 border-dark">
                                <td colSpan={2} className="px-3 py-2 font-black uppercase text-xs">Total</td>
                                <td className="px-3 py-2 text-right font-black tabular-nums">
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
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sobre */}
          <div className="bg-white block-border shadow-hard p-8">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4">Sobre</h2>
            <p className="text-sm text-muted-foreground font-medium">DashFinance v2.0 — Dashboard financeiro Premium</p>
            <p className="text-sm text-muted-foreground font-medium mt-1">FastAPI + React + TypeScript</p>
          </div>

        </div>
      </div>
    </div>
  )
}
