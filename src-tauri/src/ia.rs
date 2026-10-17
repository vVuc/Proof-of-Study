//! Porta única para o Gemini (AD-001): o front monta o pedido (instrução, entrada e esquema da resposta) e valida o
//! JSON que volta; aqui ficam o modelo, a chave e a chamada à Interactions API, com os erros traduzidos. A chave
//! nunca vai para o log nem para as mensagens de erro.

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// Modelo das análises, fixo no código.
pub const MODELO: &str = "gemini-3.8-flash";

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
        assert_ne!(erro_do_status(400, r#"{"error":{"message":"Invalid JSON payload"}}"#), ErroIA::Chave);
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
}
