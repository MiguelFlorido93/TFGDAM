@echo off
REM ===================================================================
REM Stockly CLI - Consola interactiva
REM Abre una shell ya situada en la carpeta del CLI, con el wrapper
REM "stockly" en el PATH. Puedes teclear comandos uno tras otro:
REM
REM   stockly                               muestra ayuda
REM   stockly login --email X --password Y
REM   stockly productos --search taladro
REM   stockly stock-bajo
REM   stockly import sample-productos.csv --apply
REM   exit                                  cerrar
REM ===================================================================
setlocal

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

REM Localizar la carpeta bin del JDK (para anteponerla al PATH). Si java ya
REM esta en el PATH del sistema, no hace falta - dejamos JAVA_BIN vacio.
set "JAVA_BIN="
where java >nul 2>&1
if errorlevel 1 (
    if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_BIN=%JAVA_HOME%\bin"
    if not defined JAVA_BIN (
        for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Microsoft" 2^>nul ^| findstr /I "jdk-17"') do (
            if exist "%ProgramFiles%\Microsoft\%%D\bin\java.exe" set "JAVA_BIN=%ProgramFiles%\Microsoft\%%D\bin"
        )
    )
    if not defined JAVA_BIN (
        for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Eclipse Adoptium" 2^>nul ^| findstr /I "jdk-17"') do (
            if exist "%ProgramFiles%\Eclipse Adoptium\%%D\bin\java.exe" set "JAVA_BIN=%ProgramFiles%\Eclipse Adoptium\%%D\bin"
        )
    )
)

title Stockly CLI - Consola Java

REM Anteponemos la carpeta del CLI (para resolver `stockly`) y, si hace falta,
REM la carpeta bin del JDK localizado.
if defined JAVA_BIN (
    set "EXTRA_PATH=%DIR%;%JAVA_BIN%"
) else (
    set "EXTRA_PATH=%DIR%"
)

cmd /k "set PATH=%EXTRA_PATH%;%PATH%& chcp 65001 >nul& color 0E& cd /d "%DIR%" & echo. & echo === Stockly CLI ^| Java 17 + Jackson + OpenCSV === & echo. & echo Comandos disponibles: & stockly & echo. & echo Escribe los comandos que quieras. 'exit' para cerrar. & echo."
