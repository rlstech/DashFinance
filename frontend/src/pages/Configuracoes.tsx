import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useStatus } from '@/hooks/useFinanceiro'

export default function Configuracoes() {
  const { data: status } = useStatus()

  return (
    <div className="flex flex-col h-full">
      <Header title="Configuracoes" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Status do Sistema</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ultima sincronizacao</span>
              <span>{status?.last_sync ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Periodo dos dados</span>
              <span>{status?.de ?? '-'} a {status?.ate ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros AP</span>
              <span>{status?.count_ap ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros Receitas</span>
              <span>{status?.count_receitas ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registros Saldo</span>
              <span>{status?.count_saldo ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sobre</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>DashFinance v2.0 - Dashboard financeiro UAU</p>
            <p className="mt-1">FastAPI + React + TypeScript</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
