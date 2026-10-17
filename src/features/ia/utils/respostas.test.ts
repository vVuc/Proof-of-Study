import { describe, expect, it } from 'vitest'
import { dadosIniciais, type Dados } from '@/store/model/dados'
import type { MapaIds } from './prompts'
import { lerRespostaDoDia, lerRespostaDoPlano } from './respostas'

const mapa: MapaIds = {
  grupos: { g1: 'regra:vscode', g2: 'site:youtube', g3: 'app:slack' },
  materias: { m1: 'uuid-rust', m2: 'uuid-ingles' },
}

const resposta = (sugestoes: unknown[], texto: unknown = 'Dia com 2h de estudo e 6h de trabalho.') => JSON.stringify({ texto, sugestoes })

describe('lerRespostaDoDia (INSD-04, INSD-13)', () => {
  it('descarta o grupo inexistente, a matéria inexistente e o tipo fora do enum, e mantém o resto', () => {
    const lida = lerRespostaDoDia(
      resposta([
        { grupo: 'g1', tipo: 'trabalho', materia: null, motivo: 'O repositório é da empresa.' },
        { grupo: 'g9', tipo: 'fora', materia: null, motivo: 'Grupo que não existe.' },
        { grupo: 'g2', tipo: 'estudo', materia: 'm9', motivo: 'Matéria que não existe.' },
        { grupo: 'g3', tipo: 'lazer', materia: null, motivo: 'Tipo que não existe.' },
        { grupo: 'g2', tipo: 'fora', materia: null, motivo: 'Vídeo de gatinhos.' },
      ]),
      mapa,
    )
    expect(lida).toEqual({
      texto: 'Dia com 2h de estudo e 6h de trabalho.',
      sugestoes: [
        { chave: 'regra:vscode', ajuste: 'trabalho', motivo: 'O repositório é da empresa.' },
        { chave: 'site:youtube', ajuste: 'fora', motivo: 'Vídeo de gatinhos.' },
      ],
    })
  })

  it('estudo com matéria vira o ajuste materia:<id>; sem matéria, estudo', () => {
    const lida = lerRespostaDoDia(
      resposta([
        { grupo: 'g1', tipo: 'estudo', materia: 'm1', motivo: 'Livro de Rust.' },
        { grupo: 'g2', tipo: 'estudo', materia: null, motivo: 'Aula sem matéria.' },
      ]),
      mapa,
    )
    expect(lida?.sugestoes.map((s) => s.ajuste)).toEqual(['materia:uuid-rust', 'estudo'])
  })

  it('corta o motivo em 140 caracteres', () => {
    const lida = lerRespostaDoDia(resposta([{ grupo: 'g1', tipo: 'trabalho', materia: null, motivo: 'a'.repeat(200) }]), mapa)
    expect(lida?.sugestoes[0].motivo).toBe('a'.repeat(140))
  })

  it('sem nenhum grupo não fixo, sai só o texto, sem sugestões', () => {
    // O dia só teve o próprio app: a IA não tem grupo para citar, e um id que ela invente é descartado.
    const lida = lerRespostaDoDia(resposta([{ grupo: 'proprio', tipo: 'estudo', materia: null, motivo: 'O app.' }]), { grupos: {}, materias: {} })
    expect(lida).toEqual({ texto: 'Dia com 2h de estudo e 6h de trabalho.', sugestoes: [] })
  })

  it('JSON quebrado dá null', () => {
    expect(lerRespostaDoDia('{"texto": "Dia com', mapa)).toBeNull()
  })

  it('JSON sem texto dá null', () => {
    expect(lerRespostaDoDia(JSON.stringify({ sugestoes: [] }), mapa)).toBeNull()
    expect(lerRespostaDoDia(resposta([], ''), mapa)).toBeNull()
  })
})

describe('lerRespostaDoPlano (PLANO-02 a PLANO-04)', () => {
  const DIA = '2026-10-19'
  const mapaDoPlano: MapaIds = { grupos: {}, materias: { m1: 'ingles', m2: 'blender' } }
  const dados: Dados = {
    ...dadosIniciais(),
    materias: [
      { id: 'ingles', nome: 'Inglês', cor: '#000' },
      { id: 'blender', nome: 'Blender', cor: '#000' },
    ],
    objetivos: [
      { id: 'o1', dia: DIA, materiaId: 'blender', origem: 'rotina', ordem: 0 },
      { id: 'o2', dia: DIA, titulo: 'Revisão de Álgebra', origem: 'manual', ordem: 1 },
    ],
  }
  const ler = (objetivos: unknown[]) => lerRespostaDoPlano(JSON.stringify({ objetivos }), mapaDoPlano, dados, DIA)

  it('matéria inexistente vira objetivo de estudo com título livre, sem criar matéria', () => {
    const novos = ler([
      { tipo: 'estudo', materia: 'm9', titulo: 'Química orgânica', termos: [] },
      { tipo: 'estudo', materia: 'Física', titulo: null, termos: [] },
    ])
    expect(novos?.map((o) => ({ tipo: o.tipo, materiaId: o.materiaId, titulo: o.titulo }))).toEqual([
      { tipo: 'estudo', materiaId: undefined, titulo: 'Química orgânica' },
      { tipo: 'estudo', materiaId: undefined, titulo: 'Física' },
    ])
    expect(dados.materias.map((m) => m.id)).toEqual(['ingles', 'blender'])
  })

  it('o objetivo que não é de estudo nem de trabalho sai', () => {
    const novos = ler([
      { tipo: 'lazer', materia: null, titulo: 'Ver uma série', termos: [] },
      { tipo: 'estudo', materia: 'm1', titulo: null, termos: ['listening'] },
    ])
    expect(novos?.map((o) => o.materiaId ?? o.titulo)).toEqual(['ingles'])
  })

  it('a matéria que o dia já tem, ou que a resposta repete, não duplica', () => {
    const novos = ler([
      { tipo: 'estudo', materia: 'm2', titulo: null, termos: [] },
      { tipo: 'estudo', materia: 'm1', titulo: null, termos: [] },
      { tipo: 'estudo', materia: 'm1', titulo: null, termos: ['podcast'] },
    ])
    expect(novos?.map((o) => o.materiaId)).toEqual(['ingles'])
  })

  it('o título que o dia já tem, ou que a resposta repete, não duplica, sem diferenciar acento e caixa', () => {
    const novos = ler([
      { tipo: 'estudo', materia: null, titulo: 'revisao de algebra', termos: [] },
      { tipo: 'trabalho', materia: null, titulo: 'CORRIGIR O BUG', termos: [] },
      { tipo: 'trabalho', materia: null, titulo: 'Corrigir o bug', termos: [] },
      { tipo: 'estudo', materia: null, titulo: 'blender', termos: [] },
    ])
    expect(novos?.map((o) => o.titulo)).toEqual(['CORRIGIR O BUG'])
  })

  it('o objetivo de trabalho sai com o tipo, o título e os termos, como objetivo do relato', () => {
    const novos = ler([{ tipo: 'trabalho', materia: null, titulo: 'Corrigir o bug da empresa-api', termos: ['empresa-api'] }])
    expect(novos).toHaveLength(1)
    expect(novos?.[0]).toMatchObject({ dia: DIA, tipo: 'trabalho', titulo: 'Corrigir o bug da empresa-api', termos: ['empresa-api'], origem: 'relato' })
    expect(novos?.[0].materiaId).toBeUndefined()
  })

  it('JSON quebrado dá null', () => {
    expect(lerRespostaDoPlano('{"objetivos": [', mapaDoPlano, dados, DIA)).toBeNull()
  })
})
