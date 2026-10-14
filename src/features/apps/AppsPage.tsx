import { useMemo, useState } from 'react'
import { CabecalhoCard } from '@/shared/components/CabecalhoCard'
import { CabecalhoPagina } from '@/shared/components/CabecalhoPagina'
import { formatarDuracao } from '@/shared/lib/datas'
import { BOTAO, CAMPO, CARTAO, ROTULO } from '@/shared/lib/estilos'
import { FORMA_PAGINA } from '@/shared/lib/formas'
import { Button } from '@/shared/ui/button'
import { Pencil } from '@/shared/ui/icones'
import { Input } from '@/shared/ui/input'
import { useDados } from '@/store/context/dados-context'
import type { Regra, Tipo } from '@/store/model/dados'
import { classificar, ordenarRegras, ROTULO_TIPO } from '@/features/sessao/utils/classificacao'
import { resumir } from '@/features/sessao/utils/resumo'
import { PontoTipo } from '@/features/sessao/components/partes'
import { CardPreferencias } from './components/CardPreferencias'
import { DialogRegra } from './components/DialogRegra'
import { SeletorTipo } from './components/SeletorTipo'

/** Sessões olhadas para sugerir regras a partir do que apareceu sem regra. */
const SESSOES_RECENTES = 15

const descreverRegra = (r: Pick<Regra, 'campo' | 'termos'>) =>
  r.campo === 'app' ? `App · ${r.termos.join(', ')}` : `Título contém ${r.termos.map((t) => `"${t}"`).join(', ')}`

export function AppsPage() {
  const { dados, dispatch } = useDados()
  const [editando, setEditando] = useState<Partial<Regra> | null>(null)
  const regras = ordenarRegras(dados.regras)

  // O que apareceu nas últimas sessões sem nenhuma regra (conta como fora do estudo até ganhar uma).
  const semRegra = useMemo(() => {
    const trechos = [...dados.sessoes]
      .sort((a, b) => b.inicio - a.inicio)
      .slice(0, SESSOES_RECENTES)
      .flatMap((s) => s.trechos)
    return resumir(trechos, { regras: dados.regras, materias: dados.materias }).grupos.filter((g) => g.semRegra && g.sugestao).slice(0, 8)
  }, [dados.sessoes, dados.regras, dados.materias])

  const mudarTipo = (regra: Regra, tipo: Tipo) => dispatch({ tipo: 'regra/salvar', regra: { ...regra, tipo } })

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoPagina
        forma={FORMA_PAGINA.apps}
        trilha="Classificação das janelas"
        titulo={
          <>
            Apps <span>e sites</span>
          </>
        }
        acoes={
          <Button variant="outline" className={BOTAO} onClick={() => setEditando({})}>
            + Nova regra
          </Button>
        }
      />
      <p className="max-w-[640px] text-sm text-pretty text-muted-foreground">
        Cada janela é classificada primeiro pelo nome e pelos termos das matérias no título, depois pelas regras abaixo (nome do
        app ou palavra no título). Mudanças valem na hora, também para a sessão aberta.
      </p>

      <div className={CARTAO}>
        <CabecalhoCard titulo="Regras" faixa="bg-foreground" forma={{ forma: 'triangulo', cor: 'amarelo' }} contagem={regras.length} />
        {regras.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3.5 border-b border-border px-3.5 py-2.5">
            <div className="flex min-w-[180px] flex-1 flex-col">
              <span className="text-sm font-semibold">{r.rotulo}</span>
              <span className="truncate text-xs text-muted-foreground">
                {descreverRegra(r)}
                {r.tipo === 'estudo' && r.materiaId && ` · ${dados.materias.find((m) => m.id === r.materiaId)?.nome ?? 'matéria'}`}
              </span>
            </div>
            <SeletorTipo rotulo={`Como ${r.rotulo} conta`} valor={r.tipo} onChange={(tipo) => mudarTipo(r, tipo)} />
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Editar ${r.rotulo}`} onClick={() => setEditando(r)}>
              <Pencil />
            </Button>
          </div>
        ))}
        <div className="px-3.5 py-2.5 text-[0.8125rem] text-muted-foreground">
          Janelas sem regra contam como <b className="text-fora">fora do estudo</b>.
        </div>
      </div>

      {semRegra.length > 0 && (
        <div className={CARTAO}>
          <CabecalhoCard titulo="Vistos sem regra" faixa="bg-vermelho" forma={{ forma: 'triangulo', cor: 'papel' }} contagem={semRegra.length} />
          {semRegra.map((g) => (
            <div key={g.chave} className="flex flex-wrap items-center gap-3.5 border-b border-border px-3.5 py-2.5 last:border-b-0">
              <div className="flex min-w-[180px] flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <PontoTipo tipo="fora" />
                  {g.rotulo}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {descreverRegra({ campo: g.sugestao!.campo, termos: [g.sugestao!.termo] })} · {formatarDuracao(g.ms)} nas últimas sessões
                </span>
              </div>
              <SeletorTipo
                rotulo={`Criar regra para ${g.rotulo}`}
                valor="fora"
                onChange={(tipo) =>
                  dispatch({
                    tipo: 'regra/salvar',
                    regra: { id: crypto.randomUUID(), rotulo: g.rotulo, campo: g.sugestao!.campo, termos: [g.sugestao!.termo], tipo },
                  })
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <TestarTitulo />
        <CardPreferencias />
      </div>

      <DialogRegra regra={editando} onClose={() => setEditando(null)} />
    </div>
  )
}

function TestarTitulo() {
  const { dados } = useDados()
  const [titulo, setTitulo] = useState('')
  const [app, setApp] = useState('')
  const classe =
    titulo.trim() || app.trim()
      ? classificar({ titulo, processo: app, proprio: false, ausente: false }, { regras: dados.regras, materias: dados.materias })
      : null
  const materia = dados.materias.find((m) => m.id === classe?.materiaId)

  return (
    <div className={CARTAO}>
      <CabecalhoCard titulo="Testar uma janela" faixa="bg-azul" forma={{ forma: 'circulo', cor: 'amarelo' }} />
      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Título da janela</span>
          <Input className={CAMPO} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Verbos irregulares - YouTube - Google Chrome" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>App (opcional)</span>
          <Input className={CAMPO} value={app} onChange={(e) => setApp(e.target.value)} placeholder="chrome" />
        </label>
        {classe && (
          <p className="flex items-center gap-2 text-sm">
            <PontoTipo tipo={classe.tipo} />
            Conta como <b>{materia ? `estudo de ${materia.nome}` : ROTULO_TIPO[classe.tipo].toLowerCase()}</b>
            {classe.semRegra
              ? ' (sem regra)'
              : classe.chave.startsWith('materia:')
                ? ' (pelo nome ou termo da matéria)'
                : ` pela regra ${classe.rotulo}`}
            .
          </p>
        )}
      </div>
    </div>
  )
}
