import type { Ajuste, SugestaoIA } from '@/store/model/dados'
import type { Grupo } from '@/features/sessao/utils/resumo'

export type EstadoSugestao = 'aceita' | 'recusada' | 'pendente'

/** Como o grupo conta sem correção: a matéria do estudo, ou o tipo. */
const valorPadrao = (g: Pick<Grupo, 'tipoPadrao' | 'materiaPadrao'>): Ajuste =>
  g.tipoPadrao === 'estudo' && g.materiaPadrao ? `materia:${g.materiaPadrao}` : g.tipoPadrao

/**
 * Aceita: a correção do relato é igual à sugestão ou, sem correção, o grupo já conta assim (o relato salvo não guarda
 * a correção que não muda nada). Senão, recusada ou pendente.
 */
export function estadoDaSugestao(sugestao: SugestaoIA, ajustes: Record<string, Ajuste>, grupo?: Pick<Grupo, 'tipoPadrao' | 'materiaPadrao'>): EstadoSugestao {
  const atual = ajustes[sugestao.chave] ?? (grupo ? valorPadrao(grupo) : undefined)
  if (atual === sugestao.ajuste) return 'aceita'
  return sugestao.recusada ? 'recusada' : 'pendente'
}

/** A sugestão vira a correção manual daquele grupo; entra no banco ao salvar o relato (INSD-06). */
export const aceitar = (ajustes: Record<string, Ajuste>, sugestao: SugestaoIA): Record<string, Ajuste> => ({ ...ajustes, [sugestao.chave]: sugestao.ajuste })

/** "Aceitar todas": só as pendentes, sem as recusadas e as já aceitas (INSD-07). */
export function aceitarTodas(ajustes: Record<string, Ajuste>, sugestoes: SugestaoIA[], grupos: Grupo[] = []): Record<string, Ajuste> {
  return sugestoes
    .filter((s) => estadoDaSugestao(s, ajustes, grupos.find((g) => g.chave === s.chave)) === 'pendente')
    .reduce(aceitar, ajustes)
}
