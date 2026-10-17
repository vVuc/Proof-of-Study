import type { Materia, Objetivo, Regra, Tipo, Trecho } from '@/store/model/dados'

/** As regras de título valem antes das de app, para servirem de exceção (YouTube dentro do Chrome). */
export function ordenarRegras(regras: Regra[]): Regra[] {
  return [...regras.filter((r) => r.campo === 'titulo'), ...regras.filter((r) => r.campo === 'app')]
}

function casa(regra: Regra, titulo: string, processo: string): boolean {
  const alvo = (regra.campo === 'app' ? processo : titulo).toLowerCase()
  return regra.termos.some((t) => {
    const termo = t.trim().toLowerCase()
    return termo !== '' && alvo.includes(termo)
  })
}

/** Primeira regra que casa com a janela. Mesma lógica de `regra_que_casa` no Rust. */
export function regraQueCasa(regras: Regra[], titulo: string, processo: string): Regra | undefined {
  return ordenarRegras(regras).find((r) => casa(r, titulo, processo))
}

/** Nomes do Windows (executável) e do Linux (classe da janela, ex.: `Google-chrome`). */
const NAVEGADORES = new Set([
  'chrome',
  'msedge',
  'firefox',
  'brave',
  'opera',
  'vivaldi',
  'arc',
  'zen',
  'google-chrome',
  'chromium',
  'chromium-browser',
  'brave-browser',
  'microsoft-edge',
  'firefox-esr',
  'librewolf',
])

const NOMES_PROGRAMAS: Record<string, string> = {
  chrome: 'Chrome',
  msedge: 'Edge',
  firefox: 'Firefox',
  brave: 'Brave',
  opera: 'Opera',
  code: 'VS Code',
  cursor: 'Cursor',
  idea64: 'IntelliJ',
  explorer: 'Explorador de Arquivos',
  windowsterminal: 'Terminal',
  cmd: 'Prompt de Comando',
  powershell: 'PowerShell',
  notepad: 'Bloco de Notas',
  winword: 'Word',
  excel: 'Excel',
  powerpnt: 'PowerPoint',
  acrobat: 'Acrobat',
  acrord32: 'Acrobat Reader',
  obsidian: 'Obsidian',
  notion: 'Notion',
  anki: 'Anki',
  discord: 'Discord',
  spotify: 'Spotify',
  whatsapp: 'WhatsApp',
  'ms-teams': 'Teams',
  slack: 'Slack',
  steam: 'Steam',
  lockapp: 'Tela de bloqueio',
  // Linux: classe da janela.
  'google-chrome': 'Chrome',
  chromium: 'Chromium',
  'chromium-browser': 'Chromium',
  'brave-browser': 'Brave',
  'microsoft-edge': 'Edge',
  'jetbrains-idea': 'IntelliJ',
  'gnome-terminal-server': 'Terminal',
  'org.gnome.ptyxis': 'Terminal',
  konsole: 'Konsole',
  'org.gnome.nautilus': 'Arquivos',
  dolphin: 'Dolphin',
  'org.gnome.evince': 'Visualizador de documentos',
  okular: 'Okular',
}

export function nomeDoPrograma(processo: string): string {
  if (!processo) return 'Sem programa'
  return NOMES_PROGRAMAS[processo.toLowerCase()] ?? processo
}

export const ehNavegador = (processo: string) => NAVEGADORES.has(processo.toLowerCase())

/** " - Google Chrome", " — Mozilla Firefox", " - Microsoft Edge" (o Edge põe um espaço invisível antes de Edge). */
const SUFIXO_NAVEGADOR = /\s[-—–]\s(?:google chrome|mozilla firefox|microsoft​?\s?edge|chromium|brave|opera|vivaldi)$/i

/** O site, pelo título da aba: o último pedaço depois de " - " ("Caixa de entrada - Gmail" → "Gmail"). */
export function siteDoTitulo(titulo: string): string {
  const semNavegador = titulo.replace(SUFIXO_NAVEGADOR, '').trim()
  const partes = semNavegador
    .split(/\s[-—–|]\s/)
    .map((p) => p.trim())
    .filter(Boolean)
  return partes.at(-1) ?? semNavegador
}

export interface Classe {
  /** Identifica o grupo no resumo e nas correções do dia. */
  chave: string
  rotulo: string
  tipo: Tipo
  /** Matéria do estudo, quando a janela diz qual é (termo da matéria ou regra com matéria). */
  materiaId?: string
  /** Objetivo do dia que casou pelos termos dele. */
  objetivoId?: string
  /** Nenhuma regra casou: conta como fora do estudo, e aparece como sugestão em Apps e sites. */
  semRegra?: boolean
  /** Para criar uma regra a partir do grupo. */
  sugestao?: { campo: 'app' | 'titulo'; termo: string }
  /** Captura pausada, ausência e o próprio app não mudam de tipo no resumo. */
  fixo?: boolean
}

export const ROTULO_TIPO: Record<Tipo, string> = { estudo: 'Estudo', trabalho: 'Trabalho', fora: 'Fora do estudo', ignorar: 'Ignorar' }

type JanelaLida = Pick<Trecho, 'titulo' | 'processo' | 'proprio' | 'ausente' | 'semCaptura'>

/** O que, além das regras, ajuda a classificar: as matérias (nome e termos) e os objetivos do dia. */
export interface ContextoClassificacao {
  regras: Regra[]
  materias?: Materia[]
  objetivos?: Objetivo[]
}

/** Minúsculas e sem acento, para "Inglês" casar com "ingles". Mesma conta de `normalizar` no Rust. */
export const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

const ehLetraOuDigito = (c: string | undefined) => c !== undefined && /[a-z0-9]/.test(c)

/** O termo aparece como palavra inteira ("go" não casa com "google"). Os dois já normalizados. */
export function contemPalavra(texto: string, termo: string): boolean {
  if (!termo) return false
  for (let i = texto.indexOf(termo); i !== -1; i = texto.indexOf(termo, i + 1)) {
    if (!ehLetraOuDigito(texto[i - 1]) && !ehLetraOuDigito(texto[i + termo.length])) return true
  }
  return false
}

/** Palavras comuns que não identificam um objetivo de texto livre ("Estudar a cadeira" → só "cadeira"). */
const PALAVRAS_VAZIAS = new Set(['estudar', 'estudo', 'fazer', 'revisar', 'revisao', 'terminar', 'comecar', 'continuar', 'sobre', 'para', 'praticar', 'ler', 'aula', 'aulas'])

/** Termos de uma matéria: o nome e os termos dela, normalizados. */
export const termosDaMateria = (m: Pick<Materia, 'nome' | 'termos'>) =>
  [m.nome, ...(m.termos ?? [])].map((t) => normalizar(t.trim())).filter(Boolean)

/** Termos de um objetivo do dia: os explícitos e, num objetivo de texto livre, as palavras do título. */
export function termosDoObjetivo(o: Pick<Objetivo, 'titulo' | 'termos' | 'materiaId'>): string[] {
  const doTitulo =
    !o.materiaId && o.titulo
      ? normalizar(o.titulo)
          .split(/[^a-z0-9]+/)
          .filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p))
      : []
  return [...(o.termos ?? []).map((t) => normalizar(t.trim())), ...doTitulo].filter(Boolean)
}

/**
 * Objetivo ou matéria cujos termos aparecem no título (ou no nome do programa) da janela. Os objetivos de trabalho
 * vêm primeiro e dão trabalho; os de estudo e as matérias dão estudo.
 */
function porTermos(titulo: string, processo: string, contexto: ContextoClassificacao): Pick<Classe, 'chave' | 'rotulo' | 'tipo' | 'materiaId' | 'objetivoId'> | null {
  const alvo = `${normalizar(titulo)} ${normalizar(processo)}`
  const casa = (o: Objetivo) => termosDoObjetivo(o).some((t) => contemPalavra(alvo, t))
  const trabalho = (contexto.objetivos ?? []).find((o) => !o.pulado && o.tipo === 'trabalho' && casa(o))
  if (trabalho) return { chave: `objetivo:${trabalho.id}`, rotulo: trabalho.titulo || 'Objetivo', tipo: 'trabalho', objetivoId: trabalho.id }
  for (const o of contexto.objetivos ?? []) {
    if (o.pulado) continue
    if (casa(o)) {
      const materia = contexto.materias?.find((m) => m.id === o.materiaId)
      return { chave: `objetivo:${o.id}`, rotulo: o.titulo || materia?.nome || 'Objetivo', tipo: 'estudo', objetivoId: o.id, materiaId: o.materiaId }
    }
  }
  for (const m of contexto.materias ?? []) {
    if (m.arquivada) continue
    if (termosDaMateria(m).some((t) => contemPalavra(alvo, t))) return { chave: `materia:${m.id}`, rotulo: m.nome, tipo: 'estudo', materiaId: m.id }
  }
  return null
}

/**
 * Em que grupo o trecho entra e como conta por padrão. A ordem:
 * 1. casos fixos (captura pausada, ausência, o próprio app);
 * 2. termos dos objetivos de trabalho do dia no título: trabalho, mesmo que a janela case com estudo ou com uma regra;
 * 3. termos dos objetivos de estudo do dia e das matérias no título: estudo daquela matéria (separa o tutorial de
 *    Blender no YouTube do vídeo qualquer no mesmo site);
 * 4. regras, as de título antes das de app (a primeira que casa decide);
 * 5. sem regra: fora do estudo.
 */
export function classificar(trecho: JanelaLida, contexto: ContextoClassificacao | Regra[]): Classe {
  const ctx = Array.isArray(contexto) ? { regras: contexto } : contexto
  if (trecho.semCaptura) return { chave: 'sem-captura', rotulo: 'Captura pausada', tipo: 'ignorar', fixo: true }
  if (trecho.ausente) return { chave: 'ausente', rotulo: 'Ausente do PC', tipo: 'fora' }
  if (trecho.proprio) return { chave: 'proprio', rotulo: 'Proof of Study', tipo: 'ignorar', fixo: true }
  const termo = porTermos(trecho.titulo, trecho.processo, ctx)
  if (termo) return termo
  const regra = regraQueCasa(ctx.regras, trecho.titulo, trecho.processo)
  if (regra)
    return { chave: `regra:${regra.id}`, rotulo: regra.rotulo, tipo: regra.tipo, materiaId: regra.tipo === 'estudo' ? regra.materiaId : undefined }
  if (ehNavegador(trecho.processo) && trecho.titulo) {
    const site = siteDoTitulo(trecho.titulo)
    return { chave: `site:${site.toLowerCase()}`, rotulo: site, tipo: 'fora', semRegra: true, sugestao: { campo: 'titulo', termo: site } }
  }
  const programa = nomeDoPrograma(trecho.processo)
  return {
    chave: `app:${trecho.processo.toLowerCase()}`,
    rotulo: programa,
    tipo: 'fora',
    semRegra: true,
    sugestao: trecho.processo ? { campo: 'app', termo: trecho.processo.toLowerCase() } : undefined,
  }
}
