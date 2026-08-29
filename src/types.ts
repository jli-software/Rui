export type LineEnding = "lf" | "crlf" | "cr";
export type Theme = "sage-light" | "sage-dark" | "system";
export type NoteExtension = "md" | "txt";
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

/** Spiegelt `quick_open::QuickOpenFile` auf der Rust-Seite. */
export interface QuickOpenFile {
  path: string;
  name: string;
  relativePath: string;
  /** Der durchsuchte Ordner, aus dem die Datei stammt. */
  root: string;
  modifiedMs: number;
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

  autosave: boolean;
  autosaveDelayMs: number;

  notesFolder: string | null;
  noteExtension: NoteExtension;
  noteDateFormat: NoteDateFormat;

  searchFolders: string[];
  searchOpenFileFolder: boolean;
}

/** Spiegelt `settings::TabSession` — ein Tab, wie er den Neustart übersteht. */
export interface TabSession {
  path: string | null;
  unsavedContent: string | null;
  cursor: number;
  scrollTop: number;
  encoding: string | null;
  lineEnding: LineEnding | null;
  bom: boolean;
  createdAtMs: number | null;
  languageOverride: string | null;
}

/** Spiegelt `settings::Session` — alle offenen Tabs und der aktive. */
export interface Session {
  tabs: TabSession[];
  active: number;
}

/**
 * Ein offener Puffer — alles, was Rui über die Datei dahinter weiss.
 *
 * Seit 0.4.0 hält jeder Tab genau einen davon; was der Editor beim
 * Wechsel mitbringen muss (CodeMirror-Zustand, Sprache), steht im `Tab`
 * in `tabs.ts` daneben. Die Trennung hält diesen Typ auf dem, was auch
 * `document.rs` kennt.
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
   * Wann dieser Puffer entstanden ist (Epoche in ms). Ein namenloser
   * Puffer wird hieraus benannt und nicht aus der aktuellen Zeit — sonst
   * trüge eine um 23:58 begonnene Notiz das Datum des nächsten Tages.
   */
  createdAtMs: number;
}
