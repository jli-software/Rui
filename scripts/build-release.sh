#!/usr/bin/env bash
# Baut Rui und legt die fertige Binary in release/ ab.
#
# Windows wird hier bewusst nicht cross-kompiliert (siehe README, Abschnitt
# "Windows-Build") — WebView2 und der MSVC-Linker machen das von Linux aus
# unzuverlässig genug, dass ein echter Windows-Build (oder CI) die
# verlässlichere Wahl ist.
set -euo pipefail
cd "$(dirname "$0")/.."

# Gebaut wird über die Tauri-CLI, nicht mit blossem `cargo build --release`.
# Der Unterschied ist nicht kosmetisch: das Cargo-Feature `custom-protocol`
# entscheidet, ob die App ihr Frontend aus dem eingebetteten `dist/` lädt
# oder vom Entwicklungsserver auf http://localhost:1420. Die CLI setzt das
# Feature, `cargo build` nicht — ein so gebautes Release startet und zeigt
# nur "Verbindung fehlgeschlagen", weil hinter localhost:1420 niemand mehr
# lauscht. --no-bundle heisst: nur die Binary, kein AppImage/deb.
#
# Das Frontend baut die CLI selbst über beforeBuildCommand (npm run build).
echo "==> Rui bauen (release)"
npx tauri build --no-bundle

# release/ enthält immer genau einen Stand: den zuletzt gebauten. Sonst
# sammeln sich dort Binaries aus einem halben Dutzend Versionen an, und
# welche davon die aktuelle ist, sieht man dem Ordner nicht mehr an.
rm -rf release
mkdir -p release
cp src-tauri/target/release/rui release/rui-linux
chmod +x release/rui-linux

echo "==> Fertig: release/rui-linux"
