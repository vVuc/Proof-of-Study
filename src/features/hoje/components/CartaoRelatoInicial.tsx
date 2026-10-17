import { useState } from 'react'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import type { DataISO } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { Objetivo, Relato } from '@/store/model/dados'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { useIA } from '@/features/ia/hooks/useIA'
import { montarPedidoDoPlano } from '@/features/ia/utils/prompts'
import { lerRespostaDoPlano } from '@/features/ia/utils/respostas'
import { CampoRelato } from '@/features/relatos/components/CampoRelato'
import { nomeDoObjetivo, sugerirObjetivos } from '../utils/dia'

/** PLANO-05: a IA falhou e os objetivos vieram da busca de palavras. */
const SEM_IA = 'A IA não respondeu; os objetivos vieram das matérias citadas no texto.'

/**
 * O relato inicial: o que a pessoa quer fazer hoje, escrito ou falado. Com a IA ligada, ela monta os objetivos de
 * estudo e de trabalho do plano; sem a IA (ou se ela falhar), o app procura no texto as matérias citadas e as põe nos
 * objetivos do dia. Dá para pular com um clique, e pular não chama a IA.
 */
export function CartaoRelatoInicial({ dia }: { dia: DataISO }) {
  const { dados, dispatch } = useDados()
  const { ligada, gerar, emAndamento } = useIA()
  const existente = relatoDoDia(dados.relatos, dia, 'inicial')
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(existente?.texto ?? '')
  const [origem, setOrigem] = useState<Relato['origem']>(existente?.origem ?? 'texto')
  const [sugeridos, setSugeridos] = useState<string[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const montando = emAndamento('plano')

  async function salvar(textoFinal: string) {
    const plano = textoFinal.trim()
    dispatch({
      tipo: 'relato/salvar',
      relato: { id: existente?.id ?? crypto.randomUUID(), dia, momento: 'inicial', texto: plano, origem, criadoEm: Date.now(), atrasado: false },
    })
    setEditando(false)
    setSugeridos([])
    setAviso(null)
    if (!plano) return
    let novos: Objetivo[] | null = null
    if (ligada) {
      const { pedido, mapa } = montarPedidoDoPlano(dados, dia, plano)
      const resultado = await gerar(pedido)
      if (resultado.tipo === 'ok') novos = lerRespostaDoPlano(resultado.resposta.texto, mapa, dados, dia)
      // Resposta descartada (a IA foi desligada no meio): os objetivos vêm da busca de palavras, como sem a IA.
      if (!novos && resultado.tipo !== 'descartado') setAviso(SEM_IA)
    }
    novos ??= sugerirObjetivos(plano, dados, dia)
    if (novos.length) dispatch({ tipo: 'objetivos/salvar', objetivos: novos })
    setSugeridos(novos.map((o) => `${nomeDoObjetivo(dados, o)} (${o.tipo === 'trabalho' ? 'trabalho' : 'estudo'})`))
  }

  if (existente && !editando) {
    if (!existente.texto && sugeridos.length === 0) return null
    return (
      <CaixaDestaque fundo="bg-banco-suave" faixa="border-l-amarelo" className="text-sm">
        <div className="flex items-start gap-3">
          <p className="flex-1 whitespace-pre-line">
            <span className={cn(ROTULO, 'mr-2 text-muted-foreground')}>Plano de hoje</span>
            {existente.texto}
          </p>
          <button type="button" className="text-xs font-semibold tracking-[0.06em] uppercase underline underline-offset-4" onClick={() => setEditando(true)}>
            Editar
          </button>
        </div>
        {montando && <p className="text-muted-foreground">A IA está montando os objetivos do dia…</p>}
        {aviso && <p>{aviso}</p>}
        {sugeridos.length > 0 && (
          <p className="text-muted-foreground">
            Entrou nos objetivos do dia: <b className="text-foreground">{sugeridos.join(', ')}</b>.
          </p>
        )}
      </CaixaDestaque>
    )
  }

  return (
    <CaixaDestaque fundo="bg-banco-suave" faixa="border-l-amarelo" className="gap-3">
      <p className="font-heading text-xl leading-tight font-extrabold uppercase">O que você quer fazer hoje?</p>
      <CampoRelato
        valor={texto}
        onChange={(v, via) => {
          setTexto(v)
          if (via === 'voz') setOrigem('voz')
        }}
        placeholder="Ex.: revisar os verbos de inglês e terminar a modelagem da cadeira no Blender"
        rotulo="Plano do dia"
      />
      <div className="flex flex-wrap gap-3">
        <Button className={BOTAO} disabled={!texto.trim() || montando} onClick={() => void salvar(texto)}>
          Salvar o plano
        </Button>
        <Button variant="outline" className={BOTAO} onClick={() => (existente ? setEditando(false) : void salvar(''))}>
          {existente ? 'Cancelar' : 'Pular hoje'}
        </Button>
      </div>
    </CaixaDestaque>
  )
}
