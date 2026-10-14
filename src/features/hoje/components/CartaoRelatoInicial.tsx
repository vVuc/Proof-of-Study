import { useState } from 'react'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import type { DataISO } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { Relato } from '@/store/model/dados'
import { relatoDoDia } from '@/features/banco/utils/validacao'
import { CampoRelato } from '@/features/relatos/components/CampoRelato'
import { nomeDoObjetivo, sugerirObjetivos } from '../utils/dia'

/**
 * O relato inicial: o que a pessoa quer fazer hoje, escrito ou falado. Sem IA, o app só procura no texto as
 * matérias citadas e as põe nos objetivos do dia. Dá para pular com um clique.
 */
export function CartaoRelatoInicial({ dia }: { dia: DataISO }) {
  const { dados, dispatch } = useDados()
  const existente = relatoDoDia(dados.relatos, dia, 'inicial')
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(existente?.texto ?? '')
  const [origem, setOrigem] = useState<Relato['origem']>(existente?.origem ?? 'texto')
  const [sugeridos, setSugeridos] = useState<string[]>([])

  function salvar(textoFinal: string) {
    dispatch({
      tipo: 'relato/salvar',
      relato: { id: existente?.id ?? crypto.randomUUID(), dia, momento: 'inicial', texto: textoFinal.trim(), origem, criadoEm: Date.now(), atrasado: false },
    })
    const novos = textoFinal.trim() ? sugerirObjetivos(textoFinal, dados, dia) : []
    if (novos.length) dispatch({ tipo: 'objetivos/salvar', objetivos: novos })
    setSugeridos(novos.map((o) => nomeDoObjetivo(dados, o)))
    setEditando(false)
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
        <Button className={BOTAO} disabled={!texto.trim()} onClick={() => salvar(texto)}>
          Salvar o plano
        </Button>
        <Button variant="outline" className={BOTAO} onClick={() => (existente ? setEditando(false) : salvar(''))}>
          {existente ? 'Cancelar' : 'Pular hoje'}
        </Button>
      </div>
    </CaixaDestaque>
  )
}
