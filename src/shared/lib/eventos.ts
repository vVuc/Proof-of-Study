import { invoke } from '@tauri-apps/api/core'

/** Evento no log do app (`src-tauri/src/diagnostico.rs`). Nunca com títulos de janela, relatos ou anotações. */
export function registrarEvento(evento: string, contexto: Record<string, unknown> = {}, nivel: 'info' | 'aviso' | 'erro' = 'info') {
  void invoke('registrar_evento', { nivel, evento, contexto }).catch(() => undefined)
}
