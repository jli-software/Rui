import { getName, getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";

import { write as writeClipboard } from "./clipboard";

/**
 * „Über Rui".
 *
 * Klingt nach Zierde, ist aber das Feld, in dem eine Fehlermeldung
 * anfängt: Ohne die Versionsnummer lässt sich kein Bericht einordnen, und
 * bis 0.5.0 stand sie nirgends in der laufenden Anwendung — nur im
 * Dateinamen des Installers, den man ein halbes Jahr später nicht mehr
 * hat. Deshalb liest der Dialog die Zahlen zur Laufzeit aus dem Bundle
 * statt sie beim Bauen ins Frontend zu schreiben: Was hier steht, ist
 * dann auch das, was tatsächlich läuft.
 */

const REPO = "https://github.com/jli-software/Rui";
const CHANGELOG = `${REPO}/blob/main/CHANGELOG.md`;

/**
 * Das Logo aus `assets/logo/rui-small.svg`, hier inline statt als Datei:
 * Die CSP erlaubt `img-src 'self' data:`, ein eingebettetes `<svg>` geht
 * daran vorbei und folgt ausserdem der Schriftgrösse.
 */
const LOGO_SVG = `
  <svg viewBox="0 0 512 512" width="52" height="52" aria-hidden="true">
    <defs>
      <linearGradient id="aboutRuiBg" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="#333f34"/>
        <stop offset="1" stop-color="#1a201b"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="115" fill="url(#aboutRuiBg)"/>
    <path d="M 256 74 C 372 168, 408 268, 256 438 C 104 268, 140 168, 256 74 Z" fill="#94b489"/>
    <path d="M 256 116 L 256 412" stroke="#1e2620" stroke-width="24" stroke-linecap="round"/>
  </svg>`;

export interface AboutActions {
  /** Kurzmeldung in der Statusleiste, etwa nach „Angaben kopieren". */
  flash: (text: string) => void;
  onClose: () => void;
}

export class AboutDialog {
  private readonly root: HTMLDivElement;
  private readonly version: HTMLElement;
  private readonly stack: HTMLElement;
  /** Die Zeilen für „Angaben kopieren" — gefüllt, sobald sie feststehen. */
  private report = "Rui";

  constructor(private readonly actions: AboutActions) {
    this.root = document.createElement("div");
    this.root.className = "overlay";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="about" role="dialog" aria-modal="true" aria-label="Über Rui" tabindex="-1">
        <header class="about-head">
          <h2>Über Rui</h2>
          <button class="icon-btn" data-act="close" aria-label="Schliessen">✕</button>
        </header>
        <div class="about-body">
          <div class="about-mark">${LOGO_SVG}</div>
          <p class="about-name">Rui</p>
          <p class="about-tagline">Ein schlanker Texteditor für Snippets und Notizen.</p>
          <dl class="about-facts">
            <dt>Version</dt><dd class="about-version">wird gelesen…</dd>
            <dt>Entwickler</dt><dd>jli software</dd>
            <dt>Lizenz</dt><dd>MIT</dd>
            <dt>Quelltext</dt>
            <dd><button class="link-btn" data-act="repo">github.com/jli-software/Rui</button></dd>
            <dt>Baut auf</dt><dd class="about-stack">Tauri · CodeMirror 6</dd>
          </dl>
        </div>
        <footer class="about-foot">
          <button class="link-btn" data-act="copy">Angaben kopieren</button>
          <button class="link-btn" data-act="changelog">Changelog öffnen</button>
        </footer>
      </div>`;
    document.body.appendChild(this.root);

    this.version = this.root.querySelector(".about-version")!;
    this.stack = this.root.querySelector(".about-stack")!;

    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.close();
    });
    this.root.addEventListener("mousedown", (event) => {
      if (event.target === this.root) this.close();
    });
    this.root.addEventListener("click", (event) => {
      const act = (event.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
      if (act === "close") this.close();
      if (act === "repo") void openUrl(REPO);
      if (act === "changelog") void openUrl(CHANGELOG);
      if (act === "copy") void this.copyReport();
    });

    void this.load();
  }

  get isOpen() {
    return !this.root.hidden;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.root.hidden = false;
    // Den Rahmen fokussieren, nicht den Schliessen-Knopf: `Esc` und die
    // Tabulatorreihenfolge brauchen den Fokus im Dialog, aber ein Ring um
    // das ✕ sähe aus, als sei das die gemeinte Aktion.
    this.root.querySelector<HTMLElement>(".about")!.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.actions.onClose();
  }

  /**
   * Version und Unterbau einmal beim Start holen.
   *
   * Die Tauri-Aufrufe sind asynchron; sie erst beim Öffnen zu starten
   * hiesse, dass im Dialog für einen Wimpernschlag „wird gelesen…" steht.
   * Beim Start fällt das niemandem auf.
   */
  private async load() {
    let name = "Rui";
    let version = "unbekannt";
    let tauri = "";
    try {
      [name, version, tauri] = await Promise.all([getName(), getVersion(), getTauriVersion()]);
    } catch (err) {
      // Kein Grund, den Dialog scheitern zu lassen: Alles andere darin
      // steht auch ohne die Zahlen.
      console.error("Versionsangaben konnten nicht gelesen werden:", err);
    }

    this.version.textContent = version;
    this.stack.textContent = tauri ? `Tauri ${tauri} · CodeMirror 6` : "Tauri · CodeMirror 6";
    this.report = [
      `${name} ${version}`,
      tauri ? `Tauri ${tauri}` : null,
      `Webview: ${navigator.userAgent}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Alles, was in einen Fehlerbericht gehört, in einem Griff.
   *
   * Die Webview-Kennung steht mit drin, weil sich Rui unter WebKitGTK und
   * unter WebView2 an genau den Stellen unterschiedlich verhält, an denen
   * man später nachfragt.
   */
  private async copyReport() {
    await writeClipboard(this.report);
    this.actions.flash("Angaben kopiert");
  }
}
