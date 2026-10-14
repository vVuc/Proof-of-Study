import { diaLogico } from '@/shared/lib/datas'
import { resumir } from '@/features/sessao/utils/resumo'
import {
  dadosIniciais,
  PREFERENCIAS_PADRAO,
  regrasPadrao,
  VERSAO_DADOS,
  type Ajuste,
  type Dados,
  type Preferencias,
  type Sessao,
  type Tipo,
  type Trecho,
} from './dados'

/** Erro de leitura que não deve gravar nada por cima (ex.: dados de uma versão mais nova do app). */
export class DadosIncompativeis extends Error {}

/** Sessão como foi salva até o formato 2 (um pomodoro de uma matéria) ou já no 3. */
type SessaoSalva = Partial<Sessao> & Pick<Sessao, 'id' | 'inicio' | 'fim' | 'trechos' | 'focoMs' | 'foraMs' | 'anotacao' | 'imagens'>

/** Preferências até o formato 2: o pomodoro tinha duração fixa. */
type PreferenciasSalvas = Partial<Preferencias> & { duracaoMin?: number }

/** Pomodoro em andamento no formato 2. */
interface SessaoAtualV2 {
  id: string
  materiaId: string
  inicio: number
  duracaoMin: number
  trechos: Trecho[]
  imagens: string[]
  anotacao: string
  ajustes?: Record<string, Tipo>
}

export type DadosSalvos = Partial<Omit<Dados, 'sessoes' | 'preferencias'>> & {
  sessoes?: SessaoSalva[]
  preferencias?: PreferenciasSalvas
  sessaoAtual?: SessaoAtualV2 | null
}

function sessaoV3(s: SessaoSalva, inicioDoDiaMin: number, v1: boolean): Sessao {
  const ajustes = (s.ajustes ?? {}) as Record<string, Ajuste | 'foco'>
  return {
    ...s,
    dia: s.dia ?? diaLogico(s.inicio, inicioDoDiaMin),
    pausas: s.pausas ?? [],
    ajustes: v1
      ? Object.fromEntries(Object.entries(ajustes).map(([k, t]) => [k, t === 'foco' ? 'estudo' : t]))
      : (ajustes as Record<string, Ajuste>),
    // Até o formato 2, todo o foco da sessão era da matéria do pomodoro.
    focoPorMateria: s.focoPorMateria ?? (s.materiaId && s.focoMs > 0 ? { [s.materiaId]: s.focoMs } : {}),
    semObjetivoMs: s.semObjetivoMs ?? (s.materiaId ? 0 : s.focoMs),
  }
}

/**
 * Converte o que foi salvo por versões anteriores e completa campos que faltarem. Lança `DadosIncompativeis`
 * para dados de uma versão mais nova, ou se a conversão não fechar a soma de foco (aí nada é gravado por cima).
 */
export function atualizarDados(salvo: DadosSalvos | undefined, versao = VERSAO_DADOS): Dados {
  if (!salvo) return dadosIniciais()
  if (versao > VERSAO_DADOS) {
    throw new DadosIncompativeis(
      `Os dados foram salvos por uma versão mais nova do Proof of Study (formato ${versao}). Atualize o app para abri-los.`,
    )
  }
  const v1 = versao < 2
  const { duracaoMin: _pomodoro, ...preferenciasSalvas } = salvo.preferencias ?? {}
  const preferencias: Preferencias = { ...PREFERENCIAS_PADRAO, ...preferenciasSalvas }
  // As regras da v1 eram só de distração por título; as novas trazem também os apps de estudo.
  const regras = v1 || !salvo.regras ? regrasPadrao() : salvo.regras

  const salvas = salvo.sessoes ?? []
  const sessoes = salvas.map((s) => sessaoV3(s, preferencias.inicioDoDiaMin, v1))
  const focoAntes = salvas.reduce((soma, s) => soma + s.focoMs, 0)
  const focoDepois = sessoes.reduce((soma, s) => soma + s.focoMs, 0)
  if (focoAntes !== focoDepois) throw new DadosIncompativeis('A conversão dos dados não fechou a soma de foco. Nada foi gravado.')

  // Um pomodoro em andamento no formato 2 vira uma sessão salva e pendente (como já acontecia ao reiniciar o app).
  const atual = salvo.sessaoAtual
  if (atual && atual.trechos.length > 0 && !sessoes.some((s) => s.id === atual.id)) {
    const resumo = resumir(atual.trechos, regras, atual.ajustes ?? {})
    sessoes.push(
      sessaoV3(
        {
          id: atual.id,
          materiaId: atual.materiaId,
          inicio: atual.inicio,
          fim: atual.trechos.at(-1)?.fim ?? atual.inicio,
          duracaoPlanejadaMin: atual.duracaoMin,
          trechos: atual.trechos,
          ajustes: atual.ajustes ?? {},
          focoMs: resumo.focoMs,
          foraMs: resumo.foraMs,
          anotacao: atual.anotacao.trim(),
          imagens: atual.imagens,
        },
        preferencias.inicioDoDiaMin,
        false,
      ),
    )
  }

  return {
    materias: salvo.materias ?? [],
    metas: salvo.metas ?? [],
    blocos: salvo.blocos ?? [],
    objetivos: salvo.objetivos ?? [],
    sessoes,
    relatos: salvo.relatos ?? [],
    regras,
    preferencias,
  }
}
