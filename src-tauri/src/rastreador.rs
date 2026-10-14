//! O cronômetro e o registro das janelas. Fica no Rust porque o WebView (no Windows e no Linux) suspende os timers
//! quando a janela do app está escondida: o relógio, a parada por inatividade, a virada do dia e o aviso de
//! distração precisam continuar funcionando com o app na bandeja ou como widget.
//!
//! A cada segundo, com o cronômetro rodando, a janela ativa é lida e somada ao trecho atual (ou abre um trecho novo).
//! O cronômetro não tem fim: para sozinho por inatividade (e volta sozinho quando a pessoa mexe no PC, no mesmo
//! dia) e na virada do dia (`Concluido`, e a tela guarda o trecho do dia). Parado, ocioso ou concluído, nada é
//! lido. Com a captura pausada, o relógio anda mas a janela não é lida.

use std::sync::Mutex;

use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::janela::{Janela, janela_ativa, ms_sem_uso};
use crate::notificar;

/// Um intervalo contínuo na mesma janela.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trecho {
    /// Início e fim em milissegundos desde 1970.
    pub inicio: i64,
    pub fim: i64,
    pub titulo: String,
    pub processo: String,
    pub proprio: bool,
    /// Ausência registrada por versões anteriores. Hoje o tempo sem uso é cortado e o relógio para.
    pub ausente: bool,
    /// Tempo com a captura pausada: o relógio andou, mas a janela não foi lida.
    #[serde(default)]
    pub sem_captura: bool,
}

/// Regra de classificação. As de título valem antes das de app; dentro de cada grupo, a primeira que casa decide.
/// Mesma lógica de `regraQueCasa` em `src/features/sessao/utils/classificacao.ts`.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Regra {
    pub rotulo: String,
    pub termos: Vec<String>,
    /// `app` compara com o nome do programa; `titulo`, com o título da janela.
    pub campo: String,
    /// `estudo`, `fora` ou `ignorar`.
    pub tipo: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuracao {
    /// Sem mexer no teclado e no mouse por esse tempo, o relógio para (e o tempo parado não conta).
    pub limite_ausencia_seg: i64,
    /// Segundos seguidos fora do estudo até o aviso; sem valor, não avisa.
    pub aviso_distracao_seg: Option<i64>,
    pub regras: Vec<Regra>,
    /// Nome da matéria, para o texto das notificações.
    pub materia: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Fase {
    Parado,
    Rodando,
    /// Parado por inatividade; volta a `Rodando` sozinho quando a pessoa mexe no PC no mesmo dia.
    Ocioso,
    /// O dia virou: os trechos vão até a meia-noite e esperam a tela guardar.
    Concluido,
}

/// Um intervalo maior que isso entre duas leituras é o computador suspenso ou travado: não conta.
const SALTO_MS: i64 = 10_000;

struct Estado {
    fase: Fase,
    config: Option<Configuracao>,
    captura: bool,
    /// Momento da última leitura, onde começa o próximo pedaço.
    ultimo: i64,
    trechos: Vec<Trecho>,
    fora_desde: Option<i64>,
    avisado: bool,
    /// Dia (no fuso local) em que o cronômetro começou: o registro não passa da meia-noite dele.
    dia: Option<NaiveDate>,
}

pub struct Rastreador(Mutex<Estado>);

impl Rastreador {
    pub fn new() -> Self {
        Self(Mutex::new(Estado {
            fase: Fase::Parado,
            config: None,
            captura: true,
            ultimo: 0,
            trechos: Vec::new(),
            fora_desde: None,
            avisado: false,
            dia: None,
        }))
    }

    pub fn rodando(&self) -> bool {
        self.0.lock().map(|e| e.fase == Fase::Rodando).unwrap_or(false)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Retrato {
    fase: Fase,
    captura: bool,
    decorrido_ms: i64,
    /// Janela ativa agora, lida na hora (é o que a tela de transparência mostra). Vazia sem captura.
    atual: Janela,
    ms_sem_uso: i64,
    trechos: Vec<Trecho>,
}

fn agora_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn hoje() -> NaiveDate {
    Local::now().date_naive()
}

/// Meia-noite (no fuso local) que encerra o dia, em milissegundos.
fn fim_do_dia_ms(dia: NaiveDate) -> i64 {
    dia.succ_opt()
        .and_then(|amanha| amanha.and_hms_opt(0, 0, 0))
        .and_then(|meia_noite| meia_noite.and_local_timezone(Local).earliest())
        .map_or(i64::MAX, |m| m.timestamp_millis())
}

fn decorrido(e: &Estado, agora: i64) -> i64 {
    let registrado: i64 = e.trechos.iter().map(|t| t.fim - t.inicio).sum();
    if e.fase == Fase::Rodando { registrado + (agora - e.ultimo).max(0) } else { registrado }
}

fn acrescentar(trechos: &mut Vec<Trecho>, novo: Trecho) {
    if let Some(ultimo) = trechos.last_mut() {
        if ultimo.fim == novo.inicio
            && ultimo.ausente == novo.ausente
            && ultimo.sem_captura == novo.sem_captura
            && ultimo.titulo == novo.titulo
            && ultimo.processo == novo.processo
        {
            ultimo.fim = novo.fim;
            return;
        }
    }
    trechos.push(novo);
}

/// Ao perceber a inatividade, o tempo desde o último uso não conta: corta os trechos a partir de `desde`.
fn cortar_desde(trechos: &mut Vec<Trecho>, desde: i64) {
    trechos.retain(|t| t.inicio < desde);
    if let Some(ultimo) = trechos.last_mut() {
        ultimo.fim = ultimo.fim.min(desde);
    }
}

/// Soma o tempo desde a última leitura à janela ativa agora (ou ao tempo sem captura).
fn registrar(e: &mut Estado, agora: i64) {
    let inicio = e.ultimo;
    e.ultimo = agora;
    if agora <= inicio {
        return;
    }
    if !e.captura {
        let trecho = Trecho {
            inicio,
            fim: agora,
            titulo: String::new(),
            processo: String::new(),
            proprio: false,
            ausente: false,
            sem_captura: true,
        };
        return acrescentar(&mut e.trechos, trecho);
    }
    // Computador suspenso ou travado: o intervalo não conta, só o último segundo.
    let inicio = if agora - inicio > SALTO_MS { agora - 1000 } else { inicio };
    let janela = janela_ativa();
    let trecho = Trecho {
        inicio,
        fim: agora,
        titulo: janela.titulo,
        processo: janela.processo,
        proprio: janela.proprio,
        ausente: false,
        sem_captura: false,
    };
    acrescentar(&mut e.trechos, trecho);
}

fn casa(regra: &Regra, janela: &Janela) -> bool {
    let alvo = if regra.campo == "app" { &janela.processo } else { &janela.titulo }.to_lowercase();
    regra
        .termos
        .iter()
        .map(|t| t.trim().to_lowercase())
        .any(|t| !t.is_empty() && alvo.contains(&t))
}

fn regra_que_casa<'a>(regras: &'a [Regra], janela: &Janela) -> Option<&'a Regra> {
    let por_titulo = regras.iter().filter(|r| r.campo != "app");
    let por_app = regras.iter().filter(|r| r.campo == "app");
    por_titulo.chain(por_app).find(|r| casa(r, janela))
}

/// Rótulo da distração quando a janela conta como fora do estudo. Sem regra, também é fora.
fn distracao(config: &Configuracao, janela: &Janela) -> Option<String> {
    if janela.proprio || (janela.titulo.is_empty() && janela.processo.is_empty()) {
        return None;
    }
    match regra_que_casa(&config.regras, janela) {
        Some(regra) => (regra.tipo == "fora").then(|| regra.rotulo.clone()),
        None => Some(if janela.titulo.is_empty() { janela.processo.clone() } else { janela.titulo.chars().take(48).collect() }),
    }
}

fn formatar_minutos(ms: i64) -> String {
    let minutos = (ms as f64 / 60_000.0).round() as i64;
    if minutos <= 1 { "1 minuto".into() } else { format!("{minutos} minutos") }
}

/// Uma leitura por segundo (chamada pelo relógio em `lib.rs`).
pub fn tick(app: &AppHandle) {
    let rastreador = app.state::<Rastreador>();
    let mut avisos: Vec<(String, String)> = Vec::new();
    {
        let Ok(mut e) = rastreador.0.lock() else { return };
        if e.fase != Fase::Rodando && e.fase != Fase::Ocioso {
            return;
        }
        let Some(config) = e.config.clone() else { return };
        let limite = config.limite_ausencia_seg * 1000;
        let agora = agora_ms();

        // Virada do dia: o registro vai até a meia-noite e o cronômetro para.
        if let Some(dia) = e.dia.filter(|d| *d != hoje()) {
            if e.fase == Fase::Rodando {
                let meia_noite = fim_do_dia_ms(dia).min(agora);
                registrar(&mut e, meia_noite);
            }
            e.fase = Fase::Concluido;
            return;
        }

        let sem_uso = ms_sem_uso();
        if e.fase == Fase::Ocioso {
            if sem_uso < limite {
                e.fase = Fase::Rodando;
                e.ultimo = agora;
            }
            return;
        }

        registrar(&mut e, agora);
        if sem_uso >= limite {
            cortar_desde(&mut e.trechos, agora - sem_uso);
            e.fase = Fase::Ocioso;
            e.fora_desde = None;
            e.avisado = false;
            return;
        }

        let distraido = if e.captura { distracao(&config, &janela_ativa()) } else { None };
        match (config.aviso_distracao_seg, distraido) {
            (Some(limite), Some(rotulo)) => {
                let desde = *e.fora_desde.get_or_insert(agora);
                if !e.avisado && agora - desde >= limite * 1000 {
                    e.avisado = true;
                    avisos.push((
                        "Fora do estudo".into(),
                        format!(
                            "Há {} em {rotulo}, longe de {}. O tempo continua sendo registrado.",
                            formatar_minutos(agora - desde),
                            config.materia
                        ),
                    ));
                }
            }
            _ => {
                e.fora_desde = None;
                e.avisado = false;
            }
        }
    }
    for (titulo, corpo) in avisos {
        notificar(app, &titulo, &corpo);
    }
}

#[tauri::command]
pub fn rastreio_iniciar(rastreador: State<Rastreador>, config: Configuracao) {
    if let Ok(mut e) = rastreador.0.lock() {
        e.fase = Fase::Rodando;
        e.config = Some(config);
        e.captura = true;
        e.ultimo = agora_ms();
        e.trechos.clear();
        e.fora_desde = None;
        e.avisado = false;
        e.dia = Some(hoje());
    }
}

/// Liga ou desliga a leitura da janela sem parar o relógio.
#[tauri::command]
pub fn rastreio_captura(rastreador: State<Rastreador>, ligada: bool) {
    if let Ok(mut e) = rastreador.0.lock() {
        if e.fase == Fase::Rodando {
            registrar(&mut e, agora_ms());
        }
        e.captura = ligada;
        e.fora_desde = None;
        e.avisado = false;
    }
}

/// Para o cronômetro (pause, troca de objetivo ou virada do dia) e devolve tudo o que foi registrado.
#[tauri::command]
pub fn rastreio_parar(rastreador: State<Rastreador>) -> Vec<Trecho> {
    let Ok(mut e) = rastreador.0.lock() else { return Vec::new() };
    if e.fase == Fase::Rodando {
        registrar(&mut e, agora_ms());
    }
    e.fase = Fase::Parado;
    e.config = None;
    e.captura = true;
    e.dia = None;
    std::mem::take(&mut e.trechos)
}

#[tauri::command]
pub fn rastreio_estado(rastreador: State<Rastreador>) -> Retrato {
    let Ok(e) = rastreador.0.lock() else {
        return Retrato {
            fase: Fase::Parado,
            captura: true,
            decorrido_ms: 0,
            atual: Janela::default(),
            ms_sem_uso: 0,
            trechos: Vec::new(),
        };
    };
    // Fora do cronômetro rodando, ou com a captura pausada, nada é lido: nem para mostrar na tela.
    let lendo = e.fase == Fase::Rodando && e.captura;
    let (atual, sem_uso) = if lendo { (janela_ativa(), ms_sem_uso()) } else { (Janela::default(), 0) };
    Retrato {
        fase: e.fase,
        captura: e.captura,
        decorrido_ms: decorrido(&e, agora_ms()),
        atual,
        ms_sem_uso: sem_uso,
        trechos: e.trechos.clone(),
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn trecho(inicio: i64, fim: i64, titulo: &str) -> Trecho {
        Trecho {
            inicio,
            fim,
            titulo: titulo.into(),
            processo: "app".into(),
            proprio: false,
            ausente: false,
            sem_captura: false,
        }
    }

    fn regra(rotulo: &str, termo: &str, campo: &str, tipo: &str) -> Regra {
        Regra { rotulo: rotulo.into(), termos: vec![termo.into()], campo: campo.into(), tipo: tipo.into() }
    }

    fn janela(titulo: &str, processo: &str) -> Janela {
        Janela { titulo: titulo.into(), processo: processo.into(), proprio: false }
    }

    #[test]
    fn junta_leituras_seguidas_da_mesma_janela() {
        let mut trechos = vec![trecho(0, 1000, "A")];
        acrescentar(&mut trechos, trecho(1000, 2000, "A"));
        acrescentar(&mut trechos, trecho(2000, 3000, "B"));
        assert_eq!(trechos.len(), 2);
        assert_eq!(trechos[0].fim, 2000);
    }

    #[test]
    fn inatividade_corta_o_tempo_desde_o_ultimo_uso() {
        let mut trechos = vec![trecho(0, 10_000, "A"), trecho(10_000, 20_000, "B"), trecho(20_000, 30_000, "C")];
        cortar_desde(&mut trechos, 15_000);
        assert_eq!(trechos.len(), 2);
        assert_eq!((trechos[0].inicio, trechos[0].fim), (0, 10_000));
        assert_eq!((trechos[1].inicio, trechos[1].fim), (10_000, 15_000));
    }

    #[test]
    fn dia_termina_na_meia_noite_local() {
        let dia = NaiveDate::from_ymd_opt(2026, 10, 15).unwrap();
        let fim = chrono::DateTime::from_timestamp_millis(fim_do_dia_ms(dia)).unwrap().with_timezone(&Local);
        assert_eq!(fim.date_naive(), NaiveDate::from_ymd_opt(2026, 10, 16).unwrap());
        assert_eq!(fim.time(), chrono::NaiveTime::MIN);
    }

    #[test]
    fn regra_de_titulo_vale_antes_da_de_app() {
        let regras = vec![regra("Chrome", "chrome", "app", "estudo"), regra("YouTube", "youtube", "titulo", "fora")];
        let video = janela("Gameplay - YouTube - Google Chrome", "chrome");
        let docs = janela("MDN - Google Chrome", "chrome");
        assert_eq!(regra_que_casa(&regras, &video).map(|r| r.rotulo.as_str()), Some("YouTube"));
        assert_eq!(regra_que_casa(&regras, &docs).map(|r| r.rotulo.as_str()), Some("Chrome"));
    }

    #[test]
    fn janela_sem_regra_conta_como_fora_e_ignorar_nao() {
        let config = Configuracao {
            limite_ausencia_seg: 300,
            aviso_distracao_seg: Some(60),
            regras: vec![regra("Spotify", "spotify", "app", "ignorar")],
            materia: "Inglês".into(),
        };
        assert!(distracao(&config, &janela("Música", "Spotify")).is_none());
        assert_eq!(distracao(&config, &janela("Jogo qualquer", "jogo")).as_deref(), Some("Jogo qualquer"));
    }
}
