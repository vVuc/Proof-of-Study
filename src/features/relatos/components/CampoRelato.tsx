import { useEffect, useState } from 'react'
import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { formatarPercentual } from '@/shared/lib/percentual'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Mic } from '@/shared/ui/icones'
import { useDados } from '@/store/context/dados-context'
import { infoDoModelo, type InfoModelo } from '../api/voz'
import { useVoz } from '../hooks/useVoz'

interface CampoRelatoProps {
  valor: string
  /** `via` diz se o texto veio da voz (o relato guarda a origem). */
  onChange: (valor: string, via: 'texto' | 'voz') => void
  placeholder: string
  rotulo: string
  linhas?: number
}

/**
 * Texto do relato, com o microfone ao lado. A fala é transcrita no PC e entra no campo, editável. Sem modelo,
 * o primeiro clique pede para baixar (com o tamanho e a origem). Sem voz, o campo de texto continua.
 */
export function CampoRelato({ valor, onChange, placeholder, rotulo, linhas = 4 }: CampoRelatoProps) {
  const voz = useVoz()

  async function pararEJuntar() {
    const texto = await voz.parar()
    if (texto && texto.trim()) onChange(valor.trim() ? `${valor.trim()} ${texto.trim()}` : texto.trim(), 'voz')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className={cn(ROTULO, 'sr-only')}>{rotulo}</span>
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value, 'texto')}
          rows={linhas}
          placeholder={placeholder}
          className="resize-y border-2 border-input bg-card p-3 text-sm leading-normal outline-none focus-visible:shadow-[3px_3px_0_0_var(--ring)]"
        />
      </label>
      {voz.disponivel && (
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {voz.estado.modelo === 'pronto' &&
            (voz.estado.gravando ? (
              <Button variant="destructive" className={cn(BOTAO, 'h-8 px-3')} onClick={() => void pararEJuntar()}>
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-current" />
                Parar e transcrever
              </Button>
            ) : (
              <Button
                variant="outline"
                className={cn(BOTAO, 'h-8 px-3')}
                disabled={voz.estado.transcrevendo}
                onClick={() => void voz.gravar()}
              >
                <Mic />
                {voz.estado.transcrevendo ? 'Transcrevendo…' : 'Falar'}
              </Button>
            ))}
          {voz.estado.modelo === 'baixando' && (
            <span className="text-muted-foreground">Baixando o modelo de voz… {formatarPercentual(voz.estado.progresso)}</span>
          )}
          {voz.estado.modelo === 'ausente' && <PedirModelo baixar={() => void voz.baixar()} />}
          {voz.estado.gravando && <span className="text-muted-foreground">Gravando. O áudio é apagado depois da transcrição.</span>}
          {voz.erro && <span className="text-destructive">Voz indisponível ({voz.erro}). Escreva no campo acima.</span>}
        </div>
      )}
    </div>
  )
}

/** Consentimento para o único download do app: mostra o tamanho e a origem antes de baixar. */
function PedirModelo({ baixar }: { baixar: () => void }) {
  const { dados } = useDados()
  const [info, setInfo] = useState<InfoModelo | null>(null)
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (aberto) void infoDoModelo(dados.preferencias.modeloVoz).then(setInfo, () => setInfo(null))
  }, [aberto, dados.preferencias.modeloVoz])

  if (!aberto)
    return (
      <Button variant="outline" className={cn(BOTAO, 'h-8 px-3')} onClick={() => setAberto(true)}>
        <Mic />
        Falar
      </Button>
    )
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        Para falar, o app baixa um modelo de voz {info ? `(${info.mb} MB, de ${info.origem})` : ''} uma vez. A transcrição roda no
        seu PC; nada é enviado.
      </span>
      <Button className={cn(BOTAO, 'h-8 px-3')} onClick={baixar}>
        Baixar
      </Button>
      <Button variant="ghost" className={cn(BOTAO, 'h-8 px-3')} onClick={() => setAberto(false)}>
        Agora não
      </Button>
    </span>
  )
}
