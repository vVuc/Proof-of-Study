import { describe, expect, it } from 'vitest'
import { dadosIniciais, type Dados, type Relato } from '@/store/model/dados'
import { diaValidado, focoNoBanco, sessaoValidada } from '@/features/banco/utils/validacao'
import { objetivosDaRotina, recalcularDia, sessaoParaGravar, sugerirObjetivos, termosDoDia } from './dia'

const MIN = 60_000
// 20/10/2026 é uma terça (dia 2 da semana).
const DIA = '2026-10-20'
const nove = new Date(2026, 9, 20, 9).getTime()

function dados(): Dados {
  return {
    ...dadosIniciais(),
    materias: [
      { id: 'ingles', nome: 'Inglês', cor: '#000', termos: ['verb tenses'] },
      { id: 'blender', nome: 'Blender', cor: '#000' },
      { id: 'velha', nome: 'Francês', cor: '#000', arquivada: true },
    ],
    blocos: [
      { id: 'b1', titulo: 'Inglês', categoria: 'estudo', dias: [2, 4], inicio: 19 * 60, fim: 20 * 60, materiaId: 'ingles', avisar: true },
      { id: 'b2', titulo: 'Inglês de manhã', categoria: 'estudo', dias: [2], materiaId: 'ingles', avisar: false },
      { id: 'b3', titulo: 'Leitura livre', categoria: 'estudo', dias: [2], avisar: false },
      { id: 'b4', titulo: 'Academia', categoria: 'treino', dias: [2], inicio: 7 * 60, fim: 8 * 60, avisar: false },
    ],
  }
}

const relatoFinal = (texto: string, criadoEm: number, extra: Partial<Relato> = {}): Relato => ({
  id: 'r',
  dia: DIA,
  momento: 'final',
  texto,
  origem: 'texto',
  criadoEm,
  atrasado: false,
  ...extra,
})

describe('objetivosDaRotina', () => {
  it('cria um objetivo por matéria de estudo do dia, com ou sem horário, e um para o item sem matéria', () => {
    const novos = objetivosDaRotina(dados(), DIA)
    expect(novos.map((o) => o.materiaId ?? o.titulo)).toEqual(['ingles', 'Leitura livre'])
    expect(novos.every((o) => o.origem === 'rotina' && o.dia === DIA)).toBe(true)
  })

  it('não recria os que já existem ou foram pulados', () => {
    const d = dados()
    d.objetivos = objetivosDaRotina(d, DIA).map((o) => ({ ...o, pulado: true }))
    expect(objetivosDaRotina(d, DIA)).toEqual([])
  })

  it('em dia sem item de estudo, não sugere nada', () => {
    expect(objetivosDaRotina(dados(), '2026-10-21')).toEqual([])
  })
})

describe('sugerirObjetivos', () => {
  it('acha as matérias citadas no relato inicial, sem acento e pelos termos', () => {
    const sugeridos = sugerirObjetivos('Hoje quero ver verb tenses e modelar no blender. Frances fica pra depois', dados(), DIA)
    expect(sugeridos.map((o) => o.materiaId)).toEqual(['ingles', 'blender'])
    expect(sugeridos.every((o) => o.origem === 'relato')).toBe(true)
  })

  it('não repete o que já é objetivo do dia', () => {
    const d = dados()
    d.objetivos = [{ id: 'o', dia: DIA, materiaId: 'ingles', origem: 'rotina', ordem: 0 }]
    expect(sugerirObjetivos('inglês e blender', d, DIA).map((o) => o.materiaId)).toEqual(['blender'])
  })
})

describe('termosDoDia', () => {
  it('junta nome e termos das matérias ativas e os termos dos objetivos, normalizados', () => {
    const d = dados()
    d.objetivos = [{ id: 'o', dia: DIA, titulo: 'Modelar a cadeira', origem: 'manual', ordem: 0 }]
    expect(termosDoDia(d, DIA)).toEqual(['ingles', 'verb tenses', 'blender', 'modelar', 'cadeira'])
  })
})

describe('sessão do dia e banco de horas', () => {
  const trecho = (de: number, minutos: number, titulo: string) => ({
    inicio: nove + de * MIN,
    fim: nove + (de + minutos) * MIN,
    titulo,
    processo: 'chrome',
    proprio: false,
    ausente: false,
  })
  const doRust = {
    id: 'dia-1',
    dia: DIA,
    inicio: nove,
    fim: nove + 90 * MIN,
    pausas: [{ inicio: nove + 60 * MIN, fim: nove + 70 * MIN, motivo: 'manual' as const }],
    trechos: [trecho(0, 40, 'Aula de inglês - YouTube'), trecho(40, 20, 'Gatinhos - YouTube'), trecho(70, 20, 'Blender - YouTube')],
  }

  it('a sessão vinda do Rust guarda os totais por matéria', () => {
    const s = sessaoParaGravar(doRust, dados())
    expect(s.focoPorMateria).toEqual({ ingles: 40 * MIN, blender: 20 * MIN })
    expect(s.foraMs).toBe(20 * MIN)
    expect(s.pausas).toHaveLength(1)
    expect(s.anotacao).toBe('')
  })

  it('sem relato nem anotação, o tempo fica pendente; o relato final com texto valida o dia', () => {
    const d = dados()
    const s = sessaoParaGravar(doRust, d)
    expect(sessaoValidada(d, s)).toBe(false)
    expect(focoNoBanco(d, s, 'ingles')).toBe(0)
    d.relatos = [relatoFinal('Rendi bem no inglês', nove + 12 * 60 * MIN)]
    expect(diaValidado(d, DIA)).toBe(true)
    expect(focoNoBanco(d, s, 'ingles')).toBe(40 * MIN)
  })

  it('relato vazio não valida, e o prazo é o fim do dia lógico seguinte', () => {
    const d = dados()
    d.relatos = [relatoFinal('   ', nove)]
    expect(diaValidado(d, DIA)).toBe(false)
    // Dia seguinte às 23h: ainda vale. Dois dias depois às 5h (passou das 4h): não vale mais.
    d.relatos = [relatoFinal('ok', new Date(2026, 9, 21, 23).getTime())]
    expect(diaValidado(d, DIA)).toBe(true)
    d.relatos = [relatoFinal('ok', new Date(2026, 9, 22, 5).getTime())]
    expect(diaValidado(d, DIA)).toBe(false)
  })

  it('a anotação da sessão valida sem relato', () => {
    const d = dados()
    const s = { ...sessaoParaGravar(doRust, d), anotacao: 'fiz os exercícios' }
    expect(sessaoValidada(d, s)).toBe(true)
  })

  it('as correções do relato final recalculam as sessões do dia', () => {
    const d = dados()
    d.sessoes = [sessaoParaGravar(doRust, d)]
    d.relatos = [relatoFinal('ok', nove, { ajustes: { 'regra:youtube': 'materia:blender' } })]
    // O grupo do YouTube (gatinhos) passa a ser estudo de Blender.
    const regraYoutube = d.regras.find((r) => r.rotulo === 'YouTube')!
    d.relatos[0].ajustes = { [`regra:${regraYoutube.id}`]: 'materia:blender' }
    const [s] = recalcularDia(d, DIA)
    expect(s.focoPorMateria).toEqual({ ingles: 40 * MIN, blender: 40 * MIN })
    expect(s.foraMs).toBe(0)
  })
})
