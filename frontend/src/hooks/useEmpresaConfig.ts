import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// chave: "banco|conta" → saldo manual em BRL
type SaldosContas = Record<string, number>

interface EmpresaConfig {
  enabled: boolean
  saldos: SaldosContas
}

interface EmpresaConfigStore {
  configs: Record<string, EmpresaConfig>
  setEnabled: (empresa: string, enabled: boolean) => void
  setSaldo: (empresa: string, bancoConta: string, saldo: number) => void
}

export const useEmpresaConfig = create<EmpresaConfigStore>()(
  persist(
    (set) => ({
      configs: {},

      setEnabled: (empresa, enabled) =>
        set((s) => ({
          configs: {
            ...s.configs,
            [empresa]: { enabled, saldos: s.configs[empresa]?.saldos ?? {} },
          },
        })),

      setSaldo: (empresa, bancoConta, saldo) =>
        set((s) => ({
          configs: {
            ...s.configs,
            [empresa]: {
              enabled: s.configs[empresa]?.enabled ?? false,
              saldos: { ...s.configs[empresa]?.saldos, [bancoConta]: saldo },
            },
          },
        })),
    }),
    { name: 'dashfinance-empresa-config-v1' }
  )
)
