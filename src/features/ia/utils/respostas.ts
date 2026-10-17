import type { DataISO } from '@/shared/lib/datas'
import type { Ajuste, Dados, Objetivo, SugestaoIA } from '@/store/model/dados'
import { nomeDoObjetivo, objetivosDoDia } from '@/features/hoje/utils/dia'
import { normalizar } from '@/features/sessao/utils/classificacao'
import { TIPOS_DA_SUGESTAO, type MapaIds } from './prompts'

const MAX_MOTIVO = 140

type Objeto = Record<string, unknown>

const ehObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v)

function lerJSON(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

/** O id curto de volta para o do app; um id que a entrada não tinha dá `undefined`. */
const traduzir = (ids: Record<string, string>, curto: unknown) => (typeof curto === 'string' && Object.hasOwn(ids, curto) ? ids[curto] : undefined)

/** Uma sugestão válida: grupo e matéria da entrada e tipo do enum. Qualquer outra coisa sai (INSD-13). */
function lerSugestao(s: unknown, mapa: MapaIds): SugestaoIA | null {
  if (!ehObjeto(s)) return null
  const chave = traduzir(mapa.grupos, s.grupo)
  const tipo = TIPOS_DA_SUGESTAO.find((t) => t === s.tipo)
  if (!chave || !tipo) return null
  let ajuste: Ajuste = tipo
  if (tipo === 'estudo' && typeof s.materia === 'string' && s.materia !== '') {
    const materiaId = traduzir(mapa.materias, s.materia)
    if (!materiaId) return null
    ajuste = `materia:${materiaId}`
  }
  const motivo = typeof s.motivo === 'string' ? Array.from(s.motivo.trim()).slice(0, MAX_MOTIVO).join('') : ''
  return { chave, ajuste, motivo }
}

/**
 * A resposta do insight do dia: o texto e as sugestões válidas, uma por grupo. `null` se o JSON não fechar ou vier
 * sem texto (a tela mostra "A resposta do Gemini veio incompleta").
 */
export function lerRespostaDoDia(texto: string, mapa: MapaIds): { texto: string; sugestoes: SugestaoIA[] } | null {
  const json = lerJSON(texto)
  if (!ehObjeto(json) || typeof json.texto !== 'string' || !json.texto.trim()) return null
  const sugestoes: SugestaoIA[] = []
  for (const s of Array.isArray(json.sugestoes) ? json.sugestoes : []) {
    const sugestao = lerSugestao(s, mapa)
    if (sugestao && !sugestoes.some((x) => x.chave === sugestao.chave)) sugestoes.push(sugestao)
  }
  return { texto: json.texto.trim(), sugestoes }
}

/** O texto sem espaços nas pontas; o que não é texto vira vazio. */
const limpo = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * A resposta do plano do dia: os objetivos novos, com `origem: 'relato'`. Matéria que não existe vira estudo com título
 * livre (PLANO-02), tipo que não é estudo nem trabalho sai (PLANO-03), e matéria ou nome que o dia já tem não duplica,
 * sem diferenciar acento e caixa (PLANO-04). `null` se o JSON não fechar.
 */
export function lerRespostaDoPlano(resposta: string, mapa: MapaIds, dados: Dados, dia: DataISO): Objetivo[] | null {
  const json = lerJSON(resposta)
  if (!ehObjeto(json) || !Array.isArray(json.objetivos)) return null
  const doDia = objetivosDoDia(dados, dia)
  const nome = (o: Objetivo) => normalizar(nomeDoObjetivo(dados, o).trim())
  let ordem = dados.objetivos.filter((o) => o.dia === dia).reduce((maior, o) => Math.max(maior, o.ordem + 1), 0)
  const novos: Objetivo[] = []
  for (const item of json.objetivos) {
    if (!ehObjeto(item) || (item.tipo !== 'estudo' && item.tipo !== 'trabalho')) continue
    const materiaId = item.tipo === 'estudo' ? traduzir(mapa.materias, item.materia) : undefined
    // Sem matéria conhecida, o título livre; na falta dele, o nome da matéria citada (não um id curto como "m9").
    const citada = limpo(item.materia)
    const titulo = materiaId ? '' : limpo(item.titulo) || (item.tipo === 'estudo' && !/^m\d+$/.test(citada) ? citada : '')
    if (!materiaId && !titulo) continue
    const termos = Array.isArray(item.termos) ? item.termos.map(limpo).filter(Boolean) : []
    const objetivo: Objetivo = {
      id: crypto.randomUUID(),
      dia,
      materiaId,
      titulo: titulo || undefined,
      termos: termos.length ? termos : undefined,
      origem: 'relato',
      tipo: item.tipo,
      ordem,
    }
    const repetido = [...doDia, ...novos].some((o) => (materiaId && o.materiaId === materiaId) || nome(o) === nome(objetivo))
    if (repetido) continue
    novos.push(objetivo)
    ordem++
  }
  return novos
}
