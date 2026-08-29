import type { EditorState } from "@codemirror/state";

import type { LanguageDef } from "./languages";
import type { Buffer } from "./types";

/**
 * Ein Tab: der Puffer und alles, was der Editor beim Zurückwechseln
 * mitbringen muss.
 *
 * Der `state` ist der Grund, warum ein Tab mehr ist als ein `Buffer`. Ein
 * CodeMirror-`EditorState` trägt Cursor, Auswahl, Faltung **und** die
 * Undo-Historie; würde Rui beim Wechsel nur den Text merken und den State
 * neu bauen, verhielte sich jeder Tabwechsel wie ein Neuöffnen — und
 * genau das erwartet von Tabs niemand. Der State des sichtbaren Tabs lebt
 * in der View und steht hier auf `null`; erst beim Wegwechseln wird er
 * hier abgelegt.
 */
export interface Tab {
  readonly id: number;
  buffer: Buffer;
  language: LanguageDef;
  /** Von Hand gewählte Sprache; überschreibt die Erkennung am Dateinamen. */
  languageOverride: string | null;
  state: EditorState | null;
  scrollTop: number;
  /**
   * Ob der Tab ungespeicherte Änderungen hat.
   *
   * Gemerkt statt bei jedem Zeichnen aus dem State berechnet: Für einen
   * inaktiven Tab kann sich das ohnehin nicht ändern, und `doc.toString()`
   * für jeden offenen Tab bei jedem Tastendruck wäre bei einem
   * Snippet-Editor immer noch Verschwendung.
   */
  modified: boolean;
}

export interface TabBarActions {
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}

/** Der Name im Reiter — der Dateiname, sonst „Unbenannt". */
export function tabTitle(tab: Tab): string {
  const path = tab.buffer.path;
  if (!path) return "Unbenannt";
  return path.split(/[\\/]/).pop() || path;
}

/**
 * Die Reiterleiste über dem Editor.
 *
 * Sie sitzt in jedem Dekorationsmodus an derselben Stelle — auch im
 * `custom`-Modus, wo sie in die eigene Titelleiste passen würde. Das
 * spart eine Zeile Höhe, kostet aber zwei Layouts, die auseinanderlaufen
 * können; unter Hyprland gibt es die Titelleiste gar nicht.
 *
 * Bei einem einzelnen Tab bleibt die Leiste verborgen: Wer Rui wie bisher
 * für eine Datei benutzt, soll dafür keine Zeile Höhe bezahlen.
 */
export class TabBar {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;

  constructor(root: HTMLElement, private readonly actions: TabBarActions) {
    this.root = root;
    root.innerHTML = `
      <div class="tabs-list" role="tablist"></div>
      <button class="tabs-new" title="Neuer Tab (Strg+T)" aria-label="Neuer Tab">+</button>`;
    this.list = root.querySelector(".tabs-list")!;
    root.querySelector<HTMLButtonElement>(".tabs-new")!.addEventListener("click", () =>
      this.actions.onNew(),
    );

    // Ein Handler an der Liste statt einer pro Reiter: Beim Neuzeichnen
    // entstehen alle Elemente neu, und Zuhörer, die man dabei vergisst,
    // sind der klassische Weg zu einem Tab, der nicht mehr reagiert.
    this.list.addEventListener("click", (event) => {
      const id = this.idFrom(event.target);
      if (id === null) return;
      if ((event.target as HTMLElement).closest(".tab-close")) this.actions.onClose(id);
      else this.actions.onSelect(id);
    });

    // Mittelklick schliesst — wie im Browser. `auxclick` statt `mousedown`,
    // damit der Klick auch dort landet, wo er begonnen hat.
    this.list.addEventListener("auxclick", (event) => {
      if (event.button !== 1) return;
      const id = this.idFrom(event.target);
      if (id === null) return;
      event.preventDefault();
      this.actions.onClose(id);
    });

    // Am Reiterband scrollt das Rad waagerecht: senkrecht gibt es hier
    // nichts zu holen, und ein Rad, das nichts tut, wirkt wie ein Fehler.
    this.list.addEventListener(
      "wheel",
      (event) => {
        if (event.deltaX !== 0) return;
        this.list.scrollLeft += event.deltaY;
      },
      { passive: true },
    );
  }

  private idFrom(target: EventTarget | null): number | null {
    const tab = (target as HTMLElement | null)?.closest<HTMLElement>(".tab");
    return tab ? Number(tab.dataset.id) : null;
  }

  /**
   * Zeichnet die Leiste neu.
   *
   * Wird ausschliesslich bei einer echten Zustandsänderung gerufen, nie
   * aus einem Hover heraus — im Quick Open hat genau das bis 0.2.1 den
   * Mausklick gefressen, weil das Element unter dem Zeiger zwischen
   * `mousedown` und `click` ausgetauscht wurde.
   */
  render(tabs: Tab[], activeId: number) {
    this.root.hidden = tabs.length < 2;

    this.list.innerHTML = "";
    for (const tab of tabs) {
      const element = document.createElement("div");
      element.className = "tab";
      element.dataset.id = String(tab.id);
      element.setAttribute("role", "tab");
      element.title = tab.buffer.path ?? "Ungespeichert";
      if (tab.id === activeId) element.classList.add("is-active");
      if (tab.modified) element.classList.add("is-modified");

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = tabTitle(tab);
      element.append(label);

      const close = document.createElement("button");
      close.className = "tab-close";
      close.setAttribute("aria-label", `${tabTitle(tab)} schliessen`);
      close.title = "Schliessen (Strg+W)";
      // Der Punkt für „geändert" sitzt im selben Knopf: So springt der
      // Reiter beim Hover nicht in der Breite, und der Platz reicht in
      // beiden Zuständen.
      close.textContent = tab.modified ? "•" : "✕";
      element.append(close);

      this.list.append(element);
    }

    this.list
      .querySelector<HTMLElement>(".tab.is-active")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}
