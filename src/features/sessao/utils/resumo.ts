import type { Ajuste, Regra, Sessao, Tipo, Trecho } from '@/store/model/dados'
import { classificar, type Classe, type ContextoClassificacao } from './classificacao'

export interface TituloNoGrupo {
  titulo: string
  ms: number
}

export interface Grupo extends Classe {
  /** Como a classificação contou (o `tipo` já tem a correção do dia). */
  tipoPadrao: Tipo
  /** Matéria e objetivo como a atribuição decidiu, antes da correção. */
  materiaPadrao?: string
  ms: number
  /** Do mais usado para o menos usado. */
  titulos: TituloNoGrupo[]
}

/** Pedaço da linha do tempo: trechos seguidos do mesmo tipo viram um só. */
export interface Faixa {
  tipo: Tipo
  ms: number
}

export interface Resumo {
  /** Todo o estudo, com e sem objetivo. */
  focoMs: number
  foraMs: number
  ignoradoMs: number
  totalMs: number
  /** Grupos do maior para o menor tempo. */
  grupos: Grupo[]
  faixas: Faixa[]
  /** Quantas vezes saiu para fora do estudo. */
  saidas: number
  /** Maior trecho seguido de estudo. */
  maiorTrechoMs: number
  /** Estudo atribuído a cada matéria. */
  porMateria: Record<string, number>
  /** Estudo atribuído a cada objetivo do dia. */
  porObjetivo: Record<string, number>
  /** Estudo que não foi ligado a nenhum objetivo nem matéria. */
  semObjetivoMs: number
}

const PREFIXO_MATERIA = 'materia:'

/** Tipo de uma correção: `materia:<id>` é estudo daquela matéria. */
export const tipoDoAjuste = (ajuste: Ajuste): Tipo => (ajuste.startsWith(PREFIXO_MATERIA) ? 'estudo' : (ajuste as Tipo))
export const materiaDoAjuste = (ajuste: Ajuste | undefined) =>
  ajuste?.startsWith(PREFIXO_MATERIA) ? ajuste.slice(PREFIXO_MATERIA.length) : undefined

/**
 * Para onde vai o estudo de um grupo: o objetivo que casou, a matéria da janela (e o objetivo do dia dessa
 * matéria) ou, se o dia tem um objetivo só, esse objetivo. Sem nada disso, fica sem objetivo.
 */
function destino(classe: Classe, contexto: ContextoClassificacao, materiaForcada?: string): { materiaId?: string; objetivoId?: string } {
  const objetivos = (contexto.objetivos ?? []).filter((o) => !o.pulado)
  const doObjetivo = (materiaId: string) => objetivos.find((o) => o.materiaId === materiaId)?.id
  if (materiaForcada) return { materiaId: materiaForcada, objetivoId: doObjetivo(materiaForcada) }
  if (classe.objetivoId) return { materiaId: classe.materiaId, objetivoId: classe.objetivoId }
  if (classe.materiaId) return { materiaId: classe.materiaId, objetivoId: doObjetivo(classe.materiaId) }
  if (objetivos.length === 1) return { materiaId: objetivos[0].materiaId, objetivoId: objetivos[0].id }
  return {}
}

/**
 * O resumo de um conjunto de trechos (uma sessão ou um dia): quanto foi estudo, fora e ignorado, para onde foi
 * cada grupo de janelas e quanto estudo cada matéria e cada objetivo recebeu. `ajustes` são as correções do dia.
 */
export function resumir(trechos: Trecho[], contexto: ContextoClassificacao | Regra[], ajustes: Record<string, Ajuste> = {}): Resumo {
  const ctx = Array.isArray(contexto) ? { regras: contexto } : contexto
  const grupos = new Map<string, Grupo & { porTitulo: Map<string, number> }>()
  const faixas: Faixa[] = []

  for (const t of trechos) {
    const ms = Math.max(0, t.fim - t.inicio)
    const classe = classificar(t, ctx)
    let grupo = grupos.get(classe.chave)
    if (!grupo) {
      const ajuste = classe.fixo ? undefined : ajustes[classe.chave]
      const tipo = ajuste ? tipoDoAjuste(ajuste) : classe.tipo
      const padrao = classe.tipo === 'estudo' ? destino(classe, ctx) : {}
      const efetivo = tipo === 'estudo' ? destino(classe, ctx, materiaDoAjuste(ajuste)) : {}
      grupo = {
        ...classe,
        ...efetivo,
        tipo,
        tipoPadrao: classe.tipo,
        materiaPadrao: padrao.materiaId,
        ms: 0,
        titulos: [],
        porTitulo: new Map(),
      }
      grupos.set(classe.chave, grupo)
    }
    grupo.ms += ms
    if (!t.semCaptura) {
      const titulo = t.titulo || '(sem título)'
      grupo.porTitulo.set(titulo, (grupo.porTitulo.get(titulo) ?? 0) + ms)
    }
    const ultima = faixas.at(-1)
    if (ultima && ultima.tipo === grupo.tipo) ultima.ms += ms
    else faixas.push({ tipo: grupo.tipo, ms })
  }

  const lista = [...grupos.values()]
    .map(({ porTitulo, ...g }) => ({
      ...g,
      titulos: [...porTitulo].map(([titulo, ms]) => ({ titulo, ms })).sort((a, b) => b.ms - a.ms),
    }))
    .sort((a, b) => b.ms - a.ms)

  const soma = (tipo: Tipo) => lista.filter((g) => g.tipo === tipo).reduce((s, g) => s + g.ms, 0)
  const porMateria: Record<string, number> = {}
  const porObjetivo: Record<string, number> = {}
  let semObjetivoMs = 0
  for (const g of lista) {
    if (g.tipo !== 'estudo') continue
    if (g.materiaId) porMateria[g.materiaId] = (porMateria[g.materiaId] ?? 0) + g.ms
    if (g.objetivoId) porObjetivo[g.objetivoId] = (porObjetivo[g.objetivoId] ?? 0) + g.ms
    if (!g.materiaId && !g.objetivoId) semObjetivoMs += g.ms
  }
  const focoMs = soma('estudo')
  const foraMs = soma('fora')
  const ignoradoMs = soma('ignorar')
  return {
    focoMs,
    foraMs,
    ignoradoMs,
    totalMs: focoMs + foraMs + ignoradoMs,
    grupos: lista,
    faixas,
    saidas: faixas.filter((f) => f.tipo === 'fora').length,
    maiorTrechoMs: Math.max(0, ...faixas.filter((f) => f.tipo === 'estudo').map((f) => f.ms)),
    porMateria,
    porObjetivo,
    semObjetivoMs,
  }
}

/** A evidência própria de uma sessão: texto ou imagem. */
export const temAnotacao = (s: Pick<Sessao, 'anotacao' | 'imagens'>) => s.anotacao.trim() !== '' || s.imagens.length > 0

/** % do tempo em estudo, entre estudo e fora (o ignorado não entra na conta). */
export const taxaDeFoco = (focoMs: number, foraMs: number) => (focoMs + foraMs > 0 ? focoMs / (focoMs + foraMs) : 0)

/** Só as correções que mudam algo em relação à classificação (é o que fica salvo). */
export function ajustesMudados(grupos: Grupo[], ajustes: Record<string, Ajuste>): Record<string, Ajuste> {
  return Object.fromEntries(
    Object.entries(ajustes).filter(([chave, ajuste]) => {
      const g = grupos.find((x) => x.chave === chave)
      if (!g) return false
      const materia = materiaDoAjuste(ajuste)
      if (materia) return !(g.tipoPadrao === 'estudo' && g.materiaPadrao === materia)
      return g.tipoPadrao !== ajuste
    }),
  )
}

/** Os números que ficam guardados na sessão, para o banco não mudar quando as regras mudarem. */
export function totaisDaSessao(resumo: Resumo): Pick<Sessao, 'focoMs' | 'foraMs' | 'focoPorMateria' | 'semObjetivoMs'> {
  return { focoMs: resumo.focoMs, foraMs: resumo.foraMs, focoPorMateria: resumo.porMateria, semObjetivoMs: resumo.semObjetivoMs }
}
