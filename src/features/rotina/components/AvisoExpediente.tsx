import { useNavigate } from '@tanstack/react-router'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { BOTAO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import { mostrarAvisoExpediente } from '../utils/expediente'

/**
 * No relato final de um dia com trabalho, quando a Rotina não tem horário de Trabalho: sugere cadastrar o horário,
 * com o link para a Rotina. "Não mostrar de novo" vale para sempre.
 */
export function AvisoExpediente({ trabalhoMs }: { trabalhoMs: number }) {
  const { dados, dispatch } = useDados()
  const navigate = useNavigate()
  const p = dados.preferencias
  if (!mostrarAvisoExpediente(dados.blocos, trabalhoMs, p.ocultarAvisoExpediente)) return null

  return (
    <CaixaDestaque>
      <p>Cadastre seus horários de trabalho na Rotina para o app separar trabalho e estudo sozinho.</p>
      <div className="flex flex-wrap gap-2.5">
        <Button className={cn(BOTAO, 'h-9 px-3 text-[0.6875rem]')} onClick={() => void navigate({ to: '/rotina' })}>
          Abrir a Rotina
        </Button>
        <Button
          variant="outline"
          className={cn(BOTAO, 'h-9 px-3 text-[0.6875rem]')}
          onClick={() => dispatch({ tipo: 'preferencias/salvar', preferencias: { ...p, ocultarAvisoExpediente: true } })}
        >
          Não mostrar de novo
        </Button>
      </div>
    </CaixaDestaque>
  )
}
