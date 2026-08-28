export type LineEnding = "lf" | "crlf" | "cr";
export type Theme = "sage-light" | "sage-dark" | "system";
export type NoteExtension = "md" | "txt";
/** Woraus der Dateiname einer selbst benannten Notiz entsteht. */
export type NoteTitleSource = "first-line" | "date" | "date-first-line" | "first-line-date";
export type NoteDateFormat = "ymd" | "ymd-hm" | "ymd-compact" | "ymd-compact-hm" | "dmy";
export type DecorationMode = "auto" | "native" | "custom" | "none";
/** Nach `auto`-Auflösung — nie `auto` selbst. */
export type ResolvedDecorationMode = "native" | "custom" | "none";

export interface ResolvedDecoration {
  mode: ResolvedDecorationMode;
  reason: string;
}

/** Spiegelt `omarchy::OmarchyColors` — jedes Feld kann fehlen. */
export interface OmarchyColors {
  mode?: string;
  accent?: string;
  selection?: string;
  muted?: string;
  background?: string;
  darkBackground?: string;
  darkerBackground?: string;
  lighterBackground?: string;
  foreground?: string;
  darkForeground?: string;
  lightForeground?: string;
  brightForeground?: string;
  red?: string;
  yellow?: string;
  orange?: string;
  green?: string;
  cyan?: string;
  blue?: string;
  magenta?: string;
  brown?: string;
}

/** Spiegelt `document::Document` auf der Rust-Seite. */
export interface LoadedDocument {
  path: string | null;
  content: string;
  encoding: string;
  bom: boolean;
  lineEnding: LineEnding;
  readOnly: boolean;
  mtimeMs: number;
}

/** Spiegelt `settings::Settings` auf der Rust-Seite. */
export interface Settings {
  theme: Theme;
  decorationMode: DecorationMode;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  lineNumbers: boolean;
  relativeLineNumbers: boolean;
  highlightActiveLine: boolean;
  showWhitespace: boolean;
  wordWrap: boolean;
  syntaxHighlighting: boolean;

  tabSize: number;
  insertSpaces: boolean;
  autoIndent: boolean;
  bracketMatching: boolean;
  closeBrackets: boolean;
  vimMode: boolean;

  trimTrailingWhitespace: boolean;
  ensureFinalNewline: boolean;
  defaultEncoding: string;
  defaultLineEnding: LineEnding;

  restoreSession: boolean;
  watchExternalChanges: boolean;
  confirmOnClose: boolean;

  notesFolder: string | null;
  noteExtension: NoteExtension;
  noteTitleSource: NoteTitleSource;
  noteDateFormat: NoteDateFormat;
  instantSaveDelayMs: number;
}

export interface Session {
  path: string | null;
  unsavedContent: string | null;
  cursor: number;
  scrollTop: number;
  encoding: string | null;
  lineEnding: LineEnding | null;
  bom: boolean;
  createdAtMs: number | null;
  autoNamed: boolean;
}

/**
 * Ein offener Puffer.
 *
 * Aktuell gibt es immer genau einen davon. Der Zustand ist aber bewusst
 * hier gebündelt statt über Modulvariablen verstreut, damit Tabs später
 * nur eine Liste von Buffers brauchen statt einer Umbau-Aktion.
 */
export interface Buffer {
  path: string | null;
  encoding: string;
  bom: boolean;
  lineEnding: LineEnding;
  readOnly: boolean;
  mtimeMs: number;
  /** Inhalt beim letzten Laden/Speichern, für den Modified-Vergleich. */
  savedContent: string;
  /**
   * Wann dieser Puffer entstanden ist (Epoche in ms). Steht das Datum im
   * Dateinamen, wird es hieraus gebildet und nicht aus der aktuellen Zeit —
   * sonst wanderte eine Notiz beim Umbenennen kurz nach Mitternacht auf
   * den nächsten Tag.
   */
  createdAtMs: number;
  /**
   * Wurde dieser Puffer im Notizen-Ordner selbst benannt (statt von Hand
   * geöffnet oder unter einem gewählten Namen gespeichert)? Nur solche
   * Puffer werden umbenannt, wenn sich die erste Zeile ändert.
   */
  autoNamed: boolean;
}
