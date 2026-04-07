import { NavLink } from 'react-router-dom'
import { Receipt, Wallet, TrendingUp, Settings, LayoutDashboard, RefreshCw, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSync, useStatus } from '@/hooks/useFinanceiro'
import { useFilterStore } from '@/hooks/useFilters'
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
  const toggleSidebar = useFilterStore((s) => s.toggleSidebar)

  return (
    <header className="flex items-center border-b bg-card h-14 w-full">
      {/* Logo Area */}
      <div className="flex items-center lg:w-[280px] lg:min-w-[280px] pl-3 lg:pl-6 pr-4 lg:border-r h-full gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <LayoutDashboard className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg hidden sm:inline-block">DashFinance</span>
      </div>

      {/* Main Header Area */}
      <div className="flex-1 flex items-center justify-between px-2 sm:px-6 h-full">
        <nav className="flex items-center gap-0.5 sm:gap-1.5 h-full">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          {status?.last_sync && (
            <span className="text-xs text-muted-foreground hidden lg:inline-block">
              Atualizado {status.last_sync}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg shadow-sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <RefreshCw className={cn('h-4 w-4 sm:mr-2', sync.isPending && 'animate-spin')} />
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
