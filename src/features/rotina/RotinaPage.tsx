import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { DIAS_SEMANA, deISO, formatarHoraCurta, formatarMeta, inicioDaSemana } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { BlocoRotina, Categoria } from '@/store/model/dados'
import { DialogBloco } from './components/DialogBloco'
import { GradeSemana } from './components/GradeSemana'
import { CATEGORIAS, LISTA_CATEGORIAS } from './constants/categorias'
import { segmentosDoDia } from './utils/rotina'
import { livreNoDia, type Intervalo } from '@/features/dia/utils/dia'

/** A grade mostra das 8h em diante, ou desde o bloco mais cedo (fora o sono). */
const HORA_INICIAL = 8

const horario = (minuto: number) => (minuto >= 24 * 60 ? 'meia-noite' : formatarHoraCurta(minuto))
const intervalo = (i: Intervalo) => (i.fim >= 24 * 60 ? `das ${horario(i.inicio)} à meia-noite` : `das ${horario(i.inicio)} às ${horario(i.fim)}`)

/**
 * A rotina é opcional: dá para usar o app só com os objetivos do dia. Os compromissos (trabalho, academia…) ocupam
 * a grade e deixam claro o horário que sobra para estudar em cada dia.
 */
export function RotinaPage() {
  const { dados } = useDados()
  const [editando, setEditando] = useState<Partial<BlocoRotina> | null>(null)
  const hoje = new Date()
  const [diaLivre, setDiaLivre] = useState(hoje.getDay())
  const segunda = deISO(inicioDaSemana(hoje))
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
    // "Sem registro": horas acordadas (8h às 23h) sem nenhum bloco, na semana.
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
          <Button variant="outline" className={BOTAO} onClick={() => setEditando({})}>
            + Bloco recorrente
          </Button>
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
            Sem registro <b className="font-semibold">{semRegistro}h</b>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map(({ dia, curto }) => (
            <button
              key={dia}
              type="button"
              aria-pressed={dia === diaLivre}
              onClick={() => setDiaLivre(dia)}
              className={cn(
                'flex h-8 items-center gap-1.5 border-2 border-contorno px-2.5 text-[0.6875rem] font-semibold tracking-[0.06em] uppercase',
                dia === diaLivre ? 'bg-foreground text-background' : 'bg-card shadow-bloco-sm hover:bg-amarelo hover:text-tinta',
              )}
            >
              {curto} <span className="font-normal normal-case">{formatarMeta(livreNoDia(dados.blocos, dia).totalMin * 60_000)} livres</span>
            </button>
          ))}
        </div>
        <LivreNoDia nome={DIAS_SEMANA.find((d) => d.dia === diaLivre)!.nome} livre={livreNoDia(dados.blocos, diaLivre)} />
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

/** O que sobra para estudar no dia, depois dos compromissos. Não é meta nem horário marcado: é o espaço que existe. */
function LivreNoDia({ nome, livre }: { nome: string; livre: ReturnType<typeof livreNoDia> }) {
  return (
    <CaixaDestaque fundo="bg-foco-suave" faixa="border-l-azul">
      <p>
        <span className={cn(ROTULO, 'mr-2')}>Livre para estudo · {nome}</span>
        {livre.intervalos.length === 0 ? (
          'Nenhum horário livre entre os compromissos.'
        ) : (
          <>
            {livre.intervalos.map(intervalo).join(', ')}. <b>{formatarMeta(livre.totalMin * 60_000)} disponíveis.</b>
          </>
        )}
      </p>
    </CaixaDestaque>
  )
}
