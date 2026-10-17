import { objetivosDoDia } from '@/features/hoje/utils/dia'
import { mensagemDoErro } from '@/features/ia/constants/mensagens'
import { normalizar } from '@/features/sessao/utils/classificacao'
import type { DataISO } from '@/shared/lib/datas'
import type { Dados } from '@/store/model/dados'

/** O vocabulário próprio da transcrição aceita até 100 termos (VOZ-04). */
export const MAX_TERMOS = 100

/**
 * O campo com a fala: o texto que já estava escrito e, depois dele, o da voz. O final (de "Parar" ou do fim aos 10
 * minutos) troca o parcial; sem final, como depois de a conexão cair, o parcial fica.
 */
export function juntarTranscricao(atual: string, final: string, parcial: string): string {
  return [atual.trim(), final.trim() || parcial.trim()].filter(Boolean).join(' ')
}

const MICROFONE = 'Não deu para usar o microfone.'
const QUEDA = 'A conexão com o Gemini caiu. O texto até aqui ficou no campo.'

/**
 * A mensagem de um erro da voz: ao começar a gravação (microfone, chave, conexão…) ou durante a fala, quando o
 * `voz:erro` avisa que a conexão caiu.
 */
export function mensagemDaVoz(erro: unknown, momento: 'inicio' | 'fala'): string {
  const tipo = typeof erro === 'object' && erro !== null && 'tipo' in erro ? erro.tipo : undefined
  if (tipo === 'Microfone') return MICROFONE
  if (momento === 'fala' && tipo === 'Conexao') return QUEDA
  return mensagemDoErro(erro)
}

/**
 * Os termos que ajudam a transcrição: os títulos dos objetivos do dia e os nomes e termos das matérias, sem repetir
 * (sem acento e sem caixa) e até 100. Os objetivos vêm antes, por serem os mais prováveis na fala daquele dia.
 */
export function vocabularioDaVoz(dados: Pick<Dados, 'materias' | 'objetivos'>, dia: DataISO): string[] {
  const candidatos = [
    ...objetivosDoDia(dados, dia).map((o) => o.titulo ?? ''),
    ...dados.materias.flatMap((m) => [m.nome, ...(m.termos ?? [])]),
  ]
  const vistos = new Set<string>()
  const termos: string[] = []
  for (const candidato of candidatos) {
    const termo = candidato.trim()
    const chave = normalizar(termo)
    if (!termo || vistos.has(chave)) continue
    vistos.add(chave)
    termos.push(termo)
  }
  return termos.slice(0, MAX_TERMOS)
}
