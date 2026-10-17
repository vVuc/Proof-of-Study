import { useState, type ReactNode } from 'react'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { BOTAO, CAMPO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { useDados } from '@/store/context/dados-context'
import type { Preferencias } from '@/store/model/dados'
import { removerChave, salvarChave } from '../api/ia'
import { mensagemDoErro } from '../constants/mensagens'
import { SEM_CHAVE, useIA } from '../hooks/useIA'
import { DialogConsentimento } from './DialogConsentimento'

/** Limite do "Sobre você" (IACONF-10). */
const LIMITE_SOBRE_VOCE = 2000

/**
 * A IA nas opções: a chave do Gemini (testada antes de guardar, mostrada só pelos 4 últimos caracteres), o interruptor
 * "Usar IA (Gemini)", que só liga com a chave salva e o consentimento, e o "Sobre você".
 */
export function CardIA() {
  const { dados, dispatch } = useDados()
  const p = dados.preferencias
  const mudar = (mudancas: Partial<Preferencias>) => dispatch({ tipo: 'preferencias/salvar', preferencias: { ...p, ...mudancas } })
  const { ligada, chave, definirChave } = useIA()
  const [consentindo, setConsentindo] = useState(false)
  const [texto, setTexto] = useState('')
  const [testando, setTestando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setErro(null)
    setTestando(true)
    try {
      definirChave(await salvarChave(texto))
      setTexto('')
    } catch (e) {
      // A chave não foi guardada, e a IA continua desligada.
      setErro(mensagemDoErro(e, 'teste'))
    } finally {
      setTestando(false)
    }
  }

  async function remover() {
    setErro(null)
    try {
      await removerChave()
      definirChave(SEM_CHAVE)
      mudar({ ia: false })
    } catch (e) {
      setErro(mensagemDoErro(e))
    }
  }

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="IA (Gemini)" faixa="bg-azul" forma={{ forma: 'triangulo', cor: 'amarelo' }} />
      <div className="flex flex-col gap-4 p-4">
        <Campo rotulo="Chave do Gemini">
          {chave.salva ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm tabular-nums">••••{chave.final}</span>
              <Button variant="outline" className={cn(BOTAO, 'h-9')} onClick={() => void remover()}>
                Remover chave
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(CAMPO, 'min-w-0 flex-1')}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Cole a chave do Google AI Studio"
                  aria-label="Chave do Gemini"
                />
                <Button className={BOTAO} disabled={testando || !texto.trim()} onClick={() => void salvar()}>
                  {testando ? 'Testando…' : 'Testar e salvar'}
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">A chave é testada com o Gemini e fica no cofre do sistema, nunca no dados.json.</span>
            </>
          )}
          {chave.cofre === 'arquivo' && (
            <span className="text-xs">Este sistema não tem um cofre de senhas: a chave ficou num arquivo só seu, na pasta do app.</span>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </Campo>

        <Campo rotulo="Usar IA (Gemini)">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={ligada}
              disabled={!chave.salva}
              onCheckedChange={(v) => (v === true ? setConsentindo(true) : mudar({ ia: false }))}
            />
            Insights do dia e da semana, plano do dia e fala transcrita, só quando você pedir
          </label>
          {!chave.salva && <span className="text-xs text-muted-foreground">Salve uma chave do Gemini para ligar.</span>}
        </Campo>

        <Campo rotulo="Sobre você">
          <textarea
            value={p.sobreVoce}
            maxLength={LIMITE_SOBRE_VOCE}
            onChange={(e) => mudar({ sobreVoce: e.target.value.slice(0, LIMITE_SOBRE_VOCE) })}
            rows={4}
            placeholder="Ex.: sou dev na empresa X, o repositório empresa-api é trabalho, estudo inglês e Blender por hobby."
            aria-label="Sobre você"
            className="resize-y border-2 border-input bg-card p-3 text-sm outline-none focus-visible:shadow-[3px_3px_0_0_var(--ring)]"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            Vai junto em cada pedido à IA. {p.sobreVoce.length}/{LIMITE_SOBRE_VOCE}
          </span>
        </Campo>
      </div>

      <DialogConsentimento
        aberto={consentindo}
        onCancelar={() => setConsentindo(false)}
        onConcordar={(momento) => {
          setConsentindo(false)
          mudar({ ia: true, consentimentoIA: momento })
        }}
      />
    </div>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={cn(ROTULO, 'text-muted-foreground')}>{rotulo}</span>
      {children}
    </div>
  )
}
