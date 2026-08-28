//! Rui in Windows einhängen: `rui datei.ps1` im Terminal und der Weg zu den
//! Standard-Apps.
//!
//! Beides passiert aus der laufenden App heraus und nicht im Installer.
//! Zwei Gründe: Die portable `rui.exe` hat gar keinen Installer, soll aber
//! genauso im Terminal erreichbar sein — und ein Eintrag im `PATH`, den man
//! im Programm selbst wieder wegnehmen kann, ist ehrlicher als einer, der
//! bei der Installation stillschweigend passiert.
//!
//! Geschrieben wird ausschliesslich unter `HKCU\Environment`: Das ist der
//! Benutzer-`PATH`, für den keine Administratorrechte nötig sind. Der
//! System-`PATH` bleibt unangetastet.

#[cfg(windows)]
mod imp {
    use std::path::PathBuf;

    use serde::Serialize;

    /// Was die Einstellungen über den Zustand wissen müssen.
    #[derive(Debug, Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PathStatus {
        /// Ist der Ordner der laufenden `rui.exe` im Benutzer-`PATH`?
        pub registered: bool,
        /// Genau dieser Ordner — die Anzeige soll sagen, worum es geht.
        pub folder: String,
        /// Ein anderer Ordner steht im `PATH`, weil Rui von woanders
        /// gestartet wurde als beim letzten Eintragen. Dann ist `rui` im
        /// Terminal eine andere Kopie als die, die gerade läuft.
        pub other_folder: Option<String>,
    }

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

/// Ausserhalb von Windows gibt es die Befehle trotzdem, damit das Frontend
/// nicht wissen muss, auf welchem System es läuft. Sie melden schlicht,
/// dass hier nichts einzurichten ist — unter Linux legt die Paketierung
/// die Binary ohnehin in den `PATH`.
#[cfg(not(windows))]
mod imp {
    use serde::Serialize;

    #[derive(Debug, Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PathStatus {
        pub registered: bool,
        pub folder: String,
        pub other_folder: Option<String>,
    }

    fn unsupported() -> Result<PathStatus, String> {
        Err("Nur unter Windows.".to_string())
    }

    #[tauri::command]
    pub fn path_status() -> Result<PathStatus, String> {
        unsupported()
    }

    #[tauri::command]
    pub fn register_in_path() -> Result<PathStatus, String> {
        unsupported()
    }

    #[tauri::command]
    pub fn unregister_from_path() -> Result<PathStatus, String> {
        unsupported()
    }

    #[tauri::command]
    pub fn open_default_apps() -> Result<(), String> {
        Err("Nur unter Windows.".to_string())
    }
}

#[cfg(not(windows))]
pub use imp::*;
