@echo off
set LOG=C:\Users\adria\OneDrive\Escritorio\tfg\TFGDAM\scripts\reset_mysql.log
set MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.0\bin
set INIT_SQL=C:\Users\adria\OneDrive\Escritorio\tfg\TFGDAM\scripts\reset_mysql.sql

echo === %DATE% %TIME% === > "%LOG%"

echo --- Parando servicio MySQL80 --- >> "%LOG%"
net stop MySQL80 >> "%LOG%" 2>&1

echo --- Matando cualquier mysqld residual --- >> "%LOG%"
taskkill /F /IM mysqld.exe >> "%LOG%" 2>&1
timeout /t 3 /nobreak > nul

echo --- Arrancando mysqld con --init-file --- >> "%LOG%"
start "mysqld-reset" /B "%MYSQL_BIN%\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" --init-file="%INIT_SQL%" --skip-networking --console >> "%LOG%" 2>&1

echo --- Esperando 12 segundos para que aplique el init-file --- >> "%LOG%"
timeout /t 12 /nobreak > nul

echo --- Parando mysqld temporal --- >> "%LOG%"
taskkill /F /IM mysqld.exe >> "%LOG%" 2>&1
timeout /t 4 /nobreak > nul

echo --- Arrancando servicio MySQL80 --- >> "%LOG%"
net start MySQL80 >> "%LOG%" 2>&1

echo --- DONE --- >> "%LOG%"
