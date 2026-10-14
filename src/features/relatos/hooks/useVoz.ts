import { useCallback, useEffect, useState } from 'react'
import { registrarEvento } from '@/shared/lib/eventos'
import { useDados } from '@/store/context/dados-context'
import { baixarModelo, cancelarVoz, gravarVoz, lerVoz, pararVoz, type EstadoVoz } from '../api/voz'

const INICIAL: EstadoVoz = { disponivel: false, modelo: 'ausente', progresso: 0, gravando: false, transcrevendo: false, erro: null }

/** A voz do relato: grava, para e devolve o texto. Desligada nas opções ou sem suporte no app, fica indisponível. */
export function useVoz() {
  const { dados } = useDados()
  const { voz: ligada, modeloVoz } = dados.preferencias
  const [estado, setEstado] = useState<EstadoVoz>(INICIAL)
  const [erro, setErro] = useState<string | null>(null)

  const ler = useCallback(async () => setEstado(await lerVoz(modeloVoz)), [modeloVoz])

  useEffect(() => {
    if (ligada) void ler()
  }, [ligada, ler])

  // Durante o download e a gravação, o estado muda sem a tela pedir.
  const acompanhando = estado.modelo === 'baixando' || estado.gravando || estado.transcrevendo
  useEffect(() => {
    if (!acompanhando) return
    const id = window.setInterval(() => void ler(), 500)
    return () => window.clearInterval(id)
  }, [acompanhando, ler])

  const tentar = useCallback(
    async <T,>(acao: () => Promise<T>): Promise<T | null> => {
      setErro(null)
      try {
        return await acao()
      } catch (e) {
        const mensagem = String(e)
        setErro(mensagem)
        registrarEvento('voz.erro', { etapa: 'acao' }, 'aviso')
        return null
      } finally {
        void ler()
      }
    },
    [ler],
  )

  return {
    disponivel: ligada && estado.disponivel,
    estado,
    erro: erro ?? estado.erro,
    baixar: () => tentar(() => baixarModelo(modeloVoz)),
    gravar: () => tentar(gravarVoz),
    /** Para e devolve o texto (ou `null` se falhar). */
    parar: () => tentar(() => pararVoz(modeloVoz)),
    cancelar: () => tentar(cancelarVoz),
  }
}
