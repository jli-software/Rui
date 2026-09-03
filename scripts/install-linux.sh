#!/usr/bin/env bash
# Installiert Rui aus dem Quellbaum: baut, falls nötig, und übergibt dann an
# ../install.sh — dasselbe Script, das auch im Release-Tarball steckt und
# hinter dem curl-Einzeiler liegt.
#
# Es gibt damit genau eine Stelle, die weiss, wohin Rui gehört; hier steht nur
# noch, woher die Binary kommt.
#
#   ./scripts/install-linux.sh              bauen (falls nötig) und installieren
#   ./scripts/install-linux.sh --build      in jedem Fall vorher neu bauen
#   ./scripts/install-linux.sh --uninstall  alles wieder entfernen
#
# Wer Rui nur benutzen und nicht bauen will, braucht dieses Repository nicht:
#   curl -fsSL https://raw.githubusercontent.com/jli-software/Rui/main/install.sh | bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--uninstall" ]]; then
    exec ./install.sh --uninstall
fi

if [[ "${1:-}" == "--build" || ! -x release/rui-linux ]]; then
    ./scripts/build-release.sh
fi

exec ./install.sh --from "$PWD"
