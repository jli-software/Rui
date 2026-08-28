//! Rui im Betriebssystem einhängen: `rui datei.ps1` im Terminal und die
//! Anmeldung als Programm für Dateitypen.
//!
//! Beides passiert aus der laufenden App heraus und nicht bei der
//! Installation. Zwei Gründe: Die portable Binary hat gar keinen Installer,
//! soll aber genauso erreichbar sein — und ein Eintrag, den man im Programm
//! selbst wieder wegnehmen kann, ist ehrlicher als einer, der beim
//! Installieren stillschweigend passiert.
//!
//! Die beiden Systeme lösen dasselbe Problem verschieden, deshalb je ein
//! Modul mit denselben Befehlsnamen:
//!
//! |                   | Windows                        | Linux                                     |
//! |-------------------|--------------------------------|-------------------------------------------|
//! | im Terminal       | Ordner im Benutzer-`PATH`      | Symlink in `~/.local/bin`                 |
//! | Dateitypen        | meldet der Installer an        | `.desktop` in `~/.local/share/applications` |
//! | Standard-Programm | nur der Benutzer, Systemdialog | nur der Benutzer, Dateimanager            |
//!
//! Gemeinsam ist beiden: **nichts wird systemweit geschrieben.** Alles liegt
//! unter dem Benutzerprofil, ohne Administrator- oder Root-Rechte.

use serde::Serialize;

/// Ob `rui` im Terminal erreichbar ist — und über welche Kopie.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathStatus {
    pub registered: bool,
    /// Was eingetragen würde oder ist. Die Anzeige soll sagen, worum es
    /// geht; unter Linux hängt hier zusätzlich eine Warnung dran, wenn
    /// `~/.local/bin` gar nicht durchsucht wird.
    pub folder: String,
    /// Eine andere Rui-Kopie ist eingetragen. Dann startet `rui` im
    /// Terminal etwas anderes als das, was gerade läuft — das gehört gesagt.
    pub other_folder: Option<String>,
}

/// Ob Rui beim Desktop als Programm für Dateitypen angemeldet ist.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStatus {
    pub registered: bool,
    /// Die Datei, um die es geht — damit die Anzeige nicht raten muss.
    pub path: String,
}

// ---------------------------------------------------------------- Windows

#[cfg(windows)]
mod imp {
    use std::path::PathBuf;

    use super::{DesktopStatus, PathStatus};

    /// Der Ordner, in dem die laufende `rui.exe` liegt.
    fn exe_folder() -> Result<PathBuf, String> {
        let exe = std::env::current_exe().map_err(|e| format!("Eigener Pfad unbekannt: {e}"))?;
        exe.parent()
            .map(PathBuf::from)
            .ok_or_else(|| "Eigener Pfad hat kein Verzeichnis.".to_string())
    }

    /// Der Benutzer-`PATH`, in seine Einträge zerlegt.
    ///
    /// Leere Einträge fliegen raus: Ein `PATH`, der auf `;` endet, ist
    /// verbreitet und würde sonst bei jedem Schreiben einen weiteren
    /// leeren Eintrag hinterlassen.
    fn split_path(value: &str) -> Vec<String> {
        value
            .split(';')
            .map(str::trim)
            .filter(|p| !p.is_empty())
            .map(str::to_string)
            .collect()
    }

    /// Pfadvergleich, wie Windows ihn versteht: Gross-/Kleinschreibung egal,
    /// ein abschliessender Trenner egal.
    fn same_folder(a: &str, b: &str) -> bool {
        let norm = |p: &str| {
            p.trim_end_matches(['\\', '/'])
                .to_lowercase()
                .replace('/', "\\")
        };
        norm(a) == norm(b)
    }

    /// Enthält der Eintrag eine `rui.exe`? Nur solche Einträge räumt Rui
    /// wieder weg — ein fremder Ordner im `PATH` geht Rui nichts an.
    fn holds_rui(folder: &str) -> bool {
        PathBuf::from(folder).join("rui.exe").is_file()
    }

    fn read_user_path() -> Result<String, String> {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;

        let env = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Environment")
            .map_err(|e| format!("Benutzerumgebung nicht lesbar: {e}"))?;
        // Ein `PATH`, den es noch nie gab, ist kein Fehler, sondern leer.
        Ok(env.get_value::<String, _>("Path").unwrap_or_default())
    }

    /// Schreibt den `PATH` zurück und sagt Windows Bescheid.
    ///
    /// `REG_EXPAND_SZ`, nicht `REG_SZ`: Im Benutzer-`PATH` stehen
    /// üblicherweise Einträge mit `%USERPROFILE%` darin. Als `REG_SZ`
    /// zurückgeschrieben würden die nie wieder aufgelöst — ein Schaden an
    /// fremden Einträgen, den Rui nicht anrichten darf.
    fn write_user_path(value: &str) -> Result<(), String> {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_WRITE, REG_EXPAND_SZ};
        use winreg::{RegKey, RegValue};

        let env = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags("Environment", KEY_WRITE)
            .map_err(|e| format!("Benutzerumgebung nicht schreibbar: {e}"))?;

        // UTF-16 mit abschliessender Null, wie die Registry es erwartet.
        let mut bytes = Vec::with_capacity(value.len() * 2 + 2);
        for unit in value.encode_utf16().chain(std::iter::once(0)) {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        env.set_raw_value(
            "Path",
            &RegValue {
                bytes: bytes.into(),
                vtype: REG_EXPAND_SZ,
            },
        )
        .map_err(|e| format!("PATH nicht schreibbar: {e}"))?;

        broadcast_change();
        Ok(())
    }

    /// Ohne diese Nachricht merkt sich erst der nächste angemeldete Benutzer
    /// den neuen `PATH`. Damit bekommt ihn jedes Programm, das ab jetzt
    /// startet — ein bereits offenes Terminal allerdings nicht mehr, das
    /// hat seine Umgebung beim Start geerbt.
    fn broadcast_change() {
        use windows_sys::Win32::Foundation::{LPARAM, WPARAM};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE,
        };

        let name: Vec<u16> = "Environment\0".encode_utf16().collect();
        unsafe {
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0 as WPARAM,
                name.as_ptr() as LPARAM,
                SMTO_ABORTIFHUNG,
                3000,
                std::ptr::null_mut(),
            );
        }
    }

    #[tauri::command]
    pub fn path_status() -> Result<PathStatus, String> {
        let folder = exe_folder()?.to_string_lossy().into_owned();
        let entries = split_path(&read_user_path()?);

        let registered = entries.iter().any(|e| same_folder(e, &folder));
        // Ein anderer Rui-Ordner im PATH heisst: `rui` im Terminal startet
        // eine andere Kopie als die hier laufende. Das gehört gesagt.
        let other_folder = entries
            .into_iter()
            .find(|e| !same_folder(e, &folder) && holds_rui(e));

        Ok(PathStatus {
            registered,
            folder,
            other_folder,
        })
    }

    /// Trägt den Ordner der laufenden `rui.exe` in den Benutzer-`PATH` ein
    /// und räumt dabei ältere Rui-Ordner weg.
    #[tauri::command]
    pub fn register_in_path() -> Result<PathStatus, String> {
        let folder = exe_folder()?.to_string_lossy().into_owned();
        let current = read_user_path()?;

        let mut entries: Vec<String> = split_path(&current)
            .into_iter()
            // Alte Rui-Ordner raus: Sonst gewänne nach einem Umzug immer
            // noch die alte Kopie, weil sie weiter vorn im PATH steht.
            .filter(|e| !holds_rui(e) || same_folder(e, &folder))
            .collect();

        if !entries.iter().any(|e| same_folder(e, &folder)) {
            entries.push(folder);
        }
        write_user_path(&entries.join(";"))?;
        path_status()
    }

    #[tauri::command]
    pub fn unregister_from_path() -> Result<PathStatus, String> {
        let entries: Vec<String> = split_path(&read_user_path()?)
            .into_iter()
            .filter(|e| !holds_rui(e))
            .collect();
        write_user_path(&entries.join(";"))?;
        path_status()
    }

    /// Öffnet die Windows-Einstellungen bei den Standard-Apps.
    ///
    /// Seit Windows 10 darf sich kein Programm mehr selbst als Standard
    /// eintragen — das ist eine Entscheidung des Benutzers, und das ist
    /// richtig so. Rui kann nur zwei Dinge tun: seine Dateitypen beim
    /// Installieren anmelden, damit es überhaupt zur Auswahl steht, und den
    /// Weg dorthin abkürzen.
    #[tauri::command]
    pub fn open_default_apps() -> Result<(), String> {
        // Über `cmd /C start`, weil `ms-settings:` kein Programm ist,
        // sondern ein Protokoll, das die Shell auflöst.
        std::process::Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:defaultapps"])
            .spawn()
            .map_err(|e| format!("Einstellungen liessen sich nicht öffnen: {e}"))?;
        Ok(())
    }

    /// Unter Windows meldet der Installer die Dateitypen an, nicht die
    /// laufende App: Das gehört in die Setup-Routine, und die portable EXE
    /// soll die Registry nicht anfassen.
    #[tauri::command]
    pub fn desktop_status() -> Result<DesktopStatus, String> {
        Err("Unter Windows meldet der Installer die Dateitypen an.".to_string())
    }

    #[tauri::command]
    pub fn register_desktop() -> Result<DesktopStatus, String> {
        desktop_status()
    }

    #[tauri::command]
    pub fn unregister_desktop() -> Result<DesktopStatus, String> {
        desktop_status()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn pfade_vergleichen_sich_wie_unter_windows() {
            assert!(same_folder(r"C:\Programme\Rui", r"c:\programme\rui\"));
            assert!(same_folder(r"C:\Rui", "C:/Rui"));
            assert!(!same_folder(r"C:\Rui", r"C:\Rui2"));
        }

        #[test]
        fn leere_eintraege_verschwinden() {
            // Ein PATH, der auf `;` endet, ist verbreitet — jeder Durchlauf
            // dürfte daraus keinen weiteren leeren Eintrag machen.
            assert_eq!(
                split_path(r"C:\a;;C:\b; ;"),
                vec![r"C:\a".to_string(), r"C:\b".to_string()]
            );
        }
    }
}

#[cfg(windows)]
pub use imp::*;

// ------------------------------------------------------------------ Linux

#[cfg(unix)]
mod imp {
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::path::{Path, PathBuf};

    use super::{DesktopStatus, PathStatus};

    fn home() -> Result<PathBuf, String> {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_dir())
            .ok_or_else(|| "Kein Benutzerverzeichnis ($HOME).".to_string())
    }

    fn exe() -> Result<PathBuf, String> {
        std::env::current_exe().map_err(|e| format!("Eigener Pfad unbekannt: {e}"))
    }

    /// Wohin der Symlink kommt. `~/.local/bin` ist der von der
    /// XDG-Spezifikation vorgesehene Ort für Benutzerprogramme und steht auf
    /// Arch, Fedora und Debian in der ausgelieferten Shell-Konfiguration
    /// bereits im `PATH`.
    fn bin_dir() -> Result<PathBuf, String> {
        Ok(home()?.join(".local/bin"))
    }

    fn link_path() -> Result<PathBuf, String> {
        Ok(bin_dir()?.join("rui"))
    }

    fn applications_dir() -> Result<PathBuf, String> {
        // `XDG_DATA_HOME` respektieren, sonst der Standard darunter.
        let base = match std::env::var_os("XDG_DATA_HOME") {
            Some(v) if !v.is_empty() => PathBuf::from(v),
            _ => home()?.join(".local/share"),
        };
        Ok(base.join("applications"))
    }

    fn desktop_path() -> Result<PathBuf, String> {
        Ok(applications_dir()?.join("rui.desktop"))
    }

    /// Steht `~/.local/bin` im `PATH` dieses Prozesses?
    ///
    /// Der `PATH` einer GUI-Anwendung ist der der Sitzung und nicht zwingend
    /// der einer interaktiven Shell. Die Antwort ist deshalb ein Hinweis für
    /// die Anzeige, keine Bedingung fürs Anlegen des Symlinks.
    fn bin_dir_in_path() -> bool {
        let Ok(dir) = bin_dir() else { return false };
        let wanted = dir.to_string_lossy().trim_end_matches('/').to_string();
        std::env::var_os("PATH")
            .map(|p| {
                std::env::split_paths(&p)
                    .any(|entry| entry.to_string_lossy().trim_end_matches('/') == wanted)
            })
            .unwrap_or(false)
    }

    #[tauri::command]
    pub fn path_status() -> Result<PathStatus, String> {
        let link = link_path()?;
        let own = exe()?;
        let target = fs::read_link(&link).ok();

        // Zeigt der Symlink woanders hin, startet `rui` im Terminal eine
        // andere Kopie als die hier laufende.
        let other_folder = match &target {
            Some(t) if *t != own => t.parent().map(|p| p.to_string_lossy().into_owned()),
            _ => None,
        };

        let mut folder = link.to_string_lossy().into_owned();
        if !bin_dir_in_path() {
            // Ein Symlink in einem Ordner, den die Shell nicht durchsucht,
            // nützt niemandem — das muss die Anzeige sagen dürfen.
            folder.push_str(" — Achtung: dieser Ordner steht nicht im PATH");
        }

        Ok(PathStatus {
            registered: target.as_deref() == Some(own.as_path()),
            folder,
            other_folder,
        })
    }

    /// Legt `~/.local/bin/rui` als Symlink auf die laufende Binary.
    ///
    /// Symlink und nicht Kopie: Nach einem Neubau zeigt er weiterhin auf den
    /// aktuellen Stand, statt eine alte Fassung zu konservieren.
    #[tauri::command]
    pub fn register_in_path() -> Result<PathStatus, String> {
        let dir = bin_dir()?;
        let link = link_path()?;
        let own = exe()?;

        fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
        // `symlink` scheitert an einem vorhandenen Pfad; ein Link, der schon
        // dort liegt, soll aber einfach aktualisiert werden.
        remove_if_present(&link)?;
        symlink(&own, &link).map_err(|e| format!("{}: {e}", link.display()))?;
        path_status()
    }

    #[tauri::command]
    pub fn unregister_from_path() -> Result<PathStatus, String> {
        remove_if_present(&link_path()?)?;
        path_status()
    }

    /// `exists()` folgt Symlinks und meldet einen toten Link als abwesend —
    /// löschen liesse er sich trotzdem, und genau das ist hier gemeint.
    fn remove_if_present(path: &Path) -> Result<(), String> {
        if path.is_symlink() || path.exists() {
            fs::remove_file(path).map_err(|e| format!("{}: {e}", path.display()))?;
        }
        Ok(())
    }

    /// Die MIME-Typen, unter denen Rui im „Öffnen mit" auftauchen soll.
    ///
    /// Bewusst die verbreiteten Text- und Quelltext-Typen und **nicht**
    /// `text/html` oder `image/svg+xml`: Die gehören dem Browser, und eine
    /// Zuordnung, die man nicht wollte, ist lästiger als eine, die fehlt.
    /// Dieselbe Linie wie bei den Dateiverknüpfungen unter Windows.
    const MIME_TYPES: &[&str] = &[
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/tab-separated-values",
        "text/x-log",
        "application/x-shellscript",
        "text/x-python",
        "text/rust",
        "text/x-csharp",
        "text/x-go",
        "text/x-sql",
        "text/x-diff",
        "application/json",
        "application/x-yaml",
        "application/toml",
        "application/xml",
        "text/x-ini",
    ];

    fn desktop_entry(exec: &str) -> String {
        let mime = MIME_TYPES.join(";");
        format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Name=Rui\n\
             Comment=Schlanker Texteditor\n\
             Exec={exec} %f\n\
             Icon=rui\n\
             Terminal=false\n\
             Categories=Utility;TextEditor;Development;\n\
             MimeType={mime};\n\
             StartupNotify=true\n\
             StartupWMClass=Rui\n"
        )
    }

    #[tauri::command]
    pub fn desktop_status() -> Result<DesktopStatus, String> {
        let path = desktop_path()?;
        Ok(DesktopStatus {
            registered: path.is_file(),
            path: path.to_string_lossy().into_owned(),
        })
    }

    /// Schreibt `~/.local/share/applications/rui.desktop`.
    ///
    /// Damit ist Rui als Programm für die Dateitypen angemeldet und taucht
    /// unter „Öffnen mit" auf. Zum **Standard** macht es sich ausdrücklich
    /// nicht — das bleibt eine Entscheidung des Benutzers, im Dateimanager
    /// oder mit `xdg-mime default rui.desktop <typ>`.
    #[tauri::command]
    pub fn register_desktop() -> Result<DesktopStatus, String> {
        let dir = applications_dir()?;
        fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;

        let path = desktop_path()?;
        let exec = exe()?.to_string_lossy().into_owned();
        fs::write(&path, desktop_entry(&exec)).map_err(|e| format!("{}: {e}", path.display()))?;

        refresh_desktop_database(&dir);
        desktop_status()
    }

    #[tauri::command]
    pub fn unregister_desktop() -> Result<DesktopStatus, String> {
        let path = desktop_path()?;
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("{}: {e}", path.display()))?;
            refresh_desktop_database(&applications_dir()?);
        }
        desktop_status()
    }

    /// Ohne das sieht der Dateimanager die Zuordnung erst nach einem
    /// Neuanmelden. Fehlt das Werkzeug, ist das kein Fehler — die Datei
    /// liegt richtig, sie wird nur später wirksam.
    fn refresh_desktop_database(dir: &Path) {
        let _ = std::process::Command::new("update-desktop-database")
            .arg(dir)
            .status();
    }

    /// Einen zentralen Ort für Standard-Programme gibt es unter Linux nicht:
    /// Jede Desktop-Umgebung löst das anders, und unter einem
    /// Tiling-Compositor gibt es gar keinen solchen Dialog.
    #[tauri::command]
    pub fn open_default_apps() -> Result<(), String> {
        Err("Unter Linux legt der Dateimanager das Standardprogramm fest.".to_string())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn desktop_eintrag_ist_vollstaendig() {
            let text = desktop_entry("/opt/rui/rui");
            assert!(text.starts_with("[Desktop Entry]\n"));
            // `%f` vergisst man leicht — ohne es öffnet ein Doppelklick die
            // App, aber nicht die Datei.
            assert!(text.contains("Exec=/opt/rui/rui %f"));
            assert!(text.contains("MimeType=text/plain;"));
            assert!(text.contains("application/x-shellscript"));
            // Der Browser behält, was ihm gehört.
            assert!(!text.contains("text/html"));
            assert!(!text.contains("image/svg"));
            // Ein `.desktop` ohne abschliessenden Umbruch lesen manche
            // Parser nicht zu Ende.
            assert!(text.ends_with('\n'));
        }

        #[test]
        fn symlink_wird_angelegt_und_wieder_entfernt() {
            let dir = std::env::temp_dir().join(format!("rui-link-{}", std::process::id()));
            fs::create_dir_all(&dir).unwrap();
            let ziel = dir.join("rui-binary");
            fs::write(&ziel, b"x").unwrap();
            let link = dir.join("rui");

            symlink(&ziel, &link).unwrap();
            assert_eq!(fs::read_link(&link).unwrap(), ziel);

            // Ein toter Link muss sich ebenso entfernen lassen wie ein
            // lebender — `exists()` allein meldet ihn als abwesend.
            fs::remove_file(&ziel).unwrap();
            assert!(!link.exists() && link.is_symlink());
            remove_if_present(&link).unwrap();
            assert!(!link.is_symlink());

            fs::remove_dir_all(&dir).unwrap();
        }
    }
}

#[cfg(unix)]
pub use imp::*;
