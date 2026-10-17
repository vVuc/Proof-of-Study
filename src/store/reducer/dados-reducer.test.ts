import { describe, expect, it } from 'vitest'
import { dadosIniciais, type BlocoRotina, type Dados, type Relato, type Sessao } from '../model/dados'
import { dadosReducer } from './dados-reducer'

const HORA = 3_600_000
// 19/10/2026 é uma segunda.
const SEGUNDA = '2026-10-19'
const as = (h: number) => new Date(2026, 9, 19, h).getTime()

/** Uma hora no VS Code (regra padrão de estudo) às 10h, com os totais de antes do horário de trabalho. */
const sessao = (extra: Partial<Sessao> = {}): Sessao => ({
  id: 's1',
  dia: SEGUNDA,
  inicio: as(10),
  fim: as(11),
  pausas: [],
  trechos: [{ inicio: as(10), fim: as(11), titulo: 'projeto - Visual Studio Code', processo: 'code', proprio: false, ausente: false }],
  ajustes: {},
  focoMs: HORA,
  foraMs: 0,
  trabalhoMs: 0,
  focoPorMateria: {},
  semObjetivoMs: HORA,
  anotacao: '',
  imagens: [],
  ...extra,
})

const trabalho: BlocoRotina = { id: 't', titulo: 'Trabalho', categoria: 'trabalho', dias: [1, 2, 3, 4, 5], inicio: 9 * 60, fim: 18 * 60, avisar: false }

const relatoFinal: Relato = { id: 'r', dia: SEGUNDA, momento: 'final', texto: 'Dia de código.', origem: 'texto', criadoEm: as(22), atrasado: false }

const dados = (extra: Partial<Dados> = {}): Dados => ({ ...dadosIniciais(), sessoes: [sessao()], ...extra })

describe('horário de trabalho e as sessões dos dias (EXPED-07)', () => {
  it('criar Trabalho das 9h às 18h muda os totais de um dia sem relato final', () => {
    const depois = dadosReducer(dados(), { tipo: 'bloco/salvar', bloco: trabalho })
    expect(depois.sessoes[0]).toMatchObject({ focoMs: 0, trabalhoMs: HORA, semObjetivoMs: 0 })
  })

  it('apagar o item de Trabalho devolve o tempo ao estudo nos dias sem relato final', () => {
    const antes = dados({ blocos: [trabalho], sessoes: [sessao({ focoMs: 0, trabalhoMs: HORA, semObjetivoMs: 0 })] })
    const depois = dadosReducer(antes, { tipo: 'bloco/excluir', id: 't' })
    expect(depois.sessoes[0]).toMatchObject({ focoMs: HORA, trabalhoMs: 0, semObjetivoMs: HORA })
  })

  it('um dia com relato final não muda', () => {
    const depois = dadosReducer(dados({ relatos: [relatoFinal] }), { tipo: 'bloco/salvar', bloco: trabalho })
    expect(depois.sessoes[0]).toEqual(sessao())
  })

  it('salvar um item de outra categoria não recalcula', () => {
    // Totais gravados com regras antigas: um recálculo os trocaria por 1h de estudo.
    const gravada = sessao({ focoMs: 0, foraMs: HORA, semObjetivoMs: 0 })
    const estudo: BlocoRotina = { ...trabalho, id: 'e', titulo: 'Rust', categoria: 'estudo' }
    const depois = dadosReducer(dados({ sessoes: [gravada] }), { tipo: 'bloco/salvar', bloco: estudo })
    expect(depois.sessoes[0]).toEqual(gravada)
  })
})
