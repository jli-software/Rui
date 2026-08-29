#!/usr/bin/env bash
# Installiert Rui für den angemeldeten Benutzer — aus dem neuesten GitHub-Release
# oder aus einem bereits entpackten Ordner.
#
#   curl -fsSL https://raw.githubusercontent.com/vikingjunior12/Rui/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --version v0.3.7
#   curl -fsSL .../install.sh | bash -s -- --uninstall
#
# Dasselbe Script liegt im Release-Tarball. Findet es neben sich eine Binary,
# installiert es die statt herunterzuladen — so gibt es für „installieren" genau
# eine Wahrheit, egal ob der Weg über curl, über den Tarball oder über
# scripts/install-linux.sh aus dem Quellbaum führt.
#
# Nichts davon braucht Root. Alles landet unter dem Benutzerprofil, an den
# Orten, die die XDG-Spezifikation dafür vorsieht:
#
#   ~/.local/share/rui/rui                        die Binary
#   ~/.local/bin/rui                              Symlink darauf, fürs Terminal
#   ~/.local/share/applications/rui.desktop       Starter und "Öffnen mit"
#   ~/.local/share/icons/hicolor/<n>/apps/rui.png das Icon dazu
#
# Warum die Binary umzieht und nicht ein Symlink irgendwohin zeigt: Ein Link auf
# einen Download-Ordner oder auf `release/rui-linux` stirbt beim nächsten
# Aufräumen. Ein installiertes Programm soll ein `git clean` überleben.
#
# Dieselben Pfade benutzt auch der Linux-Abschnitt in Ruis Einstellungen — was
# hier passiert, sieht Rui dort als eingehängt, und umgekehrt.
set -euo pipefail

repo="vikingjunior12/Rui"
asset="rui-linux-x86_64.tar.gz"

data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
app_dir="$data_home/rui"
bin_link="$HOME/.local/bin/rui"
desktop_dir="$data_home/applications"
desktop_file="$desktop_dir/rui.desktop"
icon_root="$data_home/icons/hicolor"

version=""       # leer = neuestes Release
quelle=""        # gesetzt = Ordner mit fertigen Dateien, kein Download
binary=""        # die Binary darin
aktion="install"

# Im Tarball heisst sie `rui` und liegt obenauf, im Quellbaum `release/rui-linux`.
finde_binary() {
    local dir="$1" kandidat
    for kandidat in "$dir/rui" "$dir/release/rui-linux"; do
        [[ -x "$kandidat" ]] && { echo "$kandidat"; return 0; }
    done
    return 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --uninstall) aktion="uninstall"; shift ;;
        --version)   version="${2:-}"; shift 2 ;;
        --from)      quelle="${2:-}"; shift 2 ;;
        -h|--help)
            sed -n '2,10p' "$0" 2>/dev/null || echo "install.sh [--version vX.Y.Z] [--from ORDNER] [--uninstall]"
            exit 0 ;;
        *) echo "Unbekannte Option: $1" >&2; exit 1 ;;
    esac
done

# --------------------------------------------------------------- entfernen

if [[ "$aktion" == "uninstall" ]]; then
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

# ------------------------------------------------------------ Quelle finden

# Läuft das Script als Datei und liegt eine Binary daneben, ist das der
# entpackte Tarball — dann wird nichts heruntergeladen. Über `curl | bash`
# gelesen hat es kein Verzeichnis, deshalb die Prüfung auf eine echte Datei.
if [[ -n "$quelle" ]]; then
    binary="$(finde_binary "$quelle")" || {
        echo "In $quelle liegt keine gebaute Binary." >&2; exit 1; }
elif [[ -f "${BASH_SOURCE[0]:-}" ]]; then
    eigenes_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if binary="$(finde_binary "$eigenes_dir")"; then quelle="$eigenes_dir"; fi
fi

tmp=""
if [[ -z "$quelle" ]]; then
    arch="$(uname -m)"
    if [[ "$arch" != "x86_64" ]]; then
        echo "Fertige Builds gibt es nur für x86_64, hier läuft $arch." >&2
        echo "Aus den Quellen bauen: https://github.com/$repo#build-from-source" >&2
        exit 1
    fi
    command -v curl >/dev/null || { echo "curl wird gebraucht." >&2; exit 1; }
    command -v tar  >/dev/null || { echo "tar wird gebraucht." >&2; exit 1; }

    if [[ -n "$version" ]]; then
        url="https://github.com/$repo/releases/download/$version/$asset"
    else
        # /releases/latest/download/ leitet auf das neueste Release um — das
        # spart einen API-Aufruf und damit das Rate-Limit für Nicht-Angemeldete.
        url="https://github.com/$repo/releases/latest/download/$asset"
    fi

    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    echo "==> Lade $asset"
    curl -fSL --progress-bar "$url" -o "$tmp/$asset"
    tar -xzf "$tmp/$asset" -C "$tmp"
    quelle="$tmp/rui-linux-x86_64"
    binary="$(finde_binary "$quelle")" || {
        echo "Im Archiv steckt keine Binary." >&2; exit 1; }
fi

# ------------------------------------------------------------ installieren

echo "==> Binary nach $app_dir"
mkdir -p "$app_dir"
# Erst daneben, dann umbenennen: Eine laufende Rui-Instanz hält ihre Binary
# offen. Überschreiben schlägt fehl oder trifft den laufenden Prozess, ein
# Rename tauscht bloss den Namen um — die alte Datei lebt weiter, bis sie
# niemand mehr offen hat.
install -m 755 "$binary" "$app_dir/rui.neu"
mv -f "$app_dir/rui.neu" "$app_dir/rui"

# Der Installer zieht mit ein: dann kommt man ohne curl und ohne Repository
# wieder weg von hier.
if [[ -f "$quelle/install.sh" ]]; then
    install -m 755 "$quelle/install.sh" "$app_dir/install.sh"
fi

echo "==> Symlink $bin_link"
mkdir -p "$(dirname "$bin_link")"
ln -sfn "$app_dir/rui" "$bin_link"

echo "==> Icons nach $icon_root"
# Zwei Layouts: im Tarball heissen die Dateien nach ihrer Zielgrösse, im
# Quellbaum nach Tauris Konvention (128x128@2x.png ist ein 256er, icon.png
# ein 512er).
install_icon() {
    local groesse="$1" tauri_name="$2" datei
    for datei in "$quelle/icons/$groesse.png" "$quelle/src-tauri/icons/$tauri_name"; do
        [[ -f "$datei" ]] || continue
        mkdir -p "$icon_root/$groesse/apps"
        install -m 644 "$datei" "$icon_root/$groesse/apps/rui.png"
        return 0
    done
}
install_icon 32x32   32x32.png
install_icon 64x64   64x64.png
install_icon 128x128 128x128.png
install_icon 256x256 128x128@2x.png
install_icon 512x512 icon.png

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
echo
echo "    Wieder entfernen:  $app_dir/install.sh --uninstall"
