import { RouterProvider } from '@tanstack/react-router'
import { SessaoProvider } from '@/features/sessao/context/SessaoProvider'
import { useLembretesRotina } from '@/features/rotina/hooks/useLembretesRotina'
import { DadosProvider } from '@/store/context/DadosProvider'
import { useAvisoRelatoFinal } from './hooks/useAvisoRelatoFinal'
import { usePreferenciasDoSistema } from './hooks/usePreferenciasDoSistema'
import { JanelaProvider } from './janela/JanelaProvider'
import { router } from './router'

/** Dados num arquivo local, a sessão do dia (que roda no Rust), o modo widget e os avisos valem para o app inteiro. */
export function Raiz() {
  return (
    <DadosProvider>
      <SessaoProvider>
        <JanelaProvider>
          <Avisos />
          <RouterProvider router={router} />
        </JanelaProvider>
      </SessaoProvider>
    </DadosProvider>
  )
}

function Avisos() {
  useLembretesRotina()
  useAvisoRelatoFinal()
  usePreferenciasDoSistema()
  return null
}
