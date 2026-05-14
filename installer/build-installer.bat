@echo off
REM Genera Stockly-Setup.exe a partir de installer.sed.tpl usando IExpress.
REM Las rutas se calculan desde la ubicacion de este .bat, asi que el proyecto
REM puede estar en cualquier carpeta.
setlocal

set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"
for %%I in ("%HERE%\..") do set "ROOT=%%~fI"

set "SED_TPL=%HERE%\installer.sed.tpl"
set "SED_OUT=%HERE%\installer.sed"
set "TARGET_EXE=%ROOT%\Stockly-Setup.exe"

if not exist "%SED_TPL%" (
    echo [ERR] No existe la plantilla: %SED_TPL%
    exit /b 1
)

REM Sustituye los placeholders __TARGET_EXE__ y __SOURCE_DIR__ en la plantilla.
powershell -NoProfile -Command ^
  "$t = Get-Content -Raw -LiteralPath '%SED_TPL%';" ^
  "$t = $t.Replace('__TARGET_EXE__','%TARGET_EXE%').Replace('__SOURCE_DIR__','%HERE%\');" ^
  "Set-Content -LiteralPath '%SED_OUT%' -Value $t -Encoding ASCII"

if errorlevel 1 (
    echo [ERR] No se pudo generar installer.sed
    exit /b 1
)

echo Generando %TARGET_EXE% ...
"%WINDIR%\System32\iexpress.exe" /N "%SED_OUT%"
if errorlevel 1 (
    echo [ERR] iexpress fallo
    exit /b 1
)

echo [OK] %TARGET_EXE%
endlocal
