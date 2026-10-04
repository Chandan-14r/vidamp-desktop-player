@echo off
title VidAmp Player
cd /d "%~dp0"
echo ========================================================
echo   Launching VidAmp Player (VLC + MPC-HC Enhanced)
echo ========================================================

if not exist "dist\index.html" (
    echo Building Vite frontend...
    call npm run build
)

echo Starting Electron Desktop App...
npm start
if %ERRORLEVEL% NEQ 0 (
    echo Starting Standalone Desktop App Runner fallback...
    python launch-desktop.py
)
