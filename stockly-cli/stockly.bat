@echo off
REM ===================================================================
REM Stockly CLI — wrapper para usar `stockly <comando>` sin teclear
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

REM Rutas locales — ajusta JAVA_HOME si tu JDK 17 está en otro sitio
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "JAR=%~dp0target\stockly.jar"

if not exist "%JAVA_HOME%\bin\java.exe" (
    echo [ERROR] No encuentro Java 17 en: %JAVA_HOME%
    echo Ajusta JAVA_HOME al inicio de este .bat
    exit /b 1
)
if not exist "%JAR%" (
    echo [ERROR] No encuentro el JAR en: %JAR%
    echo Compila primero con `mvn package` en stockly-cli\
    exit /b 1
)

"%JAVA_HOME%\bin\java.exe" -jar "%JAR%" %*
exit /b %ERRORLEVEL%
