import { describe, expect, it } from 'vitest'
import { classificar } from '@/features/sessao/utils/classificacao'
import { VERSAO_DADOS, type Regra, type Trecho } from './dados'
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

const regraYoutube: Regra = { id: 'r2', rotulo: 'YouTube', campo: 'titulo', termos: ['youtube'], tipo: 'fora' }
const regraSpotify: Regra = { id: 'r3', rotulo: 'Spotify', campo: 'app', termos: ['spotify'], tipo: 'ignorar' }

/** Dados como o formato 3 salvava: sem trabalho, sem insights e sem as preferências da IA. */
function v3(): DadosSalvos {
  return {
    materias: [{ id: 'ingles', nome: 'Inglês', cor: '#d7322a' }],
    metas: [],
    blocos: [],
    objetivos: [
      { id: 'o1', dia: '2026-10-20', titulo: 'Modelar a cadeira', origem: 'manual', ordem: 0 },
      { id: 'o2', dia: '2026-10-20', materiaId: 'ingles', origem: 'rotina', itemId: 'b1', ordem: 1 },
    ],
    regras: [regraAnki, regraYoutube, regraSpotify],
    relatos: [],
    preferencias: { cicloMin: 25, limiteAusenciaMin: 7, avisoDistracao: false, inicioDoDiaMin: 5 * 60, voz: false, modeloVoz: 'small' },
    sessoes: [
      {
        id: 's1',
        dia: '2026-10-20',
        inicio: nove,
        fim: nove + HORA,
        pausas: [],
        trechos: [trecho(nove, nove + HORA, 'Anki', 'anki')],
        ajustes: { 'regra:r2': 'estudo', 'regra:r3': 'fora', 'site:reddit': 'materia:ingles' },
        focoMs: HORA,
        foraMs: 0,
        focoPorMateria: { ingles: HORA },
        semObjetivoMs: 0,
        anotacao: 'verbos',
        imagens: [],
      },
      {
        id: 's2',
        dia: '2026-10-21',
        inicio: nove + 24 * HORA,
        fim: nove + 25.5 * HORA,
        pausas: [],
        trechos: [trecho(nove + 24 * HORA, nove + 25 * HORA, 'Modelar a cadeira - Blender', 'blender')],
        ajustes: {},
        focoMs: HORA,
        foraMs: 0.5 * HORA,
        focoPorMateria: {},
        semObjetivoMs: HORA,
        anotacao: '',
        imagens: [],
      },
    ],
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
    expect(() => atualizarDados(v2(), 5)).toThrow(DadosIncompativeis)
  })

  it('dados já no formato 3 passam sem mudança', () => {
    const uma = atualizarDados(v2(), 2)
    expect(atualizarDados(uma, 3)).toEqual(uma)
  })

  it('formato 3 → 4: regras, correções, objetivos e a soma de foco ficam iguais (TRAB-06)', () => {
    const salvo = v3()
    const dados = atualizarDados(salvo, 3)
    expect(dados.regras).toEqual(salvo.regras)
    expect(dados.sessoes.map((s) => s.ajustes)).toEqual([{ 'regra:r2': 'estudo', 'regra:r3': 'fora', 'site:reddit': 'materia:ingles' }, {}])
    expect(dados.objetivos).toEqual(salvo.objetivos)
    expect(dados.sessoes.reduce((soma, s) => soma + s.focoMs, 0)).toBe(2 * HORA)
    expect(dados.sessoes.map((s) => s.focoPorMateria)).toEqual([{ ingles: HORA }, {}])
  })

  it('formato 3 → 4: sessões com trabalhoMs 0, insights vazio e preferências da IA com os padrões (TRAB-06)', () => {
    const dados = atualizarDados(v3(), 3)
    expect(VERSAO_DADOS).toBe(4)
    expect(dados.sessoes.map((s) => s.trabalhoMs)).toEqual([0, 0])
    expect(dados.insights).toEqual([])
    expect(dados.preferencias).toMatchObject({ ia: false, consentimentoIA: null, sobreVoce: '', ocultarAvisoExpediente: false })
    // O que a pessoa já tinha configurado fica.
    expect(dados.preferencias).toMatchObject({ cicloMin: 25, limiteAusenciaMin: 7, inicioDoDiaMin: 5 * 60, voz: false })
  })

  it('formato 3 → 4: objetivo salvo sem tipo continua contando como estudo (TRAB-06)', () => {
    const dados = atualizarDados(v3(), 3)
    const janela = { titulo: 'Modelar a cadeira - Blender', processo: 'blender', proprio: false, ausente: false }
    const classe = classificar(janela, { regras: dados.regras, materias: dados.materias, objetivos: dados.objetivos })
    expect(classe).toMatchObject({ tipo: 'estudo', objetivoId: 'o1' })
  })
})
