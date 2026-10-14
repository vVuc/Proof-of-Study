import { format } from 'date-fns'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { deISO, DIAS_SEMANA, formatarDuracao } from '@/shared/lib/datas'
import { CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { useDados } from '@/store/context/dados-context'
import type { LinhaDoDia } from '../utils/insights'

const COLUNAS = 'grid grid-cols-[90px_minmax(0,1fr)_90px_minmax(0,1.4fr)_80px]'

/**
 * Dia a dia: quanto do tempo registrado foi estudo, o que foi planejado e o que foi feito (estudar outra coisa é
 * redirecionamento, não falha) e o humor do relato final.
 */
export function DiaADia({ linhas, humor }: { linhas: LinhaDoDia[]; humor: { alto: number; baixo: number } | null }) {
  const { dados } = useDados()
  const nome = (id: string) => dados.materias.find((m) => m.id === id)?.nome ?? 'Matéria'
  const maior = Math.max(1, ...linhas.map((l) => l.registradoMs))

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Dia a dia" faixa="bg-amarelo" forma={{ forma: 'semicirculo', cor: 'tinta' }} contagem={linhas.length} />
      {humor && (
        <p className="border-b-2 border-contorno px-4 py-2.5 text-sm">
          Nos dias de humor alto (4 ou 5), você estudou em média <b>{formatarDuracao(humor.alto)}</b>; nos de humor baixo (1 ou 2),{' '}
          <b>{formatarDuracao(humor.baixo)}</b>.
        </p>
      )}
      <div className={cn(COLUNAS, ROTULO, 'border-b-2 border-contorno text-muted-foreground')}>
        <span className="px-3 py-2">Dia</span>
        <span className="px-3 py-2">Estudo no tempo registrado</span>
        <span className="px-3 py-2 text-right">Estudo</span>
        <span className="px-3 py-2">Planejado × feito</span>
        <span className="px-3 py-2 text-right">Humor</span>
      </div>
      {[...linhas].reverse().map((l) => {
        const data = deISO(l.dia)
        const ignorado = Math.max(0, l.registradoMs - l.focoMs - l.foraMs)
        return (
          <div key={l.dia} className={cn(COLUNAS, 'items-center border-b border-border text-[0.8125rem]')}>
            <span className="flex flex-col px-3 py-2">
              <span className="font-semibold">{DIAS_SEMANA.find((d) => d.dia === data.getDay())?.curto}</span>
              <span className="text-[0.6875rem] text-muted-foreground">{format(data, 'dd/MM')}</span>
            </span>
            <span className="px-3 py-2">
              <span
                aria-label={`${formatarDuracao(l.focoMs)} de estudo, ${formatarDuracao(l.foraMs)} fora e ${formatarDuracao(ignorado)} ignorado`}
                className="flex h-3 gap-0.5"
                style={{ width: `${(l.registradoMs / maior) * 100}%` }}
              >
                <span className="bg-azul" style={{ flex: l.focoMs }} />
                <span className="bg-vermelho" style={{ flex: l.foraMs }} />
                <span className="bg-muted" style={{ flex: ignorado }} />
              </span>
            </span>
            <span className="px-3 py-2 text-right font-semibold text-foco tabular-nums">{formatarDuracao(l.focoMs)}</span>
            <span className="flex flex-col px-3 py-2 text-xs leading-snug">
              {l.planejadasComTempo.length > 0 && <span>Feito: {l.planejadasComTempo.map(nome).join(', ')}</span>}
              {l.planejadasSemTempo.length > 0 && (
                <span className="text-muted-foreground">Ficou para depois: {l.planejadasSemTempo.map(nome).join(', ')}</span>
              )}
              {l.foraDoPlano.length > 0 && <span>Redirecionou para: {l.foraDoPlano.map(nome).join(', ')}</span>}
              {l.planejadasComTempo.length + l.planejadasSemTempo.length + l.foraDoPlano.length === 0 && (
                <span className="text-muted-foreground">Sem objetivos com matéria</span>
              )}
            </span>
            <span className="px-3 py-2 text-right font-semibold tabular-nums">{l.humor ?? '—'}</span>
          </div>
        )
      })}
      <div className="flex gap-3.5 px-4 py-2.5 text-[0.6875rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-azul" aria-hidden /> estudo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-vermelho" aria-hidden /> fora
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-muted" aria-hidden /> ignorado
        </span>
      </div>
    </div>
  )
}
