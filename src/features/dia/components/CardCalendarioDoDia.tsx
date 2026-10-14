import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { useAgora } from '@/shared/hooks/useAgora'
import { deISO, formatarDuracao, formatarHora, formatarHoraCurta, paraISO, type DataISO } from '@/shared/lib/datas'
import { CARTAO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { useDados } from '@/store/context/dados-context'
import { categoriaOcupa } from '@/store/model/dados'
import { CATEGORIAS } from '@/features/rotina/constants/categorias'
import { segmentosDoDia } from '@/features/rotina/utils/rotina'
import { COR_TIPO } from '@/features/sessao/components/partes'
import { ROTULO_TIPO } from '@/features/sessao/utils/classificacao'
import { nomeDoObjetivo } from '../utils/dia'
import type { BlocoDoDia } from '../utils/resumo-do-dia'

/** Altura de uma hora, em px. */
const HORA = 32

/**
 * O dia preenchido pelo que o cronômetro registrou (estudo azul, fora vermelho), com a rotina ao lado:
 * os blocos de estudo planejados e os compromissos (trabalho, academia…). Planejado e registrado não são
 * comparados como atraso: um bloco que começou mais tarde é só o que aconteceu.
 */
export function CardCalendarioDoDia({ data, blocos }: { data: DataISO; blocos: BlocoDoDia[] }) {
  const { dados } = useDados()
  const agora = useAgora()
  const dia = deISO(data)
  const meiaNoite = dia.getTime()
  const minutoDe = (ms: number) => (ms - meiaNoite) / 60_000
  const rotina = segmentosDoDia(dados.blocos, dia.getDay()).filter((s) => s.bloco.categoria !== 'sono')

  const primeiro = Math.min(8 * 60, ...blocos.map((b) => minutoDe(b.inicio)), ...rotina.map((s) => s.inicio))
  const horaInicial = Math.max(0, Math.floor(primeiro / 60))
  const horas = Array.from({ length: 24 - horaInicial }, (_, i) => horaInicial + i)
  const topo = (minuto: number) => ((minuto - horaInicial * 60) / 60) * HORA
  const ehHoje = paraISO(agora) === data
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes()

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Calendário do dia" faixa="bg-vermelho" forma={{ forma: 'quadrado', cor: 'papel' }} />
      <div className="flex gap-3 px-4 pt-3 text-[0.6875rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 border-[1.5px] border-contorno bg-azul" /> estudo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 border-[1.5px] border-contorno bg-vermelho" /> fora
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 border-[1.5px] border-dashed border-contorno" /> rotina
        </span>
      </div>
      <div className="flex px-4 pt-3 pb-4">
        <div className="relative w-10 shrink-0" style={{ height: horas.length * HORA }}>
          {horas.map((h, i) => (
            <span key={h} className="absolute left-0 -translate-y-1.5 text-[0.625rem] text-muted-foreground" style={{ top: i * HORA }}>
              {String(h).padStart(2, '0')}h
            </span>
          ))}
        </div>
        <div className="relative flex-1 border-l border-border" style={{ height: horas.length * HORA }}>
          {horas.map((h, i) => (
            <span key={h} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ top: i * HORA }} />
          ))}
          {blocos.map((b) => {
            const altura = Math.max(3, topo(minutoDe(b.fim)) - topo(minutoDe(b.inicio)))
            const nome = b.tipo === 'estudo' ? nomeDoObjetivo(dados.materias, b.materiaId) : `${ROTULO_TIPO[b.tipo]} · ${b.rotulo}`
            return (
              <div
                key={`${b.inicio}-${b.materiaId}`}
                className={cn(
                  'absolute right-[38%] left-1 overflow-hidden border-contorno px-1.5 text-[0.6875rem] leading-tight',
                  altura >= 6 && 'border-2',
                  COR_TIPO[b.tipo].bloco,
                  b.tipo === 'ignorar' ? 'text-foreground' : 'text-sobre-bloco',
                )}
                style={{ top: topo(minutoDe(b.inicio)), height: altura }}
                title={`${nome} · ${formatarHora(b.inicio)}–${formatarHora(b.fim)} (${formatarDuracao(b.fim - b.inicio)})`}
              >
                {altura >= 16 && <span className="truncate font-semibold">{nome}</span>}
              </div>
            )
          })}
          {rotina.map((s) => {
            const info = CATEGORIAS[s.bloco.categoria]
            const materia = dados.materias.find((m) => m.id === s.bloco.materiaId)?.nome
            const nome = s.bloco.categoria === 'estudo' && materia ? `Plano · ${materia}` : s.bloco.titulo
            return (
              <div
                key={`${s.bloco.id}-${s.continuacao}`}
                className={cn(
                  'absolute right-1 left-[63%] overflow-hidden border-2 border-dashed border-contorno px-1.5 text-[0.6875rem] leading-tight',
                  categoriaOcupa(s.bloco.categoria) ? 'bg-muted/60' : 'bg-foco-suave',
                )}
                style={{ top: topo(Math.max(s.inicio, horaInicial * 60)), height: topo(s.fim) - topo(Math.max(s.inicio, horaInicial * 60)) }}
                title={`${nome} · ${formatarHoraCurta(s.bloco.inicio)}–${formatarHoraCurta(s.bloco.fim)}`}
              >
                <span className="truncate font-semibold">{nome}</span>
                <span className="sr-only"> ({info.nome})</span>
              </div>
            )
          })}
          {ehHoje && minutoAgora >= horaInicial * 60 && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-vermelho" style={{ top: topo(minutoAgora) }} />
          )}
        </div>
      </div>
    </div>
  )
}
