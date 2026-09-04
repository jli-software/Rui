# Windows convenience wrapper for the cross-platform icon builder.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

npm run build:icons
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
