import { format } from 'date-fns'
import { DIAS_SEMANA, formatarHora } from '@/shared/lib/datas'
import type { MotivoPausa } from '@/store/model/dados'
import type { Fase } from '../api/rastreio'

/** "Qua 07/10 · 17:00–17:25" */
export function rotuloDaSessao(inicio: number, fim: number) {
  const dia = DIAS_SEMANA.find((d) => d.dia === new Date(inicio).getDay())?.curto
  return `${dia} ${format(inicio, 'dd/MM')} · ${formatarHora(inicio)}–${formatarHora(fim)}`
}

export const ROTULO_FASE: Record<Fase, string> = {
  parado: 'Parado',
  rodando: 'Capturando',
  pausado: 'Pausado',
  ausente: 'Pausa automática',
}

/** O que a pessoa precisa saber sobre o estado da sessão, numa frase. */
export const EXPLICACAO_FASE: Record<Fase, string> = {
  parado: 'Um play e o app registra o dia até você pausar.',
  rodando: 'O app registra as janelas e liga cada uma a um objetivo.',
  pausado: 'Nada é registrado até o próximo play.',
  ausente: 'Você saiu do PC. A captura volta sozinha quando você voltar.',
}

export const ROTULO_PAUSA: Record<MotivoPausa, string> = {
  manual: 'Pausa',
  ausencia: 'Ausente do PC',
  suspensao: 'PC suspenso',
  desligado: 'App fechado',
}
