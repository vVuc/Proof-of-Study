import { BOTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Mic } from '@/shared/ui/icones'
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
  const voz = useVoz(valor, (texto) => onChange(texto, 'voz'))

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
      {voz.mostrar && (
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {voz.gravando ? (
            <Button variant="destructive" className={cn(BOTAO, 'h-8 px-3')} disabled={voz.parando} onClick={() => void voz.parar()}>
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-current" />
              Parar e transcrever
            </Button>
          ) : (
            <Button variant="outline" className={cn(BOTAO, 'h-8 px-3')} disabled={!voz.disponivel} onClick={() => void voz.falar()}>
              <Mic />
              Falar
            </Button>
          )}
          {voz.gravando && <span className="text-muted-foreground">Gravando. O áudio é apagado depois da transcrição.</span>}
          {voz.erro && <span className="text-destructive">Voz indisponível ({voz.erro}). Escreva no campo acima.</span>}
        </div>
      )}
    </div>
  )
}
