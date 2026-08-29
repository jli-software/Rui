#!/usr/bin/env bash
# Schnürt aus dem Linux-Build das Paket, das im Release hängt und das der
# curl-Installer herunterlädt:
#
#   release/rui-linux-x86_64.tar.gz
#     rui-linux-x86_64/
#       rui                die Binary
#       install.sh         derselbe Installer wie im Repository
#       icons/<n>.png      nach Zielgrösse benannt, nicht nach Tauris Konvention
#       LICENSE  README.md
#
# Ein Archiv statt einer nackten Binary, weil zur Installation mehr gehört als
# das Programm: ohne Icons steht im Anwendungsstarter ein graues Rechteck.
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -x release/rui-linux ]] || { echo "release/rui-linux fehlt — erst ./scripts/build-release.sh" >&2; exit 1; }

stage="release/rui-linux-x86_64"
rm -rf "$stage"
mkdir -p "$stage/icons"

install -m 755 release/rui-linux "$stage/rui"
install -m 755 install.sh        "$stage/install.sh"
install -m 644 LICENSE README.md "$stage/"

# Links Tauris Namen, rechts der Ordner des Icon-Themes: 128x128@2x.png ist
# ein 256er, icon.png ein 512er.
install -m 644 src-tauri/icons/32x32.png       "$stage/icons/32x32.png"
install -m 644 src-tauri/icons/64x64.png       "$stage/icons/64x64.png"
install -m 644 src-tauri/icons/128x128.png     "$stage/icons/128x128.png"
install -m 644 src-tauri/icons/128x128@2x.png  "$stage/icons/256x256.png"
install -m 644 src-tauri/icons/icon.png        "$stage/icons/512x512.png"

tar -czf release/rui-linux-x86_64.tar.gz -C release rui-linux-x86_64
rm -rf "$stage"

echo "==> Fertig: release/rui-linux-x86_64.tar.gz"
