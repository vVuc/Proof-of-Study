import { useState, type FormEvent } from 'react'
import { ControleSegmentado } from '@/shared/components/ControleSegmentado'
import { BOTAO, CAMADA, CAMPO, CAMPO_SELECT, ROTULO, RODAPE_DIALOG } from '@/shared/lib/estilos'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { PontoCor } from '@/shared/components/PontoCor'
import { useDados } from '@/store/context/dados-context'
import type { Regra, Tipo } from '@/store/model/dados'
import { SeletorTipo } from './SeletorTipo'

const SEM_MATERIA = 'qualquer'

const lerTermos = (texto: string) =>
  texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

/** Criar ou editar uma regra: o nome, se olha o app ou o título, os termos e como conta. */
export function DialogRegra({ regra, onClose }: { regra: Partial<Regra> | null; onClose: () => void }) {
  return (
    <Dialog open={regra !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className={cn(CAMADA, 'pt-6 sm:max-w-lg')}>
        {regra && <Formulario key={regra.id ?? 'nova'} inicial={regra} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function Formulario({ inicial, onClose }: { inicial: Partial<Regra>; onClose: () => void }) {
  const { dados, dispatch } = useDados()
  const [rotulo, setRotulo] = useState(inicial.rotulo ?? '')
  const [campo, setCampo] = useState<Regra['campo']>(inicial.campo ?? 'titulo')
  const [termos, setTermos] = useState(inicial.termos?.join(', ') ?? '')
  const [tipo, setTipo] = useState<Tipo>(inicial.tipo ?? 'fora')
  const [materiaId, setMateriaId] = useState(inicial.materiaId ?? SEM_MATERIA)
  const materias = dados.materias.filter((m) => !m.arquivada || m.id === inicial.materiaId)

  function salvar(e: FormEvent) {
    e.preventDefault()
    const lista = lerTermos(termos)
    if (lista.length === 0) return
    dispatch({
      tipo: 'regra/salvar',
      regra: {
        id: inicial.id ?? crypto.randomUUID(),
        rotulo: rotulo.trim() || lista[0],
        campo,
        termos: lista,
        tipo,
        materiaId: tipo === 'estudo' && materiaId !== SEM_MATERIA ? materiaId : undefined,
      },
    })
    onClose()
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{inicial.id ? 'Editar regra' : 'Nova regra'}</DialogTitle>
        <DialogDescription>Regras de título valem antes das de app (ex.: YouTube dentro do Chrome).</DialogDescription>
      </DialogHeader>
      <label className="flex flex-col gap-1.5">
        <span className={ROTULO}>Nome</span>
        <Input className={CAMPO} value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex.: Curso em Vídeo" autoFocus />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={ROTULO}>Olha</span>
        <ControleSegmentado
          rotulo="Onde procurar"
          valor={campo}
          onChange={setCampo}
          opcoes={[
            { valor: 'titulo', rotulo: 'Título da janela' },
            { valor: 'app', rotulo: 'Nome do app' },
          ]}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={ROTULO}>{campo === 'app' ? 'Nome do programa (ex.: anki, code)' : 'Título contém'}, separados por vírgula</span>
        <Input className={CAMPO} value={termos} onChange={(e) => setTermos(e.target.value)} placeholder={campo === 'app' ? 'anki' : 'curso em vídeo'} required />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={ROTULO}>Conta como</span>
        <SeletorTipo rotulo="Conta como" valor={tipo} onChange={setTipo} />
      </div>
      {tipo === 'estudo' && (
        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Estudo de qual matéria</span>
          <Select value={materiaId} onValueChange={setMateriaId}>
            <SelectTrigger className={CAMPO_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_MATERIA}>Qualquer uma (o app decide pelo dia)</SelectItem>
              {materias.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <PontoCor cor={m.cor} />
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}
      <DialogFooter className={cn(RODAPE_DIALOG, 'border-t-2 border-contorno pt-3')}>
        {inicial.id && (
          <Button
            type="button"
            variant="ghost"
            className={cn(BOTAO, 'mr-auto text-destructive')}
            onClick={() => {
              dispatch({ tipo: 'regra/excluir', id: inicial.id! })
              onClose()
            }}
          >
            Excluir
          </Button>
        )}
        <Button type="button" variant="outline" className={BOTAO} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" className={BOTAO}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
