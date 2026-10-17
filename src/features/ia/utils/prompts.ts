import { deISO, formatarHora, formatarHorario, inicioDaSemana, type DataISO } from '@/shared/lib/datas'
import { temHorario, type Ajuste, type Dados, type Pausa, type Trecho } from '@/store/model/dados'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { contextoDoDia, objetivosDoDia, sessoesDoDia } from '@/features/hoje/utils/dia'
import { resumir } from '@/features/sessao/utils/resumo'
import type { PedidoIA } from '../api/ia'
import { gruposParaPrompt } from './linha-do-tempo'

/** Os ids curtos que a IA vê, de volta para os do app. A IA nunca vê os UUIDs. */
export interface MapaIds {
  /** `g1` → a chave do grupo de janelas. */
  grupos: Record<string, string>
  /** `m1` → o id da matéria. */
  materias: Record<string, string>
}

/** O tom comum dos insights do dia e da semana (INSD-09, INSS-06). */
export const REGRAS_DE_TOM =
  'Escreva em português do Brasil, com tom neutro e descritivo, sem julgamento. ' +
  'Não use as palavras "perdido", "fracasso" e "falha", nem equivalentes como "desperdiçado", "fracassou" ou "falhou".'

export const TIPOS_DA_SUGESTAO = ['estudo', 'trabalho', 'fora', 'ignorar'] as const

const SISTEMA_DO_DIA = `Você analisa o dia de uma pessoa que estuda e trabalha no mesmo computador. A entrada é um JSON com o contexto que ela escreveu ("sobreVoce"), as matérias (ids m1, m2…), as metas da semana, o plano do dia, os objetivos do dia, os itens da Rotina com horário, os totais, os grupos de janelas (ids g1, g2…, com o tipo atual e os intervalos) e as pausas.

1. Em "sugestoes", diga como cada grupo de "grupos" deve contar: "estudo" (com "materia" igual ao id de uma matéria, ou null), "trabalho", "fora" (fora do estudo, o que inclui a diversão) ou "ignorar". Use o plano, os objetivos, a Rotina e o "sobreVoce". Em "motivo", justifique em até 140 caracteres. Use só os ids de grupo e de matéria da entrada.
2. Em "texto", escreva o insight do dia: quanto foi estudo, trabalho e diversão (fora do estudo) e como o dia se compara com o plano e os objetivos.

${REGRAS_DE_TOM}`

const ESQUEMA_DO_DIA = {
  type: 'object',
  properties: {
    texto: { type: 'string' },
    sugestoes: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        properties: {
          grupo: { type: 'string' },
          tipo: { type: 'string', enum: [...TIPOS_DA_SUGESTAO] },
          materia: { type: ['string', 'null'] },
          motivo: { type: 'string' },
        },
        required: ['grupo', 'tipo', 'materia', 'motivo'],
      },
    },
  },
  required: ['texto', 'sugestoes'],
}

const minutos = (ms: number) => Math.round(ms / 60_000)

/** As matérias ativas com os ids curtos `m1…`, e o mapa de volta. */
function materiasComIds(dados: Pick<Dados, 'materias'>) {
  const ativas = dados.materias.filter((m) => !m.arquivada)
  const curto = new Map(ativas.map((m, i) => [m.id, `m${i + 1}`]))
  return {
    lista: ativas.map((m) => ({ id: curto.get(m.id)!, nome: m.nome, termos: m.termos ?? [] })),
    curto: (id: string | undefined) => (id ? (curto.get(id) ?? null) : null),
    mapa: Object.fromEntries(ativas.map((m) => [curto.get(m.id)!, m.id])),
  }
}

/**
 * O pedido do insight do dia (INSD-02): o "Sobre você", as matérias, as metas da semana, o plano e os objetivos do dia,
 * os itens da Rotina com horário daquele dia, os grupos de janelas com o tipo atual e as pausas. `aberta` traz os
 * trechos e as pausas da sessão ainda aberta do dia, que não estão nos dados.
 */
export function montarPedidoDoDia(
  dados: Dados,
  dia: DataISO,
  ajustes: Record<string, Ajuste>,
  aberta: { trechos: Trecho[]; pausas: Pausa[] } = { trechos: [], pausas: [] },
): { pedido: PedidoIA; mapa: MapaIds } {
  const materias = materiasComIds(dados)
  const sessoes = sessoesDoDia(dados, dia)
  const trechos = [...sessoes.flatMap((s) => s.trechos), ...aberta.trechos]
  const pausas = [...sessoes.flatMap((s) => s.pausas), ...aberta.pausas].sort((a, b) => a.inicio - b.inicio)
  const contexto = contextoDoDia(dados, dia)
  const linha = gruposParaPrompt(trechos, contexto, ajustes)
  const resumo = resumir(trechos, contexto, ajustes)
  const semana = inicioDaSemana(deISO(dia))
  const diaDaSemana = deISO(dia).getDay()

  const entrada = {
    dia,
    sobreVoce: dados.preferencias.sobreVoce,
    materias: materias.lista,
    metasDaSemana: dados.metas
      .filter((m) => m.semana === semana && materias.curto(m.materiaId))
      .map((m) => ({ materia: materias.curto(m.materiaId), minutos: m.minutos, etapa: m.descricao })),
    planoDoDia: relatoDoDia(dados.relatos, dia, 'inicial')?.texto || null,
    objetivos: objetivosDoDia(dados, dia).map((o) => ({
      tipo: o.tipo ?? 'estudo',
      materia: materias.curto(o.materiaId),
      titulo: o.titulo ?? null,
      termos: o.termos ?? [],
    })),
    rotina: dados.blocos
      .filter(temHorario)
      .filter((b) => b.dias.includes(diaDaSemana))
      .sort((a, b) => a.inicio - b.inicio)
      .map((b) => ({ titulo: b.titulo, categoria: b.categoria, inicio: formatarHorario(b.inicio), fim: formatarHorario(b.fim) })),
    totais: { estudoMin: minutos(resumo.focoMs), trabalhoMin: minutos(resumo.trabalhoMs), foraMin: minutos(resumo.foraMs) },
    grupos: linha.grupos.map(({ materiaId, ...g }) => ({ ...g, materia: materias.curto(materiaId) })),
    outros: linha.outros,
    pausas: pausas.map((p) => ({ inicio: formatarHora(p.inicio), fim: formatarHora(p.fim), motivo: p.motivo })),
  }

  return {
    pedido: { tipo: 'dia', sistema: SISTEMA_DO_DIA, entrada: JSON.stringify(entrada), esquema: ESQUEMA_DO_DIA },
    mapa: { grupos: linha.chaves, materias: materias.mapa },
  }
}

const SISTEMA_DO_PLANO = `Você monta os objetivos do dia de uma pessoa a partir do plano que ela escreveu ou falou. A entrada é um JSON com o contexto que ela escreveu ("sobreVoce"), o texto do plano ("plano"), as matérias (ids m1, m2…, com o nome e os termos) e os objetivos que o dia já tem.

Em "objetivos", liste o que o plano pede:
- "estudo": com "materia" igual ao id da matéria de que o plano fala, mesmo sem citar o nome exato, e "titulo" null; sem matéria que sirva, com "materia" null e um "titulo" curto;
- "trabalho": com um "titulo" curto e "materia" null.
Em "termos", ponha as palavras que devem aparecer no título das janelas desse objetivo hoje (o repositório, o arquivo, o site), sem repetir os termos da matéria. Lazer e descanso citados não viram objetivo. Não repita os objetivos que o dia já tem. Escreva os títulos em português do Brasil.`

const ESQUEMA_DO_PLANO = {
  type: 'object',
  properties: {
    objetivos: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['estudo', 'trabalho'] },
          materia: { type: ['string', 'null'] },
          titulo: { type: ['string', 'null'] },
          termos: { type: 'array', items: { type: 'string' } },
        },
        required: ['tipo', 'materia', 'titulo', 'termos'],
      },
    },
  },
  required: ['objetivos'],
}

/** O pedido do plano do dia (PLANO-01): o texto do plano, o "Sobre você", as matérias com os termos e os objetivos que o dia já tem. */
export function montarPedidoDoPlano(dados: Dados, dia: DataISO, texto: string): { pedido: PedidoIA; mapa: MapaIds } {
  const materias = materiasComIds(dados)
  const entrada = {
    dia,
    sobreVoce: dados.preferencias.sobreVoce,
    plano: texto,
    materias: materias.lista,
    objetivosDoDia: objetivosDoDia(dados, dia).map((o) => ({ tipo: o.tipo ?? 'estudo', materia: materias.curto(o.materiaId), titulo: o.titulo ?? null })),
  }
  return {
    pedido: { tipo: 'plano', sistema: SISTEMA_DO_PLANO, entrada: JSON.stringify(entrada), esquema: ESQUEMA_DO_PLANO },
    mapa: { grupos: {}, materias: materias.mapa },
  }
}
