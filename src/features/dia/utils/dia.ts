import { paraISO, type DataISO } from '@/shared/lib/datas'
import { categoriaOcupa, SEM_MATERIA, type BlocoRotina, type Dados, type Dia, type Materia, type Sessao, type Trecho } from '@/store/model/dados'
import { MINUTOS_DIA, segmentosDoDia } from '@/features/rotina/utils/rotina'

export const diaVazio = (data: DataISO): Dia => ({
  data,
  planoFeito: false,
  plano: '',
  objetivos: [],
  extras: [],
  anotacao: '',
  imagens: [],
  complemento: '',
})

export const diaDe = (dias: Dia[], data: DataISO): Dia => dias.find((d) => d.data === data) ?? diaVazio(data)

/** O dia de uma sessão é o do início: o cronômetro para na meia-noite, então ela não passa para o dia seguinte. */
export const dataDaSessao = (s: Pick<Sessao, 'inicio'>) => paraISO(new Date(s.inicio))

/** Tempo que o relógio contou: a soma dos trechos (a inatividade cortada não entra). */
export const duracaoRegistrada = (trechos: Trecho[]) => trechos.reduce((soma, t) => soma + Math.max(0, t.fim - t.inicio), 0)

export const sessoesDoDia = (sessoes: Sessao[], data: DataISO) =>
  sessoes.filter((s) => dataDaSessao(s) === data).sort((a, b) => a.inicio - b.inicio)

/** Relógio de um objetivo no dia: tudo o que já foi registrado nele, para o play continuar de onde parou. */
export const tempoNoDia = (sessoes: Sessao[], materiaId: string, data: DataISO) =>
  sessoesDoDia(sessoes, data)
    .filter((s) => s.materiaId === materiaId)
    .reduce((soma, s) => soma + duracaoRegistrada(s.trechos), 0)

/** O dia validado: com anotação (texto ou imagem), o tempo dele entra no banco de horas. */
export const diaAnotado = (dia: Pick<Dia, 'anotacao' | 'imagens'> | undefined) =>
  !!dia && (dia.anotacao.trim() !== '' || dia.imagens.length > 0)

/** Dias antes de hoje com estudo registrado e sem anotação: ficam "a validar", sem prazo. Do mais recente ao mais antigo. */
export function diasAValidar(dados: Pick<Dados, 'sessoes' | 'dias'>, hoje: DataISO): DataISO[] {
  const datas = new Set(dados.sessoes.filter((s) => s.focoMs > 0).map(dataDaSessao))
  return [...datas]
    .filter((data) => data < hoje && !diaAnotado(dados.dias.find((d) => d.data === data)))
    .sort((a, b) => b.localeCompare(a))
}

export interface Intervalo {
  inicio: number
  fim: number
}

/**
 * Horários livres para estudo num dia da semana (0 = domingo), de `desde` até a meia-noite: o que sobra depois
 * dos compromissos da rotina (trabalho, academia, sono…). Blocos de estudo não tiram tempo.
 */
export function livreNoDia(blocos: BlocoRotina[], dia: number, desde = 8 * 60): { intervalos: Intervalo[]; totalMin: number } {
  const ocupados = segmentosDoDia(blocos, dia)
    .filter((s) => categoriaOcupa(s.bloco.categoria))
    .map((s) => ({ inicio: Math.max(s.inicio, desde), fim: s.fim }))
    .filter((s) => s.fim > s.inicio)
    .sort((a, b) => a.inicio - b.inicio)
  const intervalos: Intervalo[] = []
  let cursor = desde
  for (const o of ocupados) {
    if (o.inicio > cursor) intervalos.push({ inicio: cursor, fim: o.inicio })
    cursor = Math.max(cursor, o.fim)
  }
  if (cursor < MINUTOS_DIA) intervalos.push({ inicio: cursor, fim: MINUTOS_DIA })
  return { intervalos, totalMin: intervalos.reduce((soma, i) => soma + i.fim - i.inicio, 0) }
}

/** Nome do objetivo na tela; a sessão do dia sem matéria aparece como "Estudo sem matéria". */
export function nomeDoObjetivo(materias: Materia[], materiaId: string): string {
  if (materiaId === SEM_MATERIA) return 'Estudo sem matéria'
  return materias.find((m) => m.id === materiaId)?.nome ?? 'Matéria apagada'
}
