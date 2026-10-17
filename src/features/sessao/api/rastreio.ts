import { invoke } from '@tauri-apps/api/core'
import type { Pausa, Trecho } from '@/store/model/dados'

/** Comandos da sessão do dia e do registro de janelas (`src-tauri/src/rastreador.rs` e `lembretes.rs`). */

/** `ausente`: pausa automática por ausência longa; a captura volta sozinha quando a pessoa volta. */
export type Fase = 'parado' | 'rodando' | 'pausado' | 'ausente'

export interface Janela {
  titulo: string
  processo: string
  proprio: boolean
}

/** Sessão fechada pelo Rust, esperando ser gravada no `dados.json`. */
export interface SessaoDoRust {
  id: string
  dia: string
  inicio: number
  fim: number
  trechos: Trecho[]
  pausas: Pausa[]
}

export interface Retrato {
  fase: Fase
  /** Leitura da janela ligada (a pessoa pode pausar só a captura). */
  captura: boolean
  sessao: { id: string; dia: string; inicio: number } | null
  /** Tempo registrado na sessão, sem as pausas. */
  decorridoMs: number
  /** Pausas da sessão, com a que está em andamento. */
  pausas: Pausa[]
  /** Os trechos a partir deste índice substituem os que a tela já tinha. */
  base: number
  trechos: Trecho[]
  /** Janela ativa agora; vazia sem a sessão rodando ou sem captura. */
  atual: Janela
  msSemUso: number
  fechadas: SessaoDoRust[]
  /** A sessão voltou depois de o app ter fechado (aviso único). */
  recuperacao: { desligadoMs: number; fase: Fase } | null
  /** O Rust já recebeu as regras e as preferências. */
  configurado: boolean
}

export interface ConfiguracaoRastreio {
  limiteAusenciaSeg: number
  ausenciaLongaSeg: number
  avisoDistracaoSeg: number | null
  cicloSeg: number | null
  regras: { rotulo: string; termos: string[]; campo: 'app' | 'titulo'; tipo: 'estudo' | 'trabalho' | 'fora' | 'ignorar' }[]
  /** Termos das matérias e dos objetivos do dia, já normalizados. */
  termos: string[]
  inicioDoDiaMin: number
}

export const configurarRastreio = (config: ConfiguracaoRastreio) => invoke<void>('sessao_configurar', { config })
export const playDoDia = () => invoke<boolean>('sessao_play')
export const pausarDoDia = () => invoke<void>('sessao_pausar')
export const definirCaptura = (ligada: boolean) => invoke<void>('sessao_captura', { ligada })
export const fecharDoDia = () => invoke<void>('sessao_fechar')
export const confirmarSessao = (id: string) => invoke<void>('sessao_confirmar', { id })
export const marcarRecuperacaoVista = () => invoke<void>('sessao_recuperacao_vista')
export const lerRastreio = (desde: number) => invoke<Retrato>('sessao_estado', { desde })

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

export const definirAtalho = (teclas: string | null) => invoke<void>('atalho_definir', { teclas })

export const exportarDiagnostico = () => invoke<string>('diagnostico_exportar')
