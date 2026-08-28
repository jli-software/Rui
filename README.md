# Rui

A lean text editor for code snippets and plain text editing. Line numbers,
syntax highlighting, no menu bar — everything runs through the command
palette and the status bar.

Built with [Tauri 2](https://tauri.app) and [CodeMirror 6](https://codemirror.net):
the text buffer lives in the frontend, Rust handles file I/O, encoding and
settings.

> **Note on language:** the user interface is currently **German only**.
> Localisation is on the roadmap; until then the app will not be much fun in
> other languages.

## Download

Grab the latest build from the [Releases page](https://github.com/vikingjunior12/Rui/releases).

| File | What it is |
|---|---|
| `rui.exe` | Portable Windows binary, runs without installing |
| `Rui_<version>_x64-setup.exe` | NSIS installer (per-user install) |
| `Rui_<version>_x64_en-US.msi` | MSI, for deployment via Intune/GPO |
| `rui-linux` | Portable Linux binary |

The builds are **not code-signed** yet, so Windows SmartScreen will show a
warning on first launch ("More info" → "Run anyway"). Verify the SHA256
checksum published with each release if you want to be sure of what you got.

## Features

- **Command palette** (`Ctrl+Shift+P`) instead of a menu bar, with the
  matching shortcut shown next to every command
- **Syntax highlighting** for Rust, Go, Python, JSON, YAML, Markdown and more,
  each language loaded as its own lazy chunk
- **Encoding aware** — detects BOM and encoding on open, remembers it along
  with the line ending, and restores both on save. A Windows-1252 file stays
  Windows-1252 instead of silently becoming UTF-8. Both are switchable from
  the status bar.
- **Crash-safe writes** — saving goes through a temporary neighbouring file
  followed by a rename, so a crash mid-save cannot destroy your file
- **Notes folder with instant save** — see below
- **Sage colour palette**, light and dark, plus automatic
  [Omarchy](https://omarchy.org) theme detection on Linux

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+N` / `Ctrl+O` / `Ctrl+S` | New / Open / Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+F` | Find and replace |
| `Ctrl+G` | Go to line |
| `Ctrl+,` | Settings |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Font size |

Everything else lives in the command palette.

## Notes folder (instant save)

Pick a notes folder in the settings and Rui keeps every open buffer saved on
its own from then on — roughly half a second after the last keystroke, no
`Ctrl+S` needed.

A new, still unnamed note takes its filename from the first line (whitespace
becomes `_`, forbidden characters are dropped) and lands in that folder
automatically; if the first line changes later, the file is renamed along with
it. An entirely empty first line leaves an already named note alone, and a new
note without any title gets a readable timestamp as its name. Collisions
resolve the way Finder and Explorer do it, with an appended counter —
`Name (2).md` and so on.

Instant save deliberately runs **without** the save transforms
(`trimTrailingWhitespace` / `ensureFinalNewline`) — those would wipe out a
space you just typed, mid-sentence. They stay reserved for explicit saves.

While the folder is set this applies to ordinary files too: a normally opened
file is also saved continuously, but never renamed — renaming only happens for
notes Rui named itself.

## Settings

Defaults live in `settings.rs`, not in the JSON file. Settings are stored in
`%APPDATA%/ch.gaiching.rui/settings.json` (Windows), `~/.config/ch.gaiching.rui/`
(Linux) and `~/Library/Application Support/` (macOS). The settings dialog has
a button that opens the file directly.

Adding a new option takes exactly two places: the field on the `Settings`
struct, and an entry in `SECTIONS` in `settings-ui.ts`.

## Development

```bash
npm install
npm run tauri dev      # run the app
npm run build          # build the frontend
npm run tauri build    # build installers
cd src-tauri && cargo test
```

### Windows builds

Built natively on Windows, not cross-compiled from Linux — WebView2 and the
MSVC linker make that unreliable from the outside. You need the MSVC build
tools, the Rust target `x86_64-pc-windows-msvc`, and Node.

```powershell
.\scripts\build-release.ps1
```

The script builds the frontend and the release binary and drops everything
into `release/`. On Linux, `scripts/build-release.sh` does the same and
produces `release/rui-linux`.

## Architecture

The text buffer lives in the frontend (CodeMirror 6), Rust does file I/O,
encoding and settings. That keeps the Rust side thin, but caps the sensible
file size at around 25 MB — beyond that, Rui asks first.

| File | Responsibility |
|---|---|
| `src-tauri/src/document.rs` | Load/save, encoding detection, line endings |
| `src-tauri/src/settings.rs` | Settings and session restore |
| `src-tauri/src/lib.rs` | Plugins, command line, single instance |
| `src-tauri/src/omarchy.rs` | Omarchy theme detection (Linux) |
| `src-tauri/src/decoration.rs` | Window decoration |
| `src/editor.ts` | CodeMirror instance, a compartment per option |
| `src/theme.ts` | Sage palettes, light and dark |
| `src/languages.ts` | Language detection, each language its own lazy chunk |
| `src/palette.ts` | Command palette and input dialog |
| `src/settings-ui.ts` | Settings dialog, generated from a description |
| `src/main.ts` | Wiring, commands, shortcuts |

## Roadmap

- Tabs (the buffer model in `types.ts` is prepared for it)
- UI localisation (English first)
- Code signing for Windows, notarisation for macOS
- Auto-update — the updater plugin and its key have to ship in the bundle,
  so this needs deciding before the release that should benefit from it

## Contributing

Issues and pull requests are welcome. There is no formal process — open an
issue first for anything larger, so we do not both build the same thing.

Note that code comments and commit messages in this repository are in German.

## License

[MIT](LICENSE) © Jonas Gaiching
