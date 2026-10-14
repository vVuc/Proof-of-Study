import { Link } from '@tanstack/react-router'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { formatarDuracao, formatarRelogio, type DataISO } from '@/shared/lib/datas'
import { BOTAO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import { useJanela } from '@/app/janela/janela-context'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { BarraFaixas } from '@/features/sessao/components/partes'
import { BotaoPlay } from '@/features/sessao/components/ControlesDoDia'
import { EXPLICACAO_FASE, ROTULO_FASE } from '@/features/sessao/utils/rotulos'
import { useSessao } from '@/features/sessao/context/sessao-context'
import { useResumoDoDia } from '@/features/sessao/hooks/useResumoDoDia'

/** O play do dia: o tempo registrado hoje, o estado da captura, a linha do tempo e o caminho para o relato final. */
export function CartaoPlay({ dia }: { dia: DataISO }) {
  const { dados } = useDados()
  const { fase, sessao } = useSessao()
  const { virarWidget } = useJanela()
  const { resumo, pausas, foraHaMs, atual } = useResumoDoDia(dia)
  const pausadoMs = pausas.reduce((s, p) => s + (p.fim - p.inicio), 0)
  const relatoFeito = relatoDoDia(dados.relatos, dia, 'final')

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Sessão do dia" faixa="bg-azul" forma={{ forma: 'circulo', cor: 'papel' }} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className={cn(ROTULO, 'w-fit bg-foreground px-2 py-0.5 text-background')}>{fase ? ROTULO_FASE[fase] : '…'}</span>
            <span className="font-heading text-[4.5rem] leading-[0.9] font-extrabold tabular-nums" role="timer">
              {formatarRelogio(resumo.totalMs)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-xs">
            <span className="font-semibold text-foco">{formatarDuracao(resumo.focoMs)} estudo</span>
            <span className="font-semibold text-fora">{formatarDuracao(resumo.foraMs)} fora</span>
            <span className="text-muted-foreground">{formatarDuracao(pausadoMs)} em pausa</span>
          </div>
        </div>
        {fase && <p className="text-sm text-muted-foreground">{EXPLICACAO_FASE[fase]}</p>}
        {fase === 'rodando' && foraHaMs > 60_000 && atual && (
          <p className="border-2 border-l-[6px] border-contorno border-l-vermelho bg-fora-suave px-2.5 py-1.5 text-sm">
            <b>Fora do estudo há {formatarRelogio(foraHaMs)}</b> em {atual.rotulo}.
          </p>
        )}
        <BarraFaixas faixas={resumo.faixas} className="h-5" />
        <div className="flex flex-wrap gap-3">
          <BotaoPlay grande />
          {sessao && (
            <Button variant="outline" className={cn(BOTAO, 'h-12')} onClick={() => void virarWidget()}>
              Virar widget
            </Button>
          )}
          {dados.preferencias.relatos && resumo.totalMs > 0 && (
            <Button asChild variant="outline" className={cn(BOTAO, 'h-12')}>
              <Link to="/relato" search={{ dia }}>
                {relatoFeito?.texto ? 'Rever o relato do dia' : 'Fazer o relato do dia'}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
