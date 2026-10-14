import { describe, expect, it } from 'vitest'
import type { Regra, Trecho } from './dados'
import { atualizarDados, DadosIncompativeis, type DadosSalvos } from './migracao'

const HORA = 3_600_000
/** 20/10/2026 às 9h no fuso local. */
const nove = new Date(2026, 9, 20, 9).getTime()

const trecho = (inicio: number, fim: number, titulo: string, processo = 'app'): Trecho => ({
  inicio,
  fim,
  titulo,
  processo,
  proprio: false,
  ausente: false,
})

const regraAnki: Regra = { id: 'r1', rotulo: 'Anki', campo: 'app', termos: ['anki'], tipo: 'estudo' }

function v2(extra: Partial<DadosSalvos> = {}): DadosSalvos {
  return {
    materias: [{ id: 'ingles', nome: 'Inglês', cor: '#d7322a' }],
    metas: [],
    blocos: [{ id: 'b1', titulo: 'Inglês', categoria: 'estudo', dias: [1], inicio: 19 * 60, fim: 20 * 60, materiaId: 'ingles', avisar: true }],
    regras: [regraAnki],
    preferencias: { duracaoMin: 25, limiteAusenciaMin: 5, avisoDistracao: true, avisoDistracaoSeg: 60 },
    sessoes: [
      {
        id: 's1',
        materiaId: 'ingles',
        inicio: nove,
        fim: nove + HORA,
        duracaoPlanejadaMin: 50,
        trechos: [trecho(nove, nove + HORA, 'Anki', 'anki')],
        ajustes: {},
        focoMs: HORA,
        foraMs: 0,
        anotacao: 'verbos',
        imagens: [],
      },
    ],
    sessaoAtual: null,
    ...extra,
  }
}

describe('atualizarDados', () => {
  it('sem nada salvo, começa com os dados iniciais', () => {
    const dados = atualizarDados(undefined, 2)
    expect(dados.sessoes).toEqual([])
    expect(dados.regras.length).toBeGreaterThan(0)
  })

  it('converte as sessões do formato 2: dia lógico, pausas vazias e todo o foco na matéria do pomodoro', () => {
    const dados = atualizarDados(v2(), 2)
    const [s] = dados.sessoes
    expect(s.dia).toBe('2026-10-20')
    expect(s.pausas).toEqual([])
    expect(s.focoPorMateria).toEqual({ ingles: HORA })
    expect(s.semObjetivoMs).toBe(0)
    expect(s.focoMs).toBe(HORA)
  })

  it('uma sessão começada de madrugada conta no dia anterior (o dia vira às 4h)', () => {
    const duas = new Date(2026, 9, 21, 2).getTime()
    const salvo = v2()
    salvo.sessoes![0] = { ...salvo.sessoes![0], inicio: duas, fim: duas + HORA }
    expect(atualizarDados(salvo, 2).sessoes[0].dia).toBe('2026-10-20')
  })

  it('mantém os itens da rotina com horário e tira a duração fixa do pomodoro das preferências', () => {
    const dados = atualizarDados(v2(), 2)
    expect(dados.blocos[0]).toMatchObject({ inicio: 19 * 60, fim: 20 * 60 })
    expect(dados.preferencias).not.toHaveProperty('duracaoMin')
    expect(dados.preferencias.inicioDoDiaMin).toBe(4 * 60)
    expect(dados.objetivos).toEqual([])
    expect(dados.relatos).toEqual([])
  })

  it('um pomodoro em andamento no formato 2 vira uma sessão salva, sem anotação', () => {
    const salvo = v2({
      sessaoAtual: {
        id: 'atual',
        materiaId: 'ingles',
        inicio: nove + 2 * HORA,
        duracaoMin: 25,
        trechos: [trecho(nove + 2 * HORA, nove + 2.5 * HORA, 'Anki', 'anki'), trecho(nove + 2.5 * HORA, nove + 2.75 * HORA, 'Jogo')],
        imagens: [],
        anotacao: '',
      },
    })
    const atual = atualizarDados(salvo, 2).sessoes.find((s) => s.id === 'atual')!
    expect(atual.focoMs).toBe(0.5 * HORA)
    expect(atual.foraMs).toBe(0.25 * HORA)
    expect(atual.focoPorMateria).toEqual({ ingles: 0.5 * HORA })
    expect(atual.anotacao).toBe('')
  })

  it('formato 1: o tipo "foco" vira estudo e as regras de partida entram no lugar das antigas', () => {
    const salvo = v2()
    salvo.sessoes![0] = { ...salvo.sessoes![0], ajustes: { 'site:youtube': 'foco' as never } }
    const dados = atualizarDados(salvo, 1)
    expect(dados.sessoes[0].ajustes).toEqual({ 'site:youtube': 'estudo' })
    expect(dados.regras.some((r) => r.rotulo === 'VS Code')).toBe(true)
  })

  it('recusa dados de uma versão mais nova do app', () => {
    expect(() => atualizarDados(v2(), 4)).toThrow(DadosIncompativeis)
  })

  it('dados já no formato 3 passam sem mudança', () => {
    const uma = atualizarDados(v2(), 2)
    expect(atualizarDados(uma, 3)).toEqual(uma)
  })
})
