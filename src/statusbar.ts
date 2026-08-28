import type { Buffer } from "./types";
import type { VimStatus } from "./vim";

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

  constructor(root: HTMLElement, actions: StatusActions) {
    root.innerHTML = `
      <div class="status-left">
        <span class="status-vim" hidden></span>
        <span class="status-pending"></span>
        <span class="status-flags"></span>
      </div>
      <div class="status-right">
        <span class="status-selection"></span>
        <button class="status-btn status-position" title="Gehe zu Zeile (Strg+G)"></button>
        <button class="status-btn status-language" title="Sprache wählen"></button>
        <button class="status-btn status-encoding" title="Encoding wählen"></button>
        <button class="status-btn status-eol" title="Zeilenende wählen"></button>
        <span class="status-divider"></span>
        <div class="status-tools">
          <button class="status-icon status-settings" title="Einstellungen (Strg+,)" aria-label="Einstellungen">
            ${GEAR_SVG}
          </button>
        </div>
      </div>`;

    this.position = root.querySelector(".status-position")!;
    this.selection = root.querySelector(".status-selection")!;
    this.language = root.querySelector(".status-language")!;
    this.encoding = root.querySelector(".status-encoding")!;
    this.lineEnding = root.querySelector(".status-eol")!;
    this.flags = root.querySelector(".status-flags")!;
    this.vim = root.querySelector(".status-vim")!;
    this.pending = root.querySelector(".status-pending")!;
    this.settings = root.querySelector(".status-settings")!;

    this.position.addEventListener("click", actions.onPosition);
    this.language.addEventListener("click", actions.onLanguage);
    this.encoding.addEventListener("click", actions.onEncoding);
    this.lineEnding.addEventListener("click", actions.onLineEnding);
    this.settings.addEventListener("click", actions.onSettings);
  }

  update(
    info: StatusInfo,
    buffer: Buffer,
    languageName: string,
    modified: boolean,
    autosave: boolean,
  ) {
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
    if (modified) marks.push("Geändert");
    this.flags.textContent = marks.join(" · ");
    this.flags.classList.toggle("is-modified", modified);
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
      : "Vim-Steuerung aktiv";
  }
}
