@echo off
echo ========================================
echo   Test Automation Setup - Windows
echo ========================================
echo.
echo This will install everything you need.
echo Please wait, this may take a few minutes...
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download the LTS version
    echo 3. Install it
    echo 4. Close and reopen this window
    echo 5. Run this script again
    echo.
    pause
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Installing Playwright browsers...
call npx playwright install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Playwright installation failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo You can now run tests with:
echo   npm run test:all
echo.
pause
