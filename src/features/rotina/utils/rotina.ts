import { temHorario, type BlocoComHorario, type BlocoRotina } from '@/store/model/dados'

export const MINUTOS_DIA = 24 * 60

/** Duração do bloco em minutos; `fim <= inicio` passa da meia-noite. */
export const duracaoBloco = (b: Pick<BlocoComHorario, 'inicio' | 'fim'>) =>
  b.fim > b.inicio ? b.fim - b.inicio : MINUTOS_DIA - b.inicio + b.fim

/** Pedaço de um bloco dentro de um dia (0 a 1440). */
export interface Segmento {
  bloco: BlocoComHorario
  inicio: number
  fim: number
  /** Continuação de um bloco que começou no dia anterior. */
  continuacao: boolean
}

/**
 * Os pedaços de bloco com horário que caem num dia da semana (0 = domingo), incluindo o que vem da noite
 * anterior. Itens sem horário não entram na grade.
 */
export function segmentosDoDia(blocos: BlocoRotina[], dia: number): Segmento[] {
  const ontem = (dia + 6) % 7
  const segmentos: Segmento[] = []
  for (const bloco of blocos.filter(temHorario)) {
    const cruza = bloco.fim <= bloco.inicio
    if (bloco.dias.includes(dia))
      segmentos.push({ bloco, inicio: bloco.inicio, fim: cruza ? MINUTOS_DIA : bloco.fim, continuacao: false })
    if (cruza && bloco.fim > 0 && bloco.dias.includes(ontem))
      segmentos.push({ bloco, inicio: 0, fim: bloco.fim, continuacao: true })
  }
  return segmentos.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim)
}

/** Minutos de estudo da matéria planejados nos itens com horário da rotina da semana. */
export function minutosPlanejados(blocos: BlocoRotina[], materiaId: string): number {
  return blocos
    .filter(temHorario)
    .filter((b) => b.categoria === 'estudo' && b.materiaId === materiaId)
    .reduce((soma, b) => soma + duracaoBloco(b) * b.dias.length, 0)
}

/** Bloco de estudo com horário em andamento agora e o próximo de hoje. */
export function estudoDeHoje(blocos: BlocoRotina[], agora: Date) {
  const minuto = agora.getHours() * 60 + agora.getMinutes()
  const doDia = segmentosDoDia(blocos, agora.getDay()).filter((s) => s.bloco.categoria === 'estudo')
  return {
    atual: doDia.find((s) => s.inicio <= minuto && minuto < s.fim),
    proximo: doDia.find((s) => s.inicio > minuto),
  }
}

/** Minutos de estudo da matéria num dia da semana (0 = domingo), a partir de `desdeMinuto`. */
export function estudoNoDia(blocos: BlocoRotina[], materiaId: string, dia: number, desdeMinuto = 0): number {
  return segmentosDoDia(blocos, dia)
    .filter((s) => s.bloco.categoria === 'estudo' && s.bloco.materiaId === materiaId)
    .reduce((soma, s) => soma + Math.max(0, s.fim - Math.max(s.inicio, desdeMinuto)), 0)
}

/** Estudo da matéria que ainda resta na rotina, de agora até o fim de domingo. */
export function estudoRestanteNaSemana(blocos: BlocoRotina[], materiaId: string, agora: Date): number {
  const hoje = agora.getDay()
  // Dias de hoje até domingo, na ordem de segunda a domingo (domingo = 7).
  const fim = 7
  const inicio = hoje === 0 ? 7 : hoje
  let total = 0
  for (let d = inicio; d <= fim; d++) {
    const dia = d % 7
    total += estudoNoDia(blocos, materiaId, dia, dia === hoje ? agora.getHours() * 60 + agora.getMinutes() : 0)
  }
  return total
}

/** Itens sem horário de um dia da semana (0 = domingo): objetivos que se repetem. */
export const semHorarioDoDia = (blocos: BlocoRotina[], dia: number) => blocos.filter((b) => !temHorario(b) && b.dias.includes(dia))

/** A rotina tem algum item de estudo com horário da matéria (só aí faz sentido dizer se a meta "cabe na rotina"). */
export const temEstudoComHorario = (blocos: BlocoRotina[], materiaId: string) =>
  blocos.some((b) => temHorario(b) && b.categoria === 'estudo' && b.materiaId === materiaId)
