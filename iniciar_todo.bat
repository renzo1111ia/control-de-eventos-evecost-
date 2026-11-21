@echo off
title Lanzador General - Control de Productoras App
echo ========================================================
echo   LANZANDO APP CONTROL DE GASTOS Y ACCESO PARA PRODUCTORAS
echo ========================================================
echo 1. Iniciando Backend API en ventana separada (Puerto 4000)...
start "Backend API" cmd /k "cd /d %~dp0backend && npm start"

echo 2. Esperando 2 segundos para levantar base de datos...
timeout /t 2 /nobreak >nul

echo 3. Iniciando Frontend Web en ventana separada (Puerto 5173)...
start "Frontend Web" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo   SISTEMA ACTIVO!
echo   Abre tu navegador en: http://localhost:5173
echo ========================================================
pause
