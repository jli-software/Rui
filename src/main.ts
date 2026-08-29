import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog, save as saveDialog, ask, message } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { openSearchPanel } from "@codemirror/search";
import { undo, redo } from "@codemirror/commands";

import { AboutDialog } from "./about";
import { RuiEditor } from "./editor";
import { refresh as readClipboard, write as writeClipboard } from "./clipboard";
import { CommandPalette, promptInput, type Command } from "./palette";
import { QuickOpen } from "./quick-open";
import { ShortcutsOverlay } from "./shortcuts";
import { SettingsDialog } from "./settings-ui";
import { StatusBar } from "./statusbar";
import { TabBar, tabTitle, type Tab } from "./tabs";
import { TitleBar } from "./titlebar";
import { omarchyPalette, sageDark, sageLight } from "./theme";
import {
  LANGUAGES,
  detectLanguage,
  dialogFilters,
  textFileExtensions,
  type LanguageDef,
} from "./languages";
import type {
  Buffer,
  DecorationMode,
  LineEnding,
  LoadedDocument,
  OmarchyColors,
  QuickOpenFile,
  ResolvedDecoration,
  Session,
  Settings,
  TabSession,
} from "./types";

import "./styles.css";

const ENCODINGS = ["UTF-8", "windows-1252", "ISO-8859-1", "UTF-16LE", "UTF-16BE"];

/**
 * Wohin eine Datei geöffnet wird.
 *
 * `tab` macht einen Reiter auf — der Weg von Quick Open, Dateidialog und
 * Drag-and-drop. `current` ersetzt den Puffer im sichtbaren Tab, wie Vims
 * `:e` es tut.
 */
type OpenTarget = "tab" | "current";

class App {
  private editor!: RuiEditor;
  private palette!: CommandPalette;
  private quickOpen!: QuickOpen;
  private settingsDialog!: SettingsDialog;
  private shortcuts!: ShortcutsOverlay;
  private about!: AboutDialog;
  private titlebar!: TitleBar;
  private omarchyAvailable = false;

  private status!: StatusBar;
  private tabBar!: TabBar;

  private settings!: Settings;
  /** Alle offenen Tabs. Es ist immer mindestens einer da. */
  private tabs: Tab[] = [];
  private activeIndex = 0;
  private nextTabId = 1;
  private sessionTimer: number | undefined;
  private autosaveTimer: number | undefined;
  /** Ob ein Autosave aussteht — der Tabwechsel muss ihn vorher ausführen. */
  private autosavePending = false;
  private closing = false;

  async start() {
    this.settings = await invoke<Settings>("load_settings");

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
        // `:w`, `:e` und `:q` laufen über Ruis eigene Wege — sonst schriebe
        // Vim an `document.rs` vorbei und damit am Encoding der Datei.
        write: (target) => this.save(target),
        edit: (target, force) => this.edit(target, force),
        quit: (force) => void this.quit(force),
        quitAll: (force) => void this.quitAll(force),
        tabNew: (target) => void this.edit(target, false, "tab"),
        tabCycle: (delta) => void this.cycleTab(delta),
        tabClose: (force) => void this.closeTab(this.tab.id, force),
      },
    );

    // Der erste Tab hält den Zustand, den der Editor gerade gebaut hat.
    this.tabs = [this.freshTab()];

    // Jedes Overlay gibt den Fokus beim Schliessen an den Text zurück.
    // Ohne das bleibt er im versteckten Dialog hängen, und der nächste
    // Tastendruck landet nirgendwo — der Editor wirkt dann eingefroren.
    const backToText = () => this.editor.view.focus();

    this.palette = new CommandPalette(() => this.commands(), backToText);
    this.settingsDialog = new SettingsDialog(
      () => this.settings,
      (s) => void this.updateSettings(s),
      () => void this.openSettingsFile(),
      () => void this.resetSettings(),
      backToText,
    );
    this.shortcuts = new ShortcutsOverlay({
      commands: () => this.commands(),
      vimMode: () => this.settings.vimMode,
      onClose: backToText,
    });
    this.about = new AboutDialog({
      flash: (text) => this.status.flash(text),
      onClose: backToText,
    });
    this.quickOpen = new QuickOpen({
      load: () => {
        const folders = this.searchFolders();
        return folders.length > 0
          ? invoke<QuickOpenFile[]>("list_note_files", {
              folders,
              extensions: textFileExtensions(),
            })
          : Promise.resolve(null);
      },
      scope: () => this.searchFolders(),
      open: (path) => void this.openPath(path),
      openNative: () => void this.openFileDialog(),
      openSettings: () => this.settingsDialog.open(),
      onClose: () => this.editor.view.focus(),
    });
    this.status = new StatusBar(document.querySelector<HTMLElement>("#status")!, {
      onPosition: () => void this.gotoLine(),
      onLanguage: () => this.pickLanguage(),
      onEncoding: () => this.pickEncoding(),
      onLineEnding: () => this.pickLineEnding(),
      onSettings: () => this.settingsDialog.open(),
      onShortcuts: () => this.shortcuts.toggle(),
      onAbout: () => this.about.toggle(),
      onFile: () => void this.copyPath(),
    });
    this.tabBar = new TabBar(document.querySelector<HTMLElement>("#tabs")!, {
      onSelect: (id) => void this.activate(this.indexOf(id)),
      onClose: (id) => void this.closeTab(id),
      onNew: () => void this.newTab(),
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

    await this.restoreTabs();

    this.refreshStatus();
    await getCurrentWindow().show();
    this.editor.view.focus();
  }

  /**
   * Welche Ordner `Strg+O` durchsucht, in dieser Reihenfolge: der
   * Notizen-Ordner, die zusätzlich eingestellten, und zuletzt der Ordner der
   * offenen Datei.
   *
   * Der letzte steht bewusst nicht in den Einstellungen: Wer eine Logdatei
   * von Hand geöffnet hat, will als Nächstes fast immer eine daneben, und
   * dieser Ordner ist bereits bekannt.
   */
  private searchFolders(): string[] {
    const folders: string[] = [];
    const add = (folder: string | null) => {
      if (!folder) return;
      const known = folders.some((f) => f.toLowerCase() === folder.toLowerCase());
      if (!known) folders.push(folder);
    };

    add(this.settings.notesFolder);
    for (const folder of this.settings.searchFolders) add(folder);
    if (this.settings.searchOpenFileFolder) add(parentFolder(this.buffer.path));
    return folders;
  }

  // ---- Tabs -------------------------------------------------------------

  /** Der sichtbare Tab. Es gibt immer mindestens einen. */
  private get tab(): Tab {
    return this.tabs[this.activeIndex];
  }

  private get buffer(): Buffer {
    return this.tab.buffer;
  }

  private get language(): LanguageDef {
    return this.tab.language;
  }

  private indexOf(id: number): number {
    return this.tabs.findIndex((tab) => tab.id === id);
  }

  /**
   * Der Text eines Tabs.
   *
   * Der sichtbare hat keinen eigenen `state` — sein Text steht in der
   * View, und nur dort ist er aktuell.
   */
  private contentOf(tab: Tab): string {
    return tab === this.tab ? this.editor.content : (tab.state?.doc.toString() ?? "");
  }

  private isModifiedTab(tab: Tab): boolean {
    return this.contentOf(tab) !== tab.buffer.savedContent;
  }

  /** Ein leerer Tab mit dem Zustand, der gerade im Editor steht. */
  private freshTab(): Tab {
    return {
      id: this.nextTabId++,
      buffer: this.emptyBuffer(),
      language: LANGUAGES[0],
      languageOverride: null,
      state: null,
      scrollTop: 0,
      modified: false,
    };
  }

  /**
   * Legt den Zustand des sichtbaren Tabs weg, bevor ein anderer ihn
   * ablöst. Danach lebt der Text dieses Tabs in seinem `state` und nicht
   * mehr in der View.
   */
  private stash(tab: Tab) {
    tab.state = this.editor.snapshot();
    tab.scrollTop = this.editor.view.scrollDOM.scrollTop;
    tab.modified = this.isModifiedTab(tab);
  }

  /**
   * Zeigt den aktiven Tab an.
   *
   * Die Compartments werden danach durchgehend nachgezogen: Ein Zustand,
   * der vor einer Einstellungsänderung weggelegt wurde, trüge sonst die
   * alte Konfiguration zurück — ein Tab käme etwa ohne Zeilennummern
   * wieder, nur weil er beim Umschalten nicht sichtbar war.
   */
  private async show(checkExternal = true) {
    const tab = this.tab;
    this.editor.restore(tab.state ?? this.editor.freshState(""));
    tab.state = null;
    this.editor.applySettings(this.settings);
    await this.editor.applyVimMode();
    await this.editor.applyLanguage(tab.language);
    this.editor.setReadOnly(tab.buffer.readOnly);
    // Zweimal: Direkt nach `setState` hat CodeMirror die Zeilen noch nicht
    // gemessen, der Inhalt ist womöglich gar nicht hoch genug, um so weit
    // zu scrollen. Der zweite Griff sitzt, sofern nicht inzwischen wieder
    // umgeschaltet wurde.
    const top = tab.scrollTop;
    this.editor.view.scrollDOM.scrollTop = top;
    requestAnimationFrame(() => {
      if (this.tab === tab) this.editor.view.scrollDOM.scrollTop = top;
    });
    this.refreshStatus();
    this.scheduleSessionSave();
    if (checkExternal) void this.checkExternalChange();
  }

  /** Wechselt zu einem Tab. */
  private async activate(index: number) {
    if (index < 0 || index >= this.tabs.length || index === this.activeIndex) return;
    // Ein Autosave, der noch aussteht, gehört dem Tab, der gerade sichtbar
    // ist — nach dem Wechsel fände sein Timer den falschen Puffer vor.
    await this.flushAutosave();
    this.stash(this.tab);
    this.activeIndex = index;
    await this.show();
  }

  /** Einen Tab weiter, mit Umlauf an beiden Enden. */
  private async cycleTab(delta: number) {
    const count = this.tabs.length;
    if (count < 2) return;
    await this.activate((this.activeIndex + delta + count) % count);
  }

  /**
   * Legt einen Tab an und zeigt ihn an.
   *
   * Er kommt direkt rechts neben den aktiven, nicht ans Ende: Wer aus
   * einer Datei heraus die nächste öffnet, findet sie daneben.
   */
  private async addTab(init: {
    buffer: Buffer;
    content: string;
    language: LanguageDef;
    languageOverride?: string | null;
  }) {
    await this.flushAutosave();
    if (this.tabs.length > 0) this.stash(this.tab);

    const tab: Tab = {
      id: this.nextTabId++,
      buffer: init.buffer,
      language: init.language,
      languageOverride: init.languageOverride ?? null,
      state: this.editor.freshState(init.content),
      scrollTop: 0,
      modified: init.content !== init.buffer.savedContent,
    };
    const at = this.tabs.length === 0 ? 0 : this.activeIndex + 1;
    this.tabs.splice(at, 0, tab);
    this.activeIndex = at;
    await this.show();
  }

  /** Strg+T und Strg+N — ein leerer Tab. */
  private async newTab() {
    await this.addTab({ buffer: this.emptyBuffer(), content: "", language: LANGUAGES[0] });
  }

  /**
   * Schliesst einen Tab.
   *
   * Anders als beim Fenster fängt die Sitzung einen geschlossenen Tab
   * **nicht** auf — sie merkt sich, was offen ist. Deshalb wird hier auch
   * bei eingeschalteter Sitzungswiederherstellung gefragt.
   */
  private async closeTab(id: number, force = false): Promise<boolean> {
    const index = this.indexOf(id);
    if (index < 0) return false;
    const tab = this.tabs[index];

    if (!force && this.settings.confirmOnClose && this.isModifiedTab(tab)) {
      const discard = await ask(
        `"${tabTitle(tab)}" enthält ungespeicherte Änderungen. Verwerfen?`,
        {
          title: "Tab schliessen",
          kind: "warning",
          okLabel: "Verwerfen",
          cancelLabel: "Abbrechen",
        },
      );
      if (!discard) return false;
    }

    // Der letzte Tab wird geleert statt geschlossen: Rui ohne Puffer gibt
    // es nicht, und ein Editor, der beim Schliessen des letzten Reiters
    // ganz verschwindet, nimmt einem die Entscheidung ab. `:q` geht
    // bewusst den anderen Weg — siehe `quit()`.
    if (this.tabs.length === 1) {
      this.cancelAutosave();
      this.tabs[0] = this.freshTab();
      this.activeIndex = 0;
      this.editor.loadDocument("");
      this.editor.setReadOnly(false);
      await this.setLanguage(LANGUAGES[0]);
      this.scheduleSessionSave();
      return true;
    }

    if (index !== this.activeIndex) {
      if (index < this.activeIndex) this.activeIndex--;
      this.tabs.splice(index, 1);
      this.refreshStatus();
      this.scheduleSessionSave();
      return true;
    }

    this.cancelAutosave();
    this.tabs.splice(index, 1);
    // Nach rechts weiterrücken, am Ende nach links — wie im Browser.
    this.activeIndex = Math.min(index, this.tabs.length - 1);
    await this.show();
    return true;
  }

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
    };
  }

  private get isModified() {
    return this.editor.content !== this.buffer.savedContent;
  }

  /** Ob eine Datei schon in einem Tab offen ist. */
  private openTabFor(path: string): number {
    return this.tabs.findIndex((tab) => samePath(tab.buffer.path, path));
  }

  /**
   * Ein leerer, unberührter Tab — in den darf eine Datei direkt hinein,
   * statt einen zweiten aufzumachen und einen unbenutzten stehen zu
   * lassen.
   */
  private get isScratch(): boolean {
    return !this.buffer.path && !this.isModified;
  }

  private get fileName() {
    if (!this.buffer.path) return "Unbenannt";
    return this.buffer.path.split(/[\\/]/).pop() ?? "Unbenannt";
  }

  private onChanged() {
    this.refreshStatus();
    this.scheduleSessionSave();
    this.scheduleAutosave();
  }

  private refreshStatus() {
    const modified = this.isModified;
    this.status.update(
      this.editor.cursorInfo(),
      this.buffer,
      this.language.name,
      modified,
      this.settings.autosave,
    );
    this.tab.modified = modified;
    this.tabBar.render(this.tabs, this.tab.id);

    const mark = modified ? "• " : "";
    const title = `${mark}${this.fileName} — Rui`;
    void getCurrentWindow().setTitle(title);
    this.titlebar.setTitle(title);
  }

  private async setLanguage(lang: LanguageDef) {
    this.tab.language = lang;
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

  /** Mehrere Dateien nacheinander öffnen — jede in ihrem Tab. */
  private async openAll(paths: string[]) {
    for (const path of paths) await this.openPath(path);
  }

  /**
   * Rückfrage vor dem Schliessen des Fensters, wenn irgendein Tab
   * ungespeichert ist. Bis 0.3.10 gab es nur einen Puffer, um den es
   * gehen konnte.
   */
  private async confirmUnsaved(): Promise<boolean> {
    if (!this.settings.confirmOnClose) return true;
    const dirty = this.tabs.filter((tab) => this.isModifiedTab(tab));
    if (dirty.length === 0) return true;

    const names = dirty.map((tab) => `„${tabTitle(tab)}"`).join(", ");
    const text =
      dirty.length === 1
        ? `${names} enthält ungespeicherte Änderungen. Verwerfen?`
        : `${dirty.length} Tabs enthalten ungespeicherte Änderungen (${names}). Verwerfen?`;
    return ask(text, {
      title: "Rui",
      kind: "warning",
      okLabel: "Verwerfen",
      cancelLabel: "Abbrechen",
    });
  }

  private async openFileDialog() {
    const selected = await openDialog({ multiple: true, filters: dialogFilters() });
    const paths = typeof selected === "string" ? [selected] : (selected ?? []);
    for (const path of paths) await this.openPath(path);
  }

  /**
   * Eine Datei öffnen.
   *
   * Ohne Angabe landet sie in einem eigenen Tab — ist sie schon offen,
   * springt Rui stattdessen dorthin, statt dieselbe Datei zweimal
   * bearbeitbar zu machen. `where: "current"` ersetzt den Puffer im
   * sichtbaren Tab; das ist Vims `:e`.
   */
  async openPath(path: string, options: { force?: boolean; where?: OpenTarget } = {}) {
    const where = options.where ?? "tab";
    const force = options.force ?? false;

    if (where === "tab") {
      const open = this.openTabFor(path);
      if (open >= 0) {
        await this.activate(open);
        return;
      }
    }
    if (where === "current" && !force && !(await this.confirmDiscard())) return;

    const doc = await this.readDocument(path, force);
    if (!doc) return;

    const buffer: Buffer = {
      path: doc.path,
      encoding: doc.encoding,
      bom: doc.bom,
      lineEnding: doc.lineEnding,
      readOnly: doc.readOnly,
      mtimeMs: doc.mtimeMs,
      savedContent: doc.content,
      createdAtMs: Date.now(),
    };
    const language = detectLanguage(doc.path);

    if (where === "tab" && !this.isScratch) {
      await this.addTab({ buffer, content: doc.content, language });
      return;
    }

    this.cancelAutosave();
    this.tab.buffer = buffer;
    this.tab.languageOverride = null;
    this.editor.loadDocument(doc.content);
    this.editor.setReadOnly(doc.readOnly);
    await this.setLanguage(language);
    this.scheduleSessionSave();
  }

  /**
   * Liest eine Datei über `document.rs`. `null` heisst: Der Nutzer hat
   * abgebrochen oder die Datei ist nicht lesbar — beides wurde ihm hier
   * bereits gesagt.
   */
  private async readDocument(path: string, force: boolean): Promise<LoadedDocument | null> {
    try {
      return await invoke<LoadedDocument>("open_file", { path, force });
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
        return proceed ? this.readDocument(path, true) : null;
      }
      await message(text, { title: "Öffnen fehlgeschlagen", kind: "error" });
      return null;
    }
  }

  /**
   * Speichern von Hand — Strg+S und `:w`.
   *
   * `target` ist das Argument aus `:w notiz.ps1`. Ohne Argument und ohne
   * Dateinamen legt Rui den Puffer im Notizen-Ordner ab; gibt es auch den
   * nicht, fragt der Dateidialog nach dem Ort. Ein Puffer wird nie
   * gespeichert, ohne dass jemand danach gefragt hat: Genau das war der
   * Fehler, den Autosave-an-Notizen-Ordner gemacht hat.
   */
  private async save(target?: string): Promise<boolean> {
    const ok = await this.saveInternal(target);
    // Ohne Rückmeldung sagt ein `:w` nichts darüber, ob und wohin
    // geschrieben wurde — bei einem Puffer, der seinen Namen erst beim
    // Speichern bekommt, ist genau das die Frage.
    if (ok && this.buffer.path) this.status.flash(`„${shortName(this.buffer.path)}" geschrieben`);
    return ok;
  }

  private saveInternal(target?: string): Promise<boolean> {
    if (target !== undefined) return this.saveTo(target);
    if (this.buffer.path) return this.writeTo(this.buffer.path);
    if (this.settings.notesFolder) return this.saveNote();
    return this.saveAs();
  }

  /**
   * `:w <name>` — den Namen wie Vim auflösen und dorthin schreiben.
   *
   * Ein bestehender Puffer folgt danach der neuen Datei; die alte bleibt
   * unangetastet liegen. Das ist Vims Verhalten und das erwartbarste:
   * `:w kopie.ps1` soll eine Kopie machen und nichts verschieben.
   */
  private async saveTo(target: string): Promise<boolean> {
    let path: string;
    try {
      path = await invoke<string>("resolve_save_path", {
        input: target,
        base: parentFolder(this.buffer.path),
        fallback: this.settings.notesFolder,
      });
    } catch (err) {
      await message(String(err), { title: "Speichern fehlgeschlagen", kind: "error" });
      return false;
    }

    // Eine fremde Datei nicht wortlos überschreiben — `:w!` gibt es in Rui
    // (noch) nicht, also fragt Rui stattdessen.
    if (path !== this.buffer.path && (await this.exists(path))) {
      const overwrite = await ask(`"${shortName(path)}" gibt es bereits. Überschreiben?`, {
        title: "Speichern",
        kind: "warning",
        okLabel: "Überschreiben",
      });
      if (!overwrite) return false;
    }

    const ok = await this.writeTo(path);
    if (ok && !this.tab.languageOverride) await this.setLanguage(detectLanguage(path));
    return ok;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await invoke<number>("file_mtime", { path });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Einen namenlosen Puffer im Notizen-Ordner ablegen.
   *
   * Der Name kommt aus dem Datum — nicht mehr aus der ersten Zeile. Beim
   * Scripting steht dort ein Shebang oder ein `#Requires`, und eine Datei,
   * die sich beim Tippen selbst umbenennt, ist keine, mit der man
   * arbeiten kann. Wer einen eigenen Namen will: `:w name.ps1`.
   */
  private async saveNote(): Promise<boolean> {
    const folder = this.settings.notesFolder;
    if (!folder) return this.saveAs();

    this.applySaveTransforms();
    try {
      const result = await invoke<{ path: string; mtimeMs: number }>("save_note", {
        folder,
        extension: this.settings.noteExtension,
        content: this.editor.content,
        encoding: this.buffer.encoding,
        bom: this.buffer.bom,
        lineEnding: this.buffer.lineEnding,
        dateFormat: this.settings.noteDateFormat,
        createdAtMs: this.buffer.createdAtMs,
      });
      this.buffer.path = result.path;
      this.buffer.mtimeMs = result.mtimeMs;
      this.buffer.savedContent = this.editor.content;
      this.refreshStatus();
      this.scheduleSessionSave();
      if (!this.tab.languageOverride) await this.setLanguage(detectLanguage(result.path));
      return true;
    } catch (err) {
      await message(String(err), { title: "Speichern fehlgeschlagen", kind: "error" });
      return false;
    }
  }

  private async saveAs(): Promise<boolean> {
    const target = await saveDialog({
      defaultPath: this.buffer.path ?? this.fileName,
      filters: dialogFilters(),
    });
    if (!target) return false;
    const ok = await this.writeTo(target);
    if (ok && !this.tab.languageOverride) await this.setLanguage(detectLanguage(target));
    return ok;
  }

  /**
   * `:e <pfad>` — eine Datei öffnen; ohne Pfad die aktuelle neu laden.
   *
   * `:e!` verwirft ungespeicherte Änderungen ohne Rückfrage, wie in Vim.
   * `where: "tab"` ist derselbe Weg für `:tabnew` — dort verwirft nichts
   * etwas, weil der Puffer daneben stehen bleibt.
   */
  private async edit(target: string | undefined, force: boolean, where: OpenTarget = "current") {
    if (target === undefined) {
      if (where === "tab") {
        await this.newTab();
        return;
      }
      if (!this.buffer.path) return;
      if (!force && !(await this.confirmDiscard())) return;
      await this.openPath(this.buffer.path, { force: true, where: "current" });
      return;
    }

    let path: string;
    try {
      path = await invoke<string>("resolve_save_path", {
        input: target,
        base: parentFolder(this.buffer.path),
        fallback: this.settings.notesFolder,
      });
    } catch (err) {
      await message(String(err), { title: "Öffnen fehlgeschlagen", kind: "error" });
      return;
    }

    // Wie in Vim: `:e neue-datei.ps1` legt einen Puffer für einen Namen an,
    // den es noch nicht gibt. Geschrieben wird er erst mit `:w`.
    if (!(await this.exists(path))) {
      const buffer: Buffer = { ...this.emptyBuffer(), path };
      if (where === "tab" && !this.isScratch) {
        await this.addTab({ buffer, content: "", language: detectLanguage(path) });
        return;
      }
      if (!force && !(await this.confirmDiscard())) return;
      this.tab.buffer = buffer;
      this.tab.languageOverride = null;
      this.editor.loadDocument("");
      this.editor.setReadOnly(false);
      await this.setLanguage(detectLanguage(path));
      return;
    }
    await this.openPath(path, { force, where });
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
    if (reload) await this.openPath(this.buffer.path, { force: true, where: "current" });
  }

  // ---- Autosave ----------------------------------------------------------

  /**
   * Autosave, und zwar nur wenn er ausdrücklich eingeschaltet ist.
   *
   * Vorher hing das Zurückschreiben am Notizen-Ordner: Wer einen gesetzt
   * hatte, dessen geöffnete Dateien wurden alle 500 ms überschrieben —
   * auch das PowerShell-Profil, das er nur nachschlagen wollte. Ein
   * versehentlicher Tastendruck stand damit sofort auf der Platte.
   */
  private scheduleAutosave() {
    if (!this.settings.autosave) return;
    window.clearTimeout(this.autosaveTimer);
    this.autosavePending = true;
    this.autosaveTimer = window.setTimeout(
      () => void this.autosave(),
      this.settings.autosaveDelayMs,
    );
  }

  /** Ein ausstehender Autosave gehörte zu einem Puffer, den es nicht mehr gibt. */
  private cancelAutosave() {
    window.clearTimeout(this.autosaveTimer);
    this.autosavePending = false;
  }

  /**
   * Führt einen ausstehenden Autosave sofort aus.
   *
   * Vor jedem Tabwechsel: Der Timer arbeitet immer auf dem sichtbaren
   * Puffer, und nach dem Wechsel wäre das der falsche.
   */
  private async flushAutosave() {
    if (!this.autosavePending) return;
    window.clearTimeout(this.autosaveTimer);
    await this.autosave();
  }

  private async autosave() {
    this.autosavePending = false;
    if (!this.settings.autosave || this.buffer.readOnly) return;

    const content = this.editor.content;
    if (content === this.buffer.savedContent) return;

    // Ein namenloser Puffer bekommt hier keinen Dialog vorgesetzt: Ein
    // Speichern-unter-Fenster, das ungefragt aufspringt, während man
    // tippt, wäre schlimmer als gar kein Autosave. Ohne Notizen-Ordner
    // wartet der Puffer deshalb auf Strg+S.
    if (!this.buffer.path) {
      if (!this.settings.notesFolder || content.trim() === "") return;
      await this.saveNote();
      return;
    }

    // Absichtlich ohne applySaveTransforms(): das Aufräumen verändert den
    // Text sichtbar und würde mitten im Tippen ein gerade eingegebenes
    // Leerzeichen wieder wegputzen. Das bleibt dem expliziten Speichern
    // vorbehalten.
    try {
      this.buffer.mtimeMs = await invoke<number>("save_file", {
        path: this.buffer.path,
        content,
        encoding: this.buffer.encoding,
        bom: this.buffer.bom,
        lineEnding: this.buffer.lineEnding,
      });
      this.buffer.savedContent = content;
      this.refreshStatus();
    } catch (err) {
      // Keine Modal-Flut bei jedem Tastendruck — der nächste Tick
      // versucht es erneut, solange sich der Text weiter ändert.
      console.error("Autosave fehlgeschlagen:", err);
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
      tabs: this.tabs.map((tab) => this.sessionFor(tab)),
      active: this.activeIndex,
    };
    try {
      await invoke("save_session", { session });
    } catch {
      // Eine nicht schreibbare Sitzungsdatei darf nichts blockieren.
    }
  }

  private sessionFor(tab: Tab): TabSession {
    const active = tab === this.tab;
    const state = active ? this.editor.view.state : tab.state;
    return {
      path: tab.buffer.path,
      unsavedContent: this.isModifiedTab(tab) ? this.contentOf(tab) : null,
      cursor: state?.selection.main.head ?? 0,
      scrollTop: active ? this.editor.view.scrollDOM.scrollTop : tab.scrollTop,
      encoding: tab.buffer.encoding,
      lineEnding: tab.buffer.lineEnding,
      bom: tab.buffer.bom,
      createdAtMs: tab.buffer.createdAtMs,
      languageOverride: tab.languageOverride,
    };
  }

  /**
   * Reihenfolge beim Start: Kommandozeile schlägt Sitzung. Wer eine Datei
   * per Doppelklick öffnet, will diese sehen und nicht die alten Tabs.
   */
  private async restoreTabs() {
    const files = await invoke<string[]>("startup_files");
    if (files.length > 0) {
      // `rui a.ps1 b.ps1` öffnet beide — bis 0.3.10 fiel alles ausser der
      // ersten Datei still unter den Tisch.
      for (const file of files) await this.openPath(file, { force: true });
      return;
    }
    if (!this.settings.restoreSession) return;

    const session = await invoke<Session>("load_session");
    const restored: Tab[] = [];
    for (const entry of session.tabs) {
      const tab = await this.restoreTab(entry);
      if (tab) restored.push(tab);
    }
    if (restored.length === 0) return;

    this.tabs = restored;
    this.activeIndex = Math.min(Math.max(session.active, 0), restored.length - 1);
    // Ohne Prüfung auf externe Änderungen: Das Fenster ist noch gar nicht
    // sichtbar, ein Dialog davor käme aus dem Nichts.
    await this.show(false);
  }

  /**
   * Einen Tab aus der Sitzung wiederherstellen. `null`, wenn die Datei
   * verschwunden ist und es auch nichts Ungespeichertes zu retten gibt.
   */
  private async restoreTab(entry: TabSession): Promise<Tab | null> {
    let buffer: Buffer = { ...this.emptyBuffer(), path: entry.path };
    if (entry.path) {
      const doc = await invoke<LoadedDocument>("open_file", {
        path: entry.path,
        force: true,
      }).catch(() => null);
      if (!doc) {
        // Datei weg. Ungespeichertes bleibt trotzdem gerettet — genau
        // dafür ist die Sitzung da.
        if (entry.unsavedContent === null || entry.unsavedContent === undefined) return null;
      } else {
        buffer = {
          path: doc.path,
          encoding: doc.encoding,
          bom: doc.bom,
          lineEnding: doc.lineEnding,
          readOnly: doc.readOnly,
          mtimeMs: doc.mtimeMs,
          savedContent: doc.content,
          createdAtMs: Date.now(),
        };
      }
    }

    let content = buffer.savedContent;
    // Der ungespeicherte Stand gewinnt gegen den Dateiinhalt — sonst wäre
    // das Sicherheitsnetz nutzlos.
    if (entry.unsavedContent !== null && entry.unsavedContent !== undefined) {
      content = entry.unsavedContent;
      if (entry.encoding) buffer.encoding = entry.encoding;
      if (entry.lineEnding) buffer.lineEnding = entry.lineEnding;
      buffer.bom = entry.bom;
    }
    // Die Entstehungszeit kommt aus der Sitzung: Ein gestern begonnener,
    // noch namenloser Puffer bekäme sonst heute ein neues Datum als Namen.
    if (entry.createdAtMs) buffer.createdAtMs = entry.createdAtMs;

    let state = this.editor.freshState(content);
    if (entry.cursor) {
      state = state.update({
        selection: { anchor: Math.min(entry.cursor, state.doc.length) },
      }).state;
    }

    const override = entry.languageOverride
      ? (LANGUAGES.find((lang) => lang.id === entry.languageOverride) ?? null)
      : null;
    return {
      id: this.nextTabId++,
      buffer,
      language: override ?? detectLanguage(buffer.path),
      languageOverride: override?.id ?? null,
      state,
      scrollTop: entry.scrollTop,
      modified: content !== buffer.savedContent,
    };
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
          this.tab.languageOverride = lang.id;
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
   * `:q` aus der Vim-Steuerung.
   *
   * Sind mehrere Tabs offen, schliesst es den Reiter — wie in Vim, wo
   * `:q` das aktuelle Fenster schliesst und erst das letzte den Editor
   * beendet. Strg+W geht bewusst den anderen Weg und lässt beim letzten
   * Tab einen leeren stehen: Wer aus dem Browser kommt, erwartet kein
   * Programmende, wer `:q` tippt, genau das.
   */
  private async quit(force: boolean) {
    if (this.tabs.length > 1) {
      await this.closeTab(this.tab.id, force);
      return;
    }
    await this.quitAll(force);
  }

  /** `:qa` — das Fenster, unabhängig von der Zahl der Tabs. */
  private async quitAll(force: boolean) {
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

  // ---- Zwischenablage ---------------------------------------------------

  /**
   * Strg+Umschalt+C und Strg+Umschalt+V — der Weg zur System-Zwischenablage,
   * den man aus dem Terminal kennt.
   *
   * Sie sind nicht dasselbe wie `y` und `p`: Vims Register sind Ruis eigene
   * und haben mit dem zu tun, was ausserhalb in der Zwischenablage liegt,
   * erst einmal nichts. Wer beides verbinden will, nimmt in Vim `"+y` und
   * `"+p` — auch die gehen an die System-Zwischenablage.
   */
  private copyToClipboard() {
    const state = this.editor.view.state;
    const text = state.selection.ranges
      .filter((r) => !r.empty)
      .map((r) => state.sliceDoc(r.from, r.to))
      .join("\n");
    // Ohne Auswahl gibt es nichts zu kopieren. Die aktuelle Zeile
    // stattdessen zu nehmen wäre eine Vermutung, und eine überschriebene
    // Zwischenablage lässt sich nicht zurückholen. Gesagt werden muss es
    // trotzdem: Ein Kürzel, das schweigt, sieht aus wie eines, das nicht
    // ankommt.
    if (!text) {
      this.status.flash("Nichts ausgewählt");
      return;
    }
    void writeClipboard(text);
    this.status.flash(`${countLines(text)} kopiert`);
  }

  /**
   * Die ganze Datei in die Zwischenablage — Vims `:%y+` ohne Vim.
   *
   * Rui wird viel als Durchreiche benutzt: Text hier zurechtlegen, dann
   * woanders einfügen. Bis 0.5.0 hiess das erst alles markieren und dann
   * kopieren; über die Auswahl zu gehen ist bei ein paar hundert Zeilen
   * ein Umweg, den niemand braucht.
   */
  private copyAll() {
    const text = this.editor.content;
    if (!text) {
      this.status.flash("Die Datei ist leer");
      return;
    }
    void writeClipboard(text);
    this.status.flash(`Alles kopiert · ${countLines(text)}`);
  }

  /** Der volle Pfad der offenen Datei in die Zwischenablage. */
  private copyPath() {
    if (!this.buffer.path) {
      this.status.flash("Noch nicht gespeichert");
      return;
    }
    void writeClipboard(this.buffer.path);
    this.status.flash("Pfad kopiert");
  }

  private async pasteFromClipboard() {
    const text = await readClipboard();
    if (!text) return;
    this.editor.view.dispatch(this.editor.view.state.replaceSelection(text));
    this.editor.view.focus();
  }

  private async gotoLine() {
    const answer = await promptInput("Gehe zu Zeile", "");
    const line = Number(answer);
    if (Number.isInteger(line) && line > 0) this.editor.gotoLine(line);
    else this.editor.view.focus();
  }

  // ---- Befehle ----------------------------------------------------------

  private toggle(
    key: keyof Settings,
    title: string,
    group = "Ansicht",
    shortcut?: string,
  ): Command {
    return {
      id: `toggle.${key}`,
      group,
      title,
      shortcut,
      state: () => (this.settings[key] ? "an" : "aus"),
      run: () => this.updateSettings({ ...this.settings, [key]: !this.settings[key] }),
    };
  }

  private commands(): Command[] {
    if (this.commandsOverride) return this.commandsOverride;

    return [
      {
        id: "tab.new",
        group: "Tabs",
        title: "Neuer Tab",
        shortcut: "Strg+T",
        run: () => this.newTab(),
      },
      {
        id: "tab.close",
        group: "Tabs",
        title: "Tab schliessen",
        shortcut: "Strg+W",
        run: () => this.closeTab(this.tab.id),
      },
      {
        id: "tab.next",
        group: "Tabs",
        title: "Nächster Tab",
        shortcut: "Strg+Tab",
        run: () => this.cycleTab(1),
      },
      {
        id: "tab.prev",
        group: "Tabs",
        title: "Voriger Tab",
        shortcut: "Strg+Umschalt+Tab",
        run: () => this.cycleTab(-1),
      },
      {
        id: "file.open",
        group: "Datei",
        title: "Notiz öffnen…",
        shortcut: "Strg+O",
        run: () => this.quickOpen.open(),
      },
      {
        id: "file.openNative",
        group: "Datei",
        title: "Andere Datei öffnen…",
        shortcut: "Strg+Umschalt+O",
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
        id: "file.autosave",
        group: "Datei",
        title: "Autosave",
        state: () => (this.settings.autosave ? "an" : "aus"),
        run: () => this.updateSettings({ ...this.settings, autosave: !this.settings.autosave }),
      },
      {
        id: "file.reveal",
        group: "Datei",
        title: "Im Dateimanager zeigen",
        // `revealItemInDir` statt `openPath` auf den Elternordner: Es
        // markiert die Datei gleich mit — und `opener:default` deckt nur
        // dieses, `open-path` müsste eigens freigeschaltet werden.
        run: async () => {
          if (this.buffer.path) await revealItemInDir(this.buffer.path);
          else this.status.flash("Noch nicht gespeichert");
        },
      },
      {
        id: "file.copyPath",
        group: "Datei",
        title: "Pfad kopieren",
        run: () => this.copyPath(),
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
        id: "edit.copy",
        group: "Bearbeiten",
        title: "In die Zwischenablage kopieren",
        shortcut: "Strg+Umschalt+C",
        run: () => this.copyToClipboard(),
      },
      {
        id: "edit.copyAll",
        group: "Bearbeiten",
        title: "Ganze Datei in die Zwischenablage",
        shortcut: "Strg+Umschalt+A",
        run: () => this.copyAll(),
      },
      {
        id: "edit.paste",
        group: "Bearbeiten",
        title: "Aus der Zwischenablage einfügen",
        shortcut: "Strg+Umschalt+V",
        run: () => this.pasteFromClipboard(),
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

      this.toggle("wordWrap", "Zeilenumbruch", "Ansicht", "Alt+Z"),
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
        id: "app.shortcuts",
        group: "Rui",
        title: "Tastenkürzel…",
        shortcut: "Strg+K",
        run: () => this.shortcuts.open(),
      },
      {
        id: "app.settings",
        group: "Rui",
        title: "Einstellungen…",
        shortcut: "Strg+I",
        run: () => this.settingsDialog.open(),
      },
      {
        id: "app.about",
        group: "Rui",
        title: "Über Rui…",
        run: () => this.about.open(),
      },
    ];
  }

  /**
   * Zeilenumbruch an oder aus, mit Rückmeldung.
   *
   * Ohne die Meldung ist der Griff bei einer Datei ohne lange Zeilen
   * unsichtbar: Es ändert sich nichts am Bild, und man drückt ihn ein
   * zweites Mal.
   */
  private async toggleWordWrap() {
    const wordWrap = !this.settings.wordWrap;
    await this.updateSettings({ ...this.settings, wordWrap });
    this.status.flash(wordWrap ? "Zeilenumbruch an" : "Zeilenumbruch aus");
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
        const overlayOpen = this.shortcuts.isOpen || this.quickOpen.isOpen || this.about.isOpen;

        // Alt+Z schaltet den Zeilenumbruch — wie in VS Code, und der
        // einzige Griff ohne Strg. Er steht hier vorn, weil er ohne
        // Modifikator-Abfrage auskommen muss: Umbruch ist die Einstellung,
        // die man beim Lesen einer fremden Logdatei umlegt und beim
        // Schreiben wieder zurück, und dafür ist ein Weg über die
        // Einstellungen zu weit.
        if (e.altKey && !mod && !e.shiftKey && e.key.toLowerCase() === "z") {
          if (overlayOpen || this.palette.isOpen) return;
          e.preventDefault();
          // `stopPropagation` ist hier nicht optional: Ohne das erreicht
          // das `z` zusätzlich die Vim-Steuerung, die es als angefangenen
          // `z`-Befehl stehen lässt — der nächste Tastendruck rollt dann
          // den Bildschirm, statt zu tippen.
          e.stopPropagation();
          void this.toggleWordWrap();
          return;
        }

        if (!mod) return;

        // Was ein Overlay gerade selbst braucht, bleibt dort. Strg+K
        // schliesst die Kürzelliste allerdings wieder — dieselbe Taste
        // hin und zurück ist das, was man von einem Spickzettel erwartet.
        if (this.shortcuts.isOpen) {
          if (e.key.toLowerCase() !== "k") return;
          e.preventDefault();
          this.shortcuts.close();
          return;
        }
        if (this.quickOpen.isOpen || this.about.isOpen) return;
        if (this.palette.isOpen && e.key !== ",") return;

        const key = e.key.toLowerCase();
        const run = (fn: () => unknown) => {
          e.preventDefault();
          e.stopPropagation();
          void fn();
        };

        // Vor der Umschalt-Abfrage: Strg+Tab und Strg+Umschalt+Tab sind
        // dieselbe Bewegung in zwei Richtungen.
        if (key === "tab") return run(() => this.cycleTab(e.shiftKey ? -1 : 1));

        if (e.shiftKey && key === "p") return run(() => this.palette.open());
        if (e.shiftKey && key === "o") return run(() => this.openFileDialog());
        if (e.shiftKey && key === "s") return run(() => this.saveAs());
        if (e.shiftKey && key === "a") return run(() => this.copyAll());
        if (e.shiftKey && key === "c") return run(() => this.copyToClipboard());
        if (e.shiftKey && key === "v") return run(() => this.pasteFromClipboard());
        if (e.shiftKey) return;

        // Strg+1 bis Strg+9 springen an die Stelle im Band; die 9 ans
        // Ende, wie im Browser — bei zehn Tabs sucht man sonst.
        if (key >= "1" && key <= "9") {
          const index = key === "9" ? this.tabs.length - 1 : Number(key) - 1;
          return run(() => this.activate(index));
        }

        switch (key) {
          // Strg+N und Strg+T tun dasselbe: Der eine Griff kommt aus dem
          // Editor, der andere aus dem Browser, und beide meinen denselben
          // leeren Reiter.
          case "n":
          case "t":
            return run(() => this.newTab());
          case "w":
            return run(() => this.closeTab(this.tab.id));
          case "o":
            return run(() => this.quickOpen.open());
          case "s":
            return run(() => this.save());
          case "g":
            return run(() => this.gotoLine());
          // Strg+K: der Spickzettel. In NeoVim leitet Strg+K im
          // Einfügemodus ein Digraph ein — ein Griff, den ausserhalb von
          // „ä als a:" kaum jemand benutzt, während die Frage „wie war das
          // Kürzel nochmal" täglich kommt.
          case "k":
            return run(() => this.shortcuts.open());
          // Strg+I neben Strg+O: die Datei mit dem einen, die Einstellungen
          // mit dem anderen. Beide belegen in Vim die Sprungliste, aber
          // Strg+O geht in Rui seit jeher an Quick Open — dann soll auch
          // sein Gegenstück etwas tun, das man täglich braucht.
          case "i":
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
      // Bei aktiver Sitzungswiederherstellung sind die Puffer gesichert,
      // eine Rückfrage wäre dann nur im Weg.
      if (!this.settings.restoreSession && !(await this.confirmUnsaved())) return;

      this.closing = true;
      await win.destroy();
    });

    // Externe Änderungen prüfen, sobald das Fenster wieder aktiv wird.
    void win.onFocusChanged(({ payload: focused }) => {
      if (!focused) return;
      void this.checkExternalChange();
      // Wer draussen etwas kopiert hat, soll es hier mit `"+p` einfügen
      // können, ohne dass der Zwischenspeicher erst veralten muss.
      void readClipboard();
    });

    // Zweite Instanz hat Dateien weitergereicht — jede bekommt ihren Tab.
    void listen<string[]>("rui://open-files", (event) => {
      void this.openAll(event.payload);
    });

    // Omarchy-Themenwechsel — läuft komplett dateibasiert, kein Neustart nötig.
    void listen("rui://omarchy-theme-changed", () => void this.refreshOmarchyTheme());

    // Datei aufs Fenster ziehen.
    void getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      void this.openAll(event.payload.paths);
    });

    window.addEventListener("beforeunload", () => void this.saveSession());
  }
}

/**
 * Ob Rui unter Windows läuft. Der User-Agent des Webviews ist hier die
 * billigste Auskunft; für die eine Frage, die davon abhängt, lohnt kein
 * eigener Befehl an die Rust-Seite.
 */
const WINDOWS = navigator.userAgent.includes("Windows");

/**
 * Ob zwei Pfade dieselbe Datei meinen.
 *
 * Unter Windows unterscheidet das Dateisystem keine Gross- und
 * Kleinschreibung, unter Linux schon — dort sind `Log.txt` und `log.txt`
 * zwei Dateien, und sie in einen Tab zusammenzuwerfen hiesse, die eine
 * beim Speichern mit der anderen zu überschreiben.
 */
function samePath(a: string | null, b: string): boolean {
  if (!a) return false;
  return WINDOWS ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Nur der Dateiname, für Rückfragen, in denen der ganze Pfad stört. */
function shortName(path: string): string {
  return path.split(/[\/]/).pop() ?? path;
}

/**
 * „12 Zeilen" oder „1 Zeile" — die Rückmeldung nach dem Kopieren.
 *
 * Vim meldet nach `:%y+` `12 lines yanked`. Eine Zahl sagt mehr als ein
 * „kopiert": Sie beantwortet die Frage, ob wirklich das Ganze erwischt
 * wurde oder nur der Rest einer Auswahl.
 */
function countLines(text: string): string {
  const lines = text.split("\n").length;
  return lines === 1 ? "1 Zeile" : `${lines} Zeilen`;
}

/** Der Ordner, in dem eine Datei liegt — `null` für einen leeren Puffer. */
function parentFolder(path: string | null): string | null {
  if (!path) return null;
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return separator > 0 ? path.slice(0, separator) : null;
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
