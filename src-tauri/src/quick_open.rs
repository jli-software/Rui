//! Dateiliste für Ruis Quick Open.
//!
//! Der native Dateidialog bleibt für beliebige Pfade zuständig. Diese Liste
//! bildet dagegen den schnellen Wechsel zwischen Dateien ab, die man beim
//! Arbeiten wirklich nacheinander aufmacht: Notizen, Scripts, Quelltext und
//! Logdateien aus den eingestellten Ordnern, zuletzt geänderte zuerst.
//!
//! Welche Endungen dazugehören, entscheidet die Oberfläche und gibt sie mit —
//! dieselbe Liste, aus der auch Syntax-Highlighting und die Dateidialoge
//! entstehen (`languages.ts`). Eine zweite Aufzählung hier liefe beim nächsten
//! neuen Sprachmodus auseinander.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

/// Wie tief die Suche steigt. Notizordner sind flach; die Grenze schützt vor
/// einem versehentlich eingestellten Pfad nahe der Laufwerkswurzel.
const MAX_DEPTH: usize = 12;

/// Obergrenze für die Liste. Darüber hinaus hilft Scrollen ohnehin nicht mehr
/// weiter — dann filtert man.
const MAX_FILES: usize = 20_000;

/// Ordner, die fast nie das enthalten, was man sucht, aber sehr viel davon.
/// Ordner mit führendem Punkt fallen zusätzlich generisch weg; damit sind
/// `.git`, `.venv`, `.cache` und `.idea` miterledigt.
const SKIPPED_DIRS: [&str; 10] = [
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    "bin",
    "obj",
    "vendor",
    "venv",
    "__pycache__",
];

/// Dateien ohne Endung, die trotzdem Text sind. Alles andere ohne Endung
/// bleibt draussen: unter Linux sind das meist Binärdateien.
const BARE_NAMES: [&str; 7] = [
    "dockerfile",
    "makefile",
    "license",
    "licence",
    "readme",
    "changelog",
    "authors",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickOpenFile {
    path: String,
    name: String,
    relative_path: String,
    /// Der durchsuchte Ordner, aus dem diese Datei stammt. Bei mehreren
    /// Ordnern sagt der relative Pfad allein sonst nicht, wo man landet.
    root: String,
    modified_ms: u64,
}

/// Durchsucht mehrere Ordner auf einmal.
///
/// `async` und auf einem eigenen Thread: Ein synchroner Befehl läuft in
/// Tauri auf demselben Thread wie die Oberfläche. Ein Notizordner mit ein
/// paar tausend Dateien — oder einer auf einem Netzlaufwerk — hat damit das
/// ganze Fenster angehalten, bis der letzte Unterordner gelesen war. Genau
/// in dieser Zeit steht der Öffner offen und man will schon tippen.
#[tauri::command]
pub async fn list_note_files(
    folders: Vec<String>,
    extensions: Vec<String>,
) -> Result<Vec<QuickOpenFile>, String> {
    tauri::async_runtime::spawn_blocking(move || scan(folders, extensions))
        .await
        .map_err(|e| format!("Suche abgebrochen: {e}"))?
}

/// Ein einzelner unlesbarer oder verschwundener Ordner darf die Liste nicht
/// leeren — ein Netzlaufwerk ist mal weg, der Rest bleibt brauchbar. Ein
/// Fehler kommt nur zurück, wenn sich kein einziger Ordner lesen liess.
fn scan(folders: Vec<String>, extensions: Vec<String>) -> Result<Vec<QuickOpenFile>, String> {
    let wanted: HashSet<String> = extensions
        .into_iter()
        .map(|e| e.trim_start_matches('.').to_ascii_lowercase())
        .collect();

    let mut files = Vec::new();
    // Ordner dürfen ineinander liegen — der Notizen-Ordner und der Ordner der
    // offenen Datei etwa. Ohne diese Menge stünde jede Datei doppelt drin.
    let mut seen = HashSet::new();
    let mut errors = Vec::new();
    let mut scanned = 0;

    for folder in folders {
        let root = match absolute_path(PathBuf::from(folder)) {
            Ok(root) if root.is_dir() => root,
            Ok(root) => {
                errors.push(format!("Ordner nicht gefunden: {}", root.display()));
                continue;
            }
            Err(error) => {
                errors.push(error);
                continue;
            }
        };
        scanned += 1;
        let _ = collect_files(&root, &root, &wanted, 0, &mut seen, &mut files);
    }

    if scanned == 0 {
        return Err(errors
            .into_iter()
            .next()
            .unwrap_or_else(|| "Kein Ordner zum Durchsuchen eingestellt.".to_string()));
    }

    sort_files(&mut files);
    Ok(files)
}

fn sort_files(files: &mut [QuickOpenFile]) {
    files.sort_by(|a, b| {
        b.modified_ms.cmp(&a.modified_ms).then_with(|| {
            a.relative_path
                .to_lowercase()
                .cmp(&b.relative_path.to_lowercase())
        })
    });
}

fn absolute_path(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_absolute() {
        return Ok(path);
    }
    std::env::current_dir()
        .map(|cwd| cwd.join(path))
        .map_err(|e| format!("Arbeitsverzeichnis nicht lesbar: {e}"))
}

fn collect_files(
    root: &Path,
    dir: &Path,
    wanted: &HashSet<String>,
    depth: usize,
    seen: &mut HashSet<String>,
    files: &mut Vec<QuickOpenFile>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))?;

    for entry in entries.flatten() {
        if files.len() >= MAX_FILES {
            return Ok(());
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();

        // Symlink-Verzeichnisse werden absichtlich nicht verfolgt: Ein Link
        // zurück nach oben dürfte die Suche sonst endlos laufen lassen.
        if file_type.is_dir() {
            if depth + 1 > MAX_DEPTH || is_skipped_dir(&name) {
                continue;
            }
            // Ein unlesbarer Unterordner soll nicht die ganze Liste blockieren.
            let _ = collect_files(root, &path, wanted, depth + 1, seen, files);
            continue;
        }
        if !file_type.is_file() || !is_text_file(&name, wanted) {
            continue;
        }
        // Windows vergleicht Pfade ohne Rücksicht auf Gross- und
        // Kleinschreibung; für die Dublettenprüfung reicht das überall.
        if !seen.insert(path.to_string_lossy().to_lowercase()) {
            continue;
        }

        let modified_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let relative = path.strip_prefix(root).unwrap_or(&path);

        files.push(QuickOpenFile {
            path: path.to_string_lossy().into_owned(),
            name,
            relative_path: relative.to_string_lossy().into_owned(),
            root: root.to_string_lossy().into_owned(),
            modified_ms,
        });
    }
    Ok(())
}

fn is_skipped_dir(name: &str) -> bool {
    name.starts_with('.') || SKIPPED_DIRS.contains(&name.to_ascii_lowercase().as_str())
}

/// Ob eine Datei in die Liste gehört.
///
/// Neben der Endung zählt der Name: Ein rotiertes `deploy.log.3` oder
/// `error.log.2026-08-28` hat keine brauchbare Endung mehr, ist aber genau
/// das, wofür man den Öffner aufmacht.
fn is_text_file(name: &str, wanted: &HashSet<String>) -> bool {
    let lower = name.to_ascii_lowercase();
    if lower.contains(".log") {
        return true;
    }

    match lower.rsplit_once('.') {
        // Ohne Punkt im Namen: nur die bekannten endungslosen Textdateien.
        None => BARE_NAMES.contains(&lower.as_str()),
        Some((_, ext)) => wanted.contains(ext),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn extensions() -> Vec<String> {
        ["txt", "md", "rs", "ps1", "log"]
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    fn temp_root(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("rui-quick-open-{label}-{unique}"))
    }

    #[test]
    fn findet_notizen_scripts_und_quelltext_rekursiv() {
        let root = temp_root("mischung");
        let nested = root.join("Unterordner");
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("Heute.md"), "# Heute").unwrap();
        fs::write(nested.join("Idee.TXT"), "Idee").unwrap();
        fs::write(root.join("main.rs"), "fn main() {}").unwrap();
        fs::write(root.join("Deploy.ps1"), "Write-Host").unwrap();
        fs::write(root.join("bild.png"), "kein Text").unwrap();

        let files = scan(vec![root.to_string_lossy().into_owned()], extensions()).unwrap();
        let mut relative: Vec<_> = files.iter().map(|f| f.relative_path.as_str()).collect();
        relative.sort_unstable();

        assert_eq!(relative.len(), 4);
        assert!(relative.contains(&"Heute.md"));
        assert!(relative.contains(&"main.rs"));
        assert!(relative.contains(&"Deploy.ps1"));
        assert!(relative.iter().any(|p| p.ends_with("Idee.TXT")));
        assert!(!relative.iter().any(|p| p.ends_with("bild.png")));
        assert!(files.iter().all(|f| Path::new(&f.path).is_absolute()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn ueberspringt_ordner_voller_baukram() {
        let root = temp_root("baukram");
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("node_modules").join("index.rs"), "").unwrap();
        fs::write(root.join(".git").join("COMMIT_EDITMSG.txt"), "").unwrap();
        fs::write(root.join("Notiz.md"), "").unwrap();

        let files = scan(vec![root.to_string_lossy().into_owned()], extensions()).unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "Notiz.md");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rotierte_logdateien_zaehlen_trotz_fehlender_endung() {
        let wanted: HashSet<String> = extensions().into_iter().collect();

        assert!(is_text_file("deploy.log.3", &wanted));
        assert!(is_text_file("error.log.2026-08-28", &wanted));
        assert!(is_text_file("README", &wanted));
        assert!(!is_text_file("rui.exe", &wanted));
        assert!(!is_text_file("werkzeug", &wanted));
    }

    #[test]
    fn mehrere_ordner_ohne_dubletten_und_ohne_stolpern() {
        let root = temp_root("mehrere");
        let unten = root.join("Unten");
        fs::create_dir_all(&unten).unwrap();
        fs::write(root.join("Oben.md"), "").unwrap();
        fs::write(unten.join("Unten.md"), "").unwrap();

        // Der zweite Ordner liegt im ersten, der dritte gibt es gar nicht.
        let files = scan(
            vec![
                root.to_string_lossy().into_owned(),
                unten.to_string_lossy().into_owned(),
                root.join("Weg").to_string_lossy().into_owned(),
            ],
            extensions(),
        )
        .unwrap();

        assert_eq!(files.len(), 2, "Unten.md darf nur einmal drinstehen");
        assert!(files.iter().all(|f| Path::new(&f.root).is_dir()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn neueste_datei_steht_zuerst() {
        let mut files = vec![
            QuickOpenFile {
                path: "alt.md".to_string(),
                name: "alt.md".to_string(),
                relative_path: "alt.md".to_string(),
                root: ".".to_string(),
                modified_ms: 100,
            },
            QuickOpenFile {
                path: "neu.md".to_string(),
                name: "neu.md".to_string(),
                relative_path: "neu.md".to_string(),
                root: ".".to_string(),
                modified_ms: 200,
            },
        ];

        sort_files(&mut files);

        assert_eq!(files[0].name, "neu.md");
    }

    #[test]
    fn fehlender_ordner_liefert_einen_verstaendlichen_fehler() {
        let err = scan(
            vec!["definitiv-nicht-vorhanden-rui".to_string()],
            extensions(),
        )
        .unwrap_err();
        assert!(err.contains("Ordner nicht gefunden"));
    }
}
