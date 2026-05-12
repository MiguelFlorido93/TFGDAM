@echo off
REM ===================================================================
REM Stockly CLI — Consola interactiva
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
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"

title Stockly CLI — Consola Java

REM Pasamos el directorio del CLI al inicio del PATH para que `stockly`
REM resuelva al .bat wrapper y no haya que escribir rutas.
cmd /k "set PATH=%DIR%;%JAVA_HOME%\bin;%PATH%& chcp 65001 >nul& color 0E& cd /d "%DIR%" & echo. & echo === Stockly CLI ^| Java 17 + Jackson + OpenCSV === & echo. & echo Comandos disponibles: & stockly & echo. & echo Escribe los comandos que quieras. 'exit' para cerrar. & echo."
