import { createContext, useContext } from 'react'
import type { DataISO } from '@/shared/lib/datas'
import type { Pausa, Trecho } from '@/store/model/dados'
import type { Fase, Retrato } from '../api/rastreio'

export interface ContextoSessao {
  /** `null` até a primeira leitura do Rust. */
  fase: Fase | null
  retrato: Retrato | null
  /** A sessão do dia aberta no Rust (rodando, pausada ou em pausa automática). */
  sessao: Retrato['sessao']
  /** Trechos da sessão aberta. */
  trechos: Trecho[]
  /** Pausas da sessão aberta, com a que está em andamento. */
  pausas: Pausa[]
  /** O dia lógico de agora. */
  hoje: DataISO
  /** Play no dia: abre a sessão ou retoma a pausada. */
  play: () => Promise<void>
  pausar: () => Promise<void>
  alternarCaptura: () => Promise<void>
  /** Fecha a sessão do dia (ao salvar o relato final). */
  fecharDia: () => Promise<void>
  dispensarRecuperacao: () => Promise<void>
}

export const SessaoContext = createContext<ContextoSessao | null>(null)

export function useSessao(): ContextoSessao {
  const contexto = useContext(SessaoContext)
  if (!contexto) throw new Error('useSessao precisa estar dentro do SessaoProvider')
  return contexto
}
