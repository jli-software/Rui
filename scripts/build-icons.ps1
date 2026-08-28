# Erzeugt src-tauri/icons/ neu aus den SVG-Quellen in assets/logo/.
#
# Das Icon besteht aus drei Zeichnungen statt einer: die Seitenadern des
# Blatts laufen unter 48 px zu einem Streifen zusammen, und die Mittelrippe
# teilt das Blatt bei 16 px optisch in zwei Hälften. Darum bekommt jede
# Grössenklasse die Fassung, die auf ihr noch lesbar ist.
#
# Voraussetzung: ImageMagick 7 (magick) im PATH.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "rui-icons-$PID"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
    Write-Host '==> Grössen rendern'
    # Grösse -> Quelle. Die Schlüssel sind bewusst Strings: bei einer
    # [ordered]-Hashtable greift ein Zahlen-Index auf die Position zu,
    # nicht auf den Schlüssel.
    $stufen = [ordered]@{
        '16'  = 'assets/logo/rui-tiny.svg'
        '24'  = 'assets/logo/rui-small.svg'
        '32'  = 'assets/logo/rui-small.svg'
        '48'  = 'assets/logo/rui.svg'
        '64'  = 'assets/logo/rui.svg'
        '256' = 'assets/logo/rui.svg'
    }
    foreach ($stufe in $stufen.GetEnumerator()) {
        $px = $stufe.Key
        magick -background none $stufe.Value -resize "${px}x${px}" (Join-Path $tmp "$px.png")
        if ($LASTEXITCODE -ne 0) { throw "Rendern von $px px fehlgeschlagen" }
    }

    Write-Host '==> icon.ico zusammensetzen'
    $reihe = $stufen.Keys | ForEach-Object { Join-Path $tmp "$_.png" }
    magick @reihe 'src-tauri/icons/icon.ico'
    if ($LASTEXITCODE -ne 0) { throw 'icon.ico fehlgeschlagen' }

    Write-Host '==> Restliche Bundle-Dateien über tauri icon'
    # tauri icon braucht ein grosses PNG und erzeugt daraus icns, die
    # PNG-Reihe und die Store-Logos. Die dabei ebenfalls erzeugte icon.ico
    # kennt die Detailstufen nicht, darum wird sie danach überschrieben.
    $master = Join-Path $tmp 'master-1024.png'
    magick -background none 'assets/logo/rui.svg' -resize 1024x1024 $master
    npx tauri icon $master
    if ($LASTEXITCODE -ne 0) { throw 'tauri icon fehlgeschlagen' }

    Remove-Item 'src-tauri/icons/ios', 'src-tauri/icons/android' -Recurse -Force -ErrorAction SilentlyContinue
    magick @reihe 'src-tauri/icons/icon.ico'
    Copy-Item (Join-Path $tmp '32.png') 'src-tauri/icons/32x32.png' -Force
    Copy-Item (Join-Path $tmp '64.png') 'src-tauri/icons/64x64.png' -Force

    Write-Host '==> Fertig. icon.ico enthält:'
    magick identify 'src-tauri/icons/icon.ico' | ForEach-Object { Write-Host "    $_" }
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
