//! Porta única para o Gemini (AD-001): o front monta o pedido (instrução, entrada e esquema da resposta) e valida o
//! JSON que volta; aqui ficam o modelo, a chave e a chamada à Interactions API, com os erros traduzidos. A chave
//! nunca vai para o log nem para as mensagens de erro.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Manager, State};

/// Modelo das análises, fixo no código.
pub const MODELO: &str = "gemini-3.8-flash";
const URL_INTERACOES: &str = "https://generativelanguage.googleapis.com/v1beta/interactions";
/// Lista um modelo só: confirma a chave sem gastar tokens.
const URL_TESTE_DA_CHAVE: &str = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1";
/// Tempo máximo de uma chamada, com a leitura da resposta.
const LIMITE: Duration = Duration::from_secs(60);

/// O que o front pede: o tipo (`dia`, `semana`, `plano` ou `teste`), a instrução do sistema, a entrada e o JSON Schema
/// da resposta.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoIA {
    pub tipo: String,
    pub sistema: String,
    pub entrada: String,
    pub esquema: Value,
}

/// O texto JSON da resposta, ainda sem validar (quem valida é o front).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RespostaIA {
    pub texto: String,
    pub modelo: String,
    pub tokens: Option<u64>,
}

/// Falhas da IA, cada uma com a sua mensagem no front.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "tipo")]
pub enum ErroIA {
    Desligada,
    SemChave,
    Chave,
    Cota,
    Conexao,
    Tempo,
    Indisponivel,
    Resposta,
    Cofre { detalhe: String },
    /// O microfone não abriu (ausente ou negado) na voz ao vivo (VOZ-07).
    Microfone,
}

/// O corpo do `POST /v1beta/interactions`: saída em JSON pelo esquema e `store: false`, para não deixar estado no
/// servidor.
pub fn corpo_da_interacao(pedido: &PedidoIA) -> Value {
    json!({
        "model": MODELO,
        "system_instruction": pedido.sistema,
        "input": pedido.entrada,
        "response_format": { "type": "text", "mime_type": "application/json", "schema": pedido.esquema },
        "store": false,
    })
}

/// O texto da resposta: os pedaços de texto dos passos `model_output`, juntos. Sem nenhum, `None`.
pub fn texto_da_interacao(resposta: &Value) -> Option<String> {
    let texto: String = resposta
        .get("steps")?
        .as_array()?
        .iter()
        .filter(|passo| passo.get("type").and_then(Value::as_str) == Some("model_output"))
        .filter_map(|passo| passo.get("content").and_then(Value::as_array))
        .flatten()
        .filter(|parte| parte.get("type").and_then(Value::as_str) == Some("text"))
        .filter_map(|parte| parte.get("text").and_then(Value::as_str))
        .collect();
    (!texto.is_empty()).then_some(texto)
}

/// O erro de uma resposta HTTP que não deu certo. O corpo só é lido para reconhecer a chave recusada.
pub fn erro_do_status(status: u16, corpo: &str) -> ErroIA {
    match status {
        401 | 403 => ErroIA::Chave,
        400 if corpo.contains("API key") => ErroIA::Chave,
        429 => ErroIA::Cota,
        500..=599 => ErroIA::Indisponivel,
        _ => ErroIA::Resposta,
    }
}

/// Os 4 últimos caracteres da chave, o único pedaço que a tela mostra.
pub fn final_da_chave(chave: &str) -> String {
    let n = chave.chars().count();
    chave.chars().skip(n.saturating_sub(4)).collect()
}

/// Onde a chave fica: no cofre do sistema (Gerenciador de Credenciais no Windows, Secret Service no Linux) ou, sem
/// ele, num arquivo só da pessoa (`0600`) na pasta do app. Nunca no `dados.json`, e nada daqui vai para o log.
pub mod cofre {
    use std::io::Write;
    use std::path::Path;

    use keyring::v1::{Entry, Error};
    use serde::Serialize;

    use super::ErroIA;

    const SERVICO: &str = "io.github.mizerski.proofofstudy";
    const USUARIO: &str = "gemini";
    /// Nome do arquivo da alternativa, na pasta de dados do app.
    pub const ARQUIVO: &str = "ia-chave";

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
    #[serde(rename_all = "lowercase")]
    pub enum Cofre {
        Sistema,
        Arquivo,
    }

    fn entrada() -> Option<Entry> {
        Entry::new(SERVICO, USUARIO).ok()
    }

    /// Guarda no cofre do sistema; se ele não existir ou recusar, no arquivo da pasta do app.
    pub fn guardar(pasta: &Path, chave: &str) -> Result<Cofre, ErroIA> {
        if entrada().is_some_and(|e| e.set_password(chave).is_ok()) {
            // Uma chave antiga no arquivo não fica para trás.
            apagar_arquivo(&pasta.join(ARQUIVO))?;
            return Ok(Cofre::Sistema);
        }
        guardar_em_arquivo(&pasta.join(ARQUIVO), chave)?;
        Ok(Cofre::Arquivo)
    }

    /// A chave guardada e onde ela está.
    pub fn ler(pasta: &Path) -> Option<(String, Cofre)> {
        if let Some(chave) = entrada().and_then(|e| e.get_password().ok()) {
            return Some((chave, Cofre::Sistema));
        }
        ler_de_arquivo(&pasta.join(ARQUIVO)).map(|chave| (chave, Cofre::Arquivo))
    }

    /// Apaga a chave do cofre do sistema e do arquivo.
    pub fn apagar(pasta: &Path) -> Result<(), ErroIA> {
        if let Some(e) = entrada() {
            match e.delete_credential() {
                // Sem a chave no cofre (ou sem cofre), resta o arquivo.
                Ok(()) | Err(Error::NoEntry | Error::NoDefaultStore) => {}
                Err(_) => return Err(ErroIA::Cofre { detalhe: "o cofre do sistema não apagou a chave".into() }),
            }
        }
        apagar_arquivo(&pasta.join(ARQUIVO))
    }

    fn erro_de_arquivo(erro: std::io::Error) -> ErroIA {
        ErroIA::Cofre { detalhe: format!("arquivo da chave: {}", erro.kind()) }
    }

    /// Grava a chave no arquivo, só com leitura e escrita do dono no Unix.
    pub fn guardar_em_arquivo(caminho: &Path, chave: &str) -> Result<(), ErroIA> {
        if let Some(pasta) = caminho.parent() {
            std::fs::create_dir_all(pasta).map_err(erro_de_arquivo)?;
        }
        let mut opcoes = std::fs::OpenOptions::new();
        opcoes.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
            opcoes.mode(0o600);
            // Um arquivo que já existia mantém as permissões antigas: elas são corrigidas antes de gravar.
            if caminho.exists() {
                std::fs::set_permissions(caminho, std::fs::Permissions::from_mode(0o600)).map_err(erro_de_arquivo)?;
            }
        }
        let mut arquivo = opcoes.open(caminho).map_err(erro_de_arquivo)?;
        arquivo.write_all(chave.as_bytes()).map_err(erro_de_arquivo)
    }

    pub fn ler_de_arquivo(caminho: &Path) -> Option<String> {
        let chave = std::fs::read_to_string(caminho).ok()?.trim().to_string();
        (!chave.is_empty()).then_some(chave)
    }

    pub fn apagar_arquivo(caminho: &Path) -> Result<(), ErroIA> {
        match std::fs::remove_file(caminho) {
            Err(erro) if erro.kind() != std::io::ErrorKind::NotFound => Err(erro_de_arquivo(erro)),
            _ => Ok(()),
        }
    }
}

/// O que a tela de opções sabe da chave: se há uma, os 4 últimos caracteres e onde ela está.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoChave {
    pub salva: bool,
    #[serde(rename = "final")]
    pub final_da_chave: Option<String>,
    pub cofre: Option<cofre::Cofre>,
}

fn estado_da_chave(chave: Option<&(String, cofre::Cofre)>) -> EstadoChave {
    EstadoChave { salva: chave.is_some(), final_da_chave: chave.map(|(c, _)| final_da_chave(c)), cofre: chave.map(|(_, k)| *k) }
}

#[derive(Default)]
struct Interno {
    /// "Usar IA (Gemini)", como o front avisou. Desligada, nada chama o Gemini.
    ligada: bool,
    /// A chave guardada, lida do cofre na primeira vez (`None` = ainda não lida).
    chave: Option<Option<(String, cofre::Cofre)>>,
}

#[derive(Default)]
pub struct IA(Mutex<Interno>);

/// Só chama o Gemini com a IA ligada e com a chave salva (IACONF-01). Devolve a chave da chamada.
pub fn pode_chamar(ligada: bool, chave: Option<&str>) -> Result<String, ErroIA> {
    if !ligada {
        return Err(ErroIA::Desligada);
    }
    chave.map(str::to_owned).ok_or(ErroIA::SemChave)
}

/// Guarda a chave só depois que o Gemini a aceitou no teste (IACONF-04 a 06).
pub fn salvar_se_aceita(
    chave: &str,
    testar: impl FnOnce(&str) -> Result<(), ErroIA>,
    guardar: impl FnOnce(&str) -> Result<cofre::Cofre, ErroIA>,
) -> Result<cofre::Cofre, ErroIA> {
    testar(chave)?;
    guardar(chave)
}

fn nome_do_erro(erro: &ErroIA) -> &'static str {
    match erro {
        ErroIA::Desligada => "Desligada",
        ErroIA::SemChave => "SemChave",
        ErroIA::Chave => "Chave",
        ErroIA::Cota => "Cota",
        ErroIA::Conexao => "Conexao",
        ErroIA::Tempo => "Tempo",
        ErroIA::Indisponivel => "Indisponivel",
        ErroIA::Resposta => "Resposta",
        ErroIA::Cofre { .. } => "Cofre",
        ErroIA::Microfone => "Microfone",
    }
}

/// O evento `ia.chamada`: o tipo, a duração, o resultado e os tokens. Nada do pedido, da resposta, do erro cru nem da
/// chave (IAERR-06). Um tipo desconhecido vira `outro`, para nenhum texto do front entrar no log por ele.
pub fn evento_da_chamada(tipo: &str, ms: u64, resultado: Result<Option<u64>, &ErroIA>) -> Value {
    let tipo = match tipo {
        "dia" | "semana" | "plano" | "teste" => tipo,
        _ => "outro",
    };
    let (resultado, tokens) = match resultado {
        Ok(tokens) => ("ok", tokens),
        Err(erro) => (nome_do_erro(erro), None),
    };
    json!({ "tipo": tipo, "ms": ms, "resultado": resultado, "tokens": tokens })
}

fn registrar(evento: &Value) {
    if evento["resultado"] == "ok" {
        log::info!(target: "ia", "ia.chamada {evento}");
    } else {
        log::warn!(target: "ia", "ia.chamada {evento}");
    }
}

fn ms_desde(inicio: Instant) -> u64 {
    u64::try_from(inicio.elapsed().as_millis()).unwrap_or(u64::MAX)
}

/// Falha sem resposta HTTP: o limite de 60 s (IAERR-01) ou a falta de conexão (IAERR-04).
pub fn erro_de_transporte(erro: &ureq::Error) -> ErroIA {
    match erro {
        ureq::Error::Timeout(_) => ErroIA::Tempo,
        _ => ErroIA::Conexao,
    }
}

fn agente() -> ureq::Agent {
    ureq::Agent::config_builder().timeout_global(Some(LIMITE)).http_status_as_error(false).build().into()
}

/// O corpo de uma resposta 2xx; fora disso, o erro traduzido pelo status.
fn ler_resposta(resultado: Result<ureq::http::Response<ureq::Body>, ureq::Error>) -> Result<String, ErroIA> {
    let mut resposta = resultado.map_err(|e| erro_de_transporte(&e))?;
    let status = resposta.status().as_u16();
    let corpo = resposta.body_mut().read_to_string().map_err(|e| erro_de_transporte(&e))?;
    if (200..300).contains(&status) { Ok(corpo) } else { Err(erro_do_status(status, &corpo)) }
}

fn testar_chave(chave: &str) -> Result<(), ErroIA> {
    ler_resposta(agente().get(URL_TESTE_DA_CHAVE).header("x-goog-api-key", chave).call()).map(|_| ())
}

fn gerar(chave: &str, pedido: &PedidoIA) -> Result<RespostaIA, ErroIA> {
    let corpo = corpo_da_interacao(pedido).to_string();
    let texto = ler_resposta(
        agente().post(URL_INTERACOES).header("x-goog-api-key", chave).header("content-type", "application/json").send(corpo),
    )?;
    let valor: Value = serde_json::from_str(&texto).map_err(|_| ErroIA::Resposta)?;
    let texto = texto_da_interacao(&valor).ok_or(ErroIA::Resposta)?;
    let tokens = valor.pointer("/usage/total_tokens").and_then(Value::as_u64);
    Ok(RespostaIA { texto, modelo: MODELO.into(), tokens })
}

fn pasta(app: &AppHandle) -> Result<PathBuf, ErroIA> {
    app.path().app_data_dir().map_err(|_| ErroIA::Cofre { detalhe: "pasta de dados do app indisponível".into() })
}

/// A chave guardada, lida do cofre só na primeira vez.
fn chave_guardada(app: &AppHandle, e: &mut Interno) -> Option<(String, cofre::Cofre)> {
    if e.chave.is_none() {
        e.chave = Some(pasta(app).ok().and_then(|p| cofre::ler(&p)));
    }
    e.chave.clone().flatten()
}

fn travar(ia: &IA) -> Result<std::sync::MutexGuard<'_, Interno>, ErroIA> {
    ia.0.lock().map_err(|_| ErroIA::Indisponivel)
}

/// A chave de uma chamada ao Gemini (análise ou voz): só com a IA ligada e com a chave salva.
pub fn chave_da_chamada(app: &AppHandle, ia: &IA) -> Result<String, ErroIA> {
    let mut e = travar(ia)?;
    let guardada = chave_guardada(app, &mut e);
    pode_chamar(e.ligada, guardada.as_ref().map(|(c, _)| c.as_str()))
}

/// O front avisa se a IA está ligada, ao abrir e a cada mudança.
#[tauri::command]
pub fn ia_configurar(ia: State<IA>, ligada: bool) {
    if let Ok(mut e) = travar(&ia) {
        e.ligada = ligada;
    }
}

#[tauri::command]
pub fn ia_chave_estado(app: AppHandle, ia: State<IA>) -> EstadoChave {
    match travar(&ia) {
        Ok(mut e) => estado_da_chave(chave_guardada(&app, &mut e).as_ref()),
        Err(_) => estado_da_chave(None),
    }
}

/// Testa a chave com o Gemini e só então a guarda.
#[tauri::command]
pub async fn ia_chave_salvar(app: AppHandle, ia: State<'_, IA>, chave: String) -> Result<EstadoChave, ErroIA> {
    let chave = chave.trim().to_string();
    let destino = pasta(&app)?;
    let copia = chave.clone();
    let cofre = tauri::async_runtime::spawn_blocking(move || {
        salvar_se_aceita(
            &copia,
            |c| {
                let inicio = Instant::now();
                let teste = testar_chave(c);
                registrar(&evento_da_chamada("teste", ms_desde(inicio), teste.as_ref().map(|()| None)));
                teste
            },
            |c| cofre::guardar(&destino, c),
        )
    })
    .await
    .unwrap_or(Err(ErroIA::Resposta))?;
    let guardada = (chave, cofre);
    let estado = estado_da_chave(Some(&guardada));
    travar(&ia)?.chave = Some(Some(guardada));
    Ok(estado)
}

/// Apaga a chave e desliga a IA (IACONF-09).
#[tauri::command]
pub fn ia_chave_remover(app: AppHandle, ia: State<IA>) -> Result<(), ErroIA> {
    cofre::apagar(&pasta(&app)?)?;
    let mut e = travar(&ia)?;
    e.chave = Some(None);
    e.ligada = false;
    Ok(())
}

/// Uma análise: o pedido do front vai ao Gemini com o modelo e a chave, e volta o texto JSON da resposta.
#[tauri::command]
pub async fn ia_gerar(app: AppHandle, ia: State<'_, IA>, pedido: PedidoIA) -> Result<RespostaIA, ErroIA> {
    let chave = chave_da_chamada(&app, &ia)?;
    let tipo = pedido.tipo.clone();
    let inicio = Instant::now();
    let resultado = tauri::async_runtime::spawn_blocking(move || gerar(&chave, &pedido)).await.unwrap_or(Err(ErroIA::Resposta));
    registrar(&evento_da_chamada(&tipo, ms_desde(inicio), resultado.as_ref().map(|r| r.tokens)));
    resultado
}

#[cfg(test)]
mod testes {
    use super::*;

    const CHAVE_FALSA: &str = "chave-falsa-de-teste-a1b2";

    fn pedido() -> PedidoIA {
        PedidoIA {
            tipo: "dia".into(),
            sistema: "Responda em português do Brasil.".into(),
            entrada: "{\"grupos\":[]}".into(),
            esquema: json!({ "type": "object", "properties": { "texto": { "type": "string" } }, "required": ["texto"] }),
        }
    }

    #[test]
    fn corpo_tem_o_modelo_o_esquema_e_store_false() {
        let p = pedido();
        let corpo = corpo_da_interacao(&p);
        assert_eq!(corpo["model"], "gemini-3.8-flash");
        assert_eq!(corpo["store"], json!(false));
        assert_eq!(corpo["response_format"], json!({ "type": "text", "mime_type": "application/json", "schema": p.esquema }));
        assert_eq!(corpo["system_instruction"], "Responda em português do Brasil.");
        assert_eq!(corpo["input"], "{\"grupos\":[]}");
    }

    #[test]
    fn texto_sai_do_passo_model_output() {
        let resposta = json!({
            "id": "i1",
            "steps": [
                { "type": "user_input", "content": [{ "type": "text", "text": "pergunta" }] },
                { "type": "model_output", "content": [{ "type": "text", "text": "{\"texto\":" }, { "type": "text", "text": "\"oi\"}" }] }
            ]
        });
        assert_eq!(texto_da_interacao(&resposta).as_deref(), Some("{\"texto\":\"oi\"}"));
    }

    #[test]
    fn sem_model_output_nao_ha_texto() {
        let so_entrada = json!({ "steps": [{ "type": "user_input", "content": [{ "type": "text", "text": "pergunta" }] }] });
        assert_eq!(texto_da_interacao(&so_entrada), None);
        assert_eq!(texto_da_interacao(&json!({ "id": "i1" })), None);
    }

    #[test]
    fn status_viram_os_erros_da_ia() {
        assert_eq!(erro_do_status(401, ""), ErroIA::Chave);
        assert_eq!(erro_do_status(403, "{}"), ErroIA::Chave);
        assert_eq!(erro_do_status(400, r#"{"error":{"message":"API key not valid. Please pass a valid API key."}}"#), ErroIA::Chave);
        assert_eq!(erro_do_status(400, r#"{"error":{"message":"Invalid JSON payload"}}"#), ErroIA::Resposta);
        assert_eq!(erro_do_status(429, ""), ErroIA::Cota);
        assert_eq!(erro_do_status(503, ""), ErroIA::Indisponivel);
    }

    #[test]
    fn final_da_chave_mostra_so_os_4_ultimos() {
        assert_eq!(final_da_chave(CHAVE_FALSA), "a1b2");
    }

    #[test]
    fn grava_le_e_apaga_a_chave_no_arquivo() {
        let pasta = std::env::temp_dir().join(format!("pos-teste-cofre-{}", std::process::id()));
        let caminho = pasta.join(cofre::ARQUIVO);
        cofre::guardar_em_arquivo(&caminho, CHAVE_FALSA).unwrap();
        assert_eq!(cofre::ler_de_arquivo(&caminho).as_deref(), Some(CHAVE_FALSA));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&caminho).unwrap().permissions().mode() & 0o777, 0o600);
        }
        cofre::apagar_arquivo(&caminho).unwrap();
        assert!(!caminho.exists());
        assert_eq!(cofre::ler_de_arquivo(&caminho), None);
        // Apagar de novo, sem o arquivo, não falha.
        assert_eq!(cofre::apagar_arquivo(&caminho), Ok(()));
        let _ = std::fs::remove_dir_all(pasta);
    }

    #[test]
    fn so_chama_o_gemini_ligada_e_com_chave() {
        assert_eq!(pode_chamar(false, Some(CHAVE_FALSA)), Err(ErroIA::Desligada));
        assert_eq!(pode_chamar(true, None), Err(ErroIA::SemChave));
        assert_eq!(pode_chamar(true, Some(CHAVE_FALSA)), Ok(CHAVE_FALSA.to_string()));
    }

    #[test]
    fn a_chave_so_e_guardada_depois_do_teste_aceito() {
        for recusa in [ErroIA::Chave, ErroIA::Conexao] {
            let mut guardou = false;
            let resultado = salvar_se_aceita(CHAVE_FALSA, |_| Err(recusa.clone()), |_| {
                guardou = true;
                Ok(cofre::Cofre::Sistema)
            });
            assert_eq!(resultado, Err(recusa));
            assert!(!guardou);
        }
        let mut guardada = None;
        let resultado = salvar_se_aceita(CHAVE_FALSA, |_| Ok(()), |c| {
            guardada = Some(c.to_string());
            Ok(cofre::Cofre::Arquivo)
        });
        assert_eq!(resultado, Ok(cofre::Cofre::Arquivo));
        assert_eq!(guardada.as_deref(), Some(CHAVE_FALSA));
    }

    #[test]
    fn evento_do_log_so_tem_tipo_duracao_resultado_e_tokens() {
        assert_eq!(evento_da_chamada("dia", 1500, Ok(Some(1200))), json!({ "tipo": "dia", "ms": 1500, "resultado": "ok", "tokens": 1200 }));
        let erro = ErroIA::Cofre { detalhe: "arquivo da chave: permission denied".into() };
        assert_eq!(evento_da_chamada("teste", 300, Err(&erro)), json!({ "tipo": "teste", "ms": 300, "resultado": "Cofre", "tokens": null }));
        // Nenhum texto vindo do front entra no log pelo tipo.
        let estranho = evento_da_chamada("Gatinho - YouTube - Google Chrome", 10, Err(&ErroIA::Conexao));
        assert_eq!(estranho, json!({ "tipo": "outro", "ms": 10, "resultado": "Conexao", "tokens": null }));
    }

    #[test]
    fn falhas_sem_resposta_viram_tempo_ou_conexao() {
        assert_eq!(erro_de_transporte(&ureq::Error::Timeout(ureq::Timeout::Global)), ErroIA::Tempo);
        assert_eq!(erro_de_transporte(&ureq::Error::HostNotFound), ErroIA::Conexao);
        assert_eq!(erro_de_transporte(&ureq::Error::ConnectionFailed), ErroIA::Conexao);
    }
}
