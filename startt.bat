@echo off
title Deal Master PRO Deal Launcher
color 0a

echo ==============================
echo    Deal Master PRO DEAL BASLATILIYOR
echo ==============================
echo.

:: SERVER BASLAT
echo [SERVER] Baslatiliyor...
start "SERVER LOG" cmd /k "cd /d "%~dp0server" && npm run dev"


pause