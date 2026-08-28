#!/usr/bin/env bash
# Baut Rui und legt die fertige Binary in release/ ab.
#
# Windows wird hier bewusst nicht cross-kompiliert (siehe README, Abschnitt
# "Windows-Build") — WebView2 und der MSVC-Linker machen das von Linux aus
# unzuverlässig genug, dass ein echter Windows-Build (oder CI) die
# verlässlichere Wahl ist.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Frontend bauen"
npm run build

echo "==> Linux-Binary bauen (release)"
(cd src-tauri && cargo build --release)

# release/ enthält immer genau einen Stand: den zuletzt gebauten. Sonst
# sammeln sich dort Binaries aus einem halben Dutzend Versionen an, und
# welche davon die aktuelle ist, sieht man dem Ordner nicht mehr an.
rm -rf release
mkdir -p release
cp src-tauri/target/release/rui release/rui-linux
chmod +x release/rui-linux

echo "==> Fertig: release/rui-linux"
