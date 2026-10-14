import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { useAgora } from '@/shared/hooks/useAgora'
import { formatarDiaCurto, formatarDuracao, formatarHora, paraISO, rotuloDia, deISO } from '@/shared/lib/datas'
import { BOTAO, CAMPO_SELECT, CARTAO, ROTULO, TITULO_CARD } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useDados } from '@/store/context/dados-context'
import { SEM_MATERIA, type Tipo } from '@/store/model/dados'
import { excluirImagem } from '@/features/imagens/api/imagens'
import { CampoImagens } from '@/features/imagens/components/CampoImagens'
import { imagensDoEvento, useAcrescentarImagens } from '@/features/imagens/hooks/useAcrescentarImagens'
import { LinhaGrupo } from '@/features/sessao/components/partes'
import { ROTULO_TIPO } from '@/features/sessao/utils/classificacao'
import { ajustesMudados, resumir } from '@/features/sessao/utils/resumo'
import { CardResumoDoDia } from './components/CardResumoDoDia'
import { diaAnotado, diaDe, sessoesDoDia } from './utils/dia'
import { resumirDia } from './utils/resumo-do-dia'

/** Ordem da etiqueta: fora vira estudo num clique (o caso mais comum: um vídeo que era aula). */
const PROXIMO: Record<Tipo, Tipo> = { fora: 'estudo', estudo: 'ignorar', ignorar: 'fora' }
const SEM_ESCOLHA = '__sem__'

/**
 * A anotação do dia, no fim do dia ou na manhã seguinte: o resumo para a autoavaliação, a matéria do estudo sem
 * matéria, para onde foi o tempo e o que foi estudado. Com a anotação, o tempo do dia entra no banco de horas.
 * Na manhã seguinte, a anotação da noite fica como está e dá para acrescentar um complemento.
 */
export function AnotacaoDiaPage() {
  const { data } = useSearch({ from: '/dia' })
  const { dados, dispatch } = useDados()
  const navigate = useNavigate()
  const hoje = paraISO(useAgora())
  const dia = diaDe(dados.dias, data)
  const sessoes = useMemo(() => sessoesDoDia(dados.sessoes, data), [dados.sessoes, data])
  const ativas = dados.materias.filter((m) => !m.arquivada)

  const [anotacao, setAnotacao] = useState(dia.anotacao)
  const [complemento, setComplemento] = useState(dia.complemento)
  const [imagens, setImagens] = useState(dia.imagens)
  const [atribuicoes, setAtribuicoes] = useState<Record<string, string>>({})
  const [ajustes, setAjustes] = useState<Record<string, Tipo>>(() => Object.assign({}, ...sessoes.map((s) => s.ajustes)))
  const { acrescentar } = useAcrescentarImagens(imagens, setImagens)

  // A anotação da noite fica guardada como está; na manhã seguinte entra o complemento.
  const fechada = diaAnotado(dia) && !!dia.anotadoEm && paraISO(new Date(dia.anotadoEm)) === data && hoje > data
  const comAjustes = sessoes.map((s) => ({
    ...s,
    materiaId: atribuicoes[s.id] ?? s.materiaId,
    ajustes: { ...s.ajustes, ...ajustes },
  }))
  const resumoDia = resumirDia(comAjustes, dados.regras)
  const grupos = resumir(
    sessoes.flatMap((s) => s.trechos),
    dados.regras,
    ajustes,
  ).grupos
  const semMateria = sessoes.filter((s) => s.materiaId === SEM_MATERIA)
  const anotada = anotacao.trim() !== '' || imagens.length > 0
  // O estudo ainda sem matéria fica no calendário, mas não entra no banco de nenhuma matéria.
  const focoValidavelMs = resumoDia.linhas.filter((l) => l.materiaId !== SEM_MATERIA).reduce((soma, l) => soma + l.focoMs, 0)

  function salvar() {
    for (const s of sessoes) {
      const materiaId = atribuicoes[s.id] ?? s.materiaId
      const resumo = resumir(s.trechos, dados.regras, { ...s.ajustes, ...ajustes })
      const novosAjustes = ajustesMudados(resumo.grupos, { ...s.ajustes, ...ajustes })
      if (materiaId === s.materiaId && resumo.focoMs === s.focoMs && resumo.foraMs === s.foraMs) continue
      dispatch({ tipo: 'sessao/salvar', sessao: { ...s, materiaId, ajustes: novosAjustes, focoMs: resumo.focoMs, foraMs: resumo.foraMs } })
    }
    dispatch({
      tipo: 'dia/salvar',
      dia: {
        ...dia,
        anotacao: anotacao.trim(),
        complemento: complemento.trim(),
        imagens,
        anotadoEm: dia.anotadoEm ?? (anotada ? Date.now() : undefined),
      },
    })
    void navigate({ to: '/' })
  }

  function voltar() {
    imagens.filter((i) => !dia.imagens.includes(i)).forEach((i) => void excluirImagem(i))
    void navigate({ to: '/' })
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.sessao}
        trilha={rotuloDia(deISO(data))}
        titulo={
          <>
            Anotação <span>do dia {formatarDiaCurto(data)}</span>
          </>
        }
      />
      <p className="text-sm text-muted-foreground">
        Olhe como foi o dia e registre o que estudou. Com a anotação, o tempo de estudo do dia entra no banco de horas; sem ela, fica a
        validar.
      </p>

      <CardResumoDoDia resumo={resumoDia} />

      {semMateria.length > 0 && (
        <div className={CARTAO}>
          <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Estudo sem matéria</div>
          {semMateria.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
              <span className="flex-1 text-sm">
                {formatarHora(s.inicio)}–{formatarHora(s.fim)} · <b className="text-foco">{formatarDuracao(s.focoMs)}</b> de estudo
              </span>
              <Select value={atribuicoes[s.id] ?? SEM_ESCOLHA} onValueChange={(v) => setAtribuicoes((a) => ({ ...a, [s.id]: v === SEM_ESCOLHA ? SEM_MATERIA : v }))}>
                <SelectTrigger className={cn(CAMPO_SELECT, 'w-56')} aria-label="Matéria deste estudo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_ESCOLHA}>Escolher matéria…</SelectItem>
                  {ativas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <p className="px-3.5 py-2.5 text-xs text-muted-foreground">Sem matéria, o tempo fica no calendário mas não entra no banco de nenhuma matéria.</p>
        </div>
      )}

      {grupos.length > 0 && (
        <div className={CARTAO}>
          <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Para onde foi o tempo</div>
          {grupos.map((g) => (
            <LinhaGrupo key={g.chave} grupo={g}>
              <button
                type="button"
                disabled={g.fixo}
                onClick={() => setAjustes((a) => ({ ...a, [g.chave]: PROXIMO[g.tipo] }))}
                title={g.fixo ? undefined : `Trocar como ${g.rotulo} conta neste dia`}
                className="border-[1.5px] border-contorno px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-[0.06em] whitespace-nowrap uppercase enabled:hover:bg-amarelo enabled:hover:text-tinta disabled:opacity-100"
              >
                {g.chave === 'sem-captura' ? 'Não registrado' : ROTULO_TIPO[g.tipo]}
                {g.tipo !== g.tipoPadrao && ' *'}
              </button>
            </LinhaGrupo>
          ))}
          <p className="px-3.5 py-2.5 text-xs text-muted-foreground">
            Clique na etiqueta para trocar como uma janela conta só neste dia (ex.: um tutorial no YouTube que era aula).
          </p>
        </div>
      )}

      {fechada ? (
        <>
          <CaixaDestaque fundo="bg-foco-suave" faixa="border-l-azul">
            <span className={ROTULO}>Anotação da noite</span>
            <p className="whitespace-pre-wrap">{dia.anotacao || 'Só imagens.'}</p>
          </CaixaDestaque>
          <label className="flex flex-col gap-1.5">
            <span className={ROTULO}>Complemento de hoje (opcional)</span>
            <textarea
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="O que você lembra hoje do que estudou ontem?"
              className="min-h-[110px] resize-y border-2 border-input bg-card p-3 text-sm leading-normal outline-none focus-visible:shadow-[3px_3px_0_0_var(--ring)]"
              autoFocus
            />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>O que você estudou e como foi o dia</span>
          <textarea
            value={anotacao}
            onChange={(e) => setAnotacao(e.target.value)}
            onPaste={(e) => {
              const coladas = imagensDoEvento(e)
              if (coladas.length) {
                e.preventDefault()
                void acrescentar(coladas)
              }
            }}
            placeholder="Ex.: terminei a modelagem da caneca. Rendi bem, mas perdi foco no YouTube depois do almoço"
            className="min-h-[150px] resize-y border-2 border-input bg-card p-3 text-sm leading-normal outline-none focus-visible:shadow-[3px_3px_0_0_var(--ring)]"
            autoFocus
          />
        </label>
      )}

      {!fechada && (
        <div className="flex flex-col gap-1.5">
          <span className={ROTULO}>Imagens</span>
          <CampoImagens imagens={imagens} onChange={setImagens} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t-2 border-contorno pt-3">
        <span className="text-sm">
          {anotada ? (
            <>
              <b className="text-foco">{formatarDuracao(focoValidavelMs)}</b> de estudo entram no banco de horas.
            </>
          ) : (
            <>
              Sem anotação, <b className="text-foco">{formatarDuracao(focoValidavelMs)}</b> de estudo ficam a validar.
            </>
          )}
        </span>
        <div className="flex gap-3">
          <Button variant="outline" className={BOTAO} onClick={voltar}>
            Voltar
          </Button>
          <Button className={BOTAO} onClick={salvar}>
            Salvar anotação
          </Button>
        </div>
      </div>
    </div>
  )
}
