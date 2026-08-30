import { vim, getCM, Vim, type CodeMirror } from "@replit/codemirror-vim";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { cachedText, refresh, write } from "./clipboard";

/**
 * Die gesamte Anbindung an `@replit/codemirror-vim` sitzt in diesem Modul,
 * damit `editor.ts` es per `import("./vim")` als eigenen Chunk nachladen
 * kann. Solange die Vim-Steuerung aus ist — und das ist die Vorgabe —
 * wird das Paket nie geladen: Rui bleibt ein Notepad++ für alle, die
 * damit nichts anfangen können.
 */

/** Was Ruis Statusleiste über den Zustand der Steuerung wissen muss. */
export interface VimStatus {
  /** "normal", "insert", "visual line", … — wie Vim ihn selbst benennt. */
  mode: string;
  /** Angefangene Eingabe, etwa `2d` — leer, sobald der Befehl steht. */
  pending: string;
}

/**
 * Die `:set`-Optionen, die Rui kennt.
 *
 * Sie heissen wie in Vim und zeigen auf Ruis Einstellungen — wer `:set
 * nowrap` tippt, meint denselben Zeilenumbruch, den auch `Alt+Z` und der
 * Einstellungsdialog umlegen. Alles andere, was `:set` in Vim kann,
 * bleibt beim Vim-Paket: `:set ignorecase` etwa geht weiter dorthin.
 */
export type VimOption = "wrap" | "number" | "relativenumber";

/**
 * Was `:w`, `:e` und `:q` auslösen sollen. Zeigt bewusst auf Ruis eigene
 * Wege und nicht auf die des Vim-Pakets.
 */
export interface VimHost {
  /**
   * `:w` — speichert wie Strg+S.
   *
   * `target` ist das Argument aus `:w notiz.ps1`: ein relativer Name gilt
   * gegen den Ordner der offenen Datei, wie in Vim. Ohne Argument und
   * ohne Dateinamen fragt Rui nach dem Ort.
   */
  write: (target?: string) => Promise<boolean>;
  /** `:e <pfad>` — öffnet eine Datei; ohne Argument lädt es die aktuelle neu. */
  edit: (target: string | undefined, force: boolean) => Promise<void>;
  /**
   * `:q`, mit `!` als `force`.
   *
   * Wie in Vim: Sind mehrere Tabs offen, schliesst es den aktuellen; beim
   * letzten schliesst es das Fenster.
   */
  quit: (force: boolean) => void;
  /** `:qa` — schliesst das Fenster, egal wie viele Tabs offen sind. */
  quitAll: (force: boolean) => void;
  /** `:tabnew [datei]` — ein neuer Reiter, wahlweise mit Datei darin. */
  tabNew: (target?: string) => void;
  /** `:tabn` / `:tabp` — einen Reiter weiter oder zurück. */
  tabCycle: (delta: number) => void;
  /** `:tabc` / `:bd` — den aktuellen Reiter schliessen. */
  tabClose: (force: boolean) => void;
  /** Der aktuelle Stand einer `:set`-Option — für `:set wrap?`. */
  readOption: (name: VimOption) => boolean;
  /** `:set wrap` / `:set nowrap` / `:set wrap!`. */
  writeOption: (name: VimOption, value: boolean) => void;
}

/**
 * `Vim` ist ein Singleton des Moduls, seine Ex-Befehle und Register sind es
 * damit auch. Rui hat genau ein Fenster und einen Host, also reicht es, sie
 * einmal zu definieren — und mehr als einmal geht auch gar nicht:
 * `defineRegister` wirft beim zweiten Mal.
 *
 * Das ist kein theoretischer Fall. `vimExtension()` läuft bei **jedem**
 * `setState`, also bei jedem Öffnen einer Datei.
 */
let vimGlobalsDefined = false;

/** Verhindert, dass derselbe Adapter zweimal einen Listener bekommt. */
const watched = new WeakSet<CodeMirror>();

/**
 * Die Extension für das Vim-Compartment.
 *
 * Ohne `status: true`: die Modusanzeige übernimmt Ruis eigene
 * Statusleiste, und der Streifen unter dem Editor erscheint nur, während
 * man tatsächlich einen `:`- oder `/`-Befehl eintippt.
 */
export function vimExtension(host: VimHost): Extension {
  if (!vimGlobalsDefined) {
    vimGlobalsDefined = true;
    defineExCommands(host);
    defineOptions(host);
    defineClipboardRegisters();
  }
  return [vim(), cursorTheme];
}

/**
 * `"+` und `"*` auf die System-Zwischenablage legen.
 *
 * Ohne das sind sie zwei gewöhnliche Register: `"+y` legt etwas hinein, das
 * ausserhalb von Rui niemand sieht. Vim verhält sich mit einem
 * Clipboard-fähigen Build genauso wie hier, und wer `"+y` tippt, meint auch
 * genau das.
 *
 * Beide Namen zeigen auf dieselbe Ablage. Unter X11 sind `+` (Clipboard)
 * und `*` (Primary Selection) verschieden; das Tauri-Plugin kennt nur die
 * erste, und eine Primary Selection, die in Wirklichkeit das Clipboard ist,
 * wäre irreführender als beide gleich zu behandeln.
 */
function defineClipboardRegisters() {
  const register = clipboardRegister();

  // `+` legt das Paket in seinem `RegisterController` selbst an, und
  // `defineRegister` wirft bei einem Namen, den es schon gibt — genau daran
  // ist Rui 0.3.0 beim Start gescheitert. Der richtige Griff ist deshalb,
  // das vorhandene Register zu ersetzen statt ein neues anzumelden.
  //
  // `registers` steht in den Typen des Pakets nicht, der Controller wird
  // ausdrücklich als Erweiterungspunkt herausgereicht. Der Cast benennt,
  // was hier tatsächlich passiert.
  const registers = (
    Vim.getRegisterController() as unknown as { registers: Record<string, unknown> }
  ).registers;
  registers["+"] = register;

  // `*` kennt das Paket dagegen nicht; ohne Anmeldung gilt `"*` als
  // ungültiger Registername und die Eingabe läuft ins Leere.
  if (!registers["*"]) Vim.defineRegister("*", register);
}

/**
 * Ein Register, dessen Inhalt die System-Zwischenablage ist.
 *
 * `toString()` muss synchron antworten, das Lesen der Zwischenablage ist es
 * nicht — deshalb der Zwischenspeicher aus `clipboard.ts`, den `watchMode`
 * auffrischt, sobald jemand `"` tippt.
 */
function clipboardRegister() {
  return {
    keyBuffer: [""],
    insertModeChanges: [],
    searchQueries: [],
    linewise: false,
    blockwise: false,
    setText(text?: string, linewise?: boolean) {
      this.linewise = !!linewise;
      this.keyBuffer = [text ?? ""];
      void write(text ?? "");
    },
    pushText(text: string, linewise?: boolean) {
      this.linewise = !!linewise;
      // Vim hängt beim Kopieren in ein Grossbuchstaben-Register an; für die
      // Zwischenablage ist das der einzige Fall, in dem sich der bisherige
      // Inhalt fortsetzt.
      const combined = (this.keyBuffer[0] ?? "") + text;
      this.keyBuffer = [combined];
      void write(combined);
    },
    pushInsertModeChanges() {},
    pushSearchQuery() {},
    clear() {
      this.keyBuffer = [""];
      this.linewise = false;
      void write("");
    },
    toString() {
      const text = cachedText();
      this.keyBuffer = [text];
      return text;
    },
  };
}

/**
 * Der Blockcursor und die Ex-Kommandozeile in Ruis Farben.
 *
 * Das Paket bringt einen mit — in einem kräftigen Rosa, das mit der
 * Sage-Palette nichts zu tun hat, und es hängt ihn mit `Prec.highest`
 * ein. Dagegen kommt eine gewöhnliche Regel im Editor-Theme nicht an,
 * deshalb hier `!important`. Die Farben kommen als CSS-Variablen, die
 * `theme.ts` ohnehin auf `:root` setzt — so wechselt der Cursor mit dem
 * Farbschema, ohne dass dieses Modul die Palette kennen muss.
 */
const cursorTheme = Prec.highest(
  EditorView.theme({
    ".cm-fat-cursor": {
      background: "var(--accent) !important",
      // Der Buchstabe unter dem Cursor steht mit seiner eigenen Farbe
      // inline am Element — nur `!important` kommt dagegen an.
      color: "var(--accent-text) !important",
    },
    "&:not(.cm-focused) .cm-fat-cursor": {
      background: "none !important",
      outline: "1px solid var(--accent) !important",
      color: "transparent !important",
    },
    // Die Kommandozeile für `:` und `/` erbt die eingestellte
    // Editorschrift statt der fest verdrahteten `monospace` des Pakets.
    ".cm-vim-panel": {
      fontFamily: "inherit",
      padding: "3px 10px",
      backgroundColor: "var(--surface)",
      color: "var(--text)",
    },
    // Das Eingabefeld hat vom Paket nur `background: inherit` mitbekommen.
    // Textfarbe und Schrift erbt ein `<input>` aber nicht — beides kommt
    // vom Stylesheet des Browsers, und das rechnet mit einem hellen
    // Formular. In einem dunklen Theme stand die getippte Zeile dadurch
    // fast schwarz auf dunkelgrau.
    ".cm-vim-panel input": {
      color: "var(--text) !important",
      caretColor: "var(--accent)",
      font: "inherit !important",
      width: "100%",
    },
    // Vims Meldungen — „Invalid command", „Pattern not found" — kommen mit
    // einem festen `color: red` am Element. Das ist in jedem Theme dieselbe
    // Signalfarbe und in keinem die richtige.
    "div.cm-vim-message": { color: "var(--danger) !important" },
  }),
);

/**
 * Was das Vim-Paket einem Ex-Befehl über die eingetippte Zeile mitgibt.
 *
 * `argString` ist der Teil **hinter** dem Befehlsnamen und fehlt, wenn
 * keiner dasteht. `input` dagegen ist die ganze getippte Zeile — bei `:w`
 * also `"w"`. Wer `input` als Ersatz für ein fehlendes `argString` nimmt,
 * hält den Befehlsnamen für einen Dateinamen; genau das hat Rui bis 0.3.5
 * getan und `:w` eine Datei namens `w` schreiben lassen.
 */
interface ExParams {
  argString?: string;
}

/**
 * Das `!` aus `:q!`.
 *
 * Vim parst den Befehlsnamen als `\w+`, das Ausrufezeichen landet deshalb
 * am Anfang des Arguments — nicht irgendwo darin: `:w foo!.txt` schreibt
 * eine Datei, die so heisst, und erzwingt nichts.
 */
function forced(params: ExParams): boolean {
  return argString(params).startsWith("!");
}

function argString(params: ExParams): string {
  return (params.argString ?? "").trim();
}

/**
 * Das Dateiargument eines Befehls — `undefined`, wenn keines dasteht.
 * Ein führendes `!` gehört zum Befehl und nicht zum Namen.
 */
function target(params: ExParams): string | undefined {
  const rest = argString(params).replace(/^!\s*/, "").trim();
  return rest === "" ? undefined : rest;
}

/**
 * `:w`, `:wq`, `:x`, `:e`, `:q` und `:qa` auf Ruis Speicher-, Öffnen- und
 * Schliessweg legen.
 *
 * Ohne das schriebe Vim selbst — und damit an `document.rs` vorbei, das
 * das Encoding der geöffneten Datei erhält und das Zeilenende
 * wiederherstellt. Eine Windows-1252-Datei mit CRLF käme still als UTF-8
 * mit LF zurück.
 *
 * `:w <name>` ist hier mehr als Bequemlichkeit: Seit Rui Dateien nicht
 * mehr nach ihrer ersten Zeile benennt, ist das der Weg, einem frischen
 * Puffer einen Namen zu geben — genau wie in NeoVim.
 */
function defineExCommands(host: VimHost) {
  const writeThenQuit = async (params: ExParams) => {
    // Nur schliessen, wenn das Speichern wirklich geklappt hat — sonst
    // wäre der Text weg, weil der Nutzer den Dialog abgebrochen hat.
    if (await host.write(target(params))) host.quit(false);
  };

  Vim.defineEx("write", "w", (_cm, params) => void host.write(target(params)));
  Vim.defineEx("wq", "wq", (_cm, params) => void writeThenQuit(params));
  Vim.defineEx("xit", "x", (_cm, params) => void writeThenQuit(params));
  // `:saveas` benennt den Puffer um — in Rui dasselbe wie `:w <name>`,
  // weil ein geschriebener Puffer immer der geschriebenen Datei folgt.
  Vim.defineEx("saveas", "sav", (_cm, params) => void host.write(target(params)));
  Vim.defineEx("edit", "e", (_cm, params) => void host.edit(target(params), forced(params)));
  Vim.defineEx("quit", "q", (_cm, params) => host.quit(forced(params)));
  Vim.defineEx("qall", "qa", (_cm, params) => host.quitAll(forced(params)));

  // Tabs. Vim kennt beide Familien — `:tab*` für Reiter, `:b*` für Puffer.
  // Rui hat pro Reiter genau einen Puffer, also zeigen sie hier auf
  // dasselbe: Wer das eine tippt, meint auch das andere.
  Vim.defineEx("tabnew", "tabnew", (_cm, params) => host.tabNew(target(params)));
  Vim.defineEx("tabedit", "tabe", (_cm, params) => host.tabNew(target(params)));
  Vim.defineEx("tabnext", "tabn", () => host.tabCycle(1));
  Vim.defineEx("tabprevious", "tabp", () => host.tabCycle(-1));
  Vim.defineEx("tabclose", "tabc", (_cm, params) => host.tabClose(forced(params)));
  Vim.defineEx("bnext", "bn", () => host.tabCycle(1));
  Vim.defineEx("bprevious", "bp", () => host.tabCycle(-1));
  Vim.defineEx("bdelete", "bd", (_cm, params) => host.tabClose(forced(params)));
}

/**
 * `:set wrap` und Verwandtschaft an Ruis Einstellungen hängen.
 *
 * Über `defineOption` statt über einen eigenen `:set`-Ex-Befehl: Ein
 * eigener `:set` würde den des Pakets ersetzen, und damit fiele alles
 * andere weg, was Vim darunter kennt — `:set ignorecase` etwa. So kommt
 * nur der Name dazu, der Rest bleibt, wo er war. Die Schreibweisen `no…`,
 * `…!` und `…?` bringt das Paket von selbst mit, ebenso die Kurznamen.
 */
function defineOptions(host: VimHost) {
  const boolean = (name: VimOption, aliases: string[]) => {
    // Ohne Vorgabewert: `defineOption` würde ihn sonst sofort setzen und
    // damit Ruis Einstellung beim Laden des Moduls überschreiben.
    Vim.defineOption(name, undefined, "boolean", aliases, (value, cm) => {
      // Ohne Wert ist es ein `:set wrap?`, also eine Frage.
      if (value === undefined) return host.readOption(name);
      // Das Paket ruft den Rückruf zweimal, einmal global und einmal für
      // den Editor. Rui kennt nur eine Einstellung, also zählt der erste.
      if (cm !== undefined) return;
      host.writeOption(name, value);
      return value;
    });
  };

  boolean("wrap", []);
  boolean("number", ["nu"]);
  boolean("relativenumber", ["rnu"]);
}

/**
 * Meldet den Modus, sobald er sich ändert.
 *
 * Muss nach jedem `setState` erneut aufgerufen werden: Der Adapter hängt
 * am ViewPlugin und wird mit dem State neu gebaut, der alte Listener
 * zeigte danach auf einen toten Editor.
 */
export function watchMode(view: EditorView, report: (status: VimStatus | null) => void) {
  const cm = getCM(view);
  if (!cm) {
    report(null);
    return;
  }
  if (!watched.has(cm)) {
    watched.add(cm);
    const update = () => report(readStatus(cm));
    // Modus, fertiger Befehl und angefangene Eingabe — die letzte Zeile
    // ist der Grund, warum `2d` in der Statusleiste mitläuft.
    cm.on("vim-mode-change", update);
    cm.on("vim-command-done", update);
    cm.on("vim-keypress", (key: string) => {
      // `"` leitet die Registerauswahl ein — `"+p` folgt erst im nächsten
      // Tastendruck. Genau dazwischen passt das Lesen der Zwischenablage,
      // das asynchron ist und in `toString()` nicht mehr stattfinden kann.
      if (key === '"') void refresh();
      update();
    });
  }
  report(readStatus(cm));
}

function readStatus(cm: CodeMirror): VimStatus {
  const state = cm.state.vim;
  // Beim Start steht `mode` noch auf nichts — Vim beginnt im Normal Mode.
  return { mode: state?.mode || "normal", pending: state?.status ?? "" };
}
