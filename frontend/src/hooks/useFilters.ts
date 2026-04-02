import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FilterState {
  empresa: string
  obra: string
  dtInicio: string
  dtFim: string
  bancos: string[]
  contas: string[]
  // AP-specific
  origem: string
  // Receitas-specific
  status: string
  // Fluxo-specific
  vis: string

  setFilter: (key: string, value: string | string[]) => void
  setBancos: (bancos: string[]) => void
  setContas: (contas: string[]) => void
  resetFilters: () => void
}

const currentYear = new Date().getFullYear()

const defaultState = {
  empresa: '',
  obra: '',
  dtInicio: `${currentYear}-01-01`,
  dtFim: `${currentYear}-12-31`,
  bancos: [] as string[],
  contas: [] as string[],
  origem: '',
  status: '',
  vis: 'todos',
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      ...defaultState,

      setFilter: (key, value) =>
        set((state) => {
          const newState: Record<string, unknown> = { [key]: value }
          // Cascata: limpar dependentes
          if (key === 'empresa') {
            newState.obra = ''
            newState.bancos = []
            newState.contas = []
          }
          return { ...state, ...newState }
        }),

      setBancos: (bancos) => set({ bancos, contas: [] }),
      setContas: (contas) => set({ contas }),

      resetFilters: () => set(defaultState),
    }),
    { name: 'dashfinance-filters' }
  )
)
