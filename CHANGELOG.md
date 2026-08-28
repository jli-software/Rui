# Changelog

Alle nennenswerten Änderungen an Rui stehen hier drin.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Geplant für 0.2
- Tabs (Puffer-Modell in `types.ts` ist vorbereitet)

### Geplant, ohne Termin
- Theming, also frei wählbare Farben
- Lokalisierung der Oberfläche (zuerst Englisch)
- Code-Signing für Windows, Notarisierung für macOS
- Auto-Update — Updater-Plugin und Schlüssel müssen ins Bundle, muss also
  vor dem Release entschieden sein, das davon profitieren soll

## [0.1.5] — 2026-08-28

### Hinzugefügt
- Neuer Abschnitt **„Tastatur"** in den Einstellungen: Ruis eigene Kürzel
  stehen links und gelten auch bei aktiver Vim-Steuerung. Rechts stehen die
  wichtigsten Vim-Griffe für Moduswechsel, Bewegung, Operatoren, Suche,
  Speichern und Schliessen.
- Die Rui-Liste entsteht aus denselben `shortcut`-Feldern wie die
  Befehlspalette. Ein neues oder geändertes Kürzel kann damit nicht zwischen
  Palette und Einstellungen auseinanderlaufen; nur die Befehlspalette selbst
  steht zusätzlich fest in der Übersicht.

### Projekt
- Für jede Version wird ab jetzt ein GitHub Release mit Binaries erstellt,
  ausdrücklich auch für Patch-Versionen. Ein getaggter Teststand soll direkt
  von der Release-Seite installierbar sein.

## [0.1.4] — 2026-08-28

### Hinzugefügt
- **Vim-Steuerung**, abschaltbar und standardmässig aus: Normal-, Insert-,
  Visual- und Replace-Modus, Operatoren, Register, Makros und die
  `:`-Befehle. Sie kommt von `@replit/codemirror-vim` statt aus eigener
  Hand — der volle Umfang ist genau das, woran man Vim lernen kann, und
  eine eigene halbe Nachbildung brächte einem falsche Griffe bei.
- Der Modus steht links in der Statusleiste, in Vims eigener Schreibweise
  (`NORMAL`, `INSERT`, `VISUAL LINE`) und mit wechselnder Farbe, weil beim
  Lernen vor allem eine Frage zählt: schreibt der nächste Tastendruck Text
  oder löst er einen Befehl aus? Daneben läuft die angefangene Eingabe mit
  — `2d` steht dort, solange der Befehl noch nicht vollständig ist.
- `:w`, `:wq`, `:x`, `:q`, `:q!` und `:qa` sind auf Ruis eigenes Speichern
  und Schliessen umgebogen. Schriebe Vim selbst, liefe es an
  `document.rs` vorbei und damit an Encoding-Erhalt und
  Zeilenende-Wiederherstellung — eine Windows-1252-Datei mit CRLF käme
  still als UTF-8 mit LF zurück. `:wq` schliesst nur, wenn das Speichern
  wirklich geklappt hat.
- Umschaltbar über die Einstellungen (Abschnitt „Eingabe") und über die
  Befehlspalette.

### Geändert
- Die Vim-Steuerung liegt als eigener Chunk (~124 kB) neben dem Editor und
  wird erst beim ersten Einschalten geladen. Wer sie nie anfasst, merkt
  nichts von ihr — Rui bleibt für alle anderen ein Notepad++.
- Der Blockcursor trägt Ruis Akzentfarbe und wechselt mit dem Farbschema.
  Das Vim-Paket bringt einen eigenen in kräftigem Rosa mit und hängt ihn
  mit höchster Priorität ein — dagegen kommt nur eine Regel mit
  `!important` an, und die steht deshalb in `vim.ts` statt im Editor-Theme.

## [0.1.3] — 2026-08-28

### Hinzugefügt
- Der Dateiname einer Notiz lässt sich jetzt zusammensetzen: erste Zeile,
  Datum, „Datum, dann erste Zeile" oder „erste Zeile, dann Datum". Ist die
  erste Zeile leer, springt überall das Datum ein — eine Notiz ohne Namen
  liesse sich sonst gar nicht anlegen.
- Datumsformat wählbar (`2026-08-28`, `2026-08-28 1423`, `20260828`,
  `20260828-1423`, `28.08.2026`). Vorgaben statt eines freien Musters: ein
  vertippter Formatstring erzeugt still danebenliegende Dateinamen, und ein
  Dateiname lässt sich nicht so leicht zurücknehmen wie eine Anzeige.
- Die Autosave-Verzögerung ist einstellbar (vorher fest 500 ms).

### Geändert
- Die Datumsnamen rechnen in **Lokalzeit** statt in UTC — dafür ist `chrono`
  dazugekommen, das über tauri ohnehin schon im Abhängigkeitsbaum lag. Eine
  Notiz, die um 23:30 entsteht, trug bisher das Datum des nächsten Tages im
  Namen, und ein Dateiname lässt sich schlechter korrigieren als eine
  Anzeige.
- Das Datum im Namen wird beim Anlegen der Notiz festgehalten, nicht bei
  jedem Speichern neu berechnet. Sonst wanderte eine Notiz, deren Titel man
  kurz nach Mitternacht ändert, auf den neuen Tag.
- Namenlose Notizen heissen nur noch nach dem Datum, ohne das
  vorangestellte „Notiz " — der Ordner sagt schon, dass es eine ist, und
  ein fest eingebautes deutsches Wort steht der Lokalisierung im Weg.

### Behoben
- Eine von Rui selbst benannte Notiz galt nach einem Neustart als von Hand
  geöffnet und wurde nie wieder umbenannt, obwohl sich ihre erste Zeile
  änderte. Die Sitzung merkt sich das jetzt.
- Die beiden Tests in `decoration.rs` teilten sich `RUI_DECORATION`, eine
  prozessweite Umgebungsvariable, liefen aber parallel in Threads. Der
  zweite sah gelegentlich die Variable des ersten und schlug scheinbar
  grundlos fehl. Sie wechseln sich jetzt ab.
- `cargo clippy` ist wieder ohne Warnungen: fünf handgeschriebene
  `Default`-Implementierungen sind durch `#[derive(Default)]` mit
  `#[default]` ersetzt.

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

[Unveröffentlicht]: https://github.com/vikingjunior12/Rui/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/vikingjunior12/Rui/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/vikingjunior12/Rui/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/vikingjunior12/Rui/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/vikingjunior12/Rui/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/vikingjunior12/Rui/releases/tag/v0.1.1
[0.1.0]: https://github.com/vikingjunior12/Rui/releases/tag/v0.1.0
