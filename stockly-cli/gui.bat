@echo off
REM ===================================================================
REM Stockly · Cliente Java con GUI (Swing + FlatLaf)
REM Doble-click para lanzar la ventana de escritorio.
REM ===================================================================
setlocal

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "JAR=%~dp0target\stockly.jar"

if not exist "%JAVA_HOME%\bin\javaw.exe" (
    echo [ERROR] No encuentro Java 17 en: %JAVA_HOME%
    pause & exit /b 1
)
if not exist "%JAR%" (
    echo [ERROR] No encuentro el JAR. Compila primero con `mvn package`.
    pause & exit /b 1
)

REM javaw.exe (sin consola) — la GUI no necesita stdout
start "" "%JAVA_HOME%\bin\javaw.exe" -jar "%JAR%" gui
exit /b 0
