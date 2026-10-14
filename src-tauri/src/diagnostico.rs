//! Logs, backup dos dados antes de converter de formato e o arquivo de diagnóstico que o piloto pode mandar.
//! Nada aqui registra títulos de janela, relatos ou anotações.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

/// Linhas do fim dos logs que entram no diagnóstico.
const LINHAS_DE_LOG: usize = 2000;

fn pasta_de_dados(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Um nome de arquivo simples, sem pasta (o front só manda `dados.json`).
fn nome_simples(nome: &str) -> bool {
    !nome.is_empty() && !nome.contains(['/', '\\']) && !nome.contains("..")
}

/// Copia o arquivo de dados para `<nome>.v<versao>.bak.json` antes de gravar no formato novo. Não sobrescreve
/// uma cópia que já exista (a primeira é a que vale para voltar de versão). Devolve o caminho da cópia.
#[tauri::command]
pub fn dados_backup(app: AppHandle, arquivo: String, versao: u32) -> Result<String, String> {
    if !nome_simples(&arquivo) {
        return Err("nome de arquivo inválido".into());
    }
    let pasta = pasta_de_dados(&app)?;
    let origem = pasta.join(&arquivo);
    let base = Path::new(&arquivo).file_stem().and_then(|s| s.to_str()).unwrap_or("dados");
    let destino = pasta.join(format!("{base}.v{versao}.bak.json"));
    if origem.exists() && !destino.exists() {
        std::fs::copy(&origem, &destino).map_err(|e| e.to_string())?;
        log::info!("migração: cópia do formato {versao} guardada");
    }
    Ok(destino.to_string_lossy().into_owned())
}

/// Evento do front no mesmo log do Rust (migração, tempo de gravação dos dados, transcrição).
#[tauri::command]
pub fn registrar_evento(nivel: String, evento: String, contexto: serde_json::Value) {
    match nivel.as_str() {
        "erro" => log::error!(target: "front", "{evento} {contexto}"),
        "aviso" => log::warn!(target: "front", "{evento} {contexto}"),
        _ => log::info!(target: "front", "{evento} {contexto}"),
    }
}

fn tamanho(caminho: &Path) -> String {
    std::fs::metadata(caminho).map_or_else(|_| "não existe".into(), |m| format!("{} bytes", m.len()))
}

/// As últimas linhas dos logs, do arquivo mais antigo para o mais novo.
fn fim_dos_logs(pasta: &Path) -> String {
    let Ok(entradas) = std::fs::read_dir(pasta) else { return "(sem logs)".into() };
    let mut arquivos: Vec<_> = entradas
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "log"))
        .filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path())))
        .collect();
    arquivos.sort();
    let linhas: Vec<String> = arquivos
        .iter()
        .flat_map(|(_, p)| std::fs::read_to_string(p).unwrap_or_default().lines().map(String::from).collect::<Vec<_>>())
        .collect();
    linhas[linhas.len().saturating_sub(LINHAS_DE_LOG)..].join("\n")
}

/// Gera um arquivo de texto com a versão, o sistema, o tamanho dos arquivos e o fim dos logs, sem conteúdo
/// pessoal. Fica na pasta de downloads (ou na de dados). Devolve o caminho.
#[tauri::command]
pub fn diagnostico_exportar(app: AppHandle) -> Result<String, String> {
    let dados = pasta_de_dados(&app)?;
    let logs = app.path().app_log_dir().map_err(|e| e.to_string())?;
    let imagens = std::fs::read_dir(dados.join("imagens")).map_or(0, |d| d.count());
    let texto = format!(
        "Proof of Study {}\nSistema: {} {}\nGerado em: {}\n\ndados.json: {}\nsessao-ativa.json: {}\nimagens: {imagens}\n\n--- Logs ---\n{}\n",
        app.package_info().version,
        std::env::consts::OS,
        std::env::consts::ARCH,
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
        tamanho(&dados.join("dados.json")),
        tamanho(&dados.join("sessao-ativa.json")),
        fim_dos_logs(&logs),
    );
    let destino = app.path().download_dir().unwrap_or(dados);
    let caminho = destino.join(format!("proof-of-study-diagnostico-{}.txt", chrono::Local::now().format("%Y%m%d-%H%M")));
    std::fs::write(&caminho, texto).map_err(|e| e.to_string())?;
    Ok(caminho.to_string_lossy().into_owned())
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn nome_de_arquivo_sem_pasta() {
        assert!(nome_simples("dados.json"));
        assert!(!nome_simples("../dados.json"));
        assert!(!nome_simples("pasta/dados.json"));
        assert!(!nome_simples("pasta\\dados.json"));
        assert!(!nome_simples(""));
    }
}
