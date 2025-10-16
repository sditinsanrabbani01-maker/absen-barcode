@echo off
echo Starting Absensi Barcode with Camera Access...
echo.

REM Check if Chrome exists
where chrome >nul 2>nul
if %errorlevel% neq 0 (
    echo Chrome not found. Please install Google Chrome or use one of the alternative solutions in README.md
    pause
    exit /b 1
)

REM Create temp directory for Chrome profile
if not exist "C:\temp" mkdir "C:\temp"
if not exist "C:\temp\chrome-dev" mkdir "C:\temp\chrome-dev"

REM Start Chrome with camera access flags
start chrome.exe --unsafely-treat-insecure-origin-as-secure=http://localhost:5173 --user-data-dir="C:\temp\chrome-dev" http://localhost:5173

echo Chrome opened with camera access enabled.
echo If the app doesn't load, wait for the dev server to start (npm run dev)
echo.
pause