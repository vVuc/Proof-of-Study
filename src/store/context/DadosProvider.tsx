import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { TelaCentralizada } from '@/shared/components/TelaCentralizada'
import { registrarEvento } from '@/shared/lib/eventos'
import { dadosIniciais, type Dados } from '../model/dados'
import { dadosReducer } from '../reducer/dados-reducer'
import { carregarDados, gravarDados, type Carregados } from '../repositorio/armazenamento'
import { DadosContext } from './dados-context'

/** Gravação acima disso vai para o log (o `dados.json` é regravado inteiro a cada mudança). */
const GRAVACAO_LENTA_MS = 200

interface Espera {
  condicao: (dados: Dados) => boolean
  resolver: () => void
}

/**
 * O estado vive num reducer (cache em memória do que está salvo). Cada mudança entra numa fila de gravação,
 * que roda na ordem; a gravação seguinte sempre leva o estado mais recente.
 */
export function DadosProvider({ children }: { children: ReactNode }) {
  const [dados, dispatch] = useReducer(dadosReducer, undefined, dadosIniciais)
  const [carregado, setCarregado] = useState(false)
  const [migracao, setMigracao] = useState<Carregados['migracao']>(null)
  const [erro, setErro] = useState<string | null>(null)
  const fila = useRef(Promise.resolve())
  const ultimoSalvo = useRef<Dados | null>(null)
  const esperas = useRef<Espera[]>([])

  useEffect(() => {
    carregarDados()
      .then((lidos) => {
        // Dados convertidos de um formato antigo são gravados já no novo (a cópia do antigo ficou guardada).
        ultimoSalvo.current = lidos.migracao ? null : lidos.dados
        if (lidos.migracao) registrarEvento('dados.migrados', { de: lidos.migracao.de, sessoes: lidos.dados.sessoes.length })
        setMigracao(lidos.migracao)
        dispatch({ tipo: 'dados/carregar', dados: lidos.dados })
        setCarregado(true)
      })
      .catch((e: unknown) => {
        registrarEvento('dados.erro_ao_ler', { erro: String(e) }, 'erro')
        setErro(e instanceof Error ? e.message : String(e))
      })
  }, [])

  // Espera um instante sem mudanças (a anotação muda a cada tecla) e grava o estado mais recente.
  useEffect(() => {
    if (!carregado || dados === ultimoSalvo.current) return
    const espera = window.setTimeout(() => {
      ultimoSalvo.current = dados
      fila.current = fila.current
        .then(async () => {
          const inicio = performance.now()
          await gravarDados(dados)
          const duracao = Math.round(performance.now() - inicio)
          if (duracao > GRAVACAO_LENTA_MS) registrarEvento('dados.gravacao_lenta', { ms: duracao, sessoes: dados.sessoes.length }, 'aviso')
          // Quem esperava esta gravação (ex.: a sessão fechada que sai do diário do Rust) segue.
          esperas.current = esperas.current.filter((e) => (e.condicao(dados) ? (e.resolver(), false) : true))
        })
        .catch((e: unknown) => {
          registrarEvento('dados.erro_ao_gravar', { erro: String(e) }, 'erro')
          setErro(String(e))
        })
    }, 300)
    return () => window.clearTimeout(espera)
  }, [dados, carregado])

  const quandoGravado = useCallback(
    (condicao: (dados: Dados) => boolean) =>
      new Promise<void>((resolver) => {
        if (ultimoSalvo.current && ultimoSalvo.current === dados && condicao(dados)) return resolver()
        esperas.current.push({ condicao, resolver })
      }),
    [dados],
  )

  if (erro)
    return <TelaCentralizada titulo="Algo deu errado" descricao={`Não foi possível ler ou salvar os dados: ${erro}`} />
  if (!carregado) return <TelaCentralizada titulo="Abrindo" descricao="Carregando seus dados…" />

  return (
    <DadosContext.Provider value={{ dados, dispatch, migracao, dispensarMigracao: () => setMigracao(null), quandoGravado }}>
      {children}
    </DadosContext.Provider>
  )
}
