import { formatarHora } from '@/shared/lib/datas'
import type { Ajuste, Tipo, Trecho } from '@/store/model/dados'
import { dividirPorExpediente } from '@/features/rotina/utils/expediente'
import { classificar, nomeDoPrograma, type ContextoClassificacao } from '@/features/sessao/utils/classificacao'
import { resumir } from '@/features/sessao/utils/resumo'

const MIN = 60_000
const MAX_TITULO = 120
const MAX_INTERVALOS = 20

/** Um grupo de janelas como vai para a IA: o id curto no lugar da chave. */
export interface GrupoDoPrompt {
  /** `g1`, `g2`…, do mais longo para o mais curto. */
  id: string
  rotulo: string
  /** O programa que mais apareceu no grupo. */
  programa: string
  /** O título usado por mais tempo, até 120 caracteres. */
  titulo: string
  /** O tipo atual, com a correção do dia. */
  tipo: Tipo
  /** Matéria do estudo (o id interno; o prompt troca pelo id curto). */
  materiaId?: string
  minutos: number
  /** Até 20 intervalos `HH:MM-HH:MM`, em ordem. */
  intervalos: string[]
}

export interface LinhaDoTempo {
  grupos: GrupoDoPrompt[]
  /** Os grupos além do limite, somados numa linha só. */
  outros: { id: 'outros'; minutos: number } | null
  /** Id curto → chave do grupo (`g1` → `regra:<id>`). */
  chaves: Record<string, string>
}

const minutos = (ms: number) => Math.round(ms / MIN)

/** Os mais longos (até 20), de volta na ordem do dia. */
function intervalosDoGrupo(intervalos: [number, number][]): string[] {
  return [...intervalos]
    .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
    .slice(0, MAX_INTERVALOS)
    .sort((a, b) => a[0] - b[0])
    .map(([inicio, fim]) => `${formatarHora(inicio)}-${formatarHora(fim)}`)
}

/**
 * Os grupos de janelas do dia como vão para a IA: sem os fixos (captura pausada, o próprio app) e sem a ausência, do
 * mais longo para o mais curto, com ids curtos `g1…`. Além do `limite`, o resto vira uma linha "outros".
 */
// SPEC_DEVIATION: o design dá `gruposParaPrompt(resumo, limite)`; aqui entram os trechos, o contexto e as correções.
// Reason: o `Grupo` do resumo não guarda o programa nem os intervalos, que só saem dos trechos.
export function gruposParaPrompt(
  trechos: Trecho[],
  contexto: ContextoClassificacao,
  ajustes: Record<string, Ajuste> = {},
  limite = 200,
): LinhaDoTempo {
  const resumo = resumir(trechos, contexto, ajustes)
  const porChave = new Map<string, { programas: Map<string, number>; intervalos: [number, number][] }>()
  for (const t of dividirPorExpediente(trechos, contexto.expediente ?? [])) {
    const { chave } = classificar(t, contexto)
    let info = porChave.get(chave)
    if (!info) {
      info = { programas: new Map(), intervalos: [] }
      porChave.set(chave, info)
    }
    info.programas.set(t.processo, (info.programas.get(t.processo) ?? 0) + (t.fim - t.inicio))
    const ultimo = info.intervalos.at(-1)
    if (ultimo && t.inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], t.fim)
    else info.intervalos.push([t.inicio, t.fim])
  }

  const visiveis = resumo.grupos.filter((g) => !g.fixo && g.chave !== 'ausente')
  const grupos = visiveis.slice(0, limite).map((g, i): GrupoDoPrompt => {
    const info = porChave.get(g.chave)
    const programa = [...(info?.programas ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    return {
      id: `g${i + 1}`,
      rotulo: g.rotulo,
      programa: nomeDoPrograma(programa),
      titulo: Array.from(g.titulos[0]?.titulo ?? '')
        .slice(0, MAX_TITULO)
        .join(''),
      tipo: g.tipo,
      materiaId: g.tipo === 'estudo' ? g.materiaId : undefined,
      minutos: minutos(g.ms),
      intervalos: intervalosDoGrupo(info?.intervalos ?? []),
    }
  })
  const resto = visiveis.slice(limite)
  return {
    grupos,
    outros: resto.length ? { id: 'outros', minutos: minutos(resto.reduce((s, g) => s + g.ms, 0)) } : null,
    chaves: Object.fromEntries(grupos.map((g, i) => [g.id, visiveis[i].chave])),
  }
}
