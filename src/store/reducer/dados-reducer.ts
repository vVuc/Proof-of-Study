import { deISO, inicioDaSemana, type DataISO } from '@/shared/lib/datas'
import type { BlocoRotina, Dados, Insight, Materia, Meta, Objetivo, Preferencias, Regra, Relato, Sessao } from '../model/dados'
import { regrasPadrao } from '../model/dados'
import { recalcularDia } from '@/features/hoje/utils/dia'
import { relatoDoDia } from '@/features/banco/utils/validacao'

export type Acao =
  | { tipo: 'dados/carregar'; dados: Dados }
  | { tipo: 'materia/salvar'; materia: Materia }
  | { tipo: 'materia/excluir'; id: string }
  | { tipo: 'meta/salvar'; meta: Meta }
  | { tipo: 'meta/excluir'; id: string }
  | { tipo: 'bloco/salvar'; bloco: BlocoRotina }
  | { tipo: 'bloco/excluir'; id: string }
  | { tipo: 'objetivos/salvar'; objetivos: Objetivo[] }
  | { tipo: 'objetivo/excluir'; id: string }
  | { tipo: 'sessao/salvar'; sessao: Sessao }
  | { tipo: 'sessao/excluir'; id: string }
  | { tipo: 'relato/salvar'; relato: Relato }
  | { tipo: 'regra/salvar'; regra: Regra }
  | { tipo: 'regra/excluir'; id: string }
  | { tipo: 'regras/restaurar' }
  | { tipo: 'preferencias/salvar'; preferencias: Preferencias }
  | { tipo: 'insight/salvar'; insight: Insight }
  | { tipo: 'insight/recusar'; dia: DataISO; chave: string }

/** Troca o item de mesmo id, ou acrescenta no fim. */
function salvarItem<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.some((i) => i.id === item.id) ? lista.map((i) => (i.id === item.id ? item : i)) : [...lista, item]
}

/**
 * O horário de trabalho mudou: as sessões dos dias ainda sem relato final passam a contar com o horário novo. Os dias
 * com relato final já foram validados e ficam como estavam.
 */
function recalcularDiasSemRelato(dados: Dados): Dados {
  const dias = [...new Set(dados.sessoes.map((s) => s.dia))].filter((dia) => !relatoDoDia(dados.relatos, dia, 'final'))
  return { ...dados, sessoes: dias.flatMap((dia) => recalcularDia(dados, dia)).reduce(salvarItem, dados.sessoes) }
}

export function dadosReducer(estado: Dados, acao: Acao): Dados {
  switch (acao.tipo) {
    case 'dados/carregar':
      return acao.dados
    case 'materia/salvar':
      return { ...estado, materias: salvarItem(estado.materias, acao.materia) }
    case 'materia/excluir':
      return {
        ...estado,
        materias: estado.materias.filter((m) => m.id !== acao.id),
        metas: estado.metas.filter((m) => m.materiaId !== acao.id),
        blocos: estado.blocos.map((b) => (b.materiaId === acao.id ? { ...b, materiaId: undefined } : b)),
        objetivos: estado.objetivos.map((o) => (o.materiaId === acao.id ? { ...o, materiaId: undefined } : o)),
        regras: estado.regras.map((r) => (r.materiaId === acao.id ? { ...r, materiaId: undefined } : r)),
      }
    case 'meta/salvar': {
      // Uma meta por matéria e semana.
      const outras = estado.metas.filter(
        (m) => m.id !== acao.meta.id && !(m.materiaId === acao.meta.materiaId && m.semana === acao.meta.semana),
      )
      return { ...estado, metas: [...outras, acao.meta] }
    }
    case 'meta/excluir':
      return { ...estado, metas: estado.metas.filter((m) => m.id !== acao.id) }
    case 'bloco/salvar': {
      const anterior = estado.blocos.find((b) => b.id === acao.bloco.id)
      const novo = { ...estado, blocos: salvarItem(estado.blocos, acao.bloco) }
      const trabalho = acao.bloco.categoria === 'trabalho' || anterior?.categoria === 'trabalho'
      return trabalho ? recalcularDiasSemRelato(novo) : novo
    }
    case 'bloco/excluir': {
      const novo = { ...estado, blocos: estado.blocos.filter((b) => b.id !== acao.id) }
      const trabalho = estado.blocos.some((b) => b.id === acao.id && b.categoria === 'trabalho')
      return trabalho ? recalcularDiasSemRelato(novo) : novo
    }
    case 'objetivos/salvar':
      return { ...estado, objetivos: acao.objetivos.reduce(salvarItem, estado.objetivos) }
    case 'objetivo/excluir': {
      // Os que vieram da rotina ficam marcados como pulados, para não voltarem no mesmo dia.
      const objetivo = estado.objetivos.find((o) => o.id === acao.id)
      if (!objetivo) return estado
      if (objetivo.origem === 'rotina') return { ...estado, objetivos: salvarItem(estado.objetivos, { ...objetivo, pulado: true }) }
      return { ...estado, objetivos: estado.objetivos.filter((o) => o.id !== acao.id) }
    }
    case 'sessao/salvar':
      return { ...estado, sessoes: salvarItem(estado.sessoes, acao.sessao) }
    case 'sessao/excluir':
      return { ...estado, sessoes: estado.sessoes.filter((s) => s.id !== acao.id) }
    case 'relato/salvar': {
      // Um relato de cada momento por dia: salvar de novo substitui.
      const { dia, momento } = acao.relato
      const outros = estado.relatos.filter((r) => r.id !== acao.relato.id && !(r.dia === dia && r.momento === momento))
      return { ...estado, relatos: [...outros, acao.relato] }
    }
    case 'regra/salvar':
      return { ...estado, regras: salvarItem(estado.regras, acao.regra) }
    case 'regra/excluir':
      return { ...estado, regras: estado.regras.filter((r) => r.id !== acao.id) }
    case 'regras/restaurar':
      return { ...estado, regras: regrasPadrao() }
    case 'preferencias/salvar':
      return { ...estado, preferencias: acao.preferencias }
    case 'insight/salvar': {
      // Um por dia e um por semana (pela segunda-feira): gerar de novo substitui.
      const novo: Insight = acao.insight.tipo === 'semana' ? { ...acao.insight, semana: inicioDaSemana(deISO(acao.insight.semana)) } : acao.insight
      const chave = (i: Insight) => (i.tipo === 'dia' ? `dia:${i.dia}` : `semana:${i.semana}`)
      return { ...estado, insights: [...estado.insights.filter((i) => chave(i) !== chave(novo)), novo] }
    }
    case 'insight/recusar':
      return {
        ...estado,
        insights: estado.insights.map((i) =>
          i.tipo === 'dia' && i.dia === acao.dia ? { ...i, sugestoes: i.sugestoes.map((s) => (s.chave === acao.chave ? { ...s, recusada: true } : s)) } : i,
        ),
      }
  }
}
