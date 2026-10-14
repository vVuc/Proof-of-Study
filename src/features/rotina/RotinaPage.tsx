import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { PontoCor } from '@/shared/components/PontoCor'
import { DIAS_SEMANA, deISO, inicioDaSemana } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { Categoria } from '@/store/model/dados'
import { DialogBloco, type RascunhoBloco } from './components/DialogBloco'
import { GradeSemana } from './components/GradeSemana'
import { CATEGORIAS, LISTA_CATEGORIAS } from './constants/categorias'
import { segmentosDoDia, semHorarioDoDia } from './utils/rotina'

/** A grade mostra das 8h em diante, ou desde o bloco mais cedo (fora o sono). */
const HORA_INICIAL = 8

export function RotinaPage() {
  const { dados } = useDados()
  const [editando, setEditando] = useState<RascunhoBloco | null>(null)
  const segunda = deISO(inicioDaSemana(new Date()))
  const domingo = addDays(segunda, 6)
  const periodo =
    segunda.getMonth() === domingo.getMonth()
      ? `${format(segunda, 'd')}–${format(domingo, 'd MMM', { locale: ptBR })}`
      : `${format(segunda, 'd MMM', { locale: ptBR })}–${format(domingo, 'd MMM', { locale: ptBR })}`

  const { totais, semRegistro, horaInicial } = useMemo(() => {
    const totais = Object.fromEntries(LISTA_CATEGORIAS.map((c) => [c, 0])) as Record<Categoria, number>
    let ocupadoNoDia = 0
    let primeiro = HORA_INICIAL * 60
    for (let dia = 0; dia < 7; dia++) {
      const segmentos = segmentosDoDia(dados.blocos, dia)
      const ocupado = new Set<number>()
      for (const s of segmentos) {
        if (s.bloco.categoria === 'sono') continue
        totais[s.bloco.categoria] += s.fim - s.inicio
        primeiro = Math.min(primeiro, s.inicio)
        for (let m = Math.max(s.inicio, 8 * 60); m < Math.min(s.fim, 23 * 60); m++) ocupado.add(m)
      }
      ocupadoNoDia += ocupado.size
    }
    // "Sem horário marcado": horas acordadas (8h às 23h) sem nenhum item com horário, na semana.
    return { totais, semRegistro: Math.round((7 * 15 * 60 - ocupadoNoDia) / 60), horaInicial: Math.floor(primeiro / 60) }
  }, [dados.blocos])

  const usadas = LISTA_CATEGORIAS.filter((c) => c !== 'sono' && totais[c] > 0).sort((a, b) => totais[b] - totais[a])
  const horas = (min: number) => Math.round((min / 60) * 10) / 10
  const nomeMateria = (id?: string) => dados.materias.find((m) => m.id === id)?.nome

  return (
    <div className="flex flex-col gap-3.5">
      <CabecalhoPagina
        forma={FORMA_PAGINA.rotina}
        titulo={
          <>
            Rotina <span>{periodo}</span>
          </>
        }
        acoes={
          <>
            <Button variant="outline" className={BOTAO} onClick={() => setEditando({ semHorario: true, categoria: 'estudo' })}>
              + Objetivo sem horário
            </Button>
            <Button variant="outline" className={BOTAO} onClick={() => setEditando({})}>
              + Com horário
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2">
        <div aria-hidden className="flex h-3.5 gap-0.5 border-2 border-contorno bg-contorno">
          {usadas.map((c) => (
            <span key={c} style={{ flex: totais[c], backgroundColor: CATEGORIAS[c].fundo }} />
          ))}
          <span className="listrado" style={{ flex: semRegistro * 60 }} />
        </div>
        <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs">
          {usadas.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="size-2.5 border-[1.5px] border-contorno" style={{ backgroundColor: CATEGORIAS[c].fundo }} />
              {CATEGORIAS[c].nome} <b className="font-semibold">{horas(totais[c])}h</b>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="listrado size-2.5 border-[1.5px] border-contorno" />
            Livre <b className="font-semibold">{semRegistro}h</b>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className={cn(ROTULO, 'text-muted-foreground')}>Objetivos sem horário</span>
        <div className="flex pl-10">
          {DIAS_SEMANA.map(({ dia, nome }) => (
            <div key={dia} className="flex min-w-0 flex-1 flex-col gap-1 border-l border-border px-[3px] py-1">
              {semHorarioDoDia(dados.blocos, dia).map((b) => {
                const materia = dados.materias.find((m) => m.id === b.materiaId)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setEditando(b)}
                    title={`${b.titulo} · ${nome}, sem horário`}
                    className="flex items-center gap-1.5 truncate border-2 border-dashed border-contorno bg-card px-1.5 py-[3px] text-left text-[0.6875rem] font-semibold hover:bg-amarelo hover:text-tinta"
                  >
                    {materia && <PontoCor cor={materia.cor} />}
                    <span className="truncate">{materia?.nome ?? b.titulo}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setEditando({ semHorario: true, categoria: 'estudo', dias: [dia] })}
                className="text-left text-[0.625rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase hover:text-foreground"
                aria-label={`Objetivo sem horário na ${nome.toLowerCase()}`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      </div>

      <GradeSemana
        blocos={dados.blocos}
        horaInicial={horaInicial}
        nomeMateria={nomeMateria}
        onEditar={setEditando}
        onNovo={(dia, minuto) => setEditando({ dias: [dia], inicio: minuto, fim: (minuto + 60) % (24 * 60) })}
      />

      <DialogBloco bloco={editando} onClose={() => setEditando(null)} />
    </div>
  )
}
