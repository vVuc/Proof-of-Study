import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Voz ao vivo pelo Gemini (`src-tauri/src/voz.rs`): o Rust grava o microfone, manda o áudio e devolve o texto pelos
 * eventos. A chave e o áudio nunca passam pelo front.
 */

/** O erro como o Rust manda (`ErroIA`, com a tag `tipo`), incluindo `Microfone`. */
export interface ErroVoz {
  tipo: string
}

/** Começa a gravação com o vocabulário do dia (até 100 termos). */
export const iniciarVoz = (vocabulario: string[]) => invoke<void>('voz_iniciar', { vocabulario })
/** Para a gravação e devolve o texto final (o Rust espera o último trecho por até 5 s). */
export const pararVoz = () => invoke<string>('voz_parar')
/** Fecha a gravação sem devolver nada. */
export const cancelarVoz = () => invoke<void>('voz_cancelar')

/** O texto da fala até agora: os trechos finais e o parcial em curso. */
export const ouvirParcial = (aoReceber: (texto: string) => void) =>
  listen<{ texto: string }>('voz:parcial', (e) => aoReceber(e.payload.texto))
/** A conexão caiu no meio da fala; o texto até ali continua valendo. */
export const ouvirErro = (aoReceber: (erro: ErroVoz) => void) => listen<ErroVoz>('voz:erro', (e) => aoReceber(e.payload))
/** A gravação acabou sozinha (10 minutos), com o texto final. */
export const ouvirFim = (aoReceber: (texto: string) => void) => listen<{ texto: string }>('voz:fim', (e) => aoReceber(e.payload.texto))
