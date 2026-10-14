import type { BlocoRotina, Dados, Materia, Meta, Objetivo, Preferencias, Regra, Relato, Sessao } from '../model/dados'
import { regrasPadrao } from '../model/dados'

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

/** Troca o item de mesmo id, ou acrescenta no fim. */
function salvarItem<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.some((i) => i.id === item.id) ? lista.map((i) => (i.id === item.id ? item : i)) : [...lista, item]
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
    case 'bloco/salvar':
      return { ...estado, blocos: salvarItem(estado.blocos, acao.bloco) }
    case 'bloco/excluir':
      return { ...estado, blocos: estado.blocos.filter((b) => b.id !== acao.id) }
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
  }
}
