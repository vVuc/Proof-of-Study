import { useState } from 'react'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { ControleSegmentado } from '@/shared/components/ControleSegmentado'
import { deISO, inicioDaSemana, rotuloSemana, type DataISO } from '@/shared/lib/datas'
import { BOTAO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { InsightSemana } from '@/store/model/dados'
import { mensagemDoErro } from '../constants/mensagens'
import { useIA } from '../hooks/useIA'
import { montarPedidoDaSemana } from '../utils/prompts'
import { lerRespostaDaSemana } from '../utils/respostas'
import { semanaPadrao, semanaTemRegistros } from '../utils/semana'

const PARTES = [
  { chave: 'comoFoi', titulo: 'Como foi a semana' },
  { chave: 'padroes', titulo: 'Padrões' },
  { chave: 'proximaSemana', titulo: 'Para a próxima semana' },
] as const

/**
 * O insight da semana na Autoanálise: a escolha da semana (começa na última completa e aceita a atual), "Analisar a
 * semana", as três partes do texto da IA e "Gerar de novo". Semana sem sessão nem relato não tem o que analisar. Uma
 * falha só mostra a mensagem (IAERR-05).
 */
export function InsightDaSemana({ hoje }: { hoje: DataISO }) {
  const { dados, dispatch } = useDados()
  const { ligada, gerar, emAndamento } = useIA()
  const passada = semanaPadrao(hoje)
  const atual = inicioDaSemana(deISO(hoje))
  const [semana, setSemana] = useState(passada)
  const [erro, setErro] = useState<string | null>(null)
  const insight = dados.insights.find((i): i is InsightSemana => i.tipo === 'semana' && i.semana === semana)
  const analisando = emAndamento('semana')
  const vazia = !semanaTemRegistros(dados, semana)

  // Insight salvo continua visível sem a IA; uma análise nova só com a IA ligada (INSS-01).
  if (!ligada && !dados.insights.some((i) => i.tipo === 'semana')) return null

  function escolher(nova: DataISO) {
    setSemana(nova)
    setErro(null)
  }

  async function analisar() {
    setErro(null)
    const alvo = semana
    const resultado = await gerar(montarPedidoDaSemana(dados, alvo))
    if (resultado.tipo === 'erro') return setErro(resultado.mensagem)
    if (resultado.tipo === 'descartado') return
    const partes = lerRespostaDaSemana(resultado.resposta.texto)
    if (!partes) return setErro(mensagemDoErro({ tipo: 'Resposta' }))
    // Gerar de novo substitui o insight da semana (INSS-04).
    dispatch({
      tipo: 'insight/salvar',
      insight: { id: crypto.randomUUID(), tipo: 'semana', semana: alvo, partes, modelo: resultado.resposta.modelo, criadoEm: Date.now() },
    })
  }

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Insight da semana" faixa="bg-amarelo" forma={{ forma: 'quarto', cor: 'tinta' }} />
      <div className="flex flex-col gap-3 p-4">
        <ControleSegmentado
          rotulo="Semana"
          valor={semana}
          onChange={escolher}
          opcoes={[
            { valor: passada, rotulo: rotuloSemana(passada) },
            { valor: atual, rotulo: rotuloSemana(atual) },
          ]}
        />
        {insight ? (
          PARTES.map(({ chave, titulo }) => (
            <div key={chave} className="flex flex-col gap-1">
              <h3 className={cn(ROTULO, 'text-muted-foreground')}>{titulo}</h3>
              <p className="text-sm whitespace-pre-line">{insight.partes[chave]}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            A IA lê os relatos, os objetivos e os totais da semana e escreve como ela foi, os padrões e o que ajustar na próxima.
          </p>
        )}
        {erro && (
          <CaixaDestaque fundo="bg-fora-suave" faixa="border-l-vermelho">
            <p>{erro}</p>
          </CaixaDestaque>
        )}
        {ligada && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={insight ? 'outline' : 'default'} className={BOTAO} disabled={analisando || vazia} onClick={() => void analisar()}>
              {analisando ? 'Analisando a semana…' : insight ? 'Gerar de novo' : 'Analisar a semana'}
            </Button>
            {vazia && <span className="text-xs text-muted-foreground">Sem dias registrados nesta semana</span>}
          </div>
        )}
      </div>
    </div>
  )
}
