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
echo   Running PlanetF1 Test
echo ========================================
echo.
echo This will run the PlanetF1 test only.
echo Please wait...
echo.

call npm run test:planetf1

echo.
echo ========================================
echo   Test Complete!
echo ========================================
echo.
pause
