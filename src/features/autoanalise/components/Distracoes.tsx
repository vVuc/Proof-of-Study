import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { formatarDuracao } from '@/shared/lib/datas'
import { CARTAO } from '@/shared/lib/estilos'
import type { Distracao } from '../utils/insights'

/** O que mais tira do estudo: barras de uma série só (fora = vermelho), com o tempo e a hora em que mais aparece. */
export function Distracoes({ distracoes }: { distracoes: Distracao[] }) {
  const maior = Math.max(1, ...distracoes.map((d) => d.ms))
  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="O que tira você do estudo" faixa="bg-vermelho" forma={{ forma: 'triangulo', cor: 'papel' }} />
      <div className="flex flex-col gap-3 p-4">
        {distracoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma distração registrada no período.</p>}
        {distracoes.map((d) => (
          <div key={d.rotulo} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-semibold">{d.rotulo}</span>
              <span className="shrink-0 tabular-nums">
                {formatarDuracao(d.ms)} <span className="text-xs text-muted-foreground">· mais às {d.horaPico}h</span>
              </span>
            </div>
            <div className="h-2 bg-muted" aria-hidden>
              <div className="h-full rounded-r-[4px] bg-vermelho" style={{ width: `${(d.ms / maior) * 100}%` }} />
            </div>
          </div>
        ))}
        {distracoes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Se alguma destas era estudo, corrija no relato do dia ou crie uma regra em Apps e sites.
          </p>
        )}
      </div>
    </div>
  )
}
