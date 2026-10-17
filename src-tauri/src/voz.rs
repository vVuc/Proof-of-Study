//! Voz transcrita ao vivo pelo Gemini (AD-003). O microfone é gravado, passado para PCM de 16 kHz e enviado em
//! pedaços de 100 ms por um WebSocket; o texto parcial volta enquanto a pessoa fala. O áudio só passa pela memória:
//! cada pedaço é descartado depois de enviado, e nada vai para o disco (VOZ-08). A chave vai no header, nunca na URL.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::{Error as ErroDoSocket, Message};

use crate::ia::{self, ErroIA, IA};

// Protocolo da transcrição ao vivo do Gemini (ai.google.dev/gemini-api/docs/live-api/live-transcribe).

const URL_AO_VIVO: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
/// Modelo da transcrição ao vivo, fixo no código.
pub const MODELO_VOZ: &str = "models/gemini-3.5-transcribe-live";
/// O Gemini recebe PCM de 16 bits, 16 kHz, mono.
const TAXA: u32 = 16_000;
/// 100 ms de áudio em PCM de 16 bits, 16 kHz, mono: 1.600 amostras de 2 bytes.
pub const BYTES_POR_PEDACO: usize = 3_200;
/// O vocabulário próprio da transcrição aceita até 100 termos (VOZ-04).
pub const MAX_TERMOS: usize = 100;
/// Uma gravação vai até 10 minutos de áudio, o limite da sessão ao vivo (VOZ-03).
const BYTES_DO_LIMITE: usize = 10 * 60 * TAXA as usize * 2;
/// Depois de parar, o tempo máximo de espera pelo último texto final.
const ESPERA_DO_FINAL: Duration = Duration::from_secs(5);
const ESPERA_DA_CONEXAO: Duration = Duration::from_secs(10);

const EVENTO_PARCIAL: &str = "voz:parcial";
const EVENTO_ERRO: &str = "voz:erro";
// SPEC_DEVIATION: o design lista só `voz:parcial` e `voz:erro`; `voz:fim { texto }` foi acrescentado.
// Reason: aos 10 minutos a gravação termina sem a pessoa clicar em "Parar", e o front precisa saber que ela acabou.
const EVENTO_FIM: &str = "voz:fim";

/// Amostras de -1.0 a 1.0 em PCM de 16 bits little-endian. O `as` satura: 1.0 vira 32767, não estoura.
pub fn para_pcm16(amostras: &[f32]) -> Vec<u8> {
    amostras.iter().flat_map(|s| ((s * 32_768.0) as i16).to_le_bytes()).collect()
}

/// Passa o áudio para 16 kHz. Ao reduzir, cada amostra nova é a média do trecho que ela cobre (um filtro
/// passa-baixa simples, suficiente para fala).
pub fn reamostrar(entrada: &[f32], taxa: u32) -> Vec<f32> {
    if taxa == TAXA || entrada.is_empty() {
        return entrada.to_vec();
    }
    let razao = f64::from(taxa) / f64::from(TAXA);
    let saida = (entrada.len() as f64 / razao) as usize;
    (0..saida)
        .map(|i| {
            let inicio = (i as f64 * razao) as usize;
            if razao >= 1.0 {
                let fim = (((i + 1) as f64 * razao) as usize).clamp(inicio + 1, entrada.len());
                let janela = &entrada[inicio..fim];
                janela.iter().sum::<f32>() / janela.len() as f32
            } else {
                let posicao = i as f64 * razao;
                let fracao = (posicao - inicio as f64) as f32;
                let a = entrada[inicio];
                let b = entrada.get(inicio + 1).copied().unwrap_or(a);
                a + (b - a) * fracao
            }
        })
        .collect()
}

/// Junta o áudio que chega do microfone e entrega pedaços de 100 ms. A sobra espera o próximo áudio.
#[derive(Default)]
pub struct Pedacos {
    sobra: Vec<u8>,
}

impl Pedacos {
    pub fn juntar(&mut self, audio: &[u8]) -> Vec<Vec<u8>> {
        self.sobra.extend_from_slice(audio);
        let inteiros = self.sobra.len() / BYTES_POR_PEDACO * BYTES_POR_PEDACO;
        let resto = self.sobra.split_off(inteiros);
        let prontos = std::mem::replace(&mut self.sobra, resto);
        prontos.chunks(BYTES_POR_PEDACO).map(<[u8]>::to_vec).collect()
    }

    /// Bytes guardados à espera de completar um pedaço.
    #[cfg(test)]
    pub fn guardados(&self) -> usize {
        self.sobra.len()
    }
}

/// Com tantos bytes de áudio enviados, a gravação chegou aos 10 minutos e acaba (VOZ-03).
pub fn chegou_ao_limite(bytes_enviados: usize) -> bool {
    bytes_enviados >= BYTES_DO_LIMITE
}

/// A primeira mensagem da sessão: o modelo, a saída em texto, o português e o vocabulário (até 100 termos).
pub fn mensagem_setup(vocabulario: &[String]) -> Value {
    let termos: Vec<&String> = vocabulario.iter().take(MAX_TERMOS).collect();
    json!({
        "setup": {
            "model": MODELO_VOZ,
            "generationConfig": { "responseModalities": ["TEXT"] },
            "inputAudioTranscription": { "languageCodes": ["pt-BR"], "customVocabulary": termos },
        }
    })
}

/// Um pedaço de áudio, em base64.
pub fn mensagem_audio(pcm: &[u8]) -> Value {
    use base64::Engine;
    let dados = base64::engine::general_purpose::STANDARD.encode(pcm);
    json!({ "realtimeInput": { "audio": { "data": dados, "mimeType": "audio/pcm;rate=16000" } } })
}

/// Avisa o Gemini que o áudio acabou.
pub fn mensagem_fim() -> Value {
    json!({ "realtimeInput": { "audioStreamEnd": true } })
}

/// O texto que o Gemini devolve: o parcial ainda pode mudar; o final fecha um trecho da fala.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Transcricao {
    Parcial(String),
    Final(String),
}

/// Lê uma mensagem do Gemini. Tudo que não é transcrição (ou não é JSON) fica de fora.
pub fn ler_mensagem(texto: &str) -> Option<Transcricao> {
    let valor: Value = serde_json::from_str(texto).ok()?;
    let conteudo = valor.get("serverContent")?;
    let texto_de = |campo: &str| conteudo.get(campo)?.get("text")?.as_str().map(str::to_owned);
    texto_de("inputTranscription")
        .map(Transcricao::Final)
        .or_else(|| texto_de("interimInputTranscription").map(Transcricao::Parcial))
}

/// O texto da fala até agora: os trechos finais e o parcial em curso, que o próximo parcial ou o final trocam.
#[derive(Default)]
pub struct Transcrito {
    finais: Vec<String>,
    parcial: String,
}

impl Transcrito {
    pub fn receber(&mut self, transcricao: Transcricao) {
        match transcricao {
            Transcricao::Parcial(texto) => self.parcial = texto.trim().to_string(),
            Transcricao::Final(texto) => {
                self.parcial.clear();
                let texto = texto.trim();
                if !texto.is_empty() {
                    self.finais.push(texto.to_string());
                }
            }
        }
    }

    /// Os trechos finais e o parcial, separados por espaço.
    pub fn texto(&self) -> String {
        let parcial = (!self.parcial.is_empty()).then_some(self.parcial.as_str());
        self.finais.iter().map(String::as_str).chain(parcial).collect::<Vec<_>>().join(" ")
    }
}

/// O que importa de uma leitura do socket: uma transcrição ou a queda. `None` = nada a fazer (ping, outra mensagem).
#[derive(Debug, PartialEq, Eq)]
pub enum DoSocket {
    Transcricao(Transcricao),
    Caiu,
}

/// Uma leitura do socket. O Gemini manda o JSON em texto ou em binário; o fim do stream, o `Close` e o erro são a
/// queda da conexão.
pub fn ler_do_socket(recebido: Option<Result<Message, ErroDoSocket>>) -> Option<DoSocket> {
    match recebido {
        Some(Ok(Message::Text(texto))) => ler_mensagem(texto.as_str()).map(DoSocket::Transcricao),
        Some(Ok(Message::Binary(bytes))) => std::str::from_utf8(&bytes).ok().and_then(ler_mensagem).map(DoSocket::Transcricao),
        Some(Ok(Message::Close(_)) | Err(_)) | None => Some(DoSocket::Caiu),
        Some(Ok(_)) => None,
    }
}

/// O que vai para a tela durante a gravação.
#[derive(Debug, PartialEq, Eq)]
pub enum ParaATela {
    /// `voz:parcial`: o texto acumulado, com o parcial em curso (VOZ-01).
    Parcial(String),
    /// `voz:erro`: a gravação acaba, e o texto acumulado fica (VOZ-05).
    Erro(ErroIA),
}

/// Uma leitura do socket durante a gravação: a transcrição atualiza o texto e vai para a tela; a queda vira o erro de
/// conexão, sem apagar o que já foi transcrito.
pub fn ao_receber(transcrito: &mut Transcrito, recebido: Option<Result<Message, ErroDoSocket>>) -> Option<ParaATela> {
    match ler_do_socket(recebido)? {
        DoSocket::Transcricao(t) => {
            transcrito.receber(t);
            Some(ParaATela::Parcial(transcrito.texto()))
        }
        DoSocket::Caiu => Some(ParaATela::Erro(ErroIA::Conexao)),
    }
}

/// O erro ao abrir o socket: a resposta HTTP do handshake segue o mapa das análises (chave, cota…); o resto é
/// falta de conexão. A mensagem crua do erro nunca é usada.
fn erro_da_conexao(erro: &ErroDoSocket) -> ErroIA {
    match erro {
        ErroDoSocket::Http(resposta) => {
            let corpo = resposta.body().as_deref().map(String::from_utf8_lossy).unwrap_or_default();
            ia::erro_do_status(resposta.status().as_u16(), &corpo)
        }
        _ => ErroIA::Conexao,
    }
}

// A sessão: microfone → canal → tarefa no runtime do Tauri, que envia o áudio e lê o texto ao mesmo tempo.

type Socket = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// O microfone aberto numa thread própria (o stream do áudio não pode trocar de thread). Largar a gravação o fecha.
struct Gravacao {
    parar: Arc<AtomicBool>,
}

impl Drop for Gravacao {
    fn drop(&mut self) {
        self.parar.store(true, Ordering::Relaxed);
    }
}

fn construir<T>(
    dispositivo: &cpal::Device,
    config: &cpal::StreamConfig,
    canais: usize,
    taxa: u32,
    destino: mpsc::UnboundedSender<Vec<u8>>,
) -> Result<cpal::Stream, String>
where
    T: cpal::SizedSample,
    f32: cpal::FromSample<T>,
{
    use cpal::traits::DeviceTrait;
    dispositivo
        .build_input_stream::<T, _, _>(
            *config,
            move |dados: &[T], _| {
                // Junta os canais num só (média), passa para 16 kHz e para PCM; o pedaço segue pelo canal e sai da
                // memória depois de enviado.
                let mono: Vec<f32> = dados
                    .chunks(canais.max(1))
                    .map(|quadro| quadro.iter().map(|s| cpal::Sample::to_sample::<f32>(*s)).sum::<f32>() / quadro.len() as f32)
                    .collect();
                let _ = destino.send(para_pcm16(&reamostrar(&mono, taxa)));
            },
            |erro| log::warn!("erro no microfone: {erro}"),
            None,
        )
        .map_err(|e| format!("não deu para abrir o microfone: {e}"))
}

/// Abre o microfone padrão e manda o áudio, já em PCM de 16 kHz, para o canal.
fn gravar(destino: mpsc::UnboundedSender<Vec<u8>>) -> Result<Gravacao, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    let parar = Arc::new(AtomicBool::new(false));
    let (pronto, aviso) = std::sync::mpsc::channel::<Result<(), String>>();
    let sinal = parar.clone();
    std::thread::spawn(move || {
        let abrir = || -> Result<cpal::Stream, String> {
            let dispositivo = cpal::default_host().default_input_device().ok_or("nenhum microfone encontrado")?;
            let suportada = dispositivo.default_input_config().map_err(|e| format!("microfone indisponível: {e}"))?;
            let taxa = suportada.sample_rate();
            let canais = usize::from(suportada.channels());
            let formato = suportada.sample_format();
            let config: cpal::StreamConfig = suportada.into();
            let stream = match formato {
                cpal::SampleFormat::F32 => construir::<f32>(&dispositivo, &config, canais, taxa, destino),
                cpal::SampleFormat::I16 => construir::<i16>(&dispositivo, &config, canais, taxa, destino),
                cpal::SampleFormat::U16 => construir::<u16>(&dispositivo, &config, canais, taxa, destino),
                cpal::SampleFormat::I32 => construir::<i32>(&dispositivo, &config, canais, taxa, destino),
                outro => Err(format!("formato de áudio não suportado: {outro}")),
            }?;
            stream.play().map_err(|e| format!("não deu para gravar: {e}"))?;
            Ok(stream)
        };
        match abrir() {
            Ok(stream) => {
                let _ = pronto.send(Ok(()));
                while !sinal.load(Ordering::Relaxed) {
                    std::thread::sleep(Duration::from_millis(50));
                }
                drop(stream);
            }
            Err(erro) => {
                let _ = pronto.send(Err(erro));
            }
        }
    });
    aviso.recv_timeout(Duration::from_secs(5)).map_err(|_| "o microfone não respondeu".to_string())??;
    Ok(Gravacao { parar })
}

/// Abre o socket com a chave no header e manda o `setup`. A primeira transcrição que chegar é o sinal de que a sessão
/// abriu: o áudio começa a ir logo depois do `setup`, sem esperar resposta.
async fn conectar(chave: &str, vocabulario: &[String]) -> Result<Socket, ErroIA> {
    let mut pedido = URL_AO_VIVO.into_client_request().map_err(|_| ErroIA::Conexao)?;
    let mut valor = HeaderValue::from_str(chave).map_err(|_| ErroIA::Chave)?;
    valor.set_sensitive(true);
    pedido.headers_mut().insert("x-goog-api-key", valor);
    let (mut socket, _) = tokio::time::timeout(ESPERA_DA_CONEXAO, tokio_tungstenite::connect_async(pedido))
        .await
        .map_err(|_| ErroIA::Tempo)?
        .map_err(|e| erro_da_conexao(&e))?;
    socket.send(Message::text(mensagem_setup(vocabulario).to_string())).await.map_err(|_| ErroIA::Conexao)?;
    Ok(socket)
}

enum Parada {
    /// "Parar": manda o fim do áudio, espera o último texto e o devolve.
    Devolver(oneshot::Sender<String>),
    /// "Cancelar": fecha sem devolver nada.
    Descartar,
}

/// Como a gravação acabou.
enum Fim {
    Parar(oneshot::Sender<String>),
    /// Os 10 minutos (ou o microfone parou de mandar áudio): termina como o "Parar" e avisa a tela.
    Encerrada,
    /// A conexão caiu: a tela recebe o erro, e o texto acumulado fica.
    Caiu(ErroIA),
    Cancelar,
}

struct Controle {
    id: u64,
    parar: oneshot::Sender<Parada>,
}

#[derive(Default)]
struct Interno {
    /// A gravação em andamento.
    sessao: Option<Controle>,
    /// Conta as sessões, para uma que terminou sozinha não encerrar a seguinte.
    ultima: u64,
    erro: Option<ErroIA>,
}

#[derive(Default)]
pub struct Voz(Mutex<Interno>);

fn travar(voz: &Voz) -> Result<std::sync::MutexGuard<'_, Interno>, ErroIA> {
    voz.0.lock().map_err(|_| ErroIA::Indisponivel)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoVoz {
    /// A IA está ligada e com chave: dá para falar.
    disponivel: bool,
    gravando: bool,
    erro: Option<ErroIA>,
}

fn emitir(app: &AppHandle, evento: &str, dados: Value) {
    if let Err(erro) = app.emit(evento, dados) {
        log::warn!("voz: evento não enviado: {erro}");
    }
}

/// O evento `voz.sessao`: duração e resultado, sem áudio nem texto (IAERR-06).
fn registrar(inicio: Instant, resultado: &str) {
    let ms = u64::try_from(inicio.elapsed().as_millis()).unwrap_or(u64::MAX);
    log::info!(target: "ia", "voz.sessao {}", json!({ "ms": ms, "resultado": resultado }));
}

fn nome_do_erro(erro: &ErroIA) -> String {
    serde_json::to_value(erro).ok().and_then(|v| v["tipo"].as_str().map(str::to_owned)).unwrap_or_default()
}

/// Tira a sessão do estado, se ainda for a mesma, e guarda o erro dela.
fn encerrar(app: &AppHandle, id: u64, erro: Option<ErroIA>) {
    if let Ok(mut e) = travar(&app.state::<Voz>()) {
        if e.sessao.as_ref().is_some_and(|s| s.id == id) {
            e.sessao = None;
        }
        e.erro = erro;
    }
}

/// Depois do fim do áudio, lê até o próximo texto final, a queda do socket ou 5 segundos.
async fn esperar_o_final(app: &AppHandle, leitura: &mut SplitStream<Socket>, transcrito: &mut Transcrito) {
    let prazo = tokio::time::sleep(ESPERA_DO_FINAL);
    tokio::pin!(prazo);
    loop {
        tokio::select! {
            () = &mut prazo => return,
            recebido = leitura.next() => match ler_do_socket(recebido) {
                Some(DoSocket::Transcricao(t)) => {
                    let fechou = matches!(t, Transcricao::Final(_));
                    transcrito.receber(t);
                    emitir(app, EVENTO_PARCIAL, json!({ "texto": transcrito.texto() }));
                    if fechou {
                        return;
                    }
                }
                Some(DoSocket::Caiu) => return,
                None => {}
            },
        }
    }
}

async fn enviar(escrita: &mut SplitSink<Socket, Message>, mensagem: Value) -> Result<(), ErroDoSocket> {
    escrita.send(Message::text(mensagem.to_string())).await
}

/// A gravação: envia o áudio em pedaços de 100 ms e lê o texto até "Parar", "Cancelar", os 10 minutos ou a queda.
async fn conduzir(
    app: AppHandle,
    id: u64,
    socket: Socket,
    mut audio: mpsc::UnboundedReceiver<Vec<u8>>,
    gravacao: Gravacao,
    mut parada: oneshot::Receiver<Parada>,
) {
    let inicio = Instant::now();
    let (mut escrita, mut leitura) = socket.split();
    let mut pedacos = Pedacos::default();
    let mut transcrito = Transcrito::default();
    let mut enviados = 0;
    let fim = 'gravando: loop {
        tokio::select! {
            pedido = &mut parada => break match pedido {
                Ok(Parada::Devolver(resposta)) => Fim::Parar(resposta),
                _ => Fim::Cancelar,
            },
            recebido = audio.recv() => {
                let Some(pcm) = recebido else { break Fim::Encerrada };
                for pedaco in pedacos.juntar(&pcm) {
                    enviados += pedaco.len();
                    if enviar(&mut escrita, mensagem_audio(&pedaco)).await.is_err() {
                        break 'gravando Fim::Caiu(ErroIA::Conexao);
                    }
                }
                if chegou_ao_limite(enviados) {
                    break Fim::Encerrada;
                }
            }
            recebido = leitura.next() => match ao_receber(&mut transcrito, recebido) {
                Some(ParaATela::Parcial(texto)) => emitir(&app, EVENTO_PARCIAL, json!({ "texto": texto })),
                Some(ParaATela::Erro(erro)) => break Fim::Caiu(erro),
                None => {}
            },
        }
    };
    // O microfone para aqui; o áudio que sobrou na memória sai junto.
    drop(gravacao);
    drop(audio);
    let (resultado, erro) = match fim {
        Fim::Cancelar => ("cancelada".to_string(), None),
        Fim::Caiu(erro) => {
            emitir(&app, EVENTO_ERRO, json!(erro));
            (nome_do_erro(&erro), Some(erro))
        }
        Fim::Parar(_) | Fim::Encerrada => {
            let _ = enviar(&mut escrita, mensagem_fim()).await;
            esperar_o_final(&app, &mut leitura, &mut transcrito).await;
            let texto = transcrito.texto();
            let resultado = match fim {
                Fim::Parar(resposta) => {
                    let _ = resposta.send(texto);
                    "ok"
                }
                _ => {
                    emitir(&app, EVENTO_FIM, json!({ "texto": texto }));
                    "limite"
                }
            };
            (resultado.to_string(), None)
        }
    };
    let _ = escrita.close().await;
    encerrar(&app, id, erro);
    registrar(inicio, &resultado);
}

/// Abre o socket e o microfone. Sem microfone, o socket fecha e o erro é o do microfone (VOZ-07).
async fn abrir(chave: String, vocabulario: Vec<String>) -> Result<(Socket, mpsc::UnboundedReceiver<Vec<u8>>, Gravacao), ErroIA> {
    let mut socket = conectar(&chave, &vocabulario).await?;
    drop(chave);
    let (destino, audio) = mpsc::unbounded_channel();
    match tauri::async_runtime::spawn_blocking(move || gravar(destino)).await {
        Ok(Ok(gravacao)) => Ok((socket, audio, gravacao)),
        _ => {
            log::warn!("voz: microfone indisponível");
            let _ = socket.close(None).await;
            Err(ErroIA::Microfone)
        }
    }
}

#[tauri::command]
pub fn voz_estado(app: AppHandle, voz: State<Voz>, ia: State<IA>) -> EstadoVoz {
    let disponivel = ia::chave_da_chamada(&app, &ia).is_ok();
    match travar(&voz) {
        Ok(e) => EstadoVoz { disponivel, gravando: e.sessao.is_some(), erro: e.erro.clone() },
        Err(erro) => EstadoVoz { disponivel, gravando: false, erro: Some(erro) },
    }
}

/// Começa a gravação ao vivo, com o vocabulário do dia (nomes e termos das matérias e títulos dos objetivos).
#[tauri::command]
pub async fn voz_iniciar(app: AppHandle, voz: State<'_, Voz>, ia: State<'_, IA>, vocabulario: Vec<String>) -> Result<(), ErroIA> {
    let chave = ia::chave_da_chamada(&app, &ia)?;
    let (id, parada) = {
        let mut e = travar(&voz)?;
        if e.sessao.is_some() {
            return Ok(());
        }
        e.ultima += 1;
        let (parar, parada) = oneshot::channel();
        e.sessao = Some(Controle { id: e.ultima, parar });
        e.erro = None;
        (e.ultima, parada)
    };
    let inicio = Instant::now();
    match abrir(chave, vocabulario).await {
        Ok((socket, audio, gravacao)) => {
            tauri::async_runtime::spawn(conduzir(app, id, socket, audio, gravacao, parada));
            Ok(())
        }
        Err(erro) => {
            encerrar(&app, id, Some(erro.clone()));
            registrar(inicio, &nome_do_erro(&erro));
            Err(erro)
        }
    }
}

/// Para a gravação e devolve o texto final (VOZ-02). Sem gravação em andamento, devolve vazio.
#[tauri::command]
pub async fn voz_parar(voz: State<'_, Voz>) -> Result<String, ErroIA> {
    let Some(controle) = travar(&voz)?.sessao.take() else { return Ok(String::new()) };
    let (resposta, texto) = oneshot::channel();
    if controle.parar.send(Parada::Devolver(resposta)).is_err() {
        return Ok(String::new());
    }
    Ok(texto.await.unwrap_or_default())
}

/// Fecha a gravação sem devolver nada.
#[tauri::command]
pub fn voz_cancelar(voz: State<Voz>) {
    if let Some(controle) = voz.0.lock().ok().and_then(|mut e| e.sessao.take()) {
        let _ = controle.parar.send(Parada::Descartar);
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn reamostra_de_48_para_16_khz() {
        let entrada: Vec<f32> = (0..48_000).map(|i| (i % 3) as f32).collect();
        let saida = reamostrar(&entrada, 48_000);
        assert_eq!(saida.len(), 16_000);
        // Média de cada trio (0, 1, 2).
        assert!((saida[0] - 1.0).abs() < 1e-6);
    }

    #[test]
    fn reamostra_de_8_para_16_khz_interpolando() {
        let saida = reamostrar(&[0.0, 1.0], 8_000);
        assert_eq!(saida, vec![0.0, 0.5, 1.0, 1.0]);
    }

    #[test]
    fn amostras_viram_pcm_de_16_bits_little_endian() {
        // -1.0 → -32768 (0x8000), 0 → 0, 1.0 → 32767 (0x7FFF), cada um com o byte baixo primeiro.
        assert_eq!(para_pcm16(&[-1.0, 0.0, 1.0]), vec![0x00, 0x80, 0x00, 0x00, 0xFF, 0x7F]);
    }

    #[test]
    fn pedacos_de_100_ms_guardam_a_sobra() {
        let audio: Vec<u8> = (0..4_000).map(|i| (i % 251) as u8).collect();
        let mut pedacos = Pedacos::default();
        let prontos = pedacos.juntar(&audio);
        assert_eq!(prontos, vec![audio[..3_200].to_vec()]);
        assert_eq!(pedacos.guardados(), 800);
        // Os 800 bytes guardados abrem o próximo pedaço, antes do áudio novo.
        let mais = vec![7u8; 2_400];
        let prontos = pedacos.juntar(&mais);
        assert_eq!(prontos.len(), 1);
        assert_eq!(prontos[0][..800], audio[3_200..]);
        assert_eq!(prontos[0][800..], mais[..]);
        assert_eq!(pedacos.guardados(), 0);
    }

    #[test]
    fn setup_tem_o_modelo_o_portugues_e_ate_100_termos() {
        let termos: Vec<String> = (1..=150).map(|i| format!("termo{i}")).collect();
        let setup = mensagem_setup(&termos);
        assert_eq!(setup["setup"]["model"], "models/gemini-3.5-transcribe-live");
        assert_eq!(setup["setup"]["generationConfig"]["responseModalities"], json!(["TEXT"]));
        assert_eq!(setup["setup"]["inputAudioTranscription"]["languageCodes"], json!(["pt-BR"]));
        let vocabulario = setup["setup"]["inputAudioTranscription"]["customVocabulary"].as_array().unwrap();
        assert_eq!(vocabulario.len(), 100);
        assert_eq!(vocabulario[0], "termo1");
        assert_eq!(vocabulario[99], "termo100");
        // Com poucos termos, vão todos.
        let poucos = mensagem_setup(&["Rust".to_string(), "Blender".to_string()]);
        assert_eq!(poucos["setup"]["inputAudioTranscription"]["customVocabulary"], json!(["Rust", "Blender"]));
    }

    #[test]
    fn audio_vai_em_base64_e_o_fim_avisa_o_gemini() {
        assert_eq!(
            mensagem_audio(&[0x00, 0x80, 0xFF, 0x7F]),
            json!({ "realtimeInput": { "audio": { "data": "AID/fw==", "mimeType": "audio/pcm;rate=16000" } } })
        );
        assert_eq!(mensagem_fim(), json!({ "realtimeInput": { "audioStreamEnd": true } }));
    }

    #[test]
    fn mensagens_do_gemini_viram_texto_parcial_ou_final() {
        assert_eq!(
            ler_mensagem(r#"{"serverContent":{"interimInputTranscription":{"text":"hoje quero"}}}"#),
            Some(Transcricao::Parcial("hoje quero".into()))
        );
        assert_eq!(
            ler_mensagem(r#"{"serverContent":{"inputTranscription":{"text":"hoje quero estudar Blender"}}}"#),
            Some(Transcricao::Final("hoje quero estudar Blender".into()))
        );
    }

    #[test]
    fn outras_mensagens_do_gemini_sao_ignoradas() {
        assert_eq!(ler_mensagem(r#"{"setupComplete":{}}"#), None);
        assert_eq!(ler_mensagem(r#"{"serverContent":{"turnComplete":true}}"#), None);
        assert_eq!(ler_mensagem(r#"{"serverContent":{"inputTranscription":{}}}"#), None);
        assert_eq!(ler_mensagem("não é json"), None);
    }

    #[test]
    fn texto_junta_os_finais_e_troca_o_parcial() {
        let mut t = Transcrito::default();
        t.receber(Transcricao::Parcial("hoje".into()));
        assert_eq!(t.texto(), "hoje");
        // O parcial muda enquanto a pessoa fala.
        t.receber(Transcricao::Parcial("hoje quero".into()));
        assert_eq!(t.texto(), "hoje quero");
        // O final troca o parcial.
        t.receber(Transcricao::Final("Hoje quero estudar.".into()));
        assert_eq!(t.texto(), "Hoje quero estudar.");
        // O próximo parcial vem depois dos finais.
        t.receber(Transcricao::Parcial("Depois".into()));
        assert_eq!(t.texto(), "Hoje quero estudar. Depois");
        t.receber(Transcricao::Final(" Depois, Blender. ".into()));
        assert_eq!(t.texto(), "Hoje quero estudar. Depois, Blender.");
    }

    #[test]
    fn a_gravacao_acaba_aos_10_minutos_de_audio() {
        // 6.000 pedaços de 100 ms = 10 minutos.
        assert!(!chegou_ao_limite(BYTES_POR_PEDACO * 5_999));
        assert!(chegou_ao_limite(BYTES_POR_PEDACO * 6_000));
        assert!(chegou_ao_limite(BYTES_POR_PEDACO * 6_001));
    }

    #[test]
    fn a_queda_do_socket_mantem_o_texto_e_vira_erro_de_conexao() {
        let mut t = Transcrito::default();
        let sequencia = vec![
            Some(Ok(Message::text(r#"{"serverContent":{"interimInputTranscription":{"text":"hoje"}}}"#))),
            // O Gemini também manda o JSON em binário.
            Some(Ok(Message::binary(r#"{"serverContent":{"inputTranscription":{"text":"hoje quero estudar"}}}"#.as_bytes().to_vec()))),
            Some(Ok(Message::Ping(Vec::new().into()))),
            Some(Ok(Message::text(r#"{"serverContent":{"interimInputTranscription":{"text":"Blender"}}}"#))),
            None,
        ];
        let saidas: Vec<Option<ParaATela>> = sequencia.into_iter().map(|m| ao_receber(&mut t, m)).collect();
        assert_eq!(
            saidas,
            vec![
                Some(ParaATela::Parcial("hoje".into())),
                Some(ParaATela::Parcial("hoje quero estudar".into())),
                None,
                Some(ParaATela::Parcial("hoje quero estudar Blender".into())),
                Some(ParaATela::Erro(ErroIA::Conexao)),
            ]
        );
        assert_eq!(t.texto(), "hoje quero estudar Blender");
        // O `Close` do servidor e o erro de leitura também são queda, e o texto continua.
        assert_eq!(ao_receber(&mut t, Some(Ok(Message::Close(None)))), Some(ParaATela::Erro(ErroIA::Conexao)));
        assert_eq!(ao_receber(&mut t, Some(Err(ErroDoSocket::ConnectionClosed))), Some(ParaATela::Erro(ErroIA::Conexao)));
        assert_eq!(t.texto(), "hoje quero estudar Blender");
        // O evento `voz:erro` leva o tipo do erro, como os erros das análises.
        assert_eq!(json!(ErroIA::Conexao), json!({ "tipo": "Conexao" }));
    }
}
