import { vim, getCM, Vim, type CodeMirror } from "@replit/codemirror-vim";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

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
  /** `:q`, mit `!` als `force` — schliesst wie das Fensterkreuz. */
  quit: (force: boolean) => void;
}

/**
 * `Vim` ist ein Singleton des Moduls, seine Ex-Befehle sind es damit auch.
 * Rui hat genau ein Fenster und einen Host, also reicht es, sie einmal zu
 * definieren.
 */
let exCommandsDefined = false;

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
  defineExCommands(host);
  return [vim(), cursorTheme];
}

/**
 * Der Blockcursor in Ruis Farben.
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
    ".cm-vim-panel": { fontFamily: "inherit", padding: "2px 10px" },
  }),
);

/** Was das Vim-Paket einem Ex-Befehl über die eingetippte Zeile mitgibt. */
interface ExParams {
  argString?: string;
  input?: string;
  args?: string[];
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
  const raw = params.argString ?? params.args?.join(" ") ?? params.input ?? "";
  return raw.trim();
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
  if (exCommandsDefined) return;
  exCommandsDefined = true;

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
  Vim.defineEx("qall", "qa", (_cm, params) => host.quit(forced(params)));
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
    cm.on("vim-keypress", update);
  }
  report(readStatus(cm));
}

function readStatus(cm: CodeMirror): VimStatus {
  const state = cm.state.vim;
  // Beim Start steht `mode` noch auf nichts — Vim beginnt im Normal Mode.
  return { mode: state?.mode || "normal", pending: state?.status ?? "" };
}
