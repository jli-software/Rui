# Baut Rui unter Windows und legt Binary samt Installern in release/ ab.
#
# Läuft bewusst nativ: WebView2 und der MSVC-Linker machen ein Cross-Compile
# von Linux aus unzuverlässig genug, dass ein echter Windows-Build (oder CI)
# die verlässlichere Wahl ist. Voraussetzungen sind darum die MSVC-Build-Tools
# und das Rust-Target x86_64-pc-windows-msvc.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host '==> Frontend und Windows-Build (release)'
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw 'tauri build fehlgeschlagen' }

$out = 'src-tauri\target\release'

# release/ enthält immer genau einen Stand: den zuletzt gebauten. Sonst
# sammeln sich dort Installer aus einem halben Dutzend Versionen an, und
# welcher davon der aktuelle ist, sieht man dem Ordner nicht mehr an.
Remove-Item 'release' -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path 'release' | Out-Null

# Feste Namen ohne Versionsnummer: die Version steht im Tag und in den
# Dateieigenschaften der EXE. Ein Link auf rui-setup.exe bleibt damit über
# Releases hinweg gültig, und der Ordner sagt auf einen Blick, was er ist.
Copy-Item "$out\rui.exe" 'release\rui.exe' -Force
$nsis = Get-ChildItem "$out\bundle\nsis\*-setup.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -Last 1
if ($nsis) { Copy-Item $nsis.FullName 'release\rui-setup.exe' -Force }
$msi = Get-ChildItem "$out\bundle\msi\*.msi" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -Last 1
if ($msi) { Copy-Item $msi.FullName 'release\rui-setup.msi' -Force }

Write-Host '==> Fertig:'
Get-ChildItem 'release' | ForEach-Object { Write-Host ('    {0}  ({1:N1} MB)' -f $_.Name, ($_.Length / 1MB)) }
