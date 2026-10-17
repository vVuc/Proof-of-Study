import { describe, expect, it } from 'vitest'
import type { Materia, Objetivo } from '@/store/model/dados'
import { juntarTranscricao, mensagemDaVoz, vocabularioDaVoz } from './voz'

describe('juntarTranscricao', () => {
  it('junta a fala depois do texto já escrito no campo', () => {
    expect(juntarTranscricao('Ontem rendeu.', '', 'hoje quero')).toBe('Ontem rendeu. hoje quero')
    expect(juntarTranscricao('', '', 'hoje quero')).toBe('hoje quero')
    expect(juntarTranscricao('Ontem rendeu.', '', '')).toBe('Ontem rendeu.')
  })

  it('troca o texto parcial pelo final quando a gravação para (VOZ-02)', () => {
    expect(juntarTranscricao('Ontem rendeu.', 'Hoje quero estudar Blender.', 'hoje quero estudar blender')).toBe(
      'Ontem rendeu. Hoje quero estudar Blender.',
    )
  })

  it('depois de voz:erro, sem texto final, o texto acumulado continua no campo (VOZ-05)', () => {
    // A queda não traz o texto final: o campo fica com o que já tinha sido transcrito.
    expect(juntarTranscricao('Plano:', '', 'hoje quero estudar Rust')).toBe('Plano: hoje quero estudar Rust')
    expect(mensagemDaVoz({ tipo: 'Conexao' }, 'fala')).toBe('A conexão com o Gemini caiu. O texto até aqui ficou no campo.')
  })
})

describe('mensagemDaVoz', () => {
  it('microfone ausente ou negado dá a mensagem da spec (VOZ-07)', () => {
    expect(mensagemDaVoz({ tipo: 'Microfone' }, 'inicio')).toBe('Não deu para usar o microfone.')
  })

  it('ao começar, os outros erros têm as mensagens das chamadas à IA', () => {
    expect(mensagemDaVoz({ tipo: 'Conexao' }, 'inicio')).toBe('Sem conexão com o Gemini.')
    expect(mensagemDaVoz({ tipo: 'Chave' }, 'inicio')).toBe('O Gemini recusou a chave. Confira nas opções.')
  })
})

describe('vocabularioDaVoz', () => {
  const materia = (nome: string, termos?: string[]): Materia => ({ id: nome, nome, cor: '#000000', termos })
  const objetivo = (dia: string, extra: Partial<Objetivo>): Objetivo => ({ id: crypto.randomUUID(), dia, origem: 'manual', ordem: 0, ...extra })

  it('leva os títulos dos objetivos do dia e os nomes e termos das matérias, sem repetir (VOZ-04)', () => {
    const dados = {
      materias: [materia('Blender', ['modelagem', 'geometry nodes']), materia('Inglês', ['listening'])],
      objetivos: [
        objetivo('2026-10-17', { titulo: 'Corrigir o bug da empresa-api', tipo: 'trabalho' }),
        objetivo('2026-10-17', { materiaId: 'Blender' }),
        objetivo('2026-10-17', { titulo: 'Objetivo pulado', pulado: true }),
        objetivo('2026-10-16', { titulo: 'Objetivo de ontem' }),
        objetivo('2026-10-17', { titulo: 'blender' }),
      ],
    }
    expect(vocabularioDaVoz(dados, '2026-10-17')).toEqual([
      'Corrigir o bug da empresa-api',
      'blender',
      'modelagem',
      'geometry nodes',
      'Inglês',
      'listening',
    ])
  })

  it('manda no máximo 100 termos', () => {
    const dados = { materias: Array.from({ length: 60 }, (_, i) => materia(`Matéria ${i}`, [`termo ${i}`])), objetivos: [] }
    const vocabulario = vocabularioDaVoz(dados, '2026-10-17')
    expect(vocabulario).toHaveLength(100)
    expect(vocabulario[0]).toBe('Matéria 0')
    expect(vocabulario[99]).toBe('termo 49')
  })
})
