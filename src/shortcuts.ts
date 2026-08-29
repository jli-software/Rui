import { fuzzyScore, type Command } from "./palette";

/**
 * Die Tastenkürzel-Übersicht.
 *
 * Sie stand bis 0.4.0 in den Einstellungen — falsch untergebracht: Kürzel
 * sind nichts, was man einstellt, sondern etwas, das man **nachschlägt**,
 * meist mitten in der Arbeit. Ein eigenes Overlay auf `Strg+K` ist dafür
 * einen Griff entfernt, statt drei Bildläufe tief in einem Dialog.
 *
 * Ist die Vim-Steuerung an, steht deren Liste oben und ausführlich da: Wer
 * Vim benutzt, tippt neunzig Prozent seiner Befehle dort, und die Rui-Kürzel
 * sind die Ausnahme davon.
 */

export interface ShortcutRow {
  title: string;
  keys: string;
  /**
   * Was dasselbe Kürzel in NeoVim täte. Steht nur bei den Rui-Kürzeln, die
   * eine Vim-Bindung verdecken — wer aus NeoVim kommt, greift genau dort
   * daneben und soll es hier schwarz auf weiss finden.
   */
  instead?: string;
}

interface Group {
  title: string;
  /**
   * Kurzname für den Kategoriereiter. Die Überschriften dürfen ausführlich
   * sein, die Reiter müssen nebeneinander in eine Zeile passen.
   */
  short?: string;
  /** „Vim" — steht in der Überschrift vor dem Titel, nicht auf dem Reiter. */
  scope?: string;
  hint?: string;
  rows: ShortcutRow[];
}

/** Die Überschrift einer Gruppe: „Vim · Bewegen" oder schlicht „Rui". */
function groupHeading(group: Group): string {
  return group.scope ? `${group.scope} · ${group.title}` : group.title;
}

/**
 * Die Vim-Befehle, nach dem geordnet, wonach man sie sucht.
 *
 * Das Vim-Paket kennt weit mehr, als in eine Übersicht passt. Hier steht,
 * was NeoVim-Nutzer täglich anfassen — und was man braucht, um sich in Rui
 * ohne Maus zu bewegen. Kombinationen wie `d` + Bewegung decken den Rest
 * systematisch ab, deshalb stehen die Operatoren und die Bewegungen
 * getrennt: aus zwei kurzen Listen entsteht die lange von selbst.
 */
const VIM_GROUPS: Group[] = [
  {
    title: "Modus",
    rows: [
      { title: "Zurück in den Normalmodus", keys: "Esc  ·  Strg+[" },
      { title: "Einfügen vor / nach dem Cursor", keys: "i / a" },
      { title: "Einfügen am Zeilenanfang / Zeilenende", keys: "I / A" },
      { title: "Neue Zeile darunter / darüber", keys: "o / O" },
      { title: "Ersetzen (überschreiben)", keys: "R" },
      { title: "Auswahl: zeichen- / zeilen- / blockweise", keys: "v / V / Strg+V" },
      { title: "Zur letzten Auswahl zurück", keys: "gv" },
    ],
  },
  {
    title: "Bewegen",
    rows: [
      { title: "Links / unten / oben / rechts", keys: "h / j / k / l" },
      { title: "Wortweise vor / zurück / ans Wortende", keys: "w / b / e" },
      { title: "Zeilenanfang / erstes Zeichen / Zeilenende", keys: "0 / ^ / $" },
      { title: "Dokumentanfang / Dokumentende", keys: "gg / G" },
      { title: "Zu Zeile n", keys: ":n  ·  nG" },
      { title: "Halbe Seite hoch / runter", keys: "Strg+U / Strg+D" },
      { title: "Bildschirm oben / Mitte / unten", keys: "H / M / L" },
      { title: "Passende Klammer", keys: "%" },
      { title: "Zeichen in der Zeile suchen / rückwärts", keys: "f<z> / F<z>" },
      { title: "Cursorzeile nach oben / Mitte / unten rollen", keys: "zt / zz / zb" },
    ],
  },
  {
    title: "Bearbeiten",
    hint: "Operator + Bewegung: dw, c$, y2j, d/wort",
    rows: [
      { title: "Löschen / ändern / kopieren", keys: "d / c / y" },
      { title: "Ganze Zeile löschen / ändern / kopieren", keys: "dd / cc / yy" },
      { title: "Bis Zeilenende löschen / ändern", keys: "D / C" },
      { title: "Einfügen nach / vor dem Cursor", keys: "p / P" },
      { title: "Zeichen löschen / ersetzen", keys: "x / r<z>" },
      { title: "Zeile mit der nächsten verbinden", keys: "J" },
      { title: "Einrücken / ausrücken", keys: ">> / <<" },
      { title: "Gross-/Kleinschreibung umdrehen", keys: "~" },
      { title: "Letzten Befehl wiederholen", keys: "." },
      { title: "Rückgängig / wiederherstellen", keys: "u / Strg+R" },
      { title: "Zähler davor: 3dd, 5j, 2yy", keys: "<n> + Befehl" },
    ],
  },
  {
    title: "Suchen und ersetzen",
    short: "Suchen",
    rows: [
      { title: "Vorwärts / rückwärts suchen", keys: "/ / ?" },
      { title: "Nächster / voriger Treffer", keys: "n / N" },
      { title: "Wort unter dem Cursor suchen", keys: "* / #" },
      { title: "In der ganzen Datei ersetzen", keys: ":%s/alt/neu/g" },
      { title: "Mit Rückfrage ersetzen", keys: ":%s/alt/neu/gc" },
      { title: "Hervorhebung ausschalten", keys: ":noh" },
    ],
  },
  {
    title: "Zwischenablage",
    hint:
      'Alles im Normalmodus. "+ ist die Zwischenablage des Systems, "* meint ' +
      "in Rui dieselbe; ohne das Präfix bleibt der Text in Vims eigenen " +
      "Registern und ist ausserhalb von Rui nicht zu sehen.",
    rows: [
      { title: "Auswahl kopieren (nach v / V)", keys: '"+y' },
      { title: "Aktuelle Zeile kopieren", keys: '"+yy' },
      { title: "Operator + Bewegung kopieren", keys: '"+yw  ·  "+y2j  ·  "+y}' },
      { title: "Ganze Datei kopieren", keys: ":%y+" },
      { title: "Zeilen 10 bis 20 kopieren", keys: ":10,20y+" },
      { title: "Ab hier bis Dateiende kopieren", keys: ":.,$y+" },
      { title: "Auswahl kopieren, als Ex-Befehl", keys: ":'<,'>y+" },
      { title: "Ausschneiden statt kopieren", keys: '"+d  ·  "+dd  ·  "+D' },
      { title: "Einfügen nach / vor dem Cursor", keys: '"+p  ·  "+P' },
      { title: "Auswahl durch die Zwischenablage ersetzen", keys: '"+p (in v / V)' },
      { title: "Alles markieren, dann kopieren", keys: 'ggVG  dann  "+y' },
      { title: "In ein benanntes Register", keys: '"ayy  /  "ap' },
      { title: "An ein Register anhängen (gross)", keys: '"Ayy' },
      { title: "Belegte Register ansehen", keys: ":reg" },
      { title: "Ruis eigener Weg, ohne Vim", keys: "Strg+Umschalt+C / V" },
    ],
  },
  {
    title: "Dateien und Reiter",
    short: "Dateien",
    hint: "Ruis eigene Wege — :w schreibt mit dem Encoding der geöffneten Datei.",
    rows: [
      { title: "Speichern", keys: ":w" },
      { title: "Unter einem Namen speichern", keys: ":w notiz.ps1" },
      { title: "Speichern und schliessen", keys: ":wq  ·  :x" },
      { title: "Schliessen / ohne zu speichern", keys: ":q / :q!" },
      { title: "Alles beenden", keys: ":qa / :qa!" },
      { title: "Datei öffnen / neu laden", keys: ":e pfad / :e" },
      { title: "Neuer Reiter / mit Datei", keys: ":tabnew / :tabnew pfad" },
      { title: "Nächster / voriger Reiter", keys: ":tabn / :tabp" },
      { title: "Reiter schliessen", keys: ":tabc  ·  :bd" },
    ],
  },
];

/**
 * Rui-Kürzel, die in NeoVim etwas anderes bedeuten.
 *
 * Sie gelten in Rui immer, auch mitten im Normalmodus — das ist Absicht:
 * Rui ist ein Editor mit Vim-Steuerung, nicht umgekehrt. Aber wer aus
 * NeoVim kommt, greift genau hier daneben, und das ungesagt zu lassen wäre
 * die unangenehmere Überraschung.
 */
const VIM_OVERRIDES: Record<string, string> = {
  "Strg+O": "in NeoVim: zurück in der Sprungliste",
  "Strg+I": "in NeoVim: vorwärts in der Sprungliste",
  "Strg+F": "in NeoVim: eine Seite vorwärts",
  "Strg+W": "in NeoVim: Fensterbefehle",
  "Strg+N": "in NeoVim: nächster Vorschlag im Einfügemodus",
  "Strg+T": "in NeoVim: zurück aus dem Tag-Stack",
  "Strg+G": "in NeoVim: Datei-Info",
};

export interface ShortcutsActions {
  /** Ruis eigene Befehle — Quelle für die Rui-Liste. */
  commands: () => Command[];
  /** Ob die Vim-Steuerung gerade an ist. */
  vimMode: () => boolean;
  onClose: () => void;
}

export class ShortcutsOverlay {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly cats: HTMLDivElement;
  private readonly body: HTMLDivElement;
  /**
   * Der gewählte Kategoriereiter, `null` für „Alle".
   *
   * Mit eingeschalteter Vim-Steuerung stehen über siebzig Zeilen in der
   * Liste — vollständig, aber genau das war die Klage: Wer nach dem
   * Zwischenablage-Griff sucht, will nicht an „Bewegen" vorbeiscrollen.
   * Die Reiter schneiden die Liste auf eine Gruppe herunter, die Suche
   * bleibt der Weg quer durch alle.
   */
  private active: string | null = null;

  constructor(private readonly actions: ShortcutsActions) {
    this.root = document.createElement("div");
    this.root.className = "overlay";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="palette shortcuts" role="dialog" aria-modal="true" aria-label="Tastenkürzel">
        <header class="shortcuts-head">
          <h2>Tastenkürzel</h2>
          <button class="icon-btn" data-act="close" aria-label="Schliessen">✕</button>
        </header>
        <input class="palette-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="Kürzel suchen…" aria-label="Kürzel suchen">
        <div class="shortcuts-cats" role="tablist" aria-label="Kategorien"></div>
        <div class="shortcuts-body"></div>
      </div>`;
    document.body.appendChild(this.root);

    this.input = this.root.querySelector(".palette-input")!;
    this.cats = this.root.querySelector(".shortcuts-cats")!;
    this.body = this.root.querySelector(".shortcuts-body")!;

    this.input.addEventListener("input", () => {
      // Wer tippt, sucht quer durch alles. Eine Suche, die stumm in einer
      // Kategorie hängen bleibt, sieht aus wie „gibt es nicht".
      this.active = null;
      this.render();
    });
    this.cats.addEventListener("click", (event) => {
      const chip = (event.target as HTMLElement).closest<HTMLElement>(".shortcuts-cat");
      if (!chip) return;
      this.active = chip.dataset.cat ?? null;
      this.render();
      this.body.scrollTop = 0;
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.close();
    });
    this.root.addEventListener("mousedown", (event) => {
      if (event.target === this.root) this.close();
    });
    this.root.querySelector<HTMLButtonElement>('[data-act="close"]')!.addEventListener("click", () =>
      this.close(),
    );
  }

  get isOpen() {
    return !this.root.hidden;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.input.value = "";
    this.active = null;
    this.render();
    this.root.hidden = false;
    this.body.scrollTop = 0;
    this.input.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.actions.onClose();
  }

  /**
   * Baut die Liste aus dem, was gerade gilt.
   *
   * Die Rui-Kürzel kommen aus derselben Befehlsliste wie die Palette: Ein
   * neuer Befehl mit `shortcut` steht damit ohne Zutun auch hier.
   */
  private render() {
    const query = this.input.value.trim();
    const vim = this.actions.vimMode();

    const groups: Group[] = [];
    if (vim) groups.push(...VIM_GROUPS.map((g) => ({ ...g, scope: "Vim" })));
    groups.push({
      title: "Rui",
      hint: vim
        ? "Gelten immer, auch mitten im Normalmodus."
        : "Die Vim-Befehle erscheinen hier, sobald die Vim-Steuerung unter Eingabe an ist.",
      rows: this.ruiRows(),
    });

    const matched = groups
      .map((group) => ({ group, rows: filterRows(group, query) }))
      .filter((entry) => entry.rows.length > 0);

    this.renderCategories(matched.map((entry) => entry.group));

    const sections = matched
      .filter((entry) => this.active === null || entry.group.title === this.active)
      .map((entry) => renderGroup(entry.group, entry.rows));

    if (sections.length === 0) {
      const empty = document.createElement("p");
      empty.className = "shortcuts-empty";
      empty.textContent = "Kein passendes Kürzel gefunden.";
      this.body.replaceChildren(empty);
      return;
    }
    this.body.replaceChildren(...sections);
  }

  /**
   * Die Reiterleiste. Sie zeigt nur, was gerade auch Zeilen hat — bei
   * ausgeschalteter Vim-Steuerung bleibt eine einzige Gruppe übrig, und
   * ein Reiter, der die ganze Liste meint, ist kein Reiter.
   */
  private renderCategories(groups: Group[]) {
    this.cats.hidden = groups.length < 2;
    if (this.cats.hidden) {
      this.cats.replaceChildren();
      return;
    }

    const chip = (label: string, value: string | null) => {
      const button = document.createElement("button");
      button.className = "shortcuts-cat";
      button.textContent = label;
      button.setAttribute("role", "tab");
      if (value !== null) button.dataset.cat = value;
      const on = this.active === value;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-selected", String(on));
      return button;
    };

    this.cats.replaceChildren(
      chip("Alle", null),
      ...groups.map((group) => chip(group.short ?? group.title, group.title)),
    );
  }

  private ruiRows(): ShortcutRow[] {
    // Die Befehlspalette hat als einzige keinen Eintrag in der Befehlsliste
    // — sie ist der Weg dorthin, nicht ein Befehl darin.
    const rows: ShortcutRow[] = [{ title: "Befehlspalette", keys: "Strg+Umschalt+P" }];
    for (const command of this.actions.commands()) {
      if (!command.shortcut) continue;
      const group = command.group && command.group !== "Rui" ? `${command.group}: ` : "";
      rows.push({
        title: `${group}${command.title.replace(/…$/, "")}`,
        keys: command.shortcut,
      });
    }
    rows.push({ title: "Reiter 1 bis 9 direkt", keys: "Strg+1 … Strg+9" });

    if (!this.actions.vimMode()) return rows;
    return rows.map((row) => ({ ...row, instead: VIM_OVERRIDES[row.keys] }));
  }
}

/**
 * Die Zeilen einer Gruppe, die zur Eingabe passen.
 *
 * Der Gruppenname zählt mit: Wer „Zwischenablage" tippt, will die ganze
 * Gruppe sehen und nicht die eine Zeile, in deren Titel das Wort zufällig
 * noch einmal steht. Passt der Name, bleibt die Gruppe vollständig.
 */
function filterRows(group: Group, query: string): ShortcutRow[] {
  if (query === "") return group.rows;
  const heading = groupHeading(group);
  if (fuzzyScore(query, heading) > 0) return group.rows;
  return group.rows.filter((row) => fuzzyScore(query, `${heading} ${row.title} ${row.keys}`) > 0);
}

function renderGroup(group: Group, rows: ShortcutRow[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "shortcuts-group";

  const heading = document.createElement("h3");
  heading.textContent = groupHeading(group);
  section.append(heading);

  if (group.hint) {
    const hint = document.createElement("small");
    hint.className = "shortcuts-hint";
    hint.textContent = group.hint;
    section.append(hint);
  }

  for (const row of rows) {
    const line = document.createElement("div");
    line.className = "shortcuts-row";

    const label = document.createElement("span");
    label.textContent = row.title;
    if (row.instead) {
      const note = document.createElement("small");
      note.textContent = row.instead;
      label.append(note);
    }

    const keys = document.createElement("kbd");
    keys.textContent = row.keys;
    line.append(label, keys);
    section.append(line);
  }
  return section;
}
