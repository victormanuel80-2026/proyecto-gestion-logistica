@echo off
chcp 65001 > nul
title Subir Proyecto a GitHub
echo ========================================================
echo   SUBIENDO PROYECTO A GITHUB (victormanuel80-2026)
echo ========================================================
echo.
cd /d "c:\proyecto gestion logistica"
echo Subiendo archivos a GitHub...
git push -u origin main
echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo   EXITO: Todos los archivos se han subido a GitHub.
) else (
    echo   Hubo un problema. Revisa el mensaje de arriba.
)
echo ========================================================
echo.
pause
