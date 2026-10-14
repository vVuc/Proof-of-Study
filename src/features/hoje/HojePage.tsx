import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { deISO, rotuloDia, somarDias } from '@/shared/lib/datas'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { useDados } from '@/store/context/dados-context'
import { PopoverCaptura } from '@/features/sessao/components/PopoverCaptura'
import { useSessao } from '@/features/sessao/context/sessao-context'
import { CartaoObjetivos } from './components/CartaoObjetivos'
import { CartaoOntem } from './components/CartaoOntem'
import { CartaoPlay } from './components/CartaoPlay'
import { CartaoRelatoInicial } from './components/CartaoRelatoInicial'

/** A tela de abertura: o relato de ontem (se ficou pendente), o plano de hoje, o play do dia e os objetivos. */
export function HojePage() {
  const { dados } = useDados()
  const { hoje } = useSessao()
  const relatos = dados.preferencias.relatos

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.hoje}
        trilha="Plano, play e objetivos do dia"
        titulo={
          <>
            Hoje <span>{rotuloDia(deISO(hoje))}</span>
          </>
        }
        acoes={<PopoverCaptura />}
      />
      {relatos && <CartaoOntem dia={somarDias(hoje, -1)} />}
      {relatos && <CartaoRelatoInicial dia={hoje} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-4">
        <CartaoPlay dia={hoje} />
        <CartaoObjetivos dia={hoje} />
      </div>
    </div>
  )
}
