export interface Command {
  id: string;
  title: string;
  /** Kategorie links vom Titel, z. B. "Datei" oder "Ansicht". */
  group?: string;
  /** Anzeige des Tastenkürzels, rein informativ. */
  shortcut?: string;
  /** Aktueller Zustand einer Umschaltoption, z. B. "an" / "aus". */
  state?: () => string;
  /** Rückgabewerte werden ignoriert; die Palette schliesst vorher. */
  run: () => unknown;
}

/**
 * Teilfolgen-Suche: "ozd" findet "Ordner zuletzt geöffnet".
 * Frühe und zusammenhängende Treffer werden höher gewertet, damit die
 * naheliegende Aktion oben steht.
 */
export function fuzzyScore(needle: string, haystack: string): number {
  return fuzzyScoreLower(needle.toLowerCase(), haystack.toLowerCase());
}

/**
 * Dieselbe Bewertung, aber ohne `toLowerCase()` — beide Seiten sind schon
 * klein geschrieben.
 *
 * Der Unterschied ist nicht kosmetisch: Der Dateiöffner bewertet bei jedem
 * Tastendruck bis zu 20 000 Einträge. Jedes `toLowerCase()` legt dabei eine
 * neue Zeichenkette an, und zwanzigtausend davon pro Anschlag sind genau
 * das, was das Tippen zäh gemacht hat. Wer die Kleinschreibung einmal beim
 * Laden erledigt, zahlt sie nicht mehr pro Zeichen.
 */
export function fuzzyScoreLower(needle: string, haystack: string): number {
  if (!needle) return 1;

  const direct = haystack.indexOf(needle);
  if (direct >= 0) return 1000 - direct;

  let hi = 0;
  let points = 0;
  let streak = 0;
  for (const ch of needle) {
    const found = haystack.indexOf(ch, hi);
    if (found < 0) return 0;
    streak = found === hi ? streak + 1 : 0;
    points += 10 + streak * 5 - Math.min(found - hi, 10);
    hi = found + 1;
  }
  return points;
}

/**
 * Wo die Zeichen der Eingabe im Text sitzen — für die Hervorhebung in der
 * Liste. Gleiche Reihenfolge wie die Bewertung oben, damit markiert wird,
 * was auch gewertet wurde.
 */
export function matchRanges(needle: string, haystack: string): [number, number][] {
  if (!needle) return [];

  const direct = haystack.indexOf(needle);
  if (direct >= 0) return [[direct, direct + needle.length]];

  const ranges: [number, number][] = [];
  let hi = 0;
  for (const ch of needle) {
    const found = haystack.indexOf(ch, hi);
    if (found < 0) return [];
    const last = ranges[ranges.length - 1];
    if (last && last[1] === found) last[1] = found + 1;
    else ranges.push([found, found + 1]);
    hi = found + 1;
  }
  return ranges;
}

export class CommandPalette {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private matches: Command[] = [];
  private active = 0;
  private onClose: (() => void) | null = null;

  /**
   * `afterClose` läuft nach **jedem** Schliessen, auch nach `Escape`.
   *
   * Ohne das blieb der Tastaturfokus im versteckten Dialog hängen: Das
   * Eingabefeld ist weg, `document.activeElement` fällt auf `<body>` — und
   * der nächste Tastendruck landet nirgendwo. Wer die Palette wieder
   * zumachte, tippte danach ins Leere und hielt den Editor für eingefroren.
   */
  constructor(
    private readonly commands: () => Command[],
    private readonly afterClose?: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "overlay";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="palette" role="dialog" aria-modal="true" aria-label="Befehlspalette">
        <input class="palette-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="Befehl eingeben…" aria-label="Befehl suchen">
        <ul class="palette-list" role="listbox"></ul>
      </div>`;
    document.body.appendChild(this.root);

    this.input = this.root.querySelector(".palette-input")!;
    this.list = this.root.querySelector(".palette-list")!;

    this.input.addEventListener("input", () => this.filter());
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    this.root.addEventListener("mousedown", (e) => {
      if (e.target === this.root) this.close();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(onClose?: () => void) {
    this.onClose = onClose ?? null;
    this.root.hidden = false;
    this.input.value = "";
    this.filter();
    this.input.focus();
  }

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    const done = this.onClose;
    this.onClose = null;
    done?.();
    this.afterClose?.();
  }

  private filter() {
    const q = this.input.value.trim();
    this.matches = this.commands()
      .map((c) => ({ c, s: fuzzyScore(q, `${c.group ?? ""} ${c.title}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
    this.active = 0;
    this.render();
  }

  private render() {
    this.list.replaceChildren(
      ...this.matches.map((cmd, i) => {
        const li = document.createElement("li");
        li.className = "palette-item" + (i === this.active ? " is-active" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === this.active));

        const label = document.createElement("span");
        label.className = "palette-label";
        if (cmd.group) {
          const g = document.createElement("span");
          g.className = "palette-group";
          g.textContent = cmd.group;
          label.append(g);
        }
        label.append(cmd.title);

        const right = document.createElement("span");
        right.className = "palette-meta";
        const state = cmd.state?.();
        if (state) {
          const s = document.createElement("span");
          s.className = "palette-state";
          s.textContent = state;
          right.append(s);
        }
        if (cmd.shortcut) {
          const kbd = document.createElement("kbd");
          kbd.textContent = cmd.shortcut;
          right.append(kbd);
        }

        li.append(label, right);
        li.addEventListener("mouseenter", () => {
          this.active = i;
          this.render();
        });
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this.execute(cmd);
        });
        return li;
      }),
    );
    this.list.children[this.active]?.scrollIntoView({ block: "nearest" });
  }

  private onKey(e: KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        this.close();
        break;
      case "ArrowDown":
        e.preventDefault();
        this.move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.move(-1);
        break;
      case "Enter": {
        e.preventDefault();
        const cmd = this.matches[this.active];
        if (cmd) this.execute(cmd);
        break;
      }
    }
  }

  private move(delta: number) {
    if (this.matches.length === 0) return;
    this.active = (this.active + delta + this.matches.length) % this.matches.length;
    this.render();
  }

  private execute(cmd: Command) {
    this.close();
    void cmd.run();
  }
}

/** Einzeiliger Eingabedialog im Stil der Palette, z. B. für "Gehe zu Zeile". */
export function promptInput(label: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "overlay";
    root.innerHTML = `
      <div class="palette palette--prompt" role="dialog" aria-modal="true">
        <label class="prompt-label"></label>
        <input class="palette-input" type="text" spellcheck="false" autocomplete="off">
      </div>`;
    root.querySelector(".prompt-label")!.textContent = label;
    const input = root.querySelector("input")!;
    input.value = initial;

    const done = (value: string | null) => {
      root.remove();
      resolve(value);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        done(input.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        done(null);
      }
    });
    root.addEventListener("mousedown", (e) => {
      if (e.target === root) done(null);
    });

    document.body.appendChild(root);
    input.focus();
    input.select();
  });
}
