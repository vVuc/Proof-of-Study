import type { DataISO } from '@/shared/lib/datas'
import type { Dados, MotivoPausa, Sessao, Tipo, Trecho } from '@/store/model/dados'
import { contextoDoDia, objetivosDoDia } from '@/features/hoje/utils/dia'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { classificar } from '@/features/sessao/utils/classificacao'
import { dividirPorExpediente } from '@/features/rotina/utils/expediente'
import { tipoDoAjuste } from '@/features/sessao/utils/resumo'

/**
 * Autoanálise sem IA: estatística simples sobre as sessões, as pausas e os relatos. Tudo descreve o que
 * aconteceu; nada aqui julga. O texto da tela tira as conclusões em linguagem neutra.
 */

const HORA = 3_600_000
const MIN = 60_000

/** Trechos seguidos separados por menos que isso contam como contínuos. */
const EMENDA_MS = 2_000

export interface TrechoClassificado {
  inicio: number
  fim: number
  tipo: Tipo
  /** Grupo da janela (o rótulo da regra, do site ou do app). */
  rotulo: string
}

/** Cada trecho de uma sessão, cortado nas bordas do horário de trabalho, com o tipo que valeu no dia. */
export function classificarSessao(dados: Dados, s: Sessao): TrechoClassificado[] {
  const contexto = contextoDoDia(dados, s.dia)
  return dividirPorExpediente(s.trechos, contexto.expediente ?? []).map((t: Trecho) => {
    const classe = classificar(t, contexto)
    const ajuste = classe.fixo ? undefined : s.ajustes[classe.chave]
    return { inicio: t.inicio, fim: t.fim, tipo: ajuste ? tipoDoAjuste(ajuste) : classe.tipo, rotulo: classe.rotulo }
  })
}

export interface CelulaHora {
  focoMs: number
  foraMs: number
}

/** Foco e fora por dia da semana (0 = domingo) e hora do dia, para o mapa "quando você rende". Trabalho e ignorado ficam de fora. */
export function focoPorHora(trechos: TrechoClassificado[]): CelulaHora[][] {
  const mapa = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ focoMs: 0, foraMs: 0 })))
  for (const t of trechos) {
    if (t.tipo === 'ignorar' || t.tipo === 'trabalho') continue
    // Um trecho que atravessa a hora cheia é dividido entre as horas.
    for (let inicio = t.inicio; inicio < t.fim; ) {
      const data = new Date(inicio)
      const proximaHora = new Date(data.getFullYear(), data.getMonth(), data.getDate(), data.getHours() + 1).getTime()
      const fim = Math.min(t.fim, proximaHora)
      const celula = mapa[data.getDay()][data.getHours()]
      if (t.tipo === 'estudo') celula.focoMs += fim - inicio
      else celula.foraMs += fim - inicio
      inicio = fim
    }
  }
  return mapa
}

export interface Distracao {
  rotulo: string
  ms: number
  /** Hora do dia em que mais aparece. */
  horaPico: number
}

/** O que mais tirou do estudo, somado por grupo de janela (fora do estudo, sem contar ausência). */
export function principaisDistracoes(trechos: TrechoClassificado[], limite = 5): Distracao[] {
  const grupos = new Map<string, { ms: number; porHora: number[] }>()
  for (const t of trechos) {
    if (t.tipo !== 'fora' || t.rotulo === 'Ausente do PC') continue
    const g = grupos.get(t.rotulo) ?? { ms: 0, porHora: Array<number>(24).fill(0) }
    g.ms += t.fim - t.inicio
    g.porHora[new Date(t.inicio).getHours()] += t.fim - t.inicio
    grupos.set(t.rotulo, g)
  }
  return [...grupos]
    .map(([rotulo, g]) => ({ rotulo, ms: g.ms, horaPico: g.porHora.indexOf(Math.max(...g.porHora)) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limite)
}

/**
 * Durações dos blocos de foco contínuo: estudo seguido, até uma distração, uma troca para trabalho, uma pausa ou um
 * buraco no registro.
 */
export function blocosDeFoco(trechos: TrechoClassificado[]): number[] {
  const blocos: number[] = []
  let atual = 0
  let ultimoFim = -Infinity
  const fechar = () => {
    if (atual > 0) blocos.push(atual)
    atual = 0
  }
  for (const t of trechos) {
    // Um buraco no registro (pausa, captura parada) encerra o bloco; janela ignorada não encerra nem soma.
    if (t.inicio - ultimoFim > EMENDA_MS) fechar()
    if (t.tipo === 'estudo') atual += t.fim - t.inicio
    else if (t.tipo === 'fora' || t.tipo === 'trabalho') fechar()
    ultimoFim = t.fim
  }
  fechar()
  return blocos.filter((ms) => ms >= MIN)
}

/** Quanto tempo depois de começar (o play ou a volta de uma pausa) aparece a primeira janela fora do estudo. */
export function temposAteDistrair(trechos: TrechoClassificado[], comecos: number[]): number[] {
  const tempos: number[] = []
  for (const comeco of comecos) {
    const proximoComeco = comecos.filter((c) => c > comeco).reduce((menor, c) => Math.min(menor, c), Infinity)
    const primeira = trechos.find((t) => t.tipo === 'fora' && t.rotulo !== 'Ausente do PC' && t.inicio >= comeco && t.inicio < proximoComeco)
    if (primeira) tempos.push(primeira.inicio - comeco)
  }
  return tempos
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2
}

export interface ResumoPausas {
  quantidade: number
  totalMs: number
  porMotivo: Record<MotivoPausa, { quantidade: number; ms: number }>
}

export function resumoDasPausas(sessoes: Sessao[]): ResumoPausas {
  const porMotivo: ResumoPausas['porMotivo'] = {
    manual: { quantidade: 0, ms: 0 },
    ausencia: { quantidade: 0, ms: 0 },
    suspensao: { quantidade: 0, ms: 0 },
    desligado: { quantidade: 0, ms: 0 },
  }
  for (const p of sessoes.flatMap((s) => s.pausas)) {
    porMotivo[p.motivo].quantidade++
    porMotivo[p.motivo].ms += p.fim - p.inicio
  }
  const lista = Object.values(porMotivo)
  return { quantidade: lista.reduce((s, x) => s + x.quantidade, 0), totalMs: lista.reduce((s, x) => s + x.ms, 0), porMotivo }
}

export interface LinhaDoDia {
  dia: DataISO
  /** Estudo efetivo (o que foi estudo de fato). */
  focoMs: number
  foraMs: number
  /** Tempo de trabalho do dia, à parte do estudo e do fora. */
  trabalhoMs: number
  /** Todo o tempo registrado (estudo, trabalho, fora e ignorado). */
  registradoMs: number
  humor?: number
  /** Matérias planejadas (objetivos do dia) que receberam estudo, e as que não receberam. */
  planejadasComTempo: string[]
  planejadasSemTempo: string[]
  /** Matérias estudadas que não eram objetivo do dia (redirecionamento, sem tom de falha). */
  foraDoPlano: string[]
}

/** Uma linha por dia com sessão: qualidade × quantidade, planejado × realizado e o humor do relato final. */
export function linhasPorDia(dados: Dados, sessoes: Sessao[]): LinhaDoDia[] {
  const dias = [...new Set(sessoes.map((s) => s.dia))].sort()
  return dias.map((dia) => {
    const doDia = sessoes.filter((s) => s.dia === dia)
    const porMateria: Record<string, number> = {}
    for (const s of doDia) for (const [id, ms] of Object.entries(s.focoPorMateria)) porMateria[id] = (porMateria[id] ?? 0) + ms
    const planejadas = [...new Set(objetivosDoDia(dados, dia).map((o) => o.materiaId).filter((id): id is string => !!id))]
    const estudadas = Object.keys(porMateria).filter((id) => porMateria[id] >= MIN)
    const focoMs = doDia.reduce((s, x) => s + x.focoMs, 0)
    const foraMs = doDia.reduce((s, x) => s + x.foraMs, 0)
    const trabalhoMs = doDia.reduce((s, x) => s + x.trabalhoMs, 0)
    const registradoMs = doDia.reduce((s, x) => s + x.trechos.reduce((t, y) => t + (y.fim - y.inicio), 0), 0)
    return {
      dia,
      focoMs,
      foraMs,
      trabalhoMs,
      registradoMs,
      humor: relatoDoDia(dados.relatos, dia, 'final')?.humor,
      planejadasComTempo: planejadas.filter((id) => estudadas.includes(id)),
      planejadasSemTempo: planejadas.filter((id) => !estudadas.includes(id)),
      foraDoPlano: estudadas.filter((id) => !planejadas.includes(id)),
    }
  })
}

/** Foco médio dos dias com humor alto (4 e 5) e baixo (1 e 2), quando há dias dos dois lados. */
export function focoPorHumor(linhas: LinhaDoDia[]): { alto: number; baixo: number } | null {
  const media = (l: LinhaDoDia[]) => l.reduce((s, x) => s + x.focoMs, 0) / l.length
  const alto = linhas.filter((l) => (l.humor ?? 0) >= 4)
  const baixo = linhas.filter((l) => l.humor !== undefined && l.humor <= 2)
  return alto.length && baixo.length ? { alto: media(alto), baixo: media(baixo) } : null
}

export interface Autoanalise {
  dias: number
  mapa: CelulaHora[][]
  distracoes: Distracao[]
  /** Mediana do tempo até a primeira distração depois de começar. */
  ateDistrairMs: number | null
  /** Mediana dos blocos de foco contínuo (o "pomodoro involuntário"). */
  blocoTipicoMs: number | null
  blocos: number[]
  pausas: ResumoPausas
  linhas: LinhaDoDia[]
  humor: { alto: number; baixo: number } | null
}

/** Tudo da tela Autoanálise, a partir das sessões dos dias escolhidos. */
export function autoanalise(dados: Dados, dias: DataISO[]): Autoanalise {
  const conjunto = new Set(dias)
  const sessoes = dados.sessoes.filter((s) => conjunto.has(s.dia)).sort((a, b) => a.inicio - b.inicio)
  const porSessao = sessoes.map((s) => ({ s, trechos: classificarSessao(dados, s) }))
  const todos = porSessao.flatMap((x) => x.trechos)
  const blocos = porSessao.flatMap((x) => blocosDeFoco(x.trechos))
  const ateDistrair = porSessao.flatMap(({ s, trechos }) => temposAteDistrair(trechos, [s.inicio, ...s.pausas.map((p) => p.fim)]))
  const linhas = linhasPorDia(dados, sessoes)
  return {
    dias: linhas.length,
    mapa: focoPorHora(todos),
    distracoes: principaisDistracoes(todos),
    ateDistrairMs: mediana(ateDistrair),
    blocoTipicoMs: mediana(blocos),
    blocos,
    pausas: resumoDasPausas(sessoes),
    linhas,
    humor: focoPorHumor(linhas),
  }
}

export { HORA, MIN }
