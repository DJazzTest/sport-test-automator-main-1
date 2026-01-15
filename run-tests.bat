@echo off
REM Check dependencies first
if exist "check-dependencies.bat" (
    call check-dependencies.bat
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo Please install missing dependencies and try again.
        pause
        exit /b 1
    )
    echo.
)

echo ========================================
echo   Running All Tests
echo ========================================
echo.
echo This will run all automated tests.
echo Please wait, this may take 5-10 minutes...
echo.

call npm run test:all

echo.
echo ========================================
echo   Tests Complete!
echo ========================================
echo.
pause
