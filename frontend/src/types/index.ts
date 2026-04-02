export interface APRecord {
  empresa: string
  obra: string
  data: string
  fornecedor: string
  banco: string
  conta: string
  categoria: string
  valor: number
  origem: string
}

export interface ReceitaRecord {
  empresa: string
  obra: string
  cliente: string
  tipo: string
  data: string
  data_venc: string
  valor: number
  status: string
  banco: string
  conta: string
}

export interface SaldoRecord {
  empresa: string
  banco: string
  conta: string
  data: string
  saldo: number
}

export interface SyncResponse {
  ok: boolean
  errors: string[]
  last_sync: string | null
  count_ap: number
  count_receitas: number
  count_saldo: number
}

export interface StatusResponse {
  last_sync: string | null
  de: string | null
  ate: string | null
  count_ap: number
  count_receitas: number
  count_saldo: number
}

export interface FilterTree {
  empresas: string[]
  obras_por_empresa: Record<string, string[]>
  bancos_por_empresa: Record<string, string[]>
  contas_por_empresa: Record<string, string[]>
}

export const EMPRESA_COLORS: Record<string, string> = {
  COMBRASEN: '#2D6A4F',
  DRESDEN: '#1565C0',
  TRUST: '#E65100',
  'GAMA 01': '#4A148C',
  'CONSÓRCIO HMSJ': '#00838F',
}

export const EMPRESA_ABBR: Record<string, string> = {
  COMBRASEN: 'CMB',
  DRESDEN: 'DRE',
  TRUST: 'TRS',
  'GAMA 01': 'GAM',
  'CONSÓRCIO HMSJ': 'HMJ',
}

export const TIPO_LABEL: Record<string, string> = {
  M: 'Mensal',
  P: 'Entrada',
  I: 'Intermediária',
  F: 'Financiamento',
  S: 'Sinal',
  R: 'Reforço',
  C: 'Chaves',
}
