@echo off
REM Para el mysqld portable arrancado por start.bat
setlocal
set "SCRIPT_DIR=%~dp0"
set "MYSQL_BIN=%SCRIPT_DIR%..\runtime\mysql\bin"

if exist "%MYSQL_BIN%\mysqladmin.exe" (
    "%MYSQL_BIN%\mysqladmin.exe" -u root --protocol=TCP -h 127.0.0.1 -P 3306 shutdown
) else (
    taskkill /F /IM mysqld.exe
)
endlocal
