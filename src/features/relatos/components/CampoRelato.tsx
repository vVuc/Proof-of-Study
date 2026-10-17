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
 * Texto do relato, com o microfone ao lado. Com a IA ligada, o Gemini transcreve a fala ao vivo: o texto aparece no
 * campo enquanto a pessoa fala e fica editável quando a gravação acaba. Com a IA desligada, o "Falar" fica desabilitado
 * e o campo de texto continua.
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
          // Durante a fala, o texto ao vivo é reescrito a cada trecho; a edição volta quando a gravação acaba.
          readOnly={voz.gravando}
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
              Parar
            </Button>
          ) : (
            <Button variant="outline" className={cn(BOTAO, 'h-8 px-3')} disabled={!voz.disponivel} onClick={() => void voz.falar()}>
              <Mic />
              Falar
            </Button>
          )}
          {!voz.disponivel && !voz.gravando && <span className="text-muted-foreground">Ligue a IA nas opções para falar.</span>}
          {voz.gravando && (
            <span className="text-muted-foreground">
              {voz.parando ? 'Fechando o texto…' : 'Gravando. O texto aparece no campo enquanto você fala; o áudio não fica salvo.'}
            </span>
          )}
          {voz.erro && <span className="text-destructive">{voz.erro}</span>}
        </div>
      )}
    </div>
  )
}
