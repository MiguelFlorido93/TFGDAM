@echo off
chcp 65001 >nul
setlocal ENABLEDELAYEDEXPANSION

REM ========================================================================
REM Stockly - Instalador completo (prerrequisitos + dependencias)
REM Detecta o instala Node.js, MySQL y JDK 17 via winget, y luego prepara
REM el proyecto (npm install, .env, datadir MySQL, build CLI Java).
REM ========================================================================

title Stockly Setup
color 0B

REM --- Resolver carpeta del proyecto --------------------------------------
REM IExpress extrae el .bat a %TEMP%, asi que %CD% / %~dp0 no sirven para
REM localizar el .exe. Subimos por el arbol de procesos hasta encontrar el
REM primer ejecutable fuera de %WINDIR% (= Stockly-Setup.exe) y usamos su
REM carpeta como raiz del proyecto. Asi todo es relativo a donde este el .exe.
set "PROJECT_DIR="
if not "%~1"=="" set "PROJECT_DIR=%~1"

if not defined PROJECT_DIR (
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$id=$PID; for($i=0;$i -lt 6 -and $id;$i++){ $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction SilentlyContinue; if(-not $p){break}; if($p.ExecutablePath -and ($p.ExecutablePath -notlike ($env:WINDIR + '\*'))){ Split-Path $p.ExecutablePath -Parent; break }; $id=$p.ParentProcessId }"`) do set "PROJECT_DIR=%%P"
)

if defined PROJECT_DIR (
    if not exist "%PROJECT_DIR%\package.json" set "PROJECT_DIR="
)

if not defined PROJECT_DIR (
    if exist "%CD%\package.json" if exist "%CD%\backend" set "PROJECT_DIR=%CD%"
)

if not defined PROJECT_DIR (
    echo Selecciona la carpeta raiz del proyecto Stockly...
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms ^| Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecciona la carpeta raiz del proyecto Stockly (donde esta install.bat)'; $f.ShowNewFolderButton = $false; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"`) do set "PROJECT_DIR=%%P"
)

if not defined PROJECT_DIR (
    echo [ABORTAR] No se selecciono carpeta de proyecto.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\package.json" goto :bad_project_dir
if not exist "%PROJECT_DIR%\backend"      goto :bad_project_dir
goto :have_project_dir

:bad_project_dir
echo.
echo La carpeta seleccionada no parece ser el proyecto Stockly:
echo   %PROJECT_DIR%
echo Debe contener package.json, install.bat y la carpeta backend\.
echo.
pause
exit /b 1

:have_project_dir
set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "CLI_DIR=%PROJECT_DIR%\stockly-cli"
set "LOG=%PROJECT_DIR%\install.log"
echo. > "%LOG%"

echo ============================================================
echo   STOCKLY - Instalador completo
echo ============================================================
echo   Proyecto: %PROJECT_DIR%
echo   Log:      install.log
echo ============================================================
echo.

REM --- Comprobar winget ---------------------------------------------------
where winget >nul 2>&1
if errorlevel 1 (
    echo [ERR] winget no esta disponible en este equipo.
    echo Instala "App Installer" desde Microsoft Store y vuelve a ejecutar,
    echo o instala manualmente Node.js LTS, MySQL 8.x y JDK 17.
    pause
    exit /b 1
)

set "WINGET_FLAGS=--silent --accept-source-agreements --accept-package-agreements --disable-interactivity"

REM --- Node.js ------------------------------------------------------------
echo [1/7] Comprobando Node.js...
where node >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%v in ('node --version 2^>nul') do echo   [OK]   Node !v! %%v
    echo   [OK]   Node ya instalado
) else (
    echo   Instalando Node.js LTS via winget ^(puede tardar^)...
    winget install -e --id OpenJS.NodeJS.LTS %WINGET_FLAGS% >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo   [ERR]  Fallo la instalacion de Node.js. Mira install.log
        pause
        exit /b 1
    )
    echo   [OK]   Node.js instalado
)

REM --- JDK 17 -------------------------------------------------------------
echo [2/7] Comprobando JDK 17...
where java >nul 2>&1
if !errorlevel! equ 0 (
    echo   [OK]   Java ya disponible
) else (
    echo   Instalando Microsoft OpenJDK 17 via winget...
    winget install -e --id Microsoft.OpenJDK.17 %WINGET_FLAGS% >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo   [warn] No se pudo instalar JDK 17 ^(la CLI Java sera opcional^)
    ) else (
        echo   [OK]   JDK 17 instalado
    )
)

REM --- Maven (opcional, para compilar CLI Java) ---------------------------
echo [3/7] Comprobando Maven...
where mvn >nul 2>&1
if !errorlevel! equ 0 (
    echo   [OK]   Maven ya disponible
) else (
    echo   Instalando Apache Maven via winget ^(opcional^)...
    winget install -e --id Apache.Maven %WINGET_FLAGS% >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo   [warn] Maven no instalado ^(la CLI Java sera opcional^)
    ) else (
        echo   [OK]   Maven instalado
    )
)

REM --- MySQL --------------------------------------------------------------
echo [4/7] Comprobando MySQL...
where mysqld >nul 2>&1
if !errorlevel! equ 0 (
    echo   [OK]   MySQL ya disponible
) else (
    echo   Instalando Oracle MySQL via winget ^(puede tardar varios minutos^)...
    winget install -e --id Oracle.MySQL %WINGET_FLAGS% >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo   [ERR]  Fallo la instalacion de MySQL. Mira install.log
        echo         Instalalo manualmente desde https://dev.mysql.com/downloads/
        pause
        exit /b 1
    )
    echo   [OK]   MySQL instalado
)

REM --- Refrescar PATH desde el registro (winget no actualiza esta sesion) -
echo.
echo Refrescando variables de entorno...
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "MACHINE_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
set "PATH=%MACHINE_PATH%;%USER_PATH%;%PATH%"

REM --- Detectar rutas tras instalar ---------------------------------------
set "NODE_EXE="
for /f "delims=" %%P in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%P"

set "NPM_CMD="
for /f "delims=" %%P in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%P"
if not defined NPM_CMD (
    for /f "delims=" %%P in ('where npm 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%P"
)

set "MYSQLD_EXE="
for /f "delims=" %%P in ('where mysqld 2^>nul') do if not defined MYSQLD_EXE set "MYSQLD_EXE=%%P"

if not defined NODE_EXE (
    echo [ERR] No se encuentra node tras la instalacion. Reinicia el equipo y vuelve a ejecutar.
    pause
    exit /b 1
)
if not defined MYSQLD_EXE (
    echo [ERR] No se encuentra mysqld tras la instalacion. Reinicia el equipo y vuelve a ejecutar.
    pause
    exit /b 1
)

echo   node:   !NODE_EXE!
echo   npm:    !NPM_CMD!
echo   mysqld: !MYSQLD_EXE!
echo.

REM --- npm install raiz + backend ----------------------------------------
echo [5/7] Instalando dependencias npm...
pushd "%PROJECT_DIR%"
call "!NPM_CMD!" install --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 (
    echo   [ERR]  npm install fallo en la raiz. Mira install.log
    popd
    pause
    exit /b 1
)
echo   [OK]   Raiz lista
popd

pushd "%BACKEND_DIR%"
call "!NPM_CMD!" install --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 (
    echo   [ERR]  npm install fallo en backend. Mira install.log
    popd
    pause
    exit /b 1
)
echo   [OK]   Backend listo
popd

REM --- .env ---------------------------------------------------------------
echo [6/7] Configurando backend\.env...
if exist "%BACKEND_DIR%\.env" (
    echo   [OK]   backend\.env ya existe
) else (
    if exist "%BACKEND_DIR%\.env.example" (
        copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
        echo   [OK]   Generado backend\.env desde plantilla
    ) else (
        echo   [warn] No hay .env.example
    )
)

REM --- MySQL datadir + CLI Java ------------------------------------------
echo [7/7] Inicializando MySQL y CLI Java...
set "MYSQL_DATA=%LOCALAPPDATA%\MySQL\data"
if exist "%MYSQL_DATA%\mysql" (
    echo   [OK]   Datadir MySQL ya inicializado
) else (
    if not exist "%LOCALAPPDATA%\MySQL" mkdir "%LOCALAPPDATA%\MySQL"
    echo   Inicializando datadir en %MYSQL_DATA%...
    "!MYSQLD_EXE!" --initialize-insecure --datadir="%MYSQL_DATA%" --console >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo   [warn] Fallo inicializando MySQL. Mira install.log
    ) else (
        echo   [OK]   MySQL inicializado
    )
)

where mvn >nul 2>&1
if !errorlevel! equ 0 (
    if exist "%CLI_DIR%\pom.xml" (
        pushd "%CLI_DIR%"
        echo   Compilando CLI Java con Maven...
        call mvn -q package >> "%LOG%" 2>&1
        if errorlevel 1 (
            echo   [warn] Fallo compilando CLI Java
        ) else (
            echo   [OK]   stockly-cli\target\stockly.jar generado
        )
        popd
    )
) else (
    echo   [SKIP] Maven no disponible, CLI Java no compilada
)

echo.
echo ============================================================
echo   Instalacion completada
echo ============================================================
echo   Lanza la aplicacion con:  start.bat
echo ============================================================
echo.
pause
endlocal
exit /b 0
