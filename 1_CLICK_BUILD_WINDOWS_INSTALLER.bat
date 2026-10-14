@echo off
title AKASH TUNNEL MAPPER - 1-Click Dual Windows Installer Builder (.EXE)
color 0B
echo.
echo  =======================================================================================
echo   AKASH TUNNEL MAPPER - 1-CLICK DUAL WINDOWS INSTALLER BUILDER (.EXE)
echo   Builds TWO Executables:
echo     1. AKASH-TUNNEL-MAPPER-Master-Setup.exe (Master Software - Only For You)
echo     2. AKASH-TUNNEL-MAPPER-User-Setup.exe   (User Software - Share With Users)
echo  =======================================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed on this Windows PC!
    echo  Please install Node.js LTS from https://nodejs.org/ and run this file again.
    echo.
    pause
    exit /b 1
)

echo  [1/3] Checking / Installing Dependencies...
if not exist "node_modules\electron-builder" (
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Failed to install dependencies. Please check your internet connection.
        pause
        exit /b 1
    )
)

echo.
echo  [2/3] Building Both Master ^& User Windows .EXE Installers...
set CI=false
call npm run build:electron
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed! Please check the error output above.
    pause
    exit /b 1
)

echo.
echo  =======================================================================================
echo   [3/3] BUILD COMPLETE!
echo   Your two Windows Desktop Installers (.EXE) are ready inside the "release" folder:
echo     - release\AKASH-TUNNEL-MAPPER-Master-Setup.exe
echo     - release\AKASH-TUNNEL-MAPPER-User-Setup.exe
echo  =======================================================================================
echo.
if exist "release" (
    explorer "release"
)
pause
