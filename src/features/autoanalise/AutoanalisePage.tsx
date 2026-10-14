import { useMemo, useState } from 'react'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { ControleSegmentado } from '@/shared/components/ControleSegmentado'
import { EstadoVazio } from '@/shared/components/EstadoVazio'
import { deISO, inicioDaSemana, somarDias, type DataISO } from '@/shared/lib/datas'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { useDados } from '@/store/context/dados-context'
import { evolucao } from '@/features/banco/utils/banco'
import { useSessao } from '@/features/sessao/context/sessao-context'
import { CartoesRitmo } from './components/CartoesRitmo'
import { DiaADia } from './components/DiaADia'
import { Distracoes } from './components/Distracoes'
import { EvolucaoSemanal } from './components/EvolucaoSemanal'
import { MapaDeFoco } from './components/MapaDeFoco'
import { autoanalise } from './utils/insights'

const PERIODOS = { '4': 28, '12': 84 } as const

/**
 * Autoanálise sem IA: quando você rende, o que tira do estudo, o ritmo natural, as pausas, planejado × realizado
 * e o humor. A tela descreve; quem tira a conclusão é você.
 */
export function AutoanalisePage() {
  const { dados } = useDados()
  const [periodo, setPeriodo] = useState<keyof typeof PERIODOS>('4')
  const { hoje } = useSessao()

  const dias = useMemo(() => {
    const lista: DataISO[] = []
    for (let i = 0; i < PERIODOS[periodo]; i++) lista.push(somarDias(hoje, -i))
    return lista
  }, [periodo, hoje])
  const analise = useMemo(() => autoanalise(dados, dias), [dados, dias])
  const semanaAtual = inicioDaSemana(deISO(hoje))
  const semanas = useMemo(() => evolucao(dados, semanaAtual, PERIODOS[periodo] / 7), [dados, semanaAtual, periodo])

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.autoanalise}
        trilha="O que os seus dias mostram"
        titulo={
          <>
            Autoanálise <span>sem julgamento</span>
          </>
        }
        acoes={
          <ControleSegmentado
            rotulo="Período"
            valor={periodo}
            onChange={setPeriodo}
            opcoes={[
              { valor: '4', rotulo: '4 semanas' },
              { valor: '12', rotulo: '12 semanas' },
            ]}
          />
        }
      />

      {analise.dias === 0 ? (
        <EstadoVazio titulo="Ainda sem dias para analisar" descricao="Os padrões aparecem depois dos primeiros dias com a sessão rodando." />
      ) : (
        <>
          <CartoesRitmo analise={analise} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-4">
            <MapaDeFoco mapa={analise.mapa} />
            <Distracoes distracoes={analise.distracoes} />
          </div>
          <DiaADia linhas={analise.linhas} humor={analise.humor} />
        </>
      )}
      {semanas.length > 0 && <EvolucaoSemanal linhas={semanas} semanaAtual={semanaAtual} />}
    </div>
  )
}
