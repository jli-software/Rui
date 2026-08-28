import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * Die System-Zwischenablage.
 *
 * Läuft über das Tauri-Plugin und nicht über `navigator.clipboard`:
 * Schreiben ginge dort zwar, aber Lesen verlangt im Webview eine
 * Berechtigung, die eine Tauri-App nicht bekommt — und ohne Lesen gäbe es
 * weder `"+p` noch Einfügen im Normalmodus.
 *
 * Beide Wege des Plugins sind asynchron. Für Strg+Umschalt+V ist das kein
 * Problem, für Vims Register-Schnittstelle schon: die verlangt einen Wert,
 * den sie sofort bekommt. Deshalb hält dieses Modul den zuletzt gelesenen
 * Inhalt vor und frischt ihn zu den Zeitpunkten auf, an denen er veraltet
 * sein könnte — beim Fokuswechsel und sobald jemand in Vim ein Register
 * anspricht.
 */

let cached = "";

/** Der zuletzt gelesene Inhalt. Synchron, deshalb möglicherweise alt. */
export function cachedText(): string {
  return cached;
}

/** Liest die Zwischenablage und aktualisiert den Zwischenspeicher. */
export async function refresh(): Promise<string> {
  try {
    // Eine leere Zwischenablage liefert je nach Plattform `null`.
    cached = (await readText()) ?? "";
  } catch {
    // Ein Bild oder eine Datei in der Zwischenablage ist kein Fehler,
    // sondern nur nichts, was Rui einfügen könnte.
    cached = "";
  }
  return cached;
}

export async function write(text: string): Promise<void> {
  // Sofort mitschreiben: `"+y` gefolgt von `"+p` soll auch dann den
  // eigenen Text liefern, wenn das Schreiben noch unterwegs ist.
  cached = text;
  try {
    await writeText(text);
  } catch (err) {
    console.error("Zwischenablage konnte nicht geschrieben werden:", err);
  }
}
