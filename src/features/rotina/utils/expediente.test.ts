import { describe, expect, it } from 'vitest'
import type { BlocoRotina, Trecho } from '@/store/model/dados'
import { dividirPorExpediente, intervalosDeTrabalho, mostrarAvisoExpediente, temHorarioDeTrabalho } from './expediente'

// 19/10/2026 é uma segunda (dia 1 da semana); 24/10/2026 é um sábado.
const SEGUNDA = '2026-10-19'
const TERCA = '2026-10-20'
const SABADO = '2026-10-24'
const QUATRO_DA_MANHA = 4 * 60
const hora = (dia: number, h: number, m = 0) => new Date(2026, 9, dia, h, m).getTime()

const item = (extra: Partial<BlocoRotina> = {}): BlocoRotina => ({
  id: 'trabalho',
  titulo: 'Trabalho',
  categoria: 'trabalho',
  dias: [1, 2, 3, 4, 5],
  inicio: 9 * 60,
  fim: 18 * 60,
  avisar: false,
  ...extra,
})

const trecho = (inicio: number, fim: number): Trecho => ({ inicio, fim, titulo: 'empresa-api - VS Code', processo: 'code', proprio: false, ausente: false })

describe('intervalosDeTrabalho', () => {
  it('Trabalho das 9h às 18h de segunda a sexta dá um intervalo na segunda e nenhum no sábado', () => {
    expect(intervalosDeTrabalho([item()], SEGUNDA, QUATRO_DA_MANHA)).toEqual([[hora(19, 9), hora(19, 18)]])
    expect(intervalosDeTrabalho([item()], SABADO, QUATRO_DA_MANHA)).toEqual([])
  })

  it('item das 22h às 2h vale no dia em que começa e no começo do dia seguinte (EXPED-04)', () => {
    const noite = item({ dias: [1], inicio: 22 * 60, fim: 2 * 60 })
    // Com o dia lógico virando à meia-noite, o item se divide entre a segunda e o começo da terça.
    expect(intervalosDeTrabalho([noite], SEGUNDA, 0)).toEqual([[hora(19, 22), hora(20, 0)]])
    expect(intervalosDeTrabalho([noite], TERCA, 0)).toEqual([[hora(20, 0), hora(20, 2)]])
    // Com o dia lógico virando às 4h, as 2h da terça ainda são a segunda.
    expect(intervalosDeTrabalho([noite], SEGUNDA, QUATRO_DA_MANHA)).toEqual([[hora(19, 22), hora(20, 2)]])
    expect(intervalosDeTrabalho([noite], TERCA, QUATRO_DA_MANHA)).toEqual([])
  })

  it('itens que se sobrepõem viram um intervalo só', () => {
    const manha = item({ id: 'manha', inicio: 9 * 60, fim: 13 * 60 })
    const tarde = item({ id: 'tarde', inicio: 12 * 60, fim: 18 * 60 })
    expect(intervalosDeTrabalho([tarde, manha], SEGUNDA, QUATRO_DA_MANHA)).toEqual([[hora(19, 9), hora(19, 18)]])
  })

  it('itens de outras categorias e sem horário são ignorados', () => {
    const estudo = item({ id: 'estudo', categoria: 'estudo' })
    const treino = item({ id: 'treino', categoria: 'treino', inicio: 7 * 60, fim: 8 * 60 })
    const semHorario = item({ id: 'sem-horario', inicio: undefined, fim: undefined })
    expect(intervalosDeTrabalho([estudo, treino, semHorario], SEGUNDA, QUATRO_DA_MANHA)).toEqual([])
    expect(temHorarioDeTrabalho([estudo, treino, semHorario])).toBe(false)
    expect(temHorarioDeTrabalho([estudo, item()])).toBe(true)
  })
})

describe('mostrarAvisoExpediente', () => {
  const MEIA_HORA = 30 * 60_000
  const semHorario = item({ inicio: undefined, fim: undefined })

  it('aparece num dia com trabalho quando a Rotina não tem horário de Trabalho (EXPED-05)', () => {
    expect(mostrarAvisoExpediente([semHorario], MEIA_HORA, false)).toBe(true)
  })

  it('não aparece quando a Rotina tem um item de Trabalho com horário (EXPED-05)', () => {
    expect(mostrarAvisoExpediente([item()], MEIA_HORA, false)).toBe(false)
  })

  it('não aparece num dia sem trabalho (EXPED-05)', () => {
    expect(mostrarAvisoExpediente([semHorario], 0, false)).toBe(false)
  })

  it('não aparece de novo depois de "Não mostrar de novo" (EXPED-06)', () => {
    expect(mostrarAvisoExpediente([semHorario], MEIA_HORA, true)).toBe(false)
  })
})

describe('dividirPorExpediente', () => {
  it('um trecho das 17h às 19h com expediente até 18h vira dois pedaços', () => {
    const pedacos = dividirPorExpediente([trecho(hora(19, 17), hora(19, 19))], [[hora(19, 9), hora(19, 18)]])
    expect(pedacos).toEqual([
      { ...trecho(hora(19, 17), hora(19, 18)), expediente: true },
      { ...trecho(hora(19, 18), hora(19, 19)), expediente: false },
    ])
    // Um trecho todo fora do expediente fica inteiro.
    expect(dividirPorExpediente([trecho(hora(19, 20), hora(19, 21))], [[hora(19, 9), hora(19, 18)]])).toEqual([
      { ...trecho(hora(19, 20), hora(19, 21)), expediente: false },
    ])
  })
})
