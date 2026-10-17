import type { DataISO } from '@/shared/lib/datas'

/** Versão do formato salvo em `dados.json`. Ao mudar o formato, suba a versão e converta em `atualizarDados`. */
export const VERSAO_DADOS = 4

export type Categoria = 'estudo' | 'trabalho' | 'jogo' | 'treino' | 'terapia' | 'sono'

/**
 * Estudo soma no banco; trabalho tem total próprio (não soma no banco e não é distração); fora do estudo é
 * distração (ou ausência); ignorar fica registrado, mas não conta.
 */
export type Tipo = 'estudo' | 'trabalho' | 'fora' | 'ignorar'

/** Correção de um grupo de janelas num dia: outro tipo ou estudo de uma matéria (`materia:<id>`). */
export type Ajuste = Tipo | `materia:${string}`

export interface Materia {
  id: string
  nome: string
  /** Hex da paleta (dado do usuário). */
  cor: string
  /** Some das escolhas, mas continua no histórico. */
  arquivada?: boolean
  /** Palavras de app ou de título que identificam a matéria ("blender", "verb tenses"). O nome também conta. */
  termos?: string[]
}

/** Meta de uma matéria numa semana: o que estudar (a etapa) e quantas horas focadas. */
export interface Meta {
  id: string
  materiaId: string
  /** Segunda-feira da semana. */
  semana: DataISO
  minutos: number
  /** A etapa da semana ("Verbos irregulares"). */
  descricao: string
}

/**
 * Item recorrente da rotina. Com horário, aparece na grade (se `fim <= inicio`, passa da meia-noite).
 * Sem horário, é um objetivo que se repete naquele dia da semana.
 */
export interface BlocoRotina {
  id: string
  titulo: string
  categoria: Categoria
  /** Dias em que começa, de 0 (domingo) a 6 (sábado). */
  dias: number[]
  /** Minutos do dia (0 a 1439). Os dois ausentes: item sem horário. */
  inicio?: number
  fim?: number
  /** Matéria do bloco de estudo. */
  materiaId?: string
  /** Notificar quando o bloco começa (só estudo com horário). */
  avisar: boolean
}

export type BlocoComHorario = BlocoRotina & { inicio: number; fim: number }

export const temHorario = (b: BlocoRotina): b is BlocoComHorario => b.inicio !== undefined && b.fim !== undefined

/** O que a pessoa quer fazer num dia. Não tem botão: recebe o tempo que a atribuição liga a ele. */
export interface Objetivo {
  id: string
  /** Dia lógico. */
  dia: DataISO
  materiaId?: string
  /** Texto livre, para objetivos sem matéria ("Modelar a cadeira"). */
  titulo?: string
  /** Palavras do dia que ligam janelas a este objetivo, além das da matéria. */
  termos?: string[]
  origem: 'rotina' | 'relato' | 'manual'
  /** Ausente = estudo (todos os objetivos até o formato 3). */
  tipo?: 'estudo' | 'trabalho'
  /** Item da rotina que gerou o objetivo. */
  itemId?: string
  ordem: number
  /** Tirado do dia pela pessoa (os da rotina não são apagados, para não voltarem). */
  pulado?: boolean
}

/** Intervalo contínuo na mesma janela, registrado pelo Rust (`src-tauri/src/rastreador.rs`). */
export interface Trecho {
  /** Milissegundos desde 1970. */
  inicio: number
  fim: number
  titulo: string
  processo: string
  proprio: boolean
  ausente: boolean
  /** Captura pausada: o relógio andou, mas a janela não foi lida. */
  semCaptura?: boolean
}

export type MotivoPausa = 'manual' | 'ausencia' | 'suspensao' | 'desligado'

/** Intervalo sem registro dentro da sessão do dia. */
export interface Pausa {
  inicio: number
  fim: number
  motivo: MotivoPausa
}

/** O tempo capturado num dia lógico, do play até a pausa final, o relato final ou a virada do dia. */
export interface Sessao {
  id: string
  /** Dia lógico. */
  dia: DataISO
  inicio: number
  fim: number
  pausas: Pausa[]
  trechos: Trecho[]
  /** Correções feitas no relato final (ou no fim de uma sessão antiga). */
  ajustes: Record<string, Ajuste>
  /** Todo o tempo de estudo (com e sem objetivo). */
  focoMs: number
  foraMs: number
  /** Tempo de trabalho (regra, objetivo de trabalho, expediente ou correção). */
  trabalhoMs: number
  /** Estudo atribuído a cada matéria. */
  focoPorMateria: Record<string, number>
  /** Estudo que o app não soube ligar a um objetivo. */
  semObjetivoMs: number
  /** Evidência própria da sessão (texto). Com ela, o tempo entra no banco mesmo sem relato. */
  anotacao: string
  /** Nomes dos arquivos na pasta de imagens do app. */
  imagens: string[]
  /** Sessões até o formato 2: um pomodoro de uma matéria. */
  materiaId?: string
  duracaoPlanejadaMin?: number
}

/** Regra que classifica janelas: o nome do app ou uma palavra no título. As de título valem antes. */
export interface Regra {
  id: string
  rotulo: string
  campo: 'app' | 'titulo'
  termos: string[]
  tipo: Tipo
  /** Regra de estudo que aponta para uma matéria. */
  materiaId?: string
}

export interface Relato {
  id: string
  /** Dia lógico a que o relato se refere. */
  dia: DataISO
  momento: 'inicial' | 'final'
  texto: string
  origem: 'texto' | 'voz'
  /** De 1 a 5, só no relato final. */
  humor?: number
  /** Correções do dia feitas no relato final (grupo de janelas → tipo ou matéria). Valem para as sessões do dia. */
  ajustes?: Record<string, Ajuste>
  criadoEm: number
  /** Relato final feito no dia lógico seguinte. */
  atrasado: boolean
}

/** Sugestão da IA para um grupo de janelas do dia. Aceita = o ajuste do relato é igual a ela. */
export interface SugestaoIA {
  /** A `Classe.chave` do grupo, a mesma chave dos `ajustes` do relato final. */
  chave: string
  ajuste: Ajuste
  /** Até 140 caracteres. */
  motivo: string
  recusada?: boolean
}

export interface InsightDia {
  id: string
  tipo: 'dia'
  dia: DataISO
  texto: string
  sugestoes: SugestaoIA[]
  modelo: string
  criadoEm: number
}

export interface InsightSemana {
  id: string
  tipo: 'semana'
  /** Segunda-feira da semana. */
  semana: DataISO
  partes: { comoFoi: string; padroes: string; proximaSemana: string }
  modelo: string
  criadoEm: number
}

/** Um por dia e um por semana; gerar de novo substitui. */
export type Insight = InsightDia | InsightSemana

export type ModeloVoz = 'base' | 'small'

export interface Preferencias {
  /** Lembrete de pausa a cada N minutos (o antigo pomodoro); `null` desliga. Não para a sessão. */
  cicloMin: number | null
  /** Sem mexer no teclado e no mouse por esse tempo, o trecho conta como ausente. */
  limiteAusenciaMin: number
  /** Ausência maior que isso vira pausa automática; a captura volta quando a pessoa volta. */
  ausenciaLongaMin: number
  avisoDistracao: boolean
  avisoDistracaoSeg: number
  /** Minuto do dia em que o dia lógico começa (padrão: 4h). Na virada, a sessão do dia para. */
  inicioDoDiaMin: number
  relatos: boolean
  avisoRelatoFinal: boolean
  /** Minuto do dia do aviso do relato final. */
  relatoFinalMin: number
  /** Atalho global de play/pause ("CommandOrControl+Shift+Space"); `null` desliga. */
  atalho: string | null
  iniciarComSistema: boolean
  voz: boolean
  modeloVoz: ModeloVoz
  /** "Usar IA (Gemini)". Só fica ligada com chave salva e consentimento. */
  ia: boolean
  /** Momento do consentimento; `null` = nunca concordou. */
  consentimentoIA: number | null
  /** "Sobre você", até 2.000 caracteres. */
  sobreVoce: string
  /** "Não mostrar de novo" na sugestão de cadastrar o horário de trabalho. */
  ocultarAvisoExpediente: boolean
}

export interface Dados {
  materias: Materia[]
  metas: Meta[]
  blocos: BlocoRotina[]
  objetivos: Objetivo[]
  sessoes: Sessao[]
  relatos: Relato[]
  regras: Regra[]
  preferencias: Preferencias
  insights: Insight[]
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  cicloMin: null,
  limiteAusenciaMin: 5,
  ausenciaLongaMin: 15,
  avisoDistracao: true,
  avisoDistracaoSeg: 60,
  inicioDoDiaMin: 4 * 60,
  relatos: true,
  avisoRelatoFinal: true,
  relatoFinalMin: 21 * 60 + 30,
  atalho: null,
  iniciarComSistema: false,
  voz: true,
  modeloVoz: 'base',
  ia: false,
  consentimentoIA: null,
  sobreVoce: '',
  ocultarAvisoExpediente: false,
}

const app = (rotulo: string, termos: string[], tipo: Tipo): Regra => ({ id: crypto.randomUUID(), rotulo, campo: 'app', termos, tipo })
const titulo = (rotulo: string, termos: string[], tipo: Tipo): Regra => ({
  id: crypto.randomUUID(),
  rotulo,
  campo: 'titulo',
  termos,
  tipo,
})

/**
 * Regras de partida. Janela sem regra conta como fora do estudo, então os apps de estudo comuns já vêm marcados.
 * O título da aba do navegador vem no título da janela, então sites casam pelo título.
 */
export function regrasPadrao(): Regra[] {
  return [
    app('VS Code', ['code', 'cursor'], 'estudo'),
    app('IntelliJ', ['idea64', 'pycharm64', 'webstorm64', 'jetbrains'], 'estudo'),
    app(
      'Terminal',
      ['windowsterminal', 'powershell', 'cmd', 'gnome-terminal', 'ptyxis', 'konsole', 'kitty', 'alacritty', 'wezterm', 'xterm', 'tilix'],
      'estudo',
    ),
    app('Anki', ['anki'], 'estudo'),
    app('Notion', ['notion'], 'estudo'),
    app('Obsidian', ['obsidian'], 'estudo'),
    app('Leitor de PDF', ['acrobat', 'acrord32', 'sumatrapdf', 'evince', 'okular', 'zathura', 'papers'], 'estudo'),
    titulo('Documentação e dicionários', ['mdn', 'stack overflow', 'cambridge', 'duolingo', 'github', 'docs'], 'estudo'),
    titulo('ChatGPT e Claude', ['chatgpt', 'claude'], 'estudo'),
    titulo('YouTube', ['youtube'], 'fora'),
    app('Discord', ['discord'], 'fora'),
    titulo('WhatsApp', ['whatsapp'], 'fora'),
    titulo('Redes sociais', ['instagram', 'tiktok', 'twitter', ' / x', 'reddit', 'facebook'], 'fora'),
    titulo('Streaming', ['netflix', 'twitch', 'prime video', 'disney+', 'hbo max', 'globoplay', 'crunchyroll'], 'fora'),
    app('Steam', ['steam', 'epicgameslauncher'], 'fora'),
    titulo('Jogos', ['league of legends', 'valorant', 'minecraft', 'roblox', 'fortnite', 'counter-strike'], 'fora'),
    app('Spotify', ['spotify'], 'ignorar'),
    app('Explorador de arquivos', ['explorer', 'nautilus', 'dolphin', 'thunar', 'nemo'], 'ignorar'),
  ]
}

export function dadosIniciais(): Dados {
  return {
    materias: [
      { id: crypto.randomUUID(), nome: 'Programação', cor: '#1f45c4' },
      { id: crypto.randomUUID(), nome: 'Inglês', cor: '#d7322a' },
    ],
    metas: [],
    blocos: [],
    objetivos: [],
    sessoes: [],
    relatos: [],
    regras: regrasPadrao(),
    preferencias: PREFERENCIAS_PADRAO,
    insights: [],
  }
}
