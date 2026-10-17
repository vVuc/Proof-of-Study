import { describe, expect, it } from 'vitest'
import type { MapaIds } from './prompts'
import { lerRespostaDoDia } from './respostas'

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
