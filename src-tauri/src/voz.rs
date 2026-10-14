//! Voz transcrita no PC: grava o microfone e transcreve com o Whisper (whisper.cpp), tudo local. O modelo é
//! baixado uma vez, com o consentimento da pessoa, e conferido pelo SHA-256. O áudio fica só na memória e é
//! descartado logo depois da transcrição.
//!
//! A voz é um recurso opcional de compilação (`voz`). Sem ele, os comandos existem, mas dizem que a voz está
//! indisponível, e o relato continua só com texto.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// Um modelo do Whisper que o app sabe baixar. Origem, tamanho e hash ficam fixos aqui.
#[derive(Clone, Copy, Debug)]
pub struct Modelo {
    pub nome: &'static str,
    pub arquivo: &'static str,
    pub bytes: u64,
    #[cfg_attr(not(feature = "voz"), allow(dead_code))]
    pub sha256: &'static str,
}

/// Quantizados em q5_1: o "base" é leve; o "small" erra menos em português e pede mais CPU.
pub const MODELOS: [Modelo; 2] = [
    Modelo {
        nome: "base",
        arquivo: "ggml-base-q5_1.bin",
        bytes: 59_707_625,
        sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
    },
    Modelo {
        nome: "small",
        arquivo: "ggml-small-q5_1.bin",
        bytes: 190_085_487,
        sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
    },
];

pub const ORIGEM: &str = "huggingface.co";
#[cfg_attr(not(feature = "voz"), allow(dead_code))]
const URL_BASE: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/";

fn modelo(nome: &str) -> Result<Modelo, String> {
    MODELOS.iter().copied().find(|m| m.nome == nome).ok_or_else(|| format!("modelo desconhecido: {nome}"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoVoz {
    disponivel: bool,
    /// `ausente`, `baixando` ou `pronto`.
    modelo: &'static str,
    progresso: f64,
    gravando: bool,
    transcrevendo: bool,
    erro: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoDoModelo {
    nome: String,
    mb: u64,
    origem: String,
}

#[derive(Default)]
struct Interno {
    /// Modelo sendo baixado e o progresso (0 a 1).
    baixando: Option<(String, f64)>,
    transcrevendo: bool,
    erro: Option<String>,
    #[cfg(feature = "voz")]
    gravacao: Option<imp::Gravacao>,
    /// O modelo carregado fica na memória entre um relato e outro (carregar leva alguns segundos).
    #[cfg(feature = "voz")]
    contexto: Option<(String, std::sync::Arc<whisper_rs::WhisperContext>)>,
}

#[derive(Default)]
pub struct Voz(Mutex<Interno>);

fn pasta_dos_modelos(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("modelos"))
}

#[tauri::command]
pub fn voz_estado(app: AppHandle, voz: State<Voz>, modelo: String) -> EstadoVoz {
    let pronto = self::modelo(&modelo)
        .ok()
        .and_then(|m| pasta_dos_modelos(&app).ok().map(|p| p.join(m.arquivo)))
        .is_some_and(|p| p.exists());
    let Ok(e) = voz.0.lock() else {
        return EstadoVoz { disponivel: false, modelo: "ausente", progresso: 0.0, gravando: false, transcrevendo: false, erro: None };
    };
    let baixando = e.baixando.as_ref().filter(|(nome, _)| *nome == modelo);
    #[cfg(feature = "voz")]
    let gravando = e.gravacao.is_some();
    #[cfg(not(feature = "voz"))]
    let gravando = false;
    EstadoVoz {
        disponivel: cfg!(feature = "voz"),
        modelo: if baixando.is_some() {
            "baixando"
        } else if pronto {
            "pronto"
        } else {
            "ausente"
        },
        progresso: baixando.map_or(0.0, |(_, p)| *p),
        gravando,
        transcrevendo: e.transcrevendo,
        erro: e.erro.clone(),
    }
}

#[tauri::command]
pub fn voz_modelo_info(modelo: String) -> Result<InfoDoModelo, String> {
    let m = self::modelo(&modelo)?;
    Ok(InfoDoModelo { nome: m.nome.into(), mb: m.bytes.div_ceil(1_000_000), origem: ORIGEM.into() })
}

#[cfg(not(feature = "voz"))]
mod sem_voz {
    const INDISPONIVEL: &str = "voz indisponível nesta versão do app";

    #[tauri::command]
    pub fn voz_modelo_baixar(_modelo: String) -> Result<(), String> {
        Err(INDISPONIVEL.into())
    }

    #[tauri::command]
    pub fn voz_gravar() -> Result<(), String> {
        Err(INDISPONIVEL.into())
    }

    #[tauri::command]
    pub fn voz_parar(_modelo: String) -> Result<String, String> {
        Err(INDISPONIVEL.into())
    }

    #[tauri::command]
    pub fn voz_cancelar() {}
}
#[cfg(not(feature = "voz"))]
pub use sem_voz::*;

// Glob: o Tauri precisa também dos itens que a macro #[tauri::command] gera ao lado de cada comando.
#[cfg(feature = "voz")]
pub use imp::*;

#[cfg(feature = "voz")]
mod imp {
    use std::io::{Read, Write};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use sha2::{Digest, Sha256};
    use tauri::{AppHandle, Manager, State};
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    use super::{Modelo, URL_BASE, Voz, modelo, pasta_dos_modelos};

    /// Depois disso, a gravação para sozinha: um relato não precisa de mais.
    const GRAVACAO_MAXIMA_SEG: u64 = 5 * 60;
    /// O Whisper trabalha com áudio mono a 16 kHz.
    const TAXA_WHISPER: u32 = 16_000;

    pub struct Gravacao {
        parar: Arc<AtomicBool>,
        amostras: Arc<Mutex<Vec<f32>>>,
        taxa: u32,
        linha: Option<std::thread::JoinHandle<()>>,
    }

    impl Gravacao {
        /// Para o microfone e devolve o áudio mono e a taxa dele.
        fn encerrar(mut self) -> (Vec<f32>, u32) {
            self.parar.store(true, Ordering::Relaxed);
            if let Some(linha) = self.linha.take() {
                let _ = linha.join();
            }
            let amostras = self.amostras.lock().map(|mut a| std::mem::take(&mut *a)).unwrap_or_default();
            (amostras, self.taxa)
        }
    }

    fn construir<T>(
        dispositivo: &cpal::Device,
        config: &cpal::StreamConfig,
        canais: usize,
        destino: Arc<Mutex<Vec<f32>>>,
        limite: usize,
    ) -> Result<cpal::Stream, String>
    where
        T: cpal::SizedSample,
        f32: cpal::FromSample<T>,
    {
        dispositivo
            .build_input_stream::<T, _, _>(
                *config,
                move |dados: &[T], _| {
                    let Ok(mut v) = destino.lock() else { return };
                    if v.len() >= limite {
                        return;
                    }
                    // Junta os canais num só (média), já na chegada: metade da memória para o estéreo.
                    for quadro in dados.chunks(canais.max(1)) {
                        let soma: f32 = quadro.iter().map(|s| cpal::Sample::to_sample::<f32>(*s)).sum();
                        v.push(soma / quadro.len() as f32);
                    }
                },
                |erro| log::warn!("erro no microfone: {erro}"),
                None,
            )
            .map_err(|e| format!("não deu para abrir o microfone: {e}"))
    }

    /// Abre o microfone padrão numa thread própria (o stream do áudio não pode trocar de thread).
    fn gravar() -> Result<Gravacao, String> {
        let parar = Arc::new(AtomicBool::new(false));
        let amostras = Arc::new(Mutex::new(Vec::new()));
        let (pronto, aviso) = std::sync::mpsc::channel::<Result<u32, String>>();
        let (sinal, destino) = (parar.clone(), amostras.clone());
        let linha = std::thread::spawn(move || {
            let abrir = || -> Result<(cpal::Stream, u32), String> {
                let dispositivo = cpal::default_host().default_input_device().ok_or("nenhum microfone encontrado")?;
                let suportada = dispositivo.default_input_config().map_err(|e| format!("microfone indisponível: {e}"))?;
                let taxa = suportada.sample_rate();
                let canais = usize::from(suportada.channels());
                let formato = suportada.sample_format();
                let config: cpal::StreamConfig = suportada.into();
                let limite = (u64::from(taxa) * GRAVACAO_MAXIMA_SEG) as usize;
                let stream = match formato {
                    cpal::SampleFormat::F32 => construir::<f32>(&dispositivo, &config, canais, destino.clone(), limite),
                    cpal::SampleFormat::I16 => construir::<i16>(&dispositivo, &config, canais, destino.clone(), limite),
                    cpal::SampleFormat::U16 => construir::<u16>(&dispositivo, &config, canais, destino.clone(), limite),
                    cpal::SampleFormat::I32 => construir::<i32>(&dispositivo, &config, canais, destino.clone(), limite),
                    outro => Err(format!("formato de áudio não suportado: {outro}")),
                }?;
                stream.play().map_err(|e| format!("não deu para gravar: {e}"))?;
                Ok((stream, taxa))
            };
            match abrir() {
                Ok((stream, taxa)) => {
                    let _ = pronto.send(Ok(taxa));
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
        let taxa = aviso.recv_timeout(Duration::from_secs(5)).map_err(|_| "o microfone não respondeu".to_string())??;
        Ok(Gravacao { parar, amostras, taxa, linha: Some(linha) })
    }

    /// Passa o áudio para 16 kHz. Ao reduzir, cada amostra nova é a média do trecho que ela cobre (um filtro
    /// passa-baixa simples, suficiente para fala).
    pub fn reamostrar(entrada: &[f32], taxa: u32) -> Vec<f32> {
        if taxa == TAXA_WHISPER || entrada.is_empty() {
            return entrada.to_vec();
        }
        let razao = f64::from(taxa) / f64::from(TAXA_WHISPER);
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

    fn carregar_contexto(app: &AppHandle, m: Modelo) -> Result<Arc<WhisperContext>, String> {
        let voz = app.state::<Voz>();
        if let Ok(e) = voz.0.lock()
            && let Some((nome, contexto)) = &e.contexto
                && nome == m.nome {
                    return Ok(contexto.clone());
                }
        let caminho = pasta_dos_modelos(app)?.join(m.arquivo);
        if !caminho.exists() {
            return Err("o modelo de voz ainda não foi baixado".into());
        }
        let contexto = Arc::new(
            WhisperContext::new_with_params(&caminho, WhisperContextParameters::default())
                .map_err(|e| format!("o modelo de voz não abriu: {e}"))?,
        );
        if let Ok(mut e) = voz.0.lock() {
            e.contexto = Some((m.nome.to_string(), contexto.clone()));
        }
        Ok(contexto)
    }

    fn transcrever(contexto: &WhisperContext, audio: &[f32]) -> Result<String, String> {
        let mut estado = contexto.create_state().map_err(|e| format!("transcrição falhou: {e}"))?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("pt"));
        params.set_n_threads(std::thread::available_parallelism().map_or(4, |n| n.get().min(8)) as i32);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);
        params.set_no_context(true);
        params.set_suppress_blank(true);
        estado.full(params, audio).map_err(|e| format!("transcrição falhou: {e}"))?;
        let texto: Vec<String> = estado.as_iter().filter_map(|s| s.to_str_lossy().ok().map(|t| t.into_owned())).collect();
        Ok(texto.join("").trim().to_string())
    }

    #[tauri::command]
    pub fn voz_gravar(voz: State<Voz>) -> Result<(), String> {
        let mut e = voz.0.lock().map_err(|_| "voz ocupada".to_string())?;
        if e.gravacao.is_some() {
            return Ok(());
        }
        e.erro = None;
        match gravar() {
            Ok(g) => {
                e.gravacao = Some(g);
                log::info!("voz: gravando");
                Ok(())
            }
            Err(erro) => {
                e.erro = Some(erro.clone());
                log::warn!("voz: microfone indisponível");
                Err(erro)
            }
        }
    }

    /// Para a gravação e devolve o texto. A transcrição roda fora da thread da interface.
    #[tauri::command]
    pub async fn voz_parar(app: AppHandle, modelo: String) -> Result<String, String> {
        let m = self::modelo(&modelo)?;
        let gravacao = {
            let voz = app.state::<Voz>();
            let mut e = voz.0.lock().map_err(|_| "voz ocupada".to_string())?;
            e.transcrevendo = true;
            e.gravacao.take()
        };
        let resultado = match gravacao {
            None => Ok(String::new()),
            Some(g) => {
                let app = app.clone();
                tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
                    let (bruto, taxa) = g.encerrar();
                    let mut audio = reamostrar(&bruto, taxa);
                    drop(bruto);
                    if audio.len() < (TAXA_WHISPER / 3) as usize {
                        return Ok(String::new());
                    }
                    // O Whisper pede pelo menos um segundo de áudio.
                    audio.resize(audio.len().max(TAXA_WHISPER as usize + TAXA_WHISPER as usize / 10), 0.0);
                    let duracao_ms = audio.len() as u64 * 1000 / u64::from(TAXA_WHISPER);
                    let inicio = Instant::now();
                    let contexto = carregar_contexto(&app, m)?;
                    let texto = transcrever(&contexto, &audio);
                    log::info!(
                        "voz.transcricao: {} ms de áudio em {} ms, modelo {}",
                        duracao_ms,
                        inicio.elapsed().as_millis(),
                        m.nome
                    );
                    texto
                })
                .await
                .map_err(|e| e.to_string())?
            }
        };
        if let Ok(mut e) = app.state::<Voz>().0.lock() {
            e.transcrevendo = false;
            e.erro = resultado.as_ref().err().cloned();
        }
        resultado
    }

    #[tauri::command]
    pub fn voz_cancelar(voz: State<Voz>) {
        let gravacao = voz.0.lock().ok().and_then(|mut e| e.gravacao.take());
        if let Some(g) = gravacao {
            // O áudio é descartado sem transcrever.
            let _ = g.encerrar();
        }
    }

    /// Baixa o modelo numa thread, conferindo o SHA-256 no caminho. Um arquivo que não confere é apagado.
    #[tauri::command]
    pub fn voz_modelo_baixar(app: AppHandle, voz: State<Voz>, modelo: String) -> Result<(), String> {
        let m = self::modelo(&modelo)?;
        let destino = pasta_dos_modelos(&app)?.join(m.arquivo);
        {
            let mut e = voz.0.lock().map_err(|_| "voz ocupada".to_string())?;
            if e.baixando.is_some() || destino.exists() {
                return Ok(());
            }
            e.baixando = Some((m.nome.into(), 0.0));
            e.erro = None;
        }
        std::thread::spawn(move || {
            let inicio = Instant::now();
            let resultado = baixar(&app, m, &destino);
            match &resultado {
                Ok(()) => log::info!("voz: modelo {} baixado em {} s", m.nome, inicio.elapsed().as_secs()),
                Err(erro) => log::warn!("voz: download do modelo falhou: {erro}"),
            }
            if let Ok(mut e) = app.state::<Voz>().0.lock() {
                e.baixando = None;
                e.erro = resultado.err();
            }
        });
        Ok(())
    }

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    fn baixar(app: &AppHandle, m: Modelo, destino: &PathBuf) -> Result<(), String> {
        let pasta = destino.parent().ok_or("pasta inválida")?;
        std::fs::create_dir_all(pasta).map_err(|e| e.to_string())?;
        let parcial = destino.with_extension("bin.part");
        let mut resposta = ureq::get(format!("{URL_BASE}{}", m.arquivo))
            .call()
            .map_err(|e| format!("não deu para baixar o modelo: {e}"))?;
        let total = resposta.body().content_length().unwrap_or(m.bytes).max(1);
        let mut leitor = resposta.body_mut().as_reader();
        let mut arquivo = std::fs::File::create(&parcial).map_err(|e| e.to_string())?;
        let mut hash = Sha256::new();
        let mut buffer = vec![0u8; 64 * 1024];
        let mut lidos: u64 = 0;
        let mut avisado = Instant::now();
        loop {
            let n = leitor.read(&mut buffer).map_err(|e| format!("o download parou: {e}"))?;
            if n == 0 {
                break;
            }
            arquivo.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            hash.update(&buffer[..n]);
            lidos += n as u64;
            if avisado.elapsed() >= Duration::from_millis(200) {
                avisado = Instant::now();
                if let Ok(mut e) = app.state::<Voz>().0.lock() {
                    e.baixando = Some((m.nome.into(), lidos as f64 / total as f64));
                }
            }
        }
        arquivo.flush().map_err(|e| e.to_string())?;
        drop(arquivo);
        if hex(&hash.finalize()) != m.sha256 {
            let _ = std::fs::remove_file(&parcial);
            return Err("o arquivo baixado não confere com o esperado e foi apagado".into());
        }
        std::fs::rename(&parcial, destino).map_err(|e| e.to_string())?;
        Ok(())
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
        fn hex_do_hash() {
            assert_eq!(hex(&[0x0a, 0xff]), "0aff");
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn modelos_conhecidos() {
        assert_eq!(modelo("base").unwrap().arquivo, "ggml-base-q5_1.bin");
        assert!(modelo("enorme").is_err());
        assert_eq!(voz_modelo_info("small".into()).unwrap().mb, 191);
    }
}
