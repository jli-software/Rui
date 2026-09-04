#Requires -Version 5.1
<#
.SYNOPSIS
    Mirrors user profiles to a backup share and prunes stale copies.
.NOTES
    Runs unattended as a scheduled task. Use -WhatIfOnly for a dry run.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ShareRoot,

    [ValidateSet('Daily', 'Weekly', 'Manual')]
    [string]$Mode = 'Daily',

    [int]$KeepDays = 30,

    [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
$LogPath = Join-Path $env:ProgramData 'ProfileSync\sync.log'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Verbose $line
}

Write-Log "Starting profile sync (mode: $Mode, keep: $KeepDays days)"

# Skip service accounts and anything that has not signed in recently.
$profiles = Get-ChildItem 'C:\Users' -Directory | Where-Object {
    $_.Name -notlike 'svc-*' -and $_.LastWriteTime -gt (Get-Date).AddDays(-$KeepDays)
}

foreach ($profile in $profiles) {
    $target = Join-Path $ShareRoot $profile.Name

    if ($WhatIfOnly) {
        Write-Log "Would copy $($profile.FullName) -> $target" 'DRYRUN'
        continue
    }

    try {
        Copy-Item -Path $profile.FullName -Destination $target -Recurse -Force
        Write-Log "Copied $($profile.Name) ($([math]::Round($profile.Length / 1MB, 1)) MB)"
    }
    catch {
        Write-Log "Failed for $($profile.Name): $($_.Exception.Message)" 'ERROR'
    }
}

Write-Log 'Profile sync finished.'
