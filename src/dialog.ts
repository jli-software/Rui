import { tr } from "./i18n";

/**
 * Rückfragen und Meldungen im Fenster statt vom System.
 *
 * Bis 0.5.1 kamen sie aus dem Dialog-Plugin, also vom Fenstermanager. Das
 * hat zwei Nachteile, die beide beim Schliessen eines geänderten Tabs
 * zusammenkommen: Unter einem Kachel-Compositor ist es ein fremdes,
 * ungestyltes Fenster, das nicht einmal sicher über Rui landet — und ein
 * System-Dialog kennt genau zwei Antworten. „Ungespeicherte Änderungen"
 * braucht aber drei: speichern, verwerfen, doch nicht schliessen. Ohne die
 * dritte muss der Nutzer abbrechen, selbst speichern und noch einmal
 * schliessen.
 *
 * Der Dateiauswahl-Dialog bleibt der des Systems: Dort geht es um das
 * Dateisystem, nicht um Rui, und die eigenen Orte des Nutzers kennt nur er.
 */

export interface DialogAction<T> {
  label: string;
  value: T;
  /**
   * `primary` ist die Antwort, die Enter gibt; `danger` färbt das, was
   * Arbeit vernichtet. Ohne Angabe bleibt der Knopf neutral.
   */
  tone?: "primary" | "danger";
}

export interface DialogOptions<T> {
  title: string;
  text: string;
  actions: DialogAction<T>[];
  /** Was Esc, der Klick daneben und der Schliessen-Knopf liefern. */
  dismiss: T;
  kind?: "warning" | "error";
}

/**
 * Wie viele Dialoge gerade offen sind.
 *
 * `bindShortcuts` fragt das ab: Der globale Tastaturhaken hängt mit
 * `capture: true` am Fenster und käme sonst vor dem Dialog dran — `Strg+W`
 * würde also den Tab schliessen, während die Frage, ob der Tab geschlossen
 * werden darf, noch auf dem Bildschirm steht.
 */
let openCount = 0;

export function dialogOpen(): boolean {
  return openCount > 0;
}

/** Eine Rückfrage mit beliebig vielen Antworten. */
export function dialog<T>(options: DialogOptions<T>): Promise<T> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "overlay";
    root.innerHTML = `
      <div class="palette dialog" role="alertdialog" aria-modal="true">
        <h2 class="dialog-title"></h2>
        <p class="dialog-text"></p>
        <div class="dialog-actions"></div>
      </div>`;

    const box = root.querySelector<HTMLElement>(".dialog")!;
    const title = root.querySelector<HTMLElement>(".dialog-title")!;
    const text = root.querySelector<HTMLElement>(".dialog-text")!;
    title.textContent = tr(options.title);
    text.textContent = tr(options.text);
    if (options.kind) box.dataset.kind = options.kind;

    const previous = document.activeElement as HTMLElement | null;
    let settled = false;
    const done = (value: T) => {
      if (settled) return;
      settled = true;
      openCount--;
      root.remove();
      // Der Fokus muss zurück, sonst hängt er an einem Knopf, den es nicht
      // mehr gibt, und der nächste Tastendruck landet nirgendwo.
      previous?.focus?.();
      resolve(value);
    };

    const buttons = root.querySelector<HTMLElement>(".dialog-actions")!;
    for (const action of options.actions) {
      const button = document.createElement("button");
      button.className = "dialog-btn";
      if (action.tone) button.dataset.tone = action.tone;
      button.textContent = tr(action.label);
      button.addEventListener("click", () => done(action.value));
      buttons.append(button);
    }

    // Enter gehört der ersten Antwort — die steht links und ist die, die
    // nichts kaputt macht. Esc gehört immer dem Abbruch.
    const all = [...buttons.querySelectorAll<HTMLButtonElement>(".dialog-btn")];
    const primary = all.find((b) => b.dataset.tone === "primary") ?? all[0];

    root.addEventListener(
      "keydown",
      (event) => {
        // Auch das, was der Dialog nicht selbst braucht, endet hier: Sonst
        // liefe es weiter an die Vim-Steuerung im Editor darunter.
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          done(options.dismiss);
          return;
        }
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const at = all.indexOf(document.activeElement as HTMLButtonElement);
          const step = event.key === "ArrowRight" ? 1 : -1;
          all[(Math.max(at, 0) + step + all.length) % all.length]?.focus();
        }
      },
      true,
    );
    root.addEventListener("mousedown", (event) => {
      if (event.target === root) done(options.dismiss);
    });

    openCount++;
    document.body.appendChild(root);
    primary?.focus();
  });
}

/** Ja/Nein-Rückfrage — der Ersatz für `ask()`. */
export function confirmDialog(
  text: string,
  options: {
    title: string;
    okLabel: string;
    cancelLabel?: string;
    kind?: "warning" | "error";
    /** Der Ja-Knopf vernichtet etwas und wird entsprechend gefärbt. */
    danger?: boolean;
  },
): Promise<boolean> {
  return dialog<boolean>({
    title: options.title,
    text,
    kind: options.kind ?? "warning",
    actions: [
      { label: options.okLabel, value: true, tone: options.danger ? "danger" : "primary" },
      { label: options.cancelLabel ?? tr("Abbrechen"), value: false },
    ],
    dismiss: false,
  });
}

/** Eine Meldung mit einem einzigen Knopf — der Ersatz für `message()`. */
export function alertDialog(
  text: string,
  options: { title: string; kind?: "warning" | "error" },
): Promise<void> {
  return dialog<void>({
    title: options.title,
    text,
    kind: options.kind ?? "error",
    actions: [{ label: tr("Schliessen"), value: undefined, tone: "primary" }],
    dismiss: undefined,
  });
}
