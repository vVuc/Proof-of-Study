import { invoke } from '@tauri-apps/api/core'

/**
 * A IA pelo Rust (`src-tauri/src/ia.rs`): a chave fica no cofre do sistema e nunca chega ao front. O front manda o
 * pedido montado e valida o texto JSON que volta.
 */

export type TipoErroIA = 'Desligada' | 'SemChave' | 'Chave' | 'Cota' | 'Conexao' | 'Tempo' | 'Indisponivel' | 'Resposta' | 'Cofre'

/** O erro como o Rust manda (`ErroIA`, com a tag `tipo`). */
export type ErroIA = { tipo: Exclude<TipoErroIA, 'Cofre'> } | { tipo: 'Cofre'; detalhe: string }

export interface PedidoIA {
  tipo: 'dia' | 'semana' | 'plano'
  /** Instrução do sistema. */
  sistema: string
  entrada: string
  /** JSON Schema da resposta. */
  esquema: Record<string, unknown>
}

export interface RespostaIA {
  /** O JSON da resposta, ainda sem validar. */
  texto: string
  modelo: string
  tokens: number | null
}

export interface EstadoChave {
  salva: boolean
  /** Os 4 últimos caracteres. */
  final: string | null
  /** `arquivo`: sem cofre do sistema, a chave ficou num arquivo da pasta do app. */
  cofre: 'sistema' | 'arquivo' | null
}

/** Avisa o Rust se a IA está ligada; desligada, ele recusa qualquer chamada. */
export const configurarIA = (ligada: boolean) => invoke<void>('ia_configurar', { ligada })
export const lerEstadoDaChave = () => invoke<EstadoChave>('ia_chave_estado')
/** Testa a chave com o Gemini e só guarda se ele aceitar. */
export const salvarChave = (chave: string) => invoke<EstadoChave>('ia_chave_salvar', { chave })
export const removerChave = () => invoke<void>('ia_chave_remover')
export const gerarComIA = (pedido: PedidoIA) => invoke<RespostaIA>('ia_gerar', { pedido })
