@echo off
REM ===================================================================
REM Stockly CLI — Demo interactiva
REM Doble-click para ver el CLI en acción. Requiere backend corriendo
REM en http://localhost:3001 (lanza primero `start.bat` del proyecto).
REM ===================================================================
chcp 65001 >nul
setlocal

set "BAT=%~dp0stockly.bat"

title Stockly CLI — Demo
color 0E
echo.
echo ============================================================
echo   STOCKLY CLI — DEMO
echo ============================================================
echo.
echo Esto va a ejecutar varios comandos contra el backend.
echo Asegurate de que el backend esta corriendo (start.bat).
echo.
pause

echo.
echo --- 1. LOGIN como admin ---
echo.
call "%BAT%" login --email adrian@tfg.local --password password123
if errorlevel 1 (
    echo.
    echo [ERROR] Login fallido. ¿Esta el backend en http://localhost:3001?
    pause
    exit /b 1
)

echo.
echo.
echo --- 2. PRODUCTOS (busqueda "taladro", limite 5) ---
echo.
call "%BAT%" productos --search taladro --limit 5

echo.
echo.
echo --- 3. STOCK-BAJO ---
echo.
call "%BAT%" stock-bajo

echo.
echo.
echo --- 4. IMPORT (dry-run, no inserta) ---
echo.
call "%BAT%" import "%~dp0sample-productos.csv"

echo.
echo.
echo --- 5. CONFIG actual ---
echo.
call "%BAT%" config

echo.
echo ============================================================
echo   FIN DE LA DEMO
echo ============================================================
echo.
pause
