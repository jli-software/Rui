# Screenshots fürs README

Was hier liegt und wo es im README steht:

| Datei | Zeigt |
|---|---|
| `editor.png` | Hauptbild: PowerShell-Script, drei Reiter, einer mit dem Punkt für „geändert" |
| `shortcuts.png` | Die Kürzel-Übersicht (`Strg+K`) mit den Kategoriereitern |
| `quick-open.png` | Quick Open (`Strg+O`), gefiltert |
| `vim.png` | Visual-Line-Auswahl, Modus in der Statusleiste |
| `unsaved.png` | Der Dialog vor ungespeicherten Änderungen — helles Schema |
| `light.png` | Dieselbe Oberfläche im hellen Schema, TOML |

So sind sie entstanden, damit die nächsten dazu passen:

- Sage-Palette, **nicht** das Omarchy-Theme des eigenen Rechners: Rui mit
  einem eigenen `HOME` starten, in dem es kein `~/.local/state/omarchy` gibt.
  Sonst zeigt das Bild die Farben eines Themes und nicht die von Rui.
- Fenster rund 1344 × 862 Punkte auf einem Bildschirm mit Skalierung 2, also
  2688 × 1724 Pixel; fürs Repository auf 1600 px Breite herunterskaliert.
- Schriftgrösse 15, Zeilenhöhe 1.6 — bei den Vorgabewerten wird die Schrift
  im README zu klein.
- Dekoration auf `none`, damit kein Titelbalken das Bild oben abschneidet.
- Inhalte ohne echte Namen, Pfade oder Hostnamen aus dem Bildungszentrum.

Der Ordner liegt unter `assets/`, nicht unter `assets/logo/` — dort stehen
die Quell-SVGs fürs Icon, die `scripts/build-icons.ps1` verarbeitet.
