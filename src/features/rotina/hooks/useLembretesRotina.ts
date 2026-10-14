import { useEffect } from 'react'
import { formatarHorario } from '@/shared/lib/datas'
import { useDados } from '@/store/context/dados-context'
import { temHorario } from '@/store/model/dados'
import { definirLembretes } from '@/features/sessao/api/rastreio'

/** Manda ao Rust os itens de estudo com horário e aviso; ele notifica no minuto em que cada um começa. */
export function useLembretesRotina() {
  const { dados } = useDados()

  useEffect(() => {
    const lista = dados.blocos
      .filter(temHorario)
      .filter((b) => b.categoria === 'estudo' && b.avisar && b.dias.length > 0)
      .map((b) => {
        const materia = dados.materias.find((m) => m.id === b.materiaId)
        return {
          id: b.id,
          dias: b.dias,
          minuto: b.inicio,
          titulo: materia ? `Hora de estudar: ${materia.nome}` : `Hora de estudar: ${b.titulo}`,
          corpo: `${b.titulo}, das ${formatarHorario(b.inicio)} às ${formatarHorario(b.fim)}. Dê play no dia pelo app, pela bandeja ou pelo atalho.`,
        }
      })
    void definirLembretes(lista)
  }, [dados.blocos, dados.materias])
}
