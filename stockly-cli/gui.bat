@echo off
REM ===================================================================
REM Stockly - Cliente Java con GUI (Swing + FlatLaf)
REM Doble-click para lanzar la ventana de escritorio.
REM ===================================================================
setlocal

set "JAR=%~dp0target\stockly.jar"

REM Localizar javaw en PATH; si no esta, probar JAVA_HOME del entorno; si no,
REM rutas comunes de Microsoft OpenJDK 17 / Eclipse Temurin.
set "JAVAW_EXE="
for /f "delims=" %%P in ('where javaw 2^>nul') do if not defined JAVAW_EXE set "JAVAW_EXE=%%P"
if not defined JAVAW_EXE if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javaw.exe" set "JAVAW_EXE=%JAVA_HOME%\bin\javaw.exe"
if not defined JAVAW_EXE (
    for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Microsoft" 2^>nul ^| findstr /I "jdk-17"') do (
        if exist "%ProgramFiles%\Microsoft\%%D\bin\javaw.exe" set "JAVAW_EXE=%ProgramFiles%\Microsoft\%%D\bin\javaw.exe"
    )
)
if not defined JAVAW_EXE (
    for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Eclipse Adoptium" 2^>nul ^| findstr /I "jdk-17"') do (
        if exist "%ProgramFiles%\Eclipse Adoptium\%%D\bin\javaw.exe" set "JAVAW_EXE=%ProgramFiles%\Eclipse Adoptium\%%D\bin\javaw.exe"
    )
)

if not defined JAVAW_EXE (
    echo [ERROR] javaw no encontrado en PATH ni en ubicaciones conocidas.
    echo Instala JDK 17 ^(p.ej. winget install Microsoft.OpenJDK.17^) y reabre la consola.
    pause & exit /b 1
)
if not exist "%JAR%" (
    echo [ERROR] No encuentro el JAR. Compila primero con `mvn package`.
    pause & exit /b 1
)

REM javaw.exe (sin consola) - la GUI no necesita stdout
start "" "%JAVAW_EXE%" -jar "%JAR%" gui
exit /b 0
