import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { tr } from "./i18n";
import type { Settings } from "./types";

type FieldDef =
  | { key: keyof Settings; type: "bool"; label: string; hint?: string }
  | {
      key: keyof Settings;
      type: "number";
      label: string;
      hint?: string;
      min: number;
      max: number;
      step?: number;
    }
  | {
      key: keyof Settings;
      type: "select";
      label: string;
      hint?: string;
      options: [string, string][];
    }
  | { key: keyof Settings; type: "text"; label: string; hint?: string }
  | { key: keyof Settings; type: "folder"; label: string; hint?: string }
  | { key: keyof Settings; type: "folders"; label: string; hint?: string };

interface Section {
  title: string;
  fields: FieldDef[];
}

/** Spiegelt `windows_integration::PathStatus`. */
/** Spiegelt `integration::DesktopStatus`. */
interface DesktopStatus {
  registered: boolean;
  path: string;
}

/** Spiegelt `integration::PathStatus`. */
interface PathStatus {
  registered: boolean;
  folder: string;
  otherFolder: string | null;
}

/**
 * Die Einstellungen werden aus dieser Beschreibung erzeugt, nicht von Hand
 * als HTML gepflegt. Eine neue Option braucht damit genau zwei Stellen:
 * das Feld im Rust-`Settings`-Struct und einen Eintrag hier.
 */
const SECTIONS: Section[] = [
  {
    title: "Allgemein",
    fields: [
      {
        key: "uiLanguage",
        type: "select",
        label: "Oberflächensprache",
        options: [
          ["en", "English"],
          ["de", "Deutsch"],
        ],
      },
    ],
  },
  {
    title: "Darstellung",
    fields: [
      {
        key: "theme",
        type: "select",
        label: "Farbschema",
        options: [
          ["system", "Automatisch"],
          ["sage-light", "Sage Hell"],
          ["sage-dark", "Sage Dunkel"],
        ],
      },
      {
        key: "decorationMode",
        type: "select",
        label: "Fensterdekoration",
        hint: "Auto: eigene Titelleiste unter Windows, keine unter Hyprland/Sway, sonst die native",
        options: [
          ["auto", "Automatisch"],
          ["native", "Native Titelleiste"],
          ["custom", "Eigene Titelleiste"],
          ["none", "Keine"],
        ],
      },
      { key: "fontFamily", type: "text", label: "Schriftart" },
      { key: "fontSize", type: "number", label: "Schriftgrösse", min: 8, max: 32 },
      {
        key: "lineHeight",
        type: "number",
        label: "Zeilenabstand",
        min: 1,
        max: 2.5,
        step: 0.05,
      },
      { key: "lineNumbers", type: "bool", label: "Zeilennummern" },
      {
        key: "relativeLineNumbers",
        type: "bool",
        label: "Relative Zeilennummern",
        hint: "Abstand zur Cursorzeile statt absoluter Nummer",
      },
      { key: "highlightActiveLine", type: "bool", label: "Aktuelle Zeile hervorheben" },
      { key: "syntaxHighlighting", type: "bool", label: "Syntaxhervorhebung" },
      { key: "wordWrap", type: "bool", label: "Zeilenumbruch" },
      {
        key: "showWhitespace",
        type: "bool",
        label: "Leerzeichen sichtbar",
        hint: "Zeigt Leerzeichen, Tabs und Leerraum am Zeilenende",
      },
    ],
  },
  {
    title: "Eingabe",
    fields: [
      { key: "tabSize", type: "number", label: "Tabbreite", min: 1, max: 8 },
      {
        key: "insertSpaces",
        type: "bool",
        label: "Tab fügt Leerzeichen ein",
        hint: "Aus: es wird ein echtes Tabulatorzeichen geschrieben",
      },
      { key: "autoIndent", type: "bool", label: "Automatisch einrücken" },
      { key: "bracketMatching", type: "bool", label: "Klammernpaare markieren" },
      {
        key: "closeBrackets",
        type: "bool",
        label: "Klammern automatisch schliessen",
        hint: "Ergänzt die schliessende Klammer beim Tippen",
      },
      {
        key: "vimMode",
        type: "bool",
        label: "Vim-Steuerung",
        hint: "Normal-, Insert- und Visual-Modus, hjkl, :w, :e und :q. Der Modus steht links in der Statusleiste",
      },
    ],
  },
  {
    title: "Beim Speichern",
    fields: [
      {
        key: "trimTrailingWhitespace",
        type: "bool",
        label: "Leerraum am Zeilenende entfernen",
        hint: "Verändert auch Zeilen, die du nicht angefasst hast",
      },
      {
        key: "ensureFinalNewline",
        type: "bool",
        label: "Abschliessenden Zeilenumbruch sicherstellen",
      },
      {
        key: "defaultEncoding",
        type: "select",
        label: "Encoding für neue Dateien",
        options: [
          ["UTF-8", "UTF-8"],
          ["windows-1252", "Windows-1252"],
          ["UTF-16LE", "UTF-16 LE"],
        ],
      },
      {
        key: "defaultLineEnding",
        type: "select",
        label: "Zeilenende für neue Dateien",
        options: [
          ["lf", "LF (Unix)"],
          ["crlf", "CRLF (Windows)"],
        ],
      },
    ],
  },
  {
    title: "Autosave",
    fields: [
      {
        key: "autosave",
        type: "bool",
        label: "Änderungen automatisch speichern",
        hint: "Aus gutem Grund standardmässig aus: Wer eine Konfiguration nur nachschlägt, verändert sie sonst mit einem versehentlichen Tastendruck. Gespeichert wird mit Strg+S, im Vim-Modus mit :w",
      },
      {
        key: "autosaveDelayMs",
        type: "number",
        label: "Autosave nach (ms)",
        hint: "Wartezeit nach dem letzten Tastendruck — nur wirksam, wenn Autosave an ist",
        min: 100,
        max: 5000,
        step: 100,
      },
    ],
  },
  {
    title: "Notizen",
    fields: [
      {
        key: "notesFolder",
        type: "folder",
        label: "Notizen-Ordner",
        hint: "Wohin Strg+S einen noch namenlosen Puffer legt, ohne nach dem Ort zu fragen. Einen eigenen Namen gibt :w name.ps1 oder Speichern unter",
      },
      {
        key: "noteExtension",
        type: "select",
        label: "Dateiformat für neue Notizen",
        options: [
          ["md", "Markdown (.md)"],
          ["txt", "Text (.txt)"],
        ],
      },
      {
        key: "noteDateFormat",
        type: "select",
        label: "Datumsformat für den Dateinamen",
        hint: "Lokalzeit, festgehalten beim Anlegen des Puffers",
        options: [
          ["ymd", "2026-08-28"],
          ["ymd-hm", "2026-08-28 1423"],
          ["ymd-compact", "20260828"],
          ["ymd-compact-hm", "20260828-1423"],
          ["dmy", "28.08.2026"],
        ],
      },
    ],
  },
  {
    title: "Quick Open",
    fields: [
      {
        key: "searchFolders",
        type: "folders",
        label: "Zusätzliche Ordner",
        hint: "Strg+O durchsucht neben dem Notizen-Ordner auch diese — für Scripts und Logs, die woanders liegen. Baukram wie node_modules, target und .git bleibt überall aussen vor.",
      },
      {
        key: "searchOpenFileFolder",
        type: "bool",
        label: "Ordner der offenen Datei mitdurchsuchen",
        hint: "Wer eine Logdatei von Hand geöffnet hat, will als Nächstes meist eine daneben",
      },
    ],
  },
  {
    title: "Verhalten",
    fields: [
      {
        key: "restoreSession",
        type: "bool",
        label: "Sitzung wiederherstellen",
        hint: "Ungespeicherte Änderungen überleben einen Neustart",
      },
      {
        key: "watchExternalChanges",
        type: "bool",
        label: "Externe Änderungen melden",
        hint: "Meldet, wenn ein anderes Programm die offene Datei ändert",
      },
      {
        key: "confirmOnClose",
        type: "bool",
        label: "Beim Schliessen nachfragen",
        hint: "Nur bei ungespeicherten Änderungen",
      },
    ],
  },
];

export class SettingsDialog {
  private readonly root: HTMLDivElement;
  private draft: Settings;

  constructor(
    private current: () => Settings,
    private readonly onChange: (s: Settings) => void,
    private readonly onOpenFile: () => void,
    private readonly onReset: () => void,
    /**
     * Läuft nach jedem Schliessen — auch nach `Escape`.
     *
     * Ohne das blieb der Fokus im versteckten Dialog: Das Feld ist weg,
     * `document.activeElement` fällt auf `<body>`, und der nächste
     * Tastendruck landet nirgendwo. Wer die Einstellungen zumachte, tippte
     * danach ins Leere.
     */
    private readonly afterClose: () => void,
  ) {
    this.draft = { ...current() };
    this.root = document.createElement("div");
    this.root.className = "overlay";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="settings" role="dialog" aria-modal="true" aria-label="Einstellungen">
        <header class="settings-head">
          <h2>Einstellungen</h2>
          <button class="icon-btn" data-act="close" aria-label="Schliessen">✕</button>
        </header>
        <div class="settings-body"></div>
        <footer class="settings-foot">
          <button class="link-btn" data-act="reset">Auf Standard zurücksetzen</button>
          <button class="link-btn" data-act="file">settings.json öffnen</button>
        </footer>
      </div>`;
    document.body.appendChild(this.root);

    this.root.addEventListener("mousedown", (e) => {
      if (e.target === this.root) this.close();
    });
    this.root.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
      if (act === "close") this.close();
      if (act === "file") this.onOpenFile();
      if (act === "reset") this.onReset();
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open() {
    this.draft = { ...this.current() };
    this.render();
    this.root.hidden = false;
    this.root.querySelector<HTMLElement>("input, select")?.focus();
  }

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.afterClose();
  }

  /** Neu zeichnen, wenn die Einstellungen von aussen geändert wurden. */
  refresh() {
    if (this.isOpen) {
      this.draft = { ...this.current() };
      this.render();
    }
  }

  private commit(key: keyof Settings, value: unknown) {
    // Änderungen wirken sofort — ein "Übernehmen"-Knopf wäre eine
    // Klickstufe mehr für etwas, das man ohnehin sofort sehen will.
    (this.draft as unknown as Record<string, unknown>)[key] = value;
    this.onChange({ ...this.draft });
  }

  private render() {
    const body = this.root.querySelector(".settings-body")!;
    const sections = SECTIONS.map((section) => {
      const el = document.createElement("section");
      el.className = "settings-section";

      const h = document.createElement("h3");
      h.textContent = section.title;
      el.append(h);

      for (const field of section.fields) {
        el.append(this.renderField(field));
      }
      return el;
    });
    const system = this.renderSystemSection();
    if (system) sections.push(system);
    body.replaceChildren(...sections);
  }

  /**
   * Der Abschnitt für Windows: `rui` im Terminal und der Weg zu den
   * Standard-Apps.
   *
   * Er wird immer gebaut und füllt sich, sobald der Zustand vorliegt —
   * schlägt die Abfrage fehl (jedes System ausser Windows), verschwindet er
   * wieder. Eine Vorab-Abfrage der Plattform bräuchte ein weiteres Plugin
   * für eine Frage, die diese eine Antwort schon beantwortet.
   */
  /**
   * Rui im System einhängen — je nach Plattform zwei verschiedene Fragen
   * mit derselben Absicht.
   *
   * Unter Windows: Ordner in den Benutzer-`PATH`, Dateitypen meldet der
   * Installer an. Unter Linux: Symlink in `~/.local/bin`, Dateitypen über
   * eine `.desktop`-Datei, die Rui selbst schreibt.
   *
   * Die Erkennung läuft über den User-Agent des Webviews. Ein eigenes
   * Plugin nur für die Frage „welches System" wäre Aufwand für etwas, das
   * hier ohnehin bereitsteht.
   */
  private renderSystemSection(): HTMLElement | null {
    const agent = navigator.userAgent;
    const windows = agent.includes("Windows");
    const linux = agent.includes("Linux") && !agent.includes("Android");
    if (!windows && !linux) return null;

    const section = document.createElement("section");
    section.className = "settings-section";
    const heading = document.createElement("h3");
    heading.textContent = windows ? "Windows" : "Linux";
    section.append(heading);

    section.append(this.renderTerminalRow(windows));

    if (windows) {
      section.append(
        this.renderActionRow(
          "Standard-Programm für Dateitypen",
          "Rui meldet beim Installieren an, welche Endungen es öffnen kann — .txt, .md, .ps1, " +
            ".sh, Quelltext und Logs. Welches Programm davon der Standard ist, legt seit " +
            "Windows 10 nur der Benutzer selbst fest.",
          "Windows-Einstellungen öffnen",
          () => void invoke("open_default_apps"),
        ),
      );
    } else {
      section.append(this.renderDesktopRow());
    }
    return section;
  }

  /**
   * Die Zeile für `rui` im Terminal.
   *
   * Sie füllt sich, sobald der Zustand vorliegt; schlägt die Abfrage fehl,
   * verschwindet der ganze Abschnitt wieder. Damit braucht die Anzeige
   * keine zweite Quelle für die Frage, ob Rui hier überhaupt etwas
   * einrichten kann.
   */
  private renderTerminalRow(windows: boolean): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const fill = (status: PathStatus) => {
      const labels = document.createElement("div");
      labels.className = "settings-labels";
      const label = document.createElement("label");
      label.textContent = "Im Terminal verfügbar";
      const hint = document.createElement("small");

      const beispiel = tr(windows ? "rui datei.ps1" : "rui datei.sh");
      const wo = windows ? "den Benutzer-PATH" : "~/.local/bin";

      if (status.registered) {
        hint.textContent =
          `${status.folder} — "${beispiel}" öffnet die Datei hier. Ein bereits offenes ` +
          "Terminal kennt den Eintrag allerdings erst nach einem Neustart.";
      } else if (status.otherFolder) {
        // Zwei Kopien, eine davon eingetragen: Wer hier klickt, holt den
        // Befehl zu der Kopie, die er gerade vor sich hat.
        hint.textContent =
          `Eingetragen ist eine andere Kopie von Rui (${status.otherFolder}). ` +
          `Eintragen holt "rui" hierher.`;
      } else {
        hint.textContent =
          `Legt Rui in ${wo}, damit "${beispiel}" im Terminal funktioniert. ` +
          (windows ? "Kein Administrator nötig" : "Kein root nötig") +
          ", jederzeit wieder wegnehmbar.";
      }
      labels.append(label, hint);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "link-btn";
      button.textContent = status.registered ? "Entfernen" : "Eintragen";
      button.addEventListener("click", () => {
        button.disabled = true;
        const command = status.registered ? "unregister_from_path" : "register_in_path";
        invoke<PathStatus>(command).then(fill, (err) => {
          button.disabled = false;
          hint.textContent = String(err);
        });
      });

      row.replaceChildren(labels, button);
    };

    void invoke<PathStatus>("path_status").then(fill, () => row.closest("section")?.remove());
    return row;
  }

  /**
   * Die `.desktop`-Datei — nur unter Linux.
   *
   * Sie meldet Rui als Programm für Text-, Script- und Quelltext-Typen an,
   * macht es aber ausdrücklich nicht zum Standard: Das bleibt eine
   * Entscheidung im Dateimanager. Dieselbe Linie wie unter Windows, wo das
   * seit Windows 10 ohnehin nur der Benutzer darf.
   */
  private renderDesktopRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const fill = (status: DesktopStatus) => {
      const labels = document.createElement("div");
      labels.className = "settings-labels";
      const label = document.createElement("label");
      label.textContent = "Als Programm für Dateitypen anmelden";
      const hint = document.createElement("small");
      hint.textContent = status.registered
        ? `${status.path} ist angelegt — Rui steht im Dateimanager unter „Öffnen mit“. ` +
          "Zum Standardprogramm machst du es dort selbst."
        : "Schreibt eine .desktop-Datei für Text, Logs, Scripts und Quelltext, damit Rui " +
          "unter „Öffnen mit“ auftaucht. Zum Standard wird es dadurch nicht.";
      labels.append(label, hint);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "link-btn";
      button.textContent = status.registered ? "Entfernen" : "Anmelden";
      button.addEventListener("click", () => {
        button.disabled = true;
        const command = status.registered ? "unregister_desktop" : "register_desktop";
        invoke<DesktopStatus>(command).then(fill, (err) => {
          button.disabled = false;
          hint.textContent = String(err);
        });
      });

      row.replaceChildren(labels, button);
    };

    void invoke<DesktopStatus>("desktop_status").then(fill, () => row.remove());
    return row;
  }

  private renderActionRow(
    label: string,
    hint: string,
    action: string,
    run: () => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const labels = document.createElement("div");
    labels.className = "settings-labels";
    const title = document.createElement("label");
    title.textContent = label;
    const small = document.createElement("small");
    small.textContent = hint;
    labels.append(title, small);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "link-btn";
    button.textContent = action;
    button.addEventListener("click", run);

    row.append(labels, button);
    return row;
  }

  private renderField(field: FieldDef): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const labels = document.createElement("div");
    labels.className = "settings-labels";
    const label = document.createElement("label");
    label.textContent = field.label;
    label.htmlFor = `set-${field.key}`;
    labels.append(label);
    if (field.hint) {
      const hint = document.createElement("small");
      hint.textContent = field.hint;
      labels.append(hint);
    }

    const value = this.draft[field.key];
    let control: HTMLElement;

    switch (field.type) {
      case "bool": {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "switch";
        input.id = `set-${field.key}`;
        input.checked = Boolean(value);
        input.addEventListener("change", () => this.commit(field.key, input.checked));
        control = input;
        break;
      }
      case "number": {
        const input = document.createElement("input");
        input.type = "number";
        input.id = `set-${field.key}`;
        input.min = String(field.min);
        input.max = String(field.max);
        input.step = String(field.step ?? 1);
        input.value = String(value);
        input.addEventListener("change", () => {
          const n = Number(input.value);
          if (Number.isFinite(n) && n >= field.min && n <= field.max) {
            this.commit(field.key, n);
          } else {
            input.value = String(this.draft[field.key]);
          }
        });
        control = input;
        break;
      }
      case "select": {
        const select = document.createElement("select");
        select.id = `set-${field.key}`;
        for (const [v, l] of field.options) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = l;
          select.append(opt);
        }
        select.value = String(value);
        select.addEventListener("change", () => this.commit(field.key, select.value));
        control = select;
        break;
      }
      case "text": {
        const input = document.createElement("input");
        input.type = "text";
        input.id = `set-${field.key}`;
        input.value = String(value);
        input.spellcheck = false;
        input.addEventListener("change", () => this.commit(field.key, input.value));
        control = input;
        break;
      }
      case "folder": {
        const wrap = document.createElement("div");
        wrap.className = "settings-folder";

        const display = document.createElement("input");
        display.type = "text";
        display.id = `set-${field.key}`;
        display.readOnly = true;
        display.value = (value as string | null) ?? "Nicht gesetzt";

        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "link-btn";
        pick.textContent = "Wählen…";
        pick.addEventListener("click", async () => {
          const dir = await openDialog({ directory: true });
          if (typeof dir === "string") {
            display.value = dir;
            this.commit(field.key, dir);
          }
        });

        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "link-btn";
        clear.textContent = "Leeren";
        clear.addEventListener("click", () => {
          display.value = "Nicht gesetzt";
          this.commit(field.key, null);
        });

        wrap.append(display, pick, clear);
        control = wrap;
        break;
      }
      case "folders": {
        const wrap = document.createElement("div");
        wrap.className = "settings-folders";

        const paths = [...((value as string[] | null) ?? [])];
        const list = document.createElement("ul");
        list.className = "settings-folder-list";

        const draw = () => {
          list.replaceChildren(
            ...paths.map((path, index) => {
              const item = document.createElement("li");
              const text = document.createElement("span");
              text.textContent = path;
              text.title = path;

              const remove = document.createElement("button");
              remove.type = "button";
              remove.className = "link-btn";
              remove.textContent = "Entfernen";
              remove.addEventListener("click", () => {
                paths.splice(index, 1);
                draw();
                this.commit(field.key, [...paths]);
              });

              item.append(text, remove);
              return item;
            }),
          );
          if (paths.length === 0) {
            const empty = document.createElement("li");
            empty.className = "settings-folder-empty";
            empty.textContent = "Keine zusätzlichen Ordner";
            list.append(empty);
          }
        };
        draw();

        const add = document.createElement("button");
        add.type = "button";
        add.className = "link-btn";
        add.id = `set-${field.key}`;
        add.textContent = "Ordner hinzufügen…";
        add.addEventListener("click", async () => {
          const dir = await openDialog({ directory: true });
          // Derselbe Ordner zweimal brächte jede Datei darin doppelt.
          if (typeof dir !== "string" || paths.some((p) => p.toLowerCase() === dir.toLowerCase())) {
            return;
          }
          paths.push(dir);
          draw();
          this.commit(field.key, [...paths]);
        });

        wrap.append(list, add);
        control = wrap;
        break;
      }
    }

    row.append(labels, control);
    return row;
  }
}
