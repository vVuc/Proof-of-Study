import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { paraISO } from '@/shared/lib/datas'
import { useDados } from '@/store/context/dados-context'
import { SEM_MATERIA, type SessaoAtual, type Trecho } from '@/store/model/dados'
import { excluirImagem } from '@/features/imagens/api/imagens'
import { dataDaSessao, diaDe, duracaoRegistrada, tempoNoDia } from '@/features/dia/utils/dia'
import { definirCaptura, iniciarRastreio, lerRastreio, pararRastreio, type Retrato } from '../api/rastreio'
import { ordenarRegras } from '../utils/classificacao'
import { ajustesMudados, resumir } from '../utils/resumo'
import { SessaoContext, type ContextoSessao, type Etapa } from './sessao-context'

/** De quanto em quanto tempo os trechos vão para o arquivo, para não perder o tempo se o app fechar. */
const COPIA_A_CADA_MS = 30_000

/**
 * O cronômetro roda no Rust; aqui a tela lê o estado a cada segundo e guarda o trecho em `dados.sessaoAtual`.
 * Cada play até o pause (ou a troca de objetivo, ou a virada do dia) vira uma `Sessao`; o relógio de um objetivo
 * é a soma das sessões dele no dia, por isso o play continua de onde parou, mesmo depois de fechar o app.
 * Fica na raiz do app para o widget, a barra lateral e o aviso funcionarem em qualquer tela.
 */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const { dados, dispatch } = useDados()
  const [retrato, setRetrato] = useState<Retrato | null>(null)
  const sessao = dados.sessaoAtual
  const ultimaCopia = useRef(0)
  const guardando = useRef(false)

  const ler = useCallback(async () => {
    const lido = await lerRastreio()
    setRetrato(lido)
    return lido
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

  /** Transforma o trecho do cronômetro numa sessão salva (se contou algum tempo) e libera o relógio. */
  const guardar = useCallback(
    (atual: SessaoAtual, trechos: Trecho[]) => {
      if (duracaoRegistrada(trechos) > 0) {
        const resumo = resumir(trechos, dados.regras, atual.ajustes)
        dispatch({
          tipo: 'sessao/salvar',
          sessao: {
            id: atual.id,
            materiaId: atual.materiaId,
            inicio: atual.inicio,
            fim: trechos.at(-1)?.fim ?? atual.inicio,
            duracaoPlanejadaMin: 0,
            trechos,
            ajustes: ajustesMudados(resumo.grupos, atual.ajustes ?? {}),
            focoMs: resumo.focoMs,
            foraMs: resumo.foraMs,
            anotacao: atual.anotacao?.trim() ?? '',
            imagens: atual.imagens ?? [],
          },
        })
      } else {
        atual.imagens?.forEach((nome) => void excluirImagem(nome))
      }
      dispatch({ tipo: 'sessaoAtual/definir', sessao: null })
    },
    [dados.regras, dispatch],
  )

  // Ao abrir: o app foi fechado com o cronômetro rodando (guarda a cópia de segurança), ou o Rust registra sem
  // sessão salva (ex.: dados apagados) e para, para não registrar à toa.
  const conferido = useRef(false)
  useEffect(() => {
    if (!retrato || conferido.current) return
    conferido.current = true
    if (sessao && retrato.fase === 'parado') guardar(sessao, sessao.trechos)
    if (!sessao && retrato.fase !== 'parado') void pararRastreio().then(ler)
  }, [retrato, sessao, guardar, ler])

  // Virada do dia: o Rust parou na meia-noite; o trecho vai para o dia em que começou.
  useEffect(() => {
    if (retrato?.fase !== 'concluido' || !sessao || guardando.current) return
    guardando.current = true
    void (async () => {
      try {
        guardar(sessao, await pararRastreio())
        await ler()
      } finally {
        guardando.current = false
      }
    })()
  }, [retrato, sessao, guardar, ler])

  // Cópia de segurança dos trechos.
  useEffect(() => {
    if (!retrato || !sessao || (retrato.fase !== 'rodando' && retrato.fase !== 'ocioso')) return
    const agora = Date.now()
    if (agora - ultimaCopia.current >= COPIA_A_CADA_MS) {
      ultimaCopia.current = agora
      dispatch({ tipo: 'sessaoAtual/atualizar', mudancas: { trechos: retrato.trechos } })
    }
  }, [retrato, sessao, dispatch])

  const etapa: Etapa | null = !retrato
    ? null
    : !sessao
      ? 'pronto'
      : retrato.fase === 'rodando'
        ? 'rodando'
        : retrato.fase === 'ocioso'
          ? 'ocioso'
          : 'pronto'
  const trechos = useMemo(
    () => (sessao && retrato && retrato.fase !== 'parado' ? retrato.trechos : (sessao?.trechos ?? [])),
    [sessao, retrato],
  )

  const tempoHoje = useCallback(
    (materiaId: string) => {
      const hoje = paraISO(new Date())
      const registrado = tempoNoDia(dados.sessoes, materiaId, hoje)
      if (!sessao || sessao.materiaId !== materiaId || dataDaSessao(sessao) !== hoje) return registrado
      return registrado + (etapa === 'rodando' ? (retrato?.decorridoMs ?? 0) : duracaoRegistrada(trechos))
    },
    [dados.sessoes, sessao, etapa, retrato, trechos],
  )

  const pausar = useCallback(async () => {
    if (!sessao) return
    guardar(sessao, await pararRastreio())
    await ler()
  }, [sessao, guardar, ler])

  const tocar = useCallback(
    async (materiaId: string) => {
      if (sessao?.materiaId === materiaId && (etapa === 'rodando' || etapa === 'ocioso')) return
      if (sessao) guardar(sessao, await pararRastreio())

      const materia = dados.materias.find((m) => m.id === materiaId)
      const p = dados.preferencias
      await iniciarRastreio({
        limiteAusenciaSeg: p.limiteAusenciaMin * 60,
        avisoDistracaoSeg: p.avisoDistracao ? p.avisoDistracaoSeg : null,
        regras: ordenarRegras(dados.regras).map(({ rotulo, termos, campo, tipo }) => ({ rotulo, termos, campo, tipo })),
        materia: materia?.nome ?? 'o estudo',
      })
      // Lê antes de guardar a sessão, para a tela não mostrar o retrato antigo.
      const lido = await lerRastreio()
      ultimaCopia.current = Date.now()
      setRetrato(lido)
      dispatch({ tipo: 'sessaoAtual/definir', sessao: { id: crypto.randomUUID(), materiaId, inicio: Date.now(), trechos: [] } })

      // Matéria fora do plano entra no dia como objetivo extra: é redirecionamento, não fracasso.
      const dia = diaDe(dados.dias, paraISO(new Date()))
      if (materiaId !== SEM_MATERIA && !dia.objetivos.includes(materiaId) && !dia.extras.includes(materiaId)) {
        dispatch({ tipo: 'dia/salvar', dia: { ...dia, extras: [...dia.extras, materiaId] } })
      }
    },
    [sessao, etapa, guardar, dados.materias, dados.preferencias, dados.regras, dados.dias, dispatch],
  )

  const valor = useMemo<ContextoSessao>(
    () => ({
      etapa,
      retrato,
      sessao,
      trechos,
      tempoHoje,
      tocar,
      pausar,
      alternarCaptura: async () => {
        await definirCaptura(!retrato?.captura)
        await ler()
      },
    }),
    [etapa, retrato, sessao, trechos, tempoHoje, tocar, pausar, ler],
  )

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>
}
