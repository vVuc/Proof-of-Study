import { invoke } from '@tauri-apps/api/core'
import type { ModeloVoz } from '@/store/model/dados'

/** Voz transcrita no PC (`src-tauri/src/voz.rs`): gravação do microfone e Whisper local. */

export interface EstadoVoz {
  /** O app foi compilado com a voz. Sem ela, o relato é só texto. */
  disponivel: boolean
  modelo: 'ausente' | 'baixando' | 'pronto'
  /** De 0 a 1, no download do modelo. */
  progresso: number
  gravando: boolean
  transcrevendo: boolean
  /** Último erro (microfone negado, download falhou…), para mostrar com a alternativa do texto. */
  erro: string | null
}

export interface InfoModelo {
  nome: ModeloVoz
  /** Tamanho do download, em MB. */
  mb: number
  origem: string
}

const SEM_VOZ: EstadoVoz = { disponivel: false, modelo: 'ausente', progresso: 0, gravando: false, transcrevendo: false, erro: null }

/** Estado da voz; num app sem voz (ou fora do Tauri), devolve "indisponível" em vez de falhar. */
export const lerVoz = (modelo: ModeloVoz) => invoke<EstadoVoz>('voz_estado', { modelo }).catch(() => SEM_VOZ)
export const infoDoModelo = (modelo: ModeloVoz) => invoke<InfoModelo>('voz_modelo_info', { modelo })
export const baixarModelo = (modelo: ModeloVoz) => invoke<void>('voz_modelo_baixar', { modelo })
export const gravarVoz = () => invoke<void>('voz_gravar')
/** Para a gravação e devolve o texto transcrito (leva alguns segundos). O áudio é apagado. */
export const pararVoz = (modelo: ModeloVoz) => invoke<string>('voz_parar', { modelo })
export const cancelarVoz = () => invoke<void>('voz_cancelar')
