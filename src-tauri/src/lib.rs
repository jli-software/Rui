mod decoration;
mod document;
mod omarchy;
mod quick_open;
mod settings;

#[cfg(desktop)]
use tauri::{Emitter, Manager};

use std::path::{Path, PathBuf};

/// Präfix, das `canonicalize` unter Windows an jeden Pfad hängt.
const WINDOWS_VERBATIM: &str = r"\\?\";

/// Dateipfade aus einer Kommandozeile herausfiltern.
///
/// Das erste Argument ist der Programmpfad, alles mit führendem `-` ist
/// ein Flag. Übrig bleibt, was der Nutzer öffnen wollte — egal ob aus dem
/// Terminal oder per Doppelklick im Explorer.
///
/// `cwd` muss das Arbeitsverzeichnis des Prozesses sein, von dem die
/// Argumente stammen. Bei einer zweiten Instanz ist das nicht das eigene:
/// `rui notiz.txt` aus einem beliebigen Ordner würde sonst gegen das
/// Verzeichnis der bereits laufenden Instanz aufgelöst und fände nichts.
fn file_args<I: IntoIterator<Item = String>>(argv: I, cwd: &Path) -> Vec<String> {
    argv.into_iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .filter_map(|a| resolve(&a, cwd))
        .collect()
}

fn resolve(arg: &str, cwd: &Path) -> Option<String> {
    let raw = Path::new(arg);
    let absolute = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        cwd.join(raw)
    };
    if !absolute.is_file() {
        return None;
    }

    // canonicalize löst Symlinks und `..` auf, hängt unter Windows aber
    // das Präfix für erweiterte Pfade an, das in Titelleiste und Dialogen
    // nur stört.
    let resolved = absolute.canonicalize().unwrap_or(absolute);
    let text = resolved.to_string_lossy().into_owned();
    Some(text.strip_prefix(WINDOWS_VERBATIM).unwrap_or(&text).to_string())
}

/// Dateien, mit denen die App gestartet wurde. Das Frontend holt sie ab,
/// sobald der Editor bereit ist.
#[tauri::command]
fn startup_files() -> Vec<String> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    file_args(std::env::args(), &cwd)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Ohne single-instance startet jeder Doppelklick auf eine .txt
        // eine weitere Kopie der App. Stattdessen: bestehendes Fenster
        // nach vorne holen und die Datei dort öffnen.
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let files = file_args(argv, Path::new(&cwd));
                if !files.is_empty() {
                    let _ = app.emit("rui://open-files", files);
                }
            }))
            // Fenstergrösse und -position über Neustarts hinweg behalten.
            .plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .setup(|app| {
            // Das Fenster startet unsichtbar, damit man kein weisses
            // Aufblitzen sieht; normalerweise zeigt es das Frontend selbst.
            // Bleibt das aus — etwa weil das Webview gar nicht erst lädt —
            // erscheint es hier trotzdem, statt die App unsichtbar zu lassen.
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    if let Some(window) = handle.get_webview_window("main") {
                        if !window.is_visible().unwrap_or(true) {
                            let _ = window.show();
                        }
                    }
                });

                // Vor dem ersten Anzeigen entscheiden, ob das Fenster die
                // native Titelleiste bekommt — alles andere (eigene
                // Titelleiste unter Windows, gar keine unter Hyprland) zieht
                // das Frontend über `resolve_decoration` selbst nach.
                if let Some(window) = app.get_webview_window("main") {
                    let settings = settings::load_settings(app.handle().clone()).unwrap_or_default();
                    let resolved = decoration::resolve(settings.decoration_mode);
                    let _ = window.set_decorations(resolved.native_chrome());
                }

                omarchy::watch(app.handle().clone());
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            startup_files,
            document::open_file,
            document::save_file,
            document::save_note,
            document::file_mtime,
            quick_open::list_note_files,
            settings::load_settings,
            settings::save_settings,
            settings::settings_path,
            settings::load_session,
            settings::save_session,
            decoration::resolve_decoration,
            omarchy::omarchy_available,
            omarchy::load_omarchy_theme,
        ])
        .run(tauri::generate_context!())
        .expect("Rui konnte nicht gestartet werden");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_und_programmpfad_werden_ignoriert() {
        let cwd = std::env::current_dir().unwrap();
        let argv = vec![
            "rui.exe".to_string(),
            "--debug".to_string(),
            "gibt-es-nicht.txt".to_string(),
        ];
        // Nur existierende Dateien überleben den Filter.
        assert!(file_args(argv, &cwd).is_empty());
    }

    #[test]
    fn relative_pfade_gelten_gegen_das_uebergebene_verzeichnis() {
        // Cargo.toml liegt im Crate-Wurzelverzeichnis.
        let cwd = Path::new(env!("CARGO_MANIFEST_DIR"));
        let argv = vec!["rui.exe".to_string(), "Cargo.toml".to_string()];

        let found = file_args(argv.clone(), cwd);
        assert_eq!(found.len(), 1, "relativer Pfad muss gefunden werden");
        assert!(Path::new(&found[0]).is_absolute(), "Ergebnis muss absolut sein");
        assert!(
            !found[0].starts_with(WINDOWS_VERBATIM),
            "Pfad darf kein Verbatim-Präfix tragen"
        );

        // Dasselbe Argument aus einem anderen Verzeichnis findet nichts.
        assert!(file_args(argv, Path::new(env!("CARGO_MANIFEST_DIR")).join("src").as_path()).is_empty());
    }
}
