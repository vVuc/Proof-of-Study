import { useState } from 'react'
import { BOTAO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Pause, Play } from '@/shared/ui/icones'
import { useSessao } from '../context/sessao-context'

/** O único botão do dia: play (abre ou retoma a sessão) ou pausa. */
export function BotaoPlay({ grande, className }: { grande?: boolean; className?: string }) {
  const { fase, play, pausar } = useSessao()
  const [ocupado, setOcupado] = useState(false)
  if (!fase) return null
  const pausando = fase === 'rodando' || fase === 'ausente'
  const rotulo = pausando ? 'Pausar' : fase === 'pausado' ? 'Continuar' : 'Play no dia'

  async function clicar() {
    setOcupado(true)
    try {
      await (pausando ? pausar() : play())
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Button
      variant={pausando ? 'outline' : 'default'}
      disabled={ocupado}
      onClick={() => void clicar()}
      className={cn(BOTAO, grande && 'h-12 px-6 text-[0.8125rem]', className)}
    >
      {pausando ? <Pause /> : <Play />}
      {rotulo}
    </Button>
  )
}
