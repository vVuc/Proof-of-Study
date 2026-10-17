import { describe, expect, it } from 'vitest'
import { mensagemDoErro } from './mensagens'

const INCOMPLETA = 'A resposta do Gemini veio incompleta. Tente de novo.'

describe('mensagemDoErro no teste da chave', () => {
  it.each([
    ['Chave', 'O Gemini recusou esta chave. Confira se ela foi copiada inteira.'],
    ['Conexao', 'Sem conexão com o Gemini. A chave não foi salva.'],
  ])('%s dá o texto da spec (IACONF-05, IACONF-06)', (tipo, texto) => {
    expect(mensagemDoErro({ tipo }, 'teste')).toBe(texto)
  })
})

describe('mensagemDoErro numa análise', () => {
  it.each([
    ['Tempo', 'O Gemini demorou demais. Tente de novo.'],
    ['Cota', 'A cota da sua chave do Gemini acabou por agora. Tente mais tarde.'],
    ['Chave', 'O Gemini recusou a chave. Confira nas opções.'],
    ['Conexao', 'Sem conexão com o Gemini.'],
    ['Indisponivel', 'O Gemini está indisponível agora. Tente de novo.'],
    ['Resposta', INCOMPLETA],
  ])('%s dá o texto da spec (IAERR-01 a IAERR-05)', (tipo, texto) => {
    expect(mensagemDoErro({ tipo }, 'analise')).toBe(texto)
  })

  it('um erro desconhecido cai na resposta incompleta', () => {
    expect(mensagemDoErro('command ia_gerar not found')).toBe(INCOMPLETA)
    expect(mensagemDoErro({ tipo: 'Outro' })).toBe(INCOMPLETA)
    expect(mensagemDoErro(undefined)).toBe(INCOMPLETA)
  })
})
