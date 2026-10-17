import { describe, expect, it } from 'vitest'
import { dadosIniciais, type BlocoRotina, type Dados, type InsightDia, type Materia, type Meta, type Objetivo, type Regra, type Relato, type Sessao, type Trecho } from '@/store/model/dados'
import { montarPedidoDaSemana, montarPedidoDoDia, montarPedidoDoPlano, REGRAS_DE_TOM } from './prompts'

const MIN = 60_000
// 19/10/2026 é uma segunda.
const SEGUNDA = '2026-10-19'
const as = (h: number, m = 0) => new Date(2026, 9, 19, h, m).getTime()

const rust: Materia = { id: crypto.randomUUID(), nome: 'Rust', cor: '#000', termos: ['rust-book'] }
const ingles: Materia = { id: crypto.randomUUID(), nome: 'Inglês', cor: '#000' }
const objetivoRust: Objetivo = { id: crypto.randomUUID(), dia: SEGUNDA, materiaId: rust.id, origem: 'relato', ordem: 0 }
const objetivoTrabalho: Objetivo = {
  id: crypto.randomUUID(),
  dia: SEGUNDA,
  titulo: 'Corrigir o bug',
  termos: ['empresa-api'],
  origem: 'relato',
  tipo: 'trabalho',
  ordem: 1,
}
const trabalho: BlocoRotina = { id: crypto.randomUUID(), titulo: 'Trabalho', categoria: 'trabalho', dias: [1, 2, 3, 4, 5], inicio: 9 * 60, fim: 18 * 60, avisar: false }
const sabado: BlocoRotina = { id: crypto.randomUUID(), titulo: 'Treino', categoria: 'treino', dias: [6], inicio: 8 * 60, fim: 9 * 60, avisar: false }
const semHorario: BlocoRotina = { id: crypto.randomUUID(), titulo: 'Ler', categoria: 'estudo', dias: [1], avisar: false }
const planoDoDia: Relato = {
  id: crypto.randomUUID(),
  dia: SEGUNDA,
  momento: 'inicial',
  texto: 'Estudar Rust e corrigir o bug da empresa-api',
  origem: 'texto',
  criadoEm: as(8),
  atrasado: false,
}
const metas: Meta[] = [
  { id: crypto.randomUUID(), materiaId: rust.id, semana: SEGUNDA, minutos: 300, descricao: 'Ownership' },
  { id: crypto.randomUUID(), materiaId: ingles.id, semana: '2026-10-12', minutos: 120, descricao: 'Semana passada' },
]

const regras: Regra[] = [
  { id: 'vscode', rotulo: 'VS Code', campo: 'app', termos: ['code'], tipo: 'estudo' },
  { id: 'youtube', rotulo: 'YouTube', campo: 'titulo', termos: ['youtube'], tipo: 'fora' },
]

const trecho = (inicio: number, fim: number, titulo: string, processo: string): Trecho => ({ inicio, fim, titulo, processo, proprio: false, ausente: false })

const sessao: Sessao = {
  id: crypto.randomUUID(),
  dia: SEGUNDA,
  inicio: as(19),
  fim: as(21),
  pausas: [{ inicio: as(20), fim: as(20, 15), motivo: 'manual' }],
  trechos: [trecho(as(19), as(20), 'cap-4 - rust-book - Visual Studio Code', 'code'), trecho(as(20, 15), as(21), 'Gatinhos - YouTube - Google Chrome', 'chrome')],
  ajustes: {},
  focoMs: 60 * MIN,
  foraMs: 45 * MIN,
  trabalhoMs: 0,
  focoPorMateria: { [rust.id]: 60 * MIN },
  semObjetivoMs: 0,
  anotacao: '',
  imagens: [],
}

const dados = (extra: Partial<Dados> = {}): Dados => {
  const base = dadosIniciais()
  return {
    ...base,
    materias: [rust, ingles],
    metas,
    blocos: [trabalho, sabado, semHorario],
    objetivos: [objetivoRust, objetivoTrabalho],
    sessoes: [sessao],
    relatos: [planoDoDia],
    regras,
    preferencias: { ...base.preferencias, sobreVoce: 'Sou dev na empresa X; o repositório empresa-api é trabalho.' },
    ...extra,
  }
}

const entrada = (d: Dados = dados()) => JSON.parse(montarPedidoDoDia(d, SEGUNDA, {}).pedido.entrada)

describe('montarPedidoDoDia', () => {
  it('a instrução pede português do Brasil e proíbe "perdido", "fracasso" e "falha" (INSD-09)', () => {
    const { pedido } = montarPedidoDoDia(dados(), SEGUNDA, {})
    expect(pedido.tipo).toBe('dia')
    expect(pedido.sistema).toContain(REGRAS_DE_TOM)
    expect(REGRAS_DE_TOM).toContain('português do Brasil')
    expect(REGRAS_DE_TOM).toMatch(/Não use[^.]*"perdido"[^.]*"fracasso"[^.]*"falha"/)
  })

  it('a entrada traz o "Sobre você" (IACONF-11) e o relato inicial', () => {
    const e = entrada()
    expect(e.sobreVoce).toBe('Sou dev na empresa X; o repositório empresa-api é trabalho.')
    expect(e.planoDoDia).toBe('Estudar Rust e corrigir o bug da empresa-api')
  })

  it('a entrada traz só os itens da Rotina com horário daquele dia da semana', () => {
    expect(entrada().rotina).toEqual([{ titulo: 'Trabalho', categoria: 'trabalho', inicio: '09:00', fim: '18:00' }])
  })

  it('a entrada traz os objetivos do dia com o tipo', () => {
    expect(entrada().objetivos).toEqual([
      { tipo: 'estudo', materia: 'm1', titulo: null, termos: [] },
      { tipo: 'trabalho', materia: null, titulo: 'Corrigir o bug', termos: ['empresa-api'] },
    ])
  })

  it('a entrada traz as matérias, as metas da semana, os grupos com o tipo atual e as pausas, com a sessão aberta (INSD-02)', () => {
    const aberta = { trechos: [trecho(as(21), as(21, 30), 'Docs - empresa-api - Visual Studio Code', 'code')], pausas: [{ inicio: as(21, 30), fim: as(21, 40), motivo: 'ausencia' as const }] }
    const { pedido, mapa } = montarPedidoDoDia(dados(), SEGUNDA, { 'regra:youtube': 'ignorar' }, aberta)
    const e = JSON.parse(pedido.entrada)
    expect(e.materias).toEqual([
      { id: 'm1', nome: 'Rust', termos: ['rust-book'] },
      { id: 'm2', nome: 'Inglês', termos: [] },
    ])
    expect(e.metasDaSemana).toEqual([{ materia: 'm1', minutos: 300, etapa: 'Ownership' }])
    expect(e.grupos).toEqual([
      { id: 'g1', rotulo: 'Rust', programa: 'VS Code', titulo: 'cap-4 - rust-book - Visual Studio Code', tipo: 'estudo', materia: 'm1', minutos: 60, intervalos: ['19:00-20:00'] },
      { id: 'g2', rotulo: 'YouTube', programa: 'Chrome', titulo: 'Gatinhos - YouTube - Google Chrome', tipo: 'ignorar', materia: null, minutos: 45, intervalos: ['20:15-21:00'] },
      { id: 'g3', rotulo: 'Corrigir o bug', programa: 'VS Code', titulo: 'Docs - empresa-api - Visual Studio Code', tipo: 'trabalho', materia: null, minutos: 30, intervalos: ['21:00-21:30'] },
    ])
    expect(e.pausas).toEqual([
      { inicio: '20:00', fim: '20:15', motivo: 'manual' },
      { inicio: '21:30', fim: '21:40', motivo: 'ausencia' },
    ])
    expect(mapa.grupos).toEqual({ g1: `materia:${rust.id}`, g2: 'regra:youtube', g3: `objetivo:${objetivoTrabalho.id}` })
    expect(mapa.materias).toEqual({ m1: rust.id, m2: ingles.id })
  })

  it('nenhum UUID de matéria ou de objetivo aparece na entrada', () => {
    const { pedido } = montarPedidoDoDia(dados(), SEGUNDA, {})
    for (const id of [rust.id, ingles.id, objetivoRust.id, objetivoTrabalho.id]) expect(pedido.entrada).not.toContain(id)
    expect(pedido.entrada).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  it('o esquema pede o texto e as sugestões, com o tipo limitado a estudo, trabalho, fora e ignorar', () => {
    const { esquema } = montarPedidoDoDia(dados(), SEGUNDA, {}).pedido
    expect(esquema).toMatchObject({ type: 'object', required: ['texto', 'sugestoes'], properties: { texto: { type: 'string' } } })
    const sugestao = (esquema as { properties: { sugestoes: { items: { properties: Record<string, unknown>; required: string[] } } } }).properties.sugestoes.items
    expect(sugestao.properties.tipo).toEqual({ type: 'string', enum: ['estudo', 'trabalho', 'fora', 'ignorar'] })
    expect(sugestao.required).toEqual(['grupo', 'tipo', 'materia', 'motivo'])
  })
})

describe('montarPedidoDoPlano (PLANO-01)', () => {
  const plano = 'Hoje quero ler o rust-book e corrigir o bug da empresa-api'

  it('a entrada traz o texto do plano, o "Sobre você" (IACONF-11), as matérias com os termos e os objetivos do dia', () => {
    const { pedido, mapa } = montarPedidoDoPlano(dados(), SEGUNDA, plano)
    expect(pedido.tipo).toBe('plano')
    const e = JSON.parse(pedido.entrada)
    expect(e.plano).toBe(plano)
    expect(e.sobreVoce).toBe('Sou dev na empresa X; o repositório empresa-api é trabalho.')
    expect(e.materias).toEqual([
      { id: 'm1', nome: 'Rust', termos: ['rust-book'] },
      { id: 'm2', nome: 'Inglês', termos: [] },
    ])
    expect(e.objetivosDoDia).toEqual([
      { tipo: 'estudo', materia: 'm1', titulo: null },
      { tipo: 'trabalho', materia: null, titulo: 'Corrigir o bug' },
    ])
    expect(mapa.materias).toEqual({ m1: rust.id, m2: ingles.id })
    expect(pedido.entrada).not.toContain(rust.id)
  })

  it('o esquema limita o tipo a estudo e trabalho', () => {
    const { esquema } = montarPedidoDoPlano(dados(), SEGUNDA, plano).pedido
    expect(esquema).toMatchObject({ type: 'object', required: ['objetivos'] })
    const objetivo = (esquema as { properties: { objetivos: { items: { properties: Record<string, unknown>; required: string[] } } } }).properties.objetivos.items
    expect(objetivo.properties.tipo).toEqual({ type: 'string', enum: ['estudo', 'trabalho'] })
    expect(objetivo.required).toEqual(['tipo', 'materia', 'titulo', 'termos'])
  })
})

describe('montarPedidoDaSemana (INSS-02, INSS-06)', () => {
  const TERCA = '2026-10-20'
  const QUARTA = '2026-10-21'
  const DOMINGO = '2026-10-25'
  const SEMANA = [SEGUNDA, TERCA, QUARTA, '2026-10-22', '2026-10-23', '2026-10-24', DOMINGO]
  const hora = (dia: number, h: number) => new Date(2026, 9, dia, h).getTime()
  const relato = (dia: string, momento: Relato['momento'], texto: string, criadoEm: number, humor?: number): Relato => ({
    id: crypto.randomUUID(),
    dia,
    momento,
    texto,
    origem: 'texto',
    humor,
    criadoEm,
    atrasado: false,
  })
  const insightDeSegunda: InsightDia = {
    id: crypto.randomUUID(),
    tipo: 'dia',
    dia: SEGUNDA,
    texto: 'Segunda com 1h de estudo de Rust e a reunião no meio.',
    sugestoes: [],
    modelo: 'gemini-3.8-flash',
    criadoEm: as(22),
  }
  // Terça: 30 min de estudo de Rust (sem relato final, então ainda não validado), 120 min de trabalho, 10 min fora.
  const sessaoDeTerca: Sessao = {
    ...sessao,
    id: crypto.randomUUID(),
    dia: TERCA,
    pausas: [],
    trechos: [],
    focoMs: 30 * MIN,
    foraMs: 10 * MIN,
    trabalhoMs: 120 * MIN,
    focoPorMateria: { [rust.id]: 30 * MIN },
  }
  // Fora da semana: o domingo anterior e a segunda seguinte não entram.
  const sessaoDaSemanaPassada: Sessao = { ...sessao, id: crypto.randomUUID(), dia: '2026-10-18', focoMs: 999 * MIN }
  const semana = (): Dados =>
    dados({
      sessoes: [sessao, sessaoDeTerca, sessaoDaSemanaPassada],
      relatos: [
        planoDoDia,
        relato(SEGUNDA, 'final', 'Estudei Rust e corrigi o bug.', as(22), 4),
        relato(TERCA, 'inicial', 'Revisar o inglês', hora(20, 8)),
        relato(DOMINGO, 'final', 'Dia de descanso.', hora(25, 22), 2),
        relato('2026-10-18', 'final', 'Texto da semana passada', hora(18, 22), 5),
        relato('2026-10-26', 'inicial', 'Texto da semana seguinte', hora(26, 8)),
      ],
      insights: [insightDeSegunda],
    })
  const pedido = (d: Dados = semana()) => montarPedidoDaSemana(d, SEGUNDA)
  const entradaDaSemana = (d: Dados = semana()) => JSON.parse(pedido(d).entrada)

  it('a entrada traz os sete dias, de segunda a domingo, com os relatos inicial e final e o humor', () => {
    const e = entradaDaSemana()
    expect(e.dias.map((d: { dia: string }) => d.dia)).toEqual(SEMANA)
    expect(e.dias[0]).toMatchObject({ diaDaSemana: 'Segunda', relatoInicial: 'Estudar Rust e corrigir o bug da empresa-api', relatoFinal: 'Estudei Rust e corrigi o bug.', humor: 4 })
    expect(e.dias[1]).toMatchObject({ relatoInicial: 'Revisar o inglês', relatoFinal: null, humor: null })
    expect(e.dias[2]).toMatchObject({ diaDaSemana: 'Quarta', relatoInicial: null, relatoFinal: null, humor: null })
    expect(e.dias[6]).toMatchObject({ diaDaSemana: 'Domingo', relatoInicial: null, relatoFinal: 'Dia de descanso.', humor: 2 })
    expect(pedido().entrada).not.toContain('Texto da semana')
  })

  it('o insight do dia salvo entra no dia dele, e os dias sem insight vêm com null', () => {
    const dias = entradaDaSemana().dias
    expect(dias[0].insightDoDia).toBe('Segunda com 1h de estudo de Rust e a reunião no meio.')
    expect(dias[1].insightDoDia).toBeNull()
    expect(dias[6].insightDoDia).toBeNull()
  })

  it('a instrução usa as mesmas regras de idioma e de tom do insight do dia (INSS-06)', () => {
    const { tipo, sistema } = pedido()
    expect(tipo).toBe('semana')
    expect(sistema).toContain(REGRAS_DE_TOM)
    expect(montarPedidoDoDia(semana(), SEGUNDA, {}).pedido.sistema).toContain(REGRAS_DE_TOM)
  })

  it('a entrada traz o "Sobre você", as matérias com a meta e as horas validadas da semana e os itens da Rotina com horário', () => {
    const e = entradaDaSemana()
    expect(e.semana).toBe(SEGUNDA)
    expect(e.sobreVoce).toBe('Sou dev na empresa X; o repositório empresa-api é trabalho.')
    // Só a segunda tem relato final: os 30 min de Rust da terça ainda não estão validados.
    expect(e.materias).toEqual([
      { id: 'm1', nome: 'Rust', metaMin: 300, etapa: 'Ownership', validadoMin: 60 },
      { id: 'm2', nome: 'Inglês', metaMin: null, etapa: null, validadoMin: 0 },
    ])
    expect(e.rotina).toEqual([
      { titulo: 'Trabalho', categoria: 'trabalho', dias: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], inicio: '09:00', fim: '18:00' },
      { titulo: 'Treino', categoria: 'treino', dias: ['Sáb'], inicio: '08:00', fim: '09:00' },
    ])
  })

  it('cada dia traz os objetivos e os totais de estudo, trabalho, fora e pausas em minutos', () => {
    const dias = entradaDaSemana().dias
    expect(dias[0].objetivos).toEqual([
      { tipo: 'estudo', materia: 'm1', titulo: null },
      { tipo: 'trabalho', materia: null, titulo: 'Corrigir o bug' },
    ])
    expect(dias[0].totais).toEqual({ estudoMin: 60, trabalhoMin: 0, foraMin: 45, pausasMin: 15 })
    expect(dias[1].totais).toEqual({ estudoMin: 30, trabalhoMin: 120, foraMin: 10, pausasMin: 0 })
    expect(dias[2]).toMatchObject({ objetivos: [], totais: { estudoMin: 0, trabalhoMin: 0, foraMin: 0, pausasMin: 0 } })
    expect(pedido().entrada).not.toContain(rust.id)
  })

  it('o esquema pede as três partes: comoFoi, padroes e proximaSemana', () => {
    expect(pedido().esquema).toEqual({
      type: 'object',
      properties: { comoFoi: { type: 'string' }, padroes: { type: 'string' }, proximaSemana: { type: 'string' } },
      required: ['comoFoi', 'padroes', 'proximaSemana'],
    })
  })
})
