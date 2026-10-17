import { useState } from 'react'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { formatarDuracao, type DataISO } from '@/shared/lib/datas'
import { BOTAO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { Ajuste, InsightDia, Tipo } from '@/store/model/dados'
import { sessoesDoDia } from '@/features/hoje/utils/dia'
import { PontoTipo } from '@/features/sessao/components/partes'
import { useSessao } from '@/features/sessao/context/sessao-context'
import type { Resumo } from '@/features/sessao/utils/resumo'
import { mensagemDoErro } from '../constants/mensagens'
import { useIA } from '../hooks/useIA'
import { montarPedidoDoDia } from '../utils/prompts'
import { lerRespostaDoDia } from '../utils/respostas'
import { aceitarTodas, estadoDaSugestao } from '../utils/sugestoes'

/**
 * O insight do dia no relato final: "Analisar o dia com IA" (com a IA ligada e sessão no dia), o texto da IA, os
 * totais calculados pelo app com as correções atuais, "Aceitar todas" e "Gerar de novo". Uma falha só mostra a
 * mensagem: o relato, os objetivos e as correções continuam como estavam (IAERR-05).
 */
export function InsightDoDia({
  dia,
  resumo,
  ajustes,
  onAjustes,
}: {
  dia: DataISO
  /** O resumo do dia com as correções que o relato está editando. */
  resumo: Resumo
  ajustes: Record<string, Ajuste>
  onAjustes: (ajustes: Record<string, Ajuste>) => void
}) {
  const { dados, dispatch } = useDados()
  const { sessao, trechos, pausas } = useSessao()
  const { ligada, gerar, emAndamento } = useIA()
  const [erro, setErro] = useState<string | null>(null)
  const insight = dados.insights.find((i): i is InsightDia => i.tipo === 'dia' && i.dia === dia)
  const aberta = sessao?.dia === dia
  const temSessao = aberta || sessoesDoDia(dados, dia).length > 0
  const analisando = emAndamento('dia')

  // Insight salvo continua visível sem a IA; uma análise nova só com a IA ligada (INSD-01).
  if (!insight && !(ligada && temSessao)) return null

  async function analisar() {
    setErro(null)
    const { pedido, mapa } = montarPedidoDoDia(dados, dia, ajustes, aberta ? { trechos, pausas } : undefined)
    const resultado = await gerar(pedido)
    if (resultado.tipo === 'erro') return setErro(resultado.mensagem)
    if (resultado.tipo === 'descartado') return
    const lida = lerRespostaDoDia(resultado.resposta.texto, mapa)
    if (!lida) return setErro(mensagemDoErro({ tipo: 'Resposta' }))
    // Gerar de novo substitui o insight e as sugestões; as correções aceitas ficam no relato (INSD-11).
    dispatch({
      tipo: 'insight/salvar',
      insight: { id: crypto.randomUUID(), tipo: 'dia', dia, texto: lida.texto, sugestoes: lida.sugestoes, modelo: resultado.resposta.modelo, criadoEm: Date.now() },
    })
  }

  const pendentes = (insight?.sugestoes ?? []).filter(
    (s) => estadoDaSugestao(s, ajustes, resumo.grupos.find((g) => g.chave === s.chave)) === 'pendente',
  ).length
  const botaoAnalisar = ligada && temSessao && (
    <Button variant={insight ? 'outline' : 'default'} className={BOTAO} disabled={analisando} onClick={() => void analisar()}>
      {analisando ? 'Analisando o dia…' : insight ? 'Gerar de novo' : 'Analisar o dia com IA'}
    </Button>
  )

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Insight do dia" faixa="bg-azul" forma={{ forma: 'circulo', cor: 'amarelo' }} />
      <div className="flex flex-col gap-3 p-4">
        {insight ? (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <Total tipo="estudo" rotulo="Estudo" ms={resumo.focoMs} />
              <Total tipo="trabalho" rotulo="Trabalho" ms={resumo.trabalhoMs} />
              <Total tipo="fora" rotulo="Fora do estudo" ms={resumo.foraMs} />
            </div>
            <p className="text-sm whitespace-pre-line">{insight.texto}</p>
            <span className="text-xs text-muted-foreground">
              {insight.sugestoes.length
                ? 'As sugestões da IA estão nos grupos abaixo e só valem quando você aceita.'
                : 'A IA não sugeriu mudanças nos grupos deste dia.'}
            </span>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            A IA lê o plano, os objetivos, a Rotina e as janelas do dia, sugere o que foi estudo, trabalho e diversão e escreve um resumo. Nada muda sem você aceitar.
          </p>
        )}
        {erro && (
          <CaixaDestaque fundo="bg-fora-suave" faixa="border-l-vermelho">
            <p>{erro}</p>
          </CaixaDestaque>
        )}
        <div className="flex flex-wrap gap-3">
          {insight && pendentes > 0 && (
            <Button className={BOTAO} onClick={() => onAjustes(aceitarTodas(ajustes, insight.sugestoes, resumo.grupos))}>
              Aceitar todas ({pendentes})
            </Button>
          )}
          {botaoAnalisar}
        </div>
      </div>
    </div>
  )
}

function Total({ tipo, rotulo, ms }: { tipo: Tipo; rotulo: string; ms: number }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <PontoTipo tipo={tipo} />
      <span className={cn(ROTULO, 'text-muted-foreground')}>{rotulo}</span>
      <b className="tabular-nums">{formatarDuracao(ms)}</b>
    </span>
  )
}
