import type { UiLanguage } from "./types";

let language: UiLanguage = "en";

const translations: Record<string, string> = {
  // Window chrome and common actions
  "Minimieren": "Minimize",
  "Maximieren": "Maximize",
  "Wiederherstellen": "Restore",
  "Schliessen": "Close",
  "Abbrechen": "Cancel",
  "Speichern": "Save",
  "Alle speichern": "Save all",
  "Verwerfen": "Discard",
  "Behalten": "Keep",
  "Entfernen": "Remove",
  "Eintragen": "Add",
  "Anmelden": "Register",
  "Wählen…": "Choose…",
  "Leeren": "Clear",
  "Öffnen": "Open",
  "Überschreiben": "Overwrite",
  "Zurücksetzen": "Reset",
  "aktiv": "active",
  "an": "on",
  "aus": "off",

  // Settings
  "Allgemein": "General",
  "Oberflächensprache": "Interface language",
  "Darstellung": "Appearance",
  "Farbschema": "Colour scheme",
  "Automatisch": "Automatic",
  "Sage Hell": "Sage Light",
  "Sage Dunkel": "Sage Dark",
  "Fensterdekoration": "Window decorations",
  "Auto: eigene Titelleiste unter Windows, keine unter Hyprland/Sway, sonst die native":
    "Auto: custom title bar on Windows, none on Hyprland/Sway, native elsewhere",
  "Native Titelleiste": "Native title bar",
  "Eigene Titelleiste": "Custom title bar",
  "Keine": "None",
  "Schriftart": "Font family",
  "Schriftgrösse": "Font size",
  "Zeilenabstand": "Line height",
  "Zeilennummern": "Line numbers",
  "Relative Zeilennummern": "Relative line numbers",
  "Abstand zur Cursorzeile statt absoluter Nummer":
    "Distance from the cursor line instead of an absolute number",
  "Aktuelle Zeile hervorheben": "Highlight active line",
  "Syntaxhervorhebung": "Syntax highlighting",
  "Zeilenumbruch": "Word wrap",
  "Leerzeichen sichtbar": "Show whitespace",
  "Zeigt Leerzeichen, Tabs und Leerraum am Zeilenende":
    "Shows spaces, tabs and trailing whitespace",
  "Eingabe": "Input",
  "Tabbreite": "Tab width",
  "Tab fügt Leerzeichen ein": "Tab inserts spaces",
  "Aus: es wird ein echtes Tabulatorzeichen geschrieben":
    "Off: inserts a real tab character",
  "Automatisch einrücken": "Auto indent",
  "Klammernpaare markieren": "Highlight matching brackets",
  "Klammern automatisch schliessen": "Auto-close brackets",
  "Ergänzt die schliessende Klammer beim Tippen":
    "Adds the closing bracket as you type",
  "Vim-Steuerung": "Vim keybindings",
  "Normal-, Insert- und Visual-Modus, hjkl, :w, :e und :q. Der Modus steht links in der Statusleiste":
    "Normal, Insert and Visual mode, hjkl, :w, :e and :q. The current mode appears on the left of the status bar",
  "Beim Speichern": "On save",
  "Leerraum am Zeilenende entfernen": "Trim trailing whitespace",
  "Verändert auch Zeilen, die du nicht angefasst hast":
    "Also changes lines you did not touch",
  "Abschliessenden Zeilenumbruch sicherstellen": "Ensure final newline",
  "Encoding für neue Dateien": "Encoding for new files",
  "Zeilenende für neue Dateien": "Line ending for new files",
  "Änderungen automatisch speichern": "Save changes automatically",
  "Aus gutem Grund standardmässig aus: Wer eine Konfiguration nur nachschlägt, verändert sie sonst mit einem versehentlichen Tastendruck. Gespeichert wird mit Strg+S, im Vim-Modus mit :w":
    "Off by default for safety: an accidental keystroke should not alter a file you only opened to inspect. Save with Ctrl+S or, in Vim mode, :w",
  "Autosave nach (ms)": "Autosave after (ms)",
  "Wartezeit nach dem letzten Tastendruck — nur wirksam, wenn Autosave an ist":
    "Delay after the last keystroke — only used when autosave is on",
  "Notizen": "Notes",
  "Notizen-Ordner": "Notes folder",
  "Wohin Strg+S einen noch namenlosen Puffer legt, ohne nach dem Ort zu fragen. Einen eigenen Namen gibt :w name.ps1 oder Speichern unter":
    "Where Ctrl+S puts an unnamed buffer without asking for a location. Use :w name.ps1 or Save As to choose a name",
  "Dateiformat für neue Notizen": "File format for new notes",
  "Datumsformat für den Dateinamen": "Date format for file names",
  "Lokalzeit, festgehalten beim Anlegen des Puffers":
    "Local time captured when the buffer is created",
  "Zusätzliche Ordner": "Additional folders",
  "Strg+O durchsucht neben dem Notizen-Ordner auch diese — für Scripts und Logs, die woanders liegen. Baukram wie node_modules, target und .git bleibt überall aussen vor.":
    "Ctrl+O searches these folders alongside the notes folder — useful for scripts and logs stored elsewhere. Build directories such as node_modules, target and .git are ignored.",
  "Ordner der offenen Datei mitdurchsuchen": "Also search the open file's folder",
  "Wer eine Logdatei von Hand geöffnet hat, will als Nächstes meist eine daneben":
    "After opening one log file manually, the next file is often beside it",
  "Verhalten": "Behaviour",
  "Sitzung wiederherstellen": "Restore session",
  "Ungespeicherte Änderungen überleben einen Neustart":
    "Unsaved changes survive a restart",
  "Externe Änderungen melden": "Report external changes",
  "Meldet, wenn ein anderes Programm die offene Datei ändert":
    "Warns when another program changes the open file",
  "Beim Schliessen nachfragen": "Confirm before closing",
  "Nur bei ungespeicherten Änderungen": "Only when there are unsaved changes",
  "Einstellungen": "Settings",
  "Auf Standard zurücksetzen": "Reset to defaults",
  "settings.json öffnen": "Open settings.json",
  "Nicht gesetzt": "Not set",
  "Keine zusätzlichen Ordner": "No additional folders",
  "Ordner hinzufügen…": "Add folder…",
  "Standard-Programm für Dateitypen": "Default app for file types",
  "Windows-Einstellungen öffnen": "Open Windows Settings",
  "Im Terminal verfügbar": "Available in the terminal",
  "Als Programm für Dateitypen anmelden": "Register as an app for file types",
  "Rui meldet beim Installieren an, welche Endungen es öffnen kann — .txt, .md, .ps1, .sh, Quelltext und Logs. Welches Programm davon der Standard ist, legt seit Windows 10 nur der Benutzer selbst fest.":
    "Rui registers the extensions it can open during installation — .txt, .md, .ps1, .sh, source code and logs. Since Windows 10, only the user can choose the default app.",
  "Schreibt eine .desktop-Datei für Text, Logs, Scripts und Quelltext, damit Rui unter „Öffnen mit“ auftaucht. Zum Standard wird es dadurch nicht.":
    "Writes a .desktop file for text, logs, scripts and source code so Rui appears under “Open with”. This does not make it the default app.",
  "Text und Markdown": "Text and Markdown",
  "Alle Dateien": "All files",

  // Palettes and status bar
  "Befehlspalette": "Command palette",
  "Befehl eingeben…": "Type a command…",
  "Befehl suchen": "Search commands",
  "Datei öffnen": "Open file",
  "Datei suchen…": "Search files…",
  "Datei suchen": "Search files",
  "wählen": "select",
  "wählen ·": "select ·",
  "öffnen": "open",
  "öffnen ·": "open ·",
  "schliessen": "close",
  "Andere Datei öffnen…": "Open another file…",
  "zuletzt geändert": "last modified",
  "Notizen werden geladen…": "Loading notes…",
  "Lege zuerst einen Notizen-Ordner fest.": "Choose a notes folder first.",
  "Einstellungen öffnen": "Open Settings",
  "Keine Textdatei in diesem Ordner gefunden.": "No text files found in this folder.",
  "Keine passende Datei gefunden.": "No matching file found.",
  "Unbenannt": "Untitled",
  "Ungespeichert": "Unsaved",
  "Datei umbenennen": "Rename file",
  "Doppelklick benennt um": "Double-click to rename",
  "Klick kopiert den Pfad": "Click to copy the path",
  "Noch nicht gespeichert — Strg+S gibt der Notiz einen Namen":
    "Not saved yet — Ctrl+S gives the note a name",
  "Schreibgeschützt": "Read-only",
  "Sprache wählen": "Choose language",
  "Encoding wählen": "Choose encoding",
  "Zeilenende wählen": "Choose line ending",
  "Über Rui": "About Rui",
  "Tastenkürzel": "Keyboard shortcuts",
  "Kategorien": "Categories",
  "Tabulator wechselt die Kategorie": "Tab switches categories",
  "Kürzel suchen…": "Search shortcuts…",
  "Kürzel suchen": "Search shortcuts",
  "Alle": "All",
  "Kein passendes Kürzel gefunden.": "No matching shortcut found.",

  // Vim shortcut reference
  "Modus wechseln": "Switch modes",
  "Modi": "Modes",
  "Der Normalmodus ist der, in dem Vim wartet: Dort tippt man Befehle, nicht Text. Alles hier führt hinein oder hinaus.":
    "Normal mode is where Vim waits for commands rather than text. Everything here enters or leaves that mode.",
  "Zurück in den Normalmodus": "Return to Normal mode",
  "Einfügen vor / nach dem Cursor": "Insert before / after the cursor",
  "Einfügen am Zeilenanfang / Zeilenende": "Insert at start / end of line",
  "Neue Zeile darunter / darüber": "New line below / above",
  "Ersetzen (überschreiben)": "Replace (overwrite)",
  "Zurück an die letzte Einfügestelle": "Return to the last insert position",
  "Befehlszeile öffnen": "Open the command line",
  "Bewegen": "Movement",
  "Jede Bewegung nimmt einen Zähler davor: 5j, 3w, 2}. Und jede von ihnen ist zugleich das Ziel eines Operators — d3w löscht drei Wörter.":
    "Every motion accepts a count: 5j, 3w, 2}. Every motion can also be the target of an operator — d3w deletes three words.",
  "Links / unten / oben / rechts": "Left / down / up / right",
  "Wortweise vor / zurück / ans Wortende": "Next word / previous word / end of word",
  "Dasselbe, aber nur an Leerzeichen getrennt": "Same, but separated by whitespace only",
  "Absatz vor / zurück": "Next / previous paragraph",
  "Satz vor / zurück": "Next / previous sentence",
  "Zeilenanfang / erstes Zeichen / Zeilenende": "Start of line / first character / end of line",
  "Dokumentanfang / Dokumentende": "Start / end of document",
  "Zu Zeile n": "Go to line n",
  "Halbe Seite hoch / runter": "Half-page up / down",
  "Ganze Seite zurück": "Full page back",
  "vorwärts wäre Strg+F — der gehört in Rui der Suche":
    "Ctrl+F would move forward — Rui reserves it for Find",
  "Bildschirm oben / Mitte / unten": "Top / middle / bottom of screen",
  "Passende Klammer": "Matching bracket",
  "Zeichen in der Zeile suchen / rückwärts": "Find character on line / backwards",
  "Bis kurz davor / rückwärts": "Until before character / backwards",
  "Diesen Sprung wiederholen / umgekehrt": "Repeat / reverse this jump",
  "Zurück, wo der Cursor vorhin stand": "Return to the cursor's previous position",
  "die Sprungliste auf Strg+O / Strg+I gehört in Rui der Oberfläche":
    "Rui reserves Ctrl+O / Ctrl+I for its interface",
  "Zur letzten Änderung": "Go to the last change",
  "Marke setzen / anspringen": "Set / jump to mark",
  "Cursorzeile nach oben / Mitte / unten rollen":
    "Scroll cursor line to top / middle / bottom",
  "Markieren": "Visual selection",
  "Erst v, V oder Strg+V, dann eine Bewegung — und auf die Auswahl wirkt jeder Operator: d löscht sie, y kopiert sie, > rückt sie ein.":
    "Press v, V or Ctrl+V, then use a motion. Operators act on the selection: d deletes it, y yanks it, > indents it.",
  "Zeichen- / zeilen- / blockweise markieren": "Character / line / block selection",
  "Auswahl aufheben": "Clear selection",
  "Zur letzten Auswahl zurück": "Return to the last selection",
  "Das andere Ende anfassen": "Move to the other end",
  "Ganze Datei": "Entire file",
  "Wort — ohne / mit Leerzeichen daneben": "Word — without / with surrounding whitespace",
  "In Anführungszeichen — ohne / mit": "Inside quotes — without / with delimiters",
  "In Klammern — ohne / mit": "Inside brackets — without / with delimiters",
  "Absatz — ohne / mit Leerzeile": "Paragraph — without / with blank line",
  "Bis Zeilenende": "To end of line",
  "Auswahl löschen / ändern / kopieren": "Delete / change / yank selection",
  "Auswahl einrücken / ausrücken": "Indent / outdent selection",
  "Auswahl gross / klein schreiben": "Uppercase / lowercase selection",
  "Auswahl in die Zwischenablage": "Yank selection to clipboard",
  "Operator + Bewegung: dw, c$, y2j, d/wort": "Operator + motion: dw, c$, y2j, d/word",
  "Löschen / ändern / kopieren": "Delete / change / yank",
  "Ganze Zeile löschen / ändern / kopieren": "Delete / change / yank entire line",
  "Bis Zeilenende löschen / ändern": "Delete / change to end of line",
  "Einfügen nach / vor dem Cursor": "Paste after / before the cursor",
  "Zeichen löschen / ersetzen": "Delete / replace character",
  "Zeile mit der nächsten verbinden": "Join with the next line",
  "Einrücken / ausrücken": "Indent / outdent",
  "Gross-/Kleinschreibung umdrehen": "Toggle case",
  "Letzten Befehl wiederholen": "Repeat last command",
  "Rückgängig / wiederherstellen": "Undo / redo",
  "Zähler davor: 3dd, 5j, 2yy": "Add a count: 3dd, 5j, 2yy",
  "<n> + Befehl": "<n> + command",
  "Suchen": "Search",
  "Vorwärts / rückwärts suchen": "Search forward / backward",
  "Nächster / voriger Treffer": "Next / previous match",
  "Wort unter dem Cursor suchen": "Search for word under cursor",
  "In der ganzen Datei ersetzen": "Replace throughout the file",
  "Mit Rückfrage ersetzen": "Replace with confirmation",
  "Hervorhebung ausschalten": "Clear search highlighting",
  "Zwischenablage": "Clipboard",
  "Alles im Normalmodus. \"+ ist die Zwischenablage des Systems, \"* meint in Rui dieselbe; ohne das Präfix bleibt der Text in Vims eigenen Registern und ist ausserhalb von Rui nicht zu sehen.":
    "All commands run in Normal mode. \"+ is the system clipboard; Rui treats \"* the same way. Without that prefix, text stays in Vim's registers and is not available outside Rui.",
  "Auswahl kopieren (nach v / V)": "Yank selection (after v / V)",
  "Aktuelle Zeile kopieren": "Yank current line",
  "Operator + Bewegung kopieren": "Yank with operator + motion",
  "Ganze Datei kopieren": "Yank entire file",
  "Zeilen 10 bis 20 kopieren": "Yank lines 10 through 20",
  "Ab hier bis Dateiende kopieren": "Yank from here to end of file",
  "Auswahl kopieren, als Ex-Befehl": "Yank selection with an Ex command",
  "Ausschneiden statt kopieren": "Cut instead of yank",
  "Auswahl durch die Zwischenablage ersetzen": "Replace selection from clipboard",
  "Alles markieren, dann kopieren": "Select all, then yank",
  "In ein benanntes Register": "Use a named register",
  "An ein Register anhängen (gross)": "Append to a register (uppercase)",
  "Belegte Register ansehen": "Show registers in use",
  "Ruis eigener Weg, ohne Vim": "Rui shortcut, without Vim",
  "Befehlszeile (:)": "Command line (:)",
  ":-Befehle": ": commands",
  "Alles, was im Normalmodus mit : anfängt, in einer Liste. Schreiben und Öffnen gehen dabei durch Ruis eigene Wege — :w behält also Encoding und Zeilenende der geöffneten Datei.":
    "Everything that starts with : in Normal mode, in one list. Saving and opening use Rui's own paths, so :w preserves the file's encoding and line endings.",
  "Unter einem Namen speichern": "Save under a name",
  "Speichern und schliessen": "Save and close",
  "Schliessen / ohne zu speichern": "Close / discard changes",
  "Alles beenden": "Quit all",
  "Datei öffnen / neu laden": "Open file / reload",
  "Neuer Reiter / mit Datei": "New tab / with file",
  "Nächster / voriger Reiter": "Next / previous tab",
  "Reiter schliessen": "Close tab",
  "Zu Zeile 42 / ans Dateiende": "Go to line 42 / end of file",
  "Nur in der Auswahl ersetzen": "Replace in selection only",
  "Hervorhebung der Suche ausschalten": "Clear search highlighting",
  "Ganze Datei / Zeilenbereich kopieren": "Yank entire file / line range",
  "Zeilenumbruch an / aus": "Word wrap on / off",
  "Zeilennummern an / aus": "Line numbers on / off",
  "Relative Zeilennummern an / aus": "Relative line numbers on / off",
  "Kurzformen davon": "Short forms",
  "Befehlszeile verlassen": "Leave the command line",
  "in NeoVim: zurück in der Sprungliste": "in NeoVim: back in the jump list",
  "in NeoVim: vorwärts in der Sprungliste": "in NeoVim: forward in the jump list",
  "in NeoVim: eine Seite vorwärts": "in NeoVim: one page forward",
  "in NeoVim: Fensterbefehle": "in NeoVim: window commands",
  "in NeoVim: nächster Vorschlag im Einfügemodus":
    "in NeoVim: next completion in Insert mode",
  "in NeoVim: zurück aus dem Tag-Stack": "in NeoVim: back through the tag stack",
  "in NeoVim: Datei-Info": "in NeoVim: file information",
  "Gelten immer, auch mitten im Normalmodus.": "Always active, even in Normal mode.",
  "Die Vim-Befehle erscheinen hier, sobald die Vim-Steuerung unter Eingabe an ist.":
    "Vim commands appear here when Vim keybindings are enabled under Input.",
  "Reiter 1 bis 9 direkt": "Jump directly to tabs 1 through 9",
  "rui datei.ps1": "rui file.ps1",
  "rui datei.sh": "rui file.sh",
  "ggVG  dann  \"+y": "ggVG  then  \"+y",
  ":w notiz.ps1": ":w note.ps1",
  ":e pfad / :e": ":e path / :e",
  ":tabnew / :tabnew pfad": ":tabnew / :tabnew path",
  ":%s/alt/neu/g": ":%s/old/new/g",
  ":%s/alt/neu/gc": ":%s/old/new/gc",
  ":'<,'>s/alt/neu/g": ":'<,'>s/old/new/g",
  // About
  "Ein schlanker Texteditor für Snippets und Notizen.":
    "A focused text editor for snippets and notes.",
  "wird gelesen…": "loading…",
  "Entwickler": "Developer",
  "Lizenz": "Licence",
  "Quelltext": "Source code",
  "Baut auf": "Built with",
  "Angaben kopieren": "Copy diagnostics",
  "Changelog öffnen": "Open changelog",
  "unbekannt": "unknown",
  "Angaben kopiert": "Diagnostics copied",

  // Commands and messages
  "Ungespeicherte Änderungen": "Unsaved changes",
  "Umbenennen fehlgeschlagen": "Rename failed",
  "Die Datei wurde ausserhalb von Rui geändert. Löse den Konflikt vor dem Umbenennen.":
    "The file was changed outside Rui. Resolve the conflict before renaming it.",
  "Der Tab wurde während des Ladens geändert und deshalb nicht ersetzt.":
    "The tab changed while the file was loading, so it was not replaced.",
  "Der aktive Tab hat während des Öffnens gewechselt.":
    "The active tab changed while the file was opening.",
  "Die Datei ist schreibgeschützt. Verwende „Speichern unter“ für eine Kopie.":
    "The file is read-only. Use Save As to create a copy.",
  "Öffnen abgebrochen": "Open cancelled",
  "Öffnen fehlgeschlagen": "Could not open file",
  "Grosse Datei": "Large file",
  "Speichern fehlgeschlagen": "Could not save file",
  "Speichern unter": "Save As",
  "Speichern unter…": "Save As…",
  "Speicherkonflikt": "Save conflict",
  "Als UTF-8 speichern": "Save as UTF-8",
  "Datei gelöscht": "File deleted",
  "Datei geändert": "File changed",
  "Neu laden": "Reload",
  "Alle Einstellungen auf den Standard zurücksetzen?": "Reset all settings to their defaults?",
  "Sprache": "Language",
  "Byte Order Mark schreiben": "Write byte order mark",
  "CR — klassisches Mac OS": "CR — classic Mac OS",
  "Nichts ausgewählt": "Nothing selected",
  "Die Datei ist leer": "The file is empty",
  "Noch nicht gespeichert": "Not saved yet",
  "Pfad kopiert": "Path copied",
  "Umbenennen in": "Rename to",
  "Gehe zu Zeile": "Go to line",
  "Gehe zu Zeile (Strg+G)": "Go to line (Ctrl+G)",
  "Tabs": "Tabs",
  "Neuer Tab": "New tab",
  "Tab schliessen": "Close tab",
  "Nächster Tab": "Next tab",
  "Voriger Tab": "Previous tab",
  "Datei": "File",
  "Notiz öffnen…": "Open note…",
  "Umbenennen…": "Rename…",
  "Im Dateimanager zeigen": "Show in file manager",
  "Pfad kopieren": "Copy path",
  "Bearbeiten": "Edit",
  "Suchen und ersetzen": "Find and replace",
  "In die Zwischenablage kopieren": "Copy selection to clipboard",
  "Ganze Datei in die Zwischenablage": "Copy entire file to clipboard",
  "Aus der Zwischenablage einfügen": "Paste from clipboard",
  "Gehe zu Zeile…": "Go to line…",
  "Rückgängig": "Undo",
  "Wiederholen": "Redo",
  "Ansicht": "View",
  "Farbschema wechseln": "Cycle colour scheme",
  "Hell": "Light",
  "Dunkel": "Dark",
  "Schrift vergrössern": "Increase font size",
  "Schrift verkleinern": "Decrease font size",
  "Schriftgrösse zurücksetzen": "Reset font size",
  "Sprache wählen…": "Choose language…",
  "Encoding wählen…": "Choose encoding…",
  "Zeilenende": "Line ending",
  "Zeilenende wählen…": "Choose line ending…",
  "Tastenkürzel…": "Keyboard shortcuts…",
  "Einstellungen…": "Settings…",
  "Über Rui…": "About Rui…",
  "Zeilenumbruch an": "Word wrap on",
  "Zeilenumbruch aus": "Word wrap off",
  "Schliessen fehlgeschlagen": "Could not close Rui",
  "Rui konnte nicht starten": "Rui could not start",
  "Interne Speichersperre ist beschädigt.": "The internal save lock is unavailable.",
  "Kein Dateiname angegeben.": "No file name was provided.",
  "Kein Benutzerverzeichnis gefunden.": "No user home directory was found.",
  "Kein Ordner, gegen den der Name gelten könnte.":
    "There is no folder against which the name can be resolved.",
  "Der Name darf nicht leer sein.": "The name cannot be empty.",
  "Der Name darf keinen Pfad enthalten.": "The name cannot contain a path.",
  "Im Namen sind < > : \" | ? * nicht erlaubt.":
    "The characters < > : \" | ? * are not allowed in a file name.",
  "Im Namen stehen unsichtbare Steuerzeichen.":
    "The name contains invisible control characters.",
  "Der Name darf nicht nur aus Punkten bestehen.": "The name cannot consist only of dots.",
  "Kein Ordner zum Durchsuchen eingestellt.": "No folder is configured for searching.",
  "Eigener Pfad hat kein Verzeichnis.": "Rui's executable path has no parent directory.",
  "Kein Benutzerverzeichnis ($HOME).": "No user home directory ($HOME).",
  "Unter Windows meldet der Installer die Dateitypen an.":
    "On Windows, the installer registers file types.",
  "Unter Linux legt der Dateimanager das Standardprogramm fest.":
    "On Linux, choose the default app in your file manager.",
  "Kein Omarchy-Theme gefunden": "No Omarchy theme found",
};

const textState = new WeakMap<Text, { source: string; rendered: string }>();
const attributeState = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();
const localizedAttributes = ["aria-label", "placeholder", "title"];
let observer: MutationObserver | null = null;

export function uiLanguage(): UiLanguage {
  return language;
}

export function tr(source: string): string {
  if (language === "de") return source;
  const direct = translations[source];
  if (direct) return direct;
  const copiedLines = source.match(/^(\d+) (?:Zeile|Zeilen) kopiert$/);
  if (copiedLines) {
    return copiedLines[1] === "1" ? "1 line copied" : `${copiedLines[1]} lines copied`;
  }
  const backendPatterns: [RegExp, string][] = [
    [/^Änderungszeit nicht lesbar: (.+)$/, "Could not read modification time: $1"],
    [/^Ungültige Änderungszeit: (.+)$/, "Invalid modification time: $1"],
    [/^(.+) ist ein Verzeichnis\.$/, "$1 is a directory."],
    [/^Unbekanntes Encoding: (.+)$/, "Unknown encoding: $1"],
    [/^(.+) unterstützt keine Byte Order Mark\.$/, "$1 does not support a byte order mark."],
    [/^(.+): zu viele Symlink-Ebenen\.$/, "$1: too many levels of symbolic links."],
    [/^Dateirechte konnten nicht übernommen werden: (.+)$/, "Could not preserve file permissions: $1"],
    [/^Temp-Datei nicht prüfbar: (.+)$/, "Could not inspect temporary file: $1"],
    [/^(.+) ist kein Ordner \(mehr\)\.$/, "$1 is no longer a folder."],
    [/^Den Ordner (.+) gibt es nicht\.$/, "The folder $1 does not exist."],
    [/^(.+): kein übergeordneter Ordner\.$/, "$1: no parent folder."],
    [/^Ordner nicht gefunden: (.+)$/, "Folder not found: $1"],
    [/^Suche abgebrochen: (.+)$/, "Search cancelled: $1"],
    [/^Arbeitsverzeichnis nicht lesbar: (.+)$/, "Could not read working directory: $1"],
    [/^Kein Konfigurationsverzeichnis: (.+)$/, "No configuration directory: $1"],
    [/^(.+) ist schreibgeschützt\.$/, "$1 is read-only."],
    [/^Eigener Pfad unbekannt: (.+)$/, "Could not determine Rui's executable path: $1"],
    [/^Benutzerumgebung nicht lesbar: (.+)$/, "Could not read the user environment: $1"],
    [/^Benutzerumgebung nicht schreibbar: (.+)$/, "Could not update the user environment: $1"],
    [/^PATH nicht schreibbar: (.+)$/, "Could not update PATH: $1"],
    [/^Einstellungen liessen sich nicht öffnen: (.+)$/, "Could not open Settings: $1"],
  ];
  for (const [pattern, replacement] of backendPatterns) {
    if (pattern.test(source)) return source.replace(pattern, replacement);
  }

  const patterns: [RegExp, string][] = [
    [
      /^„(.+)" enthält Änderungen, die noch nicht auf der Platte stehen\.$/,
      '“$1” contains changes that have not been saved to disk.',
    ],
    [
      /^(\d+) Tabs enthalten Änderungen, die noch nicht auf der Platte stehen: (.+)\.$/,
      "$1 tabs contain changes that have not been saved to disk: $2.",
    ],
    [/^Rui konnte die Sitzung nicht sichern\. (.+)$/, "Rui could not save the session. $1"],
    [
      /^Diese Datei ist (.+) MB gross\. Rui ist auf Snippets ausgelegt und wird damit spürbar langsamer\. Trotzdem öffnen\?$/,
      "This file is $1 MB. Rui is designed for snippets and will be noticeably slower. Open it anyway?",
    ],
    [/^„(.+)" geschrieben$/, 'Saved “$1”'],
    [/^„(.+)“ gibt es in diesem Ordner bereits\.$/, '“$1” already exists in this folder.'],
    [
      /^Der Text enthält Zeichen, die (.+) nicht darstellen kann\. Als UTF-8 speichern\?$/,
      "The text contains characters that $1 cannot represent. Save as UTF-8 instead?",
    ],
    [/^„(.+)" ist bereits in einem anderen Tab geöffnet\.$/, '“$1” is already open in another tab.'],
    [/^„(.+)" gibt es bereits\. Überschreiben\?$/, '“$1” already exists. Overwrite it?'],
    [
      /^„(.+)" wurde ausserhalb von Rui geändert\. Trotzdem überschreiben\?$/,
      '“$1” was changed outside Rui. Overwrite it anyway?',
    ],
    [
      /^„(.+)" wurde ausserhalb von Rui gelöscht\. Der Puffer bleibt erhalten\.$/,
      '“$1” was deleted outside Rui. The buffer will remain open.',
    ],
    [
      /^„(.+)" wurde ausserhalb von Rui geändert\. Neu laden und die eigenen Änderungen verwerfen\?$/,
      '“$1” was changed outside Rui. Reload it and discard your changes?',
    ],
    [/^„(.+)" wurde ausserhalb von Rui geändert\. Neu laden\?$/, '“$1” was changed outside Rui. Reload it?'],
    [/^Umbenannt in „(.+)"$/, 'Renamed to “$1”'],
    [/^Alles kopiert · (.+)$/, "Copied all · $1"],
    [/^Unter „(.+)" ist nichts dabei\.$/, 'No matches under “$1”.'],
    [/^1 weiterer Treffer in einer anderen Kategorie$/, "1 more match in another category"],
    [/^(\d+) weitere Treffer in anderen Kategorien$/, "$1 more matches in other categories"],
    [/^Vim — angefangen: (.+)$/, "Vim — pending: $1"],
    [/^Vim-Steuerung aktiv — (.+)$/, "Vim keybindings active — $1"],
    [/^(.+)\nKlick kopiert den Pfad$/, "$1\nClick to copy the path"],
    [
      /^(.+) — "(.+)" öffnet die Datei hier\. Ein bereits offenes Terminal kennt den Eintrag allerdings erst nach einem Neustart\.$/,
      '$1 — “$2” opens the file here. Existing terminal windows will pick up the entry after they are restarted.',
    ],
    [
      /^Eingetragen ist eine andere Kopie von Rui \((.+)\)\. Eintragen holt "rui" hierher\.$/,
      'Another copy of Rui is registered ($1). Add “rui” to use this copy instead.',
    ],
    [
      /^Legt Rui in (.+), damit "(.+)" im Terminal funktioniert\. (Kein Administrator nötig|Kein root nötig), jederzeit wieder wegnehmbar\.$/,
      'Adds Rui to $1 so “$2” works in the terminal. No elevated privileges required; remove it at any time.',
    ],
    [
      /^(.+) ist angelegt — Rui steht im Dateimanager unter „Öffnen mit“\. Zum Standardprogramm machst du es dort selbst\.$/,
      '$1 exists — Rui appears under “Open with” in the file manager. You can make it the default there.',
    ],
  ];
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(source)) return source.replace(pattern, replacement);
  }

  return source
    .replace(/Strg/g, "Ctrl")
    .replace(/Umschalt/g, "Shift")
    .replace(/1 Ordner/g, "1 folder")
    .replace(/(\d+) Ordner/g, "$1 folders")
    .replace(/1 Datei · zuletzt geändert/g, "1 file · last modified")
    .replace(/(\d+) Dateien · zuletzt geändert/g, "$1 files · last modified")
    .replace(
      / — Achtung: dieser Ordner steht nicht im PATH/g,
      " — Warning: this folder is not on PATH",
    )
    .replace(/(\d+) von (\d+)/g, "$1 of $2")
    .replace(/^1 Zeile$/, "1 line")
    .replace(/^(\d+) Zeilen$/, "$1 lines")
    .replace(/^(\d+) ausgewählt$/, "$1 selected")
    .replace(/^(\d+) Auswahlen \((\d+)\)$/, "$1 selections ($2)")
    .replace(/^Z (\d+), Sp (\d+)$/, "Ln $1, Col $2")
    .replace(/^(.+) schliessen$/, "Close $1")
    .replace(/^Schliessen \((.+)\)$/, "Close ($1)")
    .replace(/^Neuer Tab \((.+)\)$/, "New tab ($1)")
    .replace(/^Einstellungen \((.+)\)$/, "Settings ($1)")
    .replace(/^Tastenkürzel \((.+)\)$/, "Keyboard shortcuts ($1)");
}

function translateText(node: Text) {
  if (node.parentElement?.closest("#editor, .tab-label, .status-file, .quick-open-text, .quick-open-scope")) {
    return;
  }
  const current = node.nodeValue ?? "";
  const previous = textState.get(node);
  const source = previous && current === previous.rendered ? previous.source : current;
  const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return;
  const rendered = `${match[1]}${tr(match[2])}${match[3]}`;
  textState.set(node, { source, rendered });
  if (current !== rendered) node.nodeValue = rendered;
}

function translateAttribute(element: Element, name: string) {
  if (element.closest("#editor, .tab-label, .status-file, .quick-open-text, .quick-open-scope")) {
    return;
  }
  const current = element.getAttribute(name);
  if (current === null) return;
  let states = attributeState.get(element);
  if (!states) {
    states = new Map();
    attributeState.set(element, states);
  }
  const previous = states.get(name);
  const source = previous && current === previous.rendered ? previous.source : current;
  const rendered = tr(source);
  states.set(name, { source, rendered });
  if (current !== rendered) element.setAttribute(name, rendered);
}

function translateNode(node: Node) {
  if (node instanceof Element && node.closest("#editor")) return;
  if (node instanceof Text) translateText(node);
  if (!(node instanceof Element)) return;
  for (const name of localizedAttributes) translateAttribute(node, name);
  for (const child of node.childNodes) translateNode(child);
}

export function setUiLanguage(next: UiLanguage) {
  language = next;
  document.documentElement.lang = next;
  translateNode(document.documentElement);

  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") translateNode(mutation.target);
      if (mutation.type === "attributes") {
        translateAttribute(mutation.target as Element, mutation.attributeName!);
      }
      for (const node of mutation.addedNodes) translateNode(node);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: localizedAttributes,
  });
}

/** Text used for filtering must match the language the user can see. */
export function searchable(source: string): string {
  return tr(source);
}
