import type { Regra, Sessao, Tipo } from '@/store/model/dados'
import { classificar } from '@/features/sessao/utils/classificacao'
import { taxaDeFoco } from '@/features/sessao/utils/resumo'

/** Até esse intervalo entre dois trechos, é o mesmo bloco seguido (a leitura é de segundo em segundo). */
const EMENDA_MS = 60_000

type SessaoDoDia = Pick<Sessao, 'materiaId' | 'trechos'> & { ajustes?: Sessao['ajustes'] }

/** Pedaço do calendário do dia: tempo seguido do mesmo objetivo e do mesmo tipo. */
export interface BlocoDoDia {
  materiaId: string
  tipo: Tipo
  inicio: number
  fim: number
  /** Rótulo do grupo mais longo do bloco (ex.: "YouTube"). */
  rotulo: string
}

/** Tempo seguido num objetivo, entre duas pausas (ou paradas por inatividade). */
export interface Corrida {
  inicio: number
  fim: number
}

export interface LinhaObjetivo {
  materiaId: string
  focoMs: number
  foraMs: number
  /** Blocos fora do estudo, com horário, para ver quando a atenção saiu. */
  saidas: BlocoDoDia[]
  /** O ritmo: blocos entre pausas ("pomodoros involuntários"). */
  corridas: Corrida[]
}

export interface ResumoDoDia {
  focoMs: number
  foraMs: number
  /** Estudo e fora (o ignorado não entra). */
  totalMs: number
  taxa: number
  linhas: LinhaObjetivo[]
  blocos: BlocoDoDia[]
}

/** O dia inteiro por objetivo: foco, fora, quando saiu do estudo e o ritmo entre as pausas. */
export function resumirDia(sessoes: SessaoDoDia[], regras: Regra[]): ResumoDoDia {
  const blocos: (BlocoDoDia & { porRotulo: Map<string, number> })[] = []
  const linhas = new Map<string, LinhaObjetivo>()

  const ordenados = sessoes
    .flatMap((s) => s.trechos.map((t) => ({ t, s })))
    .sort((a, b) => a.t.inicio - b.t.inicio)

  for (const { t, s } of ordenados) {
    const ms = Math.max(0, t.fim - t.inicio)
    if (ms === 0) continue
    const classe = classificar(t, regras)
    const tipo = (!classe.fixo && s.ajustes?.[classe.chave]) || classe.tipo

    let linha = linhas.get(s.materiaId)
    if (!linha) {
      linha = { materiaId: s.materiaId, focoMs: 0, foraMs: 0, saidas: [], corridas: [] }
      linhas.set(s.materiaId, linha)
    }
    if (tipo === 'estudo') linha.focoMs += ms
    if (tipo === 'fora') linha.foraMs += ms
    const corrida = linha.corridas.at(-1)
    if (corrida && t.inicio - corrida.fim <= EMENDA_MS) corrida.fim = Math.max(corrida.fim, t.fim)
    else linha.corridas.push({ inicio: t.inicio, fim: t.fim })

    const ultimo = blocos.at(-1)
    const bloco =
      ultimo && ultimo.materiaId === s.materiaId && ultimo.tipo === tipo && t.inicio - ultimo.fim <= EMENDA_MS
        ? ultimo
        : null
    if (bloco) bloco.fim = Math.max(bloco.fim, t.fim)
    else blocos.push({ materiaId: s.materiaId, tipo, inicio: t.inicio, fim: t.fim, rotulo: classe.rotulo, porRotulo: new Map() })
    const atual = blocos.at(-1)!
    atual.porRotulo.set(classe.rotulo, (atual.porRotulo.get(classe.rotulo) ?? 0) + ms)
  }

  const prontos = blocos.map(({ porRotulo, ...b }) => ({
    ...b,
    rotulo: [...porRotulo].sort((x, y) => y[1] - x[1])[0]?.[0] ?? b.rotulo,
  }))
  for (const b of prontos) if (b.tipo === 'fora') linhas.get(b.materiaId)?.saidas.push(b)

  const lista = [...linhas.values()].sort((a, b) => b.focoMs - a.focoMs)
  const focoMs = lista.reduce((s, l) => s + l.focoMs, 0)
  const foraMs = lista.reduce((s, l) => s + l.foraMs, 0)
  return { focoMs, foraMs, totalMs: focoMs + foraMs, taxa: taxaDeFoco(focoMs, foraMs), linhas: lista, blocos: prontos }
}
