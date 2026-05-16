@echo off
REM ============================================================
REM Stockly · Reset rápido del usuario root de MySQL (local)
REM Usa rutas relativas al directorio donde está este script.
REM ============================================================

setlocal

REM Carpeta del propio script (termina en \)
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

set "LOG=%SCRIPT_DIR%reset_mysql.log"
set "INIT_SQL=%SCRIPT_DIR%reset_mysql.sql"

REM 1) Runtime portable embebido (si lo hay).
REM 2) mysqld desde PATH.
REM 3) Cualquier "C:\Program Files\MySQL\MySQL Server X.X\bin" instalado.
set "MYSQL_BIN=%PROJECT_DIR%\runtime\mysql\bin"
if not exist "%MYSQL_BIN%\mysqld.exe" set "MYSQL_BIN="
if not defined MYSQL_BIN (
    for /f "delims=" %%P in ('where mysqld 2^>nul') do if not defined MYSQL_BIN for %%D in ("%%~dpP.") do set "MYSQL_BIN=%%~fD"
)
if not defined MYSQL_BIN (
    for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\MySQL" 2^>nul') do (
        if exist "%ProgramFiles%\MySQL\%%D\bin\mysqld.exe" set "MYSQL_BIN=%ProgramFiles%\MySQL\%%D\bin"
    )
)
if not defined MYSQL_BIN (
    echo [ERROR] No se encontro mysqld en PATH ni en %ProgramFiles%\MySQL\
    exit /b 1
)

echo === %DATE% %TIME% === > "%LOG%"
echo Usando MYSQL_BIN=%MYSQL_BIN% >> "%LOG%"

echo --- Parando servicio MySQL80 (si existe) --- >> "%LOG%"
net stop MySQL80 >> "%LOG%" 2>&1

echo --- Matando cualquier mysqld residual --- >> "%LOG%"
taskkill /F /IM mysqld.exe >> "%LOG%" 2>&1
timeout /t 3 /nobreak > nul

echo --- Arrancando mysqld con --init-file --- >> "%LOG%"
start "mysqld-reset" /B "%MYSQL_BIN%\mysqld.exe" --init-file="%INIT_SQL%" --skip-networking --console >> "%LOG%" 2>&1

echo --- Esperando 12 segundos para que aplique el init-file --- >> "%LOG%"
timeout /t 12 /nobreak > nul

echo --- Parando mysqld temporal --- >> "%LOG%"
taskkill /F /IM mysqld.exe >> "%LOG%" 2>&1
timeout /t 4 /nobreak > nul

echo --- Arrancando servicio MySQL80 (si existe) --- >> "%LOG%"
net start MySQL80 >> "%LOG%" 2>&1

echo --- DONE --- >> "%LOG%"
endlocal
