# Screenshots fürs README

Was hier liegt und wo es im README steht:

| Datei | Zeigt |
|---|---|
| `editor.png` | Hauptbild: PowerShell-Script, drei Reiter, einer mit dem Punkt für „geändert" |
| `quick-open.png` | Quick Open (`Strg+O`), nach `deploy` gefiltert |
| `unsaved.png` | Der Dialog vor ungespeicherten Änderungen — helles Schema |
| `shortcuts.png` | Die Kürzel-Übersicht (`Strg+K`) mit den Kategoriereitern |
| `vim.png` | Visual-Line-Auswahl, Modus in der Statusleiste |
| `light.png` | Dieselbe Oberfläche im hellen Schema, TOML |
| `omarchy-themes.gif` | Themenwechsel zur Laufzeit: Tokyo Night, Gruvbox, Everforest, Kanagawa, Catppuccin Latte, Nord |

Die Dateien, die auf den Bildern offen sind, liegen unter `sample/`. Sie sind
generisch und ohne Bezug zu einem Arbeitgeber — wer die Bilder neu aufnimmt,
nimmt dieselben und bekommt dieselben Zeilennummern.

## So sind sie entstanden

- **Sage-Palette, nicht das Omarchy-Theme des eigenen Rechners** (gilt für die
  sechs PNG): Rui mit einem eigenen `HOME` starten, in dem es kein
  `~/.local/state/omarchy` gibt. Sonst zeigt das Bild die Farben eines Themes
  und nicht die von Rui. Fürs GIF genau umgekehrt: in dieses `HOME` einen
  Symlink auf das echte `~/.local/state/omarchy` legen.
- Ein zweites Rui neben dem laufenden gibt es nur über eine eigene
  Session-Bus-Instanz — `dbus-run-session -- rui …`, sonst reicht das
  Single-Instance-Plugin die Dateien an die schon laufende Instanz weiter.
- Fenster rund 1344 × 862 Punkte auf einem Bildschirm mit Skalierung 2, also
  2688 × 1724 Pixel; fürs Repository auf 1600 px Breite herunterskaliert.
  Unter Hyprland: Fenster floaten lassen, exakt auf diese Grösse setzen und
  unter die Leiste schieben, sonst schneidet die Bar das Bild oben an.
- **Omarchy blendet jedes Fenster leicht durch** (`opacity 0.985 0.96`), und
  dann steht das Hintergrundbild im Editor. Für die Aufnahme
  `o.window({ class = "rui" }, { opacity = "1 1" })` setzen und danach wieder
  auf den Standardwert zurück.
- Benachrichtigungen liegen über dem Fenster und landen mit im Bild.
  `omarchy-notification-dismiss <text>` räumt eine weg.
- Schriftgrösse 15, Zeilenhöhe 1.6 — bei den Vorgabewerten wird die Schrift
  im README zu klein.
- Dekoration auf `none`, damit kein Titelbalken das Bild oben abschneidet.
- Inhalte ohne echte Namen, Pfade oder Hostnamen aus dem Bildungszentrum.

Fürs GIF pro Theme ein Einzelbild mit `grim` statt einer Bildschirmaufnahme:
`omarchy-theme-set <Name>`, gut zwei Sekunden warten, aufnehmen. Das gibt
scharfe Frames statt Videokompression. Danach mit `ffmpeg` und
`palettegen=stats_mode=single` zusammensetzen — eine gemeinsame Palette über
sechs Themen hinweg reicht für Text nicht.

Der Ordner liegt unter `assets/`, nicht unter `assets/logo/` — dort stehen
die Quell-SVGs fürs Icon, die `scripts/build-icons.ps1` verarbeitet.
