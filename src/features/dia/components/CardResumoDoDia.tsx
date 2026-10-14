import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { PontoCor } from '@/shared/components/PontoCor'
import { formatarDuracao, formatarHora } from '@/shared/lib/datas'
import { CARTAO, ROTULO, VALOR_DESTAQUE } from '@/shared/lib/estilos'
import { formatarPercentual } from '@/shared/lib/percentual'
import { cn } from '@/shared/lib/utils'
import { useDados } from '@/store/context/dados-context'
import type { ResumoDoDia } from '../utils/resumo-do-dia'
import { nomeDoObjetivo } from '../utils/dia'

/** A autoavaliação do dia: % em foco antes das horas, e por objetivo o foco, o fora (com horário) e o ritmo. */
export function CardResumoDoDia({ resumo }: { resumo: ResumoDoDia }) {
  const { dados } = useDados()
  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Resumo do dia" faixa="bg-azul" forma={{ forma: 'circulo', cor: 'amarelo' }} />
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2 border-b-2 border-contorno px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={cn(ROTULO, 'text-muted-foreground')}>Em foco</span>
          <span className={cn(VALOR_DESTAQUE, 'text-[2.75rem] text-foco')}>{resumo.totalMs ? formatarPercentual(resumo.taxa) : '—'}</span>
        </div>
        <p className="pb-1.5 text-sm">
          <b className="text-foco">{formatarDuracao(resumo.focoMs)}</b> de estudo e{' '}
          <b className="text-fora">{formatarDuracao(resumo.foraMs)}</b> fora, em {formatarDuracao(resumo.totalMs)} registradas.
        </p>
      </div>
      {resumo.linhas.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nada registrado neste dia ainda.</p>}
      {resumo.linhas.map((linha) => {
        const materia = dados.materias.find((m) => m.id === linha.materiaId)
        return (
          <div key={linha.materiaId} className="flex flex-col gap-1.5 border-t border-border px-4 py-3 first-of-type:border-t-0">
            <div className="flex items-center gap-2.5">
              {materia ? <PontoCor cor={materia.cor} /> : <span aria-hidden className="listrado size-2.5 border-[1.5px] border-contorno" />}
              <span className="flex-1 text-sm font-semibold">{nomeDoObjetivo(dados.materias, linha.materiaId)}</span>
              <span className="text-sm font-semibold text-foco">{formatarDuracao(linha.focoMs)} em foco</span>
              <span className="w-24 text-right text-sm font-semibold text-fora">{formatarDuracao(linha.foraMs)} fora</span>
            </div>
            {linha.corridas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ritmo:{' '}
                {linha.corridas.map((c, i) => (
                  <span key={c.inicio}>
                    {i > 0 && <> · pausa de {formatarDuracao(c.inicio - linha.corridas[i - 1].fim)} · </>}
                    {formatarHora(c.inicio)}–{formatarHora(c.fim)} ({formatarDuracao(c.fim - c.inicio)})
                  </span>
                ))}
              </p>
            )}
            {linha.saidas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fora do estudo:{' '}
                {linha.saidas.map((s, i) => (
                  <span key={s.inicio}>
                    {i > 0 && ' · '}
                    {formatarHora(s.inicio)}–{formatarHora(s.fim)} em {s.rotulo} ({formatarDuracao(s.fim - s.inicio)})
                  </span>
                ))}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
