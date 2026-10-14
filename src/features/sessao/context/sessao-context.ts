import { createContext, useContext } from 'react'
import type { SessaoAtual, Trecho } from '@/store/model/dados'
import type { Retrato } from '../api/rastreio'

/**
 * Em que ponto o cronômetro está:
 * - `pronto`: nenhum objetivo rodando;
 * - `rodando`: o relógio andando num objetivo (ou na sessão do dia, sem matéria);
 * - `ocioso`: parado por inatividade; volta sozinho quando a pessoa mexe no PC, no mesmo dia.
 */
export type Etapa = 'pronto' | 'rodando' | 'ocioso'

export interface ContextoSessao {
  /** `null` até a primeira leitura do Rust. */
  etapa: Etapa | null
  retrato: Retrato | null
  sessao: SessaoAtual | null
  /** Trechos do cronômetro em andamento. */
  trechos: Trecho[]
  /** Relógio de um objetivo hoje: o já registrado mais o que está rodando. `SEM_MATERIA` é a sessão do dia. */
  tempoHoje: (materiaId: string) => number
  /** Play: começa (ou continua) a contar no objetivo; se outro estiver rodando, ele é pausado antes. */
  tocar: (materiaId: string) => Promise<void>
  /** Pause: guarda o que foi registrado; o próximo play continua do mesmo tempo. */
  pausar: () => Promise<void>
  alternarCaptura: () => Promise<void>
}

export const SessaoContext = createContext<ContextoSessao | null>(null)

export function useSessao(): ContextoSessao {
  const contexto = useContext(SessaoContext)
  if (!contexto) throw new Error('useSessao precisa estar dentro do SessaoProvider')
  return contexto
}
