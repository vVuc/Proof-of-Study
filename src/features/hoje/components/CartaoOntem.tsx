import { Link } from '@tanstack/react-router'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { useAgora } from '@/shared/hooks/useAgora'
import { formatarDuracao, type DataISO } from '@/shared/lib/datas'
import { BOTAO } from '@/shared/lib/estilos'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import { prazoDoRelato, relatoDoDia } from '@/features/banco/utils/validacao'
import { sessoesDoDia } from '../utils/dia'

/**
 * "Como foi ontem?": se o relato final de ontem ficou pendente e ainda está no prazo, ele vem antes do plano de
 * hoje. Pular deixa o tempo pendente (dá para validar depois com a anotação da sessão, no Banco).
 */
export function CartaoOntem({ dia }: { dia: DataISO }) {
  const { dados, dispatch } = useDados()
  const agora = useAgora()
  const sessoes = sessoesDoDia(dados, dia)
  const estudoMs = sessoes.reduce((s, x) => s + x.focoMs, 0)
  if (sessoes.length === 0 || relatoDoDia(dados.relatos, dia, 'final')) return null
  if (agora.getTime() >= prazoDoRelato(dia, dados.preferencias.inicioDoDiaMin)) return null

  function pular() {
    dispatch({
      tipo: 'relato/salvar',
      relato: { id: crypto.randomUUID(), dia, momento: 'final', texto: '', origem: 'texto', criadoEm: Date.now(), atrasado: true },
    })
  }

  return (
    <CaixaDestaque fundo="bg-foco-suave" faixa="border-l-azul" className="gap-3">
      <p className="font-heading text-xl leading-tight font-extrabold uppercase">Como foi ontem?</p>
      <p className="text-sm">
        Ontem ficaram <b>{formatarDuracao(estudoMs)}</b> de estudo esperando o relato. Com ele, o tempo entra no banco de horas.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild className={BOTAO}>
          <Link to="/relato" search={{ dia }}>
            Fazer o relato de ontem
          </Link>
        </Button>
        <Button variant="outline" className={BOTAO} onClick={pular}>
          Pular
        </Button>
      </div>
    </CaixaDestaque>
  )
}
