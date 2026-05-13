@echo off
REM ============================================================
REM Stockly · Arranque local
REM Arranca MySQL portable + backend Node, todo con rutas relativas.
REM Ctrl+C en esta ventana para parar el backend; MySQL se queda
REM corriendo en segundo plano (cerrar con stop.bat).
REM ============================================================
setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "RUNTIME=%PROJECT_DIR%\runtime"
set "MYSQL_BIN=%RUNTIME%\mysql\bin"
set "MYSQL_DATA=%RUNTIME%\mysql-data"
set "NODE_BIN=%RUNTIME%\node"
set "BACKEND=%PROJECT_DIR%\backend"

if not exist "%MYSQL_BIN%\mysqld.exe" (
    echo [ERROR] No se encuentra MySQL portable. Ejecuta scripts\install.bat primero.
    pause
    exit /b 1
)
if not exist "%NODE_BIN%\node.exe" (
    echo [ERROR] No se encuentra Node portable. Ejecuta scripts\install.bat primero.
    pause
    exit /b 1
)

REM ¿MySQL ya corriendo?
tasklist /FI "IMAGENAME eq mysqld.exe" | find /I "mysqld.exe" >nul
if errorlevel 1 (
    echo --- Arrancando MySQL portable ---
    start "stockly-mysql" /B "%MYSQL_BIN%\mysqld.exe" --datadir="%MYSQL_DATA%" --port=3306
    REM Pequeña espera para que abra el socket TCP
    timeout /t 4 /nobreak > nul
) else (
    echo --- MySQL ya estaba en ejecución ---
)

set "PATH=%NODE_BIN%;%PATH%"
echo --- Arrancando backend en http://localhost:3001 ---
cd /d "%BACKEND%"
"%NODE_BIN%\node.exe" server.js

endlocal
