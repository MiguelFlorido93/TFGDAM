@echo off
REM Lanza el instalador PowerShell con rutas relativas.
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
endlocal & exit /b %EXITCODE%
