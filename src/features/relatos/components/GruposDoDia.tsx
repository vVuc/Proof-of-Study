import { CAMPO_SELECT, TITULO_CARD } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useDados } from '@/store/context/dados-context'
import type { Ajuste } from '@/store/model/dados'
import { LinhaGrupo } from '@/features/sessao/components/partes'
import type { Grupo } from '@/features/sessao/utils/resumo'

/** Valor atual do grupo no seletor: a matéria do estudo, estudo sem matéria, trabalho, fora ou ignorar. */
const valorDoGrupo = (g: Grupo): Ajuste => (g.tipo === 'estudo' && g.materiaId ? `materia:${g.materiaId}` : g.tipo)

/**
 * "Para onde foi o tempo", com a correção: cada grupo de janelas pode ir para outra matéria, para estudo sem
 * matéria, para trabalho, para fora ou ser ignorado. Vale só para este dia; as regras não mudam.
 */
export function GruposDoDia({
  grupos,
  ajustes,
  onAjustar,
}: {
  grupos: Grupo[]
  ajustes: Record<string, Ajuste>
  onAjustar: (chave: string, ajuste: Ajuste) => void
}) {
  const { dados } = useDados()
  const materias = dados.materias.filter((m) => !m.arquivada)

  return (
    <div className="border-2 border-contorno bg-card shadow-bloco">
      <div className={cn(TITULO_CARD, 'border-b-2 border-contorno px-3.5 py-2.5')}>Para onde foi o tempo</div>
      {grupos.map((g) => (
        <LinhaGrupo key={g.chave} grupo={g}>
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
      ))}
      {grupos.length === 0 && <p className="px-3.5 py-3 text-sm text-muted-foreground">Nada registrado neste dia.</p>}
      <p className="px-3.5 py-2.5 text-xs text-muted-foreground">
        A correção vale só para este dia. Para mudar sempre, crie uma regra em Apps e sites ou um termo na matéria.
      </p>
    </div>
  )
}
