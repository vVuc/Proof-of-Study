import { useState } from 'react'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { EstadoVazio } from '@/shared/components/EstadoVazio'
import { PontoCor } from '@/shared/components/PontoCor'
import { useAgora } from '@/shared/hooks/useAgora'
import { rotuloDia } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { Dia } from '@/store/model/dados'
import { DialogMateria } from '@/features/materias/components/DialogMateria'
import { AvisoDiasAValidar } from './AvisoDiasAValidar'

/** O plano do dia, na primeira abertura do dia: o que quer fazer (texto livre) e as matérias de hoje, sem horários. */
export function TelaPlano({ dia }: { dia: Dia }) {
  const { dados, dispatch } = useDados()
  const [plano, setPlano] = useState(dia.plano)
  const [objetivos, setObjetivos] = useState(dia.objetivos)
  const [criando, setCriando] = useState(false)
  const ativas = dados.materias.filter((m) => !m.arquivada)
  const agora = useAgora()

  const alternar = (id: string) => setObjetivos((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]))
  const salvar = (mudancas: Partial<Dia>) => dispatch({ tipo: 'dia/salvar', dia: { ...dia, ...mudancas, planoFeito: true } })

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.sessao}
        trilha={rotuloDia(agora)}
        titulo={
          <>
            Plano <span>do dia</span>
          </>
        }
      />
      <AvisoDiasAValidar />

      {ativas.length === 0 ? (
        <EstadoVazio
          titulo="Ainda não há matérias"
          descricao="Cadastre o que você estuda (Inglês, Blender…) para escolher os objetivos de hoje."
          acao={
            <Button className={BOTAO} onClick={() => setCriando(true)}>
              + Nova matéria
            </Button>
          }
        />
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={ROTULO}>O que você quer fazer hoje?</span>
            <textarea
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              placeholder="Ex.: revisar verbos irregulares e terminar a modelagem da caneca"
              className="min-h-[110px] resize-y border-2 border-input bg-card p-3 text-sm leading-normal outline-none focus-visible:shadow-[3px_3px_0_0_var(--ring)]"
              autoFocus
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className={ROTULO}>Objetivos de hoje</span>
            <div className="flex flex-wrap gap-2.5">
              {ativas.map((m) => {
                const marcada = objetivos.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => alternar(m.id)}
                    className={cn(
                      'flex h-9 items-center gap-2 border-2 border-contorno px-3 text-xs font-semibold tracking-[0.06em] uppercase transition-[color,background-color,box-shadow,translate] duration-100',
                      marcada ? 'translate-x-[2px] translate-y-[2px] bg-foreground text-background' : 'bg-card shadow-bloco-sm hover:bg-amarelo hover:text-tinta',
                    )}
                  >
                    <PontoCor cor={m.cor} />
                    {m.nome}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="text-xs font-semibold tracking-[0.06em] uppercase underline underline-offset-4 hover:text-vermelho"
              >
                + Matéria
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Sem horário: é o que você quer estudar hoje, na ordem e no tempo que der.</p>
          </div>

          <div className="flex gap-3 border-t-2 border-contorno pt-3">
            <Button className={BOTAO} onClick={() => salvar({ plano: plano.trim(), objetivos })}>
              Confirmar plano
            </Button>
            <Button variant="outline" className={BOTAO} onClick={() => salvar({})}>
              Pular
            </Button>
          </div>
        </>
      )}

      <DialogMateria materia={criando ? 'nova' : null} onClose={() => setCriando(false)} />
    </div>
  )
}
