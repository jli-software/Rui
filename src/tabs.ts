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
  /** Doppelklick auf den Namen — der neue Name kommt schon getrimmt an. */
  onRename: (id: number, name: string) => void;
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
  /** Der Reiter, dessen Name gerade bearbeitet wird. */
  private renaming: number | null = null;
  /**
   * Der zuletzt übergebene Zustand.
   *
   * `render` kommt aus `refreshStatus` und damit bei jeder Cursorbewegung.
   * Während einer Umbenennung darf die Leiste sich deshalb nicht neu
   * zeichnen — das Eingabefeld wäre mitten im Tippen weg. Der Zustand wird
   * hier gemerkt und nach dem Abschluss nachgeholt.
   */
  private last: { tabs: Tab[]; activeId: number } | null = null;

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
      if (id === null || id === this.renaming) return;
      if ((event.target as HTMLElement).closest(".tab-close")) this.actions.onClose(id);
      else this.actions.onSelect(id);
    });

    // Doppelklick benennt um — der Griff, den Dateimanager und die
    // Editoren daneben alle kennen. Der erste Klick hat den Reiter dabei
    // schon aktiviert, es wird also immer der bearbeitet, den man sieht.
    this.list.addEventListener("dblclick", (event) => {
      if ((event.target as HTMLElement).closest(".tab-close")) return;
      const id = this.idFrom(event.target);
      if (id === null) return;
      event.preventDefault();
      this.startRename(id);
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

  /** Ob gerade ein Name bearbeitet wird — die Kürzel halten sich dann raus. */
  get isRenaming(): boolean {
    return this.renaming !== null;
  }

  /**
   * Macht aus dem Namen ein Eingabefeld.
   *
   * Vorausgewählt ist der Name ohne Endung: Wer umbenennt, meint fast
   * immer den Namen und nicht das `.ps1` — und eine Endung, die beim
   * ersten Tastendruck mit verschwindet, nimmt der Datei ihre Sprache.
   *
   * `false` heisst: Hier ist gerade nichts zu bearbeiten — die Leiste ist
   * bei einer einzigen Datei verborgen, oder ein anderer Name steht
   * bereits in Arbeit. Der Aufrufer fragt dann anders nach.
   */
  startRename(id: number): boolean {
    if (this.renaming !== null || this.root.hidden) return false;
    const tab = this.list.querySelector<HTMLElement>(`.tab[data-id="${id}"]`);
    const label = tab?.querySelector<HTMLElement>(".tab-label");
    if (!tab || !label) return false;

    const name = label.textContent ?? "";
    const input = document.createElement("input");
    input.className = "tab-rename";
    input.type = "text";
    input.spellcheck = false;
    input.value = name;
    input.setAttribute("aria-label", "Datei umbenennen");

    // Wohin der Fokus danach zurückgeht. Über `F2` ist das der Text, und
    // ein Editor, in den man nach dem Umbenennen erst wieder hineinklicken
    // muss, wäre ein Rückschritt gegenüber gar keinem Umbenennen.
    const previous = document.activeElement as HTMLElement | null;

    this.renaming = id;
    label.replaceWith(input);

    let settled = false;
    const finish = (commit: boolean) => {
      if (settled) return;
      settled = true;
      const value = input.value.trim();
      this.renaming = null;
      if (previous && previous !== input) previous.focus?.();
      // Erst neu zeichnen, dann melden: Der Aufrufer schreibt auf die
      // Platte und zeichnet danach selbst — käme die Leiste hinterher,
      // stünde kurz wieder der alte Name da.
      this.redraw();
      if (commit && value !== "" && value !== name) this.actions.onRename(id, value);
    };

    input.addEventListener("keydown", (event) => {
      // Der globale Tastaturhaken hängt am Fenster und käme hier sonst
      // zuerst dran — `Strg+W` schlösse den Reiter, den man gerade
      // benennt.
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    // Wer daneben klickt, hat den Namen so gemeint — wie im Dateimanager.
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("dblclick", (event) => event.stopPropagation());

    input.focus();
    const dot = name.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : name.length);
    return true;
  }

  private redraw() {
    if (this.last) this.draw(this.last.tabs, this.last.activeId);
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
    this.last = { tabs, activeId };
    if (this.renaming !== null) return;
    this.draw(tabs, activeId);
  }

  private draw(tabs: Tab[], activeId: number) {
    this.root.hidden = tabs.length < 2;

    this.list.innerHTML = "";
    for (const tab of tabs) {
      const element = document.createElement("div");
      element.className = "tab";
      element.dataset.id = String(tab.id);
      element.setAttribute("role", "tab");
      element.title = `${tab.buffer.path ?? "Ungespeichert"}\nDoppelklick benennt um`;
      if (tab.id === activeId) element.classList.add("is-active");
      if (tab.modified) element.classList.add("is-modified");

      // Der Punkt für „geändert" steht links vor dem Namen — dieselbe
      // Stelle wie in der Statusleiste und die, an der das Auge beim Lesen
      // ohnehin anfängt. Bis 0.5.1 sass er im Schliessen-Knopf: Da war er
      // nicht als Zustand zu lesen, sondern als Knopfbeschriftung, und beim
      // Überfahren wurde er zum Kreuz. Er steht immer im Layout und ist
      // ungeändert nur unsichtbar — sonst spränge der Reiter beim ersten
      // Tastendruck in der Breite.
      const dot = document.createElement("span");
      dot.className = "tab-dot";
      dot.textContent = "•";
      dot.setAttribute("aria-hidden", "true");
      element.append(dot);

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = tabTitle(tab);
      element.append(label);

      const close = document.createElement("button");
      close.className = "tab-close";
      close.setAttribute("aria-label", `${tabTitle(tab)} schliessen`);
      close.title = "Schliessen (Strg+W)";
      close.textContent = "✕";
      element.append(close);

      this.list.append(element);
    }

    this.list
      .querySelector<HTMLElement>(".tab.is-active")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}
