@echo off
setlocal

cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Install Node.js and npm, then run this file again.
  exit /b 1
)

echo Starting PostmanFox admin panel on http://localhost:45371
echo Press Ctrl+C to stop the local server.

call npm.cmd run dev

echo.
echo === Server stopped (exit code %ERRORLEVEL%) ===
pause
