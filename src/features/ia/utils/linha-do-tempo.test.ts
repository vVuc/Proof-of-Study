import { describe, expect, it } from 'vitest'
import type { Regra, Trecho } from '@/store/model/dados'
import { gruposParaPrompt } from './linha-do-tempo'

const MIN = 60_000
// 19/10/2026, horário local.
const as = (h: number, m = 0) => new Date(2026, 9, 19, h, m).getTime()
const regras: Regra[] = [
  { id: 'vscode', rotulo: 'VS Code', campo: 'app', termos: ['code'], tipo: 'estudo' },
  { id: 'pdf', rotulo: 'Leitor de PDF', campo: 'app', termos: ['sumatrapdf'], tipo: 'estudo' },
]

const trecho = (inicio: number, fim: number, titulo: string, processo: string, extra: Partial<Trecho> = {}): Trecho => ({
  inicio,
  fim,
  titulo,
  processo,
  proprio: false,
  ausente: false,
  ...extra,
})

describe('gruposParaPrompt (INSD-02, INSD-12)', () => {
  it('250 grupos viram os 200 mais longos e uma linha "outros" com a soma dos demais', () => {
    // O grupo i dura i + 1 minutos, cada um num programa sem regra.
    let relogio = as(8)
    const trechos = Array.from({ length: 250 }, (_, i) => {
      const inicio = relogio
      relogio += (i + 1) * MIN
      return trecho(inicio, relogio, `janela ${i}`, `app${i}`)
    })
    const linha = gruposParaPrompt(trechos, { regras: [] })
    expect(linha.grupos).toHaveLength(200)
    expect(linha.grupos[0]).toMatchObject({ id: 'g1', minutos: 250 })
    expect(linha.grupos[199]).toMatchObject({ id: 'g200', minutos: 51 })
    // Os 50 menores: 1 + 2 + … + 50 minutos.
    expect(linha.outros).toEqual({ id: 'outros', minutos: 1275 })
  })

  it('deixa de fora os grupos fixos e a ausência, sem somá-los em "outros"', () => {
    const linha = gruposParaPrompt(
      [
        trecho(as(9), as(10), 'projeto - Visual Studio Code', 'code'),
        trecho(as(10), as(11), '', '', { ausente: true }),
        trecho(as(11), as(12), 'Proof of Study', 'proof-of-study', { proprio: true }),
        trecho(as(12), as(13), '', '', { semCaptura: true }),
      ],
      { regras },
    )
    expect(Object.values(linha.chaves)).toEqual(['regra:vscode'])
    expect(linha.grupos.map((g) => g.rotulo)).toEqual(['VS Code'])
    expect(linha.outros).toBeNull()
  })

  it('cada grupo leva o rótulo, o programa, o título mais usado, o tipo atual com a correção do dia e os minutos', () => {
    const linha = gruposParaPrompt(
      [
        trecho(as(9), as(9, 10), 'notas.md - Visual Studio Code', 'code'),
        trecho(as(9, 10), as(10), 'projeto - Visual Studio Code', 'code'),
        trecho(as(10), as(10, 30), 'apostila.pdf', 'sumatrapdf'),
      ],
      { regras },
      { 'regra:pdf': 'trabalho' },
    )
    expect(linha.grupos).toEqual([
      { id: 'g1', rotulo: 'VS Code', programa: 'VS Code', titulo: 'projeto - Visual Studio Code', tipo: 'estudo', minutos: 60, intervalos: ['09:00-10:00'] },
      { id: 'g2', rotulo: 'Leitor de PDF', programa: 'sumatrapdf', titulo: 'apostila.pdf', tipo: 'trabalho', minutos: 30, intervalos: ['10:00-10:30'] },
    ])
  })

  it('corta o título em 120 caracteres', () => {
    const longo = 'a'.repeat(200)
    const linha = gruposParaPrompt([trecho(as(9), as(10), longo, 'code')], { regras })
    expect(linha.grupos[0].titulo).toBe('a'.repeat(120))
  })

  it('manda no máximo 20 intervalos HH:MM-HH:MM por grupo, juntando os trechos seguidos', () => {
    // 30 visitas de 5 minutos ao VS Code, com 5 minutos de PDF entre elas.
    const trechos = Array.from({ length: 30 }, (_, i) => [
      trecho(as(8) + i * 10 * MIN, as(8) + (i * 10 + 5) * MIN, 'projeto - Visual Studio Code', 'code'),
      trecho(as(8) + (i * 10 + 5) * MIN, as(8) + (i + 1) * 10 * MIN, 'apostila.pdf', 'sumatrapdf'),
    ]).flat()
    const linha = gruposParaPrompt(trechos, { regras })
    expect(linha.grupos[0].intervalos).toHaveLength(20)

    const seguidos = gruposParaPrompt(
      [
        trecho(as(10), as(10, 30), 'projeto - Visual Studio Code', 'code'),
        trecho(as(10, 30), as(11), 'notas.md - Visual Studio Code', 'code'),
        trecho(as(14), as(14, 15), 'projeto - Visual Studio Code', 'code'),
      ],
      { regras },
    )
    expect(seguidos.grupos[0].intervalos).toEqual(['10:00-11:00', '14:00-14:15'])
  })

  it('o mapa de ids traduz g1 e g2 de volta para a chave do grupo', () => {
    const linha = gruposParaPrompt(
      [trecho(as(9), as(10), 'projeto - Visual Studio Code', 'code'), trecho(as(10), as(10, 30), 'apostila.pdf', 'sumatrapdf')],
      { regras },
    )
    expect(linha.chaves).toEqual({ g1: 'regra:vscode', g2: 'regra:pdf' })
  })
})
