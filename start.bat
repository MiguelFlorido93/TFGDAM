@echo off
chcp 65001 >nul
setlocal ENABLEDELAYEDEXPANSION

REM ========================================================================
REM Stockly - Lanzador completo (MySQL + Backend + Navegador)
REM Doble-click para arrancar todo. Cerrar la ventana = apaga el backend.
REM MySQL queda corriendo minimizado (usa stop.bat para apagarlo).
REM ========================================================================

REM Rutas por defecto (fallback si no se encuentra en PATH).
set "MYSQL_BIN_DEFAULT=C:\Program Files\MySQL\MySQL Server 8.4\bin"
set "NODE_BIN_DEFAULT=C:\Program Files\nodejs"
set "MYSQL_DATA=%LOCALAPPDATA%\MySQL\data"
set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "URL=http://localhost:3001/"

title Stockly Launcher
color 0E

echo.
echo ============================================================
echo   STOCKLY - Lanzador
echo ============================================================
echo.

REM --- Detectar Node.js ----------------------------------------------------
set "NODE_BIN="
for /f "delims=" %%P in ('where node 2^>nul') do (
    if not defined NODE_BIN (
        for %%D in ("%%~dpP.") do set "NODE_BIN=%%~fD"
    )
)
if not defined NODE_BIN (
    if exist "%NODE_BIN_DEFAULT%\node.exe" set "NODE_BIN=%NODE_BIN_DEFAULT%"
)
if not defined NODE_BIN (
    echo [ERROR] Node.js no encontrado en PATH ni en %NODE_BIN_DEFAULT%
    echo Instala Node LTS desde https://nodejs.org/ o ejecuta Stockly-Setup.exe
    echo.
    pause
    exit /b 1
)
if not exist "%NODE_BIN%\node.exe" (
    echo [ERROR] node.exe no esta en %NODE_BIN%
    pause
    exit /b 1
)

REM --- Detectar MySQL ------------------------------------------------------
set "MYSQL_BIN="
for /f "delims=" %%P in ('where mysqld 2^>nul') do (
    if not defined MYSQL_BIN (
        for %%D in ("%%~dpP.") do set "MYSQL_BIN=%%~fD"
    )
)
if not defined MYSQL_BIN (
    if exist "%MYSQL_BIN_DEFAULT%\mysqld.exe" set "MYSQL_BIN=%MYSQL_BIN_DEFAULT%"
)
if not defined MYSQL_BIN (
    for /f "delims=" %%D in ('dir /b /ad "C:\Program Files\MySQL" 2^>nul') do (
        if exist "C:\Program Files\MySQL\%%D\bin\mysqld.exe" set "MYSQL_BIN=C:\Program Files\MySQL\%%D\bin"
    )
)
if not defined MYSQL_BIN (
    echo [ERROR] MySQL no encontrado en PATH ni en %MYSQL_BIN_DEFAULT%
    echo Instala MySQL Server 8.x o ejecuta Stockly-Setup.exe
    echo.
    pause
    exit /b 1
)

echo   Node:  %NODE_BIN%
echo   MySQL: %MYSQL_BIN%
echo.

if not exist "%BACKEND_DIR%\node_modules" (
    echo Instalando dependencias de Node ^(primera vez^)...
    set "NPM_CMD=%NODE_BIN%\npm.cmd"
    if not exist "!NPM_CMD!" (
        for /f "delims=" %%P in ('where npm.cmd 2^>nul') do if not defined NPM_FOUND set "NPM_CMD=%%P" & set "NPM_FOUND=1"
    )
    pushd "%BACKEND_DIR%"
    call "!NPM_CMD!" install --no-audit --no-fund
    popd
)
if not exist "%BACKEND_DIR%\.env" (
    echo Generando backend\.env desde plantilla...
    copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
)
set "MYSQL_LOG=%PROJECT_DIR%mysql.log"
set "MYSQL_INIT_LOG=%PROJECT_DIR%mysql-init.log"

REM Considerar datadir valido si contiene la tabla de sistema 'mysql.ibd'.
REM (Solo comprobar la carpeta 'mysql\' no basta: puede existir vacia si el init fallo.)
set "MYSQL_INITIALIZED=0"
if exist "%MYSQL_DATA%\mysql.ibd" set "MYSQL_INITIALIZED=1"

if "!MYSQL_INITIALIZED!"=="0" (
    echo Inicializando MySQL en %MYSQL_DATA% ^(primera vez^)...
    if not exist "%LOCALAPPDATA%\MySQL" mkdir "%LOCALAPPDATA%\MySQL"
    REM Limpiar datadir si quedo a medio inicializar
    if exist "%MYSQL_DATA%" rmdir /S /Q "%MYSQL_DATA%" 2>nul
    mkdir "%MYSQL_DATA%"
    "%MYSQL_BIN%\mysqld.exe" --initialize-insecure --datadir="%MYSQL_DATA%" --console > "%MYSQL_INIT_LOG%" 2>&1
    if errorlevel 1 (
        echo [ERROR] Fallo inicializando MySQL. Log:
        echo ------------------------------------------------------------
        powershell -NoProfile -Command "Get-Content -Tail 30 '%MYSQL_INIT_LOG%'"
        echo ------------------------------------------------------------
        pause
        exit /b 1
    )
    if not exist "%MYSQL_DATA%\mysql.ibd" (
        echo [ERROR] Init aparente OK pero falta mysql.ibd. Log:
        echo ------------------------------------------------------------
        powershell -NoProfile -Command "Get-Content -Tail 30 '%MYSQL_INIT_LOG%'"
        echo ------------------------------------------------------------
        pause
        exit /b 1
    )
    echo   [OK]   Datadir inicializado.
)

REM Intentar parar cualquier servicio MySQL preexistente (requiere admin).
for /f "tokens=2" %%S in ('sc query state^= all ^| findstr /I "SERVICE_NAME.*MYSQL"') do (
    sc query "%%S" | findstr /I "RUNNING" >nul && (
        echo Intentando parar servicio MySQL preexistente: %%S
        net stop "%%S" >nul 2>&1
    )
)

REM Elegir puerto: 3306 si esta libre, si no 3307.
set "MYSQL_PORT=3306"
netstat -an | findstr /R /C:":3306.*LISTENING" >nul && set "MYSQL_PORT=3307"
if "%MYSQL_PORT%"=="3307" (
    echo :3306 sigue ocupado por otro MySQL ^(probablemente un servicio Windows^).
    echo Usando puerto alternativo :3307 para nuestra instancia.
    netstat -an | findstr /R /C:":3307.*LISTENING" >nul && (
        for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3307.*LISTENING"') do (
            echo Liberando :3307 ^(PID %%P^)...
            taskkill /F /PID %%P >nul 2>&1
        )
    )
)

REM Sincronizar backend\.env: DB_PORT al puerto en uso + DB_PASSWORD vacio
REM (nuestra instancia se inicializa con --initialize-insecure: root sin password).
if exist "%BACKEND_DIR%\.env" (
    powershell -NoProfile -Command "$f = '%BACKEND_DIR%\.env'; $c = Get-Content -LiteralPath $f; if ($c -match '^DB_PORT=') { $c = $c -replace '^DB_PORT=.*', 'DB_PORT=%MYSQL_PORT%' } else { $c += 'DB_PORT=%MYSQL_PORT%' }; if ($c -match '^DB_PASSWORD=') { $c = $c -replace '^DB_PASSWORD=.*', 'DB_PASSWORD=' } else { $c += 'DB_PASSWORD=' }; if ($c -match '^DB_USER=') { $c = $c -replace '^DB_USER=.*', 'DB_USER=root' } else { $c += 'DB_USER=root' }; if ($c -match '^DB_HOST=') { $c = $c -replace '^DB_HOST=.*', 'DB_HOST=127.0.0.1' } else { $c += 'DB_HOST=127.0.0.1' }; Set-Content -LiteralPath $f -Value $c -Encoding ASCII"
    if errorlevel 1 (
        echo [warn] No se pudo actualizar backend\.env
    ) else (
        echo Config DB sincronizada en backend\.env:
        powershell -NoProfile -Command "Select-String -LiteralPath '%BACKEND_DIR%\.env' -Pattern '^DB_' | ForEach-Object { '   ' + $_.Line }"
    )
)

REM Borrar log previo para que el "(sin log)" sea sintoma real
del "%MYSQL_LOG%" 2>nul

echo Arrancando MySQL en :%MYSQL_PORT% ^(datadir: %MYSQL_DATA%^)...
start "Stockly MySQL" /MIN cmd /c ""%MYSQL_BIN%\mysqld.exe" --datadir="%MYSQL_DATA%" --port=%MYSQL_PORT% --console > "%MYSQL_LOG%" 2>&1"

echo Esperando a MySQL...
set /a tries=0
:wait_mysql
"%MYSQL_BIN%\mysql.exe" -u root --protocol=TCP --host=127.0.0.1 --port=%MYSQL_PORT% --connect-timeout=2 -e "SELECT 1" >nul 2>&1
if !errorlevel! equ 0 goto mysql_ready
set /a tries+=1
if !tries! gtr 60 (
    echo.
    echo [ERROR] MySQL no respondio en 60s.
    echo Ultimas lineas del log ^(%MYSQL_LOG%^):
    echo ------------------------------------------------------------
    powershell -NoProfile -Command "if (Test-Path '%MYSQL_LOG%') { Get-Content -Tail 20 '%MYSQL_LOG%' } else { Write-Output '(sin log)' }"
    echo ------------------------------------------------------------
    echo Pistas comunes:
    echo  - Otro MySQL con root protegido por password ocupa :3306.
    echo  - Falta Visual C++ Redistributable para MySQL.
    echo  - El datadir %MYSQL_DATA% esta corrupto ^(borralo para reinicializar^).
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_mysql
:mysql_ready
echo [OK] MySQL listo.

set "MYSQL_CLI=%MYSQL_BIN%\mysql.exe -u root --protocol=TCP --host=127.0.0.1 --port=%MYSQL_PORT%"
"%MYSQL_BIN%\mysql.exe" -u root --protocol=TCP --host=127.0.0.1 --port=%MYSQL_PORT% -e "USE stockly" >nul 2>&1
if errorlevel 1 (
    echo Creando base de datos 'stockly' y cargando schema...
    "%MYSQL_BIN%\mysql.exe" -u root --protocol=TCP --host=127.0.0.1 --port=%MYSQL_PORT% -e "CREATE DATABASE IF NOT EXISTS stockly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    "%MYSQL_BIN%\mysql.exe" -u root --protocol=TCP --host=127.0.0.1 --port=%MYSQL_PORT% stockly < "%PROJECT_DIR%db\schema.sql"
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001.*LISTENING"') do (
    echo Cerrando proceso previo en :3001 ^(PID %%P^)...
    taskkill /F /PID %%P >nul 2>&1
)

set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    if not "!ip:~0,4!"=="169." if not "!ip!"=="127.0.0.1" (
        if not defined LAN_IP set "LAN_IP=!ip!"
    )
)

echo.
echo ============================================================
echo   Stockly corriendo
echo ============================================================
echo   Local:    %URL%
if defined LAN_IP echo   LAN:      http://!LAN_IP!:3001/
echo.
echo   Demo:  adrian@tfg.local / password123  (admin)
echo          laura@tfg.local  / password123  (operario)
echo          marcos@tfg.local / password123  (cliente)
echo.
echo   Cierra esta ventana o pulsa Ctrl+C para parar el backend.
echo ============================================================
echo.

REM Abrir navegador en background tras 4s (espera a que el backend este listo)
start /B "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process '%URL%'"

REM Backend en primer plano: cerrar ventana = matar backend
cd /d "%BACKEND_DIR%"
set "PATH=%NODE_BIN%;%PATH%"
"%NODE_BIN%\node.exe" server.js

echo.
echo [Backend detenido]
pause
