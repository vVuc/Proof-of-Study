import { deISO, inicioDoDiaLogico, somarDias, type DataISO } from '@/shared/lib/datas'
import { temHorario, type BlocoRotina, type Trecho } from '@/store/model/dados'
import { duracaoBloco } from './rotina'

const MIN = 60_000

/** Começo e fim, em ms desde 1970. */
export type Intervalo = [number, number]

const itensDeTrabalho = (blocos: BlocoRotina[]) => blocos.filter(temHorario).filter((b) => b.categoria === 'trabalho')

/** A Rotina tem algum item de Trabalho com horário. */
export const temHorarioDeTrabalho = (blocos: BlocoRotina[]) => itensDeTrabalho(blocos).length > 0

/**
 * O horário de trabalho de um dia lógico: os itens de Trabalho com horário da Rotina nos dias da semana certos,
 * inclusive o que começa na véspera e passa da meia-noite (`fim <= inicio`), cortados nas bordas do dia lógico e
 * unidos quando se sobrepõem.
 */
export function intervalosDeTrabalho(blocos: BlocoRotina[], dia: DataISO, inicioDoDiaMin: number): Intervalo[] {
  const comeco = inicioDoDiaLogico(dia, inicioDoDiaMin)
  const fimDoDia = inicioDoDiaLogico(somarDias(dia, 1), inicioDoDiaMin)
  const brutos: Intervalo[] = []
  // O dia lógico toca três datas: a véspera (item que passa da meia-noite), a dele e a seguinte (antes da virada).
  for (const data of [somarDias(dia, -1), dia, somarDias(dia, 1)]) {
    const meiaNoite = deISO(data).getTime()
    const semana = deISO(data).getDay()
    for (const b of itensDeTrabalho(blocos)) {
      if (!b.dias.includes(semana)) continue
      const inicio = Math.max(comeco, meiaNoite + b.inicio * MIN)
      const fim = Math.min(fimDoDia, meiaNoite + (b.inicio + duracaoBloco(b)) * MIN)
      if (inicio < fim) brutos.push([inicio, fim])
    }
  }
  brutos.sort((a, b) => a[0] - b[0])
  const unidos: Intervalo[] = []
  for (const [inicio, fim] of brutos) {
    const ultimo = unidos.at(-1)
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fim)
    else unidos.push([inicio, fim])
  }
  return unidos
}

/** Corta cada trecho nas bordas do expediente; cada pedaço diz se está dentro dele. `intervalos` em ordem. */
export function dividirPorExpediente(trechos: Trecho[], intervalos: Intervalo[]): (Trecho & { expediente: boolean })[] {
  const dentro = (ms: number) => intervalos.some(([a, b]) => a <= ms && ms < b)
  return trechos.flatMap((t) => {
    const pontos = [t.inicio, ...intervalos.flat().filter((ms) => ms > t.inicio && ms < t.fim), t.fim]
    return pontos.slice(1).map((fim, i) => ({ ...t, inicio: pontos[i], fim, expediente: dentro(pontos[i]) }))
  })
}
