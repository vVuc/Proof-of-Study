import { Fragment } from 'react'
import { CAMPO_SELECT, ROTULO, TITULO_CARD } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useDados } from '@/store/context/dados-context'
import type { Ajuste, SugestaoIA } from '@/store/model/dados'
import { LinhaGrupo } from '@/features/sessao/components/partes'
import { ROTULO_TIPO } from '@/features/sessao/utils/classificacao'
import { materiaDoAjuste, tipoDoAjuste, type Grupo } from '@/features/sessao/utils/resumo'
import { estadoDaSugestao } from '@/features/ia/utils/sugestoes'

/** Valor atual do grupo no seletor: a matéria do estudo, estudo sem matéria, trabalho, fora ou ignorar. */
const valorDoGrupo = (g: Grupo): Ajuste => (g.tipo === 'estudo' && g.materiaId ? `materia:${g.materiaId}` : g.tipo)

/**
 * "Para onde foi o tempo", com a correção: cada grupo de janelas pode ir para outra matéria, para estudo sem
 * matéria, para trabalho, para fora ou ser ignorado. Vale só para este dia; as regras não mudam. Com o insight do
 * dia, cada grupo mostra a sugestão da IA, que só vale quando a pessoa aceita (INSD-04 a INSD-06).
 */
export function GruposDoDia({
  grupos,
  ajustes,
  onAjustar,
  sugestoes = [],
  onRecusar,
}: {
  grupos: Grupo[]
  ajustes: Record<string, Ajuste>
  onAjustar: (chave: string, ajuste: Ajuste) => void
  sugestoes?: SugestaoIA[]
  onRecusar?: (chave: string) => void
}) {
  const { dados } = useDados()
  const materias = dados.materias.filter((m) => !m.arquivada)
  const rotuloDoAjuste = (ajuste: Ajuste) => {
    const materia = materiaDoAjuste(ajuste)
    if (materia) return `Estudo: ${dados.materias.find((m) => m.id === materia)?.nome ?? 'matéria'}`
    return ajuste === 'estudo' ? 'Estudo sem matéria' : ROTULO_TIPO[tipoDoAjuste(ajuste)]
  }

  return (
    <div className="border-2 border-contorno bg-card shadow-bloco">
      <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Para onde foi o tempo</div>
      {grupos.map((g) => {
        const sugestao = g.fixo ? undefined : sugestoes.find((s) => s.chave === g.chave)
        return (
          <Fragment key={g.chave}>
            <LinhaGrupo grupo={g}>
              {g.fixo ? (
                <span className="w-44 text-right text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  {g.chave === 'sem-captura' ? 'Não registrado' : 'Não conta'}
                </span>
              ) : (
                <Select value={valorDoGrupo(g)} onValueChange={(v) => onAjustar(g.chave, v as Ajuste)}>
                  <SelectTrigger className={cn(CAMPO_SELECT, 'h-8 w-44 text-xs data-[size=default]:h-8', ajustes[g.chave] && 'font-semibold')} aria-label={`Como ${g.rotulo} conta`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materias.map((m) => (
                      <SelectItem key={m.id} value={`materia:${m.id}`}>
                        Estudo: {m.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value="estudo">Estudo sem matéria</SelectItem>
                    <SelectItem value="trabalho">Trabalho</SelectItem>
                    <SelectItem value="fora">Fora do estudo</SelectItem>
                    <SelectItem value="ignorar">Ignorar</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </LinhaGrupo>
            {sugestao && (
              <LinhaSugestao
                sugestao={sugestao}
                rotulo={rotuloDoAjuste(sugestao.ajuste)}
                estado={estadoDaSugestao(sugestao, ajustes, g)}
                onAceitar={() => onAjustar(g.chave, sugestao.ajuste)}
                onRecusar={() => onRecusar?.(g.chave)}
              />
            )}
          </Fragment>
        )
      })}
      {grupos.length === 0 && <p className="px-3.5 py-3 text-sm text-muted-foreground">Nada registrado neste dia.</p>}
      <p className="px-3.5 py-2.5 text-xs text-muted-foreground">
        A correção vale só para este dia. Para mudar sempre, crie uma regra em Apps e sites ou um termo na matéria.
      </p>
    </div>
  )
}

/** A sugestão da IA para um grupo: o tipo, o motivo e "Aceitar" e "Recusar" enquanto está pendente. */
function LinhaSugestao({
  sugestao,
  rotulo,
  estado,
  onAceitar,
  onRecusar,
}: {
  sugestao: SugestaoIA
  rotulo: string
  estado: ReturnType<typeof estadoDaSugestao>
  onAceitar: () => void
  onRecusar: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border bg-muted/40 px-3.5 py-1.5 text-xs">
      <span className={cn(ROTULO, 'text-muted-foreground')}>Sugestão da IA</span>
      <span className="font-semibold">{rotulo}</span>
      <span className="min-w-0 flex-1 text-muted-foreground">{sugestao.motivo}</span>
      {estado === 'pendente' ? (
        <span className="flex gap-1.5">
          <Button size="xs" variant="outline" onClick={onAceitar}>
            Aceitar
          </Button>
          <Button size="xs" variant="ghost" onClick={onRecusar}>
            Recusar
          </Button>
        </span>
      ) : (
        <span className={cn(ROTULO, 'text-muted-foreground')}>{estado === 'aceita' ? 'Aceita' : 'Recusada'}</span>
      )}
    </div>
  )
}
