import { Outlet } from '@tanstack/react-router'
import { AvisoHoraDeEstudo } from '@/features/rotina/components/AvisoHoraDeEstudo'
import { Widget } from '@/features/sessao/components/Widget'
import { useJanela } from '../janela/janela-context'
import { AvisoMigracao, AvisoRecuperacao } from './Avisos'
import { BarraLateral } from './BarraLateral'
import { BarraTitulo } from './BarraTitulo'

/** Layout 1a: barra de título, barra lateral com as telas e a meta, e a tela aberta à direita. */
export function AppLayout() {
  const { widget } = useJanela()
  if (widget) return <Widget />

  return (
    <div className="flex h-svh flex-col overflow-hidden border-2 border-contorno bg-background text-foreground tabular-nums">
      <BarraTitulo />
      <div className="flex min-h-0 flex-1">
        <BarraLateral />
        <main className="relative min-w-0 flex-1 overflow-auto p-4">
          <AvisoMigracao />
          <Outlet />
        </main>
      </div>
      <div className="absolute right-6 bottom-6 z-40 flex w-[330px] flex-col gap-3">
        <AvisoRecuperacao />
        <AvisoHoraDeEstudo />
      </div>
    </div>
  )
}
