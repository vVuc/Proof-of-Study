import { BOTAO, CAMADA, RODAPE_DIALOG } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

/** O que sai do PC com a IA ligada (a suposição "O que é enviado ao Gemini" da spec). */
const ENVIADO = [
  'O "Sobre você" das opções',
  'As matérias (nome e termos) e as metas da semana',
  'Os objetivos do dia e os itens da Rotina com horário',
  'Os relatos (texto e humor)',
  'Os grupos de janelas do dia: rótulo, título mais longo, programa, horários e tipo atual',
  'As pausas',
  'O áudio da fala, ao vivo e em pedaços, quando você usa "Falar"',
]

interface DialogConsentimentoProps {
  aberto: boolean
  onCancelar: () => void
  /** Recebe o momento do consentimento. */
  onConcordar: (momento: number) => void
}

/** Antes de ligar a IA: o que vai para o Gemini e o aviso do plano gratuito. Fechar sem concordar não liga nada. */
export function DialogConsentimento({ aberto, onCancelar, onConcordar }: DialogConsentimentoProps) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent className={cn(CAMADA, 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>Ligar a IA (Gemini)</DialogTitle>
          <DialogDescription>Com a IA ligada, o app manda ao Gemini, com a sua chave:</DialogDescription>
        </DialogHeader>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {ENVIADO.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-sm">Nunca vão as anotações das sessões nem as imagens.</p>
        <p className="border-2 border-l-8 border-contorno bg-muted/60 px-3 py-2.5 text-sm">
          No plano gratuito do Gemini, o Google pode usar esse conteúdo para melhorar os produtos dele, e pessoas podem
          revisá-lo.
        </p>
        <DialogFooter className={cn(RODAPE_DIALOG, 'border-t-2 border-contorno pt-3')}>
          <Button type="button" variant="outline" className={BOTAO} onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" className={BOTAO} onClick={() => onConcordar(Date.now())}>
            Concordo e ligar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
