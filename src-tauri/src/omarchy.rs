//! Liest die Farben des aktiven Omarchy-Themes.
//!
//! Omarchy legt das aktuell gewählte Theme unter
//! `~/.local/state/omarchy/current/` ab: `theme.name` enthält den Slug
//! (`tokyo-night`), `theme/colors.toml` die Farben. Das Verzeichnis, in dem
//! das Theme selbst liegt, ist entweder eine Nutzerkopie unter
//! `~/.config/omarchy/themes/<slug>` oder die Systeminstallation unter
//! `$OMARCHY_PATH/themes/<slug>` — dieselbe Auflösung, die `omarchy-theme-dir`
//! im Terminal macht. Das ist ein dokumentierter, von Omarchy selbst
//! genutzter Pfad und kein Reverse-Engineering einer internen Datei.
//!
//! Läuft Rui nicht unter Omarchy, existiert `theme.name` schlicht nicht —
//! jede Funktion hier gibt dann sauber `None`/`false` zurück.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Die Farben aus `colors.toml`.
///
/// Zwei Schreibweisen, ein Struct: Die Datei nennt ihre Schlüssel
/// `dark_foreground`, das Frontend erwartet `darkForeground`. Stand hier
/// nur `rename_all = "camelCase"`, galt das auch fürs **Lesen** — und
/// jedes zweiwortige Feld der Datei lief ins Leere. Zusammen mit
/// `#[serde(default)]` fiel das nicht als Fehler auf: `colors.toml` wurde
/// gelesen, die Hälfte der Palette blieb trotzdem leer und Rui füllte sie
/// aus seinem eigenen Sage-Farbschema. Genau daher kamen die grünen
/// Sprenkel in einem blauen Theme.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(
    default,
    rename_all(serialize = "camelCase", deserialize = "snake_case")
)]
pub struct OmarchyColors {
    pub mode: Option<String>,
    pub accent: Option<String>,
    pub selection: Option<String>,
    pub muted: Option<String>,

    pub background: Option<String>,
    pub dark_background: Option<String>,
    pub darker_background: Option<String>,
    pub lighter_background: Option<String>,

    pub foreground: Option<String>,
    pub dark_foreground: Option<String>,
    pub light_foreground: Option<String>,
    pub bright_foreground: Option<String>,

    pub red: Option<String>,
    pub yellow: Option<String>,
    pub orange: Option<String>,
    pub green: Option<String>,
    pub cyan: Option<String>,
    pub blue: Option<String>,
    pub magenta: Option<String>,
    pub brown: Option<String>,
}

#[cfg(unix)]
fn home_dir() -> Option<PathBuf> {
    env::var("HOME").ok().map(PathBuf::from)
}

#[cfg(not(unix))]
fn home_dir() -> Option<PathBuf> {
    None
}

/// `~/.local/state/omarchy/current` — Rui beobachtet dieses Verzeichnis,
/// weil sowohl `theme.name` als auch der `theme`-Ordner darunter bei jedem
/// Themenwechsel neu geschrieben werden.
fn state_dir() -> Option<PathBuf> {
    Some(home_dir()?.join(".local/state/omarchy/current"))
}

fn theme_name_path() -> Option<PathBuf> {
    Some(state_dir()?.join("theme.name"))
}

fn theme_dir(slug: &str) -> Option<PathBuf> {
    let home = home_dir()?;
    let user_copy = home.join(".config/omarchy/themes").join(slug);
    if user_copy.is_dir() {
        return Some(user_copy);
    }
    let base = env::var("OMARCHY_PATH").unwrap_or_else(|_| "/usr/share/omarchy".to_string());
    Some(PathBuf::from(base).join("themes").join(slug))
}

pub fn available() -> bool {
    theme_name_path().is_some_and(|p| p.is_file())
}

pub fn current_colors() -> Option<OmarchyColors> {
    let slug = fs::read_to_string(theme_name_path()?).ok()?;
    let dir = theme_dir(slug.trim())?;
    let toml_text = fs::read_to_string(dir.join("colors.toml")).ok()?;
    toml::from_str(&toml_text).ok()
}

#[tauri::command]
pub fn omarchy_available() -> bool {
    available()
}

#[tauri::command]
pub fn load_omarchy_theme() -> Result<OmarchyColors, String> {
    current_colors().ok_or_else(|| "Kein Omarchy-Theme gefunden".to_string())
}

/// Beobachtet den Omarchy-Statusordner und meldet dem Frontend
/// `rui://omarchy-theme-changed`, sobald sich das aktive Theme ändert.
/// Ohne Omarchy gibt es nichts zu beobachten — dann passiert hier nichts.
#[cfg(desktop)]
pub fn watch(app: tauri::AppHandle) {
    use tauri::Emitter;

    let Some(dir) = state_dir() else { return };
    if !dir.exists() {
        return;
    }

    std::thread::spawn(move || {
        use notify::{RecursiveMode, Watcher};

        let (tx, rx) = mpsc::channel();
        let mut watcher = match notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        }) {
            Ok(w) => w,
            Err(_) => return,
        };
        if watcher.watch(&dir, RecursiveMode::NonRecursive).is_err() {
            return;
        }

        loop {
            if rx.recv().is_err() {
                return;
            }
            // Ein Themenwechsel löst mehrere Dateiereignisse kurz
            // hintereinander aus — erst emittieren, wenn wieder Ruhe ist.
            while rx.recv_timeout(Duration::from_millis(300)).is_ok() {}
            let _ = app.emit("rui://omarchy-theme-changed", ());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ein Ausschnitt aus Omarchys `tokyo-night/colors.toml`, wortgleich.
    const TOKYO_NIGHT: &str = r##"
mode = "dark"

accent = "#7aa2f7"
selection = "#292e42"
muted = "#414868"

background = "#1a1b26"
dark_background = "#13141c"
darker_background = "#0e0e14"
lighter_background = "#24283b"

foreground = "#a9b1d6"
dark_foreground = "#565f89"
"##;

    #[test]
    fn zweiwortige_schluessel_kommen_an() {
        let c: OmarchyColors = toml::from_str(TOKYO_NIGHT).unwrap();
        // Die einwortigen waren nie das Problem — sie sind die Kontrolle.
        assert_eq!(c.accent.as_deref(), Some("#7aa2f7"));
        assert_eq!(c.background.as_deref(), Some("#1a1b26"));
        // Diese hier fielen unter `rename_all = "camelCase"` still weg und
        // liessen Rui die halbe Palette aus seinem eigenen Farbschema füllen.
        assert_eq!(c.dark_foreground.as_deref(), Some("#565f89"));
        assert_eq!(c.lighter_background.as_deref(), Some("#24283b"));
        assert_eq!(c.dark_background.as_deref(), Some("#13141c"));
        assert_eq!(c.darker_background.as_deref(), Some("#0e0e14"));
    }

    /// Das Frontend liest `darkForeground`, nicht `dark_foreground` —
    /// die Umbenennung muss also in der einen Richtung gelten und in der
    /// anderen nicht.
    #[test]
    fn frontend_bekommt_camel_case() {
        let c: OmarchyColors = toml::from_str(TOKYO_NIGHT).unwrap();
        let json = serde_json::to_string(&c).unwrap();
        assert!(json.contains("\"darkForeground\":\"#565f89\""), "{json}");
        assert!(json.contains("\"lighterBackground\":\"#24283b\""), "{json}");
    }

    /// Fehlende Felder sind erlaubt: Nicht jedes Theme pflegt alle Farben.
    #[test]
    fn unvollstaendige_datei_bleibt_lesbar() {
        let c: OmarchyColors = toml::from_str("mode = \"light\"\nbackground = \"#ffffff\"").unwrap();
        assert_eq!(c.mode.as_deref(), Some("light"));
        assert!(c.dark_foreground.is_none());
    }
}
