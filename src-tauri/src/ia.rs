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

#[cfg(test)]
mod testes {
    use super::*;

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
}
