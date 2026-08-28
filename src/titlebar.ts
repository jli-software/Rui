import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Eigene Titelleiste für den `custom`-Dekorationsmodus (Windows). Wird bei
 * `native`/`none` gar nicht sichtbar — siehe `body[data-decoration]` in
 * `styles.css`.
 *
 * Das Ziehen läuft absichtlich über einen eigenen `mousedown`-Handler statt
 * über das Attribut `data-tauri-drag-region`: so bleibt genau eine Stelle
 * verantwortlich für "Doppelklick maximiert", ohne mit einer eingebauten
 * Handhabung dieses Attributs zu kollidieren.
 */
export class TitleBar {
  private readonly maxBtn: HTMLButtonElement;

  constructor(private readonly root: HTMLElement) {
    const win = getCurrentWindow();
    const drag = root.querySelector<HTMLElement>(".titlebar-drag")!;
    this.maxBtn = root.querySelector<HTMLButtonElement>('[data-tb="max"]')!;

    drag.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.detail >= 2) {
        e.preventDefault();
        void win.toggleMaximize();
        return;
      }
      void win.startDragging();
    });

    root.querySelector('[data-tb="min"]')!.addEventListener("click", () => void win.minimize());
    this.maxBtn.addEventListener("click", () => void win.toggleMaximize());
    root.querySelector('[data-tb="close"]')!.addEventListener("click", () => void win.close());

    void this.refreshMaximized();
    void win.onResized(() => void this.refreshMaximized());
  }

  setTitle(text: string) {
    this.root.querySelector(".titlebar-text")!.textContent = text;
  }

  private async refreshMaximized() {
    const maximized = await getCurrentWindow().isMaximized();
    this.maxBtn.textContent = maximized ? "❐" : "☐";
    this.maxBtn.title = maximized ? "Wiederherstellen" : "Maximieren";
    this.maxBtn.setAttribute("aria-label", this.maxBtn.title);
  }
}
