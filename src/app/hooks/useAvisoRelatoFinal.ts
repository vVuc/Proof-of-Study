import { useEffect } from 'react'
import { inicioDoDiaLogico } from '@/shared/lib/datas'
import { useDados } from '@/store/context/dados-context'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { sessoesDoDia } from '@/features/hoje/utils/dia'
import { agendarAviso, cancelarAviso } from '@/features/sessao/api/rastreio'
import { useSessao } from '@/features/sessao/context/sessao-context'

const ID = 'relato-final'

/**
 * Agenda no Rust o aviso do relato final de hoje: só se houve sessão no dia e ainda não há relato. Com o app na
 * bandeja, o WebView não roda timers, por isso o aviso fica com o Rust.
 */
export function useAvisoRelatoFinal() {
  const { dados } = useDados()
  const { hoje, sessao } = useSessao()
  const p = dados.preferencias
  const houveSessao = sessao?.dia === hoje || sessoesDoDia(dados, hoje).length > 0
  const relatado = !!relatoDoDia(dados.relatos, hoje, 'final')

  useEffect(() => {
    // O horário do aviso pertence ao dia lógico: com o dia virando às 4h, 1h da manhã é o fim do mesmo dia.
    const minuto = p.relatoFinalMin < p.inicioDoDiaMin ? p.relatoFinalMin + 24 * 60 : p.relatoFinalMin
    const em = inicioDoDiaLogico(hoje, 0) + minuto * 60_000
    if (p.relatos && p.avisoRelatoFinal && houveSessao && !relatado && em > Date.now()) {
      void agendarAviso(ID, em, 'Como foi o dia?', 'Faça o relato final: leva um minuto e valida as horas de hoje no banco.')
    } else {
      void cancelarAviso(ID)
    }
  }, [hoje, houveSessao, relatado, p.relatos, p.avisoRelatoFinal, p.relatoFinalMin, p.inicioDoDiaMin])
}
