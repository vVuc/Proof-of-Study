import { describe, expect, it } from 'vitest'
import { dadosIniciais, type Ajuste, type Dados, type Regra, type Relato, type SugestaoIA, type Trecho } from '@/store/model/dados'
import { dadosReducer } from '@/store/reducer/dados-reducer'
import { resumir } from '@/features/sessao/utils/resumo'
import { aceitar, aceitarTodas, estadoDaSugestao } from './sugestoes'

const MIN = 60_000
const regras: Regra[] = [
  { id: 'vscode', rotulo: 'VS Code', campo: 'app', termos: ['code'], tipo: 'estudo' },
  { id: 'pdf', rotulo: 'Leitor de PDF', campo: 'app', termos: ['sumatrapdf'], tipo: 'estudo' },
  { id: 'youtube', rotulo: 'YouTube', campo: 'titulo', termos: ['youtube'], tipo: 'fora' },
]

let relogio = 0
function trecho(minutos: number, titulo: string, processo: string): Trecho {
  const inicio = relogio
  relogio += minutos * MIN
  return { inicio, fim: relogio, titulo, processo, proprio: false, ausente: false }
}
const trechos = [
  trecho(60, 'empresa-api - Visual Studio Code', 'code'),
  trecho(30, 'Gatinhos - YouTube', 'chrome'),
  trecho(20, 'apostila.pdf', 'sumatrapdf'),
  trecho(10, 'Slack', 'slack'),
]
const grupos = resumir(trechos, regras).grupos

const vscode: SugestaoIA = { chave: 'regra:vscode', ajuste: 'trabalho', motivo: 'O repositório é da empresa.' }
const youtube: SugestaoIA = { chave: 'regra:youtube', ajuste: 'ignorar', motivo: 'Vídeo no intervalo.' }
const slack: SugestaoIA = { chave: 'app:slack', ajuste: 'trabalho', motivo: 'Conversa do trabalho.' }
const pdf: SugestaoIA = { chave: 'regra:pdf', ajuste: 'estudo', motivo: 'Apostila.' }

describe('sugestões da IA no relato (INSD-04 a INSD-07)', () => {
  it('sem aceitar, os ajustes não mudam: salvar e recusar o insight não mexem no relato nem nas sessões (INSD-05)', () => {
    const relato: Relato = { id: 'r', dia: '2026-10-19', momento: 'final', texto: 'Dia.', origem: 'texto', ajustes: { 'app:slack': 'trabalho' }, criadoEm: 0, atrasado: false }
    const antes: Dados = { ...dadosIniciais(), relatos: [relato] }
    const insight = { id: 'i', tipo: 'dia' as const, dia: '2026-10-19', texto: 'Insight.', sugestoes: [vscode, youtube], modelo: 'gemini-3.8-flash', criadoEm: 0 }
    const salvo = dadosReducer(antes, { tipo: 'insight/salvar', insight })
    const recusado = dadosReducer(salvo, { tipo: 'insight/recusar', dia: '2026-10-19', chave: 'regra:youtube' })
    expect(recusado.relatos).toEqual([relato])
    expect(recusado.sessoes).toEqual(antes.sessoes)
    // O grupo recusado fica com a classificação que tinha.
    expect(resumir(trechos, regras, relato.ajustes).grupos.find((g) => g.chave === 'regra:youtube')?.tipo).toBe('fora')
  })

  it('aceitar aplica a sugestão como a correção daquele grupo, e só dele (INSD-06)', () => {
    const ajustes: Record<string, Ajuste> = { 'app:slack': 'fora' }
    const aceitos = aceitar(ajustes, vscode)
    expect(aceitos).toEqual({ 'app:slack': 'fora', 'regra:vscode': 'trabalho' })
    const r = resumir(trechos, regras, aceitos)
    expect(r.trabalhoMs).toBe(60 * MIN)
    expect(r.focoMs).toBe(20 * MIN)
  })

  it('aceitarTodas aplica as pendentes e pula as recusadas e as já aceitas (INSD-07)', () => {
    // Slack já aceita pela correção; o PDF já conta como estudo sem correção; o YouTube foi recusado.
    const ajustes: Record<string, Ajuste> = { 'app:slack': 'trabalho' }
    const todas = aceitarTodas(ajustes, [vscode, { ...youtube, recusada: true }, slack, pdf], grupos)
    expect(todas).toEqual({ 'app:slack': 'trabalho', 'regra:vscode': 'trabalho' })
  })

  it('o estado da sugestão: aceita (pela correção ou porque o grupo já conta assim), recusada ou pendente', () => {
    const grupo = (chave: string) => grupos.find((g) => g.chave === chave)
    expect(estadoDaSugestao(vscode, {}, grupo('regra:vscode'))).toBe('pendente')
    expect(estadoDaSugestao(vscode, { 'regra:vscode': 'trabalho' }, grupo('regra:vscode'))).toBe('aceita')
    expect(estadoDaSugestao(pdf, {}, grupo('regra:pdf'))).toBe('aceita')
    expect(estadoDaSugestao({ ...youtube, recusada: true }, {}, grupo('regra:youtube'))).toBe('recusada')
    // Uma correção manual diferente não aceita a sugestão.
    expect(estadoDaSugestao(vscode, { 'regra:vscode': 'fora' }, grupo('regra:vscode'))).toBe('pendente')
  })
})
