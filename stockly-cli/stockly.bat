@echo off
REM ===================================================================
REM Stockly CLI - wrapper para `stockly <comando>` sin teclear
REM "java -jar target\stockly.jar" cada vez.
REM
REM Uso:
REM   stockly                        muestra el help
REM   stockly login --email X        autentica
REM   stockly productos --search X   lista productos
REM   stockly stock-bajo
REM   stockly reservar --sku X --cantidad N
REM   stockly import productos.csv [--apply]
REM ===================================================================
setlocal

set "JAR=%~dp0target\stockly.jar"

REM Localizar java en PATH; si no esta, probar JAVA_HOME del entorno; si no,
REM rutas comunes de Microsoft OpenJDK 17 / Eclipse Temurin.
set "JAVA_EXE="
for /f "delims=" %%P in ('where java 2^>nul') do if not defined JAVA_EXE set "JAVA_EXE=%%P"
if not defined JAVA_EXE if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
if not defined JAVA_EXE (
    for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Microsoft" 2^>nul ^| findstr /I "jdk-17"') do (
        if exist "%ProgramFiles%\Microsoft\%%D\bin\java.exe" set "JAVA_EXE=%ProgramFiles%\Microsoft\%%D\bin\java.exe"
    )
)
if not defined JAVA_EXE (
    for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Eclipse Adoptium" 2^>nul ^| findstr /I "jdk-17"') do (
        if exist "%ProgramFiles%\Eclipse Adoptium\%%D\bin\java.exe" set "JAVA_EXE=%ProgramFiles%\Eclipse Adoptium\%%D\bin\java.exe"
    )
)

if not defined JAVA_EXE (
    echo [ERROR] Java no encontrado en PATH ni en ubicaciones conocidas.
    echo Instala JDK 17 ^(p.ej. winget install Microsoft.OpenJDK.17^) y reabre la consola.
    exit /b 1
)
if not exist "%JAR%" (
    echo [ERROR] No encuentro el JAR en: %JAR%
    echo Compila primero con `mvn package` en stockly-cli\
    exit /b 1
)

"%JAVA_EXE%" -jar "%JAR%" %*
exit /b %ERRORLEVEL%
