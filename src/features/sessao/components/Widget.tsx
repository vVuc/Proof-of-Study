import { useEffect, useRef, useState } from 'react'
import { FaixaPrimarias } from '@/shared/components/FaixaPrimarias'
import { formatarCronometro, formatarDuracao, formatarRelogio, paraISO } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useAgora } from '@/shared/hooks/useAgora'
import { useDados } from '@/store/context/dados-context'
import { useJanela } from '@/app/janela/janela-context'
import { diaDe, nomeDoObjetivo, sessoesDoDia } from '@/features/dia/utils/dia'
import { useSessao } from '../context/sessao-context'
import { useResumoDaSessao } from '../hooks/useResumoDaSessao'
import { BarraFaixas } from './partes'
import { DetalheCaptura, useStatusCaptura } from './PopoverCaptura'

const BOTAO_PEQUENO = cn(BOTAO, 'h-8 px-2.5 text-[0.6875rem]')

/**
 * A janela encolhida num cartão sempre por cima: o relógio do objetivo, a linha do tempo, os avisos e o play/pause.
 * A faixa de cima arrasta o widget; ↗ volta para a janela inteira.
 */
export function Widget() {
  const { dados } = useDados()
  const { etapa, sessao, tempoHoje, tocar, pausar } = useSessao()
  const { restaurar, ajustarAltura } = useJanela()
  const { resumo, meta, atual, foraHaMs } = useResumoDaSessao()
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

  // Sem nada rodando, o play continua o último objetivo de hoje (ou o primeiro do plano).
  const hoje = paraISO(useAgora())
  const dia = diaDe(dados.dias, hoje)
  const objetivoId =
    sessao?.materiaId ?? sessoesDoDia(dados.sessoes, hoje).at(-1)?.materiaId ?? dia.objetivos[0] ?? dados.materias.find((m) => !m.arquivada)?.id
  const nome = objetivoId === undefined ? 'Proof of Study' : nomeDoObjetivo(dados.materias, objetivoId)

  return (
    <div ref={raiz} className="border-2 border-contorno bg-card text-foreground">
      <div data-tauri-drag-region>
        <FaixaPrimarias className="pointer-events-none" />
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <div data-tauri-drag-region className="flex items-center justify-between gap-2">
          <span className={cn(ROTULO, 'pointer-events-none truncate text-muted-foreground')}>
            {etapa === 'ocioso' ? `${nome} · parado por inatividade` : `${nome}${meta?.descricao ? ` · ${meta.descricao}` : ''}`}
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
          <span className="font-heading text-[2.625rem] leading-[0.9] font-extrabold tabular-nums">
            {formatarCronometro(objetivoId === undefined ? 0 : tempoHoje(objetivoId))}
          </span>
          <span className="text-xs font-semibold text-foco">{formatarDuracao(resumo.focoMs)} foco</span>
        </div>
        <BarraFaixas faixas={etapa === 'pronto' ? [] : resumo.faixas} className="h-2.5" />
        {etapa === 'rodando' && foraHaMs > 0 && dados.preferencias.avisoDistracao && atual && (
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
          {etapa !== 'pronto' && (
            <Button variant="outline" className={BOTAO_PEQUENO} onClick={() => void pausar()}>
              Pausar
            </Button>
          )}
          {etapa === 'pronto' && objetivoId !== undefined && (
            <Button className={BOTAO_PEQUENO} onClick={() => void tocar(objetivoId)}>
              Continuar
            </Button>
          )}
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
