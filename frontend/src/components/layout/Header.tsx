import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSync, useStatus } from '@/hooks/useFinanceiro'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const { data: status } = useStatus()
  const sync = useSync()

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        {status?.last_sync && (
          <span className="text-xs text-muted-foreground">
            Atualizado {status.last_sync}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
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

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
