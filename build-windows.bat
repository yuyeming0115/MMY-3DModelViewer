@echo off
title MMY-3DModelViewer Build
cd /d "%~dp0"
echo ==========================================
echo   MMY-3DModelViewer Windows Build
echo ==========================================
echo.
echo Starting PowerShell script...
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0build-windows.ps1"
echo.
pause
