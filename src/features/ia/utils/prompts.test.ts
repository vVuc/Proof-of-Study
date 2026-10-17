import { describe, expect, it } from 'vitest'
import { dadosIniciais, type BlocoRotina, type Dados, type Materia, type Meta, type Objetivo, type Regra, type Relato, type Sessao, type Trecho } from '@/store/model/dados'
import { montarPedidoDoDia, montarPedidoDoPlano, REGRAS_DE_TOM } from './prompts'

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
