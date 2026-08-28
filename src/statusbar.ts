import type { Buffer } from "./types";

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
}

const LINE_ENDING_LABEL = { lf: "LF", crlf: "CRLF", cr: "CR" } as const;

/**
 * Die einzige dauerhaft sichtbare Bedienfläche neben dem Text.
 *
 * Jedes Feld ist anklickbar und öffnet die zugehörige Auswahl — dadurch
 * braucht der Editor keine Menüleiste für Encoding, Zeilenende oder
 * Sprache, und die Information steht trotzdem immer im Blick.
 */
export class StatusBar {
  private readonly position: HTMLButtonElement;
  private readonly selection: HTMLSpanElement;
  private readonly language: HTMLButtonElement;
  private readonly encoding: HTMLButtonElement;
  private readonly lineEnding: HTMLButtonElement;
  private readonly flags: HTMLSpanElement;

  constructor(root: HTMLElement, actions: StatusActions) {
    root.innerHTML = `
      <div class="status-left">
        <span class="status-flags"></span>
      </div>
      <div class="status-right">
        <span class="status-selection"></span>
        <button class="status-btn status-position" title="Gehe zu Zeile (Strg+G)"></button>
        <button class="status-btn status-language" title="Sprache wählen"></button>
        <button class="status-btn status-encoding" title="Encoding wählen"></button>
        <button class="status-btn status-eol" title="Zeilenende wählen"></button>
      </div>`;

    this.position = root.querySelector(".status-position")!;
    this.selection = root.querySelector(".status-selection")!;
    this.language = root.querySelector(".status-language")!;
    this.encoding = root.querySelector(".status-encoding")!;
    this.lineEnding = root.querySelector(".status-eol")!;
    this.flags = root.querySelector(".status-flags")!;

    this.position.addEventListener("click", actions.onPosition);
    this.language.addEventListener("click", actions.onLanguage);
    this.encoding.addEventListener("click", actions.onEncoding);
    this.lineEnding.addEventListener("click", actions.onLineEnding);
  }

  update(info: StatusInfo, buffer: Buffer, languageName: string, modified: boolean) {
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
    if (modified) marks.push("Geändert");
    this.flags.textContent = marks.join(" · ");
    this.flags.classList.toggle("is-modified", modified);
  }
}
