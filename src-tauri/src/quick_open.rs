//! Dateiliste für Ruis Quick Open.
//!
//! Der native Dateidialog bleibt für beliebige Pfade zuständig. Diese Liste
//! bildet dagegen den schnellen Notizfluss ab: Text- und Markdown-Dateien aus
//! dem eingestellten Notizen-Ordner, zuletzt geänderte zuerst.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickOpenFile {
    path: String,
    name: String,
    relative_path: String,
    modified_ms: u64,
}

#[tauri::command]
pub fn list_note_files(folder: String) -> Result<Vec<QuickOpenFile>, String> {
    let root = absolute_path(PathBuf::from(folder))?;
    if !root.is_dir() {
        return Err(format!("Notizen-Ordner nicht gefunden: {}", root.display()));
    }

    let mut files = Vec::new();
    collect_files(&root, &root, &mut files)?;
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

fn collect_files(root: &Path, dir: &Path, files: &mut Vec<QuickOpenFile>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))?;

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let path = entry.path();

        // Symlink-Verzeichnisse werden absichtlich nicht verfolgt: Ein Link
        // zurück nach oben dürfte die Suche sonst endlos laufen lassen.
        if file_type.is_dir() {
            // Ein unlesbarer Unterordner soll nicht die ganze Liste blockieren.
            let _ = collect_files(root, &path, files);
            continue;
        }
        if !file_type.is_file() || !is_note_file(&path) {
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
            name: entry.file_name().to_string_lossy().into_owned(),
            relative_path: relative.to_string_lossy().into_owned(),
            modified_ms,
        });
    }
    Ok(())
}

fn is_note_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| matches!(ext.to_ascii_lowercase().as_str(), "txt" | "md"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn findet_txt_und_md_rekursiv_aber_keinen_code() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rui-quick-open-{unique}"));
        let nested = root.join("Unterordner");
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("Heute.md"), "# Heute").unwrap();
        fs::write(nested.join("Idee.TXT"), "Idee").unwrap();
        fs::write(root.join("main.rs"), "fn main() {}").unwrap();

        let files = list_note_files(root.to_string_lossy().into_owned()).unwrap();
        let mut relative: Vec<_> = files.iter().map(|f| f.relative_path.as_str()).collect();
        relative.sort_unstable();

        assert_eq!(relative.len(), 2);
        assert!(relative.contains(&"Heute.md"));
        assert!(relative.iter().any(|p| p.ends_with("Idee.TXT")));
        assert!(files.iter().all(|f| Path::new(&f.path).is_absolute()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn neueste_datei_steht_zuerst() {
        let mut files = vec![
            QuickOpenFile {
                path: "alt.md".to_string(),
                name: "alt.md".to_string(),
                relative_path: "alt.md".to_string(),
                modified_ms: 100,
            },
            QuickOpenFile {
                path: "neu.md".to_string(),
                name: "neu.md".to_string(),
                relative_path: "neu.md".to_string(),
                modified_ms: 200,
            },
        ];

        sort_files(&mut files);

        assert_eq!(files[0].name, "neu.md");
    }

    #[test]
    fn fehlender_ordner_liefert_einen_verstaendlichen_fehler() {
        let err = list_note_files("definitiv-nicht-vorhanden-rui".to_string()).unwrap_err();
        assert!(err.contains("Notizen-Ordner nicht gefunden"));
    }
}
