//! A sessão do dia e o registro das janelas. Fica no Rust porque o WebView (no Windows e no Linux) suspende os
//! timers quando a janela do app está escondida: o relógio, as pausas automáticas e os avisos precisam continuar
//! funcionando com o app na bandeja ou como widget.
//!
//! Um play abre a sessão do dia. A cada segundo, com a sessão rodando, a janela ativa é lida e somada ao trecho
//! atual (ou abre um trecho novo). A sessão só para quando a pessoa pausa, quando o relato final é salvo ou na
//! virada do dia lógico. Ausência longa e suspensão viram pausas automáticas, e a captura volta sozinha.
//!
//! O estado vai para um arquivo próprio (o diário) a cada 15 s e a cada play ou pausa. Se o app fechar, travar ou
//! o PC desligar, ao abrir no mesmo dia a sessão volta como estava, com o tempo desligado como pausa. Uma sessão
//! fechada só sai do diário quando o front confirma que a gravou no `dados.json`.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::janela::{Janela, janela_ativa, ms_sem_uso};
use crate::notificar;

/// Um intervalo contínuo na mesma janela.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trecho {
    /// Início e fim em milissegundos desde 1970.
    pub inicio: i64,
    pub fim: i64,
    pub titulo: String,
    pub processo: String,
    pub proprio: bool,
    /// Sem mexer no teclado e no mouse por mais tempo que o limite curto.
    pub ausente: bool,
    /// Tempo com a captura pausada: o relógio andou, mas a janela não foi lida.
    #[serde(default)]
    pub sem_captura: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Motivo {
    Manual,
    Ausencia,
    Suspensao,
    Desligado,
}

/// Intervalo sem registro dentro da sessão.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pausa {
    pub inicio: i64,
    pub fim: i64,
    pub motivo: Motivo,
}

/// O tempo capturado num dia lógico.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessaoDia {
    pub id: String,
    /// Dia lógico, `aaaa-mm-dd`.
    pub dia: String,
    pub inicio: i64,
    pub fim: i64,
    pub trechos: Vec<Trecho>,
    pub pausas: Vec<Pausa>,
}

/// Regra de classificação. As de título valem antes das de app; dentro de cada grupo, a primeira que casa decide.
/// Mesma lógica de `regraQueCasa` em `src/features/sessao/utils/classificacao.ts`.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Regra {
    pub rotulo: String,
    pub termos: Vec<String>,
    /// `app` compara com o nome do programa; `titulo`, com o título da janela.
    pub campo: String,
    /// `estudo`, `fora` ou `ignorar`.
    pub tipo: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuracao {
    /// Sem uso por esse tempo, o trecho conta como ausente.
    pub limite_ausencia_seg: i64,
    /// Sem uso por esse tempo, a sessão entra em pausa automática.
    pub ausencia_longa_seg: i64,
    /// Segundos seguidos fora do estudo até o aviso; sem valor, não avisa.
    pub aviso_distracao_seg: Option<i64>,
    /// Lembrete de pausa a cada tantos segundos rodando; sem valor, não lembra.
    pub ciclo_seg: Option<i64>,
    pub regras: Vec<Regra>,
    /// Termos das matérias e dos objetivos do dia, já normalizados: janela que casa é estudo.
    #[serde(default)]
    pub termos: Vec<String>,
    /// Minuto do dia em que o dia lógico começa.
    pub inicio_do_dia_min: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Fase {
    Parado,
    Rodando,
    Pausado,
    /// Pausa automática por ausência longa: a captura volta quando a pessoa volta.
    Ausente,
}

/// Um intervalo maior que isso entre duas leituras é o computador suspenso ou travado.
const SALTO_MS: i64 = 10_000;
/// Com a sessão aberta, o diário é gravado pelo menos nesse intervalo.
const GRAVAR_A_CADA_MS: i64 = 15_000;
/// Uso de teclado ou mouse nos últimos segundos: a pessoa voltou.
const VOLTOU_MS: i64 = 5_000;
const VERSAO_DIARIO: u32 = 1;
const INICIO_DO_DIA_PADRAO: i64 = 4 * 60;

/// O que o front fica sabendo quando a sessão volta depois de o app ter fechado.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recuperacao {
    pub desligado_ms: i64,
    pub fase: Fase,
}

struct Estado {
    fase: Fase,
    config: Option<Configuracao>,
    captura: bool,
    sessao: Option<SessaoDia>,
    /// Pausa em andamento (manual ou por ausência); o fim é provisório.
    pausa: Option<Pausa>,
    /// Momento da última leitura, onde começa o próximo pedaço.
    ultimo: i64,
    fora_desde: Option<i64>,
    avisado: bool,
    ciclo_desde: i64,
    /// Sessões fechadas que o front ainda não confirmou ter gravado.
    fechadas: Vec<SessaoDia>,
    /// Menor índice de trecho mudado desde a última leitura do front.
    alterado_desde: usize,
    recuperacao: Option<Recuperacao>,
    gravado_em: i64,
    /// Algo importante mudou (play, pausa, fechamento): grava o diário já.
    sujo: bool,
}

impl Default for Estado {
    fn default() -> Self {
        Self {
            fase: Fase::Parado,
            config: None,
            captura: true,
            sessao: None,
            pausa: None,
            ultimo: 0,
            fora_desde: None,
            avisado: false,
            ciclo_desde: 0,
            fechadas: Vec::new(),
            alterado_desde: 0,
            recuperacao: None,
            gravado_em: 0,
            sujo: false,
        }
    }
}

/// O que vai para o arquivo do diário.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Diario {
    versao: u32,
    salvo_em: i64,
    fase: Fase,
    captura: bool,
    sessao: Option<SessaoDia>,
    pausa: Option<Pausa>,
    fechadas: Vec<SessaoDia>,
    config: Option<Configuracao>,
}

pub struct Rastreador {
    estado: Mutex<Estado>,
    /// Caminho do diário. A trava também serializa as gravações, na ordem em que o estado mudou.
    diario: Mutex<Option<PathBuf>>,
}

impl Rastreador {
    pub fn new() -> Self {
        Self { estado: Mutex::new(Estado::default()), diario: Mutex::new(None) }
    }

    /// Lê o diário (se houver) e recupera a sessão do dia. Chamado uma vez, ao abrir o app.
    pub fn carregar(&self, caminho: PathBuf) {
        let agora = agora_ms();
        if let Some(diario) = ler_diario(&caminho)
            && let Ok(mut e) = self.estado.lock() {
                *e = recuperar(diario, agora);
                if let Some(r) = &e.recuperacao {
                    log::info!("sessão recuperada: {} ms desligado, volta {:?}", r.desligado_ms, r.fase);
                }
            }
        if let Ok(mut d) = self.diario.lock() {
            *d = Some(caminho);
        }
    }

    /// Sessão rodando (ou em pausa automática): quem está estudando não precisa ser lembrado de começar.
    pub fn sessao_aberta(&self) -> bool {
        self.estado.lock().map(|e| matches!(e.fase, Fase::Rodando | Fase::Ausente)).unwrap_or(false)
    }

    /// Play se estiver parado ou pausado; pausa se estiver rodando. Para a bandeja e o atalho global.
    /// Devolve `false` se ainda não há configuração (o front nunca abriu): aí quem chamou abre a janela.
    pub fn alternar(&self) -> bool {
        let ok = {
            let Ok(mut e) = self.estado.lock() else { return false };
            let agora = agora_ms();
            match e.fase {
                Fase::Rodando | Fase::Ausente => {
                    pausar(&mut e, agora, &mut ler_janela);
                    true
                }
                Fase::Parado | Fase::Pausado => play(&mut e, agora),
            }
        };
        self.gravar_se_preciso();
        ok
    }

    /// Grava o diário se o estado pediu (mudança importante, ou 15 s com a sessão aberta).
    fn gravar_se_preciso(&self) {
        let Ok(caminho) = self.diario.lock() else { return };
        let Some(caminho) = caminho.as_ref() else { return };
        let texto = {
            let Ok(mut e) = self.estado.lock() else { return };
            let agora = agora_ms();
            let aberta = e.sessao.is_some() || !e.fechadas.is_empty();
            if !e.sujo && !(aberta && agora - e.gravado_em >= GRAVAR_A_CADA_MS) {
                return;
            }
            e.sujo = false;
            e.gravado_em = agora;
            serde_json::to_string(&diario_de(&e, agora))
        };
        match texto {
            Ok(texto) => {
                if let Err(erro) = gravar_atomico(caminho, &texto) {
                    log::error!("diário não gravado: {erro}");
                }
            }
            Err(erro) => log::error!("diário não serializado: {erro}"),
        }
    }
}

#[derive(Clone, Debug, Default)]
struct Leitura {
    janela: Janela,
    sem_uso: i64,
}

fn ler_janela() -> Leitura {
    Leitura { janela: janela_ativa(), sem_uso: ms_sem_uso() }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumoSessao {
    id: String,
    dia: String,
    inicio: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Retrato {
    fase: Fase,
    captura: bool,
    sessao: Option<ResumoSessao>,
    /// Tempo registrado na sessão (sem as pausas).
    decorrido_ms: i64,
    /// Pausas da sessão, com a que está em andamento (fim = agora).
    pausas: Vec<Pausa>,
    /// Os trechos a partir desse índice substituem os que o front já tinha.
    base: usize,
    trechos: Vec<Trecho>,
    /// Janela ativa agora, lida na hora. Vazia sem a sessão rodando ou sem captura.
    atual: Janela,
    ms_sem_uso: i64,
    /// Sessões fechadas esperando o front gravar e confirmar.
    fechadas: Vec<SessaoDia>,
    recuperacao: Option<Recuperacao>,
    configurado: bool,
}

fn agora_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Dia lógico de um momento: o dia só vira no horário configurado. Mesma conta de `diaLogico` no front.
pub fn dia_logico(ms: i64, inicio_do_dia_min: i64) -> String {
    Local
        .timestamp_millis_opt(ms - inicio_do_dia_min * 60_000)
        .single()
        .unwrap_or_else(Local::now)
        .date_naive()
        .to_string()
}

fn inicio_do_dia(e: &Estado) -> i64 {
    e.config.as_ref().map_or(INICIO_DO_DIA_PADRAO, |c| c.inicio_do_dia_min)
}

/// Minúsculas e sem acento. Mesma conta de `normalizar` no front.
pub fn normalizar(texto: &str) -> String {
    texto
        .chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            _ => c,
        })
        .collect()
}

/// O termo aparece como palavra inteira. Mesma conta de `contemPalavra` no front.
pub fn contem_palavra(texto: &str, termo: &str) -> bool {
    if termo.is_empty() {
        return false;
    }
    let letra = |c: Option<char>| c.is_some_and(|c| c.is_ascii_alphanumeric());
    let mut desde = 0;
    while let Some(pos) = texto[desde..].find(termo) {
        let i = desde + pos;
        if !letra(texto[..i].chars().next_back()) && !letra(texto[i + termo.len()..].chars().next()) {
            return true;
        }
        desde = i + texto[i..].chars().next().map_or(1, char::len_utf8);
    }
    false
}

/// Junta ao último trecho se for a mesma janela, logo em seguida; senão, abre outro.
fn acrescentar(trechos: &mut Vec<Trecho>, alterado: &mut usize, novo: Trecho) {
    if let Some(ultimo) = trechos.last_mut()
        && ultimo.fim == novo.inicio
            && ultimo.ausente == novo.ausente
            && ultimo.sem_captura == novo.sem_captura
            && ultimo.titulo == novo.titulo
            && ultimo.processo == novo.processo
        {
            ultimo.fim = novo.fim;
            *alterado = (*alterado).min(trechos.len() - 1);
            return;
        }
    trechos.push(novo);
    *alterado = (*alterado).min(trechos.len() - 1);
}

/// Ao perceber a ausência, o tempo desde o último uso também era ausência: marca os trechos a partir de `desde`.
fn marcar_ausencia(trechos: &mut Vec<Trecho>, alterado: &mut usize, desde: i64) {
    let mut i = trechos.len();
    while i > 0 {
        i -= 1;
        if trechos[i].fim <= desde {
            break;
        }
        if trechos[i].ausente || trechos[i].sem_captura {
            continue;
        }
        *alterado = (*alterado).min(i);
        if trechos[i].inicio >= desde {
            trechos[i].ausente = true;
        } else {
            let mut depois = trechos[i].clone();
            depois.inicio = desde;
            depois.ausente = true;
            trechos[i].fim = desde;
            trechos.insert(i + 1, depois);
            break;
        }
    }
}

/// Tira dos trechos tudo o que vem depois de `desde` (o tempo vira pausa).
fn cortar_depois(trechos: &mut Vec<Trecho>, alterado: &mut usize, desde: i64) {
    while trechos.last().is_some_and(|t| t.inicio >= desde) {
        trechos.pop();
    }
    if let Some(ultimo) = trechos.last_mut()
        && ultimo.fim > desde {
            ultimo.fim = desde;
        }
    *alterado = (*alterado).min(trechos.len().saturating_sub(1));
}

/// Soma o tempo desde a última leitura à janela ativa agora (ou ao tempo sem captura). Um salto grande entre
/// leituras é o computador suspenso: vira pausa, e o registro segue. Devolve a leitura feita, se houve.
fn registrar(e: &mut Estado, agora: i64, ler: &mut dyn FnMut() -> Leitura) -> Option<Leitura> {
    let mut inicio = e.ultimo;
    e.ultimo = agora;
    if agora <= inicio {
        return None;
    }
    let limite = e.config.as_ref().map_or(i64::MAX, |c| c.limite_ausencia_seg * 1000);
    let Estado { sessao, alterado_desde, captura, sujo, .. } = e;
    let sessao = sessao.as_mut()?;
    if agora - inicio > SALTO_MS {
        log::info!("pausa por suspensão: {} s", (agora - 1000 - inicio) / 1000);
        sessao.pausas.push(Pausa { inicio, fim: agora - 1000, motivo: Motivo::Suspensao });
        inicio = agora - 1000;
        *sujo = true;
    }
    if !*captura {
        let trecho = Trecho {
            inicio,
            fim: agora,
            titulo: String::new(),
            processo: String::new(),
            proprio: false,
            ausente: false,
            sem_captura: true,
        };
        acrescentar(&mut sessao.trechos, alterado_desde, trecho);
        return None;
    }
    let leitura = ler();
    let ausente = leitura.sem_uso >= limite;
    if ausente {
        marcar_ausencia(&mut sessao.trechos, alterado_desde, agora - leitura.sem_uso);
    }
    let trecho = Trecho {
        inicio,
        fim: agora,
        titulo: leitura.janela.titulo.clone(),
        processo: leitura.janela.processo.clone(),
        proprio: leitura.janela.proprio,
        ausente,
        sem_captura: false,
    };
    acrescentar(&mut sessao.trechos, alterado_desde, trecho);
    Some(leitura)
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

/// Rótulo da distração quando a janela conta como fora do estudo. A ordem é a de `classificar` no front: termos
/// das matérias e dos objetivos primeiro (estudo), depois as regras. Sem regra, também é fora.
fn distracao(config: &Configuracao, janela: &Janela) -> Option<String> {
    if janela.proprio || (janela.titulo.is_empty() && janela.processo.is_empty()) {
        return None;
    }
    let alvo = format!("{} {}", normalizar(&janela.titulo), normalizar(&janela.processo));
    if config.termos.iter().any(|t| contem_palavra(&alvo, t)) {
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

fn novo_id(agora: i64) -> String {
    format!("dia-{agora:x}-{:x}", std::process::id())
}

/// Abre a sessão do dia (parado) ou retoma (pausado). Sem configuração, não faz nada.
fn play(e: &mut Estado, agora: i64) -> bool {
    if e.config.is_none() {
        return false;
    }
    match e.fase {
        Fase::Parado => {
            let dia = dia_logico(agora, inicio_do_dia(e));
            e.sessao = Some(SessaoDia { id: novo_id(agora), dia, inicio: agora, fim: agora, trechos: Vec::new(), pausas: Vec::new() });
            e.pausa = None;
            e.captura = true;
            e.alterado_desde = 0;
            log::info!("play: sessão do dia aberta");
        }
        Fase::Pausado => {
            if let (Some(mut pausa), Some(sessao)) = (e.pausa.take(), e.sessao.as_mut()) {
                pausa.fim = agora.max(pausa.inicio);
                sessao.pausas.push(pausa);
            }
            log::info!("play: sessão retomada");
        }
        Fase::Rodando | Fase::Ausente => return true,
    }
    e.fase = Fase::Rodando;
    e.ultimo = agora;
    e.ciclo_desde = agora;
    e.fora_desde = None;
    e.avisado = false;
    e.sujo = true;
    true
}

fn pausar(e: &mut Estado, agora: i64, ler: &mut dyn FnMut() -> Leitura) {
    match e.fase {
        Fase::Rodando => {
            registrar(e, agora, ler);
        }
        Fase::Ausente => {
            // A pausa automática termina aqui, e começa a da pessoa.
            if let (Some(mut pausa), Some(sessao)) = (e.pausa.take(), e.sessao.as_mut()) {
                pausa.fim = agora.max(pausa.inicio);
                sessao.pausas.push(pausa);
            }
        }
        Fase::Parado | Fase::Pausado => return,
    }
    e.pausa = Some(Pausa { inicio: agora, fim: agora, motivo: Motivo::Manual });
    e.fase = Fase::Pausado;
    e.fora_desde = None;
    e.avisado = false;
    e.sujo = true;
    log::info!("pausa manual");
}

/// Fecha a sessão do dia: ela vai para a fila de entrega ao front.
fn fechar(e: &mut Estado, agora: i64) {
    let Some(mut sessao) = e.sessao.take() else { return };
    if let Some(mut pausa) = e.pausa.take() {
        pausa.fim = agora.max(pausa.inicio);
        sessao.pausas.push(pausa);
    }
    sessao.fim = agora.max(sessao.trechos.last().map_or(sessao.inicio, |t| t.fim));
    log::info!("sessão do dia {} fechada com {} trechos e {} pausas", sessao.dia, sessao.trechos.len(), sessao.pausas.len());
    e.fechadas.push(sessao);
    e.fase = Fase::Parado;
    e.captura = true;
    e.alterado_desde = 0;
    e.fora_desde = None;
    e.avisado = false;
    e.sujo = true;
}

/// Um segundo do relógio: virada do dia, registro da janela, pausas automáticas e avisos.
fn avancar(e: &mut Estado, agora: i64, ler: &mut dyn FnMut() -> Leitura, avisos: &mut Vec<(String, String)>) {
    if let Some(sessao) = &e.sessao
        && dia_logico(agora, inicio_do_dia(e)) != sessao.dia {
            log::info!("virada do dia: a sessão para");
            if e.fase == Fase::Rodando {
                let fim = e.ultimo;
                return fechar(e, fim);
            }
            return fechar(e, agora);
        }
    let Some(config) = e.config.clone() else { return };
    match e.fase {
        Fase::Parado | Fase::Pausado => {}
        Fase::Ausente => {
            let leitura = ler();
            if leitura.sem_uso < VOLTOU_MS {
                // A pessoa voltou: a pausa termina no primeiro uso, e a captura segue dali.
                let volta = agora - leitura.sem_uso;
                if let (Some(mut pausa), Some(sessao)) = (e.pausa.take(), e.sessao.as_mut()) {
                    pausa.fim = volta.max(pausa.inicio);
                    sessao.pausas.push(pausa);
                }
                e.fase = Fase::Rodando;
                e.ultimo = volta.max(e.ultimo);
                e.ciclo_desde = e.ultimo;
                e.sujo = true;
                log::info!("volta da ausência: a captura segue");
            } else if let Some(pausa) = e.pausa.as_mut() {
                pausa.fim = agora;
            }
        }
        Fase::Rodando => {
            let leitura = registrar(e, agora, ler);
            if let Some(l) = &leitura
                && e.captura && l.sem_uso >= config.ausencia_longa_seg * 1000 {
                    // Ausência longa: o tempo desde o último uso sai dos trechos e vira pausa automática.
                    let desde = agora - l.sem_uso;
                    let Estado { sessao, alterado_desde, .. } = e;
                    if let Some(sessao) = sessao.as_mut() {
                        cortar_depois(&mut sessao.trechos, alterado_desde, desde);
                    }
                    e.pausa = Some(Pausa { inicio: desde.max(e.sessao.as_ref().map_or(desde, |s| s.inicio)), fim: agora, motivo: Motivo::Ausencia });
                    e.fase = Fase::Ausente;
                    e.fora_desde = None;
                    e.avisado = false;
                    e.sujo = true;
                    log::info!("pausa automática por ausência");
                    return;
                }

            let distraido = match &leitura {
                Some(l) if e.captura && l.sem_uso < config.limite_ausencia_seg * 1000 => distracao(&config, &l.janela),
                _ => None,
            };
            match (config.aviso_distracao_seg, distraido) {
                (Some(limite), Some(rotulo)) => {
                    let desde = *e.fora_desde.get_or_insert(agora);
                    if !e.avisado && agora - desde >= limite * 1000 {
                        e.avisado = true;
                        avisos.push((
                            "Fora do estudo".into(),
                            format!("Há {} em {rotulo}. O tempo continua sendo registrado.", formatar_minutos(agora - desde)),
                        ));
                    }
                }
                _ => {
                    e.fora_desde = None;
                    e.avisado = false;
                }
            }

            if let Some(ciclo) = config.ciclo_seg
                && agora - e.ciclo_desde >= ciclo * 1000 {
                    e.ciclo_desde = agora;
                    avisos.push((
                        "Hora de uma pausa".into(),
                        format!("{} de estudo seguidos. A sessão continua; pause quando quiser.", formatar_minutos(ciclo * 1000)),
                    ));
                }
        }
    }
}

fn diario_de(e: &Estado, agora: i64) -> Diario {
    Diario {
        versao: VERSAO_DIARIO,
        salvo_em: agora,
        fase: e.fase,
        captura: e.captura,
        sessao: e.sessao.clone(),
        pausa: e.pausa.clone(),
        fechadas: e.fechadas.clone(),
        config: e.config.clone(),
    }
}

fn ler_diario(caminho: &Path) -> Option<Diario> {
    let texto = std::fs::read_to_string(caminho).ok()?;
    match serde_json::from_str::<Diario>(&texto) {
        Ok(d) if d.versao <= VERSAO_DIARIO => Some(d),
        Ok(d) => {
            log::warn!("diário de versão mais nova ({}), ignorado", d.versao);
            None
        }
        Err(erro) => {
            log::error!("diário ilegível: {erro}");
            None
        }
    }
}

/// Escreve num arquivo temporário e troca: um desligamento no meio não deixa o diário pela metade.
fn gravar_atomico(caminho: &Path, texto: &str) -> std::io::Result<()> {
    if let Some(pasta) = caminho.parent() {
        std::fs::create_dir_all(pasta)?;
    }
    let temporario = caminho.with_extension("json.tmp");
    std::fs::write(&temporario, texto)?;
    std::fs::rename(&temporario, caminho)
}

/// O estado depois de o app abrir de novo. No mesmo dia lógico, a sessão volta como estava e o tempo desligado
/// vira pausa; em outro dia, ela é fechada no último momento salvo.
fn recuperar(d: Diario, agora: i64) -> Estado {
    let mut e = Estado { config: d.config, captura: d.captura, fechadas: d.fechadas, gravado_em: d.salvo_em, ..Estado::default() };
    let Some(mut sessao) = d.sessao else { return e };
    let desligado = (agora - d.salvo_em).max(0);

    if dia_logico(agora, inicio_do_dia(&e)) != sessao.dia {
        if let Some(mut pausa) = d.pausa {
            pausa.fim = d.salvo_em.max(pausa.inicio);
            sessao.pausas.push(pausa);
        }
        sessao.fim = d.salvo_em.max(sessao.trechos.last().map_or(sessao.inicio, |t| t.fim));
        e.fechadas.push(sessao);
        e.sujo = true;
        return e;
    }

    match d.fase {
        Fase::Pausado => {
            // A pausa da pessoa continua.
            e.pausa = d.pausa;
            e.fase = Fase::Pausado;
        }
        Fase::Rodando | Fase::Ausente => {
            let desde = match d.pausa {
                Some(mut pausa) if d.fase == Fase::Ausente => {
                    pausa.fim = d.salvo_em.max(pausa.inicio);
                    let fim = pausa.fim;
                    sessao.pausas.push(pausa);
                    fim
                }
                _ => sessao.trechos.last().map_or(d.salvo_em, |t| t.fim).min(d.salvo_em),
            };
            if agora > desde {
                sessao.pausas.push(Pausa { inicio: desde, fim: agora, motivo: Motivo::Desligado });
            }
            e.fase = Fase::Rodando;
            e.ultimo = agora;
            e.ciclo_desde = agora;
        }
        Fase::Parado => {}
    }
    e.recuperacao = Some(Recuperacao { desligado_ms: desligado, fase: e.fase });
    e.sessao = Some(sessao);
    e.sujo = true;
    e
}

/// Uma leitura por segundo (chamada pelo relógio em `lib.rs`).
pub fn tick(app: &AppHandle) {
    let rastreador = app.state::<Rastreador>();
    let mut avisos: Vec<(String, String)> = Vec::new();
    {
        let Ok(mut e) = rastreador.estado.lock() else { return };
        if e.fase == Fase::Parado {
            return;
        }
        avancar(&mut e, agora_ms(), &mut ler_janela, &mut avisos);
    }
    rastreador.gravar_se_preciso();
    for (titulo, corpo) in avisos {
        notificar(app, &titulo, &corpo);
    }
}

/// O front manda as regras, os termos e as preferências ao abrir e a cada mudança: valem na hora.
#[tauri::command]
pub fn sessao_configurar(rastreador: State<Rastreador>, config: Configuracao) {
    if let Ok(mut e) = rastreador.estado.lock() {
        e.config = Some(config);
    }
}

#[tauri::command]
pub fn sessao_play(rastreador: State<Rastreador>) -> bool {
    let ok = rastreador.estado.lock().map(|mut e| play(&mut e, agora_ms())).unwrap_or(false);
    rastreador.gravar_se_preciso();
    ok
}

#[tauri::command]
pub fn sessao_pausar(rastreador: State<Rastreador>) {
    if let Ok(mut e) = rastreador.estado.lock() {
        pausar(&mut e, agora_ms(), &mut ler_janela);
    }
    rastreador.gravar_se_preciso();
}

/// Liga ou desliga a leitura da janela sem parar o relógio.
#[tauri::command]
pub fn sessao_captura(rastreador: State<Rastreador>, ligada: bool) {
    if let Ok(mut e) = rastreador.estado.lock() {
        if e.fase == Fase::Rodando {
            registrar(&mut e, agora_ms(), &mut ler_janela);
        }
        e.captura = ligada;
        e.fora_desde = None;
        e.avisado = false;
        e.sujo = true;
    }
    rastreador.gravar_se_preciso();
}

/// Fecha a sessão do dia (ao salvar o relato final). Ela aparece em `fechadas` na próxima leitura.
#[tauri::command]
pub fn sessao_fechar(rastreador: State<Rastreador>) {
    if let Ok(mut e) = rastreador.estado.lock() {
        let agora = agora_ms();
        if e.fase == Fase::Rodando {
            registrar(&mut e, agora, &mut ler_janela);
        }
        fechar(&mut e, agora);
    }
    rastreador.gravar_se_preciso();
}

/// O front gravou a sessão fechada no `dados.json`: ela sai do diário.
#[tauri::command]
pub fn sessao_confirmar(rastreador: State<Rastreador>, id: String) {
    if let Ok(mut e) = rastreador.estado.lock() {
        e.fechadas.retain(|s| s.id != id);
        e.sujo = true;
    }
    rastreador.gravar_se_preciso();
}

#[tauri::command]
pub fn sessao_recuperacao_vista(rastreador: State<Rastreador>) {
    if let Ok(mut e) = rastreador.estado.lock() {
        e.recuperacao = None;
    }
}

/// O estado para a tela. `desde` é quantos trechos o front já tem: só vêm os novos (e os que mudaram).
#[tauri::command]
pub fn sessao_estado(rastreador: State<Rastreador>, desde: usize) -> Retrato {
    let Ok(mut e) = rastreador.estado.lock() else {
        return Retrato {
            fase: Fase::Parado,
            captura: true,
            sessao: None,
            decorrido_ms: 0,
            pausas: Vec::new(),
            base: 0,
            trechos: Vec::new(),
            atual: Janela::default(),
            ms_sem_uso: 0,
            fechadas: Vec::new(),
            recuperacao: None,
            configurado: false,
        };
    };
    retrato(&mut e, agora_ms(), desde, &mut ler_janela)
}

fn retrato(e: &mut Estado, agora: i64, desde: usize, ler: &mut dyn FnMut() -> Leitura) -> Retrato {
    // Fora da sessão rodando, ou com a captura pausada, nada é lido: nem para mostrar na tela.
    let lendo = e.fase == Fase::Rodando && e.captura;
    let leitura = if lendo { ler() } else { Leitura::default() };
    let (trechos, base, decorrido, mut pausas) = match &e.sessao {
        Some(s) => {
            let base = desde.min(e.alterado_desde).min(s.trechos.len());
            let registrado: i64 = s.trechos.iter().map(|t| t.fim - t.inicio).sum();
            let correndo = if e.fase == Fase::Rodando { (agora - e.ultimo).max(0) } else { 0 };
            (s.trechos[base..].to_vec(), base, registrado + correndo, s.pausas.clone())
        }
        None => (Vec::new(), 0, 0, Vec::new()),
    };
    if let Some(pausa) = &e.pausa {
        pausas.push(Pausa { fim: agora.max(pausa.inicio), ..pausa.clone() });
    }
    e.alterado_desde = e.sessao.as_ref().map_or(0, |s| s.trechos.len());
    Retrato {
        fase: e.fase,
        captura: e.captura,
        sessao: e.sessao.as_ref().map(|s| ResumoSessao { id: s.id.clone(), dia: s.dia.clone(), inicio: s.inicio }),
        decorrido_ms: decorrido,
        pausas,
        base,
        trechos,
        atual: leitura.janela,
        ms_sem_uso: leitura.sem_uso,
        fechadas: e.fechadas.clone(),
        recuperacao: e.recuperacao.clone(),
        configurado: e.config.is_some(),
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    const S: i64 = 1000;
    const MIN: i64 = 60 * S;

    fn trecho(inicio: i64, fim: i64, titulo: &str) -> Trecho {
        Trecho { inicio, fim, titulo: titulo.into(), processo: "app".into(), proprio: false, ausente: false, sem_captura: false }
    }

    fn regra(rotulo: &str, termo: &str, campo: &str, tipo: &str) -> Regra {
        Regra { rotulo: rotulo.into(), termos: vec![termo.into()], campo: campo.into(), tipo: tipo.into() }
    }

    fn janela(titulo: &str, processo: &str) -> Janela {
        Janela { titulo: titulo.into(), processo: processo.into(), proprio: false }
    }

    fn config() -> Configuracao {
        Configuracao {
            limite_ausencia_seg: 5 * 60,
            ausencia_longa_seg: 15 * 60,
            aviso_distracao_seg: Some(60),
            ciclo_seg: None,
            regras: vec![regra("YouTube", "youtube", "titulo", "fora"), regra("Spotify", "spotify", "app", "ignorar")],
            termos: vec!["blender".into()],
            inicio_do_dia_min: 4 * 60,
        }
    }

    /// 20/10/2026 às 9h no fuso local.
    fn nove() -> i64 {
        Local.with_ymd_and_hms(2026, 10, 20, 9, 0, 0).single().unwrap().timestamp_millis()
    }

    fn estado() -> Estado {
        Estado { config: Some(config()), ..Estado::default() }
    }

    /// Leitor fixo: a janela e o tempo sem uso que o teste quiser.
    fn leitor(titulo: &'static str, sem_uso: i64) -> impl FnMut() -> Leitura {
        move || Leitura { janela: janela(titulo, "chrome"), sem_uso }
    }

    /// Avança o relógio de segundo em segundo, como o `tick`.
    fn rodar(e: &mut Estado, de: i64, ate: i64, ler: &mut dyn FnMut() -> Leitura) -> Vec<(String, String)> {
        let mut avisos = Vec::new();
        let mut t = de + S;
        while t <= ate {
            avancar(e, t, ler, &mut avisos);
            t += S;
        }
        avisos
    }

    #[test]
    fn junta_leituras_seguidas_da_mesma_janela() {
        let mut trechos = vec![trecho(0, 1000, "A")];
        let mut alterado = usize::MAX;
        acrescentar(&mut trechos, &mut alterado, trecho(1000, 2000, "A"));
        assert_eq!(alterado, 0);
        acrescentar(&mut trechos, &mut alterado, trecho(2000, 3000, "B"));
        assert_eq!(trechos.len(), 2);
        assert_eq!(trechos[0].fim, 2000);
    }

    #[test]
    fn ausencia_divide_o_trecho_no_ultimo_uso() {
        let mut trechos = vec![trecho(0, 10_000, "A"), trecho(10_000, 20_000, "B")];
        let mut alterado = usize::MAX;
        marcar_ausencia(&mut trechos, &mut alterado, 15_000);
        assert_eq!(trechos.len(), 3);
        assert!(!trechos[0].ausente);
        assert_eq!((trechos[1].inicio, trechos[1].fim, trechos[1].ausente), (10_000, 15_000, false));
        assert_eq!((trechos[2].inicio, trechos[2].fim, trechos[2].ausente), (15_000, 20_000, true));
        assert_eq!(alterado, 1);
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
        let config = config();
        assert!(distracao(&config, &janela("Música", "Spotify")).is_none());
        assert_eq!(distracao(&config, &janela("Jogo qualquer", "jogo")).as_deref(), Some("Jogo qualquer"));
    }

    #[test]
    fn termo_de_materia_vale_antes_das_regras_de_fora() {
        let config = config();
        assert!(distracao(&config, &janela("Blender: cadeira - YouTube", "chrome")).is_none());
        assert_eq!(distracao(&config, &janela("Gatinho - YouTube", "chrome")).as_deref(), Some("YouTube"));
    }

    #[test]
    fn normaliza_e_casa_palavra_inteira() {
        assert_eq!(normalizar("Inglês AVANÇADO"), "ingles avancado");
        assert!(contem_palavra("aprendendo go hoje", "go"));
        assert!(!contem_palavra("google docs", "go"));
        assert!(contem_palavra("ação: go", "go"));
        assert!(!contem_palavra("tudo", ""));
    }

    #[test]
    fn dia_logico_vira_as_quatro() {
        let duas = Local.with_ymd_and_hms(2026, 10, 21, 2, 0, 0).single().unwrap().timestamp_millis();
        let cinco = Local.with_ymd_and_hms(2026, 10, 21, 5, 0, 0).single().unwrap().timestamp_millis();
        assert_eq!(dia_logico(duas, 240), "2026-10-20");
        assert_eq!(dia_logico(cinco, 240), "2026-10-21");
        assert_eq!(dia_logico(duas, 0), "2026-10-21");
    }

    #[test]
    fn play_sem_configuracao_nao_abre_sessao() {
        let mut e = Estado::default();
        assert!(!play(&mut e, nove()));
        assert_eq!(e.fase, Fase::Parado);
    }

    #[test]
    fn play_pausa_e_play_ficam_na_mesma_sessao() {
        let mut e = estado();
        let t0 = nove();
        assert!(play(&mut e, t0));
        let id = e.sessao.as_ref().unwrap().id.clone();
        rodar(&mut e, t0, t0 + 10 * S, &mut leitor("Docs", 0));
        pausar(&mut e, t0 + 10 * S, &mut leitor("Docs", 0));
        assert_eq!(e.fase, Fase::Pausado);
        play(&mut e, t0 + 70 * S);
        rodar(&mut e, t0 + 70 * S, t0 + 80 * S, &mut leitor("Docs", 0));
        let s = e.sessao.as_ref().unwrap();
        assert_eq!(s.id, id);
        assert_eq!(s.pausas, vec![Pausa { inicio: t0 + 10 * S, fim: t0 + 70 * S, motivo: Motivo::Manual }]);
        let registrado: i64 = s.trechos.iter().map(|t| t.fim - t.inicio).sum();
        assert_eq!(registrado, 20 * S);
    }

    #[test]
    fn suspensao_vira_pausa_e_a_captura_segue() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + 5 * S, &mut leitor("Docs", 0));
        // O PC dormiu 10 min: a próxima leitura vem muito depois.
        let mut avisos = Vec::new();
        avancar(&mut e, t0 + 5 * S + 10 * MIN, &mut leitor("Docs", 0), &mut avisos);
        let s = e.sessao.as_ref().unwrap();
        assert_eq!(e.fase, Fase::Rodando);
        assert_eq!(s.pausas.len(), 1);
        assert_eq!(s.pausas[0].motivo, Motivo::Suspensao);
        assert_eq!(s.pausas[0].inicio, t0 + 5 * S);
    }

    #[test]
    fn ausencia_longa_vira_pausa_automatica_e_a_volta_retoma_sozinha() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + MIN, &mut leitor("Docs", 0));
        // A pessoa saiu: o tempo sem uso cresce junto com o relógio.
        let saida = t0 + MIN;
        let mut t = saida;
        while t < saida + 16 * MIN {
            t += S;
            let mut ler = || Leitura { janela: janela("Docs", "chrome"), sem_uso: t - saida };
            avancar(&mut e, t, &mut ler, &mut Vec::new());
        }
        assert_eq!(e.fase, Fase::Ausente);
        let s = e.sessao.as_ref().unwrap();
        // Os trechos param no último uso; o resto virou pausa.
        assert_eq!(s.trechos.last().unwrap().fim, saida);
        assert_eq!(e.pausa.as_ref().unwrap().inicio, saida);

        // Volta: mexeu no mouse há 1 s.
        let volta = t + 20 * MIN;
        avancar(&mut e, volta, &mut leitor("Docs", S), &mut Vec::new());
        assert_eq!(e.fase, Fase::Rodando);
        let s = e.sessao.as_ref().unwrap();
        assert_eq!(s.pausas.last().unwrap(), &Pausa { inicio: saida, fim: volta - S, motivo: Motivo::Ausencia });
    }

    #[test]
    fn virada_do_dia_fecha_a_sessao() {
        let mut e = estado();
        let antes = Local.with_ymd_and_hms(2026, 10, 21, 3, 59, 50).single().unwrap().timestamp_millis();
        play(&mut e, antes);
        rodar(&mut e, antes, antes + 20 * S, &mut leitor("Docs", 0));
        assert_eq!(e.fase, Fase::Parado);
        assert!(e.sessao.is_none());
        assert_eq!(e.fechadas.len(), 1);
        assert_eq!(e.fechadas[0].dia, "2026-10-20");
    }

    #[test]
    fn aviso_de_distracao_e_ciclo() {
        let mut e = estado();
        e.config.as_mut().unwrap().ciclo_seg = Some(25 * 60);
        let t0 = nove();
        play(&mut e, t0);
        let avisos = rodar(&mut e, t0, t0 + 2 * MIN, &mut leitor("Gatinho - YouTube", 0));
        assert_eq!(avisos.iter().filter(|(t, _)| t == "Fora do estudo").count(), 1);
        let avisos = rodar(&mut e, t0 + 2 * MIN, t0 + 26 * MIN, &mut leitor("Blender - YouTube", 0));
        assert_eq!(avisos.iter().filter(|(t, _)| t == "Hora de uma pausa").count(), 1);
        assert!(avisos.iter().all(|(t, _)| t != "Fora do estudo"));
    }

    #[test]
    fn retrato_manda_so_o_que_mudou() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + 3 * S, &mut leitor("A", 0));
        let r = retrato(&mut e, t0 + 3 * S, 0, &mut leitor("A", 0));
        assert_eq!((r.base, r.trechos.len()), (0, 1));
        rodar(&mut e, t0 + 3 * S, t0 + 5 * S, &mut leitor("B", 0));
        // O front tem 1 trecho; o primeiro não mudou, então vem só o novo.
        let r = retrato(&mut e, t0 + 5 * S, 1, &mut leitor("B", 0));
        assert_eq!((r.base, r.trechos.len()), (1, 1));
        assert_eq!(r.trechos[0].titulo, "B");
        // Mais um segundo em B: o último trecho muda e vem de novo.
        rodar(&mut e, t0 + 5 * S, t0 + 6 * S, &mut leitor("B", 0));
        let r = retrato(&mut e, t0 + 6 * S, 2, &mut leitor("B", 0));
        assert_eq!((r.base, r.trechos.len()), (1, 1));
        assert_eq!(r.decorrido_ms, 6 * S);
    }

    #[test]
    fn recupera_no_mesmo_dia_como_estava_com_o_tempo_desligado_como_pausa() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + 30 * S, &mut leitor("Docs", 0));
        let diario = diario_de(&e, t0 + 30 * S);
        let texto = serde_json::to_string(&diario).unwrap();
        let lido: Diario = serde_json::from_str(&texto).unwrap();

        let r = recuperar(lido, t0 + 10 * MIN);
        assert_eq!(r.fase, Fase::Rodando);
        let s = r.sessao.as_ref().unwrap();
        assert_eq!(s.trechos.len(), 1);
        assert_eq!(s.pausas, vec![Pausa { inicio: t0 + 30 * S, fim: t0 + 10 * MIN, motivo: Motivo::Desligado }]);
        assert_eq!(r.recuperacao.as_ref().unwrap().desligado_ms, 10 * MIN - 30 * S);
    }

    #[test]
    fn recupera_pausada_se_estava_pausada() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + 10 * S, &mut leitor("Docs", 0));
        pausar(&mut e, t0 + 10 * S, &mut leitor("Docs", 0));
        let r = recuperar(diario_de(&e, t0 + 20 * S), t0 + MIN);
        assert_eq!(r.fase, Fase::Pausado);
        assert_eq!(r.pausa.as_ref().unwrap().inicio, t0 + 10 * S);
        assert!(r.sessao.as_ref().unwrap().pausas.is_empty());
    }

    #[test]
    fn em_outro_dia_a_sessao_recuperada_e_fechada_para_entrega() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + 10 * S, &mut leitor("Docs", 0));
        let amanha = t0 + 24 * 60 * MIN;
        let r = recuperar(diario_de(&e, t0 + 10 * S), amanha);
        assert_eq!(r.fase, Fase::Parado);
        assert!(r.sessao.is_none());
        assert_eq!(r.fechadas.len(), 1);
        assert_eq!(r.fechadas[0].fim, t0 + 10 * S);
    }

    #[test]
    fn fechar_entrega_e_confirmar_tira_do_diario() {
        let mut e = estado();
        let t0 = nove();
        play(&mut e, t0);
        rodar(&mut e, t0, t0 + 10 * S, &mut leitor("Docs", 0));
        pausar(&mut e, t0 + 10 * S, &mut leitor("Docs", 0));
        fechar(&mut e, t0 + MIN);
        assert_eq!(e.fase, Fase::Parado);
        let s = &e.fechadas[0];
        assert_eq!(s.pausas.last().unwrap(), &Pausa { inicio: t0 + 10 * S, fim: t0 + MIN, motivo: Motivo::Manual });
        assert_eq!(s.fim, t0 + MIN);
    }

    #[test]
    fn gravacao_atomica_troca_o_arquivo() {
        let pasta = std::env::temp_dir().join(format!("pos-teste-{}", std::process::id()));
        let caminho = pasta.join("sessao-ativa.json");
        gravar_atomico(&caminho, "{\"a\":1}").unwrap();
        gravar_atomico(&caminho, "{\"a\":2}").unwrap();
        assert_eq!(std::fs::read_to_string(&caminho).unwrap(), "{\"a\":2}");
        assert!(!caminho.with_extension("json.tmp").exists());
        let _ = std::fs::remove_dir_all(pasta);
    }
}
