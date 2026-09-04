# README screenshots

Files in this directory and where they appear in the README:

| File | Shows |
|---|---|
| `editor.png` | Hero image: a PowerShell script, three tabs, one marked as modified |
| `quick-open.png` | Quick Open (`Ctrl+O`) filtered by `deploy` |
| `unsaved.png` | The unsaved-changes dialog in the light palette |
| `shortcuts.png` | The shortcut reference (`Ctrl+K`) and its category tabs |
| `vim.png` | Visual Line selection and the mode in the status bar |
| `light.png` | The same interface in the light palette, showing TOML |
| `omarchy-themes.gif` | Live theme switching through Tokyo Night, Gruvbox, Everforest, Kanagawa, Catppuccin Latte and Nord |

The files visible in the screenshots live under `sample/`. They are generic
and contain no employer-specific data. Reusing them keeps line numbers stable
between captures.

## Capture setup

- **Use the Sage palette, not the workstation's Omarchy theme** for the six
  PNG files. Start Rui with a separate `HOME` that has no
  `~/.local/state/omarchy`. Do the opposite for the GIF: link the real Omarchy
  state directory into that isolated home.
- Run the second Rui instance on a separate session bus with
  `dbus-run-session -- rui …`; otherwise the single-instance plugin forwards
  files to the already running instance.
- Use a window around 1344 × 862 logical pixels on a scale-2 display, then
  resize the capture to 1600 pixels wide. On Hyprland, float the window and
  place it below the bar before capturing.
- Omarchy applies slight window transparency (`opacity 0.985 0.96`). Override
  it with `o.window({ class = "rui" }, { opacity = "1 1" })` for screenshots,
  then restore the default.
- Dismiss notifications before capturing because they appear above the app.
- Use font size 15 and line height 1.6; the defaults are too small in the
  rendered README.
- Set decorations to `none` so no title bar is cropped into the image.
- Keep all visible content free of real names, paths and host names.

For the GIF, capture one sharp frame per theme with `grim` after running
`omarchy-theme-set <Name>` and waiting about two seconds. Assemble the frames
with `ffmpeg` and `palettegen=stats_mode=single`; one shared palette across all
six themes does not preserve text well.

This directory belongs under `assets/`, not `assets/logo/`, which contains the
source SVG files processed by `scripts/build-icons.ps1`.
