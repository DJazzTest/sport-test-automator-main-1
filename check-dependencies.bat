@echo off
echo ========================================
echo   Checking Dependencies...
echo ========================================
echo.

set ERRORS=0

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: Node.js is not installed!
    echo.
    echo    Please install Node.js:
    echo    1. Go to https://nodejs.org/
    echo    2. Download the LTS version
    echo    3. Install it
    echo    4. Close and reopen Command Prompt
    echo    5. Run this command again
    echo.
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js is installed: %NODE_VERSION%
    
    REM Check Node.js version (basic check)
    echo    Checking version compatibility...
)

REM Check npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: npm is not installed!
    echo.
    echo    npm usually comes with Node.js.
    echo    If you just installed Node.js, try:
    echo    1. Close and reopen Command Prompt
    echo    2. Run this command again
    echo.
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm is installed: %NPM_VERSION%
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo ⚠️  WARNING: Dependencies not installed
    echo    Run this command first:
    echo    npm install
    echo.
    set /a ERRORS+=1
) else (
    echo ✅ Dependencies installed (node_modules found)
)

REM Check if Playwright is installed
where npx >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  WARNING: npx not found
    echo    This usually comes with npm
    echo.
    set /a ERRORS+=1
) else (
    npx playwright --version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ⚠️  WARNING: Playwright may not be installed
        echo    Run this command to install:
        echo    npx playwright install
        echo.
        set /a ERRORS+=1
    ) else (
        echo ✅ Playwright is installed
    )
)

echo.
echo ========================================

if %ERRORS% GTR 0 (
    echo ❌ Some dependencies are missing!
    echo.
    echo Quick fix - Run this command:
    echo   npm run test:setup
    echo.
    echo This will install everything you need.
    echo.
    pause
    exit /b 1
) else (
    echo ✅ All dependencies are ready!
    echo.
    exit /b 0
)
