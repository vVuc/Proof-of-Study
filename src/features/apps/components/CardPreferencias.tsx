import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { disable, enable } from '@tauri-apps/plugin-autostart'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { ControleSegmentado } from '@/shared/components/ControleSegmentado'
import { formatarHorario, lerHorario } from '@/shared/lib/datas'
import { BOTAO, CAMPO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { useDados } from '@/store/context/dados-context'
import type { Preferencias } from '@/store/model/dados'
import { definirAtalho, exportarDiagnostico } from '@/features/sessao/api/rastreio'
import { atalhoDoTeclado, rotuloDoAtalho } from '../utils/atalho'

/** As opções da sessão do dia, dos relatos e do sistema. Valem na hora (a sessão aberta recebe as mudanças). */
export function CardPreferencias() {
  const { dados, dispatch } = useDados()
  const p = dados.preferencias
  const mudar = (mudancas: Partial<Preferencias>) => dispatch({ tipo: 'preferencias/salvar', preferencias: { ...p, ...mudancas } })
  const [erroSistema, setErroSistema] = useState<string | null>(null)
  const [diagnostico, setDiagnostico] = useState<string | null>(null)

  async function mudarAtalho(atalho: string | null) {
    setErroSistema(null)
    try {
      await definirAtalho(atalho)
      mudar({ atalho })
    } catch (e) {
      setErroSistema(`O atalho não pôde ser registrado (${String(e)}). Tente outra combinação.`)
    }
  }

  async function mudarInicio(ligar: boolean) {
    setErroSistema(null)
    try {
      await (ligar ? enable() : disable())
      mudar({ iniciarComSistema: ligar })
    } catch (e) {
      setErroSistema(`Não deu para mudar o início com o sistema (${String(e)}).`)
    }
  }

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Sessão, relatos e sistema" faixa="bg-amarelo" forma={{ forma: 'quadrado', cor: 'tinta' }} />
      <div className="flex flex-col gap-4 p-4">
        <Campo rotulo="O dia começa às">
          <Input
            type="time"
            className={cn(CAMPO, 'w-32')}
            value={formatarHorario(p.inicioDoDiaMin)}
            onChange={(e) => {
              const minuto = lerHorario(e.target.value)
              if (minuto !== null) mudar({ inicioDoDiaMin: minuto })
            }}
          />
          <span className="text-xs text-muted-foreground">Quem estuda de madrugada: o dia só vira neste horário, e a sessão para aí.</span>
        </Campo>
        <Campo rotulo="Conta como ausente sem mexer no PC por">
          <ControleSegmentado
            rotulo="Tempo até contar como ausente"
            valor={String(p.limiteAusenciaMin)}
            onChange={(v) => mudar({ limiteAusenciaMin: Number(v) })}
            opcoes={[2, 5, 10].map((m) => ({ valor: String(m), rotulo: `${m} min` }))}
          />
        </Campo>
        <Campo rotulo="Pausa automática depois de">
          <ControleSegmentado
            rotulo="Ausência que vira pausa automática"
            valor={String(p.ausenciaLongaMin)}
            onChange={(v) => mudar({ ausenciaLongaMin: Number(v) })}
            opcoes={[15, 30, 60].map((m) => ({ valor: String(m), rotulo: `${m} min` }))}
          />
          <span className="text-xs text-muted-foreground">A captura volta sozinha quando você mexer no PC de novo.</span>
        </Campo>
        <Campo rotulo="Lembrete de pausa">
          <ControleSegmentado
            rotulo="Lembrete de pausa"
            valor={String(p.cicloMin ?? 0)}
            onChange={(v) => mudar({ cicloMin: Number(v) || null })}
            opcoes={[
              { valor: '0', rotulo: 'Desligado' },
              { valor: '25', rotulo: '25 min' },
              { valor: '50', rotulo: '50 min' },
            ]}
          />
        </Campo>
        <Campo rotulo="Aviso de distração">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={p.avisoDistracao} onCheckedChange={(v) => mudar({ avisoDistracao: v === true })} />
            Avisar quando eu ficar fora do estudo (o registro continua)
          </label>
          {p.avisoDistracao && (
            <ControleSegmentado
              rotulo="Avisar depois de"
              valor={String(p.avisoDistracaoSeg)}
              onChange={(v) => mudar({ avisoDistracaoSeg: Number(v) })}
              opcoes={[
                { valor: '60', rotulo: '1 min' },
                { valor: '120', rotulo: '2 min' },
                { valor: '300', rotulo: '5 min' },
                { valor: '600', rotulo: '10 min' },
              ]}
            />
          )}
        </Campo>

        <Campo rotulo="Relatos">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={p.relatos} onCheckedChange={(v) => mudar({ relatos: v === true })} />
            Plano no começo do dia e relato no fim
          </label>
          {p.relatos && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <Checkbox checked={p.avisoRelatoFinal} onCheckedChange={(v) => mudar({ avisoRelatoFinal: v === true })} />
              Avisar o relato final às
              <Input
                type="time"
                className={cn(CAMPO, 'h-8 w-28')}
                value={formatarHorario(p.relatoFinalMin)}
                disabled={!p.avisoRelatoFinal}
                onChange={(e) => {
                  const minuto = lerHorario(e.target.value)
                  if (minuto !== null) mudar({ relatoFinalMin: minuto })
                }}
              />
            </label>
          )}
          {p.relatos && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={p.voz} onCheckedChange={(v) => mudar({ voz: v === true })} />
              Falar o relato (a transcrição roda no PC)
            </label>
          )}
          {p.relatos && p.voz && (
            <ControleSegmentado
              rotulo="Modelo de voz"
              valor={p.modeloVoz}
              onChange={(modeloVoz) => mudar({ modeloVoz })}
              opcoes={[
                { valor: 'base', rotulo: 'Leve · 60 MB' },
                { valor: 'small', rotulo: 'Mais preciso · 190 MB' },
              ]}
            />
          )}
        </Campo>

        <Campo rotulo="Play e pausa sem abrir o app">
          <span className="text-xs text-muted-foreground">Pela bandeja ou pelo widget, sempre. Com um atalho, de qualquer janela:</span>
          <div className="flex flex-wrap items-center gap-2">
            <GravadorDeAtalho atual={p.atalho} onGravar={(a) => void mudarAtalho(a)} />
            {p.atalho && (
              <Button variant="ghost" className={cn(BOTAO, 'h-9')} onClick={() => void mudarAtalho(null)}>
                Tirar atalho
              </Button>
            )}
          </div>
        </Campo>
        <Campo rotulo="Ao ligar o computador">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={p.iniciarComSistema} onCheckedChange={(v) => void mudarInicio(v === true)} />
            Abrir o Proof of Study (o plano do dia aparece logo)
          </label>
        </Campo>
        {erroSistema && <p className="text-sm text-destructive">{erroSistema}</p>}

        <Campo rotulo="Diagnóstico">
          <span className="text-xs text-muted-foreground">
            Um arquivo com a versão, o sistema e o log do app, sem títulos de janela nem relatos. Mande só se quiser.
          </span>
          <Button
            variant="outline"
            className={cn(BOTAO, 'w-fit')}
            onClick={() => void exportarDiagnostico().then(setDiagnostico, (e) => setDiagnostico(`Falhou: ${String(e)}`))}
          >
            Exportar diagnóstico
          </Button>
          {diagnostico && <span className="text-xs [overflow-wrap:anywhere]">Salvo em {diagnostico}</span>}
        </Campo>
      </div>
    </div>
  )
}

/** Campo que grava a próxima combinação de teclas (com Ctrl, Alt ou Shift). */
function GravadorDeAtalho({ atual, onGravar }: { atual: string | null; onGravar: (atalho: string) => void }) {
  const [gravando, setGravando] = useState(false)

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    e.preventDefault()
    if (e.key === 'Escape') return setGravando(false)
    const atalho = atalhoDoTeclado(e)
    if (!atalho) return
    setGravando(false)
    onGravar(atalho)
  }

  return (
    <Input
      readOnly
      className={cn(CAMPO, 'h-9 w-64 cursor-pointer text-center', gravando && 'border-vermelho')}
      value={gravando ? 'Aperte a combinação…' : atual ? rotuloDoAtalho(atual) : 'Clique para gravar um atalho'}
      onFocus={() => setGravando(true)}
      onBlur={() => setGravando(false)}
      onKeyDown={aoTeclar}
      aria-label="Atalho global de play e pausa"
    />
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
