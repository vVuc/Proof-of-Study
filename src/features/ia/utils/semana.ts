import { deISO, inicioDaSemana, somarSemanas, type DataISO } from '@/shared/lib/datas'
import type { Dados } from '@/store/model/dados'

/**
 * A semana em que o insight da semana começa: a segunda-feira da última semana completa (de segunda a domingo).
 * A semana de `hoje` ainda não terminou, nem num domingo; a anterior sim.
 */
export const semanaPadrao = (hoje: DataISO): DataISO => somarSemanas(inicioDaSemana(deISO(hoje)), -1)

/** A semana tem alguma sessão ou algum relato (inicial ou final)? Sem nenhum, não há o que analisar (INSS-05). */
export const semanaTemRegistros = (dados: Pick<Dados, 'sessoes' | 'relatos'>, semana: DataISO): boolean =>
  [...dados.sessoes, ...dados.relatos].some((x) => inicioDaSemana(deISO(x.dia)) === semana)
