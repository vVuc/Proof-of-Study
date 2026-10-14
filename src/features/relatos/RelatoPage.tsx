import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { EstadoVazio } from '@/shared/components/EstadoVazio'
import { useAgora } from '@/shared/hooks/useAgora'
import { PontoCor } from '@/shared/components/PontoCor'
import { deISO, formatarDuracao, formatarHM, rotuloDia, somarDias } from '@/shared/lib/datas'
import { BOTAO, CARTAO, ROTULO, TITULO_CARD } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { formatarPercentual } from '@/shared/lib/percentual'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import type { Ajuste, Relato } from '@/store/model/dados'
import { prazoDoRelato, relatoDoDia } from '@/features/banco/utils/validacao'
import { BarraFaixas } from '@/features/sessao/components/partes'
import { useSessao } from '@/features/sessao/context/sessao-context'
import { useResumoDoDia } from '@/features/sessao/hooks/useResumoDoDia'
import { ajustesMudados, taxaDeFoco } from '@/features/sessao/utils/resumo'
import { nomeDoObjetivo, objetivosDoDia, recalcularDia } from '@/features/hoje/utils/dia'
import { CampoRelato } from './components/CampoRelato'
import { GruposDoDia } from './components/GruposDoDia'

const HUMOR = [
  { valor: 1, rotulo: 'Muito ruim' },
  { valor: 2, rotulo: 'Ruim' },
  { valor: 3, rotulo: 'Normal' },
  { valor: 4, rotulo: 'Bom' },
  { valor: 5, rotulo: 'Muito bom' },
]

/**
 * O relato final: o que o dia teve (por objetivo, fora, pausas), a correção do que o app atribuiu errado, como
 * foi (texto ou voz) e o humor. Salvar valida o dia no banco de horas e fecha a sessão do dia.
 */
export function RelatoPage() {
  const { dia: diaDaBusca } = useSearch({ from: '/relato' })
  const { hoje } = useSessao()
  const dia = diaDaBusca ?? hoje
  return <Relato key={dia} dia={dia} />
}

function Relato({ dia }: { dia: string }) {
  const { dados, dispatch } = useDados()
  const { hoje, sessao, fecharDia } = useSessao()
  const navigate = useNavigate()
  const agora = useAgora()
  const existente = relatoDoDia(dados.relatos, dia, 'final')
  const [texto, setTexto] = useState(existente?.texto ?? '')
  const [origem, setOrigem] = useState<Relato['origem']>(existente?.origem ?? 'texto')
  const [humor, setHumor] = useState<number | undefined>(existente?.humor)
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>(existente?.ajustes ?? {})
  const [salvando, setSalvando] = useState(false)
  const { resumo, pausas } = useResumoDoDia(dia, ajustes)

  const atrasado = dia !== hoje
  const noPrazo = agora.getTime() < prazoDoRelato(dia, dados.preferencias.inicioDoDiaMin)
  const objetivos = objetivosDoDia(dados, dia)
  const estudoComMateria = Object.values(resumo.porMateria).reduce((a, b) => a + b, 0)
  const pausadoMs = pausas.reduce((s, p) => s + (p.fim - p.inicio), 0)
  const automaticas = pausas.filter((p) => p.motivo !== 'manual').length

  async function salvar() {
    setSalvando(true)
    try {
      const relato: Relato = {
        id: existente?.id ?? crypto.randomUUID(),
        dia,
        momento: 'final',
        texto: texto.trim(),
        origem,
        humor,
        ajustes: ajustesMudados(resumo.grupos, ajustes),
        criadoEm: existente?.criadoEm && existente.texto ? existente.criadoEm : Date.now(),
        atrasado,
      }
      dispatch({ tipo: 'relato/salvar', relato })
      // As sessões já fechadas do dia passam a contar com as correções.
      const comRelato = { ...dados, relatos: [...dados.relatos.filter((r) => !(r.dia === dia && r.momento === 'final')), relato] }
      for (const s of recalcularDia(comRelato, dia)) dispatch({ tipo: 'sessao/salvar', sessao: s })
      // A sessão aberta do dia fecha aqui (com as correções, quando o Rust entregar).
      if (sessao?.dia === dia) await fecharDia()
      void navigate({ to: '/' })
    } finally {
      setSalvando(false)
    }
  }

  if (resumo.totalMs === 0 && !existente) {
    return (
      <EstadoVazio
        titulo="Nada registrado neste dia"
        descricao="O relato final aparece depois de um dia com a sessão rodando."
        acao={
          <Button className={BOTAO} onClick={() => void navigate({ to: '/' })}>
            Voltar para hoje
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.relato}
        trilha={`${rotuloDia(deISO(dia))}${atrasado ? ` · ${dia === somarDias(hoje, -1) ? 'relato de ontem' : 'relato atrasado'}` : ''}`}
        titulo={
          <>
            Relato <span>do dia {format(deISO(dia), 'dd/MM')}</span>
          </>
        }
      />

      <div className="grid grid-cols-2 border-2 border-contorno bg-card shadow-bloco sm:grid-cols-5">
        <Numero rotulo="Estudo" valor={formatarDuracao(resumo.focoMs)} cor="text-foco" />
        <Numero rotulo="Fora do estudo" valor={formatarDuracao(resumo.foraMs)} cor="text-fora" />
        <Numero rotulo="Em foco" valor={formatarPercentual(taxaDeFoco(resumo.focoMs, resumo.foraMs))} />
        <Numero rotulo="Pausas" valor={formatarDuracao(pausadoMs)} detalhe={automaticas ? `${automaticas} ${automaticas === 1 ? 'automática' : 'automáticas'}` : undefined} />
        <Numero rotulo="Maior bloco" valor={formatarDuracao(resumo.maiorTrechoMs)} />
      </div>
      <BarraFaixas faixas={resumo.faixas} className="h-5" />

      <div className={CARTAO}>
        <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Por objetivo</div>
        {objetivos.map((o) => {
          const materia = dados.materias.find((m) => m.id === o.materiaId)
          return (
            <p key={o.id} className="flex items-center gap-2.5 border-b border-border px-3.5 py-2 text-sm">
              <PontoCor cor={materia?.cor ?? 'var(--muted)'} />
              <span className="flex-1">{nomeDoObjetivo(dados, o)}</span>
              <span className="font-semibold text-foco tabular-nums">{formatarDuracao(resumo.porObjetivo[o.id] ?? 0)}</span>
            </p>
          )
        })}
        {Object.entries(resumo.porMateria)
          .filter(([id]) => !objetivos.some((o) => o.materiaId === id))
          .map(([id, ms]) => {
            const materia = dados.materias.find((m) => m.id === id)
            return (
              <p key={id} className="flex items-center gap-2.5 border-b border-border px-3.5 py-2 text-sm">
                <PontoCor cor={materia?.cor ?? 'var(--muted)'} />
                <span className="flex-1">
                  {materia?.nome ?? 'Matéria'} <span className="text-muted-foreground">(fora do plano)</span>
                </span>
                <span className="font-semibold text-foco tabular-nums">{formatarDuracao(ms)}</span>
              </p>
            )
          })}
        {resumo.semObjetivoMs > 0 && (
          <p className="flex items-center gap-2.5 px-3.5 py-2 text-sm">
            <span className="flex-1 text-muted-foreground">Estudo sem objetivo: escolha a matéria abaixo</span>
            <span className="font-semibold tabular-nums">{formatarDuracao(resumo.semObjetivoMs)}</span>
          </p>
        )}
      </div>

      <GruposDoDia grupos={resumo.grupos} ajustes={ajustes} onAjustar={(chave, ajuste) => setAjustes((a) => ({ ...a, [chave]: ajuste }))} />

      <div className={cn(CARTAO, 'flex flex-col gap-3 p-4')}>
        <span className={TITULO_CARD}>Como foi o dia?</span>
        <CampoRelato
          valor={texto}
          onChange={(v, via) => {
            setTexto(v)
            if (via === 'voz') setOrigem('voz')
          }}
          placeholder="O que rendeu, o que travou, como você se sentiu. Vale o que vier na cabeça."
          rotulo="Relato final"
          linhas={5}
        />
        <div className="flex flex-col gap-1.5">
          <span className={cn(ROTULO, 'text-muted-foreground')}>Humor do dia</span>
          <div role="radiogroup" aria-label="Humor do dia" className="flex w-fit border-2 border-contorno">
            {HUMOR.map((h) => (
              <button
                key={h.valor}
                type="button"
                role="radio"
                aria-checked={humor === h.valor}
                title={h.rotulo}
                onClick={() => setHumor(humor === h.valor ? undefined : h.valor)}
                className={cn(
                  'flex h-9 min-w-11 items-center justify-center px-2 text-sm font-semibold not-first:border-l-2 not-first:border-contorno',
                  humor === h.valor ? 'bg-foreground text-background' : 'bg-card hover:bg-amarelo hover:text-tinta',
                )}
              >
                {h.valor}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">1 = muito ruim, 5 = muito bom</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-contorno pt-3">
        <span className="text-sm">
          {!texto.trim() ? (
            <>Com um texto, o relato valida o estudo do dia no banco de horas.</>
          ) : noPrazo ? (
            <>
              Valida <b className="text-foco">{formatarHM(estudoComMateria)}</b> de estudo no banco de horas.
            </>
          ) : (
            <>Fora do prazo: o relato fica registrado, mas não valida as horas. Use a anotação da sessão, no Banco.</>
          )}
        </span>
        <div className="flex gap-3">
          <Button variant="outline" className={BOTAO} onClick={() => void navigate({ to: '/' })}>
            Agora não
          </Button>
          <Button className={BOTAO} disabled={salvando || !texto.trim()} onClick={() => void salvar()}>
            {sessao?.dia === dia ? 'Salvar e encerrar o dia' : 'Salvar relato'}
          </Button>
        </div>
      </div>
      {atrasado && !noPrazo && (
        <CaixaDestaque className="text-sm">
          <p>O relato final vale até o fim do dia lógico seguinte.</p>
        </CaixaDestaque>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: string; cor?: string; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-1 border-contorno px-3.5 py-3 not-first:border-l-2">
      <span className={cn(ROTULO, 'text-muted-foreground')}>{rotulo}</span>
      <span className={cn('font-heading text-[1.625rem] leading-tight font-extrabold tabular-nums', cor)}>{valor}</span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </div>
  )
}
