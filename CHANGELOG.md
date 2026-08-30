# Changelog

Alle nennenswerten Änderungen an Rui stehen hier drin.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Geplant
- Kürzel nicht nur zeigen, sondern umstellen können
- Tabs umsortieren, Kontextmenü („Andere schliessen", „Rechts schliessen")
- Weitere `:set`-Optionen — `:set list`, `:set tabstop`, `:set expandtab`

### Geplant, ohne Termin
- Theming, also frei wählbare Farben
- Lokalisierung der Oberfläche (zuerst Englisch)
- Code-Signing für Windows, Notarisierung für macOS
- Auto-Update — Updater-Plugin und Schlüssel müssen ins Bundle, muss also
  vor dem Release entschieden sein, das davon profitieren soll

## [0.5.3] — 2026-08-30

### Geändert
- **README neu geschrieben, deutlich kürzer.** Der Einstieg erzählt jetzt,
  warum es Rui gibt — Windows Notepad reichte nie, Notepad++ passte nie
  richtig, gearbeitet wird meist unter Linux, aber Windows lässt sich für
  die Arbeit nicht vermeiden: Rui ist derselbe Editor auf beiden, im Kern
  ein Neovim in GUI-Form, Vim-Steuerung per Vorgabe aus. Die langen
  Absätze unter jedem Feature (Fuzzy-Suche-Algorithmus, Flexbox-Details,
  Registernamen) sind raus, die sechs Screenshots und ihre kurzen
  Bildunterschriften bleiben. Der eigene „Not in it"-Abschnitt ist in den
  Einstiegstext gewandert, der Hinweis „Oberfläche nur Deutsch" ist raus,
  weil er mit der geplanten Lokalisierung ohnehin bald überholt ist.

## [0.5.2] — 2026-08-30

### Hinzugefügt
- **Ein Reiter lässt sich umbenennen — mit Doppelklick auf den Namen.** Der
  Name wird zum Eingabefeld, Enter übernimmt, Esc lässt es bleiben.
  Vorausgewählt ist der Name ohne Endung: Wer umbenennt, meint fast immer
  den Namen, und eine Endung, die beim ersten Tastendruck mitverschwindet,
  nähme der Datei ihre Sprache. Umbenannt wird **auf der Platte**, im selben
  Ordner — ein Reiter, der anders heisst als die Datei darunter, wäre genau
  die Sorte Anzeige, der man nicht trauen kann. Ein bestehender Name wird
  nicht überschrieben, ein Pfad im Feld nicht angenommen: Verschieben ist
  „Speichern unter", nicht Umbenennen. Abgewiesen werden ausserdem die
  Zeichen, die Windows im Dateinamen verbietet, unsichtbare Steuerzeichen
  und Namen aus lauter Punkten. Die Spracherkennung zieht mit, aus `.txt`
  wird `.ps1` und die Farben stimmen sofort.
- **`F2` und „Datei → Umbenennen…" in der Palette** öffnen dasselbe Feld im
  Reiter, damit beide Wege dasselbe Bild ergeben. Bei einer einzigen
  offenen Datei ist die Reiterleiste verborgen — dann fragt stattdessen ein
  Eingabefeld in der Mitte, denn ein Feld, das niemand sieht, wäre schlicht
  ein hängender Editor. Danach liegt der Fokus wieder im Text.
- **Ein neuer Filter „Markieren" in der Kürzel-Übersicht** — vierzehn Zeilen
  rund um `v`, `V` und `Strg+V`, samt Textobjekten (`viw`, `vi"`, `vip`) und
  dem, was danach auf die Auswahl wirkt. Sie standen bisher verstreut in
  „Modus" und „Bearbeiten", also genau dort, wo niemand sie sucht.
- **Die Gruppe „Bewegen" ist von zehn auf achtzehn Zeilen gewachsen.** Neu
  darin: `W`/`B`/`E` (an Leerzeichen statt an Wortzeichen getrennt), Absatz
  und Satz (`}`/`{`, `)`/`(`), `t<z>`/`T<z>`, `;`/`,`, Marken (`m<a>`, `` `a ``)
  sowie `` `` `` und `` `. `` — der Weg zurück, wenn der Cursor woanders
  gelandet ist als gedacht. Bei zwei Zeilen steht dabei, dass Rui das Kürzel
  belegt: `Strg+F` gehört hier der Suche, `Strg+O`/`Strg+I` der Oberfläche.
- **`:set wrap`, `:set number` und `:set relativenumber`** legen jetzt Ruis
  eigene Einstellungen um — mit `no…`, `…!` und `…?` und den Kurznamen `nu`
  und `rnu`. Was so geschaltet wird, steht danach auch im
  Einstellungsdialog und überlebt den Neustart. `:set rnu` schaltet die
  Nummernspalte gleich mit ein, sonst wären relative Nummern unsichtbar.
  Angebunden über `defineOption` statt über einen eigenen `:set`-Befehl —
  damit bleibt alles erhalten, was das Vim-Paket sonst noch unter `:set`
  kennt.
- **Der Tabulator wechselt die Kategorie in der Kürzel-Übersicht.** Im
  Overlay war er bisher arbeitslos, und an die Reiter kam man nur mit der
  Maus.
- **Sechs Screenshots im README**, dazu Logo und Badges. Der Ordner
  `assets/screenshots/` beschreibt, wie sie entstanden sind — mit eigenem
  `HOME`, damit die Sage-Palette im Bild steht und nicht das Omarchy-Theme
  des Rechners, auf dem gerade fotografiert wurde.

### Geändert
- **Rückfragen kommen jetzt aus Rui selbst, nicht mehr vom System.** Sieben
  Stellen — Reiter schliessen, Fenster schliessen, `:q`, Datei überschreiben,
  grosse Datei öffnen, extern geänderte Datei, Einstellungen zurücksetzen —
  sowie alle Fehlermeldungen. Unter einem Kachel-Compositor war der
  System-Dialog ein fremdes, ungestyltes Fenster, das nicht einmal sicher
  über Rui landete.
- **Die Frage nach ungespeicherten Änderungen hat drei Antworten:
  Speichern, Verwerfen, Abbrechen.** Ein System-Dialog kennt nur zwei — wer
  eigentlich speichern wollte, musste abbrechen, `Strg+S` drücken und noch
  einmal schliessen. Enter liegt auf „Speichern", Esc auf „Abbrechen"; beide
  Tasten tun damit das, was nichts vernichtet. Beim Schliessen des Fensters
  mit mehreren geänderten Reitern heisst der erste Knopf „Alle speichern"
  und schreibt sie der Reihe nach; bricht einer ab, bleibt das Fenster
  offen, statt den Rest stillschweigend zu verlieren.
- **Wird ein Reiter geschlossen, der nicht der sichtbare ist, wechselt Rui
  vorher zu ihm.** Beim Mittelklick auf einen Reiter daneben stand die Frage
  bisher über einer Datei, die gar nicht auf dem Bildschirm war.
- **Der Punkt für „ungespeichert" steht vor dem Namen statt im
  Schliessen-Knopf.** Dort war er nicht als Zustand zu lesen, sondern als
  Knopfbeschriftung — und beim Überfahren wurde er zum Kreuz, also
  ausgerechnet dann unsichtbar, wenn die Maus in der Nähe war. Er steht
  jetzt links vom Namen, an derselben Stelle wie in der Statusleiste, und
  ist immer im Layout: ungeändert nur unsichtbar, damit der Reiter beim
  ersten Tastendruck nicht in der Breite springt.
- **Die Kategorie in der Kürzel-Übersicht bleibt beim Tippen stehen.** Bis
  0.5.1 sprang die Liste auf „Alle" zurück, sobald jemand tippte — das
  Eingrenzen einer Kategorie war damit unmöglich. Damit eine Suche trotzdem
  nie stumm in einer Kategorie hängen bleibt, steht unter der Liste, wie
  viele Treffer daneben liegen, und ein Klick darauf zeigt sie.
- **Aus „Dateien und Reiter" ist „Befehlszeile (:)" geworden**, von neun auf
  zwanzig Zeilen. Die Gruppe bestand ohnehin nur aus Ex-Befehlen; jetzt
  stehen auch `:42`, `:%s`, `:'<,'>s`, `:noh`, `:reg` und die neuen
  `:set`-Befehle darin. Damit beantwortet ein Reiter die Frage „welche
  `:`-Befehle gibt es hier eigentlich".
- **„Modus" heisst „Modus wechseln"** und enthält nur noch das Umschalten
  zwischen den Modi. Die Auswahlbefehle sind nach „Markieren" gezogen. Der
  alte Name klang nach „was kann ich im Normalmodus", stand aber über
  `i`, `a` und `o`.

### Behoben
- Ein offener Dialog und ein Reiter, dessen Name gerade bearbeitet wird,
  halten die Tastenkürzel fern. Ruis Tastaturhaken hängt mit `capture` am
  Fenster und kam sonst zuerst dran — `Strg+W` hätte den Reiter geschlossen,
  während die Frage, ob er geschlossen werden darf, noch auf dem Bildschirm
  stand.

## [0.5.1] — 2026-08-29

### Hinzugefügt
- **Der Dateiname steht jetzt in der Statusleiste**, rechts vor Zeile und
  Spalte und in der Textfarbe, während alles daneben gedämpft bleibt. Er
  stand bisher nur im Fenstertitel — und den gibt es unter Hyprland ohne
  Dekoration gar nicht, bei zwei Rui-Fenstern nebeneinander erst recht
  nicht gut lesbar. Ein `•` davor markiert ungespeicherte Änderungen, der
  Mauszeiger zeigt den ganzen Pfad, und ein Klick legt ihn in die
  Zwischenablage.
- **„Über Rui"**, erreichbar über das Info-Symbol in der Statusleiste und
  über die Befehlspalette. Darin stehen Version, Entwickler (jli software),
  Lizenz, das Repository und der Unterbau; „Angaben kopieren" legt Version,
  Tauri-Version und Webview-Kennung als Block in die Zwischenablage — die
  Zeilen, mit denen ein Fehlerbericht anfängt. Die Zahlen werden zur
  Laufzeit aus dem Bundle gelesen, stimmen also auch dann, wenn ein
  Installer vom letzten Halbjahr im Ordner liegt.
- **Die Kürzel-Übersicht hat Kategoriereiter.** Mit eingeschalteter
  Vim-Steuerung standen dort über achtzig Zeilen am Stück; die Reiter
  schneiden die Liste auf eine Gruppe herunter, die Suche bleibt der Weg
  quer durch alle. Wer tippt, landet automatisch wieder bei „Alle" — eine
  Suche, die stumm in einer Kategorie hängen bleibt, sieht aus wie „gibt
  es nicht".
- **Die Zwischenablage-Gruppe der Übersicht ist von drei auf fünfzehn
  Zeilen gewachsen.** Neu stehen darin unter anderem `:%y+` für die ganze
  Datei, `:10,20y+` für einen Zeilenbereich, `:.,$y+` ab dem Cursor,
  `:'<,'>y+` für die Auswahl, `"+d` fürs Ausschneiden, `ggVG` gefolgt von
  `"+y` und `:reg`. Alles Normalmodus-Befehle, die Rui längst konnte — sie
  standen nur nirgends.
- **`Strg+Umschalt+A` kopiert die ganze Datei in die Zwischenablage**, für
  alle, die die Vim-Steuerung nicht anhaben. Der Befehl steht auch in der
  Palette.
- **`Alt+Z` schaltet den Zeilenumbruch**, wie in VS Code — der einzige
  Kurzbefehl ohne `Strg`. Zum Lesen einer fremden Logdatei umlegen, zum
  Schreiben zurück; der Weg über die Einstellungen war dafür zu weit.

### Geändert
- **Das Kopieren meldet sich.** `Strg+Umschalt+C` sagt jetzt „12 Zeilen
  kopiert" statt gar nichts, und bei leerer Auswahl „Nichts ausgewählt"
  statt stillschweigend nichts zu tun. Ein Kürzel, das schweigt, sieht aus
  wie eines, das nicht ankommt.
- **Die Marke „Geändert" ist aus der linken Hälfte verschwunden.** Der `•`
  vor dem Dateinamen sagt dasselbe auf einem Zehntel der Breite; in einem
  halbbreiten Fenster stand vorher „Geänder…" neben „• Un…", also zwei
  halbe Wörter statt einer Auskunft. „Schreibgeschützt" und „Autosave"
  bleiben, wo sie waren.
- **Die Statusleiste hat jetzt eine Rangfolge, wenn der Platz knapp wird.**
  Zuerst schrumpft die Zeilenzahl, dann die Kurzmeldung, die ohnehin nach
  zwei Sekunden verschwindet. Dateiname, Marken und die Werkzeuge rechts
  geben nie nach — vorher war das Zahnrad in einem schmalen Fenster als
  Erstes weg.

### Behoben
- **„Im Dateimanager zeigen" und „settings.json öffnen" waren wirkungslos.**
  Beide liefen über `openPath`, das die Berechtigung `opener:default` gar
  nicht abdeckt — der Aufruf wurde also stumm abgewiesen. „Im Dateimanager
  zeigen" nimmt jetzt `revealItemInDir` und markiert die Datei gleich mit,
  und `opener:allow-open-path` steht in den Berechtigungen.

## [0.5.0] — 2026-08-29

### Hinzugefügt
- **Tastenkürzel-Übersicht auf `Strg+K`**, dazu ein Tastatur-Symbol links
  neben dem Zahnrad in der Statusleiste. Dieselbe Taste schliesst sie
  wieder, `Esc` ebenso, und ein Suchfeld filtert die Liste.

  Ist die Vim-Steuerung an, stehen deren Befehle oben und ausführlich da —
  nach Modus, Bewegen, Bearbeiten, Suchen, Zwischenablage sowie Dateien und
  Reitern geordnet, an NeoVim ausgerichtet. Die Rui-Kürzel folgen darunter
  und kommen aus derselben Befehlsliste wie die Palette: Ein neuer Befehl
  mit Kürzel steht damit ohne Zutun auch hier.
- **Rui-Kürzel, die eine NeoVim-Bindung verdecken, sagen es jetzt selbst.**
  Neben `Strg+O`, `Strg+I`, `Strg+F`, `Strg+W`, `Strg+N`, `Strg+T` und
  `Strg+G` steht in der Übersicht, was dieselbe Taste in NeoVim täte. Die
  Kürzel bleiben, wie sie sind — Rui ist ein Editor mit Vim-Steuerung, nicht
  umgekehrt —, aber wer aus NeoVim kommt, greift genau dort daneben.
- Der Dateiöffner zeigt im Kopf, wie viele Dateien es gibt und wie viele
  davon die Eingabe trifft, und markiert in jeder Zeile die Zeichen, auf die
  sie passt.

### Geändert
- **Der Dateiöffner (`Strg+O`) zeichnet nur noch die sichtbaren Zeilen.**
  Vorher entstanden bei jedem Tastendruck bis zu 500 Zeilen neu, jede mit
  vier Kindelementen — bei einem grossen Notizordner war das der Grund,
  warum sich das Tippen zäh anfühlte. Damit fällt auch die Obergrenze weg:
  Der zwölftausendste Treffer ist jetzt mit `Ende` genauso erreichbar wie
  der erste, und die Zeile „… und N weitere" ist überflüssig geworden.
- **Die Suche arbeitet nur noch mit vorbereiteten Daten.** Klein
  geschriebene Namen und Pfade entstehen einmal beim Laden statt
  zwanzigtausendmal pro Anschlag. Verlängert die Eingabe die vorige, wird
  ausserdem nur noch in deren Treffern gesucht: Was `deplo` nicht enthält,
  kann `deploy` erst recht nicht enthalten.
- **Ein Treffer im Dateinamen schlägt jeden Treffer im Pfad.** Wer `deploy`
  tippt, sucht `deploy.ps1` — nicht die zwölf Dateien im Ordner `deploy/`.
- **Das Durchsuchen der Ordner läuft nicht mehr auf dem Thread der
  Oberfläche.** Ein synchroner Tauri-Befehl blockiert das Fenster; ein
  Notizordner mit ein paar tausend Dateien — oder einer auf einem
  Netzlaufwerk — liess den Öffner damit erst aufgehen, wenn schon alles
  gelesen war. Jetzt steht er sofort da, und die zuletzt gelesene Liste ist
  währenddessen schon zu sehen.
- **Normal- und Einfügemodus sind endlich auseinanderzuhalten.** Die
  Plakette unterscheidet nicht mehr nur im Farbton, sondern in der Form:
  Normal ist leer umrandet und leise, jeder andere Modus ausgefüllt — Grün
  schreibt, Violett wählt aus, Rot überschreibt. In Omarchy-Themen sind
  `accent` und `blue` regelmässig **dieselbe** Farbe; die Anzeige wechselte
  bisher also sichtbar gar nicht, und genau daran tippt man sich in den
  falschen Modus.
- Die Tastenkürzel sind aus den Einstellungen verschwunden. Kürzel sind
  nichts, was man einstellt, sondern etwas, das man mitten in der Arbeit
  nachschlägt — dafür ist `Strg+K` der richtige Ort, nicht ein Abschnitt
  drei Bildläufe tief in einem Dialog.

### Behoben
- **Nach dem Schliessen der Einstellungen oder der Befehlspalette landete
  der nächste Tastendruck nirgendwo.** Der Fokus blieb im versteckten
  Dialog hängen, `document.activeElement` fiel auf `<body>` zurück — der
  Editor wirkte eingefroren, bis man hineinklickte. Wer dabei die
  Vim-Steuerung eingeschaltet hatte, hielt naheliegenderweise die für
  kaputt. Jeder Overlay-Schluss gibt den Fokus jetzt an den Text zurück.
- Im Dateiöffner sprang die Auswahl beim Tippen auf die Zeile unter dem
  Mauszeiger, auch wenn niemand die Maus bewegt hatte: Unter dem stehenden
  Zeiger entstanden neue Elemente, und die lösten `mouseenter` aus. Die
  Auswahl folgt der Maus jetzt nur noch bei echter Bewegung.

## [0.4.0] — 2026-08-29

### Hinzugefügt
- **Tabs.** Rui hält mehrere Dateien gleichzeitig offen, jede in ihrem
  Reiter über dem Text. Der Reiter zeigt den Dateinamen, den vollen Pfad im
  Tooltip und einen Punkt statt des Kreuzes, solange etwas ungespeichert
  ist.

  | Griff | Wirkung |
  |---|---|
  | `Strg+T`, `Strg+N` | neuer Tab |
  | `Strg+W` | Tab schliessen |
  | `Strg+Tab`, `Strg+Umschalt+Tab` | einen weiter, einen zurück |
  | `Strg+1` … `Strg+8` | direkt dorthin |
  | `Strg+9` | der letzte |
  | Mittelklick | Tab schliessen |

  Die Leiste bleibt verborgen, solange nur eine Datei offen ist: Wer Rui
  wie bisher für eine Datei benutzt, bezahlt dafür keine Zeile Höhe.
- **Jeder Tab behält seinen vollen Editorzustand** — Cursor, Auswahl,
  Faltung und die Undo-Historie. Zurückwechseln heisst weitermachen und
  nicht neu öffnen; `Strg+Z` reicht in einem Tab so weit zurück wie vor
  dem Wechsel.
- **Vim kennt die Reiter**: `:tabnew [datei]`, `:tabe`, `:tabn`, `:tabp`,
  `:tabc` sowie `:bn`, `:bp` und `:bd`, die in Rui auf dasselbe zeigen —
  ein Reiter hält genau einen Puffer. `:q` schliesst wie in Vim den
  Reiter und erst beim letzten das Fenster; `:qa` beendet immer.
- **Die Sitzung merkt sich alle Tabs**, nicht mehr nur den zuletzt
  offenen: Reihenfolge, aktiver Reiter, Cursor, Scrollstand,
  ungespeicherter Inhalt und eine von Hand gewählte Sprache. Eine
  Sitzungsdatei aus 0.3.x wird beim ersten Start übernommen und ihr
  einzelner Puffer zum ersten Tab.
- **`rui a.ps1 b.ps1` öffnet beide.** Bis 0.3.10 fiel alles ausser der
  ersten Datei still unter den Tisch — dasselbe galt für mehrere Dateien
  aus dem Dateimanager, per Drag-and-drop oder über eine zweite Instanz.
  Der Dateidialog erlaubt jetzt ebenfalls eine Mehrfachauswahl.

### Geändert
- **Eine bereits offene Datei öffnet sich nicht ein zweites Mal**, Rui
  springt zu ihrem Reiter. Zwei Tabs auf dieselbe Datei hiessen, dass der
  eine beim Speichern den anderen überschreibt. Unter Linux entscheidet
  dabei die Gross- und Kleinschreibung mit, unter Windows nicht — genau
  wie beim Dateisystem darunter.
- **`Strg+N` legt einen Tab an, statt den Puffer zu ersetzen.** Der Griff
  hat damit dieselbe Wirkung wie `Strg+T`; „Neu" heisst mit Reitern nicht
  mehr „das hier weg".
- **Eine geöffnete Datei landet in einem neuen Reiter** — aus Quick Open,
  dem Dateidialog, per Drag-and-drop oder aus einer zweiten Instanz. Nur
  Vims `:e` ersetzt weiterhin den Puffer im sichtbaren Reiter, wie es das
  in Vim auch tut. Ist der aktive Reiter leer und unberührt, wird er
  benutzt statt daneben ein zweiter aufgemacht.
- **Beim Schliessen eines Reiters wird gefragt**, wenn er Ungespeichertes
  enthält — auch bei eingeschalteter Sitzungswiederherstellung. Anders als
  beim Fenster fängt die Sitzung hier nichts auf: Sie merkt sich, was
  offen ist, und ein geschlossener Reiter ist es nicht mehr.
- **`Strg+W` auf dem letzten Reiter leert ihn, statt Rui zu beenden.** Wer
  aus dem Browser kommt, erwartet kein Programmende; wer `:q` tippt, genau
  das — und bekommt es auch.

## [0.3.10] — 2026-08-29

### Geändert
- **Im Titel eines Releases steht immer die Versionsnummer.** 0.3.9 hiess auf
  der Release-Seite nur „English release notes" — welche Fassung dahinter
  liegt, stand allein am Tag daneben. Der Titel folgt jetzt dem Muster
  `Rui <version> — <Name der Änderung>`; ein reiner Fehlerbehebungs-Release
  heisst schlicht `Rui <version> — Hotfix`, ein grösserer bekommt einen
  eigenen Namen. Fehlt die Nummer in der Beschriftung des Tags, stellt der
  Workflow sie voran, statt den fertigen Build abzubrechen.

## [0.3.9] — 2026-08-29

### Geändert
- **Die Release-Seite spricht Englisch.** Titel und Notiz eines Releases
  kommen jetzt aus der Beschriftung des Tags statt aus dem Changelog: erste
  Zeile der Titel — der Name der Änderung, zwei bis fünf Wörter, ohne
  Versionsnummer —, der Rest ein bis drei Sätze dazu. Der ausführliche
  Changelog bleibt deutsch und hängt als Link unter jeder Release-Notiz.
  Wer bei GitHub auf Rui stösst, liest dieselbe Sprache wie im README; die
  Vorgeschichte findet, wer sie sucht.
- **`CLAUDE.md` und `AGENTS.md` sind nicht mehr eingecheckt.**
  Arbeitsanweisungen für KI-Agenten gehören zum Arbeitsplatz, nicht ins
  Produkt — im öffentlichen Repository hätten sie nur den Effekt, dass jeder
  Fork sie mitschleppt.

## [0.3.8] — 2026-08-29

### Behoben
- **Über dem Release stand die Commit-Message statt des Tag-Titels.**
  `actions/checkout` legt den Tag im Klon als blosses Etikett auf dem Commit
  an, ohne das annotierte Objekt dahinter — `%(contents:subject)` greift dann
  auf die Commit-Message durch, und die beschreibt den letzten Handgriff, nicht
  die Version. Der Release-Auftrag holt das Tag-Objekt jetzt nach und prüft,
  dass es eines ist, bevor er dessen Beschriftung als Titel nimmt.

## [0.3.7] — 2026-08-29

### Hinzugefügt
- **Installation unter Linux mit einer Zeile.** Wer Rui nur benutzen will,
  braucht das Repository nicht mehr:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/vikingjunior12/Rui/main/install.sh | bash
  ```

  Das Script holt das neueste Release, entpackt es und hängt Rui an denselben
  Stellen ein wie bisher — Binary, Symlink für das Terminal, Starter, Icons,
  alles unter dem Benutzerprofil, ohne Root. Es zieht sich selbst mit nach
  `~/.local/share/rui/`, sodass `~/.local/share/rui/install.sh --uninstall`
  auch ohne Netz und ohne Repository wieder aufräumt.
- **Die Releases baut jetzt GitHub Actions.** Ein Tag `v*` löst Windows- und
  Linux-Build nebeneinander aus, hängt beide ans Release und schreibt die
  Prüfsummen dazu. Die Release-Notiz kommt aus diesem Changelog, der Titel aus
  der Beschriftung des Tags. `workflow_dispatch` baut dasselbe, ohne etwas zu
  veröffentlichen — der Trockenlauf vor dem Tag.
- **`scripts/package-linux.sh`** schnürt aus dem Linux-Build das Archiv
  `rui-linux-x86_64.tar.gz` mit Binary, Icons und Installer. Eine nackte
  Binary reicht zur Installation nicht: ohne Icons steht im Anwendungsstarter
  ein graues Rechteck.

### Geändert
- **`scripts/install-linux.sh` ist nur noch der Bau-Vorspann.** Wohin Rui
  gehört, weiss ab jetzt allein `install.sh`; das Script baut und übergibt.
  Vorher stand derselbe Ablauf zweimal da und wäre beim nächsten Pfadwechsel
  auseinandergelaufen.

### Behoben
- **Windows fehlte in den Releases 0.3.3 bis 0.3.6.** Weil beide Plattformen
  von Hand gebaut wurden, hing an einem Release nur, was gerade auf der
  Maschine entstand, auf der getaggt wurde — meist Linux. Das kann jetzt nicht
  mehr passieren: ohne beide Builds entsteht kein Release.

## [0.3.6] — 2026-08-28

### Behoben
- **`:w` ohne Dateinamen schrieb eine Datei namens `w`.** Rui hat das
  Argument eines Ex-Befehls aus `params.input` gelesen, wenn `argString`
  fehlte — `input` ist aber die ganze getippte Zeile und nicht der Teil
  hinter dem Befehl. Bei `:w` stand darin schlicht `w`, und Rui hielt den
  Befehlsnamen für einen Dateinamen. Dasselbe traf `:wq` (Datei `wq`) und
  `:e` ohne Pfad, das damit statt eines Neuladens eine Datei `e` öffnen
  wollte. `:w name.md` war nie betroffen — da steht ein `argString` da.
  Ein namenloser Puffer geht bei `:w` jetzt wieder den Weg von Strg+S: in
  den Notizen-Ordner, und ohne einen solchen in den Dateidialog.
- **Die Hälfte des Omarchy-Themes kam nie an.** `OmarchyColors` trug
  `rename_all = "camelCase"`, und das gilt bei serde in beide Richtungen —
  also auch beim Lesen von `colors.toml`, wo die Schlüssel
  `dark_foreground`, `lighter_background` und so weiter heissen. Alle
  zweiwortigen Felder blieben leer, und weil `#[serde(default)]` daraus
  keinen Fehler macht, füllte Rui sie still aus seinem eigenen
  Sage-Farbschema: Grünes im blauen Tokyo Night, an Schaltern,
  Beschriftungen und Dialogflächen. Gelesen wird jetzt `snake_case`,
  ausgeliefert weiterhin `camelCase` — mit Tests für beide Richtungen.

### Geändert
- **Die Oberflächenfarben eines Omarchy-Themes werden geprüft, nicht nur
  übernommen.** Eine Terminal-Palette sagt, was ein Theme für „grün" hält,
  aber nichts darüber, ob zwei Farben nebeneinander lesbar bleiben. Rui
  rechnet jetzt nach:
  - **Dialoge liegen wieder über dem Text.** Für Einstellungen und
    Schnellöffnen galt `darker_background` — bei Tokyo Night `#0e0e14` und
    damit dunkler als der Editor. Die Flächen bilden jetzt eine Leiter
    (Text → Statusleiste → Dialog), die immer in dieselbe Richtung führt.
  - **Beschriftungen sind lesbar.** Die gedämpfte Schrift kam aus
    `dark_foreground`, der Kommentarfarbe des Themes; auf der Statusleiste
    ergab das bei Everforest ein Kontrastverhältnis von 1.5:1. Sie wird
    jetzt so weit zur Vordergrundfarbe verschoben, bis 4.5:1 stehen — über
    alle 22 mitgelieferten Themes hinweg, ohne den Charakter zu verlieren.
  - **Die Auswahl ist sichtbar.** Themes, deren Selektionsfarbe fast auf
    dem Hintergrund liegt, bekommen einen Mindestabstand.
- **Vims Kommandozeile trägt Ruis Farben.** Das Eingabefeld für `:` und `/`
  hatte vom Vim-Paket nur `background: inherit` — Textfarbe und Schrift
  erbt ein `<input>` aber nicht, die kamen vom Browser und rechneten mit
  einem hellen Formular. In dunklen Themes stand die getippte Zeile fast
  schwarz auf dunkelgrau. Vims Meldungen („Invalid command") kamen in
  einem festen Rot und tragen jetzt die Signalfarbe des Themes.

### Hinzugefügt
- **Uhrzeiten im Schnellöffnen sind deutsch.** Neben „Heute" stand ein
  `10:42 PM`, weil die Formatierung die Locale des Systems nahm. Die
  Oberfläche ist deutsch, also ist es die Uhrzeit jetzt auch.
- **Rückmeldung nach dem Speichern.** In der Statusleiste steht kurz
  `„notiz.md" geschrieben`, dann verschwindet sie wieder. Vim beantwortet
  ein `:w` mit einer Zeile über die geschriebene Datei; Rui hatte darauf
  gar keine Antwort — ob etwas passiert ist, liess sich nur daran ablesen,
  dass „Geändert" verschwand, und bei einer unveränderten Datei nicht
  einmal daran. Bei einem Puffer, der seinen Namen erst beim Speichern
  bekommt, ist das ausserdem die einzige Stelle, an der man ihn erfährt.

## [0.3.5] — 2026-08-28

### Hinzugefügt
- **`scripts/install-linux.sh`** — installiert Rui für den angemeldeten
  Benutzer, ohne Root und ohne etwas ausserhalb des Benutzerprofils
  anzufassen:
  - Binary nach `~/.local/share/rui/rui`, Symlink `~/.local/bin/rui`
    darauf — damit `rui datei.txt` im Terminal funktioniert. Die Binary zieht
    um und bleibt kein Link ins Repo: `build-release.sh` leert `release/` bei
    jedem Lauf, ein Link dorthin wäre nach dem nächsten Build tot.
  - Icons in `~/.local/share/icons/hicolor/<grösse>/apps/rui.png`. Ohne die
    zeigte der Anwendungsstarter bisher nur ein Platzhaltersymbol — die
    `.desktop`-Datei verweist mit `Icon=rui` auf ein Icon, das niemand
    installiert hat.
  - `rui.desktop` wortgleich zu dem, was Rui aus den Einstellungen heraus
    schreibt, damit beide Wege denselben Zustand sehen.
  - `--uninstall` nimmt alles wieder weg, `--build` erzwingt einen Neubau.
  - Steht `~/.local/bin` nicht im `PATH`, sagt das Script, wie man das für
    bash, zsh und fish nachholt.

### Behoben
- **`StartupWMClass` traf die Fensterklasse nicht.** Im `.desktop`-Eintrag
  stand fest `Rui`, gemeldet wird aber der Name der Binary (`rui`, bei der
  Release-Datei `rui-linux`). Dadurch ordnete kein Dock und keine
  Fensterliste ein laufendes Rui-Fenster seinem Starter-Eintrag zu. Der Wert
  kommt jetzt aus dem Dateinamen der Binary.
- **`Categories` hatte zwei Hauptkategorien** (`Utility` und `Development`).
  Menüs, die danach einsortieren, führen den Eintrag dann doppelt;
  `desktop-file-validate` warnt davor. Jetzt `Utility;TextEditor;` — eine
  Hauptkategorie, eine Zusatzkategorie, wie die Spezifikation es vorsieht.

## [0.3.4] — 2026-08-28

### Behoben
- **Der Linux-Build startete mit „Verbindung fehlgeschlagen"** statt mit dem
  Editor. `scripts/build-release.sh` hat mit blossem `cargo build --release`
  gebaut, und dabei fehlt das Cargo-Feature `custom-protocol`, das die
  Tauri-CLI sonst selbst setzt. Ohne dieses Feature gilt die App als
  Entwicklungs-Build: sie lädt ihr Frontend nicht aus dem eingebetteten
  `dist/`, sondern von `http://localhost:1420` — wo nach dem Build niemand
  mehr lauscht. Das Script baut jetzt über `npx tauri build --no-bundle`,
  also denselben Weg, den das Windows-Script schon immer ging; nur dort fiel
  es deshalb nie auf.

## [0.3.3] — 2026-08-28

### Hinzugefügt
- **Rui hängt sich jetzt auch unter Linux ein.** Der Abschnitt in den
  Einstellungen heisst dort **Linux** und macht dasselbe wie sein
  Windows-Pendant, nur auf dem Weg, den das System vorsieht:
  - **`rui datei.sh` im Terminal** über einen Symlink in `~/.local/bin` —
    dem von der XDG-Spezifikation vorgesehenen Ort, der auf Arch, Fedora und
    Debian bereits im `PATH` steht. Symlink statt Kopie, damit er nach einem
    Neubau weiter auf den aktuellen Stand zeigt. Steht der Ordner
    ausnahmsweise **nicht** im `PATH`, sagt die Anzeige das dazu — ein Link,
    den die Shell nicht findet, nützt niemandem.
  - **`.desktop`-Eintrag** unter `~/.local/share/applications`, damit Rui im
    Dateimanager unter „Öffnen mit" auftaucht. Zum Standardprogramm macht
    sich Rui ausdrücklich nicht; das bleibt eine Entscheidung im
    Dateimanager oder mit `xdg-mime default`.
- Angemeldet werden dieselben Typen wie unter Windows — Text, Logs, Scripts,
  Quelltext. `text/html` und `image/svg+xml` bleiben aussen vor: die gehören
  dem Browser.

### Geändert
- `windows_integration.rs` heisst jetzt `integration.rs` und enthält beide
  Systeme nebeneinander. Der alte Name behauptete etwas, das nicht mehr
  stimmt, und die Nicht-Windows-Seite war darin nur eine Reihe von
  Fehlermeldungen.
- Nichts davon wird systemweit geschrieben. Alles liegt unter dem
  Benutzerprofil, ohne Administrator- oder Root-Rechte.

## [0.3.2] — 2026-08-28

### Geändert
- **README auf das Produkt zugeschnitten und um gut die Hälfte gekürzt.**
  Es beschrieb ausführlich, *wie* Dinge gebaut sind — Namensgebung von
  Notizen, Icon-Erzeugung, Architekturbegründungen. Das gehört in die
  Projektnotizen, nicht ins Schaufenster. Jetzt steht dort in kurzen
  Fakten, was drin ist, wofür Rui gedacht ist (Windows, Notepad++-Erbe,
  Snippets aus KI-Workflows lesen und anpassen) und dass die
  Vim-Steuerung abschaltbar und zum Lernen der Griffe gedacht ist.
- Ein Abschnitt **Not in it** sagt geradeheraus, was Rui nicht kann.
- Platzhalter für einen Screenshot unter `assets/screenshots/rui.png`.

## [0.3.1] — 2026-08-28

### Behoben
- **Rui startete mit aktiver Vim-Steuerung gar nicht mehr** und zeigte nur
  noch „Rui konnte nicht starten — Register already defined +". Die
  Zwischenablage aus 0.2.6 meldete `"+` mit `Vim.defineRegister` an; das
  Register legt das Vim-Paket aber selbst schon in seinem
  `RegisterController` an, und `defineRegister` wirft bei einem Namen, den
  es bereits gibt. Rui ersetzt das vorhandene Register jetzt, statt ein
  zweites anzumelden. `"*` kennt das Paket nicht und wird weiterhin
  angemeldet — dort ist der Aufruf richtig.
- **Ein Fehler in der Vim-Steuerung hindert Rui nicht mehr am Start.** Sie
  ist eine Option, kein Fundament: Geht dort etwas schief, läuft der Editor
  ohne sie weiter und sagt es über den fehlenden Modus in der Statusleiste,
  statt mit einer leeren Seite dazustehen. Genau dieser Sicherheitsnetz
  fehlte, weshalb aus einem Fehler in einer Zusatzfunktion ein
  unbenutzbares Programm wurde.

## [0.3.0] — 2026-08-28

Der Abschluss des Blocks, der mit 0.2.3 begann: Rui speichert nur noch auf
Ansage, färbt Scripts wieder lesbar ein, erreicht die Zwischenablage — und
lässt sich in Windows einhängen.

### Hinzugefügt
- **`rui datei.ps1` im Terminal.** Ein neuer Abschnitt **Windows** in den
  Einstellungen trägt den Ordner der laufenden `rui.exe` in den
  Benutzer-PATH ein und nimmt ihn genauso wieder weg. Kein Administrator
  nötig, der System-PATH bleibt unangetastet.

  Bewusst in der App und nicht im Installer: Die portable `rui.exe` hat
  keinen Installer, soll aber genauso erreichbar sein — und ein PATH-Eintrag,
  den man dort wieder wegnehmen kann, wo er entstanden ist, ist ehrlicher
  als einer, der bei der Installation stillschweigend passiert. Läuft Rui
  aus zwei Ordnern, sagt der Abschnitt, welche Kopie `rui` gerade meint.
- **Ein Knopf zu den Standard-Apps.** Seit Windows 10 darf sich kein
  Programm mehr selbst als Standard eintragen — Rui kann nur seine
  Dateitypen anmelden und den Weg dorthin abkürzen.

### Geändert
- **Der Installer meldet an, was Rui auch anzeigen kann**: statt sieben
  Endungen jetzt drei Gruppen — Textdateien und Logs, Scripts (`.ps1`,
  `.psm1`, `.sh`, `.py`, …) und Quelltext (`.rs`, `.cs`, `.go`, `.json`,
  `.yaml`, `.toml`, `.sql`, `.xml`, …). Ohne diese Anmeldung taucht Rui in
  Windows' Auswahl „Öffnen mit" gar nicht erst auf.
  `.html` und `.svg` bleiben bewusst draussen: Die gehören in aller Regel
  dem Browser, und eine Verknüpfung, die man nicht wollte, ist lästiger als
  eine, die fehlt.

### Behoben
- `CHANGELOG.md` hatte sich seit 0.2.4 bei jedem Schreiben die Zeilenenden
  verdoppelt und ist wieder auf LF gebracht.

## [0.2.6] — 2026-08-28

### Hinzugefügt
- **Die System-Zwischenablage ist erreichbar.** `Strg+Umschalt+C` und
  `Strg+Umschalt+V` wie im Terminal, und in der Vim-Steuerung die Register
  `"+` und `"*` — `"+y` und `"+p` gehen damit an dieselbe Ablage wie der
  Rest des Systems. Vims eigene Register bleiben davon unberührt; genau
  dafür gibt es die beiden Sondernamen.
- Beides steht in der Befehlspalette und in der Kürzelübersicht.

### Geändert
- **Die Einstellungen öffnen sich mit `Strg+I`.** `Strg+,` funktioniert
  weiter. Strg+O führt in Rui zu Quick Open statt zu Vims Sprungliste — dann
  soll auch sein Gegenstück etwas tun, das man täglich braucht.

### Technisch
- `tauri-plugin-clipboard-manager` kam dazu. `navigator.clipboard` konnte
  zwar schreiben, aber nicht lesen: die Berechtigung dafür bekommt eine
  Tauri-App im Webview nicht — und ohne Lesen gäbe es kein `"+p`.

## [0.2.5] — 2026-08-28

### Geändert
- **Scripts sehen nicht mehr zweifarbig aus.** Drei Rollen fehlten in der
  Palette, und was sie hätten einfärben sollen, fiel auf die Farbe von
  gewöhnlichem Text zurück:
  - **Eingebaute Namen** (Cmdlets samt Aliassen, Shell-Builtins,
    `$PSScriptRoot`) haben eine eigene Farbe. In einem PowerShell-Script
    ist das der häufigste Token überhaupt — bisher war er unsichtbar.
  - **Operatoren** (`-eq`, `|`, `+`) sind von Klammern getrennt. Beide
    stumm zu färben, war der Hauptgrund für den einfarbigen Eindruck.
  - **Meta** — der Shebang einer `.sh`, `#Requires`, Direktiven — hatte
    überhaupt keine Regel.
- Attributnamen in XML und HTML trugen die Textfarbe und waren damit
  praktisch unsichtbar; sie sind jetzt eingefärbt, ihre Werte wie Strings.
- Unter Omarchy kommen die neuen Rollen aus Cyan und Braun des Themes.

### Hinzugefügt
- **Cmdlets aus fremden Modulen werden erkannt.** Der mitgelieferte
  PowerShell-Modus prüft gegen eine feste Liste der Standard-Cmdlets;
  `Get-MgUser`, `Get-ADUser` und jede selbst geschriebene Funktion standen
  nicht darin. Rui erkennt jetzt die Form `Verb-Substantiv` — ohne Liste,
  die ohnehin nie vollständig wäre.

## [0.2.4] — 2026-08-28

### Geändert
- **Die Build-Scripts legen feste Namen ab und räumen `release/` vorher
  leer.** Bisher hiess der Installer `Rui_0.2.2_x64.exe`, und der Ordner
  sammelte einen Stand nach dem anderen an, bis nicht mehr zu sehen war,
  welcher der aktuelle ist. Jetzt liegen dort `rui.exe`, `rui-setup.exe`
  und `rui-setup.msi` (Linux: `rui-linux`) — immer genau der zuletzt
  gebaute Stand. Die Version steht im Tag und in den Dateieigenschaften.

## [0.2.3] — 2026-08-28

### Geändert
- **Autosave ist standardmässig aus und hängt nicht mehr am
  Notizen-Ordner.** Bisher schrieb Rui jeden offenen Puffer alle 500 ms
  zurück, sobald irgendwo ein Notizen-Ordner eingestellt war — auch das
  PowerShell-Profil, das man nur nachschlagen wollte. Ein versehentlicher
  Tastendruck stand damit sofort auf der Platte. Gespeichert wird jetzt von
  Hand: `Strg+S`, im Vim-Modus `:w`. Autosave ist eine eigene Einstellung,
  die man selbst einschaltet.
- Ist Autosave an, steht das in der Statusleiste. Eine Datei, die ohne
  `Strg+S` geschrieben wird, soll man sehen können.
- **Dateinamen kommen nicht mehr aus der ersten Zeile.** Beim Scripting
  steht dort ein Shebang oder ein `#Requires`, und eine Datei, die sich beim
  Tippen selbst umbenennt, ist keine, mit der man arbeiten kann. Ein
  namenloser Puffer bekommt im Notizen-Ordner einen Namen aus dem Datum —
  einmal, und danach nie wieder einen anderen.
- Die Einstellungen haben dafür einen eigenen Abschnitt **Autosave**; der
  Abschnitt **Notizen** beschreibt jetzt, was er wirklich tut. Die
  Einstellung „Dateiname aus" ist entfallen.

### Hinzugefügt
- **`:w <name>` benennt einen Puffer**, wie in NeoVim: `:w profil.ps1`,
  `:w ~/scripts/x.sh`, absolute Pfade. Ein relativer Name gilt gegen den
  Ordner der offenen Datei, sonst gegen den Notizen-Ordner. Ein bestehendes
  Ziel wird nicht wortlos überschrieben, sondern erfragt. Seit die erste
  Zeile keine Namen mehr vergibt, ist das der Weg, einen zu setzen.
- `:saveas` als Synonym, `:wq <name>` und `:x <name>` ebenso.
- **`:e <pfad>`** öffnet eine Datei, `:e` ohne Argument lädt die aktuelle neu,
  `:e!` verwirft dabei ungespeicherte Änderungen. Ein Pfad, den es noch nicht
  gibt, legt einen Puffer für diesen Namen an — geschrieben wird er mit `:w`.
- Befehl **Autosave** in der Palette, mit dem Zustand daneben.

### Behoben
- `:q!` erkannte das Ausrufezeichen auch mitten im Argument. `:w foo!.txt`
  schreibt jetzt eine Datei, die so heisst, statt etwas zu erzwingen.

## [0.2.2] — 2026-08-28

### Hinzugefügt
- **Quick Open durchsucht mehrere Ordner.** Neuer Abschnitt „Quick Open" in
  den Einstellungen: beliebig viele **zusätzliche Ordner**, jeder einzeln
  wieder entfernbar. Scripts und Logs liegen selten dort, wo die Notizen
  liegen — bisher blieb dafür nur der native Dialog.
- **Der Ordner der offenen Datei wird mitdurchsucht** (abschaltbar, an).
  Eine von Hand geöffnete Logdatei macht damit ihre Nachbarn auf einen
  Tastendruck erreichbar, ohne dass jemand den Ordner erst einstellen muss.
- Jeder Eintrag nennt den Ordner, aus dem er stammt; der volle Pfad steht im
  Tooltip. Bei mehreren Wurzeln sagte der relative Pfad allein nicht, wo man
  landet.

### Geändert
- Der Kopf des Fensters zeigt ab zwei Ordnern deren Zahl statt eines Pfades;
  die Pfade selbst stehen im Tooltip.
- Ein einzelner unlesbarer Ordner leert die Liste nicht mehr — ein
  Netzlaufwerk ist mal weg, der Rest bleibt brauchbar. Ein Fehler kommt nur
  zurück, wenn sich kein einziger Ordner lesen liess.
- Liegen zwei Suchordner ineinander, steht jede Datei trotzdem nur einmal in
  der Liste.

## [0.2.1] — 2026-08-28

### Behoben
- **Ein Klick im Quick Open öffnet die Datei wieder.** Jedes Überfahren mit
  der Maus baute bisher die ganze Liste neu auf und scrollte sie danach — der
  Eintrag unter dem Zeiger war beim Klick also längst ein anderes Element,
  und die Liste sprang zusätzlich weg. Das Überfahren hängt jetzt nur noch
  die Hervorhebung um, gescrollt wird ausschliesslich bei Navigation über die
  Tastatur.

### Hinzugefügt
- **`Bild↑`, `Bild↓`, `Pos1` und `Ende`** im Quick Open. Durch eine lange
  Liste kommt man damit, ohne die Pfeiltaste gedrückt zu halten; anders als
  die Pfeiltasten laufen sie nicht um, weil das an den Enden nur verwirrt.

### Geändert
- Die Liste baut höchstens 500 Einträge. Der Ordner darf 20 000 Dateien
  haben — ebenso viele Zeilen bei jedem Tastendruck neu aufzubauen macht das
  Tippen zäh. Eine Zeile am Fuss nennt, wie viele Treffer noch dahinter
  liegen; die Suche kommt an sie heran.

## [0.2.0] — 2026-08-28

### Geändert
- **Quick Open findet jetzt jede Textdatei**, nicht mehr nur `.txt` und `.md`:
  PowerShell- und Shell-Scripts, Rust, C#, Python, Go, JSON, YAML, TOML und
  alles Weitere, das Rui einfärben kann — dazu Logdateien. Damit taugt
  `Strg+O` auch zum Durchsehen von Logs und Quelltext und nicht nur für
  Notizen.
- Die Endungsliste kommt aus `languages.ts` und wird ans Rust-Kommando
  übergeben. Sie steht damit an einer einzigen Stelle: Was Rui einfärben kann,
  kann es auch finden, und ein neuer Sprachmodus wirkt sofort in beiden.
- **Logdateien mit Rotation zählen mit** — `deploy.log.3` oder
  `error.log.2026-08-28` haben keine brauchbare Endung mehr, sind aber genau
  das, wofür man den Öffner aufmacht.
- Endungslose Textdateien mit bekannten Namen (`README`, `LICENSE`,
  `Dockerfile`, `Makefile`, `CHANGELOG`) kommen mit; alles andere ohne Endung
  bleibt draussen, weil das unter Linux meist Binärdateien sind.

### Hinzugefügt
- **Der durchsuchte Ordner steht im Kopf des Fensters**, der volle Pfad im
  Tooltip. Vorher blieb offen, warum eine Datei fehlt, die es doch gibt — sie
  liegt schlicht ausserhalb des eingestellten Ordners.
- **Baukram wird übersprungen:** `node_modules`, `target`, `dist`, `build`,
  `out`, `bin`, `obj`, `vendor`, `venv`, `__pycache__` und alle Ordner mit
  führendem Punkt. Ohne das ertränkt ein einziges Rust- oder Node-Projekt im
  Suchordner die Liste.
- Grenzen gegen Ausreisser: höchstens zwölf Ebenen tief und 20 000 Einträge.
  Ein versehentlich eingestellter Pfad nahe der Laufwerkswurzel lässt Rui
  damit nicht mehr endlos suchen.

## [0.1.6] — 2026-08-28

### Hinzugefügt
- **Quick Open im Rui-Design** auf `Strg+O`: zeigt alle `.txt`- und
  `.md`-Dateien aus dem Notizen-Ordner rekursiv an, zuletzt geänderte zuerst.
  Tippen filtert mit derselben fehlertoleranten Teilfolgen-Suche wie die
  Befehlspalette; Pfeiltasten, `Enter`, `Esc` und Maus funktionieren ohne
  Griff zum nativen Dateidialog.
- Jede Zeile zeigt Dateiname, relativen Ordner und Änderungszeit. Ein fehlender
  Notizen-Ordner führt direkt zu den Einstellungen, eine leere Suche erklärt
  ihren Zustand statt nur eine weisse Fläche zu zeigen.
- **„Andere Datei öffnen…"** im Fuss des Quick Open und
  `Strg+Umschalt+O` behalten den nativen Systemdialog für Dateien ausserhalb
  des Notizen-Ordners und alle übrigen unterstützten Formate erreichbar.

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

[Unveröffentlicht]: https://github.com/vikingjunior12/Rui/compare/v0.5.2...HEAD
[0.5.2]: https://github.com/vikingjunior12/Rui/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/vikingjunior12/Rui/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/vikingjunior12/Rui/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/vikingjunior12/Rui/compare/v0.3.10...v0.4.0
[0.3.10]: https://github.com/vikingjunior12/Rui/compare/v0.3.9...v0.3.10
[0.3.9]: https://github.com/vikingjunior12/Rui/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/vikingjunior12/Rui/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/vikingjunior12/Rui/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/vikingjunior12/Rui/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/vikingjunior12/Rui/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/vikingjunior12/Rui/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/vikingjunior12/Rui/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/vikingjunior12/Rui/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/vikingjunior12/Rui/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/vikingjunior12/Rui/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/vikingjunior12/Rui/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/vikingjunior12/Rui/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/vikingjunior12/Rui/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/vikingjunior12/Rui/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/vikingjunior12/Rui/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/vikingjunior12/Rui/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/vikingjunior12/Rui/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/vikingjunior12/Rui/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/vikingjunior12/Rui/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/vikingjunior12/Rui/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/vikingjunior12/Rui/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/vikingjunior12/Rui/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/vikingjunior12/Rui/releases/tag/v0.1.1
[0.1.0]: https://github.com/vikingjunior12/Rui/releases/tag/v0.1.0
