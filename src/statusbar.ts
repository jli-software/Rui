import type { Buffer } from "./types";
import type { VimStatus } from "./vim";
import { tr } from "./i18n";

export interface StatusInfo {
  line: number;
  column: number;
  lines: number;
  selected: number;
  selections: number;
}

export interface StatusActions {
  onEncoding: () => void;
  onLineEnding: () => void;
  onLanguage: () => void;
  onPosition: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onAbout: () => void;
  /** Klick auf den Dateinamen — legt den vollen Pfad in die Zwischenablage. */
  onFile: () => void;
}

const LINE_ENDING_LABEL = { lf: "LF", crlf: "CRLF", cr: "CR" } as const;

/**
 * Zahnrad, selbst gezeichnet statt aus einer Icon-Bibliothek: ein Ring mit
 * acht radialen Zähnen und einer Nabe. Bei 14 px zerfällt ein detaillierter
 * Zahnkranz zu Matsch — diese Form bleibt lesbar, weil die Zähne einzelne
 * Striche sind und mit der Strichstärke mitwachsen. `currentColor` sorgt
 * dafür, dass es dem Hover-Zustand des Knopfes folgt.
 */
const GEAR_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
       stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="4.4" />
    <circle cx="8" cy="8" r="1.6" />
    <path d="M8 3.6V1.5M8 12.4v2.1M3.6 8H1.5M12.4 8h2.1
             M4.89 4.89 3.4 3.4M11.11 11.11l1.49 1.49
             M11.11 4.89 12.6 3.4M4.89 11.11 3.4 12.6" />
  </svg>`;

/**
 * Tastatur, ebenfalls selbst gezeichnet: ein Rahmen mit drei Reihen Tasten
 * als Punkte und einer Leertaste darunter. Bei 14 px trägt ein Symbol nur
 * wenige Striche — diese Silhouette bleibt auch dann noch erkennbar als
 * das, was sie meint, und passt in Strichstärke und Rundung zum Zahnrad
 * daneben.
 */
const KEYBOARD_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
       stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
    <rect x="1.2" y="3.4" width="13.6" height="9.2" rx="1.6" />
    <path d="M4 6h0M6.5 6h0M9 6h0M11.5 6h0M4 8.4h0M6.5 8.4h0M9 8.4h0M11.5 8.4h0"
          stroke-width="1.6" />
    <path d="M5 10.8h6" />
  </svg>`;

/**
 * Info, ebenfalls selbst gezeichnet: ein Kreis mit Punkt und Strich. Das
 * ist die eine Form, die auf 14 px noch als „hier steht, was das hier
 * ist" gelesen wird — ein Fragezeichen meint Hilfe, ein Buchstabe „i" in
 * der Textschrift fällt neben zwei Strichzeichnungen aus dem Satz.
 */
const INFO_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
       stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.2v4" />
    <path d="M8 4.7h0" stroke-width="1.8" />
  </svg>`;

/**
 * Die einzige dauerhaft sichtbare Bedienfläche neben dem Text.
 *
 * Jedes Feld ist anklickbar und öffnet die zugehörige Auswahl — dadurch
 * braucht der Editor keine Menüleiste für Encoding, Zeilenende oder
 * Sprache, und die Information steht trotzdem immer im Blick.
 *
 * Ganz rechts sitzt hinter einem Trenner die Werkzeuggruppe. Sie ist von
 * den Textfeldern getrennt, weil dort Knöpfe landen, die nichts über die
 * Datei aussagen, sondern etwas tun — heute das Zahnrad, später etwa die
 * Schriftgrösse. Alles, was mit der Maus erreichbar sein muss, gehört
 * hierher und nicht in eine Menüleiste.
 */
export class StatusBar {
  /** Name der offenen Datei — das Feld, das am häufigsten gefragt ist. */
  private readonly file: HTMLButtonElement;
  private readonly position: HTMLButtonElement;
  private readonly selection: HTMLSpanElement;
  private readonly language: HTMLButtonElement;
  private readonly encoding: HTMLButtonElement;
  private readonly lineEnding: HTMLButtonElement;
  private readonly flags: HTMLSpanElement;
  private readonly vim: HTMLSpanElement;
  /** Angefangene Vim-Eingabe, etwa `2d` — beim Lernen die halbe Miete. */
  private readonly pending: HTMLSpanElement;
  private readonly settings: HTMLButtonElement;
  private readonly shortcuts: HTMLButtonElement;
  private readonly about: HTMLButtonElement;
  /** Kurzmeldung nach einer Aktion, etwa `"notiz.md" geschrieben`. */
  private readonly message: HTMLSpanElement;
  private messageTimer: number | undefined;

  constructor(root: HTMLElement, actions: StatusActions) {
    root.innerHTML = `
      <div class="status-left">
        <span class="status-vim" hidden></span>
        <span class="status-pending"></span>
        <span class="status-flags"></span>
        <span class="status-message"></span>
      </div>
      <div class="status-right">
        <button class="status-btn status-file"></button>
        <span class="status-selection"></span>
        <button class="status-btn status-position" title="Gehe zu Zeile (Strg+G)"></button>
        <button class="status-btn status-language" title="Sprache wählen"></button>
        <button class="status-btn status-encoding" title="Encoding wählen"></button>
        <button class="status-btn status-eol" title="Zeilenende wählen"></button>
        <span class="status-divider"></span>
        <div class="status-tools">
          <button class="status-icon status-about" title="Über Rui" aria-label="Über Rui">
            ${INFO_SVG}
          </button>
          <button class="status-icon status-shortcuts" title="Tastenkürzel (Strg+K)" aria-label="Tastenkürzel">
            ${KEYBOARD_SVG}
          </button>
          <button class="status-icon status-settings" title="Einstellungen (Strg+I)" aria-label="Einstellungen">
            ${GEAR_SVG}
          </button>
        </div>
      </div>`;

    this.file = root.querySelector(".status-file")!;
    this.position = root.querySelector(".status-position")!;
    this.selection = root.querySelector(".status-selection")!;
    this.language = root.querySelector(".status-language")!;
    this.encoding = root.querySelector(".status-encoding")!;
    this.lineEnding = root.querySelector(".status-eol")!;
    this.flags = root.querySelector(".status-flags")!;
    this.vim = root.querySelector(".status-vim")!;
    this.pending = root.querySelector(".status-pending")!;
    this.settings = root.querySelector(".status-settings")!;
    this.shortcuts = root.querySelector(".status-shortcuts")!;
    this.about = root.querySelector(".status-about")!;
    this.message = root.querySelector(".status-message")!;

    this.file.addEventListener("click", actions.onFile);
    this.position.addEventListener("click", actions.onPosition);
    this.language.addEventListener("click", actions.onLanguage);
    this.encoding.addEventListener("click", actions.onEncoding);
    this.lineEnding.addEventListener("click", actions.onLineEnding);
    this.settings.addEventListener("click", actions.onSettings);
    this.shortcuts.addEventListener("click", actions.onShortcuts);
    this.about.addEventListener("click", actions.onAbout);
  }

  update(
    info: StatusInfo,
    buffer: Buffer,
    languageName: string,
    modified: boolean,
    autosave: boolean,
  ) {
    // Der Dateiname zuerst: Wer mit mehreren Reitern arbeitet, fragt beim
    // Blick nach unten „welche Datei ist das hier", nicht „welche Spalte".
    // Im Fenstertitel steht er zwar auch, aber unter Hyprland ohne
    // Dekoration sieht man den Titel gar nicht — und mit mehreren Rui-
    // Fenstern nebeneinander erst recht nicht das richtige.
    const path = buffer.path;
    const name = path ? path.split(/[\\/]/).pop() || path : tr("Unbenannt");
    this.file.textContent = (modified ? "• " : "") + name;
    this.file.classList.toggle("is-modified", modified);
    this.file.classList.toggle("is-unnamed", !path);
    this.file.title = path
      ? `${path}\n${tr("Klick kopiert den Pfad")}`
      : tr("Noch nicht gespeichert — Strg+S gibt der Notiz einen Namen");

    this.position.textContent = `Z ${info.line}, Sp ${info.column}`;

    if (info.selections > 1) {
      this.selection.textContent = `${info.selections} Auswahlen (${info.selected})`;
    } else if (info.selected > 0) {
      this.selection.textContent = `${info.selected} ausgewählt`;
    } else {
      this.selection.textContent = `${info.lines} Zeilen`;
    }

    this.language.textContent = languageName;
    this.encoding.textContent = buffer.encoding + (buffer.bom ? " BOM" : "");
    this.lineEnding.textContent = LINE_ENDING_LABEL[buffer.lineEnding];

    const marks: string[] = [];
    if (buffer.readOnly) marks.push("Schreibgeschützt");
    // Nur der eingeschaltete Zustand wird angezeigt: Autosave aus ist die
    // Vorgabe und braucht keinen Hinweis, Autosave an dagegen schon —
    // dann schreibt Rui die Datei, ohne dass jemand Strg+S gedrückt hat.
    if (autosave) marks.push("Autosave");
    // „Geändert" stand bis 0.5.0 hier. Seit der Dateiname daneben steht,
    // sagt der Punkt davor dasselbe auf einem Zehntel der Breite — und in
    // einem halbbreiten Fenster war für beides kein Platz: Es stand dann
    // „Geänder…" neben „• Un…", zwei halbe Wörter statt einer Auskunft.
    this.flags.textContent = marks.join(" · ");
    this.flags.classList.toggle("is-modified", modified);
  }

  /**
   * Eine kurze Rückmeldung, die von selbst wieder verschwindet.
   *
   * Vim schreibt nach `:w` `"datei.md" 12L, 340B written` in die
   * Kommandozeile. Rui hatte darauf gar keine Antwort: Ob `:w` etwas
   * getan hat, liess sich nur daran ablesen, dass „Geändert" verschwand —
   * und beim Speichern einer unveränderten Datei nicht einmal daran.
   */
  flash(text: string) {
    window.clearTimeout(this.messageTimer);
    this.message.textContent = text;
    this.messageTimer = window.setTimeout(() => {
      this.message.textContent = "";
    }, 2500);
  }

  /**
   * Der Vim-Modus steht links bei den Anzeigefeldern, nicht rechts bei den
   * Werkzeugen: Er sagt etwas aus, er tut nichts. Ist die Steuerung aus,
   * verschwindet das Feld ganz — sonst stünde in einem Editor ohne Vim
   * dauerhaft ein leerer Platzhalter.
   */
  setVimMode(status: VimStatus | null) {
    this.vim.hidden = status === null;
    this.pending.textContent = status?.pending ?? "";
    if (!status) return;
    // Vims eigene Schreibweise, damit sie einem in jedem Vim-Tutorial
    // wieder begegnet: NORMAL, INSERT, VISUAL LINE.
    this.vim.textContent = status.mode.toUpperCase();
    this.vim.dataset.mode = status.mode.split(" ")[0];
    this.vim.title = status.pending
      ? `Vim — angefangen: ${status.pending}`
      : `Vim-Steuerung aktiv — ${status.mode}`;
  }
}
