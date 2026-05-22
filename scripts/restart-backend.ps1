#requires -Version 5.1
# Reinicia el backend de Stockly tras cada turno de Claude Code.
# - Si :3001 está escuchando: mata ese PID y arranca `node backend/server.js` desacoplado.
# - Si :3001 NO está escuchando: lanza start.bat (bootstrap completo MySQL + backend).

$ErrorActionPreference = 'Continue'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectDir 'backend'
$StartBat   = Join-Path $ProjectDir 'start.bat'
$LogOut     = Join-Path $ProjectDir 'backend.log'
$LogErr     = Join-Path $ProjectDir 'backend.err.log'
$Marker     = Join-Path $ProjectDir 'scripts\restart-backend.last.txt'

function Get-Pid3001 {
    try {
        $line = netstat -ano | Select-String -Pattern ':3001\s.*LISTENING' | Select-Object -First 1
        if (-not $line) { return $null }
        $tokens = ($line.Line -split '\s+') | Where-Object { $_ }
        return [int]$tokens[-1]
    } catch { return $null }
}

$pidListening = Get-Pid3001
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')

if ($pidListening) {
    # Backend ya corriendo → kill + relaunch (rápido, sin tocar MySQL)
    try { Stop-Process -Id $pidListening -Force -ErrorAction Stop } catch { }
    # Esperar a que se libere el puerto (máx 5s)
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Milliseconds 500
        if (-not (Get-Pid3001)) { break }
    }
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) {
        "$stamp  [error] node no está en PATH; no se pudo reiniciar" | Out-File -FilePath $Marker -Encoding utf8
        exit 0
    }
    Start-Process -FilePath $node `
        -ArgumentList 'server.js' `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $LogOut `
        -RedirectStandardError $LogErr
    "$stamp  restart node (kill PID $pidListening + relaunch)" | Out-File -FilePath $Marker -Encoding utf8
} else {
    # Backend caído → arrancar start.bat completo (MySQL + env + backend)
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "`"$StartBat`"" `
        -WorkingDirectory $ProjectDir `
        -WindowStyle Minimized
    "$stamp  cold start (start.bat)" | Out-File -FilePath $Marker -Encoding utf8
}
