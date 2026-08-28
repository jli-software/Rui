import { fuzzyScore } from "./palette";
import type { QuickOpenFile } from "./types";

export interface QuickOpenActions {
  /** `null`: Es ist noch kein Notizen-Ordner eingerichtet. */
  load: () => Promise<QuickOpenFile[] | null>;
  /** Der durchsuchte Ordner, für den Kopf des Fensters. */
  scope: () => string | null;
  open: (path: string) => void;
  openNative: () => void;
  openSettings: () => void;
  onClose: () => void;
}

/**
 * Tastaturgetriebener Dateiöffner für den Notizen-Ordner.
 *
 * Der Öffner ist bewusst ein eigenes Overlay statt eine Variante der
 * Befehlspalette: Dateien haben Pfad und Änderungszeit, ausserdem braucht der
 * Leerzustand direkte Wege zu Einstellungen und nativem Dateidialog.
 */
export class QuickOpen {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private readonly hint: HTMLDivElement;
  private readonly scope: HTMLElement;
  private files: QuickOpenFile[] = [];
  private matches: QuickOpenFile[] = [];
  private active = 0;
  private loadGeneration = 0;
  private state: "loading" | "ready" | "no-folder" | "error" = "ready";
  private error = "";

  constructor(private readonly actions: QuickOpenActions) {
    this.root = document.createElement("div");
    this.root.className = "overlay";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="palette quick-open" role="dialog" aria-modal="true" aria-label="Datei öffnen">
        <header class="quick-open-head">
          <span>Datei öffnen <small class="quick-open-scope"></small></span>
          <span>zuletzt geändert</span>
        </header>
        <input class="palette-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="Datei suchen…" aria-label="Datei suchen">
        <ul class="palette-list quick-open-list" role="listbox"></ul>
        <div class="quick-open-hint" hidden></div>
        <footer class="quick-open-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> wählen · <kbd>Enter</kbd> öffnen · <kbd>Esc</kbd> schliessen</span>
          <button class="link-btn" data-act="native">Andere Datei öffnen… <kbd>Strg+Umschalt+O</kbd></button>
        </footer>
      </div>`;
    document.body.appendChild(this.root);

    this.input = this.root.querySelector(".palette-input")!;
    this.list = this.root.querySelector(".quick-open-list")!;
    this.hint = this.root.querySelector(".quick-open-hint")!;
    this.scope = this.root.querySelector(".quick-open-scope")!;

    this.input.addEventListener("input", () => this.filter());
    this.input.addEventListener("keydown", (event) => this.onKey(event));
    this.root.addEventListener("mousedown", (event) => {
      if (event.target === this.root) this.close();
    });
    this.root.querySelector<HTMLButtonElement>('[data-act="native"]')!.addEventListener("click", () => {
      this.close();
      this.actions.openNative();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  async open() {
    const generation = ++this.loadGeneration;
    this.root.hidden = false;
    this.setScope(this.actions.scope());
    this.input.value = "";
    this.files = [];
    this.matches = [];
    this.active = 0;
    this.state = "loading";
    this.render();
    this.input.focus();

    try {
      const files = await this.actions.load();
      if (generation !== this.loadGeneration || !this.isOpen) return;
      if (files === null) {
        this.state = "no-folder";
      } else {
        this.files = files;
        this.state = "ready";
      }
    } catch (error) {
      if (generation !== this.loadGeneration || !this.isOpen) return;
      this.state = "error";
      this.error = String(error);
    }
    this.filter();
  }

  close() {
    if (!this.isOpen) return;
    ++this.loadGeneration;
    this.root.hidden = true;
    this.actions.onClose();
  }

  /**
   * Zeigt an, worin gesucht wird.
   *
   * Ohne das bleibt beim Tippen offen, warum eine Datei fehlt, die es doch
   * gibt — sie liegt schlicht ausserhalb des eingestellten Ordners.
   */
  private setScope(folder: string | null) {
    this.scope.textContent = folder ? shortenPath(folder) : "";
    this.scope.title = folder ?? "";
  }

  private filter() {
    const query = this.input.value.trim();
    this.matches = query
      ? this.files
          .map((file, index) => ({
            file,
            index,
            score: fuzzyScore(query, `${file.name} ${file.relativePath}`),
          }))
          .filter((match) => match.score > 0)
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .map((match) => match.file)
      : [...this.files];
    this.active = 0;
    this.render();
  }

  private render() {
    const message = this.emptyMessage();
    this.hint.hidden = message === null;
    this.list.hidden = message !== null;

    if (message) {
      this.hint.replaceChildren(message);
      return;
    }

    this.hint.replaceChildren();
    this.list.replaceChildren(
      ...this.matches.map((file, index) => {
        const item = document.createElement("li");
        item.className = "palette-item quick-open-item" + (index === this.active ? " is-active" : "");
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(index === this.active));

        const text = document.createElement("span");
        text.className = "quick-open-text";
        const name = document.createElement("strong");
        name.textContent = file.name;
        const path = document.createElement("small");
        path.textContent = relativeFolder(file.relativePath);
        text.append(name, path);

        const modified = document.createElement("time");
        modified.className = "quick-open-time";
        modified.dateTime = new Date(file.modifiedMs).toISOString();
        modified.textContent = formatModified(file.modifiedMs);

        item.append(text, modified);
        item.addEventListener("mouseenter", () => {
          this.active = index;
          this.render();
        });
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          this.execute(file);
        });
        return item;
      }),
    );
    this.list.children[this.active]?.scrollIntoView({ block: "nearest" });
  }

  private emptyMessage(): Node | null {
    if (this.state === "loading") return document.createTextNode("Notizen werden geladen…");

    if (this.state === "no-folder") {
      const wrap = document.createElement("div");
      wrap.append("Lege zuerst einen Notizen-Ordner fest. ");
      const button = document.createElement("button");
      button.className = "link-btn";
      button.textContent = "Einstellungen öffnen";
      button.addEventListener("click", () => {
        this.close();
        this.actions.openSettings();
      });
      wrap.append(button);
      return wrap;
    }

    if (this.state === "error") return document.createTextNode(this.error);
    if (this.files.length === 0) return document.createTextNode("Keine Textdatei in diesem Ordner gefunden.");
    if (this.matches.length === 0) return document.createTextNode("Keine passende Datei gefunden.");
    return null;
  }

  private onKey(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        this.close();
        break;
      case "ArrowDown":
        event.preventDefault();
        this.move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.move(-1);
        break;
      case "Enter": {
        event.preventDefault();
        const file = this.matches[this.active];
        if (file) this.execute(file);
        break;
      }
    }
  }

  private move(delta: number) {
    if (this.matches.length === 0) return;
    this.active = (this.active + delta + this.matches.length) % this.matches.length;
    this.render();
  }

  private execute(file: QuickOpenFile) {
    this.close();
    this.actions.open(file.path);
  }
}

/**
 * Kürzt einen Pfad auf die letzten beiden Teile.
 *
 * `C:\Users\jonas\Nextcloud\Notes` sagt im Kopf nichts, was
 * `Nextcloud\Notes` nicht auch sagt — und der volle Pfad steht im `title`.
 */
function shortenPath(folder: string): string {
  const parts = folder.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/");
}

function relativeFolder(relativePath: string): string {
  const separator = Math.max(relativePath.lastIndexOf("/"), relativePath.lastIndexOf("\\"));
  return separator < 0 ? "Notizen-Ordner" : relativePath.slice(0, separator);
}

function formatModified(modifiedMs: number): string {
  const date = new Date(modifiedMs);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `Heute ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Gestern ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}
