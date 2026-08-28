//! Einstellungen und Sitzungswiederherstellung.
//!
//! Grundsatz: Die Defaults leben hier im Code, nicht in der JSON-Datei.
//! Gespeichert wird nur, was der Nutzer tatsächlich angefasst hat, und
//! jedes Feld ist `#[serde(default)]`. Dadurch bekommen bestehende
//! Installationen neue Optionen automatisch, statt an einer veralteten
//! Config-Datei zu ersticken.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::decoration::DecorationMode;
use crate::document::LineEnding;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Theme {
    SageLight,
    SageDark,
    System,
}

impl Default for Theme {
    fn default() -> Self {
        Theme::System
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteExtension {
    Md,
    Txt,
}

impl Default for NoteExtension {
    fn default() -> Self {
        NoteExtension::Md
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    // --- Darstellung ---
    pub theme: Theme,
    pub font_family: String,
    pub font_size: u8,
    pub line_height: f32,
    /// `auto` erkennt Windows/Tiling-Compositor/normalen Linux-Desktop von
    /// selbst; siehe `decoration.rs`.
    pub decoration_mode: DecorationMode,
    pub line_numbers: bool,
    pub relative_line_numbers: bool,
    pub highlight_active_line: bool,
    pub show_whitespace: bool,
    pub word_wrap: bool,
    pub syntax_highlighting: bool,

    // --- Eingabe ---
    pub tab_size: u8,
    /// Tab-Taste fügt Leerzeichen statt eines Tabulators ein.
    pub insert_spaces: bool,
    pub auto_indent: bool,
    pub bracket_matching: bool,
    /// Schliessende Klammer/Anführungszeichen automatisch ergänzen.
    pub close_brackets: bool,

    // --- Beim Speichern ---
    /// Leerzeichen am Zeilenende entfernen. Praktisch, aber es verändert
    /// Zeilen, die man gar nicht angefasst hat — deshalb abschaltbar.
    pub trim_trailing_whitespace: bool,
    pub ensure_final_newline: bool,
    pub default_encoding: String,
    pub default_line_ending: LineEnding,

    // --- Verhalten ---
    /// Ungespeicherte Puffer und die zuletzt offene Datei überleben den
    /// Neustart.
    pub restore_session: bool,
    /// Änderungen an der offenen Datei durch andere Programme melden.
    pub watch_external_changes: bool,
    pub confirm_on_close: bool,

    // --- Notizen ---
    /// Ist ein Ordner gesetzt, speichert Rui jeden offenen Puffer laufend
    /// selbst — ganz ohne Strg+S. Neue, noch namenlose Notizen werden aus
    /// ihrer ersten Zeile benannt und landen automatisch in diesem Ordner.
    pub notes_folder: Option<String>,
    pub note_extension: NoteExtension,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            decoration_mode: DecorationMode::Auto,
            font_family: default_mono_stack(),
            font_size: 14,
            line_height: 1.5,
            line_numbers: true,
            relative_line_numbers: false,
            highlight_active_line: true,
            show_whitespace: false,
            word_wrap: false,
            syntax_highlighting: true,

            tab_size: 4,
            insert_spaces: true,
            auto_indent: true,
            bracket_matching: true,
            close_brackets: true,

            trim_trailing_whitespace: false,
            ensure_final_newline: false,
            default_encoding: "UTF-8".to_string(),
            default_line_ending: LineEnding::platform_default(),

            restore_session: true,
            watch_external_changes: true,
            confirm_on_close: true,

            notes_folder: None,
            note_extension: NoteExtension::Md,
        }
    }
}

fn default_mono_stack() -> String {
    // Plattform-übliche Monospace-Schriften zuerst, damit die App auf
    // jedem System vertraut aussieht statt überall gleich fremd.
    "\"Cascadia Code\", \"JetBrains Mono\", \"SF Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", monospace"
        .to_string()
}

/// Zustand eines Puffers zwischen zwei Programmstarts.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Session {
    pub path: Option<String>,
    /// Nur gesetzt, wenn beim Beenden ungespeicherte Änderungen offen waren.
    pub unsaved_content: Option<String>,
    pub cursor: usize,
    pub scroll_top: f64,
    pub encoding: Option<String>,
    pub line_ending: Option<LineEnding>,
    pub bom: bool,
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Kein Konfigurationsverzeichnis: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    Ok(dir)
}

fn read_json<T: Default + for<'de> Deserialize<'de>>(path: &PathBuf) -> T {
    // Eine kaputte oder fehlende Datei darf den Start nicht verhindern.
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("{}: {e}", path.display()))
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Settings, String> {
    Ok(read_json(&config_dir(&app)?.join("settings.json")))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    write_json(&config_dir(&app)?.join("settings.json"), &settings)
}

#[tauri::command]
pub fn settings_path(app: AppHandle) -> Result<String, String> {
    Ok(config_dir(&app)?
        .join("settings.json")
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
pub fn load_session(app: AppHandle) -> Result<Session, String> {
    Ok(read_json(&config_dir(&app)?.join("session.json")))
}

#[tauri::command]
pub fn save_session(app: AppHandle, session: Session) -> Result<(), String> {
    write_json(&config_dir(&app)?.join("session.json"), &session)
}
