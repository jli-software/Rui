//! Laden und Speichern von Textdateien.
//!
//! Der Editor im Frontend arbeitet ausschliesslich mit UTF-8 und LF.
//! Encoding und Zeilenende der Originaldatei werden hier erkannt, im
//! Dokument mitgeführt und beim Speichern wiederhergestellt — sonst
//! schreibt der Editor stillschweigend fremde Dateien um.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::settings::NoteDateFormat;

/// Ab dieser Grösse wird nachgefragt, bevor geöffnet wird. Der Puffer lebt
/// im Webview, darüber wird das Tippgefühl spürbar zäh.
const LARGE_FILE_BYTES: u64 = 25 * 1024 * 1024;

/// Serialisiert den kurzen Bereich zwischen Versionsprüfung und Commit.
/// Eindeutige Temp-Dateien verhindern zwar gemischte Inhalte; erst dieses
/// Lock sorgt aber dafür, dass zwei Rui-Saves mit derselben Ausgangsversion
/// nicht beide erfolgreich sein können.
static SAVE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileVersion {
    pub modified_secs: u64,
    pub modified_nanos: u32,
    pub len: u64,
    #[serde(default)]
    pub metadata: u32,
    #[serde(default)]
    pub fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SavePrecondition {
    Unchanged { version: FileVersion },
    Missing,
    Any,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOutcome {
    pub mtime_ms: u64,
    pub version: FileVersion,
}

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
    /// Hochauflösende Metadaten plus SHA-256 für Save-Konflikte.
    pub version: FileVersion,
}

fn version_from_metadata(meta: &fs::Metadata) -> Result<FileVersion, String> {
    let modified = meta
        .modified()
        .map_err(|e| format!("Änderungszeit nicht lesbar: {e}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Ungültige Änderungszeit: {e}"))?;
    Ok(FileVersion {
        modified_secs: modified.as_secs(),
        modified_nanos: modified.subsec_nanos(),
        len: meta.len(),
        metadata: metadata_marker(meta),
        fingerprint: String::new(),
    })
}

#[cfg(unix)]
fn metadata_marker(meta: &fs::Metadata) -> u32 {
    use std::os::unix::fs::PermissionsExt;
    meta.permissions().mode()
}

#[cfg(windows)]
fn metadata_marker(meta: &fs::Metadata) -> u32 {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes()
}

#[cfg(not(any(unix, windows)))]
fn metadata_marker(_meta: &fs::Metadata) -> u32 {
    0
}

fn file_version(path: &Path) -> Result<FileVersion, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let before = version_from_metadata(
        &file
            .metadata()
            .map_err(|e| format!("{}: {e}", path.display()))?,
    )?;
    let mut bytes = Vec::with_capacity(before.len.min(usize::MAX as u64) as usize);
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("{}: {e}", path.display()))?;
    let mut after = version_from_metadata(
        &file
            .metadata()
            .map_err(|e| format!("{}: {e}", path.display()))?,
    )?;
    if before != after {
        return Err("FILE_CHANGED_DURING_READ".to_string());
    }
    after.fingerprint = fingerprint(&bytes);
    Ok(after)
}

fn fingerprint(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn mtime_ms(version: &FileVersion) -> u64 {
    version.modified_secs.saturating_mul(1000) + u64::from(version.modified_nanos / 1_000_000)
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
    let mut file = fs::File::open(&path_buf).map_err(|e| format!("{path}: {e}"))?;
    let meta = file.metadata().map_err(|e| format!("{path}: {e}"))?;

    if meta.is_dir() {
        return Err(format!("{path} ist ein Verzeichnis."));
    }
    if !force && meta.len() > LARGE_FILE_BYTES {
        // Vom Frontend als Rückfrage behandelt, nicht als Fehler.
        return Err(format!("LARGE_FILE:{}", meta.len()));
    }

    let before = version_from_metadata(&meta)?;
    let mut bytes = Vec::with_capacity(meta.len().min(usize::MAX as u64) as usize);
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("{path}: {e}"))?;
    let after_meta = file.metadata().map_err(|e| format!("{path}: {e}"))?;
    let mut version = version_from_metadata(&after_meta)?;
    if before != version {
        return Err("FILE_CHANGED_DURING_READ".to_string());
    }
    version.fingerprint = fingerprint(&bytes);
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
        read_only: after_meta.permissions().readonly(),
        mtime_ms: mtime_ms(&version),
        version,
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
    if bom && !matches!(enc.name(), "UTF-8" | "UTF-16LE" | "UTF-16BE") {
        return Err(format!("{} unterstützt keine Byte Order Mark.", enc.name()));
    }
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

/// Löst nur den letzten Symlink auf. So bleibt der Link selbst bestehen und
/// Rui ersetzt die Datei, auf die er zeigt. Auch ein relativer oder noch
/// dangling Link bekommt dieselbe Semantik wie ein normaler Schreibzugriff.
fn final_write_target(path: &Path) -> Result<PathBuf, String> {
    let mut current = path.to_path_buf();
    for _ in 0..40 {
        match fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                let link =
                    fs::read_link(&current).map_err(|e| format!("{}: {e}", current.display()))?;
                current = if link.is_absolute() {
                    link
                } else {
                    current
                        .parent()
                        .unwrap_or_else(|| Path::new("."))
                        .join(link)
                };
            }
            Ok(meta) if meta.is_dir() => {
                return Err(format!("{} ist ein Verzeichnis.", current.display()));
            }
            Ok(_) => return Ok(current),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(current),
            Err(e) => return Err(format!("{}: {e}", current.display())),
        }
    }
    Err(format!("{}: zu viele Symlink-Ebenen.", path.display()))
}

fn verify_precondition(path: &Path, precondition: &SavePrecondition) -> Result<bool, String> {
    if matches!(precondition, SavePrecondition::Any) {
        return match fs::metadata(path) {
            Ok(_) => Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(format!("{}: {e}", path.display())),
        };
    }
    let actual = match fs::metadata(path) {
        Ok(_) => Some(file_version(path)?),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(format!("{}: {e}", path.display())),
    };
    let valid = match precondition {
        SavePrecondition::Unchanged { version } => actual.as_ref() == Some(version),
        SavePrecondition::Missing => actual.is_none(),
        SavePrecondition::Any => unreachable!(),
    };
    if !valid {
        return Err("FILE_CHANGED".to_string());
    }
    Ok(actual.is_some())
}

#[cfg(windows)]
fn commit_temp(temp: &Path, target: &Path, target_exists: bool) -> std::io::Result<()> {
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, ReplaceFileW, SetFileAttributesW, FILE_ATTRIBUTE_NORMAL,
        MOVEFILE_WRITE_THROUGH,
    };

    let temp_w: Vec<u16> = temp.as_os_str().encode_wide().chain(once(0)).collect();
    let target_w: Vec<u16> = target.as_os_str().encode_wide().chain(once(0)).collect();
    unsafe {
        if SetFileAttributesW(temp_w.as_ptr(), FILE_ATTRIBUTE_NORMAL) == 0 {
            return Err(std::io::Error::last_os_error());
        }
        let ok = if target_exists {
            ReplaceFileW(
                target_w.as_ptr(),
                temp_w.as_ptr(),
                std::ptr::null(),
                0,
                std::ptr::null(),
                std::ptr::null(),
            )
        } else {
            MoveFileExW(temp_w.as_ptr(), target_w.as_ptr(), MOVEFILE_WRITE_THROUGH)
        };
        if ok == 0 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(())
        }
    }
}

#[cfg(not(windows))]
fn commit_temp(temp: &Path, target: &Path, target_exists: bool) -> std::io::Result<()> {
    if target_exists {
        fs::rename(temp, target)
    } else {
        // Der globale Rui-Lock schliesst interne Rennen. Ein externer
        // Prozess könnte nach der Prüfung dennoch ein Ziel anlegen; ein
        // Hardlink-Commit verhindert, dass wir es dabei überschreiben.
        fs::hard_link(temp, target)?;
        let _ = fs::remove_file(temp);
        Ok(())
    }
}

/// Erst in eine eindeutige Nachbardatei schreiben, dann plattformgerecht
/// ersetzen. Die Ausgangsversion wird unmittelbar vor dem Commit geprüft.
pub(crate) fn write_atomic(
    path: &Path,
    bytes: &[u8],
    precondition: SavePrecondition,
) -> Result<SaveOutcome, String> {
    let _guard = SAVE_LOCK
        .lock()
        .map_err(|_| "Interne Speichersperre ist beschädigt.".to_string())?;
    let target = final_write_target(path)?;
    let dir = target.parent().unwrap_or_else(|| Path::new("."));
    let old_meta = fs::metadata(&target).ok();
    let mut builder = tempfile::Builder::new();
    builder.prefix(".rui-").suffix(".tmp");
    #[cfg(unix)]
    if old_meta.is_none() {
        use std::os::unix::fs::PermissionsExt;
        builder.permissions(fs::Permissions::from_mode(0o666));
    }
    let mut temp = builder
        .tempfile_in(dir)
        .map_err(|e| format!("{}: {e}", dir.display()))?;

    temp.write_all(bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    if let Some(meta) = &old_meta {
        temp.as_file()
            .set_permissions(meta.permissions())
            .map_err(|e| format!("Dateirechte konnten nicht übernommen werden: {e}"))?;
    }
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    let mut committed_version = version_from_metadata(
        &temp
            .as_file()
            .metadata()
            .map_err(|e| format!("Temp-Datei nicht prüfbar: {e}"))?,
    )?;
    committed_version.fingerprint = fingerprint(bytes);

    let target_exists = verify_precondition(&target, &precondition)?;
    let temp_path = temp.into_temp_path();
    commit_temp(temp_path.as_ref(), &target, target_exists)
        .map_err(|e| format!("{}: {e}", target.display()))?;

    #[cfg(unix)]
    if let Ok(folder) = fs::File::open(dir) {
        // Einige Dateisysteme unterstützen fsync auf Ordnern nicht. Der
        // Datei-Commit ist dann trotzdem erfolgt; daraus darf kein falscher
        // Eindruck eines ungeschriebenen Puffers entstehen.
        let _ = folder.sync_all();
    }

    // Nach dem Commit darf ein Fehler beim erneuten Stat nicht als
    // fehlgeschlagener Write erscheinen: Die Datei ist bereits ersetzt.
    let version = file_version(&target).unwrap_or(committed_version);
    Ok(SaveOutcome {
        mtime_ms: mtime_ms(&version),
        version,
    })
}

#[tauri::command]
pub fn save_file(
    path: String,
    content: String,
    encoding: String,
    bom: bool,
    line_ending: LineEnding,
    precondition: SavePrecondition,
) -> Result<SaveOutcome, String> {
    let path_buf = PathBuf::from(&path);
    let bytes = encode_with_endings(content, &encoding, bom, line_ending)?;
    write_atomic(&path_buf, &bytes, precondition)
}

/// Zeichen, die auf Windows, macOS oder Linux in Dateinamen verboten sind
/// oder dort nur Ärger machen.
const FORBIDDEN_IN_NAMES: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

/// Einen Dateinamen-Stamm brauchbar machen: verbotene und Steuerzeichen
/// raus, Punkte und Leerraum an den Rändern weg, auf `max` Zeichen gekappt.
/// `None` heisst: davon bleibt nichts übrig.
fn sanitize_stem(stem: &str, max: usize) -> Option<String> {
    let cleaned: String = stem
        .chars()
        .filter(|c| !FORBIDDEN_IN_NAMES.contains(c) && !c.is_control())
        .collect();
    let trimmed = cleaned.trim_matches(|c: char| c == '.' || c.is_whitespace());
    // Kürzen kann am Ende wieder Leerraum freilegen, deshalb danach nochmal.
    let truncated = trimmed.chars().take(max).collect::<String>();
    let truncated = truncated.trim_end();

    if truncated.is_empty() {
        None
    } else {
        Some(truncated.to_string())
    }
}

/// Datum eines Zeitpunkts in **Lokalzeit**, im gewählten Format.
///
/// Lokalzeit, nicht UTC: eine Notiz, die um 23:30 entsteht, trüge sonst
/// dauerhaft das Datum des nächsten Tages im Dateinamen — und ein
/// Dateiname lässt sich nicht so leicht korrigieren wie eine Anzeige.
fn format_date(format: NoteDateFormat, created_at_ms: i64) -> String {
    Local
        .timestamp_millis_opt(created_at_ms)
        .single()
        // Ein unbrauchbarer Zeitstempel darf keine Notiz verhindern.
        .unwrap_or_else(Local::now)
        .format(format.pattern())
        .to_string()
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
    pub version: FileVersion,
}

/// Legt einen noch namenlosen Puffer im Notizen-Ordner ab.
///
/// Der Name kommt aus dem Datum und steht damit ab dem ersten Speichern
/// fest. Aus der ersten Zeile wird er bewusst **nicht** mehr gebildet:
/// Beim Scripting ist die erste Zeile ein Shebang, ein `#Requires` oder
/// ein Kommentar, und eine Datei, die sich beim Tippen selbst umbenennt,
/// ist keine Datei, mit der man arbeiten kann. Wer einen eigenen Namen
/// will, nimmt `:w name.ps1` oder Speichern unter.
///
/// `created_at_ms` ist die Entstehungszeit des Puffers, nicht „jetzt":
/// sonst spränge ein Puffer, der um 23:58 entstand und um 00:01
/// gespeichert wird, auf den nächsten Tag.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn save_note(
    folder: String,
    extension: String,
    content: String,
    encoding: String,
    bom: bool,
    line_ending: LineEnding,
    date_format: NoteDateFormat,
    created_at_ms: i64,
) -> Result<NoteSaveResult, String> {
    let folder_buf = PathBuf::from(&folder);
    if !folder_buf.is_dir() {
        return Err(format!("{folder} ist kein Ordner (mehr)."));
    }

    let stem = sanitize_stem(&format_date(date_format, created_at_ms), 120)
        // Nur erreichbar, wenn selbst das Datum wegsaniert würde. Dann ist
        // ein fester Name immer noch besser als eine verlorene Notiz.
        .unwrap_or_else(|| "Notiz".to_string());
    let target = unique_note_path(&folder_buf, &stem, &extension, None);

    let bytes = encode_with_endings(content, &encoding, bom, line_ending)?;
    let outcome = write_atomic(&target, &bytes, SavePrecondition::Missing)?;

    Ok(NoteSaveResult {
        path: target.to_string_lossy().into_owned(),
        mtime_ms: outcome.mtime_ms,
        version: outcome.version,
    })
}

/// Löst ein Ziel aus `:w <pfad>` zu einem absoluten Pfad auf.
///
/// Wie in Vim: Ein relativer Pfad gilt gegen das Verzeichnis der offenen
/// Datei, `~` gegen das Benutzerverzeichnis. Fehlt beides — ein frischer,
/// namenloser Puffer —, springt `fallback` ein (der Notizen-Ordner).
///
/// Ein Ziel, dessen Verzeichnis es nicht gibt, wird hier abgelehnt statt
/// erst beim Schreiben: `:w tsets/x.ps1` soll sich melden, nicht still
/// nichts tun.
#[tauri::command]
pub fn resolve_save_path(
    input: String,
    base: Option<String>,
    fallback: Option<String>,
) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Kein Dateiname angegeben.".to_string());
    }

    let expanded = match trimmed.strip_prefix('~') {
        Some(rest) => {
            let home = dirs_home().ok_or("Kein Benutzerverzeichnis gefunden.")?;
            home.join(rest.trim_start_matches(['/', '\\']))
        }
        None => PathBuf::from(trimmed),
    };

    let absolute = if expanded.is_absolute() {
        expanded
    } else {
        let root = base
            .map(PathBuf::from)
            .or_else(|| fallback.map(PathBuf::from))
            .or_else(dirs_home)
            .ok_or("Kein Ordner, gegen den der Name gelten könnte.")?;
        root.join(expanded)
    };

    if absolute.is_dir() {
        return Err(format!("{} ist ein Verzeichnis.", absolute.display()));
    }
    match absolute.parent() {
        Some(dir) if !dir.as_os_str().is_empty() && !dir.is_dir() => {
            return Err(format!("Den Ordner {} gibt es nicht.", dir.display()));
        }
        _ => {}
    }

    Ok(absolute.to_string_lossy().into_owned())
}

/// Das Benutzerverzeichnis, ohne dafür eine Abhängigkeit zu holen.
fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
}

/// Prüft, ob die Datei seit dem Laden von aussen verändert wurde.
#[tauri::command]
pub fn file_mtime(path: String) -> Result<u64, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("MISSING".to_string());
    }
    Ok(mtime_ms(&version_from_metadata(
        &fs::metadata(&p).map_err(|e| format!("{path}: {e}"))?,
    )?))
}

/// Hochauflösende Revision für Konfliktprüfung und Fokus-Überwachung.
#[tauri::command]
pub fn current_file_version(path: String) -> Result<FileVersion, String> {
    let p = PathBuf::from(&path);
    match fs::metadata(&p) {
        Ok(_) => file_version(&p),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err("MISSING".to_string()),
        Err(e) => Err(format!("{path}: {e}")),
    }
}

/// Prüft vorhandene Ziele nach kanonischem Pfad. Das verhindert, dass
/// Speichern unter über einen Symlink einen zweiten schreibbaren Tab für
/// dieselbe Datei erzeugt.
#[tauri::command]
pub fn same_file(first: String, second: String) -> Result<bool, String> {
    let a = fs::canonicalize(&first).map_err(|e| format!("{first}: {e}"))?;
    let b = fs::canonicalize(&second).map_err(|e| format!("{second}: {e}"))?;
    #[cfg(windows)]
    return Ok(a
        .to_string_lossy()
        .eq_ignore_ascii_case(&b.to_string_lossy()));
    #[cfg(not(windows))]
    Ok(a == b)
}

/// Ergebnis des Umbenennens: der neue Pfad und die Zeit, die die Datei
/// danach trägt.
///
/// Die `mtime` muss mit zurück, sonst hält Ruis Prüfung auf fremde
/// Änderungen die eigene Umbenennung für einen fremden Zugriff und fragt,
/// ob neu geladen werden soll.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Renamed {
    pub path: String,
    pub mtime_ms: u64,
    pub version: FileVersion,
}

/// Benennt eine Datei im selben Ordner um.
///
/// `name` ist ein reiner Dateiname, kein Pfad: Umbenennen im Reiter soll
/// die Datei nicht heimlich verschieben können — wer sie woanders haben
/// will, nimmt „Speichern unter". Ein bestehendes Ziel wird nicht
/// überschrieben; das ist der Fall, in dem ein Vertipper sonst zwei
/// Dateien zu einer macht.
#[tauri::command]
pub fn rename_file(
    path: String,
    name: String,
    expected_version: FileVersion,
) -> Result<Renamed, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Der Name darf nicht leer sein.".to_string());
    }
    if name.contains(['/', '\\']) || Path::new(name).components().count() != 1 {
        return Err("Der Name darf keinen Pfad enthalten.".to_string());
    }
    // Windows lehnt diese Zeichen im Dateinamen ab; unter Linux wären sie
    // erlaubt, aber eine Datei mit `?` im Namen ist auch dort niemandes
    // Absicht — und Rui-Dateien wandern zwischen beiden Systemen.
    if name.contains(['<', '>', ':', '"', '|', '?', '*']) {
        return Err("Im Namen sind < > : \" | ? * nicht erlaubt.".to_string());
    }
    // Steuerzeichen sieht man im Eingabefeld nicht, und eine Tastatur kann
    // sie hineinbefördern, ohne dass jemand es merkt. Ein Dateiname, den
    // man nicht lesen kann, ist auch keiner.
    if name.chars().any(|c| c.is_control()) {
        return Err("Im Namen stehen unsichtbare Steuerzeichen.".to_string());
    }
    // `.` und `..` meinen Ordner, nicht Dateien.
    if name.chars().all(|c| c == '.') {
        return Err("Der Name darf nicht nur aus Punkten bestehen.".to_string());
    }

    let _guard = SAVE_LOCK
        .lock()
        .map_err(|_| "Interne Speichersperre ist beschädigt.".to_string())?;
    let source = PathBuf::from(&path);
    if !source.exists() {
        return Err("FILE_CHANGED".to_string());
    }
    verify_precondition(
        &source,
        &SavePrecondition::Unchanged {
            version: expected_version.clone(),
        },
    )?;
    let folder = source
        .parent()
        .ok_or_else(|| format!("{path}: kein übergeordneter Ordner."))?;
    let target = folder.join(name);

    if target == source {
        return Ok(Renamed {
            path,
            mtime_ms: mtime_ms(&expected_version),
            version: expected_version,
        });
    }
    // `exists()` statt einfach umbenennen: `fs::rename` überschreibt unter
    // Unix wortlos, und unter Windows scheitert es — dieselbe Eingabe
    // hätte also je nach System zwei Ausgänge.
    if target.exists() {
        return Err(format!(
            "\u{201e}{name}\u{201c} gibt es in diesem Ordner bereits."
        ));
    }

    fs::rename(&source, &target).map_err(|e| format!("{path}: {e}"))?;
    Ok(Renamed {
        path: target.to_string_lossy().into_owned(),
        mtime_ms: mtime_ms(&expected_version),
        version: expected_version,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_reste(dir: &Path) -> Vec<PathBuf> {
        fs::read_dir(dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with(".rui-"))
            })
            .collect()
    }

    #[test]
    fn atomar_ersetzt_bestehende_datei() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("überraschung.txt");
        fs::write(&path, "alt").unwrap();
        let version = file_version(&path).unwrap();

        let result = write_atomic(
            &path,
            b"neuer inhalt",
            SavePrecondition::Unchanged { version },
        )
        .unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"neuer inhalt");
        assert_eq!(result.version, file_version(&path).unwrap());
        assert!(temp_reste(dir.path()).is_empty());
    }

    #[test]
    fn fremde_revision_wird_nicht_ueberschrieben() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("text.txt");
        fs::write(&path, "basis").unwrap();
        let expected = file_version(&path).unwrap();
        fs::write(&path, "fremde und laengere aenderung").unwrap();

        let error = write_atomic(
            &path,
            b"rui",
            SavePrecondition::Unchanged { version: expected },
        )
        .unwrap_err();

        assert_eq!(error, "FILE_CHANGED");
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "fremde und laengere aenderung"
        );
        assert!(temp_reste(dir.path()).is_empty());
    }

    #[test]
    fn fingerprint_erkennt_gleich_lange_aenderung_mit_gleicher_mtime() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gleich.txt");
        fs::write(&path, "ABCDE").unwrap();
        let expected = file_version(&path).unwrap();
        fs::write(&path, "VWXYZ").unwrap();
        filetime::set_file_mtime(
            &path,
            filetime::FileTime::from_unix_time(
                expected.modified_secs as i64,
                expected.modified_nanos,
            ),
        )
        .unwrap();

        assert_eq!(
            write_atomic(
                &path,
                b"RUI!!",
                SavePrecondition::Unchanged { version: expected },
            )
            .unwrap_err(),
            "FILE_CHANGED"
        );
        assert_eq!(fs::read_to_string(path).unwrap(), "VWXYZ");
    }

    #[test]
    fn neues_ziel_wird_nicht_ueberschrieben() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("neu.txt");
        fs::write(&path, "inzwischen angelegt").unwrap();

        assert_eq!(
            write_atomic(&path, b"rui", SavePrecondition::Missing).unwrap_err(),
            "FILE_CHANGED"
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "inzwischen angelegt");
    }

    #[test]
    fn zwei_saves_mit_gleicher_basis_lassen_nur_einen_durch() {
        use std::sync::{Arc, Barrier};

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("konkurrenz.txt");
        fs::write(&path, "basis").unwrap();
        let version = file_version(&path).unwrap();
        let barrier = Arc::new(Barrier::new(3));

        let handles: Vec<_> = [b"erste version".as_slice(), b"zweitefassung".as_slice()]
            .into_iter()
            .map(|bytes| {
                let path = path.clone();
                let barrier = Arc::clone(&barrier);
                let bytes = bytes.to_vec();
                let expected = version.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    write_atomic(
                        &path,
                        &bytes,
                        SavePrecondition::Unchanged { version: expected },
                    )
                })
            })
            .collect();
        barrier.wait();
        let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();

        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(results.iter().filter(|result| result.is_err()).count(), 1);
        let final_bytes = fs::read(&path).unwrap();
        assert!(final_bytes == b"erste version" || final_bytes == b"zweitefassung");
        assert!(temp_reste(dir.path()).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn unix_rechte_und_symlink_bleiben_erhalten() {
        use std::os::unix::fs::{symlink, MetadataExt, PermissionsExt};

        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("ziel.txt");
        let link = dir.path().join("link.txt");
        fs::write(&target, "alt").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o751)).unwrap();
        symlink("ziel.txt", &link).unwrap();
        let version = file_version(&link).unwrap();

        write_atomic(&link, b"neu", SavePrecondition::Unchanged { version }).unwrap();

        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "neu");
        assert_eq!(fs::metadata(&target).unwrap().mode() & 0o7777, 0o751);
    }

    #[cfg(unix)]
    #[test]
    fn neue_datei_respektiert_umask_wie_file_create() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let referenz = dir.path().join("referenz.txt");
        let neu = dir.path().join("neu.txt");
        fs::write(&referenz, "x").unwrap();
        write_atomic(&neu, b"x", SavePrecondition::Missing).unwrap();

        let mode = |path: &Path| fs::metadata(path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&neu), mode(&referenz));
    }

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
    fn bom_wird_nur_fuer_passende_encodings_akzeptiert() {
        assert!(encode_with_endings("text".into(), "UTF-8", true, LineEnding::Lf).is_ok());
        assert!(
            encode_with_endings("text".into(), "windows-1252", true, LineEnding::Lf)
                .unwrap_err()
                .contains("keine Byte Order Mark")
        );
    }

    /// Ein fester Zeitpunkt in Lokalzeit, damit die Tests in jeder
    /// Zeitzone dasselbe erwarten dürfen.
    fn zeitpunkt(h: u32, min: u32) -> i64 {
        Local
            .with_ymd_and_hms(2026, 8, 28, h, min, 0)
            .unwrap()
            .timestamp_millis()
    }

    #[test]
    fn dateiname_behaelt_leerzeichen() {
        // Das Leerzeichen zwischen Datum und Uhrzeit muss bleiben — nur
        // die in Dateinamen verbotenen Zeichen fliegen raus.
        assert_eq!(
            sanitize_stem("2026-08-28 1423", 120),
            Some("2026-08-28 1423".to_string())
        );
        assert_eq!(sanitize_stem("a:b", 120), Some("ab".to_string()));
        assert_eq!(sanitize_stem("   ", 120), None);
        // Kürzen darf keinen Leerraum am Ende zurücklassen.
        assert_eq!(sanitize_stem("abc def", 4), Some("abc".to_string()));
    }

    #[test]
    fn datum_kommt_aus_der_lokalzeit() {
        // 22:30 lokal: mit UTC statt Lokalzeit stünde östlich von Greenwich
        // der 29. im Namen. Der Test schlägt fehl, sobald jemand
        // `format_date` auf `Utc` umstellt — ausser die Maschine steht
        // selbst auf UTC, wo die Frage nicht existiert.
        assert_eq!(
            format_date(NoteDateFormat::Ymd, zeitpunkt(22, 30)),
            "2026-08-28"
        );
        assert_eq!(
            format_date(NoteDateFormat::YmdCompactHm, zeitpunkt(9, 5)),
            "20260828-0905"
        );
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

    #[test]
    fn relativer_name_gilt_gegen_den_ordner_der_offenen_datei() {
        let dir = std::env::temp_dir();
        let base = dir.to_string_lossy().into_owned();

        // `:w notiz.ps1` neben der offenen Datei.
        let ziel = resolve_save_path("notiz.ps1".into(), Some(base.clone()), None).unwrap();
        assert_eq!(PathBuf::from(&ziel).parent().unwrap(), dir.as_path());
        assert!(ziel.ends_with("notiz.ps1"));

        // Ohne offene Datei springt der Notizen-Ordner ein.
        let ziel = resolve_save_path("notiz.ps1".into(), None, Some(base)).unwrap();
        assert_eq!(PathBuf::from(&ziel).parent().unwrap(), dir.as_path());
    }

    #[test]
    fn absoluter_pfad_bleibt_unangetastet() {
        let ziel = std::env::temp_dir().join("rui-absolut.txt");
        let text = ziel.to_string_lossy().into_owned();
        assert_eq!(
            resolve_save_path(text.clone(), Some("/anderswo".into()), None).unwrap(),
            text
        );
    }

    #[test]
    fn umbenennen_bleibt_im_ordner_und_ueberschreibt_nicht() {
        let dir = std::env::temp_dir().join(format!("rui-rename-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let quelle = dir.join("alt.txt");
        fs::write(&quelle, "inhalt").unwrap();
        let pfad = quelle.to_string_lossy().into_owned();
        let version = file_version(&quelle).unwrap();

        let neu = rename_file(pfad.clone(), "neu.ps1".into(), version).unwrap();
        assert_eq!(PathBuf::from(&neu.path).parent().unwrap(), dir.as_path());
        assert!(neu.path.ends_with("neu.ps1"));
        assert!(!quelle.exists());
        assert_eq!(fs::read_to_string(&neu.path).unwrap(), "inhalt");

        // Ein Pfad im Namen würde die Datei verschieben — das tut Umbenennen nicht.
        assert!(rename_file(neu.path.clone(), "unten/x.txt".into(), neu.version.clone()).is_err());
        assert!(rename_file(neu.path.clone(), "  ".into(), neu.version.clone()).is_err());
        // Unsichtbares und Punkte-Namen ebenso: beides sieht man dem
        // Eingabefeld nicht an, wenn es einmal drinsteht.
        assert!(rename_file(
            neu.path.clone(),
            "mit\u{7f}steuerzeichen.md".into(),
            neu.version.clone(),
        )
        .is_err());
        assert!(rename_file(neu.path.clone(), "..".into(), neu.version.clone()).is_err());

        // Und ein belegter Name darf die andere Datei nicht schlucken.
        fs::write(dir.join("besetzt.txt"), "fremd").unwrap();
        assert!(rename_file(neu.path.clone(), "besetzt.txt".into(), neu.version).is_err());
        assert_eq!(
            fs::read_to_string(dir.join("besetzt.txt")).unwrap(),
            "fremd"
        );

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn umbenennen_lehnt_fremde_aenderung_ab() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("alt.txt");
        fs::write(&source, "basis").unwrap();
        let expected = file_version(&source).unwrap();
        fs::write(&source, "extern und laenger").unwrap();

        assert_eq!(
            rename_file(
                source.to_string_lossy().into_owned(),
                "neu.txt".into(),
                expected,
            )
            .unwrap_err(),
            "FILE_CHANGED"
        );
        assert!(source.exists());
        assert!(!dir.path().join("neu.txt").exists());
        assert_eq!(fs::read_to_string(source).unwrap(), "extern und laenger");
    }

    #[test]
    fn nicht_vorhandener_ordner_wird_gemeldet() {
        let base = std::env::temp_dir().to_string_lossy().into_owned();
        // Ein Tippfehler im Ordner darf nicht still ins Leere schreiben.
        let fehler = resolve_save_path("gibt-es-nicht/x.ps1".into(), Some(base), None);
        assert!(fehler.is_err(), "fehlender Ordner muss ein Fehler sein");
        // Leerer Name ebenso — `:w` ohne Argument geht einen anderen Weg.
        assert!(resolve_save_path("   ".into(), None, None).is_err());
    }
}
