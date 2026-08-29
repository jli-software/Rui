import { fuzzyScoreLower, matchRanges } from "./palette";
import type { QuickOpenFile } from "./types";

/**
 * Wie viele Zeilen über und unter dem sichtbaren Ausschnitt vorgebaut
 * werden. Ohne Reserve blitzt beim schnellen Scrollen der leere Streifen
 * durch, den der Browser noch nicht gezeichnet hat.
 */
const OVERSCAN = 6;

/**
 * Bonus für einen Treffer im Dateinamen gegenüber einem im Pfad.
 *
 * Grösser als jede erreichbare Punktzahl aus `fuzzyScoreLower`, damit die
 * Reihenfolge eindeutig ist: erst alles, was im Namen passt, dann alles
 * Übrige. Wer `deploy` tippt, sucht `deploy.ps1` — nicht die zwölf Dateien
 * im Ordner `deploy/`.
 */
const NAME_BONUS = 100_000;

/**
 * Wie lange die zuletzt gelesene Dateiliste beim erneuten Öffnen sofort
 * gezeigt wird, bevor der Ordner wieder durchsucht ist.
 *
 * Der Ordner wird trotzdem jedes Mal neu gelesen — die Liste steht nur
 * währenddessen schon da, statt für einen Moment leer zu bleiben. Nach
 * einer Viertelstunde ist die Vorschau mehr Rätsel als Hilfe.
 */
const CACHE_MS = 15 * 60 * 1000;

export interface QuickOpenActions {
  /** `null`: Es ist noch kein Notizen-Ordner eingerichtet. */
  load: () => Promise<QuickOpenFile[] | null>;
  /** Die durchsuchten Ordner, für den Kopf des Fensters. */
  scope: () => string[];
  open: (path: string) => void;
  openNative: () => void;
  openSettings: () => void;
  onClose: () => void;
}

/**
 * Eine Datei, fertig vorbereitet für die Suche.
 *
 * Alles, was pro Tastendruck sonst neu entstünde, entsteht hier einmal beim
 * Laden: die klein geschriebenen Suchspuren und der Ordnertext der Zeile.
 * Bei 20 000 Dateien ist das der Unterschied zwischen einer Liste, die dem
 * Tippen folgt, und einer, die hinterherhinkt.
 */
interface Entry {
  file: QuickOpenFile;
  /** Der Dateiname, klein geschrieben — die Hauptspur der Suche. */
  name: string;
  /** `Wurzel/Unterordner/Datei`, klein geschrieben — die zweite Spur. */
  path: string;
  /** Der Ordnertext der Zeile, wie er angezeigt wird. */
  folder: string;
  /** Die ursprüngliche Position, damit gleich Bewertetes stabil steht. */
  index: number;
}

/** Der gerade gebaute Ausschnitt der Liste. */
interface Window {
  first: number;
  last: number;
}

/**
 * Tastaturgetriebener Dateiöffner für den Notizen-Ordner.
 *
 * Der Öffner ist bewusst ein eigenes Overlay statt eine Variante der
 * Befehlspalette: Dateien haben Pfad und Änderungszeit, ausserdem braucht der
 * Leerzustand direkte Wege zu Einstellungen und nativem Dateidialog.
 *
 * Die Liste wird virtualisiert gezeichnet — es entstehen nur die Zeilen, die
 * man gerade sieht. Vorher waren es 500 pro Tastendruck, jedes mit vier
 * Kindelementen; das war bei einem grossen Notizordner genau der Grund,
 * warum sich das Tippen zäh anfühlte. Nebenbei fällt damit die Obergrenze
 * weg: Auch der zwölftausendste Treffer ist jetzt mit der Tastatur
 * erreichbar.
 */
export class QuickOpen {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  /** Hält die Bildlaufhöhe für alle Treffer, auch die ungezeichneten. */
  private readonly sizer: HTMLLIElement;
  private readonly hint: HTMLDivElement;
  private readonly scope: HTMLElement;
  private readonly count: HTMLElement;

  private entries: Entry[] = [];
  private matches: Entry[] = [];
  private active = 0;
  private window: Window | null = null;
  private readonly row: number;

  /** Die zuletzt gefilterte Eingabe — Grundlage fürs Eingrenzen. */
  private lastQuery = "";
  /** Woher `entries` stammt; ändert sich die Auswahl, ist der Cache hin. */
  private cachedScope = "";
  private cachedAt = 0;
  private loadGeneration = 0;
  private state: "loading" | "ready" | "no-folder" | "error" = "ready";
  private error = "";
  /** Die letzte Zeigerposition — siehe `mousemove` im Konstruktor. */
  private pointer = { x: -1, y: -1 };

  constructor(private readonly actions: QuickOpenActions) {
    this.root = document.createElement("div");
    this.root.className = "overlay";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="palette quick-open" role="dialog" aria-modal="true" aria-label="Datei öffnen">
        <header class="quick-open-head">
          <span>Datei öffnen <small class="quick-open-scope"></small></span>
          <span class="quick-open-count"></span>
        </header>
        <input class="palette-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="Datei suchen…" aria-label="Datei suchen">
        <ul class="palette-list quick-open-list" role="listbox">
          <li class="quick-open-sizer" role="presentation" aria-hidden="true"></li>
        </ul>
        <div class="quick-open-hint" hidden></div>
        <footer class="quick-open-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> wählen · <kbd>Enter</kbd> öffnen · <kbd>Esc</kbd> schliessen</span>
          <button class="link-btn" data-act="native">Andere Datei öffnen… <kbd>Strg+Umschalt+O</kbd></button>
        </footer>
      </div>`;
    document.body.appendChild(this.root);

    this.input = this.root.querySelector(".palette-input")!;
    this.list = this.root.querySelector(".quick-open-list")!;
    this.sizer = this.root.querySelector(".quick-open-sizer")!;
    this.hint = this.root.querySelector(".quick-open-hint")!;
    this.scope = this.root.querySelector(".quick-open-scope")!;
    this.count = this.root.querySelector(".quick-open-count")!;

    // Die Zeilenhöhe steht im Stylesheet, weil sie dort auch gilt. Sie hier
    // ein zweites Mal zu schreiben hiesse, dass eine Änderung am Design die
    // Rechnung der Virtualisierung still danebenlegt.
    const declared = getComputedStyle(document.documentElement).getPropertyValue("--qo-row");
    this.row = Number.parseFloat(declared) || 48;

    this.input.addEventListener("input", () => this.filter());
    this.input.addEventListener("keydown", (event) => this.onKey(event));
    this.root.addEventListener("mousedown", (event) => {
      if (event.target === this.root) this.close();
    });
    this.root.querySelector<HTMLButtonElement>('[data-act="native"]')!.addEventListener("click", () => {
      this.close();
      this.actions.openNative();
    });

    this.list.addEventListener("scroll", () => this.renderWindow(), { passive: true });

    // `mousemove` statt `mouseenter` an jeder Zeile: Beim Tippen entstehen
    // unter dem stehenden Zeiger neue Elemente, und `mouseenter` feuert
    // dabei — die Auswahl sprang also auf die Zeile unter der Maus, obwohl
    // niemand die Maus bewegt hat. `mousemove` feuert nur bei echter
    // Bewegung; der Vergleich mit der letzten Position fängt zusätzlich die
    // Bewegungen ab, die nur vom Scrollen kommen.
    this.list.addEventListener("mousemove", (event) => {
      if (event.clientX === this.pointer.x && event.clientY === this.pointer.y) return;
      this.pointer = { x: event.clientX, y: event.clientY };
      const index = indexFrom(event.target);
      if (index !== null) this.setActive(index, false);
    });
    this.list.addEventListener("mousedown", (event) => {
      const index = indexFrom(event.target);
      if (index === null) return;
      event.preventDefault();
      const entry = this.matches[index];
      if (entry) this.execute(entry);
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /**
   * Öffnet den Dateiöffner und liest den Ordner neu.
   *
   * Ist die letzte Liste noch brauchbar, steht sie sofort da und wird im
   * Hintergrund ersetzt. Das Durchsuchen läuft in Rust auf einem eigenen
   * Thread — es blockiert also nichts mehr, aber ein grosser Ordner braucht
   * trotzdem seine Zeit, und in der soll man schon tippen können.
   */
  async open() {
    const generation = ++this.loadGeneration;
    const scope = this.actions.scope();
    const key = scope.join("\u0000");
    if (key !== this.cachedScope || Date.now() - this.cachedAt > CACHE_MS) {
      this.entries = [];
      this.cachedScope = key;
    }

    this.root.hidden = false;
    this.setScope(scope);
    this.input.value = "";
    this.lastQuery = "";
    this.pointer = { x: -1, y: -1 };
    this.list.scrollTop = 0;

    if (this.entries.length > 0) {
      this.state = "ready";
      this.filter();
    } else {
      this.state = "loading";
      this.matches = [];
      this.active = 0;
      this.render();
    }
    this.input.focus();

    try {
      const files = await this.actions.load();
      if (generation !== this.loadGeneration || !this.isOpen) return;
      if (files === null) {
        this.entries = [];
        this.state = "no-folder";
      } else {
        this.entries = files.map(toEntry);
        this.cachedAt = Date.now();
        this.state = "ready";
      }
    } catch (error) {
      if (generation !== this.loadGeneration || !this.isOpen) return;
      this.state = "error";
      this.error = String(error);
    }

    // Die Eingabe von eben bleibt stehen — wer schon tippt, soll von der
    // Nachlieferung nicht zurückgeworfen werden. Auch die Auswahl wandert
    // mit, sofern es dieselbe Datei noch gibt.
    const chosen = this.matches[this.active]?.file.path;
    this.lastQuery = "";
    this.filter();
    if (chosen) {
      const at = this.matches.findIndex((entry) => entry.file.path === chosen);
      if (at > 0) this.setActive(at, true);
    }
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
   * gibt — sie liegt schlicht ausserhalb der eingestellten Ordner. Ab zwei
   * Ordnern steht nur noch ihre Zahl da; die Pfade selbst stehen im Tooltip,
   * sonst wächst der Kopf über das Fenster hinaus.
   */
  private setScope(folders: string[]) {
    this.scope.textContent =
      folders.length === 0
        ? ""
        : folders.length === 1
          ? shortenPath(folders[0])
          : `${folders.length} Ordner`;
    this.scope.title = folders.join("\n");
  }

  /**
   * Grenzt die Trefferliste ein.
   *
   * Verlängert die Eingabe die vorige, wird nur noch in deren Treffern
   * gesucht statt wieder in allen Dateien: Was `deplo` nicht enthält, kann
   * `deploy` erst recht nicht enthalten. Ab dem zweiten Zeichen schrumpft
   * die Arbeit damit von zwanzigtausend Einträgen auf eine Handvoll.
   */
  private filter() {
    const query = this.input.value.trim().toLowerCase();
    const base =
      query !== "" && this.lastQuery !== "" && query.startsWith(this.lastQuery)
        ? this.matches
        : this.entries;

    this.matches = query === "" ? this.entries : rank(query, base);
    this.lastQuery = query;
    this.active = 0;
    this.list.scrollTop = 0;
    this.render();
  }

  /** Baut die Liste komplett neu — nach jedem Wechsel der Trefferliste. */
  private render() {
    const message = this.emptyMessage();
    this.hint.hidden = message === null;
    this.list.hidden = message !== null;
    this.count.textContent = this.countLabel();

    if (message) {
      this.hint.replaceChildren(message);
      this.list.replaceChildren(this.sizer);
      this.window = null;
      return;
    }

    this.hint.replaceChildren();
    this.sizer.style.height = `${this.matches.length * this.row}px`;
    this.window = null;
    this.renderWindow();
  }

  /**
   * Zeichnet nur den sichtbaren Ausschnitt.
   *
   * Läuft bei jedem Bildlauf und tut nichts, solange derselbe Ausschnitt
   * gefragt ist — sonst würde die Liste unter dem Rad ständig neu entstehen.
   */
  private renderWindow() {
    if (this.list.hidden) return;

    const total = this.matches.length;
    const height = this.list.clientHeight || this.row * 10;
    const top = this.list.scrollTop;
    const first = Math.max(0, Math.floor(top / this.row) - OVERSCAN);
    const last = Math.min(total, Math.ceil((top + height) / this.row) + OVERSCAN);
    if (this.window && this.window.first === first && this.window.last === last) return;

    const items: HTMLLIElement[] = [];
    for (let index = first; index < last; index++) {
      items.push(this.renderItem(this.matches[index], index));
    }
    this.list.replaceChildren(this.sizer, ...items);
    this.window = { first, last };
  }

  private renderItem(entry: Entry, index: number): HTMLLIElement {
    const item = document.createElement("li");
    const isActive = index === this.active;
    item.className = "palette-item quick-open-item" + (isActive ? " is-active" : "");
    item.dataset.index = String(index);
    item.style.top = `${index * this.row}px`;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(isActive));

    const text = document.createElement("span");
    text.className = "quick-open-text";

    const name = document.createElement("strong");
    // Der Name führt die Suche, also wird auch in ihm markiert. Passt die
    // Eingabe nur auf den Pfad, wandert die Markierung eine Zeile tiefer.
    const inName = fill(name, entry.file.name, entry.name, this.lastQuery);

    const folder = document.createElement("small");
    folder.title = entry.file.path;
    if (inName) folder.textContent = entry.folder;
    else fill(folder, entry.folder, entry.folder.toLowerCase(), this.lastQuery);

    text.append(name, folder);

    const modified = document.createElement("time");
    modified.className = "quick-open-time";
    modified.dateTime = new Date(entry.file.modifiedMs).toISOString();
    modified.textContent = formatModified(entry.file.modifiedMs);

    item.append(text, modified);
    return item;
  }

  /**
   * Hebt einen Eintrag hervor, ohne die Liste neu zu bauen.
   *
   * `scroll` bleibt der Tastatur vorbehalten: Scrollte die Liste auch beim
   * Überfahren, spränge sie unter dem Zeiger weg.
   */
  private setActive(index: number, scroll: boolean) {
    if (index === this.active || index < 0 || index >= this.matches.length) return;
    const previous = this.active;
    this.active = index;
    for (const at of [previous, index]) {
      const item = this.list.querySelector<HTMLElement>(`[data-index="${at}"]`);
      if (!item) continue;
      const isActive = at === index;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    }
    if (scroll) this.scrollToActive();
  }

  /**
   * Holt die aktive Zeile in den Blick.
   *
   * Von Hand gerechnet statt mit `scrollIntoView`: Die Zeile existiert im
   * DOM erst, wenn sie sichtbar ist — bei einem Sprung ans Ende der Liste
   * gäbe es also gar kein Element, an das man scrollen könnte.
   */
  private scrollToActive() {
    const top = this.active * this.row;
    const height = this.list.clientHeight;
    if (top < this.list.scrollTop) this.list.scrollTop = top;
    else if (top + this.row > this.list.scrollTop + height) {
      this.list.scrollTop = top + this.row - height;
    }
    this.renderWindow();
  }

  private countLabel(): string {
    if (this.state !== "ready" || this.entries.length === 0) return "zuletzt geändert";
    if (this.matches.length === this.entries.length) {
      return `${this.entries.length} Dateien · zuletzt geändert`;
    }
    return `${this.matches.length} von ${this.entries.length}`;
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
    if (this.entries.length === 0) {
      return document.createTextNode("Keine Textdatei in diesem Ordner gefunden.");
    }
    if (this.matches.length === 0) return document.createTextNode("Keine passende Datei gefunden.");
    return null;
  }

  private onKey(event: KeyboardEvent) {
    // Der Sprung um eine Seite richtet sich nach dem, was man wirklich
    // sieht — bei einem hohen Fenster sind zehn Zeilen kein Blattwechsel.
    const page = Math.max(1, Math.floor(this.list.clientHeight / this.row) - 1);

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
      case "PageDown":
        event.preventDefault();
        this.jump(this.active + page);
        break;
      case "PageUp":
        event.preventDefault();
        this.jump(this.active - page);
        break;
      case "Home":
        event.preventDefault();
        this.jump(0);
        break;
      case "End":
        event.preventDefault();
        this.jump(this.matches.length - 1);
        break;
      case "Enter": {
        event.preventDefault();
        const entry = this.matches[this.active];
        if (entry) this.execute(entry);
        break;
      }
    }
  }

  /** Pfeiltasten laufen um, damit das letzte Ergebnis nah am ersten liegt. */
  private move(delta: number) {
    if (this.matches.length === 0) return;
    this.setActive((this.active + delta + this.matches.length) % this.matches.length, true);
  }

  /** Seitenweise und an die Enden — hier wäre Umlaufen nur verwirrend. */
  private jump(index: number) {
    if (this.matches.length === 0) return;
    this.setActive(Math.max(0, Math.min(index, this.matches.length - 1)), true);
  }

  private execute(entry: Entry) {
    this.close();
    this.actions.open(entry.file.path);
  }
}

/**
 * Bewertet und sortiert die Treffer.
 *
 * `base` ist entweder die ganze Liste oder die vorige Trefferliste — beide
 * tragen ihre ursprüngliche Position mit, damit die Reihenfolge bei
 * gleicher Punktzahl die der Änderungszeit bleibt.
 */
function rank(query: string, base: Entry[]): Entry[] {
  const scored: { entry: Entry; score: number }[] = [];
  for (const entry of base) {
    let score = fuzzyScoreLower(query, entry.name);
    if (score > 0) score += NAME_BONUS;
    else score = fuzzyScoreLower(query, entry.path);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.index - b.entry.index);
  return scored.map((s) => s.entry);
}

function toEntry(file: QuickOpenFile, index: number): Entry {
  const folder = itemFolder(file);
  return {
    file,
    name: file.name.toLowerCase(),
    // Der angezeigte Ordner plus der Name: genau das, was in der Zeile
    // steht, ist auch das, was durchsucht wird.
    path: `${folder}/${file.name}`.toLowerCase(),
    folder,
    index,
  };
}

/**
 * Schreibt `text` in `target` und markiert darin die Zeichen der Eingabe.
 *
 * Gibt zurück, ob überhaupt etwas passte — der Aufrufer entscheidet danach,
 * ob er es in der zweiten Zeile noch einmal versucht.
 *
 * Die Stellen kommen aus der klein geschriebenen Fassung. Bei den wenigen
 * Zeichen, deren Kleinschreibung die Länge ändert (etwa „İ"), zeigen sie
 * ins Leere — dann bleibt der Text lieber unmarkiert stehen, als dass die
 * Markierung verrutscht.
 */
function fill(target: HTMLElement, text: string, lower: string, query: string): boolean {
  if (query === "") {
    target.textContent = text;
    return false;
  }

  const ranges = lower.length === text.length ? matchRanges(query, lower) : [];
  if (ranges.length === 0) {
    target.textContent = text;
    return false;
  }

  const parts: (string | HTMLElement)[] = [];
  let at = 0;
  for (const [from, to] of ranges) {
    if (from > at) parts.push(text.slice(at, from));
    const mark = document.createElement("em");
    mark.textContent = text.slice(from, to);
    parts.push(mark);
    at = to;
  }
  if (at < text.length) parts.push(text.slice(at));
  target.replaceChildren(...parts);
  return true;
}

/** Die Position der Zeile unter dem Mauszeiger — `null` ausserhalb. */
function indexFrom(target: EventTarget | null): number | null {
  const item = (target as HTMLElement | null)?.closest<HTMLElement>(".quick-open-item");
  return item ? Number(item.dataset.index) : null;
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

/**
 * Wo die Datei liegt, als `Wurzelordner/Unterordner`.
 *
 * Der Name des durchsuchten Ordners steht immer davor: Bei mehreren Ordnern
 * sagte der relative Pfad allein nicht, in welchem man landet, und bei einem
 * einzigen ist er trotzdem die bessere Auskunft als ein fester Text.
 */
function itemFolder(file: QuickOpenFile): string {
  const relative = file.relativePath.replace(/\\/g, "/");
  const separator = relative.lastIndexOf("/");
  const root = shortenPath(file.root).split("/").pop() ?? "";
  return separator < 0 ? root : `${root}/${relative.slice(0, separator)}`;
}

/**
 * Uhrzeit im 24-Stunden-Format, unabhängig von der Systemsprache.
 *
 * `toLocaleTimeString([])` nimmt die Locale des Systems — steht die auf
 * Englisch, stand neben „Heute" ein „10:42 PM". Die Oberfläche ist
 * deutsch, also ist es auch die Uhrzeit.
 */
const TIME_FORMAT = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" });
const DATE_FORMAT = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatModified(modifiedMs: number): string {
  const date = new Date(modifiedMs);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `Heute ${TIME_FORMAT.format(date)}`;
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Gestern ${TIME_FORMAT.format(date)}`;
  }
  return DATE_FORMAT.format(date);
}
