@echo off
title Subir Proyecto a GitHub - EveCost
cd /d "D:\control de gastos productoras app"
echo ========================================================
echo  SUBIENDO CODIGO A GITHUB
echo  Repositorio: https://github.com/renzo1111ia/control-de-eventos-evecost-
echo ========================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo  LISTO! Codigo subido exitosamente a GitHub.
    echo ========================================================
) else (
    echo ========================================================
    echo  Hubo un detalle con la autenticacion.
    echo  Si se abrio tu navegador, inicia sesion en GitHub.
    echo ========================================================
)
pause
