import { useFilterStore } from '@/hooks/useFilters'
import { useFilterTree } from '@/hooks/useFinanceiro'
import { MultiSelect } from './MultiSelect'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

interface FilterBarProps {
  showOrigem?: boolean
  showStatus?: boolean
  showVis?: boolean
}

export function FilterBar({ showOrigem, showStatus, showVis }: FilterBarProps) {
  const filters = useFilterStore()
  const { data: tree } = useFilterTree()

  const empresas = tree?.empresas ?? []
  const obras = filters.empresa ? (tree?.obras_por_empresa?.[filters.empresa] ?? []) : []
  const bancos = filters.empresa ? (tree?.bancos_por_empresa?.[filters.empresa] ?? []) : []
  const contas = filters.empresa ? (tree?.contas_por_empresa?.[filters.empresa] ?? []) : []

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-card rounded-lg border">
      {/* Empresa */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Empresa</span>
        <select
          className="h-9 px-3 rounded-md border bg-background text-sm min-w-[150px]"
          value={filters.empresa}
          onChange={(e) => filters.setFilter('empresa', e.target.value)}
        >
          <option value="">Todas</option>
          {empresas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Periodo */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Periodo</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="h-9 px-3 rounded-md border bg-background text-sm"
            value={filters.dtInicio}
            onChange={(e) => filters.setFilter('dtInicio', e.target.value)}
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="date"
            className="h-9 px-3 rounded-md border bg-background text-sm"
            value={filters.dtFim}
            onChange={(e) => filters.setFilter('dtFim', e.target.value)}
          />
        </div>
      </div>

      {/* Obra */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Obra</span>
        <select
          className="h-9 px-3 rounded-md border bg-background text-sm min-w-[120px]"
          value={filters.obra}
          onChange={(e) => filters.setFilter('obra', e.target.value)}
        >
          <option value="">Todas</option>
          {obras.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {/* Origem (AP) */}
      {showOrigem && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Origem</span>
          <select
            className="h-9 px-3 rounded-md border bg-background text-sm"
            value={filters.origem}
            onChange={(e) => filters.setFilter('origem', e.target.value)}
          >
            <option value="">Todas</option>
            <option value="Emissao">Emissao</option>
            <option value="A Confirmar">A Confirmar</option>
            <option value="Pago">Pago</option>
          </select>
        </div>
      )}

      {/* Status (Receitas) */}
      {showStatus && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
          <select
            className="h-9 px-3 rounded-md border bg-background text-sm"
            value={filters.status}
            onChange={(e) => filters.setFilter('status', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="A Receber">A Receber</option>
            <option value="Recebida">Recebida</option>
          </select>
        </div>
      )}

      {/* Visibilidade (Fluxo) */}
      {showVis && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Visualizacao</span>
          <select
            className="h-9 px-3 rounded-md border bg-background text-sm"
            value={filters.vis}
            onChange={(e) => filters.setFilter('vis', e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="realizado">Realizado</option>
            <option value="projetado">Projetado</option>
          </select>
        </div>
      )}

      {/* Banco multi-select */}
      <MultiSelect
        label="Banco"
        options={bancos}
        selected={filters.bancos}
        onChange={filters.setBancos}
        allLabel="Todos"
      />

      {/* Conta multi-select */}
      <MultiSelect
        label="Conta"
        options={contas}
        selected={filters.contas}
        onChange={filters.setContas}
        allLabel="Todas"
      />

      {/* Reset */}
      <Button variant="ghost" size="icon" onClick={filters.resetFilters} title="Limpar filtros">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  )
}
