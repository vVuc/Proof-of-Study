import { deISO, type DataISO } from '@/shared/lib/datas'
import type { Ajuste, Dados, Objetivo, Sessao } from '@/store/model/dados'
import type { SessaoDoRust } from '@/features/sessao/api/rastreio'
import {
  contemPalavra,
  normalizar,
  ordenarRegras,
  termosDaMateria,
  termosDoObjetivo,
  type ContextoClassificacao,
} from '@/features/sessao/utils/classificacao'
import { resumir, totaisDaSessao } from '@/features/sessao/utils/resumo'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { intervalosDeTrabalho } from '@/features/rotina/utils/expediente'

/** Os objetivos do dia que valem (sem os pulados), na ordem da tela. */
export const objetivosDoDia = (dados: Pick<Dados, 'objetivos'>, dia: DataISO) =>
  dados.objetivos.filter((o) => o.dia === dia && !o.pulado).sort((a, b) => a.ordem - b.ordem)

/** O que classifica as janelas de um dia: as regras, as matérias, os objetivos e o horário de trabalho daquele dia. */
export const contextoDoDia = (dados: Dados, dia: DataISO): ContextoClassificacao => ({
  regras: dados.regras,
  materias: dados.materias,
  objetivos: objetivosDoDia(dados, dia),
  expediente: intervalosDeTrabalho(dados.blocos, dia, dados.preferencias.inicioDoDiaMin),
})

/** As correções do dia, feitas no relato final. */
export const ajustesDoDia = (dados: Pick<Dados, 'relatos'>, dia: DataISO): Record<string, Ajuste> =>
  relatoDoDia(dados.relatos, dia, 'final')?.ajustes ?? {}

export const sessoesDoDia = (dados: Pick<Dados, 'sessoes'>, dia: DataISO) =>
  dados.sessoes.filter((s) => s.dia === dia).sort((a, b) => a.inicio - b.inicio)

/** Nome do objetivo: o título livre ou o nome da matéria. */
export const nomeDoObjetivo = (dados: Pick<Dados, 'materias'>, o: Objetivo) =>
  o.titulo || dados.materias.find((m) => m.id === o.materiaId)?.nome || 'Objetivo'

/**
 * Objetivos que a rotina sugere para o dia e que ainda não existem: um por item de estudo daquele dia da semana
 * (com ou sem horário). Os já criados (ou pulados) não voltam.
 */
export function objetivosDaRotina(dados: Dados, dia: DataISO): Objetivo[] {
  const semana = deISO(dia).getDay()
  const doDia = dados.objetivos.filter((o) => o.dia === dia)
  let ordem = doDia.reduce((maior, o) => Math.max(maior, o.ordem + 1), 0)
  const novos: Objetivo[] = []
  for (const item of dados.blocos) {
    if (item.categoria !== 'estudo' || !item.dias.includes(semana)) continue
    if (doDia.some((o) => o.itemId === item.id)) continue
    const materia = dados.materias.find((m) => m.id === item.materiaId && !m.arquivada)
    // Dois itens da mesma matéria no dia (manhã e noite) são um objetivo só; pulado, não volta por outro item.
    if (materia && [...doDia, ...novos].some((o) => o.materiaId === materia.id)) continue
    novos.push({
      id: crypto.randomUUID(),
      dia,
      materiaId: materia?.id,
      titulo: materia ? undefined : item.titulo,
      origem: 'rotina',
      itemId: item.id,
      ordem: ordem++,
    })
  }
  return novos
}

/** Objetivos que o relato inicial cita e que ainda não estão no dia: matérias pelo nome ou por um termo. */
export function sugerirObjetivos(texto: string, dados: Dados, dia: DataISO): Objetivo[] {
  const alvo = normalizar(texto)
  const doDia = dados.objetivos.filter((o) => o.dia === dia)
  let ordem = doDia.reduce((maior, o) => Math.max(maior, o.ordem + 1), 0)
  return dados.materias
    .filter((m) => !m.arquivada && termosDaMateria(m).some((t) => contemPalavra(alvo, t)))
    .filter((m) => !doDia.some((o) => o.materiaId === m.id && !o.pulado))
    .map((m) => ({ id: crypto.randomUUID(), dia, materiaId: m.id, origem: 'relato' as const, ordem: ordem++ }))
}

/** Os termos que o Rust usa para não avisar distração em janelas de estudo: matérias e objetivos do dia. */
export function termosDoDia(dados: Dados, dia: DataISO): string[] {
  const termos = [
    ...dados.materias.filter((m) => !m.arquivada).flatMap(termosDaMateria),
    ...objetivosDoDia(dados, dia).flatMap(termosDoObjetivo),
  ]
  return [...new Set(termos)]
}

/** Configuração da sessão para o Rust, a partir das preferências e do que classifica o dia. */
export function configuracaoDoRastreio(dados: Dados, dia: DataISO) {
  const p = dados.preferencias
  return {
    limiteAusenciaSeg: p.limiteAusenciaMin * 60,
    ausenciaLongaSeg: p.ausenciaLongaMin * 60,
    avisoDistracaoSeg: p.avisoDistracao ? p.avisoDistracaoSeg : null,
    cicloSeg: p.cicloMin ? p.cicloMin * 60 : null,
    regras: ordenarRegras(dados.regras).map(({ rotulo, termos, campo, tipo }) => ({ rotulo, termos, campo, tipo })),
    termos: termosDoDia(dados, dia),
    inicioDoDiaMin: p.inicioDoDiaMin,
  }
}

/** A sessão fechada pelo Rust como fica no `dados.json`, com os totais calculados pelas regras e correções do dia. */
export function sessaoParaGravar(rust: SessaoDoRust, dados: Dados): Sessao {
  const ajustes = ajustesDoDia(dados, rust.dia)
  const resumo = resumir(rust.trechos, contextoDoDia(dados, rust.dia), ajustes)
  return {
    id: rust.id,
    dia: rust.dia,
    inicio: rust.inicio,
    fim: rust.fim,
    pausas: rust.pausas,
    trechos: rust.trechos,
    ajustes,
    ...totaisDaSessao(resumo),
    anotacao: '',
    imagens: [],
  }
}

/** Recalcula os totais das sessões de um dia (depois de o relato final corrigir a atribuição). */
export function recalcularDia(dados: Dados, dia: DataISO): Sessao[] {
  const ajustes = ajustesDoDia(dados, dia)
  const contexto = contextoDoDia(dados, dia)
  return sessoesDoDia(dados, dia)
    .filter((s) => !s.materiaId) // Sessões antigas (um pomodoro de uma matéria) ficam como estavam.
    .map((s) => ({ ...s, ajustes, ...totaisDaSessao(resumir(s.trechos, contexto, ajustes)) }))
}
