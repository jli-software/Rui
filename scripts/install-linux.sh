#!/usr/bin/env bash
# Installiert Rui für den angemeldeten Benutzer: `rui datei.txt` im Terminal
# und ein Eintrag im Anwendungsstarter.
#
# Nichts davon braucht Root. Alles landet unter dem Benutzerprofil, an den
# Orten, die die XDG-Spezifikation dafür vorsieht:
#
#   ~/.local/share/rui/rui                        die Binary
#   ~/.local/bin/rui                              Symlink darauf, fürs Terminal
#   ~/.local/share/applications/rui.desktop       Starter und "Öffnen mit"
#   ~/.local/share/icons/hicolor/<n>/apps/rui.png das Icon dazu
#
# Warum die Binary umzieht und nicht ein Symlink ins Repo zeigt: Ein Link auf
# `release/rui-linux` stirbt beim nächsten `build-release.sh` (das leert den
# Ordner) und erst recht, wenn das Repo mal woanders liegt. Ein installiertes
# Programm soll ein `git clean` überleben.
#
# Dieselben Pfade benutzt auch der Linux-Abschnitt in Ruis Einstellungen —
# was hier passiert, sieht Rui dort als eingehängt, und umgekehrt.
#
#   ./scripts/install-linux.sh              bauen (falls nötig) und installieren
#   ./scripts/install-linux.sh --build      in jedem Fall vorher neu bauen
#   ./scripts/install-linux.sh --uninstall  alles wieder entfernen
set -euo pipefail
cd "$(dirname "$0")/.."

data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
app_dir="$data_home/rui"
bin_link="$HOME/.local/bin/rui"
desktop_dir="$data_home/applications"
desktop_file="$desktop_dir/rui.desktop"
icon_root="$data_home/icons/hicolor"

# --------------------------------------------------------------- entfernen

if [[ "${1:-}" == "--uninstall" ]]; then
    echo "==> Rui entfernen"
    rm -f "$bin_link" "$desktop_file"
    rm -rf "$app_dir"
    for size in 32x32 64x64 128x128 256x256 512x512; do
        rm -f "$icon_root/$size/apps/rui.png"
    done
    command -v update-desktop-database >/dev/null && update-desktop-database "$desktop_dir" || true
    command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -qtf "$icon_root" || true
    echo "==> Entfernt. Einstellungen und Notizen bleiben, die liegen woanders."
    exit 0
fi

# ---------------------------------------------------------------- bauen

if [[ "${1:-}" == "--build" || ! -x release/rui-linux ]]; then
    ./scripts/build-release.sh
fi

# ------------------------------------------------------------ installieren

echo "==> Binary nach $app_dir"
mkdir -p "$app_dir"
# Erst daneben, dann umbenennen: Eine laufende Rui-Instanz hält ihre Binary
# offen. Überschreiben schlägt fehl oder trifft den laufenden Prozess, ein
# Rename tauscht bloss den Namen um — die alte Datei lebt weiter, bis sie
# niemand mehr offen hat.
install -m 755 release/rui-linux "$app_dir/rui.neu"
mv -f "$app_dir/rui.neu" "$app_dir/rui"

echo "==> Symlink $bin_link"
mkdir -p "$(dirname "$bin_link")"
ln -sfn "$app_dir/rui" "$bin_link"

echo "==> Icons nach $icon_root"
# Die Namen links sind Tauris Konvention, die Ordner rechts die des
# Icon-Themes: 128x128@2x.png ist ein 256er, icon.png ein 512er.
install_icon() {
    local quelle="$1" groesse="$2"
    [[ -f "$quelle" ]] || return 0
    mkdir -p "$icon_root/$groesse/apps"
    install -m 644 "$quelle" "$icon_root/$groesse/apps/rui.png"
}
install_icon src-tauri/icons/32x32.png       32x32
install_icon src-tauri/icons/64x64.png       64x64
install_icon src-tauri/icons/128x128.png     128x128
install_icon src-tauri/icons/128x128@2x.png  256x256
install_icon src-tauri/icons/icon.png        512x512

echo "==> Starter $desktop_file"
mkdir -p "$desktop_dir"
# Wortgleich mit dem, was `integration.rs::desktop_entry()` schreibt — sonst
# meldet Rui in den Einstellungen "nicht eingehängt", obwohl die Datei da ist.
# text/html und image/svg+xml fehlen bewusst: die gehören dem Browser.
cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Rui
Comment=Schlanker Texteditor
Exec=$app_dir/rui %f
Icon=rui
Terminal=false
Categories=Utility;TextEditor;
MimeType=text/plain;text/markdown;text/csv;text/tab-separated-values;text/x-log;application/x-shellscript;text/x-python;text/rust;text/x-csharp;text/x-go;text/x-sql;text/x-diff;application/json;application/x-yaml;application/toml;application/xml;text/x-ini;
StartupNotify=true
StartupWMClass=rui
EOF

# Ohne das sehen Dateimanager und Starter den Eintrag erst nach dem nächsten
# Anmelden. Fehlt das Werkzeug, ist das kein Fehler — nur langsamer.
command -v update-desktop-database >/dev/null && update-desktop-database "$desktop_dir" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -qtf "$icon_root" || true

echo
echo "==> Fertig."
echo "    rui datei.txt        im Terminal"
echo "    Rui                  im Anwendungsstarter (SUPER+Leertaste)"

# Ein Symlink in einem Ordner, den die Shell nicht durchsucht, nützt
# niemandem. Auf Arch, Fedora und Debian steht ~/.local/bin ausgeliefert
# schon im PATH — aber eben nicht überall.
case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *)
        echo
        echo "    Achtung: $HOME/.local/bin steht nicht im PATH."
        echo "    Für bash/zsh:  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
        echo "    Für fish:      fish_add_path ~/.local/bin"
        ;;
esac

# Rui meldet nur die Dateitypen an. Standardprogramm wird es erst, wenn es
# jemand dazu macht — das ist eine Entscheidung, keine Nebenwirkung einer
# Installation.
echo
echo "    Standard-Editor für .txt werden (optional):"
echo "    xdg-mime default rui.desktop text/plain"
