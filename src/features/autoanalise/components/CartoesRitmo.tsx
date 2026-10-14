import { Ajuda } from '@/shared/components/Ajuda'
import { formatarDuracao } from '@/shared/lib/datas'
import { CARTAO, ROTULO } from '@/shared/lib/estilos'
import { formatarPercentual } from '@/shared/lib/percentual'
import { cn } from '@/shared/lib/utils'
import { ROTULO_PAUSA } from '@/features/sessao/utils/rotulos'
import type { Autoanalise } from '../utils/insights'

/** Os números do ritmo: bloco de foco típico, tempo até a primeira distração, qualidade e pausas. */
export function CartoesRitmo({ analise }: { analise: Autoanalise }) {
  const foco = analise.linhas.reduce((s, l) => s + l.focoMs, 0)
  const registrado = analise.linhas.reduce((s, l) => s + l.registradoMs, 0)
  const motivos = Object.entries(analise.pausas.porMotivo).filter(([, p]) => p.quantidade > 0)

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <Cartao
        rotulo="Bloco de foco típico"
        valor={analise.blocoTipicoMs === null ? '—' : formatarDuracao(analise.blocoTipicoMs)}
        detalhe={`Mediana de ${analise.blocos.length} blocos seguidos de estudo`}
        ajuda="É o seu pomodoro involuntário: quanto tempo você costuma estudar sem sair para uma distração nem pausar."
      />
      <Cartao
        rotulo="Até a primeira distração"
        valor={analise.ateDistrairMs === null ? '—' : formatarDuracao(analise.ateDistrairMs)}
        detalhe="Mediana, contando do play ou da volta de uma pausa"
      />
      <Cartao
        rotulo="Estudo de fato"
        valor={registrado ? formatarPercentual(foco / registrado) : '—'}
        detalhe={`${formatarDuracao(foco)} de estudo em ${formatarDuracao(registrado)} registrados`}
        ajuda="Qualidade × quantidade: do tempo com a sessão rodando, quanto foi estudo. 3 h de estudo de fato valem mais que 8 h dispersas."
      />
      <Cartao
        rotulo="Pausas"
        valor={formatarDuracao(analise.pausas.totalMs)}
        detalhe={
          motivos.length
            ? motivos.map(([motivo, p]) => `${p.quantidade} ${ROTULO_PAUSA[motivo as keyof typeof ROTULO_PAUSA].toLowerCase()}`).join(' · ')
            : 'Nenhuma pausa no período'
        }
      />
    </div>
  )
}

function Cartao({ rotulo, valor, detalhe, ajuda }: { rotulo: string; valor: string; detalhe: string; ajuda?: string }) {
  return (
    <div className={cn(CARTAO, 'flex flex-col gap-1 p-3.5')}>
      <span className="flex items-center justify-between gap-2">
        <span className={cn(ROTULO, 'text-muted-foreground')}>{rotulo}</span>
        {ajuda && (
          <Ajuda titulo={rotulo}>
            <p>{ajuda}</p>
          </Ajuda>
        )}
      </span>
      <span className="font-heading text-[2rem] leading-tight font-extrabold">{valor}</span>
      <span className="text-xs text-muted-foreground">{detalhe}</span>
    </div>
  )
}
