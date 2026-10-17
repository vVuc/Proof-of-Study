import type { Ajuste, SugestaoIA } from '@/store/model/dados'
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
