import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { DIAS_SEMANA, formatarDuracao } from '@/shared/lib/datas'
import { CARTAO } from '@/shared/lib/estilos'
import { formatarPercentual } from '@/shared/lib/percentual'
import { taxaDeFoco } from '@/features/sessao/utils/resumo'
import type { CelulaHora } from '../utils/insights'

/** Horas com menos registro que isso ficam vazias: pouco dado não diz nada. */
const MINIMO_MS = 10 * 60_000
/** Faixas da escala (uma cor só, do claro ao escuro): até 40%, até 60%, até 80% e acima. */
const FAIXAS = [0.4, 0.6, 0.8, 1]
const OPACIDADE = [0.2, 0.45, 0.7, 1]

const faixa = (taxa: number) => FAIXAS.findIndex((limite) => taxa <= limite)

/**
 * "Quando você rende": a taxa de foco (estudo ÷ estudo + fora) por dia da semana e hora. Mais escuro, mais foco.
 * Só as horas em que houve registro aparecem.
 */
export function MapaDeFoco({ mapa }: { mapa: CelulaHora[][] }) {
  const horasComDado = mapa.flatMap((d) => d.map((c, h) => (c.focoMs + c.foraMs >= MINIMO_MS ? h : -1))).filter((h) => h >= 0)
  if (horasComDado.length === 0) return null
  const primeira = Math.min(...horasComDado)
  const ultima = Math.max(...horasComDado)
  const horas = Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i)

  // As três horas com mais foco, para dizer em palavras o que o mapa mostra.
  const melhores = mapa
    .flatMap((d, dia) => d.map((c, hora) => ({ dia, hora, ...c, taxa: taxaDeFoco(c.focoMs, c.foraMs) })))
    .filter((c) => c.focoMs + c.foraMs >= MINIMO_MS)
    .sort((a, b) => b.taxa - a.taxa || b.focoMs - a.focoMs)
    .slice(0, 3)

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Quando você rende" faixa="bg-azul" forma={{ forma: 'circulo', cor: 'papel' }} />
      <div className="flex flex-col gap-3 p-4">
        <div className="overflow-x-auto">
          <div className="grid w-max gap-0.5" style={{ gridTemplateColumns: `36px repeat(${horas.length}, 22px)` }}>
            <span />
            {horas.map((h) => (
              <span key={h} className="text-center text-[0.625rem] text-muted-foreground tabular-nums">
                {h % 2 === 0 ? `${h}h` : ''}
              </span>
            ))}
            {DIAS_SEMANA.map(({ dia, curto, nome }) => (
              <Linha key={dia} rotulo={curto} nome={nome} celulas={horas.map((h) => ({ hora: h, ...mapa[dia][h] }))} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
          <span>Menos foco</span>
          {OPACIDADE.map((o) => (
            <span key={o} aria-hidden className="size-3.5 bg-azul" style={{ opacity: o }} />
          ))}
          <span>Mais foco</span>
          <span className="ml-2 size-3.5 border border-border" aria-hidden /> <span>sem registro</span>
        </div>
        {melhores.length > 0 && (
          <p className="text-sm">
            Seus horários de mais foco:{' '}
            {melhores.map((c, i) => (
              <span key={`${c.dia}-${c.hora}`}>
                {i > 0 && ', '}
                <b>
                  {DIAS_SEMANA.find((d) => d.dia === c.dia)?.curto.toLowerCase()} às {c.hora}h
                </b>{' '}
                ({formatarPercentual(c.taxa)})
              </span>
            ))}
            .
          </p>
        )}
      </div>
    </div>
  )
}

function Linha({ rotulo, nome, celulas }: { rotulo: string; nome: string; celulas: (CelulaHora & { hora: number })[] }) {
  return (
    <>
      <span className="self-center text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">{rotulo}</span>
      {celulas.map((c) => {
        const total = c.focoMs + c.foraMs
        const taxa = taxaDeFoco(c.focoMs, c.foraMs)
        const descricao =
          total >= MINIMO_MS
            ? `${nome}, ${c.hora}h: ${formatarPercentual(taxa)} em foco (${formatarDuracao(c.focoMs)} estudo, ${formatarDuracao(c.foraMs)} fora)`
            : `${nome}, ${c.hora}h: sem registro suficiente`
        return (
          <span
            key={c.hora}
            role="img"
            aria-label={descricao}
            title={descricao}
            tabIndex={0}
            className="relative size-[22px] border border-border outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            {total >= MINIMO_MS && <span className="absolute inset-0 bg-azul" style={{ opacity: OPACIDADE[faixa(taxa)] }} />}
          </span>
        )
      })}
    </>
  )
}
