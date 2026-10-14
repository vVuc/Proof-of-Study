import { invoke } from '@tauri-apps/api/core'
import type { Trecho } from '@/store/model/dados'

/** Comandos do cronômetro e do registro de janelas (`src-tauri/src/rastreador.rs` e `lembretes.rs`). */

/** `ocioso`: parado por inatividade, volta sozinho; `concluido`: o dia virou e o trecho espera ser guardado. */
export type Fase = 'parado' | 'rodando' | 'ocioso' | 'concluido'

export interface Janela {
  titulo: string
  processo: string
  proprio: boolean
}

export interface Retrato {
  fase: Fase
  /** Leitura da janela ligada (a pessoa pode pausar só a captura). */
  captura: boolean
  decorridoMs: number
  /** Janela ativa agora; vazia fora do cronômetro rodando ou sem captura. */
  atual: Janela
  msSemUso: number
  trechos: Trecho[]
}

export interface ConfiguracaoRastreio {
  limiteAusenciaSeg: number
  avisoDistracaoSeg: number | null
  regras: { rotulo: string; termos: string[]; campo: 'app' | 'titulo'; tipo: 'estudo' | 'fora' | 'ignorar' }[]
  materia: string
}

export const iniciarRastreio = (config: ConfiguracaoRastreio) => invoke<void>('rastreio_iniciar', { config })
export const definirCaptura = (ligada: boolean) => invoke<void>('rastreio_captura', { ligada })
export const pararRastreio = () => invoke<Trecho[]>('rastreio_parar')
export const lerRastreio = () => invoke<Retrato>('rastreio_estado')

export interface LembreteRotina {
  id: string
  dias: number[]
  minuto: number
  titulo: string
  corpo: string
}

export const definirLembretes = (lista: LembreteRotina[]) => invoke<void>('lembretes_definir', { lista })
export const agendarAviso = (id: string, em: number, titulo: string, corpo: string) =>
  invoke<void>('aviso_agendar', { id, em, titulo, corpo })
export const cancelarAviso = (id: string) => invoke<void>('aviso_cancelar', { id })
