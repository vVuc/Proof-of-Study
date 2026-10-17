import { describe, expect, it } from 'vitest'
import type { Materia, Objetivo, Regra, Trecho } from '@/store/model/dados'
import { ajustesMudados, resumir, totaisDaSessao } from './resumo'

const MIN = 60_000
const regras: Regra[] = [
  { id: 'pdf', rotulo: 'Leitor de PDF', campo: 'app', termos: ['sumatrapdf'], tipo: 'estudo' },
  { id: 'youtube', rotulo: 'YouTube', campo: 'titulo', termos: ['youtube'], tipo: 'fora' },
]
const materias: Materia[] = [
  { id: 'ingles', nome: 'Inglês', cor: '#000' },
  { id: 'blender', nome: 'Blender', cor: '#000' },
]
const objetivo = (id: string, materiaId?: string, titulo?: string): Objetivo => ({ id, dia: '2026-10-20', materiaId, titulo, origem: 'manual', ordem: 0 })

let relogio = 0
function trecho(minutos: number, titulo: string, processo = 'chrome'): Trecho {
  const inicio = relogio
  relogio += minutos * MIN
  return { inicio, fim: relogio, titulo, processo, proprio: false, ausente: false }
}

const dia = () => [
  trecho(30, 'Inglês - aula 3 - YouTube'),
  trecho(20, 'Blender tutorial - YouTube'),
  trecho(15, 'Gatinhos - YouTube'),
  trecho(10, 'apostila.pdf', 'sumatrapdf'),
]

describe('resumir', () => {
  it('soma o estudo por matéria e o tempo fora', () => {
    const r = resumir(dia(), { regras, materias, objetivos: [objetivo('o1', 'ingles'), objetivo('o2', 'blender')] })
    expect(r.porMateria).toEqual({ ingles: 30 * MIN, blender: 20 * MIN })
    expect(r.porObjetivo).toEqual({ o1: 30 * MIN, o2: 20 * MIN })
    expect(r.foraMs).toBe(15 * MIN)
    // O PDF é estudo, mas não diz a matéria, e o dia tem dois objetivos.
    expect(r.semObjetivoMs).toBe(10 * MIN)
    expect(r.focoMs).toBe(60 * MIN)
  })

  it('com um objetivo só no dia, o estudo sem matéria vai para ele', () => {
    const r = resumir(dia(), { regras, materias, objetivos: [objetivo('o1', 'ingles')] })
    expect(r.porObjetivo.o1).toBe(40 * MIN)
    expect(r.porMateria.ingles).toBe(40 * MIN)
    // Blender não é objetivo do dia, mas recebe o tempo (redirecionamento).
    expect(r.porMateria.blender).toBe(20 * MIN)
    expect(r.semObjetivoMs).toBe(0)
  })

  it('objetivo pulado não conta como objetivo do dia', () => {
    const pulado = { ...objetivo('o2', 'blender'), pulado: true }
    const r = resumir(dia(), { regras, materias, objetivos: [objetivo('o1', 'ingles'), pulado] })
    expect(r.porObjetivo.o1).toBe(40 * MIN)
  })

  it('a correção do dia muda o tipo e a matéria de um grupo', () => {
    const ctx = { regras, materias, objetivos: [objetivo('o1', 'ingles'), objetivo('o2', 'blender')] }
    const r = resumir(dia(), ctx, { 'regra:youtube': 'materia:ingles', 'regra:pdf': 'fora' })
    expect(r.porMateria.ingles).toBe(45 * MIN)
    expect(r.foraMs).toBe(10 * MIN)
    expect(r.semObjetivoMs).toBe(0)
    const youtube = r.grupos.find((g) => g.chave === 'regra:youtube')!
    expect(youtube).toMatchObject({ tipo: 'estudo', tipoPadrao: 'fora', materiaId: 'ingles', objetivoId: 'o1' })
  })

  it('guarda só as correções que mudam algo', () => {
    const ctx = { regras, materias, objetivos: [objetivo('o1', 'ingles')] }
    const ajustes = { 'materia:ingles': 'materia:ingles', 'regra:youtube': 'estudo', 'regra:pdf': 'estudo' } as const
    const r = resumir(dia(), ctx, ajustes)
    expect(ajustesMudados(r.grupos, ajustes)).toEqual({ 'regra:youtube': 'estudo' })
  })

  it('um grupo corrigido para trabalho soma em trabalhoMs, e não no foco, no fora nem nas matérias (TRAB-02)', () => {
    const ctx = { regras, materias, objetivos: [objetivo('o1', 'ingles'), objetivo('o2', 'blender')] }
    // O PDF era estudo sem matéria (10 min) e o YouTube dos gatinhos era fora do estudo (15 min).
    const r = resumir(dia(), ctx, { 'regra:pdf': 'trabalho', 'regra:youtube': 'trabalho' })
    expect(r.trabalhoMs).toBe(25 * MIN)
    expect(r.focoMs).toBe(50 * MIN)
    expect(r.foraMs).toBe(0)
    expect(r.porMateria).toEqual({ ingles: 30 * MIN, blender: 20 * MIN })
    expect(r.semObjetivoMs).toBe(0)
    expect(r.totalMs).toBe(75 * MIN)
    expect(r.grupos.find((g) => g.chave === 'regra:pdf')).toMatchObject({ tipo: 'trabalho', tipoPadrao: 'estudo' })
    expect(totaisDaSessao(r)).toEqual({
      focoMs: 50 * MIN,
      foraMs: 0,
      trabalhoMs: 25 * MIN,
      focoPorMateria: { ingles: 30 * MIN, blender: 20 * MIN },
      semObjetivoMs: 0,
    })
  })

  it('uma regra de trabalho produz o mesmo resultado que a correção (TRAB-02)', () => {
    const slack: Regra = { id: 'slack', rotulo: 'Slack', campo: 'app', termos: ['slack'], tipo: 'trabalho' }
    const ctx = { regras: [...regras, slack], materias, objetivos: [objetivo('o1', 'ingles'), objetivo('o2', 'blender')] }
    const r = resumir([...dia(), trecho(25, 'Canal geral', 'slack')], ctx)
    expect(r.trabalhoMs).toBe(25 * MIN)
    expect(r.focoMs).toBe(60 * MIN)
    expect(r.foraMs).toBe(15 * MIN)
    expect(r.porMateria).toEqual({ ingles: 30 * MIN, blender: 20 * MIN })
    expect(r.grupos.find((g) => g.chave === 'regra:slack')).toMatchObject({ tipo: 'trabalho', tipoPadrao: 'trabalho' })
    expect(totaisDaSessao(r).trabalhoMs).toBe(25 * MIN)
  })

  it('faixas juntam trechos seguidos do mesmo tipo', () => {
    const r = resumir(dia(), { regras, materias })
    expect(r.faixas.map((f) => f.tipo)).toEqual(['estudo', 'fora', 'estudo'])
    expect(r.saidas).toBe(1)
    expect(r.maiorTrechoMs).toBe(50 * MIN)
  })
})
