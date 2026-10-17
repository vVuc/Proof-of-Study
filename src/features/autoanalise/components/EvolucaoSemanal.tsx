import { getISOWeek } from 'date-fns'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { deISO, formatarHM, rotuloSemana, type DataISO } from '@/shared/lib/datas'
import { CARTAO, ROTULO } from '@/shared/lib/estilos'
import { formatarPercentual, fracao } from '@/shared/lib/percentual'
import { cn } from '@/shared/lib/utils'
import type { LinhaEvolucao } from '@/features/banco/utils/banco'

const COLUNAS = 'grid grid-cols-[110px_minmax(0,1.1fr)_170px_70px_minmax(0,1.6fr)]'

/** Semana a semana: a etapa, as horas no banco contra as metas, o % em foco e o resultado. */
export function EvolucaoSemanal({ linhas, semanaAtual }: { linhas: LinhaEvolucao[]; semanaAtual: DataISO }) {
  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Semana a semana" faixa="bg-azul" forma={{ forma: 'quarto', cor: 'amarelo' }} contagem={linhas.length} />
      <div className={cn(COLUNAS, ROTULO, 'border-b-2 border-contorno text-muted-foreground')}>
        <span className="px-3 py-2">Semana</span>
        <span className="px-3 py-2">Etapa</span>
        <span className="px-3 py-2 text-right">Horas no banco</span>
        <span className="px-3 py-2 text-right">Foco</span>
        <span className="px-3 py-2">Resultado</span>
      </div>
      {linhas.map((l) => (
        <Linha key={l.semana} linha={l} atual={l.semana === semanaAtual} />
      ))}
    </div>
  )
}

function Linha({ linha: l, atual }: { linha: LinhaEvolucao; atual: boolean }) {
  const cumprida = l.metas > 0 && l.metasCumpridas === l.metas
  // Semana abaixo da meta mostra quanto chegou, sem rótulo de falha: estudar outra coisa é redirecionamento.
  const status = atual
    ? 'Semana atual'
    : l.metas === 0
      ? 'Sem meta'
      : cumprida
        ? 'Meta cumprida'
        : `${formatarPercentual(fracao(l.noBancoMs, l.metaMs))} da meta`
  const resultado =
    l.sessoes === 0
      ? 'Nenhuma sessão.'
      : `${l.dias} ${l.dias === 1 ? 'dia' : 'dias'} com sessão${l.metas > 1 ? ` · ${l.metasCumpridas} de ${l.metas} metas` : ''}.`

  return (
    <div
      className={cn(
        COLUNAS,
        'items-start border-b border-border text-[0.8125rem] hover:bg-foreground/5',
        atual && 'font-semibold shadow-[inset_0_2px_0_var(--contorno),inset_0_-2px_0_var(--contorno)]',
      )}
    >
      <span className="flex flex-col px-3 py-2.5">
        <span>S{getISOWeek(deISO(l.semana))}</span>
        <span className="text-[0.6875rem] font-normal text-muted-foreground">{rotuloSemana(l.semana)}</span>
      </span>
      <span className="px-3 py-2.5">{l.etapas.join(', ') || '—'}</span>
      <span className="flex flex-col items-end gap-[5px] px-3 py-2.5">
        <span className="tabular-nums">
          {formatarHM(l.noBancoMs)}
          {l.metaMs > 0 && ` / ${formatarHM(l.metaMs)}`}
        </span>
        <span className="h-2 w-full border-[1.5px] border-contorno bg-muted">
          <span className="block h-full bg-amarelo" style={{ width: `${l.metaMs ? Math.min(100, (l.noBancoMs / l.metaMs) * 100) : 0}%` }} />
        </span>
      </span>
      <span className="px-3 py-2.5 text-right text-foco tabular-nums">{l.sessoes ? formatarPercentual(l.percentualFoco) : '—'}</span>
      <span className="flex flex-col items-start gap-[5px] px-3 py-2.5">
        <span
          className={cn(
            'border-[1.5px] border-contorno px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-[0.06em] uppercase',
            atual ? 'bg-foreground text-background' : cumprida ? 'bg-amarelo text-tinta' : 'bg-transparent',
          )}
        >
          {status}
        </span>
        <span className="text-xs font-normal text-pretty text-muted-foreground">{resultado}</span>
      </span>
    </div>
  )
}
