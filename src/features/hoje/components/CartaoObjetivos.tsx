import { useState, type FormEvent } from 'react'
import { Ajuda } from '@/shared/components/Ajuda'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { ControleSegmentado, type OpcaoSegmentada } from '@/shared/components/ControleSegmentado'
import { PontoCor } from '@/shared/components/PontoCor'
import { formatarDuracao, type DataISO } from '@/shared/lib/datas'
import { BOTAO, CAMPO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { X } from '@/shared/ui/icones'
import { Input } from '@/shared/ui/input'
import { useDados } from '@/store/context/dados-context'
import type { Objetivo } from '@/store/model/dados'
import { COR_TIPO } from '@/features/sessao/components/partes'
import { useResumoDoDia } from '@/features/sessao/hooks/useResumoDoDia'
import { ROTULO_TIPO } from '@/features/sessao/utils/classificacao'
import { nomeDoObjetivo, objetivosDoDia } from '../utils/dia'

const ORIGEM = { rotina: 'rotina', relato: 'do plano', manual: '' } as const

type TipoDoObjetivo = NonNullable<Objetivo['tipo']>

const TIPOS_DO_OBJETIVO: OpcaoSegmentada<TipoDoObjetivo>[] = [
  { valor: 'estudo', rotulo: ROTULO_TIPO.estudo },
  { valor: 'trabalho', rotulo: ROTULO_TIPO.trabalho },
]

/**
 * Os objetivos do dia não têm botão: o tempo das janelas que combinam com cada um aparece aqui sozinho.
 * Embaixo, o que foi estudado fora do plano, o estudo que ficou sem objetivo e o tempo perdido.
 */
export function CartaoObjetivos({ dia }: { dia: DataISO }) {
  const { dados, dispatch } = useDados()
  const { resumo } = useResumoDoDia(dia)
  const objetivos = objetivosDoDia(dados, dia)
  const [novo, setNovo] = useState('')
  const [tipoNovo, setTipoNovo] = useState<TipoDoObjetivo>('estudo')

  const materiasDoPlano = new Set(objetivos.map((o) => o.materiaId).filter(Boolean))
  const foraDoPlano = Object.entries(resumo.porMateria)
    .filter(([id]) => !materiasDoPlano.has(id))
    .map(([id, ms]) => ({ materia: dados.materias.find((m) => m.id === id), ms }))
    .filter((x) => x.materia)
    .sort((a, b) => b.ms - a.ms)

  function acrescentar(e: FormEvent) {
    e.preventDefault()
    const texto = novo.trim()
    if (!texto) return
    // Objetivo de trabalho é só um título: não vira uma matéria, mesmo com o mesmo nome.
    const materia = tipoNovo === 'estudo' ? dados.materias.find((m) => !m.arquivada && m.nome.toLowerCase() === texto.toLowerCase()) : undefined
    if (materia && objetivos.some((o) => o.materiaId === materia.id)) return setNovo('')
    const ordem = dados.objetivos.filter((o) => o.dia === dia).reduce((maior, o) => Math.max(maior, o.ordem + 1), 0)
    dispatch({
      tipo: 'objetivos/salvar',
      objetivos: [{ id: crypto.randomUUID(), dia, materiaId: materia?.id, titulo: materia ? undefined : texto, tipo: tipoNovo, origem: 'manual', ordem }],
    })
    setNovo('')
  }

  return (
    <div className={CARTAO}>
      <CabecalhoCard
        titulo="Objetivos do dia"
        faixa="bg-amarelo"
        forma={{ forma: 'triangulo', cor: 'tinta' }}
        contagem={objetivos.length}
        acoes={
          <Ajuda titulo="Como o tempo chega aqui">
            <p>
              Não precisa dar play em cada objetivo. Com a sessão do dia rodando, cada janela é ligada ao objetivo que combina com
              ela: pelo nome ou pelos termos da matéria no título, ou pela regra do app.
            </p>
            <p>Com um objetivo só no dia, todo o estudo vai para ele. O que o app errar, você corrige no relato final.</p>
          </Ajuda>
        }
      />
      <ul className="flex flex-col">
        {objetivos.map((o) => {
          const materia = dados.materias.find((m) => m.id === o.materiaId)
          const trabalho = o.tipo === 'trabalho'
          const ms = resumo.porObjetivo[o.id] ?? 0
          return (
            <li key={o.id} className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
              <PontoCor cor={trabalho ? 'var(--trabalho)' : (materia?.cor ?? 'var(--muted)')} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nomeDoObjetivo(dados, o)}</span>
              {trabalho && <span className={cn(ROTULO, 'text-muted-foreground')}>{ROTULO_TIPO.trabalho}</span>}
              {ORIGEM[o.origem] && <span className={cn(ROTULO, 'text-muted-foreground')}>{ORIGEM[o.origem]}</span>}
              <span
                className={cn(
                  'w-16 text-right text-sm font-semibold tabular-nums',
                  ms > 0 ? (trabalho ? COR_TIPO.trabalho.texto : 'text-foco') : 'text-muted-foreground',
                )}
              >
                {formatarDuracao(ms)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Tirar ${nomeDoObjetivo(dados, o)} do dia`}
                onClick={() => dispatch({ tipo: 'objetivo/excluir', id: o.id })}
              >
                <X />
              </Button>
            </li>
          )
        })}
        {objetivos.length === 0 && (
          <li className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            Nenhum objetivo hoje. Escreva o plano do dia ou acrescente abaixo.
          </li>
        )}
      </ul>

      <form onSubmit={acrescentar} className="flex flex-wrap items-center gap-2 border-b-2 border-contorno px-4 py-3">
        <Input
          className={cn(CAMPO, 'h-9 min-w-40 flex-1')}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Uma matéria ou um objetivo livre"
          list="materias-do-dia"
          aria-label="Novo objetivo"
        />
        <datalist id="materias-do-dia">
          {dados.materias
            .filter((m) => !m.arquivada && !materiasDoPlano.has(m.id))
            .map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
        </datalist>
        <ControleSegmentado
          rotulo="Tipo do novo objetivo"
          valor={tipoNovo}
          onChange={setTipoNovo}
          opcoes={TIPOS_DO_OBJETIVO}
          className="shrink-0 [&>button]:min-h-8"
        />
        <Button type="submit" variant="outline" className={cn(BOTAO, 'h-9')}>
          + Objetivo
        </Button>
      </form>

      <div className="flex flex-col gap-1.5 px-4 py-3 text-sm">
        {foraDoPlano.map(({ materia, ms }) => (
          <p key={materia!.id} className="flex items-center gap-2">
            <PontoCor cor={materia!.cor} />
            <span className="flex-1">
              Também estudou <b>{materia!.nome}</b>
            </span>
            <span className="font-semibold text-foco tabular-nums">{formatarDuracao(ms)}</span>
          </p>
        ))}
        {resumo.semObjetivoMs > 0 && (
          <p className="flex items-center gap-2">
            <span className="flex-1 text-muted-foreground">Estudo sem objetivo (resolva no relato)</span>
            <span className="font-semibold tabular-nums">{formatarDuracao(resumo.semObjetivoMs)}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <span className="flex-1 text-muted-foreground">Tempo fora do estudo</span>
          <span className="font-semibold text-fora tabular-nums">{formatarDuracao(resumo.foraMs)}</span>
        </p>
      </div>
    </div>
  )
}
