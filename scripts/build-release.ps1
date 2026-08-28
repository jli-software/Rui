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
New-Item -ItemType Directory -Force -Path 'release' | Out-Null
Copy-Item "$out\rui.exe" 'release\rui.exe' -Force
Copy-Item "$out\bundle\nsis\*-setup.exe" 'release\' -Force
Copy-Item "$out\bundle\msi\*.msi" 'release\' -Force

Write-Host '==> Fertig:'
Get-ChildItem 'release' | ForEach-Object { Write-Host ('    {0}  ({1:N1} MB)' -f $_.Name, ($_.Length / 1MB)) }
