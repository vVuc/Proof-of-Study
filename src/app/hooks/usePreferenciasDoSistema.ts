import { useEffect, useRef } from 'react'
import { enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { registrarEvento } from '@/shared/lib/eventos'
import { useDados } from '@/store/context/dados-context'
import { definirAtalho } from '@/features/sessao/api/rastreio'

/**
 * Ao abrir o app, registra o atalho global salvo e confere o início com o sistema (uma reinstalação pode ter
 * desligado). Depois disso, quem muda os dois é a tela de opções.
 */
export function usePreferenciasDoSistema() {
  const { dados } = useDados()
  const { atalho, iniciarComSistema } = dados.preferencias
  const feito = useRef(false)

  useEffect(() => {
    if (feito.current) return
    feito.current = true
    if (atalho) void definirAtalho(atalho).catch((e) => registrarEvento('atalho.nao_registrado', { erro: String(e) }, 'aviso'))
    if (iniciarComSistema)
      void isEnabled()
        .then((ligado) => (ligado ? undefined : enable()))
        .catch((e) => registrarEvento('autostart.erro', { erro: String(e) }, 'aviso'))
  }, [atalho, iniciarComSistema])
}
