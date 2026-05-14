@echo off
chcp 65001 >nul
setlocal ENABLEDELAYEDEXPANSION

REM ========================================================================
REM Stockly - Instalador de dependencias
REM Ejecuta npm install y prepara el entorno. Genera install.log con la
REM salida completa para diagnosticar problemas.
REM ========================================================================

set "MYSQL_BIN=D:\Program Files\MySQL\MySQL Server 8.4\bin"
set "MYSQL_DATA=%LOCALAPPDATA%\MySQL\data"
set "NODE_BIN=D:\Program Files\nodejs"
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "CLI_DIR=%PROJECT_DIR%stockly-cli"
set "LOG=%PROJECT_DIR%install.log"

title Stockly Installer
color 0B

echo. > "%LOG%"
echo ============================================================
echo   STOCKLY - Instalador de dependencias
echo ============================================================
echo   Log completo: install.log
echo.

set "ERRORS=0"
set "HAS_JAVA=0"
set "HAS_MVN=0"

REM --- Prerrequisitos -----------------------------------------------------
echo [1/6] Comprobando prerrequisitos...

if exist "%NODE_BIN%\node.exe" (
    echo   [OK]   Node.js: %NODE_BIN%
) else (
    echo   [ERR]  Node.js NO encontrado en %NODE_BIN%
    set /a ERRORS+=1
)

if exist "%MYSQL_BIN%\mysqld.exe" (
    echo   [OK]   MySQL: %MYSQL_BIN%
) else (
    echo   [ERR]  MySQL NO encontrado en %MYSQL_BIN%
    set /a ERRORS+=1
)

if exist "%JAVA_HOME%\bin\java.exe" (
    echo   [OK]   Java 17: %JAVA_HOME%
    set "HAS_JAVA=1"
) else (
    echo   [warn] Java 17 NO encontrado (opcional, solo CLI)
)

where mvn >nul 2>&1
if !errorlevel! equ 0 (
    echo   [OK]   Maven en PATH
    set "HAS_MVN=1"
) else (
    echo   [warn] Maven no encontrado (opcional)
)

echo.
if !ERRORS! gtr 0 (
    echo [ABORTAR] Faltan !ERRORS! dependencias obligatorias.
    echo Instala Node y/o MySQL, o edita las rutas en la cabecera de este .bat
    pause
    exit /b 1
)

REM --- npm raiz -----------------------------------------------------------
echo [2/6] Instalando dependencias npm de la raiz...
pushd "%PROJECT_DIR%"
call "%NODE_BIN%\npm.cmd" install --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 (
    echo   [ERR]  npm install fallo en la raiz. Mira install.log
    popd
    pause
    exit /b 1
)
echo   [OK]   Dependencias raiz instaladas
popd

REM --- npm backend --------------------------------------------------------
echo [3/6] Instalando dependencias npm del backend...
pushd "%BACKEND_DIR%"
call "%NODE_BIN%\npm.cmd" install --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 (
    echo   [ERR]  npm install fallo en el backend. Mira install.log
    popd
    pause
    exit /b 1
)
echo   [OK]   Dependencias backend instaladas
popd

REM --- .env ---------------------------------------------------------------
echo [4/6] Configurando backend\.env...
if exist "%BACKEND_DIR%\.env" (
    echo   [OK]   backend\.env ya existe
) else (
    if exist "%BACKEND_DIR%\.env.example" (
        copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
        echo   [OK]   Generado backend\.env desde plantilla
    ) else (
        echo   [warn] No hay .env ni .env.example
    )
)

REM --- MySQL datadir ------------------------------------------------------
echo [5/6] Inicializando datos de MySQL...
if exist "%MYSQL_DATA%\mysql" (
    echo   [OK]   Datadir ya inicializado en %MYSQL_DATA%
) else (
    if not exist "%LOCALAPPDATA%\MySQL" mkdir "%LOCALAPPDATA%\MySQL"
    echo   Inicializando en %MYSQL_DATA% (puede tardar)...
    "%MYSQL_BIN%\mysqld.exe" --initialize-insecure --datadir="%MYSQL_DATA%" --console >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo   [ERR]  Fallo inicializando MySQL. Mira install.log
        pause
        exit /b 1
    )
    echo   [OK]   MySQL inicializado
)

REM --- CLI Java -----------------------------------------------------------
echo [6/6] CLI Java (opcional)...
if not "!HAS_JAVA!"=="1" (
    echo   [SKIP] Java no disponible
    goto done
)
if not "!HAS_MVN!"=="1" (
    if exist "%CLI_DIR%\target\stockly.jar" (
        echo   [OK]   JAR ya compilado en stockly-cli\target
    ) else (
        echo   [SKIP] Maven no disponible y no hay JAR previo
    )
    goto done
)
pushd "%CLI_DIR%"
echo   Compilando con Maven...
call mvn -q package >> "%LOG%" 2>&1
if errorlevel 1 (
    echo   [warn] Fallo compilando la CLI Java. Mira install.log
) else (
    echo   [OK]   stockly-cli\target\stockly.jar generado
)
popd

:done
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
