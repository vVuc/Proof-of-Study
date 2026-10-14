import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAgora } from '@/shared/hooks/useAgora'
import { diaLogico } from '@/shared/lib/datas'
import { registrarEvento } from '@/shared/lib/eventos'
import { useDados } from '@/store/context/dados-context'
import type { Trecho } from '@/store/model/dados'
import { configuracaoDoRastreio, objetivosDaRotina, sessaoParaGravar } from '@/features/hoje/utils/dia'
import {
  configurarRastreio,
  confirmarSessao,
  definirCaptura,
  fecharDoDia,
  lerRastreio,
  marcarRecuperacaoVista,
  pausarDoDia,
  playDoDia,
  type Retrato,
} from '../api/rastreio'
import { SessaoContext, type ContextoSessao } from './sessao-context'

/**
 * A sessão do dia roda no Rust (que também a guarda no diário). Aqui a tela lê o estado a cada segundo, só com os
 * trechos novos, manda as regras e preferências quando mudam e grava no `dados.json` as sessões que o Rust fecha.
 * Fica na raiz do app para o widget, a barra lateral e os avisos funcionarem em qualquer tela.
 */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const { dados, dispatch, quandoGravado } = useDados()
  const [retrato, setRetrato] = useState<Retrato | null>(null)
  const [trechos, setTrechos] = useState<Trecho[]>([])
  const trechosRef = useRef<Trecho[]>([])
  const sessaoId = useRef<string | null>(null)
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  const agora = useAgora(60_000)
  const hoje = diaLogico(agora.getTime(), dados.preferencias.inicioDoDiaMin)
  const dia = retrato?.sessao?.dia ?? hoje

  // Uma leitura por vez: cada uma parte dos trechos que a anterior deixou.
  const ler = useCallback(() => {
    const leitura = fila.current.then(async () => {
      const lido = await lerRastreio(trechosRef.current.length)
      const id = lido.sessao?.id ?? null
      const anteriores = id === sessaoId.current ? trechosRef.current.slice(0, lido.base) : []
      sessaoId.current = id
      trechosRef.current = [...anteriores, ...lido.trechos]
      setTrechos(trechosRef.current)
      setRetrato(lido)
    })
    fila.current = leitura.catch(() => undefined)
    return leitura
  }, [])

  useEffect(() => {
    void ler()
    const intervalo = window.setInterval(() => void ler(), 1000)
    const aoVoltar = () => document.visibilityState === 'visible' && void ler()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [ler])

  // Regras, termos e preferências valem na hora, também para a bandeja e o atalho global.
  const config = useMemo(() => configuracaoDoRastreio(dados, dia), [dados, dia])
  const configTexto = JSON.stringify(config)
  useEffect(() => {
    void configurarRastreio(JSON.parse(configTexto))
  }, [configTexto])

  // Os objetivos que a rotina sugere para hoje entram sozinhos (os pulados não voltam).
  const novosDaRotina = useMemo(() => objetivosDaRotina(dados, hoje), [dados, hoje])
  useEffect(() => {
    if (novosDaRotina.length > 0) dispatch({ tipo: 'objetivos/salvar', objetivos: novosDaRotina })
  }, [novosDaRotina, dispatch])

  // Sessões fechadas pelo Rust: grava no `dados.json` e só então confirma, para o Rust tirar do diário.
  const entregando = useRef(new Set<string>())
  useEffect(() => {
    for (const fechada of retrato?.fechadas ?? []) {
      if (entregando.current.has(fechada.id)) continue
      entregando.current.add(fechada.id)
      if (!dados.sessoes.some((s) => s.id === fechada.id)) {
        const sessao = sessaoParaGravar(fechada, dados)
        dispatch({ tipo: 'sessao/salvar', sessao })
        registrarEvento('sessao.gravada', { dia: sessao.dia, trechos: sessao.trechos.length, pausas: sessao.pausas.length })
      }
      void quandoGravado((d) => d.sessoes.some((s) => s.id === fechada.id))
        .then(() => confirmarSessao(fechada.id))
        .finally(() => entregando.current.delete(fechada.id))
    }
  }, [retrato?.fechadas, dados, dispatch, quandoGravado])

  const agir = useCallback(
    async (acao: () => Promise<unknown>) => {
      await acao()
      await ler()
    },
    [ler],
  )

  const valor = useMemo<ContextoSessao>(
    () => ({
      fase: retrato?.fase ?? null,
      retrato,
      sessao: retrato?.sessao ?? null,
      trechos,
      pausas: retrato?.pausas ?? [],
      hoje,
      play: () =>
        agir(async () => {
          // A configuração vai antes, para o primeiro play logo depois de abrir o app.
          await configurarRastreio(config)
          await playDoDia()
        }),
      pausar: () => agir(pausarDoDia),
      alternarCaptura: () => agir(() => definirCaptura(!retrato?.captura)),
      fecharDia: () => agir(fecharDoDia),
      dispensarRecuperacao: () => agir(marcarRecuperacaoVista),
    }),
    [retrato, trechos, hoje, agir, config],
  )

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>
}
