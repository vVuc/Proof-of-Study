import { describe, expect, it } from 'vitest'
import { dadosIniciais, type Dados, type Relato, type Sessao } from '@/store/model/dados'
import { semanaPadrao, semanaTemRegistros } from './semana'

describe('semanaPadrao (INSS-01)', () => {
  // 19/10/2026 é uma segunda; 25/10 é o domingo da mesma semana.
  it('numa quarta, a última semana completa começa na segunda da semana anterior', () => {
    expect(semanaPadrao('2026-10-21')).toBe('2026-10-12')
  })

  it('num domingo, a semana que termina hoje ainda não está completa', () => {
    expect(semanaPadrao('2026-10-25')).toBe('2026-10-12')
  })

  it('numa segunda, a semana que terminou ontem já está completa', () => {
    expect(semanaPadrao('2026-10-26')).toBe('2026-10-19')
  })
})

describe('semanaTemRegistros (INSS-05)', () => {
  const SEMANA = '2026-10-19'
  const sessao = (dia: string): Sessao => ({
    id: crypto.randomUUID(),
    dia,
    inicio: 0,
    fim: 0,
    pausas: [],
    trechos: [],
    ajustes: {},
    focoMs: 0,
    foraMs: 0,
    trabalhoMs: 0,
    focoPorMateria: {},
    semObjetivoMs: 0,
    anotacao: '',
    imagens: [],
  })
  const relato = (dia: string, momento: Relato['momento']): Relato => ({ id: crypto.randomUUID(), dia, momento, texto: 'Texto', origem: 'texto', criadoEm: 0, atrasado: false })
  const dados = (extra: Partial<Dados>): Dados => ({ ...dadosIniciais(), ...extra })

  it('é falso sem sessão nem relato na semana, mesmo com registros das semanas vizinhas', () => {
    // O domingo anterior e a segunda seguinte ficam fora da semana.
    const vizinhas = dados({ sessoes: [sessao('2026-10-18')], relatos: [relato('2026-10-26', 'inicial')] })
    expect(semanaTemRegistros(dados({}), SEMANA)).toBe(false)
    expect(semanaTemRegistros(vizinhas, SEMANA)).toBe(false)
  })

  it('é verdadeiro com uma sessão na semana', () => {
    expect(semanaTemRegistros(dados({ sessoes: [sessao('2026-10-25')] }), SEMANA)).toBe(true)
  })

  it('é verdadeiro só com um relato na semana', () => {
    expect(semanaTemRegistros(dados({ relatos: [relato('2026-10-21', 'final')] }), SEMANA)).toBe(true)
  })
})
