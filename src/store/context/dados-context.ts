import { createContext, useContext, type Dispatch } from 'react'
import type { Dados } from '../model/dados'
import type { Acao } from '../reducer/dados-reducer'

export interface ContextoDados {
  dados: Dados
  dispatch: Dispatch<Acao>
  /** Os dados foram convertidos de um formato antigo nesta abertura (aviso único, com o caminho da cópia). */
  migracao: { de: number; backup: string } | null
  dispensarMigracao: () => void
  /** Resolve quando uma gravação no disco já contém o que a condição pede (ex.: uma sessão pelo id). */
  quandoGravado: (condicao: (dados: Dados) => boolean) => Promise<void>
}

export const DadosContext = createContext<ContextoDados | null>(null)

export function useDados(): ContextoDados {
  const contexto = useContext(DadosContext)
  if (!contexto) throw new Error('useDados precisa estar dentro do DadosProvider')
  return contexto
}
