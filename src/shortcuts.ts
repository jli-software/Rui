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
  hint?: string;
  rows: ShortcutRow[];
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
    hint: '"+ und "* zeigen beide auf die Zwischenablage des Systems.',
    rows: [
      { title: "In die Zwischenablage kopieren", keys: '"+y  ·  "+yy' },
      { title: "Aus der Zwischenablage einfügen", keys: '"+p' },
      { title: "In ein benanntes Register", keys: '"a y  /  "a p' },
    ],
  },
  {
    title: "Dateien und Reiter",
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
  private readonly body: HTMLDivElement;

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
        <div class="shortcuts-body"></div>
      </div>`;
    document.body.appendChild(this.root);

    this.input = this.root.querySelector(".palette-input")!;
    this.body = this.root.querySelector(".shortcuts-body")!;

    this.input.addEventListener("input", () => this.render());
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
    if (vim) groups.push(...VIM_GROUPS.map((g) => ({ ...g, title: `Vim · ${g.title}` })));
    groups.push({
      title: "Rui",
      hint: vim
        ? "Gelten immer, auch mitten im Normalmodus."
        : "Die Vim-Befehle erscheinen hier, sobald die Vim-Steuerung unter Eingabe an ist.",
      rows: this.ruiRows(),
    });

    const sections = groups
      .map((group) => ({ group, rows: filterRows(group.rows, query) }))
      .filter((entry) => entry.rows.length > 0)
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

function filterRows(rows: ShortcutRow[], query: string): ShortcutRow[] {
  if (query === "") return rows;
  return rows.filter((row) => fuzzyScore(query, `${row.title} ${row.keys}`) > 0);
}

function renderGroup(group: Group, rows: ShortcutRow[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "shortcuts-group";

  const heading = document.createElement("h3");
  heading.textContent = group.title;
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
