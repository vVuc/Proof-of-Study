import { useState } from 'react'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { formatarDuracao } from '@/shared/lib/datas'
import { CARTAO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { useDados } from '@/store/context/dados-context'
import type { Sessao } from '@/store/model/dados'
import { rotuloDaSessao } from '@/features/sessao/utils/rotulos'
import { temAnotacao } from '@/features/sessao/utils/resumo'
import { diaValidado, focoDaMateria, relatoDoDia } from '../utils/validacao'
import { DialogSessao } from './DialogSessao'

/** As sessões da semana com estudo desta matéria, a evidência de cada uma (relato do dia ou anotação) e o tempo. */
export function CardSessoes({ sessoes, materiaId }: { sessoes: Sessao[]; materiaId: string }) {
  const { dados } = useDados()
  const [aberta, setAberta] = useState<Sessao | null>(null)

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Sessões e evidências" faixa="bg-azul" forma={{ forma: 'circulo', cor: 'papel' }} contagem={sessoes.length} />
      {sessoes.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma sessão com esta matéria nesta semana ainda.</p>}
      {sessoes.map((s) => {
        const [dia, horario] = rotuloDaSessao(s.inicio, s.fim).split(' · ')
        const estudo = focoDaMateria(s, materiaId)
        const total = s.focoMs + s.foraMs
        const relato = relatoDoDia(dados.relatos, s.dia, 'final')
        const validadoPeloDia = diaValidado(dados, s.dia)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setAberta(s)}
            className="grid w-full grid-cols-[120px_minmax(0,1fr)_180px] items-start gap-[18px] border-t border-border px-4 py-3 text-left outline-none hover:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.8125rem] font-semibold">{dia}</span>
              <span className="text-xs text-muted-foreground">{horario}</span>
            </span>
            <span className="text-[0.8125rem] leading-normal text-pretty">
              {temAnotacao(s) ? (
                s.anotacao || <span className="text-muted-foreground">Só imagens.</span>
              ) : validadoPeloDia ? (
                <span className="line-clamp-3">
                  <span className="text-muted-foreground">Relato do dia: </span>
                  {relato?.texto}
                </span>
              ) : (
                <span className="font-semibold text-fora">Sem relato do dia nem anotação: fora do banco. Clique para anotar.</span>
              )}
              {s.imagens.length > 0 && (
                <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="h-2.5 w-3 border-[1.5px] border-contorno" />
                  {s.imagens.length === 1 ? '1 imagem' : `${s.imagens.length} imagens`}
                </span>
              )}
            </span>
            <span className="flex flex-col gap-1.5">
              <span aria-hidden className="flex h-3 gap-0.5 border-2 border-contorno bg-contorno">
                <span className="bg-azul" style={{ width: `${total ? (s.focoMs / total) * 100 : 0}%` }} />
                <span className={cn('flex-1', s.foraMs > 0 ? 'bg-vermelho' : 'bg-muted')} />
              </span>
              <span className="flex justify-between text-xs font-medium">
                <span className="text-foco">{formatarDuracao(estudo)} aqui</span>
                <span className="text-fora">{formatarDuracao(s.foraMs)} fora</span>
              </span>
            </span>
          </button>
        )
      })}
      <DialogSessao sessao={aberta} onClose={() => setAberta(null)} />
    </div>
  )
}
