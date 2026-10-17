@echo off
title AKASH TUNNEL MAPPER - Windows Desktop Installer (.EXE) Builder
color 0B
echo ============================================================================
echo   AKASH TUNNEL MAPPER - 1-CLICK WINDOWS DESKTOP INSTALLER (.EXE) BUILDER
echo   Builds TWO Standalone Windows Executables:
echo     1. AKASH-TUNNEL-MAPPER-Master-Setup.exe (Master Software - Owner Only)
echo     2. AKASH-TUNNEL-MAPPER-User-Setup.exe   (User Software - Share with Users)
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Installing npm dependencies...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Building Both Master ^& User Windows Desktop Installers (.exe)...
set CI=false
call npm run build:electron
if %errorlevel% neq 0 (
    echo [ERROR] Electron Builder failed!
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   [3/3] SUCCESS! Both Windows Installers are ready inside "release":
echo     1. release\AKASH-TUNNEL-MAPPER-Master-Setup.exe (Master Software - For You)
echo     2. release\AKASH-TUNNEL-MAPPER-User-Setup.exe   (User Software - For Users)
echo ============================================================================
if exist "release" explorer "release"
pause
