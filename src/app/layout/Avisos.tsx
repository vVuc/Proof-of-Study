import { CaixaDestaque } from '@/shared/components/CaixaDestaque'
import { FaixaPrimarias } from '@/shared/components/FaixaPrimarias'
import { formatarDuracao } from '@/shared/lib/datas'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useDados } from '@/store/context/dados-context'
import { useSessao } from '@/features/sessao/context/sessao-context'

/** Depois de o app fechar, travar ou o PC desligar: a sessão do dia voltou como estava, e o tempo fora virou pausa. */
export function AvisoRecuperacao() {
  const { retrato, pausar, dispensarRecuperacao } = useSessao()
  const recuperacao = retrato?.recuperacao
  if (!recuperacao) return null
  const rodando = recuperacao.fase === 'rodando'

  return (
    <div role="status" className="border-2 border-contorno bg-card shadow-bloco-lg">
      <FaixaPrimarias />
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <span className={cn(ROTULO, 'text-muted-foreground')}>Proof of Study · sessão retomada</span>
        <p className="text-[0.8125rem]">
          O app ficou fechado por <b>{formatarDuracao(recuperacao.desligadoMs)}</b>. Esse tempo virou pausa, e a sessão do dia{' '}
          {rodando ? 'voltou a registrar.' : 'continua pausada.'}
        </p>
        <div className="flex gap-2.5 pt-0.5">
          <Button className={cn(BOTAO, 'h-9 px-3 text-[0.6875rem]')} onClick={() => void dispensarRecuperacao()}>
            Ok
          </Button>
          {rodando && (
            <Button
              variant="outline"
              className={cn(BOTAO, 'h-9 px-3 text-[0.6875rem]')}
              onClick={() => void pausar().then(dispensarRecuperacao)}
            >
              Pausar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Aviso único depois de converter os dados de um formato antigo, com o caminho da cópia. */
export function AvisoMigracao() {
  const { migracao, dispensarMigracao } = useDados()
  if (!migracao) return null
  return (
    <CaixaDestaque fundo="bg-banco-suave" faixa="border-l-amarelo" className="mb-4">
      <p>
        <b>Seus dados foram atualizados para a versão nova.</b> Agora o dia tem um play só, objetivos sem horário e relatos. Uma
        cópia dos dados antigos ficou em <code className="text-xs [overflow-wrap:anywhere]">{migracao.backup}</code>, caso precise
        voltar de versão.
      </p>
      <Button variant="outline" className={cn(BOTAO, 'h-8 w-fit px-3')} onClick={dispensarMigracao}>
        Entendi
      </Button>
    </CaixaDestaque>
  )
}
