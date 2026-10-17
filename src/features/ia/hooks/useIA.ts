import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useDados } from '@/store/context/dados-context'
import { configurarIA, gerarComIA, lerEstadoDaChave, type EstadoChave, type PedidoIA, type RespostaIA, type TipoErroIA } from '../api/ia'
import { mensagemDoErro, tipoDoErro } from '../constants/mensagens'

export type TipoPedido = PedidoIA['tipo']

/** `descartado`: outra chamada do mesmo tipo já estava em andamento, ou a IA foi desligada no meio. */
export type Resultado = { tipo: 'ok'; resposta: RespostaIA } | { tipo: 'erro'; erro: TipoErroIA; mensagem: string } | { tipo: 'descartado' }

export const SEM_CHAVE: EstadoChave = { salva: false, final: null, cofre: null }

/** Um estado só para o app inteiro: a chave (lida do Rust uma vez), se a IA vale agora e as chamadas em andamento. */
interface Compartilhado {
  chave: EstadoChave
  ligada: boolean
  andamento: TipoPedido[]
}

let atual: Compartilhado = { chave: SEM_CHAVE, ligada: false, andamento: [] }
let chaveLida = false
const ouvintes = new Set<() => void>()

function mudar(mudancas: Partial<Compartilhado>) {
  atual = { ...atual, ...mudancas }
  for (const ouvinte of ouvintes) ouvinte()
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  if (!chaveLida) {
    chaveLida = true
    // Fora do Tauri (ou num erro), fica sem chave.
    lerEstadoDaChave().then(
      (chave) => mudar({ chave }),
      () => undefined,
    )
  }
  return () => {
    ouvintes.delete(ouvinte)
  }
}

const ler = () => atual

/**
 * A IA do app: ligada só com a preferência "Usar IA (Gemini)" e uma chave salva. Avisa o Rust a cada mudança, deixa
 * uma chamada de cada tipo por vez (INSD-03) e descarta a resposta que chega depois de a IA ser desligada.
 */
export function useIA() {
  const { dados } = useDados()
  const estado = useSyncExternalStore(assinar, ler)
  const ligada = dados.preferencias.ia && estado.chave.salva

  useEffect(() => {
    mudar({ ligada })
    configurarIA(ligada).catch(() => undefined)
  }, [ligada])

  const gerar = useCallback(
    async (pedido: PedidoIA): Promise<Resultado> => {
      if (!ligada || !atual.ligada) return { tipo: 'erro', erro: 'Desligada', mensagem: mensagemDoErro({ tipo: 'Desligada' }) }
      if (atual.andamento.includes(pedido.tipo)) return { tipo: 'descartado' }
      mudar({ andamento: [...atual.andamento, pedido.tipo] })
      try {
        const resposta = await gerarComIA(pedido)
        return atual.ligada ? { tipo: 'ok', resposta } : { tipo: 'descartado' }
      } catch (e) {
        return atual.ligada ? { tipo: 'erro', erro: tipoDoErro(e), mensagem: mensagemDoErro(e) } : { tipo: 'descartado' }
      } finally {
        mudar({ andamento: atual.andamento.filter((t) => t !== pedido.tipo) })
      }
    },
    [ligada],
  )

  return {
    ligada,
    chave: estado.chave,
    /** Uma chamada desse tipo está em andamento. */
    emAndamento: (tipo: TipoPedido) => estado.andamento.includes(tipo),
    gerar,
    /** Depois de salvar ou remover a chave nas opções. */
    definirChave: (chave: EstadoChave) => mudar({ chave }),
  }
}
