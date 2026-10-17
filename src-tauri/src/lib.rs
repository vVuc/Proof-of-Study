mod diagnostico;
mod ia;
mod imagens;
mod janela;
mod lembretes;
mod rastreador;
mod voz;

use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_notification::NotificationExt;

pub(crate) fn mostrar_janela(app: &AppHandle) {
    if let Some(janela) = app.get_webview_window("main") {
        let _ = janela.show();
        let _ = janela.unminimize();
        let _ = janela.set_focus();
    }
}

pub(crate) fn notificar(app: &AppHandle, titulo: &str, corpo: &str) {
    if let Err(erro) = app.notification().builder().title(titulo).body(corpo).show() {
        log::warn!("notificação não enviada: {erro}");
    }
}

/// Play ou pausa da sessão do dia sem abrir a janela (bandeja e atalho global). Se o front ainda não mandou a
/// configuração, abre a janela para a pessoa dar play por lá.
fn alternar_sessao(app: &AppHandle) {
    if !app.state::<rastreador::Rastreador>().alternar() {
        mostrar_janela(app);
    }
}

fn criar_bandeja(app: &AppHandle) -> tauri::Result<()> {
    let abrir = MenuItem::with_id(app, "abrir", "Abrir", true, None::<&str>)?;
    let alternar = MenuItem::with_id(app, "alternar", "Play / pausa do dia", true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &alternar, &sair])?;

    let mut bandeja = TrayIconBuilder::with_id("principal")
        .tooltip("Proof of Study")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| match evento.id.as_ref() {
            "abrir" => mostrar_janela(app),
            "alternar" => alternar_sessao(app),
            "sair" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|icone, evento| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                mostrar_janela(icone.app_handle());
            }
        });
    if let Some(icone) = app.default_window_icon() {
        bandeja = bandeja.icon(icone.clone());
    }
    bandeja.build(app)?;
    Ok(())
}

/// Um segundo por volta: lê a janela ativa (se houver sessão) e confere os lembretes.
fn iniciar_relogio(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(1));
            rastreador::tick(&app);
            lembretes::tick(&app);
        }
    });
}

/// Registra (ou tira, com `None`) o atalho global de play/pause, como "CommandOrControl+Shift+Space".
#[tauri::command]
fn atalho_definir(app: AppHandle, teclas: Option<String>) -> Result<(), String> {
    let atalhos = app.global_shortcut();
    atalhos.unregister_all().map_err(|e| e.to_string())?;
    if let Some(teclas) = teclas.filter(|t| !t.trim().is_empty()) {
        atalhos.register(teclas.as_str()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Log em arquivo, com rotação, um evento JSON por linha. Em debug, também no terminal.
fn plugin_de_log() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    let mut log = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::LogDir { file_name: Some("proof-of-study".into()) }))
        .max_file_size(1_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .level(log::LevelFilter::Info)
        .format(|saida, mensagem, registro| {
            let texto = serde_json::to_string(&mensagem.to_string()).unwrap_or_default();
            saida.finish(format_args!(
                "{{\"nivel\":\"{}\",\"quando\":\"{}\",\"alvo\":\"{}\",\"mensagem\":{texto}}}",
                registro.level().as_str().to_lowercase(),
                chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%:z"),
                registro.target(),
            ))
        });
    if cfg!(debug_assertions) {
        log = log.target(Target::new(TargetKind::Stdout));
    }
    log.build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Uma instância só: abrir o app de novo traz a janela que está na bandeja. Precisa ser o primeiro plugin.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| mostrar_janela(app)))
        .plugin(plugin_de_log())
        .plugin(tauri_plugin_notification::init())
        // Dados do app num arquivo JSON na pasta de dados do usuário.
        .plugin(tauri_plugin_store::Builder::new().build())
        // Iniciar com o sistema (desligado até a pessoa ligar nas opções).
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _atalho, evento| {
                    if evento.state() == ShortcutState::Pressed {
                        alternar_sessao(app);
                    }
                })
                .build(),
        )
        .manage(rastreador::Rastreador::new())
        .manage(lembretes::Lembretes::default())
        .manage(voz::Voz::default())
        .invoke_handler(tauri::generate_handler![
            rastreador::sessao_configurar,
            rastreador::sessao_play,
            rastreador::sessao_pausar,
            rastreador::sessao_captura,
            rastreador::sessao_fechar,
            rastreador::sessao_confirmar,
            rastreador::sessao_recuperacao_vista,
            rastreador::sessao_estado,
            lembretes::lembretes_definir,
            lembretes::aviso_agendar,
            lembretes::aviso_cancelar,
            imagens::imagens_pasta,
            imagens::imagem_salvar,
            imagens::imagem_excluir,
            diagnostico::dados_backup,
            diagnostico::registrar_evento,
            diagnostico::diagnostico_exportar,
            voz::voz_estado,
            voz::voz_modelo_info,
            voz::voz_modelo_baixar,
            voz::voz_gravar,
            voz::voz_parar,
            voz::voz_cancelar,
            atalho_definir,
        ])
        // Fechar a janela só a esconde na bandeja: a sessão do dia e os lembretes continuam.
        .on_window_event(|janela, evento| {
            if let WindowEvent::CloseRequested { api, .. } = evento {
                api.prevent_close();
                let _ = janela.hide();
            }
        })
        .setup(|app| {
            log::info!("app aberto: versão {}", app.package_info().version);
            // Recupera a sessão do dia antes do relógio começar.
            let diario = app.path().app_data_dir()?.join("sessao-ativa.json");
            app.state::<rastreador::Rastreador>().carregar(diario);
            criar_bandeja(app.handle())?;
            iniciar_relogio(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
