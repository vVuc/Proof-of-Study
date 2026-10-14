import { useEffect, useRef, useState } from 'react'
import { FaixaPrimarias } from '@/shared/components/FaixaPrimarias'
import { formatarDuracao, formatarRelogio } from '@/shared/lib/datas'
import { ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { useDados } from '@/store/context/dados-context'
import { useJanela } from '@/app/janela/janela-context'
import { useSessao } from '../context/sessao-context'
import { useResumoDoDia } from '../hooks/useResumoDoDia'
import { ROTULO_FASE } from '../utils/rotulos'
import { BotaoPlay } from './ControlesDoDia'
import { BarraFaixas } from './partes'
import { DetalheCaptura, useStatusCaptura } from './PopoverCaptura'

/**
 * A janela encolhida num cartão sempre por cima: o tempo do dia, a linha do tempo, o aviso de distração e o
 * play/pause. A faixa de cima arrasta o widget; ↗ volta para a janela inteira.
 */
export function Widget() {
  const { dados } = useDados()
  const { fase } = useSessao()
  const { restaurar, ajustarAltura } = useJanela()
  const { resumo, atual, foraHaMs } = useResumoDoDia()
  const { rotulo, cor } = useStatusCaptura()
  const [detalhe, setDetalhe] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const observador = new ResizeObserver(() => ajustarAltura(el.getBoundingClientRect().height))
    observador.observe(el)
    return () => observador.disconnect()
  }, [ajustarAltura])

  return (
    <div ref={raiz} className="border-2 border-contorno bg-card text-foreground">
      <div data-tauri-drag-region>
        <FaixaPrimarias className="pointer-events-none" />
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <div data-tauri-drag-region className="flex items-center justify-between gap-2">
          <span className={cn(ROTULO, 'pointer-events-none truncate text-muted-foreground')}>
            {fase ? `Hoje · ${ROTULO_FASE[fase]}` : 'Proof of Study'}
          </span>
          <button
            type="button"
            onClick={() => void restaurar()}
            aria-label="Abrir janela"
            title="Abrir janela"
            className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-contorno text-[0.8125rem] hover:bg-amarelo hover:text-tinta"
          >
            ↗
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-heading text-[3.125rem] leading-[0.9] font-extrabold tabular-nums">{formatarRelogio(resumo.totalMs)}</span>
          <span className="text-xs font-semibold text-foco">{formatarDuracao(resumo.focoMs)} estudo</span>
        </div>
        <BarraFaixas faixas={resumo.faixas} className="h-2.5" />
        {fase === 'rodando' && foraHaMs > 60_000 && dados.preferencias.avisoDistracao && atual && (
          <div className="border-2 border-l-[6px] border-contorno border-l-vermelho bg-fora-suave px-2 py-1.5 text-xs">
            <b>Fora há {formatarRelogio(foraHaMs)}</b> · {atual.rotulo}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetalhe((d) => !d)}
            aria-expanded={detalhe}
            className="flex flex-1 items-center gap-[7px] py-1 text-left text-[0.6875rem] font-semibold tracking-[0.06em] uppercase"
          >
            <span aria-hidden className={cn('size-2.5 border-[1.5px] border-contorno', cor)} />
            {rotulo} {detalhe ? '▴' : '▾'}
          </button>
          <BotaoPlay className="h-8 px-2.5 text-[0.6875rem]" />
        </div>
        {detalhe && (
          <div className="border-t-2 border-contorno">
            <DetalheCaptura compacto />
          </div>
        )}
      </div>
    </div>
  )
}
