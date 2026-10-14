import { invoke } from '@tauri-apps/api/core'
import { load, type Store } from '@tauri-apps/plugin-store'
import { VERSAO_DADOS, type Dados } from '../model/dados'
import { atualizarDados, type DadosSalvos } from '../model/migracao'

/** Tudo num JSON na pasta de dados do app (`%APPDATA%\io.github.mizerski.proofofstudy` no Windows, `~/.local/share/...` no Linux). Imagens ficam à parte. */
export const ARQUIVO_DADOS = 'dados.json'

let arquivo: Promise<Store> | undefined
const abrir = () => (arquivo ??= load(ARQUIVO_DADOS, { autoSave: false, defaults: {} }))

export interface Carregados {
  dados: Dados
  /** Os dados vieram de um formato antigo: a versão e o caminho da cópia guardada antes de converter. */
  migracao: { de: number; backup: string } | null
}

export async function carregarDados(): Promise<Carregados> {
  const store = await abrir()
  const salvo = await store.get<DadosSalvos>('dados')
  const versao = (await store.get<number>('versao')) ?? VERSAO_DADOS
  const dados = atualizarDados(salvo, versao)
  if (!salvo || versao >= VERSAO_DADOS) return { dados, migracao: null }
  // Antes da primeira gravação no formato novo, guarda uma cópia do arquivo antigo (para voltar de versão).
  const backup = await invoke<string>('dados_backup', { arquivo: ARQUIVO_DADOS, versao })
  return { dados, migracao: { de: versao, backup } }
}

export async function gravarDados(dados: Dados): Promise<void> {
  const store = await abrir()
  await store.set('versao', VERSAO_DADOS)
  await store.set('dados', dados)
  await store.save()
}
