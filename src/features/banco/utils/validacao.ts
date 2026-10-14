import { inicioDoDiaLogico, somarDias, type DataISO } from '@/shared/lib/datas'
import type { Dados, Relato, Sessao } from '@/store/model/dados'
import { temAnotacao } from '@/features/sessao/utils/resumo'

/** O relato de um momento do dia, se houver. */
export const relatoDoDia = (relatos: Relato[], dia: DataISO, momento: Relato['momento']) =>
  relatos.find((r) => r.dia === dia && r.momento === momento)

/** Até quando o relato final valida o dia: o fim do dia lógico seguinte. */
export const prazoDoRelato = (dia: DataISO, inicioDoDiaMin: number) => inicioDoDiaLogico(somarDias(dia, 2), inicioDoDiaMin)

/** O relato final de um dia valida as horas dele: tem texto e foi feito até o fim do dia seguinte. */
export function diaValidado(dados: Pick<Dados, 'relatos' | 'preferencias'>, dia: DataISO): boolean {
  const relato = relatoDoDia(dados.relatos, dia, 'final')
  return !!relato && relato.texto.trim() !== '' && relato.criadoEm < prazoDoRelato(dia, dados.preferencias.inicioDoDiaMin)
}

/** O tempo da sessão entra no banco com o relato final do dia ou com a anotação própria (texto ou imagem). */
export const sessaoValidada = (dados: Pick<Dados, 'relatos' | 'preferencias'>, s: Sessao) => temAnotacao(s) || diaValidado(dados, s.dia)

/** Estudo da matéria na sessão (validado ou não). */
export const focoDaMateria = (s: Sessao, materiaId: string) => s.focoPorMateria[materiaId] ?? 0

/** Estudo da matéria que entrou no banco. */
export const focoNoBanco = (dados: Pick<Dados, 'relatos' | 'preferencias'>, s: Sessao, materiaId: string) =>
  sessaoValidada(dados, s) ? focoDaMateria(s, materiaId) : 0

/** Todo o estudo da sessão que entrou no banco, somando as matérias. */
export const focoNoBancoTotal = (dados: Pick<Dados, 'relatos' | 'preferencias'>, s: Sessao) =>
  sessaoValidada(dados, s) ? Object.values(s.focoPorMateria).reduce((a, b) => a + b, 0) : 0
