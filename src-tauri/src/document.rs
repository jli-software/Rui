//! Laden und Speichern von Textdateien.
//!
//! Der Editor im Frontend arbeitet ausschliesslich mit UTF-8 und LF.
//! Encoding und Zeilenende der Originaldatei werden hier erkannt, im
//! Dokument mitgeführt und beim Speichern wiederhergestellt — sonst
//! schreibt der Editor stillschweigend fremde Dateien um.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Ab dieser Grösse wird nachgefragt, bevor geöffnet wird. Der Puffer lebt
/// im Webview, darüber wird das Tippgefühl spürbar zäh.
const LARGE_FILE_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    Lf,
    Crlf,
    Cr,
}

impl LineEnding {
    /// Plattform-Default für neue Dateien.
    pub fn platform_default() -> Self {
        if cfg!(windows) {
            LineEnding::Crlf
        } else {
            LineEnding::Lf
        }
    }

    /// Häufigstes Zeilenende gewinnt. Gemischte Dateien werden beim
    /// Speichern damit vereinheitlicht — das ist gewollt und sichtbar,
    /// weil das erkannte Ending in der Statusleiste steht.
    fn detect(text: &str) -> Self {
        let mut crlf = 0usize;
        let mut lf = 0usize;
        let mut cr = 0usize;
        let bytes = text.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            match bytes[i] {
                b'\r' => {
                    if bytes.get(i + 1) == Some(&b'\n') {
                        crlf += 1;
                        i += 1;
                    } else {
                        cr += 1;
                    }
                }
                b'\n' => lf += 1,
                _ => {}
            }
            i += 1;
        }
        if crlf == 0 && lf == 0 && cr == 0 {
            return Self::platform_default();
        }
        if crlf >= lf && crlf >= cr {
            LineEnding::Crlf
        } else if lf >= cr {
            LineEnding::Lf
        } else {
            LineEnding::Cr
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    /// Absoluter Pfad, `None` bei einem noch nie gespeicherten Puffer.
    pub path: Option<String>,
    /// Inhalt in UTF-8, immer auf LF normalisiert.
    pub content: String,
    /// Encoding-Label nach WHATWG, z. B. `UTF-8` oder `windows-1252`.
    pub encoding: String,
    /// Ob die Originaldatei eine Byte Order Mark hatte.
    pub bom: bool,
    pub line_ending: LineEnding,
    pub read_only: bool,
    /// mtime in Millisekunden, um externe Änderungen zu erkennen.
    pub mtime_ms: u64,
}

fn mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Erkennt das Encoding: erst BOM, dann statistisches Raten.
///
/// chardetng ist derselbe Detektor, den Firefox für Seiten ohne
/// Encoding-Angabe verwendet — für die CP1252-/Latin-1-Textdateien, die
/// unter Windows herumliegen, ist das die beste verfügbare Schätzung.
fn decode(bytes: &[u8]) -> (String, &'static encoding_rs::Encoding, bool) {
    if let Some((enc, bom_len)) = encoding_rs::Encoding::for_bom(bytes) {
        let (text, _) = enc.decode_without_bom_handling(&bytes[bom_len..]);
        return (text.into_owned(), enc, true);
    }

    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let enc = detector.guess(None, true);
    let (text, _, _) = enc.decode(bytes);
    (text.into_owned(), enc, false)
}

#[tauri::command]
pub fn open_file(path: String, force: bool) -> Result<Document, String> {
    let path_buf = PathBuf::from(&path);
    let meta = fs::metadata(&path_buf).map_err(|e| format!("{path}: {e}"))?;

    if meta.is_dir() {
        return Err(format!("{path} ist ein Verzeichnis."));
    }
    if !force && meta.len() > LARGE_FILE_BYTES {
        // Vom Frontend als Rückfrage behandelt, nicht als Fehler.
        return Err(format!("LARGE_FILE:{}", meta.len()));
    }

    let bytes = fs::read(&path_buf).map_err(|e| format!("{path}: {e}"))?;
    let (raw, encoding, bom) = decode(&bytes);
    let line_ending = LineEnding::detect(&raw);

    // Der Editor sieht ausschliesslich LF.
    let content = raw.replace("\r\n", "\n").replace('\r', "\n");

    Ok(Document {
        path: Some(path_buf.to_string_lossy().into_owned()),
        content,
        encoding: encoding.name().to_string(),
        bom,
        line_ending,
        read_only: meta.permissions().readonly(),
        mtime_ms: mtime_ms(&path_buf),
    })
}

/// Wendet Zeilenende und Encoding an und liefert die schreibfertigen Bytes.
fn encode_with_endings(
    content: String,
    encoding: &str,
    bom: bool,
    line_ending: LineEnding,
) -> Result<Vec<u8>, String> {
    let with_endings = match line_ending {
        LineEnding::Lf => content,
        LineEnding::Crlf => content.replace('\n', "\r\n"),
        LineEnding::Cr => content.replace('\n', "\r"),
    };

    let enc = encoding_rs::Encoding::for_label(encoding.as_bytes())
        .ok_or_else(|| format!("Unbekanntes Encoding: {encoding}"))?;
    let (encoded, _, had_errors) = enc.encode(&with_endings);
    if had_errors {
        return Err(format!(
            "Der Text enthält Zeichen, die {} nicht darstellen kann. Als UTF-8 speichern?",
            enc.name()
        ));
    }

    let mut out: Vec<u8> = Vec::with_capacity(encoded.len() + 3);
    if bom {
        match enc.name() {
            "UTF-8" => out.extend_from_slice(&[0xEF, 0xBB, 0xBF]),
            "UTF-16LE" => out.extend_from_slice(&[0xFF, 0xFE]),
            "UTF-16BE" => out.extend_from_slice(&[0xFE, 0xFF]),
            _ => {}
        }
    }
    out.extend_from_slice(&encoded);
    Ok(out)
}

/// Erst in eine Nachbardatei schreiben, dann umbenennen: ein Absturz mitten
/// im Schreiben darf das Original nicht zerstören. Das Rename muss im
/// selben Verzeichnis passieren, sonst ist es nicht atomar.
fn write_atomic(path_buf: &Path, bytes: &[u8]) -> Result<u64, String> {
    let dir = path_buf.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unbenannt".to_string());
    let tmp = dir.join(format!(".{file_name}.rui-tmp"));

    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("{}: {e}", tmp.display()))?;
        f.write_all(bytes).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }

    fs::rename(&tmp, path_buf).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("{}: {e}", path_buf.display())
    })?;

    Ok(mtime_ms(path_buf))
}

#[tauri::command]
pub fn save_file(
    path: String,
    content: String,
    encoding: String,
    bom: bool,
    line_ending: LineEnding,
) -> Result<u64, String> {
    let path_buf = PathBuf::from(&path);
    let bytes = encode_with_endings(content, &encoding, bom, line_ending)?;
    write_atomic(&path_buf, &bytes)
}

/// Zeichen, die auf Windows, macOS oder Linux in Dateinamen verboten sind
/// oder dort nur Ärger machen.
const FORBIDDEN_IN_NAMES: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

/// Erste Zeile einer Notiz zu einem Dateinamen-Stamm machen: getrimmt,
/// Leerraum zu `_`, verbotene und Steuerzeichen raus, auf 80 Zeichen
/// gekappt. Leer heisst: kein Titel ableitbar.
fn sanitize_title(title: &str) -> Option<String> {
    let collapsed = title.split_whitespace().collect::<Vec<_>>().join("_");
    let cleaned: String = collapsed
        .chars()
        .filter(|c| !FORBIDDEN_IN_NAMES.contains(c) && !c.is_control())
        .collect();
    let trimmed = cleaned.trim_matches(|c: char| c == '.' || c.is_whitespace());
    let truncated: String = trimmed.chars().take(80).collect();

    if truncated.is_empty() {
        None
    } else {
        Some(truncated)
    }
}

/// Lesbarer Name für eine Notiz ohne Titel, z. B. "Notiz 2026-08-27 1723".
/// UTC statt lokaler Zeit, um ohne zusätzliche Crate auszukommen — für
/// einen Platzhalternamen ist das genau genug.
fn fallback_title() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let (y, m, d) = civil_from_days((secs / 86_400) as i64);
    let tod = secs % 86_400;
    format!("Notiz {y:04}-{m:02}-{d:02} {:02}{:02}", tod / 3600, (tod % 3600) / 60)
}

/// Tage seit der Unix-Epoche in ein Kalenderdatum umrechnen (proleptisch
/// gregorianisch, UTC) — Howard Hinnants Algorithmus, um für diese eine
/// Stelle keine chrono-Abhängigkeit zu brauchen.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn is_taken(path: &Path, keep: Option<&Path>) -> bool {
    if keep == Some(path) {
        return false;
    }
    path.exists()
}

/// Ersten freien Pfad `stem.ext`, `stem (2).ext`, … im Ordner finden.
/// `keep` ist der Pfad des eigenen Puffers — der zählt nicht als belegt.
fn unique_note_path(folder: &Path, stem: &str, ext: &str, keep: Option<&Path>) -> PathBuf {
    let candidate = folder.join(format!("{stem}.{ext}"));
    if !is_taken(&candidate, keep) {
        return candidate;
    }
    let mut n = 2;
    loop {
        let candidate = folder.join(format!("{stem} ({n}).{ext}"));
        if !is_taken(&candidate, keep) {
            return candidate;
        }
        n += 1;
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSaveResult {
    pub path: String,
    pub mtime_ms: u64,
}

/// Speichert eine Notiz im Instant-Save-Modus: neue Puffer bekommen ihren
/// Namen aus der ersten Zeile, bereits automatisch benannte Notizen werden
/// bei Bedarf mitverschoben. Eine Notiz, die von Hand geöffnet wurde (also
/// nie über diesen Befehl entstand), landet nie hier — dafür bleibt
/// `save_file` zuständig, ganz ohne Umbenennen.
#[tauri::command]
pub fn save_note(
    current_path: Option<String>,
    folder: String,
    title: String,
    extension: String,
    content: String,
    encoding: String,
    bom: bool,
    line_ending: LineEnding,
) -> Result<NoteSaveResult, String> {
    let folder_buf = PathBuf::from(&folder);
    if !folder_buf.is_dir() {
        return Err(format!("{folder} ist kein Ordner (mehr)."));
    }

    let current = current_path.as_ref().map(PathBuf::from);
    let target = match (sanitize_title(&title), &current) {
        (Some(stem), Some(cur)) => {
            let cur_stem = cur.file_stem().map(|s| s.to_string_lossy().into_owned());
            if cur_stem.as_deref() == Some(stem.as_str()) {
                cur.clone()
            } else {
                unique_note_path(&folder_buf, &stem, &extension, Some(cur.as_path()))
            }
        }
        (Some(stem), None) => unique_note_path(&folder_buf, &stem, &extension, None),
        // Erste Zeile gerade leer (z. B. Text markiert, um ihn zu ersetzen):
        // Namen der bestehenden Notiz nicht wegen eines Zwischenzustands wechseln.
        (None, Some(cur)) => cur.clone(),
        (None, None) => unique_note_path(&folder_buf, &fallback_title(), &extension, None),
    };

    if let Some(cur) = &current {
        if cur != &target && cur.exists() {
            fs::rename(cur, &target).map_err(|e| format!("{}: {e}", cur.display()))?;
        }
    }

    let bytes = encode_with_endings(content, &encoding, bom, line_ending)?;
    let mtime_ms = write_atomic(&target, &bytes)?;

    Ok(NoteSaveResult {
        path: target.to_string_lossy().into_owned(),
        mtime_ms,
    })
}

/// Prüft, ob die Datei seit dem Laden von aussen verändert wurde.
#[tauri::command]
pub fn file_mtime(path: String) -> Result<u64, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("MISSING".to_string());
    }
    Ok(mtime_ms(&p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn erkennt_dominantes_zeilenende() {
        assert_eq!(LineEnding::detect("a\r\nb\r\nc\n"), LineEnding::Crlf);
        assert_eq!(LineEnding::detect("a\nb\nc\r\n"), LineEnding::Lf);
        assert_eq!(LineEnding::detect("a\rb\rc"), LineEnding::Cr);
        assert_eq!(
            LineEnding::detect("ohne umbruch"),
            LineEnding::platform_default()
        );
    }

    #[test]
    fn utf8_bom_wird_erkannt_und_entfernt() {
        let bytes = [0xEF, 0xBB, 0xBF, b'h', b'i'];
        let (text, enc, bom) = decode(&bytes);
        assert_eq!(text, "hi");
        assert_eq!(enc.name(), "UTF-8");
        assert!(bom);
    }

    #[test]
    fn cp1252_umlaute_ueberleben_den_roundtrip() {
        // 0xFC ist "ü" in windows-1252 und als UTF-8 ungültig.
        let bytes = [b'f', 0xFC, b'r', b' ', b'd', b'a', b's'];
        let (text, enc, _) = decode(&bytes);
        assert_eq!(text, "für das");
        let (back, _, errors) = enc.encode(&text);
        assert!(!errors);
        assert_eq!(back.as_ref(), &bytes);
    }

    #[test]
    fn titel_wird_zu_dateinamen() {
        assert_eq!(sanitize_title("Hallo wie gehts"), Some("Hallo_wie_gehts".to_string()));
        assert_eq!(sanitize_title("  viel   Leerraum  "), Some("viel_Leerraum".to_string()));
        assert_eq!(sanitize_title("a/b:c*d?e"), Some("abcde".to_string()));
        assert_eq!(sanitize_title("   "), None);
        assert_eq!(sanitize_title(""), None);
        let lang = "x".repeat(200);
        assert_eq!(sanitize_title(&lang).unwrap().chars().count(), 80);
    }

    #[test]
    fn kalenderdatum_stimmt() {
        // 2024-01-01 00:00:00 UTC == Tag 19723 seit der Epoche.
        assert_eq!(civil_from_days(19_723), (2024, 1, 1));
    }

    #[test]
    fn eindeutiger_pfad_haengt_zahl_an() {
        let dir = std::env::temp_dir().join(format!("rui-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("Notiz.md"), "x").unwrap();

        let free = unique_note_path(&dir, "Notiz", "md", None);
        assert_eq!(free.file_name().unwrap().to_str().unwrap(), "Notiz (2).md");

        // Der eigene Pfad zählt nicht als belegt.
        let own = dir.join("Notiz.md");
        let kept = unique_note_path(&dir, "Notiz", "md", Some(&own));
        assert_eq!(kept, own);

        fs::remove_dir_all(&dir).unwrap();
    }
}
