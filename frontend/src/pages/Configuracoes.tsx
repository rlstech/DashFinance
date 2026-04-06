import { useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useStatus } from '@/hooks/useFinanceiro'

export default function Configuracoes() {
  useEffect(() => { document.title = 'Configurações | DashFinance' }, [])
  const { data: status } = useStatus()

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
