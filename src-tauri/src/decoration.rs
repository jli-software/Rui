//! Fensterdekoration: native Titelleiste, eigene Titelleiste oder gar keine.
//!
//! Windows bekommt immer eine eigene Titelleiste (`custom`), damit sie sich
//! ins Fenster einfügt. Unter Linux entscheidet der Compositor: Tiling-WMs
//! wie Hyprland zeichnen selbst keinen Rahmen, deshalb bekommt Rui dort auch
//! keinen (`none`) — alles andere bekommt die normale Desktop-Titelleiste
//! (`native`). Die Erkennung hängt bewusst an mehreren Signalen statt an
//! einer einzelnen Umgebungsvariable, weil keine davon allein zuverlässig
//! gesetzt ist. `RUI_DECORATION` und die Einstellung überschreiben das.

use std::env;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DecorationMode {
    Auto,
    Native,
    Custom,
    None,
}

impl Default for DecorationMode {
    fn default() -> Self {
        DecorationMode::Auto
    }
}

impl DecorationMode {
    fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "auto" => Some(DecorationMode::Auto),
            "native" => Some(DecorationMode::Native),
            "custom" => Some(DecorationMode::Custom),
            "none" => Some(DecorationMode::None),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct ResolvedDecoration {
    pub mode: DecorationMode,
    /// Für die Einstellungen-UI: warum diese Wahl, wenn `auto` gilt.
    pub reason: String,
}

impl ResolvedDecoration {
    /// Ob Tauri die native Fensterdekoration zeichnen soll. `custom` und
    /// `none` brauchen beide ein rahmenloses Fenster — der Unterschied ist
    /// nur, ob das Frontend selbst eine Titelleiste einblendet.
    pub fn native_chrome(&self) -> bool {
        self.mode == DecorationMode::Native
    }
}

/// `env_var` enthält oft eine Doppelpunkt-Liste (`XDG_CURRENT_DESKTOP`).
fn env_mentions(var: &str, needle: &str) -> bool {
    env::var(var)
        .map(|v| v.to_ascii_lowercase().contains(needle))
        .unwrap_or(false)
}

/// Tiling-Compositors ohne eigene Fensterdekoration. Bewusst kurz gehalten —
/// neue Einträge sind ein Einzeiler, keine neue Abstraktion.
fn is_tiling_compositor() -> bool {
    env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok()
        || env::var("SWAYSOCK").is_ok()
        || env_mentions("XDG_CURRENT_DESKTOP", "hyprland")
        || env_mentions("XDG_CURRENT_DESKTOP", "sway")
        || env_mentions("XDG_SESSION_DESKTOP", "hyprland")
        || env_mentions("XDG_SESSION_DESKTOP", "sway")
        || env_mentions("DESKTOP_SESSION", "hyprland")
        || env_mentions("DESKTOP_SESSION", "omarchy")
}

fn platform_default() -> (DecorationMode, &'static str) {
    if cfg!(target_os = "windows") {
        return (DecorationMode::Custom, "Windows: eigene Titelleiste");
    }
    if cfg!(target_os = "macos") {
        return (DecorationMode::Native, "macOS: native Titelleiste");
    }
    if is_tiling_compositor() {
        return (
            DecorationMode::None,
            "Tiling-Compositor erkannt (Hyprland/Sway) — kein eigener Rahmen",
        );
    }
    (DecorationMode::Native, "Linux-Desktop: native Titelleiste")
}

pub fn resolve(setting: DecorationMode) -> ResolvedDecoration {
    // Highest priority: Startparameter, für einen einzelnen Lauf ohne die
    // gespeicherten Einstellungen anzufassen.
    if let Some(mode) = env::var("RUI_DECORATION").ok().and_then(|v| DecorationMode::parse(&v)) {
        if mode != DecorationMode::Auto {
            return ResolvedDecoration {
                mode,
                reason: "über RUI_DECORATION erzwungen".to_string(),
            };
        }
    }

    if setting != DecorationMode::Auto {
        return ResolvedDecoration {
            mode: setting,
            reason: "manuell in den Einstellungen gewählt".to_string(),
        };
    }

    let (mode, reason) = platform_default();
    ResolvedDecoration {
        mode,
        reason: reason.to_string(),
    }
}

#[tauri::command]
pub fn resolve_decoration(mode: DecorationMode) -> ResolvedDecoration {
    resolve(mode)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_override_gewinnt_gegen_einstellung() {
        // SAFETY: Tests laufen hier seriell genug, dass das keinen anderen
        // Test stört — dieses Modul ist die einzige Stelle, die die Variable liest.
        unsafe { env::set_var("RUI_DECORATION", "none") };
        let resolved = resolve(DecorationMode::Native);
        unsafe { env::remove_var("RUI_DECORATION") };
        assert_eq!(resolved.mode, DecorationMode::None);
    }

    #[test]
    fn manuelle_einstellung_gewinnt_gegen_plattform_default() {
        let resolved = resolve(DecorationMode::Custom);
        assert_eq!(resolved.mode, DecorationMode::Custom);
    }
}
