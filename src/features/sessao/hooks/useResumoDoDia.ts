import { useMemo } from 'react'
import type { DataISO } from '@/shared/lib/datas'
import { useDados } from '@/store/context/dados-context'
import type { Ajuste } from '@/store/model/dados'
import { ajustesDoDia, contextoDoDia, sessoesDoDia } from '@/features/hoje/utils/dia'
import { useSessao } from '../context/sessao-context'
import { classificar, nomeDoPrograma, ROTULO_TIPO } from '../utils/classificacao'
import { materiaDoAjuste, resumir, tipoDoAjuste } from '../utils/resumo'

/**
 * O dia inteiro num resumo só: as sessões já fechadas do dia e a sessão aberta (se for do mesmo dia), com as
 * regras, os objetivos e as correções do relato final (ou as que a tela do relato está editando).
 * Também diz como a janela ativa está contando agora.
 */
export function useResumoDoDia(dia?: DataISO, ajustesForcados?: Record<string, Ajuste>) {
  const { dados } = useDados()
  const { trechos, sessao, retrato, pausas, hoje, fase } = useSessao()
  const alvo = dia ?? sessao?.dia ?? hoje
  const aberta = sessao?.dia === alvo

  const fechadas = useMemo(() => sessoesDoDia(dados, alvo), [dados, alvo])
  const todos = useMemo(() => [...fechadas.flatMap((s) => s.trechos), ...(aberta ? trechos : [])], [fechadas, aberta, trechos])
  const contexto = useMemo(() => contextoDoDia(dados, alvo), [dados, alvo])
  const salvos = useMemo(() => ajustesDoDia(dados, alvo), [dados, alvo])
  const ajustes = ajustesForcados ?? salvos
  const resumo = useMemo(() => resumir(todos, contexto, ajustes), [todos, contexto, ajustes])
  const pausasDoDia = useMemo(() => [...fechadas.flatMap((s) => s.pausas), ...(aberta ? pausas : [])], [fechadas, aberta, pausas])

  const capturando = aberta && fase === 'rodando' && !!retrato?.captura
  const janela = retrato?.atual
  const lida = capturando && janela && (janela.titulo || janela.processo) ? janela : null
  const ausente = (retrato?.msSemUso ?? 0) >= dados.preferencias.limiteAusenciaMin * 60_000
  const classe = lida ? classificar({ ...lida, ausente, semCaptura: false }, contexto) : null
  const ajuste = classe && !classe.fixo ? ajustes[classe.chave] : undefined
  const tipoAtual = classe ? (ajuste ? tipoDoAjuste(ajuste) : classe.tipo) : null
  const materiaAtual = dados.materias.find((m) => m.id === (materiaDoAjuste(ajuste) ?? classe?.materiaId))
  const ultima = resumo.faixas.at(-1)
  const foraHaMs = tipoAtual === 'fora' && ultima?.tipo === 'fora' ? ultima.ms : 0

  return {
    dia: alvo,
    resumo,
    pausas: pausasDoDia,
    sessoes: fechadas,
    capturando,
    atual: lida
      ? {
          titulo: lida.titulo || '(janela sem título)',
          detalhe: `${nomeDoPrograma(lida.processo)} · ${tipoAtual === 'estudo' && materiaAtual ? materiaAtual.nome.toLowerCase() : ROTULO_TIPO[tipoAtual ?? 'fora'].toLowerCase()}`,
          rotulo: classe?.rotulo ?? '',
          tipo: tipoAtual,
        }
      : null,
    foraHaMs,
  }
}
