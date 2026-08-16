@echo off
title Master Deal Launcher
color 0a

echo ==============================
echo    Master DEAL BASLATILIYOR
echo ==============================
echo.

:: SERVER BASLAT
echo [SERVER] Baslatiliyor...
start "SERVER LOG" cmd /k "cd /d "%~dp0" && npm run dev"

pause