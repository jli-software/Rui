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

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Theme {
    SageLight,
    SageDark,
    #[default]
    System,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteExtension {
    #[default]
    Md,
    Txt,
}

/// Vorgaben statt eines freien Musters: ein vertippter Formatstring würde
/// still danebenliegende Dateinamen erzeugen, und ein Dateiname lässt sich
/// nicht so leicht zurücknehmen wie eine Anzeige.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NoteDateFormat {
    /// 2026-08-28
    Ymd,
    /// Der Standard: mit Uhrzeit, weil das Datum vor allem für namenlose
    /// Notizen einspringt — ohne sie hiessen zwei am selben Tag gleich.
    ///
    /// 2026-08-28 1423
    #[default]
    YmdHm,
    /// 20260828
    YmdCompact,
    /// 20260828-1423
    YmdCompactHm,
    /// 28.08.2026
    Dmy,
}

impl NoteDateFormat {
    /// Das zugehörige chrono-Muster.
    pub fn pattern(self) -> &'static str {
        match self {
            NoteDateFormat::Ymd => "%Y-%m-%d",
            NoteDateFormat::YmdHm => "%Y-%m-%d %H%M",
            NoteDateFormat::YmdCompact => "%Y%m%d",
            NoteDateFormat::YmdCompactHm => "%Y%m%d-%H%M",
            NoteDateFormat::Dmy => "%d.%m.%Y",
        }
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
    /// Vim-Steuerung. Standardmässig aus: Rui soll für alle, die damit
    /// nichts anfangen können, ein gewöhnlicher Editor bleiben — wer sie
    /// nie einschaltet, lädt das Vim-Paket auch nie.
    pub vim_mode: bool,

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

    // --- Speichern ---
    /// Schreibt den Puffer nach jeder Änderung von selbst zurück.
    ///
    /// **Standardmässig aus, und das ist die wichtigste Vorgabe dieser
    /// Datei.** Wer ein PowerShell-Profil oder eine Konfiguration nur
    /// nachschlagen will, tippt beim Scrollen leicht ein Zeichen hinein —
    /// mit Autosave stünde es sofort auf der Platte. Ein Editor, dem man
    /// beim Lesen nicht trauen kann, ist als Editor unbrauchbar.
    /// Gespeichert wird deshalb von Hand: Strg+S oder `:w`.
    pub autosave: bool,
    /// Wartezeit nach dem letzten Tastendruck, bevor Autosave zuschlägt.
    /// Nur wirksam, wenn `autosave` an ist.
    pub autosave_delay_ms: u32,

    // --- Notizen ---
    /// Wohin ein namenloser Puffer kommt, wenn er ohne Dateidialog
    /// gespeichert wird. Ist keiner gesetzt, fragt Rui nach dem Ort.
    ///
    /// Löst kein Autosave mehr aus: Notizen-Ordner und Autosave sind zwei
    /// verschiedene Fragen, und sie zu koppeln hat aus jedem geöffneten
    /// Script eine Notiz gemacht.
    pub notes_folder: Option<String>,
    pub note_extension: NoteExtension,
    pub note_date_format: NoteDateFormat,

    // --- Quick Open ---
    /// Weitere Ordner, die `Strg+O` neben dem Notizen-Ordner durchsucht.
    /// Für Scripts und Logs, die nicht bei den Notizen liegen.
    pub search_folders: Vec<String>,
    /// Den Ordner der gerade offenen Datei mitdurchsuchen.
    ///
    /// Standardmässig an: Wer eine Logdatei von Hand geöffnet hat, will als
    /// Nächstes fast immer eine daneben — und der Ordner ist bekannt, ohne
    /// dass ihn jemand einstellen müsste.
    pub search_open_file_folder: bool,
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
            vim_mode: false,

            trim_trailing_whitespace: false,
            ensure_final_newline: false,
            default_encoding: "UTF-8".to_string(),
            default_line_ending: LineEnding::platform_default(),

            restore_session: true,
            watch_external_changes: true,
            confirm_on_close: true,

            autosave: false,
            autosave_delay_ms: 500,

            notes_folder: None,
            note_extension: NoteExtension::Md,
            note_date_format: NoteDateFormat::YmdHm,

            search_folders: Vec::new(),
            search_open_file_folder: true,
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
    /// Entstehungszeit des Puffers (Epoche in ms). Ohne sie bekäme ein
    /// gestern angelegter, noch namenloser Puffer nach dem Neustart das
    /// heutige Datum in den Dateinamen.
    pub created_at_ms: Option<i64>,
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

#[cfg(test)]
mod tests {
    use super::*;

    /// `types.ts` spiegelt diese Namen von Hand. Weicht einer ab, merkt man
    /// es sonst erst zur Laufzeit — und dann still, weil `#[serde(default)]`
    /// klaglos den Standardwert einsetzt statt zu meckern.
    #[test]
    fn enum_namen_stimmen_mit_dem_frontend_ueberein() {
        assert_eq!(name(&NoteDateFormat::Ymd), "ymd");
        assert_eq!(name(&NoteDateFormat::YmdHm), "ymd-hm");
        assert_eq!(name(&NoteDateFormat::YmdCompact), "ymd-compact");
        assert_eq!(name(&NoteDateFormat::YmdCompactHm), "ymd-compact-hm");
        assert_eq!(name(&NoteDateFormat::Dmy), "dmy");

        assert_eq!(name(&NoteExtension::Md), "md");
        assert_eq!(name(&Theme::SageLight), "sage-light");
    }

    fn name<T: Serialize>(value: &T) -> String {
        serde_json::to_string(value)
            .unwrap()
            .trim_matches('"')
            .to_string()
    }

    /// Eine Einstellungsdatei aus einer älteren Version kennt die neuen
    /// Felder nicht — sie muss trotzdem laden und die Defaults bekommen.
    #[test]
    fn alte_einstellungsdatei_bekommt_die_neuen_defaults() {
        let alt = r#"{ "theme": "sage-dark", "notesFolder": "/tmp/notizen" }"#;
        let s: Settings = serde_json::from_str(alt).unwrap();

        assert_eq!(s.theme, Theme::SageDark);
        assert_eq!(s.notes_folder.as_deref(), Some("/tmp/notizen"));
        assert_eq!(s.note_date_format, NoteDateFormat::YmdHm);
        assert_eq!(s.autosave_delay_ms, 500);
        assert!(!s.vim_mode);
    }

    /// Die eine Vorgabe, die keine Version stillschweigend umdrehen darf:
    /// Wer eine Datei zum Nachschlagen öffnet, darf sie durch einen
    /// versehentlichen Tastendruck nicht verändern.
    #[test]
    fn autosave_ist_standardmaessig_aus() {
        assert!(!Settings::default().autosave);
        // Auch ein gesetzter Notizen-Ordner schaltet ihn nicht ein — die
        // Kopplung der beiden war genau der Fehler.
        let mit_ordner = r#"{ "notesFolder": "/tmp/notizen" }"#;
        let s: Settings = serde_json::from_str(mit_ordner).unwrap();
        assert!(!s.autosave);
    }
}
