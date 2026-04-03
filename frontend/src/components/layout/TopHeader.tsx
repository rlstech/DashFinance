import { NavLink } from 'react-router-dom'
import { Receipt, Wallet, TrendingUp, Settings, LayoutDashboard, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSync, useStatus } from '@/hooks/useFinanceiro'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/ap', icon: Wallet, label: 'Contas a Pagar' },
  { to: '/receitas', icon: Receipt, label: 'Receitas' },
  { to: '/fluxo', icon: TrendingUp, label: 'Fluxo de Caixa' },
  { to: '/config', icon: Settings, label: 'Configurações' },
]

export function TopHeader() {
  const { data: status } = useStatus()
  const sync = useSync()

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-card">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg hidden sm:inline-block">DashFinance</span>
        </div>
        
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {status?.last_sync && (
          <span className="text-xs text-muted-foreground hidden lg:inline-block">
            Atualizado {status.last_sync}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', sync.isPending && 'animate-spin')} />
          Sincronizar
        </Button>
      </div>
    </header>
  )
}
