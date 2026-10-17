import { describe, expect, it } from 'vitest'
import { dadosIniciais, type Dados, type Sessao } from '@/store/model/dados'
import {
  autoanalise,
  blocosDeFoco,
  focoPorHora,
  focoPorHumor,
  mediana,
  principaisDistracoes,
  temposAteDistrair,
  type TrechoClassificado,
} from './insights'

const MIN = 60_000
// Terça, 20/10/2026, às 9h no fuso local.
const nove = new Date(2026, 9, 20, 9).getTime()

const t = (de: number, minutos: number, tipo: TrechoClassificado['tipo'], rotulo = 'x'): TrechoClassificado => ({
  inicio: nove + de * MIN,
  fim: nove + (de + minutos) * MIN,
  tipo,
  rotulo,
})

describe('blocosDeFoco', () => {
  it('estudo seguido vira um bloco; fora encerra; ignorado não encerra nem soma', () => {
    const blocos = blocosDeFoco([t(0, 20, 'estudo'), t(20, 5, 'ignorar'), t(25, 10, 'estudo'), t(35, 5, 'fora'), t(40, 15, 'estudo')])
    expect(blocos).toEqual([30 * MIN, 15 * MIN])
  })

  it('um buraco no registro (pausa) encerra o bloco', () => {
    expect(blocosDeFoco([t(0, 20, 'estudo'), t(30, 20, 'estudo')])).toEqual([20 * MIN, 20 * MIN])
  })

  it('blocos de menos de um minuto não contam', () => {
    expect(blocosDeFoco([{ ...t(0, 1, 'estudo'), fim: nove + 30_000 }])).toEqual([])
  })
})

describe('temposAteDistrair', () => {
  it('mede do começo até a primeira janela fora, ignorando ausência', () => {
    const trechos = [t(0, 10, 'estudo'), t(10, 3, 'fora', 'Ausente do PC'), t(13, 5, 'fora', 'YouTube'), t(60, 30, 'estudo'), t(90, 5, 'fora')]
    expect(temposAteDistrair(trechos, [nove, nove + 60 * MIN])).toEqual([13 * MIN, 30 * MIN])
  })

  it('sem distração depois do começo, não entra na conta', () => {
    expect(temposAteDistrair([t(0, 60, 'estudo')], [nove])).toEqual([])
  })
})

describe('focoPorHora', () => {
  it('divide o trecho entre as horas e separa estudo de fora', () => {
    const mapa = focoPorHora([t(40, 40, 'estudo'), t(80, 10, 'fora'), t(90, 10, 'ignorar')])
    const terca = mapa[2]
    expect(terca[9]).toEqual({ focoMs: 20 * MIN, foraMs: 0 })
    expect(terca[10]).toEqual({ focoMs: 20 * MIN, foraMs: 10 * MIN })
  })
})

describe('principaisDistracoes', () => {
  it('soma por grupo, sem a ausência, do maior para o menor', () => {
    const lista = principaisDistracoes([t(0, 10, 'fora', 'YouTube'), t(10, 30, 'fora', 'Ausente do PC'), t(60, 20, 'fora', 'Discord'), t(90, 5, 'fora', 'YouTube')])
    expect(lista.map((d) => [d.rotulo, d.ms / MIN])).toEqual([
      ['Discord', 20],
      ['YouTube', 15],
    ])
    expect(lista[0].horaPico).toBe(10)
  })
})

describe('mediana e humor', () => {
  it('mediana de lista par e ímpar', () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([4, 1, 2, 3])).toBe(2.5)
    expect(mediana([])).toBeNull()
  })

  it('compara o foco dos dias de humor alto e baixo, só com os dois lados', () => {
    const linha = (humor: number | undefined, focoMs: number) => ({
      dia: '2026-10-20',
      focoMs,
      foraMs: 0,
      registradoMs: focoMs,
      humor,
      planejadasComTempo: [],
      planejadasSemTempo: [],
      foraDoPlano: [],
    })
    expect(focoPorHumor([linha(5, 4), linha(4, 2), linha(1, 1)])).toEqual({ alto: 3, baixo: 1 })
    expect(focoPorHumor([linha(5, 4), linha(undefined, 1)])).toBeNull()
  })
})

describe('autoanalise', () => {
  it('junta as sessões dos dias escolhidos e mostra planejado × realizado', () => {
    const dados: Dados = {
      ...dadosIniciais(),
      materias: [
        { id: 'ingles', nome: 'Inglês', cor: '#000' },
        { id: 'blender', nome: 'Blender', cor: '#000' },
        { id: 'mat', nome: 'Matemática', cor: '#000' },
      ],
      objetivos: [
        { id: 'o1', dia: '2026-10-20', materiaId: 'ingles', origem: 'rotina', ordem: 0 },
        { id: 'o2', dia: '2026-10-20', materiaId: 'mat', origem: 'rotina', ordem: 1 },
      ],
      relatos: [{ id: 'r', dia: '2026-10-20', momento: 'final', texto: 'ok', origem: 'texto', humor: 4, criadoEm: nove, atrasado: false }],
    }
    const trecho = (de: number, minutos: number, titulo: string) => ({
      inicio: nove + de * MIN,
      fim: nove + (de + minutos) * MIN,
      titulo,
      processo: 'chrome',
      proprio: false,
      ausente: false,
    })
    const sessao: Sessao = {
      id: 's',
      dia: '2026-10-20',
      inicio: nove,
      fim: nove + 120 * MIN,
      pausas: [{ inicio: nove + 60 * MIN, fim: nove + 70 * MIN, motivo: 'ausencia' }],
      trechos: [trecho(0, 40, 'Inglês - aula'), trecho(40, 20, 'Gatinho - YouTube'), trecho(70, 50, 'Blender - tutorial')],
      ajustes: {},
      focoMs: 90 * MIN,
      foraMs: 20 * MIN,
      trabalhoMs: 0,
      focoPorMateria: { ingles: 40 * MIN, blender: 50 * MIN },
      semObjetivoMs: 0,
      anotacao: '',
      imagens: [],
    }
    dados.sessoes = [sessao]
    const a = autoanalise(dados, ['2026-10-20'])
    expect(a.dias).toBe(1)
    expect(a.blocos).toEqual([40 * MIN, 50 * MIN])
    expect(a.ateDistrairMs).toBe(40 * MIN)
    expect(a.distracoes[0].rotulo).toBe('YouTube')
    expect(a.pausas.porMotivo.ausencia).toEqual({ quantidade: 1, ms: 10 * MIN })
    expect(a.linhas[0]).toMatchObject({ humor: 4, planejadasComTempo: ['ingles'], planejadasSemTempo: ['mat'], foraDoPlano: ['blender'] })
  })
})
