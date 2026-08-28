import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog, save as saveDialog, ask, message } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { openSearchPanel } from "@codemirror/search";
import { undo, redo } from "@codemirror/commands";

import { RuiEditor } from "./editor";
import { CommandPalette, promptInput, type Command } from "./palette";
import { SettingsDialog } from "./settings-ui";
import { StatusBar } from "./statusbar";
import { TitleBar } from "./titlebar";
import { omarchyPalette, sageDark, sageLight } from "./theme";
import { LANGUAGES, detectLanguage, dialogFilters, type LanguageDef } from "./languages";
import type {
  Buffer,
  DecorationMode,
  LineEnding,
  LoadedDocument,
  OmarchyColors,
  ResolvedDecoration,
  Session,
  Settings,
} from "./types";

import "./styles.css";

const ENCODINGS = ["UTF-8", "windows-1252", "ISO-8859-1", "UTF-16LE", "UTF-16BE"];

class App {
  private editor!: RuiEditor;
  private palette!: CommandPalette;
  private settingsDialog!: SettingsDialog;
  private status!: StatusBar;
  private titlebar!: TitleBar;
  private omarchyAvailable = false;

  private settings!: Settings;
  private buffer!: Buffer;
  private language: LanguageDef = LANGUAGES[0];

  /** Sprache, die der Nutzer von Hand gewählt hat; überschreibt die Erkennung. */
  private languageOverride: string | null = null;
  private sessionTimer: number | undefined;
  private instantSaveTimer: number | undefined;
  private closing = false;

  async start() {
    this.settings = await invoke<Settings>("load_settings");
    this.buffer = this.emptyBuffer();

    const host = document.querySelector<HTMLElement>("#editor")!;
    this.editor = new RuiEditor(
      host,
      this.settings,
      "",
      {
        onChange: () => this.onChanged(),
        onCursor: () => this.refreshStatus(),
        onVimMode: (status) => this.status.setVimMode(status),
      },
      {
        // `:w` und `:q` laufen über Ruis eigene Wege — sonst schriebe Vim
        // an `document.rs` vorbei und damit am Encoding der Datei.
        write: () => this.save(),
        quit: (force) => void this.quit(force),
      },
    );

    this.palette = new CommandPalette(() => this.commands());
    this.settingsDialog = new SettingsDialog(
      () => this.settings,
      (s) => void this.updateSettings(s),
      () => void this.openSettingsFile(),
      () => void this.resetSettings(),
    );
    this.status = new StatusBar(document.querySelector<HTMLElement>("#status")!, {
      onPosition: () => void this.gotoLine(),
      onLanguage: () => this.pickLanguage(),
      onEncoding: () => this.pickEncoding(),
      onLineEnding: () => this.pickLineEnding(),
      onSettings: () => this.settingsDialog.open(),
    });
    this.titlebar = new TitleBar(document.querySelector<HTMLElement>("#titlebar")!);

    this.bindShortcuts();
    this.bindWindowEvents();
    this.watchSystemTheme();
    // Vor dem Öffnen der Datei: `loadDocument` baut den Editorzustand neu
    // auf und soll die Steuerung schon enthalten.
    await this.editor.applyVimMode();
    await this.applyDecoration(this.settings.decorationMode);
    await this.refreshOmarchyTheme();

    await this.restoreStartupDocument();

    this.refreshStatus();
    await getCurrentWindow().show();
    this.editor.view.focus();
  }

  // ---- Puffer -----------------------------------------------------------

  private emptyBuffer(): Buffer {
    return {
      path: null,
      encoding: this.settings.defaultEncoding,
      bom: false,
      lineEnding: this.settings.defaultLineEnding,
      readOnly: false,
      mtimeMs: 0,
      savedContent: "",
      createdAtMs: Date.now(),
      autoNamed: false,
    };
  }

  private get isModified() {
    return this.editor.content !== this.buffer.savedContent;
  }

  private get fileName() {
    if (!this.buffer.path) return "Unbenannt";
    return this.buffer.path.split(/[\\/]/).pop() ?? "Unbenannt";
  }

  private onChanged() {
    this.refreshStatus();
    this.scheduleSessionSave();
    this.scheduleInstantSave();
  }

  private refreshStatus() {
    this.status.update(this.editor.cursorInfo(), this.buffer, this.language.name, this.isModified);
    const mark = this.isModified ? "• " : "";
    const title = `${mark}${this.fileName} — Rui`;
    void getCurrentWindow().setTitle(title);
    this.titlebar.setTitle(title);
  }

  private async setLanguage(lang: LanguageDef) {
    this.language = lang;
    await this.editor.applyLanguage(lang);
    this.refreshStatus();
  }

  // ---- Dateien ----------------------------------------------------------

  private async confirmDiscard(): Promise<boolean> {
    if (!this.isModified || !this.settings.confirmOnClose) return true;
    return ask(`"${this.fileName}" enthält ungespeicherte Änderungen. Verwerfen?`, {
      title: "Rui",
      kind: "warning",
      okLabel: "Verwerfen",
      cancelLabel: "Abbrechen",
    });
  }

  private async newFile() {
    if (!(await this.confirmDiscard())) return;
    this.buffer = this.emptyBuffer();
    this.languageOverride = null;
    this.editor.loadDocument("");
    this.editor.setReadOnly(false);
    await this.setLanguage(LANGUAGES[0]);
  }

  private async openFileDialog() {
    const selected = await openDialog({ multiple: false, filters: dialogFilters() });
    if (typeof selected === "string") await this.openPath(selected);
  }

  async openPath(path: string, force = false) {
    if (!force && !(await this.confirmDiscard())) return;

    let doc: LoadedDocument;
    try {
      doc = await invoke<LoadedDocument>("open_file", { path, force });
    } catch (err) {
      const text = String(err);
      // Grosse Dateien sind kein Fehler, sondern eine Rückfrage.
      const large = text.match(/^LARGE_FILE:(\d+)$/);
      if (large) {
        const mb = (Number(large[1]) / 1024 / 1024).toFixed(1);
        const proceed = await ask(
          `Diese Datei ist ${mb} MB gross. Rui ist auf Snippets ausgelegt und wird damit spürbar langsamer. Trotzdem öffnen?`,
          { title: "Grosse Datei", kind: "warning", okLabel: "Öffnen" },
        );
        if (proceed) await this.openPath(path, true);
        return;
      }
      await message(text, { title: "Öffnen fehlgeschlagen", kind: "error" });
      return;
    }

    this.buffer = {
      path: doc.path,
      encoding: doc.encoding,
      bom: doc.bom,
      lineEnding: doc.lineEnding,
      readOnly: doc.readOnly,
      mtimeMs: doc.mtimeMs,
      savedContent: doc.content,
      createdAtMs: Date.now(),
      // Von Hand geöffnet — wird nie umbenannt, auch nicht im Notizen-Ordner.
      autoNamed: false,
    };
    this.languageOverride = null;
    this.editor.loadDocument(doc.content);
    this.editor.setReadOnly(doc.readOnly);
    await this.setLanguage(detectLanguage(doc.path));
    this.scheduleSessionSave();
  }

  private async save(): Promise<boolean> {
    if (!this.buffer.path) return this.saveAs();
    return this.writeTo(this.buffer.path);
  }

  private async saveAs(): Promise<boolean> {
    const target = await saveDialog({
      defaultPath: this.buffer.path ?? this.fileName,
      filters: dialogFilters(),
    });
    if (!target) return false;
    const ok = await this.writeTo(target);
    // Von Hand benannt — wird ab jetzt nicht mehr automatisch umbenannt.
    if (ok) this.buffer.autoNamed = false;
    if (ok && !this.languageOverride) await this.setLanguage(detectLanguage(target));
    return ok;
  }

  private async writeTo(path: string): Promise<boolean> {
    // Aufräumen beim Speichern verändert den Text, den der Nutzer sieht.
    // Deshalb passiert es im Editor und nicht still beim Schreiben —
    // so bleibt es sichtbar und mit Strg+Z widerrufbar.
    this.applySaveTransforms();
    const content = this.editor.content;

    try {
      const mtime = await invoke<number>("save_file", {
        path,
        content,
        encoding: this.buffer.encoding,
        bom: this.buffer.bom,
        lineEnding: this.buffer.lineEnding,
      });
      this.buffer.path = path;
      this.buffer.savedContent = content;
      this.buffer.mtimeMs = mtime;
      this.buffer.readOnly = false;
      this.refreshStatus();
      this.scheduleSessionSave();
      return true;
    } catch (err) {
      const text = String(err);
      // Encoding kann den Text nicht darstellen: UTF-8 anbieten.
      if (text.includes("nicht darstellen kann")) {
        const useUtf8 = await ask(text, {
          title: "Encoding",
          kind: "warning",
          okLabel: "Als UTF-8 speichern",
        });
        if (useUtf8) {
          this.buffer.encoding = "UTF-8";
          return this.writeTo(path);
        }
        return false;
      }
      await message(text, { title: "Speichern fehlgeschlagen", kind: "error" });
      return false;
    }
  }

  private applySaveTransforms() {
    const s = this.settings;
    if (!s.trimTrailingWhitespace && !s.ensureFinalNewline) return;

    let text = this.editor.content;
    if (s.trimTrailingWhitespace) text = text.replace(/[ \t]+$/gm, "");
    if (s.ensureFinalNewline && text.length > 0 && !text.endsWith("\n")) text += "\n";
    if (text === this.editor.content) return;

    this.editor.view.dispatch({
      changes: { from: 0, to: this.editor.view.state.doc.length, insert: text },
      // Cursor möglichst an der alten Stelle lassen.
      selection: {
        anchor: Math.min(this.editor.view.state.selection.main.anchor, text.length),
      },
    });
  }

  /** Meldet, wenn ein anderes Programm die offene Datei verändert hat. */
  private async checkExternalChange() {
    if (!this.settings.watchExternalChanges || !this.buffer.path || this.closing) return;

    let mtime: number;
    try {
      mtime = await invoke<number>("file_mtime", { path: this.buffer.path });
    } catch {
      return; // Datei ist weg — beim nächsten Speichern wird sie neu angelegt.
    }
    if (mtime === this.buffer.mtimeMs) return;

    // Erst merken, sonst fragt der nächste Fokuswechsel gleich nochmal.
    this.buffer.mtimeMs = mtime;

    const reload = await ask(
      this.isModified
        ? `"${this.fileName}" wurde ausserhalb von Rui geändert. Neu laden und die eigenen Änderungen verwerfen?`
        : `"${this.fileName}" wurde ausserhalb von Rui geändert. Neu laden?`,
      { title: "Datei geändert", kind: "warning", okLabel: "Neu laden", cancelLabel: "Behalten" },
    );
    if (reload) await this.openPath(this.buffer.path, true);
  }

  // ---- Notizen-Ordner (Instant-Save) -------------------------------------

  private scheduleInstantSave() {
    if (!this.settings.notesFolder) return;
    window.clearTimeout(this.instantSaveTimer);
    // Kurz gedrosselt statt bei jedem Tastendruck, aber kurz genug, dass es
    // sich anfühlt, als würde einfach immer alles schon gespeichert sein.
    this.instantSaveTimer = window.setTimeout(
      () => void this.instantSave(),
      this.settings.instantSaveDelayMs,
    );
  }

  private async instantSave() {
    const folder = this.settings.notesFolder;
    if (!folder) return;

    const content = this.editor.content;
    if (content === this.buffer.savedContent) return;

    // Absichtlich ohne applySaveTransforms(): das Aufräumen verändert den
    // Text sichtbar und würde mitten im Tippen ein gerade eingegebenes
    // Leerzeichen wieder wegputzen. Das bleibt dem expliziten Speichern
    // vorbehalten.
    try {
      if (this.buffer.path === null || this.buffer.autoNamed) {
        if (this.buffer.path === null && content.trim() === "") return;

        const wasUnnamed = this.buffer.path === null;
        const result = await invoke<{ path: string; mtimeMs: number }>("save_note", {
          currentPath: this.buffer.path,
          folder,
          title: content.split("\n")[0] ?? "",
          extension: this.settings.noteExtension,
          content,
          encoding: this.buffer.encoding,
          bom: this.buffer.bom,
          lineEnding: this.buffer.lineEnding,
          titleSource: this.settings.noteTitleSource,
          dateFormat: this.settings.noteDateFormat,
          createdAtMs: this.buffer.createdAtMs,
        });
        this.buffer.path = result.path;
        this.buffer.autoNamed = true;
        this.buffer.mtimeMs = result.mtimeMs;
        if (wasUnnamed && !this.languageOverride) await this.setLanguage(detectLanguage(result.path));
      } else {
        this.buffer.mtimeMs = await invoke<number>("save_file", {
          path: this.buffer.path,
          content,
          encoding: this.buffer.encoding,
          bom: this.buffer.bom,
          lineEnding: this.buffer.lineEnding,
        });
      }
      this.buffer.savedContent = content;
      this.refreshStatus();
    } catch (err) {
      // Keine Modal-Flut bei jedem Tastendruck — der nächste Tick
      // versucht es erneut, solange sich der Text weiter ändert.
      console.error("Instant-Save fehlgeschlagen:", err);
    }
  }

  // ---- Sitzung ----------------------------------------------------------

  private scheduleSessionSave() {
    if (!this.settings.restoreSession) return;
    window.clearTimeout(this.sessionTimer);
    // Gedrosselt: die Sitzung ist ein Sicherheitsnetz, keine Datenbank.
    this.sessionTimer = window.setTimeout(() => void this.saveSession(), 1500);
  }

  private async saveSession() {
    if (!this.settings.restoreSession) return;
    const session: Session = {
      path: this.buffer.path,
      unsavedContent: this.isModified ? this.editor.content : null,
      cursor: this.editor.view.state.selection.main.head,
      scrollTop: this.editor.view.scrollDOM.scrollTop,
      encoding: this.buffer.encoding,
      lineEnding: this.buffer.lineEnding,
      bom: this.buffer.bom,
      createdAtMs: this.buffer.createdAtMs,
      autoNamed: this.buffer.autoNamed,
    };
    try {
      await invoke("save_session", { session });
    } catch {
      // Eine nicht schreibbare Sitzungsdatei darf nichts blockieren.
    }
  }

  /**
   * Reihenfolge beim Start: Kommandozeile schlägt Sitzung. Wer eine Datei
   * per Doppelklick öffnet, will diese sehen und nicht den alten Puffer.
   */
  private async restoreStartupDocument() {
    const files = await invoke<string[]>("startup_files");
    if (files.length > 0) {
      await this.openPath(files[0], true);
      return;
    }
    if (!this.settings.restoreSession) return;

    const session = await invoke<Session>("load_session");
    if (session.path) {
      await this.openPath(session.path, true);
    }
    // Nach `openPath` gesetzt: das legt den Puffer neu an und würde die
    // Entstehungszeit sonst auf jetzt und `autoNamed` auf false stellen.
    // Ohne beides verlöre eine selbst benannte Notiz über den Neustart
    // hinweg ihr Umbenennen und bekäme das Datum von heute.
    if (session.createdAtMs) this.buffer.createdAtMs = session.createdAtMs;
    this.buffer.autoNamed = session.autoNamed;
    if (session.unsavedContent !== null && session.unsavedContent !== undefined) {
      // Der ungespeicherte Stand gewinnt gegen den Dateiinhalt — sonst
      // wäre das Sicherheitsnetz nutzlos.
      this.editor.loadDocument(session.unsavedContent);
      if (session.encoding) this.buffer.encoding = session.encoding;
      if (session.lineEnding) this.buffer.lineEnding = session.lineEnding;
      this.buffer.bom = session.bom;
    }
    if (session.cursor) {
      const max = this.editor.view.state.doc.length;
      this.editor.view.dispatch({
        selection: { anchor: Math.min(session.cursor, max) },
        scrollIntoView: true,
      });
    }
  }

  // ---- Einstellungen ----------------------------------------------------

  private async updateSettings(next: Settings) {
    const prev = this.settings;
    this.settings = next;
    this.editor.applySettings(next);

    if (prev.syntaxHighlighting !== next.syntaxHighlighting) {
      await this.editor.applyLanguage(this.language);
    }
    if (prev.decorationMode !== next.decorationMode) {
      await this.applyDecoration(next.decorationMode);
    }
    if (prev.vimMode !== next.vimMode) {
      await this.editor.applyVimMode();
      // Nach dem Umschalten gehört der Fokus zurück in den Text, sonst
      // tippt man ins Leere und hält die Steuerung für kaputt.
      this.editor.view.focus();
    }
    this.refreshStatus();
    try {
      await invoke("save_settings", { settings: next });
    } catch (err) {
      await message(String(err), { title: "Einstellungen", kind: "error" });
    }
  }

  private async resetSettings() {
    const sure = await ask("Alle Einstellungen auf den Standard zurücksetzen?", {
      title: "Einstellungen",
      okLabel: "Zurücksetzen",
    });
    if (!sure) return;
    // Eine leere Datei bedeutet: überall greifen die Defaults aus dem Code.
    await invoke("save_settings", { settings: {} });
    this.settings = await invoke<Settings>("load_settings");
    this.editor.applySettings(this.settings);
    await this.editor.applyLanguage(this.language);
    await this.editor.applyVimMode();
    this.settingsDialog.refresh();
    this.refreshStatus();
  }

  private async openSettingsFile() {
    const path = await invoke<string>("settings_path");
    // Sicherstellen, dass die Datei existiert, bevor sie geöffnet wird.
    await invoke("save_settings", { settings: this.settings });
    await openPath(path);
  }

  private watchSystemTheme() {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      // Läuft Omarchy, bestimmt dessen Theme Hell/Dunkel — die
      // CSS-Systemeinstellung wäre dann nur ein zweiter, widersprüchlicher
      // Auslöser.
      if (this.settings.theme === "system" && !this.omarchyAvailable) {
        this.editor.applySettings(this.settings);
      }
    });
  }

  // ---- Fensterdekoration --------------------------------------------------

  private async applyDecoration(mode: DecorationMode) {
    const resolved = await invoke<ResolvedDecoration>("resolve_decoration", { mode });
    document.body.dataset.decoration = resolved.mode;
    await getCurrentWindow().setDecorations(resolved.mode === "native");
  }

  // ---- Omarchy-Theme --------------------------------------------------------

  private async refreshOmarchyTheme() {
    this.omarchyAvailable = await invoke<boolean>("omarchy_available");
    if (!this.omarchyAvailable) {
      this.editor.setOmarchyPalette(null);
      return;
    }
    try {
      const colors = await invoke<OmarchyColors>("load_omarchy_theme");
      const dark = colors.mode !== "light";
      const palette = omarchyPalette(colors, dark ? sageDark : sageLight);
      this.editor.setOmarchyPalette({ palette, dark });
    } catch (err) {
      // Theme kaputt oder unlesbar — lieber Sage zeigen als gar nichts.
      console.error("Omarchy-Theme konnte nicht gelesen werden:", err);
      this.editor.setOmarchyPalette(null);
    }
  }

  // ---- Auswahllisten in der Statusleiste --------------------------------

  private pickFrom(items: Command[]) {
    const previous = this.commandsOverride;
    this.commandsOverride = items;
    this.palette.open(() => {
      this.commandsOverride = previous;
    });
  }

  private commandsOverride: Command[] | null = null;

  private pickLanguage() {
    this.pickFrom(
      LANGUAGES.map((lang) => ({
        id: `lang.${lang.id}`,
        group: "Sprache",
        title: lang.name,
        state: () => (lang.id === this.language.id ? "aktiv" : ""),
        run: async () => {
          this.languageOverride = lang.id;
          await this.setLanguage(lang);
        },
      })),
    );
  }

  private pickEncoding() {
    this.pickFrom([
      ...ENCODINGS.map((enc) => ({
        id: `enc.${enc}`,
        group: "Encoding",
        title: enc,
        state: () => (enc === this.buffer.encoding ? "aktiv" : ""),
        run: () => {
          this.buffer.encoding = enc;
          this.refreshStatus();
        },
      })),
      {
        id: "enc.bom",
        group: "Encoding",
        title: "Byte Order Mark schreiben",
        state: () => (this.buffer.bom ? "an" : "aus"),
        run: () => {
          this.buffer.bom = !this.buffer.bom;
          this.refreshStatus();
        },
      },
    ]);
  }

  private pickLineEnding() {
    const options: [LineEnding, string][] = [
      ["lf", "LF — Unix, macOS"],
      ["crlf", "CRLF — Windows"],
      ["cr", "CR — klassisches Mac OS"],
    ];
    this.pickFrom(
      options.map(([value, label]) => ({
        id: `eol.${value}`,
        group: "Zeilenende",
        title: label,
        state: () => (value === this.buffer.lineEnding ? "aktiv" : ""),
        run: () => {
          this.buffer.lineEnding = value;
          this.refreshStatus();
        },
      })),
    );
  }

  /**
   * `:q` aus der Vim-Steuerung. Geht bewusst denselben Weg wie das
   * Fensterkreuz, damit Sitzung und Rückfrage nicht umgangen werden.
   */
  private async quit(force: boolean) {
    const win = getCurrentWindow();
    if (!force) {
      await win.close();
      return;
    }
    // `:q!` fragt nicht nach. Die Sitzung wird trotzdem geschrieben: sie
    // ist Ruis Sicherheitsnetz, nicht die Datei, die man verwerfen wollte.
    await this.saveSession();
    this.closing = true;
    await win.destroy();
  }

  private async gotoLine() {
    const answer = await promptInput("Gehe zu Zeile", "");
    const line = Number(answer);
    if (Number.isInteger(line) && line > 0) this.editor.gotoLine(line);
    else this.editor.view.focus();
  }

  // ---- Befehle ----------------------------------------------------------

  private toggle(key: keyof Settings, title: string, group = "Ansicht"): Command {
    return {
      id: `toggle.${key}`,
      group,
      title,
      state: () => (this.settings[key] ? "an" : "aus"),
      run: () => this.updateSettings({ ...this.settings, [key]: !this.settings[key] }),
    };
  }

  private commands(): Command[] {
    if (this.commandsOverride) return this.commandsOverride;

    return [
      { id: "file.new", group: "Datei", title: "Neu", shortcut: "Strg+N", run: () => this.newFile() },
      {
        id: "file.open",
        group: "Datei",
        title: "Öffnen…",
        shortcut: "Strg+O",
        run: () => this.openFileDialog(),
      },
      { id: "file.save", group: "Datei", title: "Speichern", shortcut: "Strg+S", run: () => this.save() },
      {
        id: "file.saveAs",
        group: "Datei",
        title: "Speichern unter…",
        shortcut: "Strg+Umschalt+S",
        run: () => this.saveAs(),
      },
      {
        id: "file.reveal",
        group: "Datei",
        title: "Im Dateimanager zeigen",
        run: async () => {
          if (this.buffer.path) await openPath(this.buffer.path.replace(/[\\/][^\\/]+$/, ""));
        },
      },
      {
        id: "file.copyPath",
        group: "Datei",
        title: "Pfad kopieren",
        run: async () => {
          if (this.buffer.path) await navigator.clipboard.writeText(this.buffer.path);
        },
      },

      {
        id: "edit.find",
        group: "Bearbeiten",
        title: "Suchen und ersetzen",
        shortcut: "Strg+F",
        run: () => {
          openSearchPanel(this.editor.view);
        },
      },
      {
        id: "edit.goto",
        group: "Bearbeiten",
        title: "Gehe zu Zeile…",
        shortcut: "Strg+G",
        run: () => this.gotoLine(),
      },
      {
        id: "edit.undo",
        group: "Bearbeiten",
        title: "Rückgängig",
        shortcut: "Strg+Z",
        run: () => {
          undo(this.editor.view);
        },
      },
      {
        id: "edit.redo",
        group: "Bearbeiten",
        title: "Wiederholen",
        shortcut: "Strg+Y",
        run: () => {
          redo(this.editor.view);
        },
      },

      this.toggle("wordWrap", "Zeilenumbruch"),
      this.toggle("lineNumbers", "Zeilennummern"),
      this.toggle("relativeLineNumbers", "Relative Zeilennummern"),
      this.toggle("showWhitespace", "Leerzeichen sichtbar"),
      this.toggle("highlightActiveLine", "Aktuelle Zeile hervorheben"),
      this.toggle("syntaxHighlighting", "Syntaxhervorhebung"),
      this.toggle("vimMode", "Vim-Steuerung", "Eingabe"),
      {
        id: "view.theme",
        group: "Ansicht",
        title: "Farbschema wechseln",
        state: () =>
          ({ "sage-light": "Hell", "sage-dark": "Dunkel", system: "Automatisch" })[
            this.settings.theme
          ],
        run: () => {
          const order = ["system", "sage-light", "sage-dark"] as const;
          const next = order[(order.indexOf(this.settings.theme) + 1) % order.length];
          return this.updateSettings({ ...this.settings, theme: next });
        },
      },
      {
        id: "view.zoomIn",
        group: "Ansicht",
        title: "Schrift vergrössern",
        shortcut: "Strg++",
        run: () => this.zoom(1),
      },
      {
        id: "view.zoomOut",
        group: "Ansicht",
        title: "Schrift verkleinern",
        shortcut: "Strg+-",
        run: () => this.zoom(-1),
      },
      {
        id: "view.zoomReset",
        group: "Ansicht",
        title: "Schriftgrösse zurücksetzen",
        shortcut: "Strg+0",
        run: () => this.updateSettings({ ...this.settings, fontSize: 14 }),
      },

      { id: "lang.pick", group: "Sprache", title: "Sprache wählen…", run: () => this.pickLanguage() },
      { id: "enc.pick", group: "Encoding", title: "Encoding wählen…", run: () => this.pickEncoding() },
      {
        id: "eol.pick",
        group: "Zeilenende",
        title: "Zeilenende wählen…",
        run: () => this.pickLineEnding(),
      },
      {
        id: "app.settings",
        group: "Rui",
        title: "Einstellungen…",
        shortcut: "Strg+,",
        run: () => this.settingsDialog.open(),
      },
    ];
  }

  private zoom(delta: number) {
    const size = Math.max(8, Math.min(32, this.settings.fontSize + delta));
    return this.updateSettings({ ...this.settings, fontSize: size });
  }

  // ---- Tastatur und Fenster ---------------------------------------------

  private bindShortcuts() {
    window.addEventListener(
      "keydown",
      (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;

        // Was die Palette oder ein Dialog gerade selbst braucht, bleibt dort.
        if (this.palette.isOpen && e.key !== "," ) return;

        const key = e.key.toLowerCase();
        const run = (fn: () => unknown) => {
          e.preventDefault();
          e.stopPropagation();
          void fn();
        };

        if (e.shiftKey && key === "p") return run(() => this.palette.open());
        if (e.shiftKey && key === "s") return run(() => this.saveAs());
        if (e.shiftKey) return;

        switch (key) {
          case "n":
            return run(() => this.newFile());
          case "o":
            return run(() => this.openFileDialog());
          case "s":
            return run(() => this.save());
          case "g":
            return run(() => this.gotoLine());
          case ",":
            return run(() => this.settingsDialog.open());
          case "+":
          case "=":
            return run(() => this.zoom(1));
          case "-":
            return run(() => this.zoom(-1));
          case "0":
            return run(() => this.updateSettings({ ...this.settings, fontSize: 14 }));
        }
      },
      true,
    );
  }

  private bindWindowEvents() {
    const win = getCurrentWindow();

    void win.onCloseRequested(async (event) => {
      if (this.closing) return;
      event.preventDefault();

      await this.saveSession();
      // Bei aktiver Sitzungswiederherstellung ist der Puffer gesichert,
      // eine Rückfrage wäre dann nur im Weg.
      if (!this.settings.restoreSession && !(await this.confirmDiscard())) return;

      this.closing = true;
      await win.destroy();
    });

    // Externe Änderungen prüfen, sobald das Fenster wieder aktiv wird.
    void win.onFocusChanged(({ payload: focused }) => {
      if (focused) void this.checkExternalChange();
    });

    // Zweite Instanz hat eine Datei weitergereicht.
    void listen<string[]>("rui://open-files", (event) => {
      const [first] = event.payload;
      if (first) void this.openPath(first);
    });

    // Omarchy-Themenwechsel — läuft komplett dateibasiert, kein Neustart nötig.
    void listen("rui://omarchy-theme-changed", () => void this.refreshOmarchyTheme());

    // Datei aufs Fenster ziehen.
    void getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      const [first] = event.payload.paths;
      if (first) void this.openPath(first);
    });

    window.addEventListener("beforeunload", () => void this.saveSession());
  }
}

// Wenn der Start scheitert, darf das Fenster nicht unsichtbar bleiben —
// eine App, die auf ein Doppelklick hin gar nichts tut, ist schlimmer als
// eine mit einer Fehlermeldung.
void new App().start().catch(async (err) => {
  console.error("Rui konnte nicht starten:", err);
  document.body.innerHTML =
    '<div style="padding:24px;font:13px/1.6 system-ui">' +
    "<h1 style=\"font-size:15px;margin-bottom:8px\">Rui konnte nicht starten</h1>" +
    '<pre style="white-space:pre-wrap;color:var(--danger)"></pre></div>';
  document.querySelector("pre")!.textContent = String(err);
  await getCurrentWindow().show();
});
