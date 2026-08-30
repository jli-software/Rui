<div align="center">

<img src="assets/logo/rui.svg" width="96" height="96" alt="">

# Rui

**A small, fast text editor for Windows and Linux**, with Vim keybindings
you can switch on or leave off.

[![Release](https://img.shields.io/github/v/release/vikingjunior12/Rui?style=flat-square&color=94b489&label=release)](https://github.com/vikingjunior12/Rui/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/vikingjunior12/Rui/release.yml?style=flat-square&color=94b489&label=build)](https://github.com/vikingjunior12/Rui/actions/workflows/release.yml)
[![Licence](https://img.shields.io/badge/licence-MIT-94b489?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-94b489?style=flat-square)](https://github.com/vikingjunior12/Rui/releases)

</div>

![Rui with a PowerShell script open](assets/screenshots/editor.png)

Windows Notepad was never enough, and there isn't much between it and a full
IDE. I work on Linux most of the time but need Windows for work, so Rui is
the same editor on both — a Neovim-style editor in a GUI, Vim keybindings
off by default. No debugger, no LSP, no completion, no terminal: just a
place to read and edit a script, a log, or the code an AI agent just handed
you, before it goes anywhere else.

## Install

**Linux** — one line, no repository, no root:

```bash
curl -fsSL https://raw.githubusercontent.com/vikingjunior12/Rui/main/install.sh | bash
```

Installs into your home directory and adds `rui file.txt` to your terminal.
Remove again with `~/.local/share/rui/install.sh --uninstall`.

**Windows** — from [Releases](https://github.com/vikingjunior12/Rui/releases):

| File | What it is |
|---|---|
| `rui-setup.exe` | NSIS installer (per-user) |
| `rui.exe` | portable, runs without installing |
| `rui-setup.msi` | MSI, for Intune/GPO |

Not code-signed, so SmartScreen warns on first launch (*More info* → *Run
anyway*). macOS is untested.

## Features

- Syntax highlighting for 16 languages, loaded on demand
- Find & replace, go to line, undo/redo, folding, line numbers
- Command palette (`Ctrl+Shift+P`) instead of a menu bar
- System clipboard shortcuts, word wrap toggle (`Alt+Z`)
- Clickable status bar — file name, position, language, encoding

![The shortcut sheet, split into category tabs](assets/screenshots/shortcuts.png)

`Ctrl+K` opens a searchable shortcut sheet, grouped by category — with the
Vim commands listed too, when Vim mode is on.

![Quick Open, filtering the notes folder](assets/screenshots/quick-open.png)

- **Tabs**, each keeping its own cursor, folds and undo history
- **Rename in the tab** — `F2` or double click the name
- **Quick Open** (`Ctrl+O`) — fuzzy search across your folders
- Saves only when told to — `Ctrl+S` or `:w`, autosave is opt-in

![The dialog before unsaved changes are lost](assets/screenshots/unsaved.png)

Every question Rui asks happens inside the window, in Rui's own colours —
never a system dialog landing somewhere else.

![Visual line mode, with the mode in the status bar](assets/screenshots/vim.png)

Vim keybindings, off by default: normal, insert, visual and replace mode,
with the mode shown in the status bar. `:w`, `:wq`, `:tabnew`, `:set number`
and friends go through Rui's own save and open, so encoding survives them.

![The same editor in the light palette](assets/screenshots/light.png)

Sage palette, light and dark, follows the system — and on Linux, the active
[Omarchy](https://omarchy.org) theme.

## Keyboard

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+O` | Quick Open |
| `Ctrl+N` / `Ctrl+S` / `Ctrl+Shift+S` | New / Save / Save as |
| `F2` | Rename the file |
| `Ctrl+F` / `Ctrl+G` | Find and replace / Go to line |
| `Ctrl+Shift+C` / `Ctrl+Shift+A` / `Ctrl+Shift+V` | Copy selection / Copy whole file / Paste |
| `Alt+Z` | Word wrap on or off |
| `Ctrl+T` / `Ctrl+W` / `Ctrl+Tab` | New tab / Close tab / Next tab |
| `Ctrl+K` | Keyboard shortcuts |
| `Ctrl+I` | Settings |

With Vim keybindings on, everything Vim binds works in the text area
alongside Rui's own `Ctrl` shortcuts — `Ctrl+K` shows the full list.

## Build

```bash
npm install
npm run tauri dev              # run it
cd src-tauri && cargo test     # tests
```

Build through the Tauri CLI, not `cargo build --release` — a plain Cargo
build loads the dev server instead of the bundled frontend.

Stack: [Tauri 2](https://tauri.app) + [CodeMirror 6](https://codemirror.net)
+ Rust for file I/O, encoding and window behaviour.

## Licence

MIT — see [LICENSE](LICENSE).
