import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { formatarDuracao, formatarHora, formatarRelogio } from '@/shared/lib/datas'
import { BOTAO, CARTAO, ROTULO, TITULO_CARD } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import { useJanela } from '@/app/janela/janela-context'
import { BotaoPlay } from './components/ControlesDoDia'
import { BarraFaixas, LinhaGrupo } from './components/partes'
import { PopoverCaptura } from './components/PopoverCaptura'
import { useSessao } from './context/sessao-context'
import { useResumoDoDia } from './hooks/useResumoDoDia'
import { ROTULO_TIPO } from './utils/classificacao'
import { EXPLICACAO_FASE, ROTULO_FASE, ROTULO_PAUSA } from './utils/rotulos'

/** A linha do tempo do dia: o relógio, para onde foi o tempo (com o objetivo de cada grupo) e as pausas. */
export function SessaoPage() {
  const { dados } = useDados()
  const { fase, sessao } = useSessao()
  const { virarWidget } = useJanela()
  const { resumo, pausas, foraHaMs, atual } = useResumoDoDia()

  const destino = (materiaId?: string, tipo?: string) =>
    tipo === 'estudo' ? (dados.materias.find((m) => m.id === materiaId)?.nome ?? 'Sem objetivo') : ROTULO_TIPO[tipo as 'fora']

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.sessao}
        trilha={sessao ? `Sessão aberta às ${formatarHora(sessao.inicio)}` : 'Nenhuma sessão aberta'}
        titulo={
          <>
            Sessão <span>do dia</span>
          </>
        }
        acoes={<PopoverCaptura />}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className={cn(ROTULO, 'w-fit bg-foreground px-2.5 py-1 tracking-[0.1em] text-background')}>{fase ? ROTULO_FASE[fase] : '…'}</span>
          <span className="font-heading text-[6rem] leading-[0.9] font-extrabold tabular-nums" role="timer">
            {formatarRelogio(resumo.totalMs)}
          </span>
          {fase && <span className="text-sm text-muted-foreground">{EXPLICACAO_FASE[fase]}</span>}
        </div>
        <div className="flex flex-wrap gap-3">
          <BotaoPlay grande />
          {sessao && (
            <Button variant="outline" className={cn(BOTAO, 'h-12')} onClick={() => void virarWidget()}>
              Virar widget
            </Button>
          )}
        </div>
      </div>

      {fase === 'rodando' && foraHaMs > 60_000 && atual && dados.preferencias.avisoDistracao && (
        <p className="border-2 border-l-8 border-contorno border-l-vermelho bg-fora-suave px-3 py-2.5 text-sm">
          <b>Fora do estudo há {formatarRelogio(foraHaMs)}</b> em {atual.rotulo}. O tempo continua sendo registrado.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className={cn(ROTULO, 'flex justify-between')}>
          <span className="text-muted-foreground">O dia até agora</span>
          <span>
            <span className="text-foco">{formatarDuracao(resumo.focoMs)} estudo</span> ·{' '}
            <span className="text-fora">{formatarDuracao(resumo.foraMs)} fora</span>
          </span>
        </div>
        <BarraFaixas faixas={resumo.faixas} className="h-[26px]" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <div className={CARTAO}>
          <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Para onde foi o tempo</div>
          {resumo.grupos.map((g) => (
            <LinhaGrupo key={g.chave} grupo={g}>
              <span className="w-28 truncate text-right text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {g.fixo ? 'Não conta' : destino(g.materiaId, g.tipo)}
              </span>
            </LinhaGrupo>
          ))}
          {resumo.grupos.length === 0 && <p className="px-3.5 py-3 text-sm text-muted-foreground">Nada registrado hoje.</p>}
          <p className="px-3.5 py-2.5 text-xs text-muted-foreground">O que estiver no lugar errado você corrige no relato final.</p>
        </div>

        <div className={CARTAO}>
          <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Pausas</div>
          {pausas.map((p) => (
            <p key={`${p.inicio}-${p.motivo}`} className="flex items-center gap-2.5 border-b border-border px-3.5 py-2 text-[0.8125rem]">
              <span className="w-24 text-muted-foreground tabular-nums">
                {formatarHora(p.inicio)}–{formatarHora(p.fim)}
              </span>
              <span className="flex-1">{ROTULO_PAUSA[p.motivo]}</span>
              <span className="font-semibold tabular-nums">{formatarDuracao(p.fim - p.inicio)}</span>
            </p>
          ))}
          {pausas.length === 0 && <p className="px-3.5 py-3 text-sm text-muted-foreground">Nenhuma pausa hoje.</p>}
        </div>
      </div>
    </div>
  )
}
