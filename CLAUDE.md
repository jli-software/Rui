# Rui — Arbeitsregeln

Projektspezifische Anweisungen für Claude. Gelten für **jede** Änderung in
diesem Repository.

## Versionierung — bei JEDER Änderung

Jede Änderung erhöht die Version. Keine Ausnahme, auch nicht für einen
Einzeiler oder eine Korrektur an der Doku.

| Art der Änderung | Bump | Beispiel |
|---|---|---|
| Kleines Feature, Fix, Doku, Icons | `0.0.x` | 0.1.1 → 0.1.**2** |
| Grösseres Feature | `0.x.0` | 0.1.2 → 0.**2**.0 |
| „Das ist fertig" | `x.0.0` | 0.9.3 → **1**.0.0 |

**Den Major-Bump auf `x.0.0` entscheidet ausschliesslich Jonas.** Nie von
sich aus vorschlagen oder durchführen — der kommt, wenn er das Gefühl hat,
die Version ist fertig.

Ob etwas „klein" oder „gross" ist, im Zweifel klein bumpen und es kurz
erwähnen; lieber eine Patch-Version zu viel als eine Minor-Version, die
nichts hergibt.

### Die Version steht an vier Stellen — alle vier müssen gleich sein

```
package.json               "version": "0.1.1"
src-tauri/tauri.conf.json  "version": "0.1.1"
src-tauri/Cargo.toml       version = "0.1.1"
src-tauri/Cargo.lock       [[package]] name = "rui" → version = "0.1.1"
```

Läuft die Cargo.lock aus dem Tritt, korrigiert `cargo check` sie beim
nächsten Build — aber ein Commit soll sie schon richtig enthalten.

## Nach jeder Änderung: committen und pushen

Ablauf, jedes Mal vollständig:

1. Version an allen vier Stellen erhöhen
2. `CHANGELOG.md` ergänzen — unter `## [Unveröffentlicht]`, oder als neuer
   Versionsblock, wenn die Änderung damit abgeschlossen ist
3. Committen (Commit-Message auf Deutsch, erklärt das *Warum*, nicht das Was)
4. Tag `v<version>` setzen — jede Version bekommt einen, damit die
   Vergleichslinks im Changelog auflösen
5. **`git push --follow-tags`** — nicht liegen lassen. Das Repo ist
   öffentlich: <https://github.com/vikingjunior12/Rui>

Ein **GitHub Release** mit Binaries gibt es nur bei Meilensteinen (0.2.0,
0.3.0, …), nicht bei jeder Patch-Version — sonst steht die Release-Seite
voll mit Zwischenständen.

## Sprachen im Projekt

| Wo | Sprache |
|---|---|
| `README.md` | Englisch (öffentliches Schaufenster) |
| `CHANGELOG.md`, `CLAUDE.md` | Deutsch |
| Code-Kommentare, Commit-Messages | Deutsch |
| Oberfläche der App | Deutsch (Lokalisierung steht auf der Roadmap) |

## Fallstricke

- **`testdaten/` niemals normalisieren.** `.gitattributes` nimmt den Ordner
  von Gits Zeilenende-Behandlung aus. Die Dateien *sind* die Testfälle
  (BOM, Windows-1252, CRLF) — normalisiert Git sie, testen sie nichts mehr.
- **`release/` gehört nicht ins Repo.** Binaries gehen über GitHub Releases
  raus, der Ordner ist ignoriert.
- **Icons:** nach jeder Änderung an `assets/logo/*.svg` das Script
  `scripts/build-icons.ps1` laufen lassen (braucht ImageMagick 7). `build.rs`
  hat `cargo:rerun-if-changed=icons`, sonst behält die EXE unter Windows
  stillschweigend das alte Icon.
- **Auto-Update ist gewollt, aber noch nicht eingebaut.** Das Updater-Plugin
  und sein Public Key müssen im Bundle stecken. Wer eine Version ohne
  Updater installiert, bekommt nie ein automatisches Update. Also vor dem
  Release entscheiden, das davon profitieren soll — nicht danach.
- **Windows wird nativ gebaut**, nicht von Linux aus cross-kompiliert. Vor
  Toolchain-Installationen fragen.

## Build

```bash
npm run tauri dev              # App starten
cd src-tauri && cargo test     # Tests
.\scripts\build-release.ps1    # Windows: Binary + Installer nach release/
./scripts/build-release.sh     # Linux: release/rui-linux
```
