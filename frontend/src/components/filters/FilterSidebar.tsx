import { useFilterStore } from '@/hooks/useFilters'
import { useFilterTree } from '@/hooks/useFinanceiro'
import { MultiSelect } from './MultiSelect'
import { DateRangeSelector } from './DateRangeSelector'
import { Button } from '@/components/ui/button'
import { RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterSidebarProps {
  showOrigem?: boolean
  showStatus?: boolean
  showVis?: boolean
}

export function FilterSidebar({ showOrigem, showStatus, showVis }: FilterSidebarProps) {
  const filters = useFilterStore()
  const sidebarOpen = useFilterStore((s) => s.sidebarOpen)
  const toggleSidebar = useFilterStore((s) => s.toggleSidebar)
  const { data: tree } = useFilterTree()

  const empresas = tree?.empresas ?? []
  
  // Calculate dependent options based on selected companies
  const obras = filters.empresas.length > 0 
    ? filters.empresas.flatMap(emp => tree?.obras_por_empresa?.[emp] ?? [])
    : tree?.empresas.flatMap(emp => tree?.obras_por_empresa?.[emp] ?? []) ?? []
    
  const bancos = filters.empresas.length > 0 
    ? filters.empresas.flatMap(emp => tree?.bancos_por_empresa?.[emp] ?? [])
    : tree?.empresas.flatMap(emp => tree?.bancos_por_empresa?.[emp] ?? []) ?? []
    
  // Contas dependem de empresas e (se selecionados) bancos.
  const empresasParaContas = filters.empresas.length > 0 ? filters.empresas : (tree?.empresas ?? [])
  const contas = empresasParaContas.flatMap(emp => {
    if (filters.bancos.length > 0 && tree?.contas_por_empresa_banco?.[emp]) {
      return filters.bancos.flatMap(b => tree.contas_por_empresa_banco?.[emp]?.[b] ?? [])
    }
    return tree?.contas_por_empresa?.[emp] ?? []
  })

  // Ensure unique values for merged arrays
  const uniqueObras = [...new Set(obras)].sort()
  const uniqueBancos = [...new Set(bancos)].sort()
  const uniqueContas = [...new Set(contas)].sort()

  const origens = ['Emissao', 'A Confirmar', 'Pago']
  const statusList = ['A Receber', 'Recebida']
  const visList = ['realizado', 'projetado']

  const sidebarContent = (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Filtros</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={filters.resetFilters} title="Limpar todos os filtros">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} title="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col">
        <DateRangeSelector
          startDate={filters.dtInicio}
          endDate={filters.dtFim}
          onStartDateChange={(val) => filters.setFilter('dtInicio', val)}
          onEndDateChange={(val) => filters.setFilter('dtFim', val)}
        />
        <MultiSelect label="Empresas" options={empresas} selected={filters.empresas} onChange={filters.setEmpresas} allLabel="Todas as Empresas" />
        <MultiSelect label="Obras" options={uniqueObras} selected={filters.obras} onChange={filters.setObras} allLabel="Todas as Obras" />
        {showOrigem && <MultiSelect label="Origem" options={origens} selected={filters.origens} onChange={filters.setOrigens} allLabel="Todas as Origens" />}
        {showStatus && <MultiSelect label="Status" options={statusList} selected={filters.status_list} onChange={filters.setStatusList} allLabel="Todos os Status" />}
        {showVis && <MultiSelect label="Visualização" options={visList} selected={filters.vis} onChange={filters.setVis} allLabel="Todos (Realizado + Projetado)" />}
        <MultiSelect label="Bancos" options={uniqueBancos} selected={filters.bancos} onChange={filters.setBancos} allLabel="Todos os Bancos" />
        <MultiSelect label="Contas" options={uniqueContas} selected={filters.contas} onChange={filters.setContas} allLabel="Todas as Contas" />
      </div>
    </>
  )

  return (
    <>
      {/* Backdrop overlay on mobile/tablet when open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-card border-r transition-transform duration-300 ease-in-out',
          // Desktop: always visible, fixed width
          'lg:relative lg:translate-x-0 lg:w-[280px] lg:min-w-[280px] lg:h-full',
          // Mobile/tablet: overlay drawer
          'fixed inset-y-0 left-0 z-50 w-[280px] h-full lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
