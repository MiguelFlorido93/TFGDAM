# ============================================================
# Stockly · Instalador local (Windows)
# Descarga Node.js, MySQL y Java (JDK) portables en runtime/
# Inicializa la base de datos, instala dependencias y crea .env
#
# Uso:
#   En PowerShell, desde la raíz del proyecto o desde scripts/:
#       powershell -ExecutionPolicy Bypass -File scripts\install.ps1
#   O hacer doble click en scripts\install.bat
# ============================================================

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ----- Rutas relativas al script -----
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Resolve-Path (Join-Path $ScriptDir '..')
$Runtime    = Join-Path $ProjectDir 'runtime'
$Cache      = Join-Path $Runtime    'cache'
$NodeDir    = Join-Path $Runtime    'node'
$MysqlDir   = Join-Path $Runtime    'mysql'
$MysqlData  = Join-Path $Runtime    'mysql-data'
$JavaDir    = Join-Path $Runtime    'java'
$BackendDir = Join-Path $ProjectDir 'backend'
$SchemaSql  = Join-Path $ProjectDir 'db\schema.sql'
$EnvFile    = Join-Path $BackendDir '.env'
$EnvExample = Join-Path $BackendDir '.env.example'

# ----- Versiones / URLs -----
$NodeVersion = '20.18.0'
$NodeZip     = "node-v$NodeVersion-win-x64.zip"
$NodeUrl     = "https://nodejs.org/dist/v$NodeVersion/$NodeZip"

$MysqlVersion = '8.0.40'
$MysqlZip     = "mysql-$MysqlVersion-winx64.zip"
$MysqlUrl     = "https://dev.mysql.com/get/Downloads/MySQL-8.0/$MysqlZip"

# Eclipse Temurin JDK 21 (LTS)
$JdkZip = 'OpenJDK21U-jdk_x64_windows_hotspot_21.0.5_11.zip'
$JdkUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/$JdkZip"

# ----- Util -----
function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function New-Dir($p)      { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null } }

function Download-IfMissing($url, $dest) {
    if (Test-Path $dest) { Write-Host "    (cache) $([IO.Path]::GetFileName($dest))"; return }
    Write-Host "    Descargando $([IO.Path]::GetFileName($dest)) ..."
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

function Expand-AndRename($zip, $targetDir) {
    # Extrae a un tmp y mueve la primera carpeta hija a $targetDir
    $tmp = Join-Path $Cache ("extract_" + [Guid]::NewGuid().ToString('N'))
    New-Dir $tmp
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem -Path $tmp | Select-Object -First 1
    if (Test-Path $targetDir) { Remove-Item -Recurse -Force $targetDir }
    Move-Item -Path $inner.FullName -Destination $targetDir
    Remove-Item -Recurse -Force $tmp
}

# ============================================================
Write-Step "Preparando carpetas en runtime/"
New-Dir $Runtime
New-Dir $Cache

# ----- Node.js -----
Write-Step "Instalando Node.js $NodeVersion"
if (-not (Test-Path (Join-Path $NodeDir 'node.exe'))) {
    $zip = Join-Path $Cache $NodeZip
    Download-IfMissing $NodeUrl $zip
    Expand-AndRename $zip $NodeDir
} else { Write-Host "    Ya instalado." }

$env:Path = "$NodeDir;$NodeDir\node_modules\npm\bin;$env:Path"

# ----- Java JDK -----
Write-Step "Instalando Java (Temurin JDK 21)"
if (-not (Test-Path (Join-Path $JavaDir 'bin\java.exe'))) {
    $zip = Join-Path $Cache $JdkZip
    Download-IfMissing $JdkUrl $zip
    Expand-AndRename $zip $JavaDir
} else { Write-Host "    Ya instalado." }

$env:JAVA_HOME = $JavaDir
$env:Path      = "$JavaDir\bin;$env:Path"

# ----- MySQL -----
Write-Step "Instalando MySQL $MysqlVersion (portable)"
if (-not (Test-Path (Join-Path $MysqlDir 'bin\mysqld.exe'))) {
    $zip = Join-Path $Cache $MysqlZip
    Download-IfMissing $MysqlUrl $zip
    Expand-AndRename $zip $MysqlDir
} else { Write-Host "    Ya instalado." }

$Mysqld = Join-Path $MysqlDir 'bin\mysqld.exe'
$Mysql  = Join-Path $MysqlDir 'bin\mysql.exe'

# ----- Inicializar data dir de MySQL -----
Write-Step "Inicializando data dir de MySQL (root sin contraseña)"
if (-not (Test-Path (Join-Path $MysqlData 'mysql'))) {
    New-Dir $MysqlData
    & $Mysqld --initialize-insecure --datadir="$MysqlData" --console
    if ($LASTEXITCODE -ne 0) { throw "Fallo al inicializar MySQL (exit $LASTEXITCODE)" }
} else { Write-Host "    Ya inicializado." }

# ----- Arrancar MySQL temporalmente para importar el esquema -----
Write-Step "Arrancando MySQL temporal en puerto 3306"
$pidFile = Join-Path $Runtime 'mysql.pid'
$proc = Start-Process -FilePath $Mysqld `
    -ArgumentList @("--datadir=$MysqlData", "--port=3306", "--console") `
    -PassThru -WindowStyle Hidden
$proc.Id | Out-File -Encoding ascii $pidFile

Write-Host "    Esperando a que MySQL acepte conexiones..."
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = & $Mysql -u root --protocol=TCP -h 127.0.0.1 -P 3306 -e "SELECT 1;" 2>$null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    } catch {}
}
if (-not $ok) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    throw "MySQL no arrancó a tiempo."
}

try {
    Write-Step "Importando esquema (db/schema.sql)"
    Get-Content $SchemaSql -Raw | & $Mysql -u root --protocol=TCP -h 127.0.0.1 -P 3306
    if ($LASTEXITCODE -ne 0) { throw "Fallo importando schema.sql" }
}
finally {
    Write-Step "Parando MySQL temporal"
    try { & $Mysql -u root --protocol=TCP -h 127.0.0.1 -P 3306 -e "SHUTDOWN;" 2>$null } catch {}
    Start-Sleep -Seconds 2
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# ----- .env -----
Write-Step "Generando backend/.env"
if (-not (Test-Path $EnvFile)) {
    $jwt = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Min 0 -Max 16) })
    @"
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=stockly
JWT_SECRET=$jwt
JWT_EXPIRES_IN=8h
NODE_ENV=production
"@ | Set-Content -Encoding ASCII $EnvFile
    Write-Host "    Creado $EnvFile"
} else { Write-Host "    Ya existe, no se sobrescribe." }

# ----- npm install -----
Write-Step "Instalando dependencias del backend (npm install)"
Push-Location $BackendDir
try {
    $npmCmd = Join-Path $NodeDir 'npm.cmd'
    & $npmCmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install falló" }
}
finally { Pop-Location }

Write-Host "`n============================================================"  -ForegroundColor Green
Write-Host " Instalación completada."                                       -ForegroundColor Green
Write-Host " Para arrancar la aplicación: scripts\start.bat"                 -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green
