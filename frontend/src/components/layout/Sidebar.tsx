import { NavLink } from 'react-router-dom'
import { Receipt, Wallet, TrendingUp, Settings, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/ap', icon: Wallet, label: 'Contas a Pagar' },
  { to: '/receitas', icon: Receipt, label: 'Receitas' },
  { to: '/fluxo', icon: TrendingUp, label: 'Fluxo de Caixa' },
  { to: '/config', icon: Settings, label: 'Configuracoes' },
]

export function Sidebar() {
  return (
    <aside className="w-[240px] min-h-screen bg-card border-r flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">DashFinance</span>
        </div>
        <span className="text-xs text-muted-foreground">v2.0</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
