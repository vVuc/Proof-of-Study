import { Link } from '@tanstack/react-router'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { useAgora } from '@/shared/hooks/useAgora'
import { formatarDiaCurto, formatarDuracao, paraISO } from '@/shared/lib/datas'
import { useDados } from '@/store/context/dados-context'
import { diasAValidar, sessoesDoDia } from '../utils/dia'

/** Lembrete de dias com estudo e sem anotação. Não bloqueia nada: dá para seguir o dia e anotar depois. */
export function AvisoDiasAValidar() {
  const { dados } = useDados()
  const hoje = paraISO(useAgora())
  const pendentes = diasAValidar(dados, hoje)
  if (pendentes.length === 0) return null

  const [ultimo, ...outros] = pendentes
  const focoMs = sessoesDoDia(dados.sessoes, ultimo).reduce((soma, s) => soma + s.focoMs, 0)

  return (
    <CaixaDestaque fundo="bg-banco-suave" faixa="border-l-amarelo" className="flex-row flex-wrap items-center justify-between">
      <p>
        <b>O dia {formatarDiaCurto(ultimo)} está a validar.</b> {formatarDuracao(focoMs)} de estudo entram no banco de horas quando você
        anotar o que estudou{outros.length > 0 && ` (e mais ${outros.length} ${outros.length === 1 ? 'dia' : 'dias'})`}.
      </p>
      <Link
        to="/dia"
        search={{ data: ultimo }}
        className="text-xs font-semibold tracking-[0.06em] uppercase underline underline-offset-4 hover:text-vermelho"
      >
        Anotar agora
      </Link>
    </CaixaDestaque>
  )
}
