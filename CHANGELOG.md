# Changelog

Alle nennenswerten Änderungen an Rui stehen hier drin.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Geplant für 0.2
- Notiz-Titel und Autosave steuerbar (Titelquelle, Datumsformat, Verzögerung)
- NeoVim-Steuerung, abschaltbar — Normal-/Insert-/Visual-Modus
- Shortcut-Übersicht in den Einstellungen
- Tabs (Puffer-Modell in `types.ts` ist vorbereitet)

### Geplant, ohne Termin
- Theming, also frei wählbare Farben
- Lokalisierung der Oberfläche (zuerst Englisch)
- Code-Signing für Windows, Notarisierung für macOS
- Auto-Update — Updater-Plugin und Schlüssel müssen ins Bundle, muss also
  vor dem Release entschieden sein, das davon profitieren soll

## [0.1.2] — 2026-08-28

### Hinzugefügt
- Zahnrad unten rechts in der Statusleiste, öffnet die Einstellungen. Bis
  jetzt kam man nur über `Strg+,` oder die Befehlspalette dorthin — beides
  muss man kennen. Rui bleibt tastaturgetrieben, aber die eine Stelle, an
  der man das umstellt, soll man auch sehen können.
- Die Statusleiste hat rechts hinter einem Trenner eine Werkzeuggruppe
  bekommen. Dort landet, was etwas *tut*, statt etwas über die Datei
  auszusagen — heute das Zahnrad, später etwa die Schriftgrösse.

## [0.1.1] — 2026-08-28

### Geändert
- Icon in drei Grössenklassen aufgeteilt: die Seitenadern des Blatts laufen
  unter 48 px zu einem Streifen zusammen, bei 16 px teilt die Mittelrippe das
  Blatt optisch in zwei Hälften. Jede Klasse bekommt jetzt die Fassung, die
  auf ihr noch lesbar ist (`rui.svg`, `rui-small.svg`, `rui-tiny.svg`).
- Neues Script `scripts/build-icons.ps1` setzt `src-tauri/icons/` aus den
  SVG-Quellen neu zusammen (braucht ImageMagick 7).

### Behoben
- `build.rs` meldet cargo jetzt `rerun-if-changed=icons`. Vorher kannte
  tauri-build nur `tauri.conf.json` und die Capabilities als Abhängigkeit —
  eine geänderte Icon-Datei liess das Build-Script nicht neu laufen, und die
  EXE trug unter Windows stillschweigend weiter das alte Icon.

### Projekt
- Veröffentlichung unter MIT auf GitHub, englisches README, `CLAUDE.md` mit
  den Arbeitsregeln (Versionierung bei jeder Änderung, Changelog, Push).

## [0.1.0] — 2026-08-28

Erste Veröffentlichung.

### Hinzugefügt
- Editor auf CodeMirror 6 mit Zeilennummern und Syntaxhervorhebung für Rust,
  Go, Python, JSON, YAML, Markdown und weitere — jede Sprache als Lazy-Chunk
- Befehlspalette (`Strg+Umschalt+P`) statt Menüleiste, mit Tastenkürzeln
- Suchen und Ersetzen, Gehe-zu-Zeile, Schriftgrösse
- Encoding-Erkennung beim Öffnen (BOM und `chardetng`), Encoding und
  Zeilenende werden gemerkt und beim Speichern wiederhergestellt; beides
  über die Statusleiste umstellbar
- Absturzsicheres Speichern über temporäre Nachbardatei plus Rename
- Notizen-Ordner mit Instant-Save: laufendes Speichern ohne `Strg+S`,
  Dateiname aus der ersten Zeile, Umbenennen bei Titeländerung
- Einstellungsdialog, aus einer Beschreibung erzeugt; Defaults in
  `settings.rs`, Speicherort pro Plattform
- Sitzungswiederherstellung und Einzelinstanz
- Sage-Palette hell und dunkel, Omarchy-Theme-Erkennung unter Linux
- Dateiverknüpfungen für `txt`, `md`, `markdown`, `log`, `conf`, `ini`, `csv`
- Build-Scripts für Windows (`build-release.ps1`) und Linux
  (`build-release.sh`)

### Bekannte Einschränkungen
- Oberfläche nur auf Deutsch
- Builds sind unsigniert, SmartScreen warnt beim ersten Start
- Sinnvolle Dateigrösse bei rund 25 MB gedeckelt

[Unveröffentlicht]: https://github.com/vikingjunior12/Rui/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/vikingjunior12/Rui/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/vikingjunior12/Rui/releases/tag/v0.1.1
[0.1.0]: https://github.com/vikingjunior12/Rui/releases/tag/v0.1.0
