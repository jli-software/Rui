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
| `rui-setup.exe` | NSIS installer (per-user install) |
| `rui-setup.msi` | MSI, for deployment via Intune/GPO |
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
- **Manual saving by default** — Rui never writes a file you did not ask it
  to. Autosave exists, but it is a setting you turn on, not something a notes
  folder switches on behind your back. See below.
- **Notes folder** for buffers that do not have a name yet — see below
- **Quick Open** (`Ctrl+O`) lists every text file in the notes folder — notes,
  scripts, source files and logs alike — newest first, with fuzzy filtering
  and full keyboard navigation
- **Vim keybindings**, off by default and switchable from the settings —
  normal, insert, visual and replace mode, with the current one shown on the
  left of the status bar. `:w`, `:w <name>`, `:wq`, `:x`, `:saveas`, `:e` and
  `:q` go through Rui's own save, open and close, so encoding and line endings
  survive them. The whole thing is a lazy chunk: leave it off and it never
  loads.
- **Shortcut reference** inside the settings, split into Rui's always-active
  shortcuts and the essential Vim motions and commands.
- **Sage colour palette**, light and dark, plus automatic
  [Omarchy](https://omarchy.org) theme detection on Linux

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+N` / `Ctrl+S` | New / Save |
| `Ctrl+O` | Quick Open from the notes folder |
| `Ctrl+Shift+O` | Open another file with the system dialog |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+F` | Find and replace |
| `Ctrl+G` | Go to line |
| `Ctrl+,` | Settings |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Font size |

With Vim keybindings enabled, everything Vim binds works inside the text
area; Rui's own `Ctrl` shortcuts keep working alongside it. The same list,
plus a compact Vim reference, is available under **Settings → Keyboard**.

Everything else lives in the command palette.

## Saving

**Rui saves when you tell it to, and not before.** `Ctrl+S`, or `:w` with Vim
keybindings on. Open a file to read it, brush a key by accident, close the
window — the file on disk is untouched. An editor you cannot trust while
merely reading a config file is not usable as an editor.

Autosave is a setting, off by default. Turn it on and Rui writes the buffer
back half a second after the last keystroke (that delay is a setting too).
While it is on, the status bar says **Autosave**, because a file being written
without anyone pressing `Ctrl+S` is worth knowing about.

Autosave deliberately runs **without** the save transforms
(`trimTrailingWhitespace` / `ensureFinalNewline`) — those would wipe out a
space you just typed, mid-sentence. They stay reserved for explicit saves.

### Naming a file

A buffer that has no name yet gets one the way Vim does it:

```
:w profile.ps1        next to the file you currently have open
:w ~/scripts/x.sh     ~ is your home directory
:w C:	emp
otes.md   absolute paths work as given
:e other.ps1          open a sibling — or start a new buffer for that name
```

A relative name resolves against the folder of the open file, falling back to
the notes folder. Writing to a name that already exists asks first. Rui does
**not** derive filenames from the first line of the text any more: when you
are scripting, the first line is a shebang or a `#Requires`, and a file that
renames itself while you type is not a file you can work with.

Without Vim keybindings, `Ctrl+Shift+S` opens the ordinary save dialog.

## Notes folder

Pick a notes folder in the settings and `Ctrl+S` on an unnamed buffer puts it
there without asking for a location — named after the date, and never renamed
afterwards. The date format is a setting: `2026-08-28 1423`, `20260828-1423`,
`28.08.2026` and so on. It uses **local time**, fixed at the moment the buffer
was created, so a note begun at 23:58 is not dated tomorrow. Collisions
resolve the way Finder and Explorer do it, with an appended counter —
`Name (2).md` and so on.

`Ctrl+O` opens Rui's own file picker for this folder. It searches recursively,
starts with the most recently changed files, and is fully usable with typing,
arrow keys, `PageUp`/`PageDown`, `Home`/`End`, `Enter` and `Escape`. The folders
being searched are named in its header. **Open another file…** in its footer,
or `Ctrl+Shift+O`, keeps the native system dialog available for files
elsewhere.

Scripts and logs rarely live with your notes, so the settings take **any
number of extra search folders**, and the folder of the file you currently
have open is searched too — open one log by hand and its siblings are a
`Ctrl+O` away. Every entry names the folder it came from.

Everything Rui can highlight, it can also find: `.txt`, `.md`, `.ps1`, `.sh`,
`.rs`, `.cs`, `.py`, `.go`, `.json`, `.yaml` and the rest of the list, plus
log files — including rotated ones such as `deploy.log.3`. Build output stays
out of the way: `node_modules`, `target`, `dist`, `build`, `bin`, `obj` and
dot-folders like `.git` are skipped.

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
into `release/` under fixed names — `rui.exe`, `rui-setup.exe`,
`rui-setup.msi` — clearing the folder first, so it always holds exactly the
build you just made. On Linux, `scripts/build-release.sh` does the same and
produces `release/rui-linux`.

### Icons

The icon is drawn as three SVGs in `assets/logo/`, one per size class: the
leaf's side veins merge into a single stripe below 48 px, and at 16 px the
central rib splits the leaf in half. `scripts/build-icons.ps1` renders each
class from the fitting drawing and reassembles `src-tauri/icons/`
(ImageMagick 7 required).

Note that `build.rs` declares `cargo:rerun-if-changed=icons` — without it a
changed icon does not re-run the build script, and the executable silently
keeps the previously compiled Windows resource.

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
| `src/vim.ts` | Vim keybindings, ex commands, mode reporting (lazy chunk) |
| `src/settings-ui.ts` | Settings dialog, generated from a description |
| `src/main.ts` | Wiring, commands, shortcuts |

## Roadmap

- Tabs (the buffer model in `types.ts` is prepared for it)
- Theming beyond the two built-in palettes
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
