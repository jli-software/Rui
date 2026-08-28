import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import type { OmarchyColors } from "./types";

/**
 * Sage — eine gedämpfte Graugrün-Palette in zwei Ausprägungen.
 *
 * Die Werte stehen hier und in `styles.css` als CSS-Custom-Properties.
 * Das Editor-Theme liest dieselben Rollen, damit Oberfläche und Textfläche
 * nicht auseinanderlaufen, wenn eine Farbe angepasst wird.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  selection: string;
  activeLine: string;
  gutter: string;
  gutterActive: string;
  danger: string;

  keyword: string;
  string: string;
  number: string;
  comment: string;
  func: string;
  /**
   * Eingebaute Namen: PowerShell-Cmdlets samt Aliassen, Shell-Builtins,
   * `$PSScriptRoot` und Verwandtschaft. Bisher fielen die auf `variable`
   * und hatten damit die Farbe des Fliesstexts — in einem Script, das zu
   * neun Zehnteln aus Cmdlet-Aufrufen besteht, blieb dadurch fast alles
   * grau.
   */
  builtin: string;
  /** Operatoren: `-eq`, `|`, `+`. Getrennt von Klammern, die stumm bleiben. */
  operator: string;
  /** Shebang, Präprozessor, Direktiven — alles, was nicht Programm ist. */
  meta: string;
  type: string;
  variable: string;
  heading: string;
  link: string;
  invalid: string;
}

export const sageLight: Palette = {
  bg: "#f5f7f2",
  surface: "#ecefe6",
  surfaceRaised: "#ffffff",
  border: "#d5ddcc",
  text: "#2e3a30",
  muted: "#6d7c6e",
  accent: "#6f8c66",
  accentText: "#ffffff",
  selection: "#cfdcc6",
  activeLine: "#eaeee4",
  gutter: "#9aa89a",
  gutterActive: "#4a5a4b",
  danger: "#a8544a",

  keyword: "#7a6a9b",
  string: "#5d7f52",
  number: "#a06a4d",
  comment: "#8d9a8d",
  func: "#4b7285",
  builtin: "#3f7f77",
  operator: "#8a6a94",
  meta: "#7b8a94",
  type: "#8a7340",
  variable: "#2e3a30",
  heading: "#4a6a44",
  link: "#4b7285",
  invalid: "#a8544a",
};

export const sageDark: Palette = {
  bg: "#1b211c",
  surface: "#222a24",
  surfaceRaised: "#2a332b",
  border: "#354037",
  text: "#d6e0d4",
  muted: "#8b9a8a",
  accent: "#94b489",
  accentText: "#18201a",
  selection: "#3a4d3a",
  activeLine: "#232c25",
  gutter: "#5d6d5d",
  gutterActive: "#b6c6b4",
  danger: "#d08b80",

  keyword: "#b3a3d1",
  string: "#a2c58e",
  number: "#d4a184",
  comment: "#6f7f6f",
  func: "#8fb9cd",
  builtin: "#7cc3ba",
  operator: "#c3aed6",
  meta: "#93a5b1",
  type: "#cdb386",
  variable: "#d6e0d4",
  heading: "#a8c99d",
  link: "#8fb9cd",
  invalid: "#d08b80",
};

// ---- Farbrechnen ---------------------------------------------------------
//
// Omarchys `colors.toml` ist eine Terminal-Palette: sie sagt, welche Farbe
// ein Theme für „grün" hält, aber nichts darüber, ob zwei davon
// nebeneinander noch lesbar sind. Ein Editor braucht genau das — deshalb
// leitet Rui die Oberflächen-Rollen nicht mehr stur ab, sondern prüft sie
// gegen den Untergrund, auf dem sie tatsächlich landen.

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` und `#rrggbb`; alles andere gibt `null`, damit der Aufrufer den Rückfall nimmt. */
function parseHex(hex: string): Rgb | null {
  const text = hex.trim().replace(/^#/, "");
  const full =
    text.length === 3
      ? text
          .split("")
          .map((c) => c + c)
          .join("")
      : text;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** `t = 0` ergibt `a`, `t = 1` ergibt `b`. Ungültige Farben geben `a` zurück. */
function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  return toHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

/** Relative Leuchtdichte nach WCAG — die Grundlage jedes Kontrastwerts. */
function luminance(hex: string): number {
  const c = parseHex(hex);
  if (!c) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG-Kontrastverhältnis, 1 (gleich) bis 21 (Schwarz auf Weiss). */
function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Hebt `color` so weit Richtung `toward` an, bis sie auf `on` das
 * geforderte Verhältnis erreicht.
 *
 * Der Fall, für den das hier steht: Tokyo Nights `dark_foreground`
 * (`#565f89`) ist als Kommentarfarbe im Code richtig — auf der
 * Statusleiste (`#24283b`) kommt sie auf ein Verhältnis von rund 2:1 und
 * ist damit kaum noch zu lesen. Statt die Themenfarbe zu verwerfen, wird
 * sie in Schritten zur Vordergrundfarbe verschoben, bis sie reicht: Das
 * Theme bleibt erkennbar, der Text lesbar.
 */
function ensureContrast(color: string, on: string, ratio: number, toward: string): string {
  if (!parseHex(color) || !parseHex(on)) return color;
  let result = color;
  for (let step = 0; step <= 10 && contrast(result, on) < ratio; step++) {
    result = mix(color, toward, step / 10);
  }
  return result;
}

/** Wählt zwischen zwei Textfarben die, die auf `bg` besser lesbar ist. */
function contrastText(bg: string, dark: string, light: string): string {
  return contrast(bg, dark) >= contrast(bg, light) ? dark : light;
}

/**
 * Eine Fläche eine Stufe „höher" legen: im dunklen Theme heller, im hellen
 * Theme näher an Weiss.
 *
 * `amount` ist der Mischanteil, nicht die Helligkeit — bei sehr dunklen
 * Untergründen wirkt derselbe Wert stärker, und das ist gewollt: Die
 * Abstufungen sollen sichtbar sein, nicht rechnerisch gleich gross.
 */
function lift(hex: string, amount: number, dark: boolean): string {
  return mix(hex, dark ? "#ffffff" : "#000000", amount);
}

/**
 * Baut eine Palette aus den Farben des aktiven Omarchy-Themes.
 *
 * Omarchys `colors.toml` liefert eine Terminal-Palette, keine fertige
 * Editor-Palette — jede Rui-Rolle wird hier aus der naheliegendsten
 * Terminalfarbe abgeleitet (Kommentare gedimmt, Strings grün, etc.), wie es
 * auch andere Editoren mit Base16-artigen Paletten machen. Fehlt ein Feld
 * (nicht jedes Theme definiert alle), fällt die jeweilige Rolle auf `base`
 * zurück, statt eine undefinierte Farbe zu zeigen.
 *
 * Die Syntaxfarben werden dabei übernommen, wie das Theme sie meint. Die
 * Farben der Oberfläche dagegen werden geprüft: Ein Terminal-Theme muss
 * nur wissen, wie „grün" aussieht — ein Editor muss wissen, ob die
 * Statusleiste auf ihrem eigenen Untergrund noch lesbar ist und ob ein
 * Dialog über dem Text steht oder in ihm versinkt.
 */
export function omarchyPalette(c: OmarchyColors, base: Palette): Palette {
  const bg = c.background ?? base.bg;
  const dark = c.mode === "dark";
  const fg = c.foreground ?? base.text;

  // Drei Ebenen, die in dieselbe Richtung führen: Text < Statusleiste <
  // Dialog. Omarchys eigene Werte kommen zum Zug, wenn sie in diese
  // Richtung zeigen — sonst rechnet Rui die Stufe selbst.
  //
  // Vorher wurde `darker_background` für die Dialoge genommen. Bei Tokyo
  // Night ist das `#0e0e14`: dunkler als der Editor, obwohl der Dialog
  // über ihm liegt. Einstellungen und Schnellöffnen fielen damit in ein
  // Loch statt sich abzuheben.
  const hinted = dark ? c.lighterBackground : c.darkBackground;
  const surface = hinted && lifted(hinted, bg, dark) ? hinted : lift(bg, dark ? 0.07 : 0.05, dark);
  const surfaceRaised = dark ? lift(surface, 0.06, true) : mix(bg, "#ffffff", 0.75);

  const accent = c.accent ?? base.accent;

  // `dark_foreground` ist die Kommentarfarbe des Themes — im Code richtig
  // gedimmt, für Beschriftungen der Oberfläche aber oft zu leise. Sie
  // gilt hier deshalb nur so weit, wie sie auf der Statusleiste lesbar
  // bleibt.
  const dimmed = c.darkForeground ?? base.muted;
  const muted = ensureContrast(dimmed, surface, 4.5, fg);

  return {
    bg,
    surface,
    surfaceRaised,
    // Der Rand darf leise sein, muss aber sichtbar bleiben — er ist das
    // Einzige, was einen Dialog gegen den Text abgrenzt.
    border: ensureContrast(c.muted ?? dimmed, surfaceRaised, 1.6, fg),
    text: fg,
    muted,
    accent,
    accentText: contrastText(accent, "#111318", "#ffffff"),
    // Eine Auswahl, die man nicht sieht, ist keine. Manche Themes halten
    // ihre Selektionsfarbe so dicht am Hintergrund, dass im Editor nichts
    // mehr davon übrig bleibt.
    selection: ensureContrast(c.selection ?? base.selection, bg, 1.5, fg),
    activeLine: surface,
    gutter: ensureContrast(dimmed, bg, 3, fg),
    gutterActive: fg,
    danger: c.red ?? base.danger,

    keyword: c.magenta ?? base.keyword,
    string: c.green ?? base.string,
    number: c.orange ?? c.yellow ?? base.number,
    comment: dimmed,
    func: c.blue ?? base.func,
    // Cyan ist in Terminal-Paletten die Farbe, die Rui sonst nur für Links
    // braucht — hier trägt sie mehr, weil Cmdlets in einem PowerShell-Script
    // der häufigste Token überhaupt sind.
    builtin: c.cyan ?? base.builtin,
    operator: c.brown ?? c.magenta ?? base.operator,
    meta: dimmed,
    type: c.yellow ?? base.type,
    variable: fg,
    heading: c.blue ?? base.heading,
    link: c.cyan ?? base.link,
    invalid: c.red ?? base.invalid,
  };
}

/**
 * Liegt `candidate` gegenüber `bg` in der Richtung, die „höher" bedeutet —
 * heller im dunklen Theme, dunkler im hellen? Und weit genug entfernt, um
 * als eigene Fläche durchzugehen?
 */
function lifted(candidate: string, bg: string, dark: boolean): boolean {
  const diff = luminance(candidate) - luminance(bg);
  const enough = Math.abs(diff) > 0.004;
  return enough && (dark ? diff > 0 : diff < 0);
}

/** Schreibt die Palette als CSS-Variablen auf `<html>`. */
export function applyPalette(p: Palette, dark: boolean) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(p)) {
    root.style.setProperty(`--${kebab(key)}`, value);
  }
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}

function kebab(s: string) {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function highlightStyle(p: Palette) {
  return HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: "italic" },
    // Der Shebang einer `.sh` und Direktiven wie `#Requires` hatten bisher
    // gar keine Regel und blieben in der Textfarbe stehen.
    { tag: [t.meta, t.docComment, t.processingInstruction], color: p.meta },
    {
      tag: [t.keyword, t.modifier, t.controlKeyword, t.moduleKeyword, t.definitionKeyword],
      color: p.keyword,
    },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: p.string },
    // Escapes heben sich vom String ab: ein Zeilenumbruch im Text ist
    // Code, kein Text.
    { tag: [t.escape, t.number, t.bool, t.null, t.atom], color: p.number },
    { tag: t.constant(t.variableName), color: p.number },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName],
      color: p.func,
    },
    // Cmdlets, Shell-Builtins und `$PSScriptRoot`: der häufigste Token in
    // einem Script und bis hierher in der Farbe von gewöhnlichem Text.
    {
      tag: [t.standard(t.variableName), t.standard(t.propertyName)],
      color: p.builtin,
    },
    {
      tag: [t.typeName, t.className, t.namespace, t.annotation, t.special(t.variableName)],
      color: p.type,
    },
    // Attributnamen trugen dieselbe Farbe wie der Text und waren in XML
    // und HTML damit praktisch unsichtbar.
    { tag: t.attributeName, color: p.type },
    { tag: t.attributeValue, color: p.string },
    { tag: [t.variableName, t.propertyName], color: p.variable },
    // Operatoren tragen Bedeutung — `-eq`, `|`, `+` —, Klammern nicht.
    // Beide dieselbe stumme Farbe zu geben, war der Hauptgrund, aus dem
    // PowerShell nach zwei Farben aussah.
    {
      tag: [
        t.operator,
        t.derefOperator,
        t.compareOperator,
        t.logicOperator,
        t.arithmeticOperator,
        t.bitwiseOperator,
        t.updateOperator,
        t.definitionOperator,
      ],
      color: p.operator,
    },
    {
      tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace, t.squareBracket, t.angleBracket],
      color: p.muted,
    },
    { tag: [t.definition(t.variableName)], color: p.text },
    { tag: t.invalid, color: p.invalid },

    // Markdown
    { tag: t.heading, color: p.heading, fontWeight: "600" },
    { tag: t.strong, color: p.text, fontWeight: "700" },
    { tag: t.emphasis, color: p.text, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: [t.link, t.url], color: p.link, textDecoration: "underline" },
    { tag: t.monospace, color: p.string },
    { tag: t.quote, color: p.muted, fontStyle: "italic" },
    { tag: t.list, color: p.accent },
  ]);
}

/** Erzeugt das komplette CodeMirror-Theme aus einer Palette. */
export function editorTheme(p: Palette, dark: boolean): Extension {
  const view = EditorView.theme(
    {
      "&": {
        color: p.text,
        backgroundColor: p.bg,
        height: "100%",
      },
      ".cm-content": {
        caretColor: p.accent,
        padding: "8px 0",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: p.accent,
        borderLeftWidth: "2px",
      },
      "&.cm-focused .cm-selectionBackgroundPrimary, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: `${p.selection} !important`,
        },
      ".cm-activeLine": { backgroundColor: p.activeLine },
      ".cm-gutters": {
        backgroundColor: p.bg,
        color: p.gutter,
        border: "none",
        borderRight: `1px solid ${p.border}`,
        userSelect: "none",
      },
      ".cm-activeLineGutter": {
        backgroundColor: p.activeLine,
        color: p.gutterActive,
      },
      ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 8px" },
      ".cm-foldPlaceholder": {
        backgroundColor: p.surface,
        border: `1px solid ${p.border}`,
        color: p.muted,
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: p.selection,
        outline: `1px solid ${p.accent}`,
      },
      ".cm-nonmatchingBracket": { color: p.danger },
      ".cm-selectionMatch": { backgroundColor: p.selection },
      ".cm-searchMatch": {
        backgroundColor: p.selection,
        outline: `1px solid ${p.border}`,
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: p.accent,
        color: p.accentText,
      },
      ".cm-highlightSpace": { color: p.gutter },
      ".cm-highlightTab": { color: p.gutter },
      ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit" },
      // Das eingebaute Suchen-Panel an die Palette angleichen.
      ".cm-panels": {
        backgroundColor: p.surface,
        color: p.text,
        borderTop: `1px solid ${p.border}`,
      },
      ".cm-panel.cm-search input, .cm-panel.cm-search button": {
        backgroundColor: p.surfaceRaised,
        color: p.text,
        border: `1px solid ${p.border}`,
        borderRadius: "4px",
        padding: "2px 6px",
        fontFamily: "inherit",
      },
      ".cm-panel.cm-search label": { color: p.muted },
      ".cm-panel.cm-search button[name='close']": {
        border: "none",
        background: "transparent",
        color: p.muted,
      },
      ".cm-tooltip": {
        backgroundColor: p.surfaceRaised,
        border: `1px solid ${p.border}`,
        color: p.text,
      },
    },
    { dark },
  );
  return [view, syntaxHighlighting(highlightStyle(p))];
}
