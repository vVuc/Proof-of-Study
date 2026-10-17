import { useCallback, useEffect, useRef, useState } from 'react'
import { useIA } from '@/features/ia/hooks/useIA'
import { useSessao } from '@/features/sessao/context/sessao-context'
import { registrarEvento } from '@/shared/lib/eventos'
import { useDados } from '@/store/context/dados-context'
import { cancelarVoz, iniciarVoz, ouvirErro, ouvirFim, ouvirParcial, pararVoz } from '../api/voz'
import { juntarTranscricao, mensagemDaVoz, vocabularioDaVoz } from '../utils/voz'

/** A fala em andamento num campo: o texto que já estava escrito e o último texto da voz. */
interface Fala {
  antes: string
  parcial: string
}

/**
 * A voz ao vivo de um campo de relato. "Falar" começa a gravação no Rust, e o texto da fala entra no campo enquanto a
 * pessoa fala, depois do que já estava escrito. "Parar" troca o parcial pelo texto final. Se a conexão cair, o texto
 * até ali fica no campo. Só com a IA ligada; desligá-la no meio encerra a gravação.
 */
export function useVoz(valor: string, aoFalar: (texto: string) => void) {
  const { dados } = useDados()
  const { hoje } = useSessao()
  const { ligada } = useIA()
  const [gravando, setGravando] = useState(false)
  const [parando, setParando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Os eventos valem para o app inteiro: só o campo que começou a fala os usa.
  const fala = useRef<Fala | null>(null)
  const destino = useRef(aoFalar)
  useEffect(() => {
    destino.current = aoFalar
  })

  const terminar = useCallback((final: string) => {
    const atual = fala.current
    if (!atual) return
    fala.current = null
    setGravando(false)
    destino.current(juntarTranscricao(atual.antes, final, atual.parcial))
  }, [])

  useEffect(() => {
    const desligar = [
      ouvirParcial((texto) => {
        const atual = fala.current
        if (!atual) return
        atual.parcial = texto
        destino.current(juntarTranscricao(atual.antes, '', texto))
      }),
      ouvirErro((e) => {
        if (!fala.current) return
        // O texto até aqui já está no campo e continua lá.
        fala.current = null
        setGravando(false)
        setErro(mensagemDaVoz(e, 'fala'))
        registrarEvento('voz.erro', { etapa: 'fala', tipo: e.tipo }, 'aviso')
      }),
      ouvirFim(terminar),
    ]
    return () => {
      for (const promessa of desligar) void promessa.then((parar) => parar(), () => undefined)
    }
  }, [terminar])

  const cancelar = useCallback(() => {
    if (!fala.current) return
    fala.current = null
    setGravando(false)
    void cancelarVoz().catch(() => undefined)
  }, [])

  // IA desligada no meio da fala (ou o campo saiu da tela): a gravação acaba.
  useEffect(() => {
    if (!ligada) cancelar()
  }, [ligada, cancelar])
  useEffect(() => cancelar, [cancelar])

  const falar = useCallback(async () => {
    if (fala.current || !ligada) return
    setErro(null)
    fala.current = { antes: valor, parcial: '' }
    setGravando(true)
    try {
      await iniciarVoz(vocabularioDaVoz(dados, hoje))
    } catch (e) {
      fala.current = null
      setGravando(false)
      setErro(mensagemDaVoz(e, 'inicio'))
      registrarEvento('voz.erro', { etapa: 'inicio' }, 'aviso')
    }
  }, [valor, ligada, dados, hoje])

  const parar = useCallback(async () => {
    if (!fala.current) return
    setParando(true)
    try {
      terminar(await pararVoz())
    } catch {
      // Sem o texto final, o parcial fica.
      terminar('')
    } finally {
      setParando(false)
    }
  }, [terminar])

  return {
    /** A preferência "Falar o relato": sem ela, o campo não mostra a voz. */
    mostrar: dados.preferencias.voz,
    /** A IA está ligada; sem ela, o "Falar" fica desabilitado (VOZ-06). */
    disponivel: ligada,
    gravando,
    /** Esperando o texto final depois de "Parar". */
    parando,
    erro,
    falar,
    parar,
  }
}
