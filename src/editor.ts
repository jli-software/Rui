import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightWhitespace,
  highlightTrailingWhitespace,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  standardKeymap,
} from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentUnit,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

import { editorTheme, sageDark, sageLight, applyPalette } from "./theme";
import type { Palette } from "./theme";
import type { LanguageDef } from "./languages";
import type { Settings } from "./types";
import type { VimHost, VimStatus } from "./vim";

export interface EditorCallbacks {
  onChange: () => void;
  onCursor: () => void;
  /** Vim-Modus für die Statusleiste; `null`, wenn die Steuerung aus ist. */
  onVimMode: (status: VimStatus | null) => void;
}

/**
 * Der Editor.
 *
 * Jede zur Laufzeit umschaltbare Einstellung sitzt in einem eigenen
 * Compartment. Nur so lässt sich eine einzelne Option ändern, ohne den
 * Editor neu aufzubauen — das würde Undo-Historie und Cursorposition
 * kosten. Umgekehrt wird beim Öffnen einer Datei bewusst ein frischer
 * State gesetzt, damit die Historie der vorigen Datei nicht überlebt.
 */
export class RuiEditor {
  readonly view: EditorView;

  private settings: Settings;
  private extraKeys: Extension = [];
  private lastLine = 1;
  /**
   * Vom Omarchy-Theme abgeleitete Palette, sofern verfügbar — asynchron von
   * aussen gesetzt, weil das Lesen von `colors.toml` über IPC läuft.
   * `themeExt()` bleibt dadurch synchron und braucht keinen eigenen
   * Ladezustand.
   */
  private omarchy: { palette: Palette; dark: boolean } | null = null;

  /**
   * Das nachgeladene Vim-Modul, sobald die Steuerung einmal an war. Es
   * bleibt danach liegen: Wer sie ausprobiert und wieder abschaltet, soll
   * beim nächsten Einschalten nicht erneut auf den Chunk warten.
   */
  private vimModule: typeof import("./vim") | null = null;

  private readonly c = {
    vim: new Compartment(),
    language: new Compartment(),
    theme: new Compartment(),
    lineNumbers: new Compartment(),
    activeLine: new Compartment(),
    wrap: new Compartment(),
    indent: new Compartment(),
    brackets: new Compartment(),
    closeBrackets: new Compartment(),
    autoIndent: new Compartment(),
    whitespace: new Compartment(),
    font: new Compartment(),
    readOnly: new Compartment(),
  };

  constructor(
    parent: HTMLElement,
    settings: Settings,
    doc: string,
    private readonly callbacks: EditorCallbacks,
    private readonly vimHost: VimHost,
    extraKeys: Extension = [],
  ) {
    this.settings = settings;
    this.extraKeys = extraKeys;
    this.view = new EditorView({ state: this.buildState(doc), parent });
  }

  // ---- Zustand ----------------------------------------------------------

  private buildState(doc: string): EditorState {
    return EditorState.create({
      doc,
      extensions: [
        // Basis, von Hand zusammengestellt statt `basicSetup`, damit
        // nichts mitläuft, das dieser Editor nicht braucht.
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),
        EditorState.allowMultipleSelections.of(true),
        highlightSelectionMatches(),
        foldGutter(),
        search({ top: true }),
        // Vor den Keymaps: bei gleicher Priorität gewinnt in CodeMirror,
        // was früher in der Liste steht. Stünde Vim dahinter, fingen die
        // Standardbindungen die Tasten vorher ab.
        this.c.vim.of(this.vimExt()),
        this.extraKeys,
        keymap.of([
          ...closeBracketsKeymap,
          ...standardKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          // Ohne das springt Tab zum nächsten Bedienelement statt einzurücken.
          indentWithTab,
        ]),
        this.c.language.of([]),
        this.c.readOnly.of([]),
        this.c.theme.of(this.themeExt()),
        this.c.font.of(this.fontExt()),
        this.c.lineNumbers.of(this.lineNumberExt()),
        this.c.activeLine.of(this.activeLineExt()),
        this.c.wrap.of(this.wrapExt()),
        this.c.indent.of(this.indentExt()),
        this.c.autoIndent.of(this.settings.autoIndent ? indentOnInput() : []),
        this.c.brackets.of(this.settings.bracketMatching ? bracketMatching() : []),
        this.c.closeBrackets.of(this.settings.closeBrackets ? closeBrackets() : []),
        this.c.whitespace.of(this.whitespaceExt()),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) this.callbacks.onChange();
          if (u.selectionSet || u.docChanged) {
            this.callbacks.onCursor();
            this.refreshRelativeNumbers();
          }
        }),
      ],
    });
  }

  /** Setzt Inhalt und Undo-Historie zurück — beim Öffnen einer Datei. */
  loadDocument(content: string) {
    this.lastLine = 1;
    this.view.setState(this.buildState(content));
    // Der State ist neu, also auch der Vim-Adapter darin.
    this.syncVimStatus();
    this.view.focus();
  }

  get content(): string {
    return this.view.state.doc.toString();
  }

  // ---- Einzelne Extensions ---------------------------------------------

  private themeExt(): Extension {
    const t = this.settings.theme;
    if (t === "system" && this.omarchy) {
      applyPalette(this.omarchy.palette, this.omarchy.dark);
      return editorTheme(this.omarchy.palette, this.omarchy.dark);
    }
    const dark =
      t === "sage-dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const palette = dark ? sageDark : sageLight;
    applyPalette(palette, dark);
    return editorTheme(palette, dark);
  }

  /**
   * Setzt oder löscht die Omarchy-Palette und wendet sie sofort an, sofern
   * `theme: "system"` aktiv ist. `null` fällt zurück auf die Sage-Palette
   * nach Systemvorgabe hell/dunkel.
   */
  setOmarchyPalette(value: { palette: Palette; dark: boolean } | null) {
    this.omarchy = value;
    if (this.settings.theme === "system") {
      this.view.dispatch({ effects: this.c.theme.reconfigure(this.themeExt()) });
    }
  }

  private fontExt(): Extension {
    const s = this.settings;
    return EditorView.theme({
      "&": {
        fontFamily: s.fontFamily,
        fontSize: `${s.fontSize}px`,
        lineHeight: String(s.lineHeight),
      },
    });
  }

  private lineNumberExt(): Extension {
    const s = this.settings;
    if (!s.lineNumbers) return [];
    if (!s.relativeLineNumbers) return lineNumbers();
    return lineNumbers({
      formatNumber: (n, state) => {
        const current = state.doc.lineAt(state.selection.main.head).number;
        return n === current ? String(n) : String(Math.abs(n - current));
      },
    });
  }

  private activeLineExt(): Extension {
    return this.settings.highlightActiveLine
      ? [highlightActiveLine(), highlightActiveLineGutter()]
      : [];
  }

  private wrapExt(): Extension {
    return this.settings.wordWrap ? EditorView.lineWrapping : [];
  }

  private indentExt(): Extension {
    const s = this.settings;
    return [
      EditorState.tabSize.of(s.tabSize),
      indentUnit.of(s.insertSpaces ? " ".repeat(s.tabSize) : "\t"),
    ];
  }

  private whitespaceExt(): Extension {
    return this.settings.showWhitespace
      ? [highlightWhitespace(), highlightTrailingWhitespace()]
      : [];
  }

  /**
   * Relative Zeilennummern hängen von der Cursorposition ab, aber eine
   * reine Selektionsänderung zeichnet das Gutter nicht neu. Deshalb wird
   * es beim Zeilenwechsel gezielt rekonfiguriert — nur solange die
   * Option aktiv ist, sonst kostet es nichts.
   */
  private refreshRelativeNumbers() {
    const s = this.settings;
    if (!s.relativeLineNumbers || !s.lineNumbers) return;
    const line = this.view.state.doc.lineAt(this.view.state.selection.main.head).number;
    if (line === this.lastLine) return;
    this.lastLine = line;
    queueMicrotask(() =>
      this.view.dispatch({
        effects: this.c.lineNumbers.reconfigure(this.lineNumberExt()),
      }),
    );
  }

  // ---- Umschalten -------------------------------------------------------

  applySettings(s: Settings) {
    this.settings = s;
    this.view.dispatch({
      effects: [
        this.c.theme.reconfigure(this.themeExt()),
        this.c.font.reconfigure(this.fontExt()),
        this.c.lineNumbers.reconfigure(this.lineNumberExt()),
        this.c.activeLine.reconfigure(this.activeLineExt()),
        this.c.wrap.reconfigure(this.wrapExt()),
        this.c.indent.reconfigure(this.indentExt()),
        this.c.autoIndent.reconfigure(s.autoIndent ? indentOnInput() : []),
        this.c.brackets.reconfigure(s.bracketMatching ? bracketMatching() : []),
        this.c.closeBrackets.reconfigure(s.closeBrackets ? closeBrackets() : []),
        this.c.whitespace.reconfigure(this.whitespaceExt()),
      ],
    });
  }

  async applyLanguage(lang: LanguageDef) {
    const ext = this.settings.syntaxHighlighting && lang.load ? await lang.load() : [];
    this.view.dispatch({ effects: this.c.language.reconfigure(ext) });
  }

  setReadOnly(readOnly: boolean) {
    this.view.dispatch({
      effects: this.c.readOnly.reconfigure(readOnly ? EditorState.readOnly.of(true) : []),
    });
  }

  // ---- Vim-Steuerung ----------------------------------------------------

  /**
   * Schaltet die Vim-Steuerung auf den Stand der Einstellungen.
   *
   * Das Paket wird erst beim ersten Einschalten geholt — ausgeschaltet
   * kostet die Steuerung damit nichts ausser dieser Methode. `async`
   * deshalb, und deshalb hängt sie nicht in `applySettings`.
   */
  async applyVimMode() {
    if (this.settings.vimMode && !this.vimModule) {
      try {
        this.vimModule = await import("./vim");
      } catch (err) {
        console.error("Vim-Paket konnte nicht geladen werden:", err);
        this.vimModule = null;
      }
    }
    this.view.dispatch({ effects: this.c.vim.reconfigure(this.vimExt()) });
    this.syncVimStatus();
  }

  private vimExt(): Extension {
    if (!this.settings.vimMode || !this.vimModule) return [];
    try {
      return this.vimModule.vimExtension(this.vimHost);
    } catch (err) {
      // Die Vim-Steuerung ist eine Option, kein Fundament. Diese Methode
      // läuft in `buildState()`, also bei jedem Öffnen einer Datei und beim
      // Start — eine Ausnahme daraus liess Rui bis 0.3.0 mit „konnte nicht
      // starten" stehen, statt einfach ohne Vim weiterzulaufen. Der
      // fehlende Modus in der Statusleiste ist das Signal, dass etwas
      // schiefging; die Ursache steht in der Konsole.
      console.error("Vim-Steuerung konnte nicht geladen werden:", err);
      this.vimModule = null;
      return [];
    }
  }

  /** Hängt die Modusanzeige an den aktuellen Adapter — oder leert sie. */
  private syncVimStatus() {
    if (!this.settings.vimMode || !this.vimModule) {
      this.callbacks.onVimMode(null);
      return;
    }
    this.vimModule.watchMode(this.view, this.callbacks.onVimMode);
  }

  // ---- Abfragen für die Statusleiste ------------------------------------

  cursorInfo() {
    const state = this.view.state;
    const main = state.selection.main;
    const line = state.doc.lineAt(main.head);
    return {
      line: line.number,
      column: main.head - line.from + 1,
      lines: state.doc.lines,
      selected: state.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0),
      selections: state.selection.ranges.length,
    };
  }

  gotoLine(line: number) {
    const doc = this.view.state.doc;
    const target = doc.line(Math.max(1, Math.min(line, doc.lines)));
    this.view.dispatch({
      selection: { anchor: target.from },
      scrollIntoView: true,
    });
    this.view.focus();
  }
}
