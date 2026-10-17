import type { TipoErroIA } from '../api/ia'

/** O texto de cada falha numa análise (IAERR-01 a 04 e a resposta fora do formato). */
export const MENSAGEM_DE_ERRO: Record<TipoErroIA, string> = {
  Desligada: 'A IA está desligada. Ligue nas opções.',
  SemChave: 'Salve uma chave do Gemini nas opções.',
  Chave: 'O Gemini recusou a chave. Confira nas opções.',
  Cota: 'A cota da sua chave do Gemini acabou por agora. Tente mais tarde.',
  Conexao: 'Sem conexão com o Gemini.',
  Tempo: 'O Gemini demorou demais. Tente de novo.',
  Indisponivel: 'O Gemini está indisponível agora. Tente de novo.',
  Resposta: 'A resposta do Gemini veio incompleta. Tente de novo.',
  Cofre: 'Não deu para guardar a chave neste PC.',
}

/** No teste da chave, os textos dizem o que houve com ela (IACONF-05, IACONF-06). */
const NO_TESTE_DA_CHAVE: Partial<Record<TipoErroIA, string>> = {
  Chave: 'O Gemini recusou esta chave. Confira se ela foi copiada inteira.',
  Conexao: 'Sem conexão com o Gemini. A chave não foi salva.',
}

/** O tipo de um erro vindo do Rust; qualquer outra coisa conta como resposta incompleta. */
export function tipoDoErro(erro: unknown): TipoErroIA {
  const tipo = typeof erro === 'object' && erro !== null && 'tipo' in erro ? erro.tipo : undefined
  return typeof tipo === 'string' && Object.hasOwn(MENSAGEM_DE_ERRO, tipo) ? (tipo as TipoErroIA) : 'Resposta'
}

/** A mensagem para a pessoa: no teste da chave ou numa análise. */
export function mensagemDoErro(erro: unknown, contexto: 'teste' | 'analise' = 'analise'): string {
  const tipo = tipoDoErro(erro)
  return (contexto === 'teste' ? NO_TESTE_DA_CHAVE[tipo] : undefined) ?? MENSAGEM_DE_ERRO[tipo]
}
