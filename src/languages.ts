import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

/**
 * Sprachunterstützung, ausschliesslich per dynamischem Import.
 *
 * Vite trennt daraus eigene Chunks: Beim Start lädt nur der Editor selbst,
 * der Markdown- oder Rust-Modus erst, wenn eine solche Datei geöffnet wird.
 * Genau deshalb steht hier für jede Sprache ein eigener statischer
 * `import()` und keine per String zusammengebaute Pfadvariable — die
 * könnte Vite nicht auflösen.
 */
export interface LanguageDef {
  id: string;
  /** Anzeigename in Statusleiste und Befehlspalette. */
  name: string;
  extensions: string[];
  /** `null` bedeutet: reiner Text, keine Erweiterung laden. */
  load: (() => Promise<Extension>) | null;
}

const stream = (mod: Promise<any>, key: string): Promise<Extension> =>
  mod.then((m) => StreamLanguage.define(m[key]));

export const LANGUAGES: LanguageDef[] = [
  {
    id: "text",
    name: "Text",
    // `out`, `err` und `trace` stehen hier, weil Logdateien der Grund sind,
    // aus dem Rui überhaupt fremde Ordner durchsucht.
    extensions: ["txt", "text", "log", "out", "err", "trace", "csv", "tsv", "nfo", ""],
    load: null,
  },
  {
    id: "markdown",
    name: "Markdown",
    extensions: ["md", "markdown", "mdown", "mkd"],
    load: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  },
  {
    id: "rust",
    name: "Rust",
    extensions: ["rs"],
    load: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  },
  {
    id: "go",
    name: "Go",
    extensions: ["go"],
    load: () => import("@codemirror/lang-go").then((m) => m.go()),
  },
  {
    id: "python",
    name: "Python",
    extensions: ["py", "pyw", "pyi"],
    load: () => import("@codemirror/lang-python").then((m) => m.python()),
  },
  {
    id: "json",
    name: "JSON",
    extensions: ["json", "jsonc", "webmanifest"],
    load: () => import("@codemirror/lang-json").then((m) => m.json()),
  },
  {
    id: "yaml",
    name: "YAML",
    extensions: ["yaml", "yml"],
    load: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  },
  {
    id: "csharp",
    name: "C#",
    extensions: ["cs", "csx"],
    load: () => stream(import("@codemirror/legacy-modes/mode/clike"), "csharp"),
  },
  {
    id: "powershell",
    name: "PowerShell",
    extensions: ["ps1", "psm1", "psd1"],
    load: () => stream(import("@codemirror/legacy-modes/mode/powershell"), "powerShell"),
  },
  {
    id: "toml",
    name: "TOML",
    extensions: ["toml"],
    load: () => stream(import("@codemirror/legacy-modes/mode/toml"), "toml"),
  },
  {
    id: "shell",
    name: "Shell",
    extensions: ["sh", "bash", "zsh", "fish"],
    load: () => stream(import("@codemirror/legacy-modes/mode/shell"), "shell"),
  },
  {
    id: "javascript",
    name: "JavaScript",
    extensions: ["js", "mjs", "cjs", "ts", "jsx", "tsx"],
    load: () => stream(import("@codemirror/legacy-modes/mode/javascript"), "javascript"),
  },
  {
    id: "sql",
    name: "SQL",
    extensions: ["sql"],
    load: () => stream(import("@codemirror/legacy-modes/mode/sql"), "standardSQL"),
  },
  {
    id: "xml",
    name: "XML",
    extensions: ["xml", "xaml", "csproj", "config", "svg", "html", "htm"],
    load: () => stream(import("@codemirror/legacy-modes/mode/xml"), "xml"),
  },
  {
    id: "ini",
    name: "INI",
    extensions: ["ini", "conf", "cfg", "properties", "env"],
    load: () => stream(import("@codemirror/legacy-modes/mode/properties"), "properties"),
  },
  {
    id: "diff",
    name: "Diff",
    extensions: ["diff", "patch"],
    load: () => stream(import("@codemirror/legacy-modes/mode/diff"), "diff"),
  },
];

const PLAIN = LANGUAGES[0];

/** Sonderfälle ohne aussagekräftige Endung. */
const BY_FILENAME: Record<string, string> = {
  dockerfile: "text",
  makefile: "text",
  ".gitignore": "text",
  ".editorconfig": "ini",
};

export function detectLanguage(path: string | null): LanguageDef {
  if (!path) return PLAIN;

  const file = path.split(/[\\/]/).pop() ?? "";
  const byName = BY_FILENAME[file.toLowerCase()];
  if (byName) return LANGUAGES.find((l) => l.id === byName) ?? PLAIN;

  const dot = file.lastIndexOf(".");
  if (dot <= 0) return PLAIN;
  const ext = file.slice(dot + 1).toLowerCase();

  return LANGUAGES.find((l) => l.extensions.includes(ext)) ?? PLAIN;
}

export function languageById(id: string): LanguageDef {
  return LANGUAGES.find((l) => l.id === id) ?? PLAIN;
}

/** Dateifilter für die Öffnen-/Speichern-Dialoge. */
export function dialogFilters() {
  return [
    { name: "Text und Markdown", extensions: ["txt", "md", "markdown", "log"] },
    {
      name: "Code",
      extensions: LANGUAGES.flatMap((l) => l.extensions).filter((e) => e !== ""),
    },
    { name: "Alle Dateien", extensions: ["*"] },
  ];
}

/**
 * Endungen, die Quick Open auflisten soll.
 *
 * Bewusst dieselbe Quelle wie Syntax-Highlighting und Dateidialoge: Eine
 * Sprache, die Rui einfärben kann, muss man auch finden können. Stünde die
 * Liste zusätzlich in `quick_open.rs`, liefe sie beim nächsten neuen Modus
 * auseinander.
 */
export function textFileExtensions(): string[] {
  return [...new Set(LANGUAGES.flatMap((l) => l.extensions).filter((e) => e !== ""))];
}
