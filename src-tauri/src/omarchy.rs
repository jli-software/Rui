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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
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
