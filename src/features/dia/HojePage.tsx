import { Link } from '@tanstack/react-router'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { PontoCor } from '@/shared/components/PontoCor'
import { useAgora } from '@/shared/hooks/useAgora'
import { formatarCronometro, formatarRelogio, paraISO, rotuloDia } from '@/shared/lib/datas'
import { BOTAO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import { SEM_MATERIA, type Materia } from '@/store/model/dados'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { useJanela } from '@/app/janela/janela-context'
import { PopoverCaptura } from '@/features/sessao/components/PopoverCaptura'
import { useSessao } from '@/features/sessao/context/sessao-context'
import { useResumoDaSessao } from '@/features/sessao/hooks/useResumoDaSessao'
import { AvisoDiasAValidar } from './components/AvisoDiasAValidar'
import { CardCalendarioDoDia } from './components/CardCalendarioDoDia'
import { CardResumoDoDia } from './components/CardResumoDoDia'
import { TelaPlano } from './components/TelaPlano'
import { dataDaSessao, diaDe, sessoesDoDia } from './utils/dia'
import { resumirDia } from './utils/resumo-do-dia'

/**
 * O dia de estudo: os objetivos de hoje com play/pause (o relógio continua de onde parou), a sessão do dia sem
 * matéria, o calendário preenchido pelo que foi registrado e o resumo para a autoavaliação.
 * Na primeira abertura do dia, mostra antes o plano do dia.
 */
export function HojePage() {
  const { dados } = useDados()
  const { etapa, sessao, trechos } = useSessao()
  const { atual, foraHaMs } = useResumoDaSessao()
  const { virarWidget } = useJanela()
  const agora = useAgora()
  const hoje = paraISO(agora)
  const dia = diaDe(dados.dias, hoje)

  const salvas = sessoesDoDia(dados.sessoes, hoje)
  const doDia = sessao && dataDaSessao(sessao) === hoje ? [...salvas, { ...sessao, trechos }] : salvas
  const resumo = resumirDia(doDia, dados.regras)

  if (!dia.planoFeito) return <TelaPlano dia={dia} />

  const ativas = dados.materias.filter((m) => !m.arquivada)
  const objetivos = [...dia.objetivos, ...dia.extras]
    .map((id) => dados.materias.find((m) => m.id === id))
    .filter((m): m is Materia => !!m)
  const outras = ativas.filter((m) => !objetivos.includes(m))

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.sessao}
        trilha={rotuloDia(agora)}
        titulo={
          <>
            Hoje <span>objetivos</span>
          </>
        }
        acoes={
          <>
            <PopoverCaptura />
            {etapa !== 'pronto' && (
              <Button variant="outline" className={BOTAO} onClick={() => void virarWidget()}>
                Virar widget
              </Button>
            )}
            <Link to="/dia" search={{ data: hoje }} className={cn(BOTAO, 'flex items-center border-2 border-contorno bg-card shadow-bloco-sm hover:bg-amarelo hover:text-tinta')}>
              Anotar o dia
            </Link>
          </>
        }
      />

      <AvisoDiasAValidar />

      {etapa === 'ocioso' && (
        <CaixaDestaque fundo="bg-muted/60" faixa="border-l-contorno">
          <p>
            <b>Parado por inatividade.</b> O tempo sem mexer no PC não conta. O relógio volta sozinho quando você mexer no teclado ou no
            mouse.
          </p>
        </CaixaDestaque>
      )}
      {etapa === 'rodando' && foraHaMs > 0 && dados.preferencias.avisoDistracao && atual && (
        <CaixaDestaque fundo="bg-fora-suave" faixa="border-l-vermelho">
          <p>
            <b>Fora do estudo há {formatarRelogio(foraHaMs)}</b> em {atual.rotulo}. O tempo continua sendo registrado.
          </p>
        </CaixaDestaque>
      )}

      {dia.plano && (
        <p className="border-l-4 border-contorno pl-3 text-sm leading-normal">
          <span className={cn(ROTULO, 'mr-2 text-muted-foreground')}>Plano</span>
          {dia.plano}
        </p>
      )}

      <div className={CARTAO}>
        <CabecalhoCard titulo="Objetivos de hoje" faixa="bg-amarelo" forma={{ forma: 'triangulo', cor: 'tinta' }} contagem={objetivos.length} />
        {objetivos.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum objetivo no plano. Dê play numa matéria abaixo ou ligue a sessão do dia.</p>
        )}
        {objetivos.map((m) => (
          <LinhaObjetivo key={m.id} materia={m} extra={dia.extras.includes(m.id)} />
        ))}
        <LinhaObjetivo materia={null} />
        {outras.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t-2 border-contorno px-4 py-3">
            <span className={cn(ROTULO, 'text-muted-foreground')}>Outra matéria</span>
            {outras.map((m) => (
              <BotaoTocar key={m.id} materiaId={m.id} rotulo={m.nome} cor={m.cor} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <CardResumoDoDia resumo={resumo} />
        <CardCalendarioDoDia data={hoje} blocos={resumo.blocos} />
      </div>
    </div>
  )
}

/** Uma linha por objetivo: nome, estado, o relógio do dia e o play/pause. Sem matéria, é a sessão do dia. */
function LinhaObjetivo({ materia, extra }: { materia: Materia | null; extra?: boolean }) {
  const { etapa, sessao, tempoHoje, tocar, pausar } = useSessao()
  const id = materia?.id ?? SEM_MATERIA
  const ativo = sessao?.materiaId === id && (etapa === 'rodando' || etapa === 'ocioso')
  const tempo = tempoHoje(id)
  const estado = ativo ? (etapa === 'ocioso' ? 'parado por inatividade' : 'contando') : tempo > 0 ? 'pausado' : 'a fazer'

  return (
    <div className={cn('flex items-center gap-3 border-t border-border px-4 py-3', !materia && 'border-t-2 border-contorno bg-muted/30')}>
      {materia ? <PontoCor cor={materia.cor} /> : <span aria-hidden className="listrado size-2.5 border-[1.5px] border-contorno" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">
          {materia ? materia.nome : 'Sessão do dia'}
          {extra && <span className={cn(ROTULO, 'ml-2 text-muted-foreground')}>extra</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {materia ? estado : 'Sem matéria: o calendário se preenche e você atribui a matéria na anotação do dia.'}
          {!materia && tempo > 0 && ` · ${estado}`}
        </span>
      </span>
      <span className={cn('font-heading text-2xl font-extrabold tabular-nums', ativo && 'text-foco')} role="timer">
        {formatarCronometro(tempo)}
      </span>
      {ativo ? (
        <Button variant="outline" className={cn(BOTAO, 'w-28')} onClick={() => void pausar()}>
          {materia ? 'Pausar' : 'Desligar'}
        </Button>
      ) : (
        <Button className={cn(BOTAO, 'w-28')} onClick={() => void tocar(id)}>
          {materia ? (tempo > 0 ? 'Continuar' : 'Play') : 'Ligar'}
        </Button>
      )}
    </div>
  )
}

function BotaoTocar({ materiaId, rotulo, cor }: { materiaId: string; rotulo: string; cor: string }) {
  const { tocar } = useSessao()
  return (
    <button
      type="button"
      onClick={() => void tocar(materiaId)}
      className="flex h-8 items-center gap-2 border-2 border-contorno bg-card px-2.5 text-[0.6875rem] font-semibold tracking-[0.06em] uppercase shadow-bloco-sm hover:bg-amarelo hover:text-tinta"
    >
      <span aria-hidden>▶</span>
      <PontoCor cor={cor} />
      {rotulo}
    </button>
  )
}
