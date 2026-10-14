import { describe, expect, it } from 'vitest'
import type { Materia, Objetivo, Regra } from '@/store/model/dados'
import { classificar, contemPalavra, normalizar, termosDoObjetivo } from './classificacao'

const regras: Regra[] = [
  { id: 'chrome', rotulo: 'Chrome', campo: 'app', termos: ['chrome'], tipo: 'estudo' },
  { id: 'youtube', rotulo: 'YouTube', campo: 'titulo', termos: ['youtube'], tipo: 'fora' },
  { id: 'anki', rotulo: 'Anki', campo: 'app', termos: ['anki'], tipo: 'estudo', materiaId: 'ingles' },
  { id: 'spotify', rotulo: 'Spotify', campo: 'app', termos: ['spotify'], tipo: 'ignorar' },
]

const materias: Materia[] = [
  { id: 'blender', nome: 'Blender', cor: '#000', termos: ['modelagem 3d'] },
  { id: 'ingles', nome: 'Inglês', cor: '#000', termos: ['verb tenses'] },
  { id: 'go', nome: 'Go', cor: '#000' },
  { id: 'velha', nome: 'Francês', cor: '#000', arquivada: true },
]

const janela = (titulo: string, processo = 'chrome') => ({ titulo, processo, proprio: false, ausente: false })

describe('normalizar e contemPalavra', () => {
  it('tira acento e caixa', () => {
    expect(normalizar('Inglês AVANÇADO')).toBe('ingles avancado')
  })

  it('casa só a palavra inteira', () => {
    expect(contemPalavra('aprendendo go hoje', 'go')).toBe(true)
    expect(contemPalavra('google docs', 'go')).toBe(false)
    expect(contemPalavra('curso de modelagem 3d - youtube', 'modelagem 3d')).toBe(true)
  })
})

describe('classificar', () => {
  const ctx = { regras, materias }

  it('o tutorial de Blender no YouTube é estudo de Blender, mesmo com o YouTube marcado como fora', () => {
    expect(classificar(janela('Blender: modelando uma cadeira - YouTube - Google Chrome'), ctx)).toMatchObject({
      tipo: 'estudo',
      materiaId: 'blender',
      chave: 'materia:blender',
    })
  })

  it('um vídeo qualquer no YouTube continua fora', () => {
    expect(classificar(janela('Gatinho engraçado - YouTube - Google Chrome'), ctx)).toMatchObject({ tipo: 'fora', chave: 'regra:youtube' })
  })

  it('casa o nome da matéria sem acento e os termos dela', () => {
    expect(classificar(janela('Aula de ingles - Google Chrome'), ctx).materiaId).toBe('ingles')
    expect(classificar(janela('English verb tenses explained'), ctx).materiaId).toBe('ingles')
  })

  it('"Go" não casa com "Google"', () => {
    expect(classificar(janela('Google Docs - Google Chrome'), ctx).materiaId).toBeUndefined()
  })

  it('matéria arquivada não recebe tempo', () => {
    expect(classificar(janela('Francês básico'), ctx).materiaId).toBeUndefined()
  })

  it('regra de estudo com matéria passa a matéria', () => {
    expect(classificar(janela('Revisão', 'anki'), ctx)).toMatchObject({ tipo: 'estudo', materiaId: 'ingles' })
  })

  it('regra de estudo sem matéria não diz a matéria', () => {
    expect(classificar(janela('MDN - Google Chrome'), ctx)).toMatchObject({ tipo: 'estudo', materiaId: undefined })
  })

  it('objetivo de texto livre casa pelas palavras do título', () => {
    const objetivos: Objetivo[] = [{ id: 'o1', dia: '2026-10-20', titulo: 'Modelar a cadeira', origem: 'relato', ordem: 0 }]
    expect(classificar(janela('Referências de cadeira - Pinterest'), { regras, materias, objetivos })).toMatchObject({
      tipo: 'estudo',
      objetivoId: 'o1',
    })
  })

  it('casos fixos vêm antes de tudo', () => {
    expect(classificar({ ...janela('Blender'), ausente: true }, ctx).chave).toBe('ausente')
    expect(classificar({ ...janela('Blender'), proprio: true }, ctx).chave).toBe('proprio')
    expect(classificar({ ...janela('Blender'), semCaptura: true }, ctx).chave).toBe('sem-captura')
  })

  it('aceita só a lista de regras, como antes', () => {
    expect(classificar(janela('Música', 'spotify'), regras).tipo).toBe('ignorar')
  })
})

describe('termosDoObjetivo', () => {
  it('ignora palavras curtas e comuns', () => {
    expect(termosDoObjetivo({ titulo: 'Estudar a cadeira de jardim' })).toEqual(['cadeira', 'jardim'])
  })

  it('objetivo com matéria usa só os termos explícitos', () => {
    expect(termosDoObjetivo({ titulo: 'Inglês', materiaId: 'ingles', termos: ['podcast'] })).toEqual(['podcast'])
  })
})
