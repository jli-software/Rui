# Rui

A small, fast text editor for Windows — the kind of thing Notepad++ was, with
Vim keybindings you can switch on or leave off.

Built because Windows Notepad stopped being enough and there is not much
between it and a full IDE. Rui opens a `.ps1`, a log or a diff instantly,
shows it properly coloured, and lets you edit it without loading a project,
an extension host or a language server. If you work with an AI agent and want
to actually read the snippets it produces before they go anywhere — that is
the case this was built for.

> **Note on language:** the user interface is German only.

![Rui editing a PowerShell script](assets/screenshots/rui.png)

<!-- Screenshot: rui.png — dark theme, a .ps1 open, status bar visible. -->

## Download

Latest build: [Releases](https://github.com/vikingjunior12/Rui/releases).

| File | What it is |
|---|---|
| `rui.exe` | portable, runs without installing |
| `rui-setup.exe` | NSIS installer (per-user) |
| `rui-setup.msi` | MSI, for Intune/GPO |
| `SHA256SUMS.txt` | checksums |

Not code-signed, so SmartScreen warns on first launch (*More info* → *Run
anyway*). Linux builds from source, see below; macOS is untested.

## What's in it

**Editing**

- Syntax highlighting for 16 languages, each loaded on demand: PowerShell,
  shell, Rust, C#, Go, Python, JS/TS, JSON, YAML, TOML, SQL, XML, INI,
  Markdown, diff, plain text. PowerShell cmdlets are recognised by their
  `Verb-Noun` shape, so `Get-MgUser` and `Get-ADUser` colour like
  `Get-ChildItem`
- Find and replace, go to line, undo/redo, bracket matching, auto-indent,
  code folding, line numbers (absolute or relative)
- Command palette on `Ctrl+Shift+P` instead of a menu bar
- Status bar you can click: position, language, encoding, line ending

**Files**

- **Saves only when told to.** `Ctrl+S`, or `:w`. Autosave exists as a
  setting and is off by default — opening a config file to read it must never
  change it
- Detects BOM and encoding on open, keeps the line ending, restores both on
  save. A Windows-1252 file with CRLF stays that way
- Crash-safe writes: temp file plus rename
- **Quick Open** on `Ctrl+O` — fuzzy search across your notes folder, any
  extra folders you configure, and the folder of the open file. Newest first,
  build output skipped
- Warns when another program changes the open file; restores unsaved buffers
  after a restart

**Vim keybindings**

Off by default, switched on in the settings, and loaded only if you use them.
Normal, insert, visual and replace mode, with the current one and any pending
input (`2d`) in the status bar.

`:w`, `:w <name>`, `:wq`, `:x`, `:saveas`, `:e`, `:e!`, `:q`, `:q!` and `:qa`
go through Rui's own save and open, so encoding and line endings survive them.
A write reports back in the status bar the way Vim reports in its command
line — which is where a buffer that got its name on save tells you that name.
`"+y` and `"+p` reach the system clipboard, as does `Ctrl+Shift+C` /
`Ctrl+Shift+V`.

The settings carry a reference of both Rui's own shortcuts and the essential
Vim motions — which makes this a reasonable place to learn the keys without
leaving Windows.

**System integration**

One section in the settings hooks Rui into the system and unhooks it again.
Nothing is written system-wide — it all lives under your user profile, no
administrator or root rights.

- **Windows** — puts the folder of the running `rui.exe` on the user `PATH`
  so `rui file.ps1` works from any terminal. The installer registers text,
  log, script and source file types so Rui shows up under *Open with*; a
  button leads to the page where you pick the default
- **Linux** — symlinks the binary into `~/.local/bin` for the same thing,
  and writes a `.desktop` entry so Rui appears in the file manager's *Open
  with*. Neither makes Rui the default; that stays your call

**Looks**

Sage palette in light and dark, following the system by default. On Linux it
picks up the active [Omarchy](https://omarchy.org) theme — syntax colours as
the theme means them, interface colours checked against the surface they land
on, because a terminal palette says what a theme calls "green" and nothing
about whether two of its colours stay readable side by side. Window decoration
is automatic: own title bar on Windows, none under a tiling compositor.

## Keyboard

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+O` | Quick Open |
| `Ctrl+Shift+O` | Open via system dialog |
| `Ctrl+N` / `Ctrl+S` / `Ctrl+Shift+S` | New / Save / Save as |
| `Ctrl+F` / `Ctrl+G` | Find and replace / Go to line |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | System clipboard |
| `Ctrl+I` | Settings |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Font size |

With Vim keybindings on, everything Vim binds works in the text area and
Rui's own `Ctrl` shortcuts keep working alongside it. Full list under
**Settings → Tastatur**.

## Not in it

No debugger, no build integration, no LSP, no completion, no terminal. Tabs
are planned for 0.4. The interface is German only.

## Build

```bash
npm install
npm run tauri dev              # run it
cd src-tauri && cargo test     # tests

.\scripts\build-release.ps1    # Windows: release/rui.exe + installers
./scripts/build-release.sh     # Linux:   release/rui-linux
```

Build through the Tauri CLI, not `cargo build --release`. The Cargo feature
`custom-protocol` — which only the CLI sets — decides whether the app serves
its frontend from the embedded `dist/` or from the dev server on
`localhost:1420`. A binary built without it starts on an error page.

### Install on Linux

```bash
./scripts/install-linux.sh              # build if needed, then install
./scripts/install-linux.sh --uninstall  # remove it again
```

Puts the binary in `~/.local/share/rui`, a symlink in `~/.local/bin` so
`rui file.txt` works in a terminal, icons in `~/.local/share/icons`, and a
`rui.desktop` entry so Rui shows up in the application launcher and under
*Open with*. No root, nothing outside your home directory. It does not make
itself the default editor — that stays your call:

```bash
xdg-mime default rui.desktop text/plain
```

The same registration is available from Rui's settings under *Linux*, for
when you run the binary from wherever you downloaded it.

Windows is built natively, not cross-compiled — WebView2 and the MSVC linker
make that unreliable from the outside. Needs the MSVC build tools, the
`x86_64-pc-windows-msvc` target and Node.

Settings live in `%APPDATA%/ch.gaiching.rui/settings.json`; defaults are in
`settings.rs`, not in the file. The settings dialog has a button that opens
it.

Stack: [Tauri 2](https://tauri.app) + [CodeMirror 6](https://codemirror.net)
+ Rust for file I/O, encoding and window behaviour. Code comments, commit
messages and `CHANGELOG.md` are in German.

## Licence

MIT — see [LICENSE](LICENSE).
