@echo off
echo ========================================
echo   Run a Single Test
echo ========================================
echo.
echo Which test would you like to run?
echo.
echo   1. Cricket (PSG)
echo   2. Football (PSG)
echo   3. Tennis (PSG)
echo   4. NFL (PSG)
echo   5. PlanetF1
echo   6. StarSports Cricket
echo   7. StarSports Football
echo   8. StarSports Tennis
echo   9. StarSports NFL
echo  10. Vodacom Comprehensive
echo  11. Vodacom Quick
echo.
set /p choice="Enter number (1-11): "

if "%choice%"=="1" (
    call npm run test:cricket
) else if "%choice%"=="2" (
    call npm run test:football
) else if "%choice%"=="3" (
    call npm run test:tennis
) else if "%choice%"=="4" (
    call npm run test:nfl
) else if "%choice%"=="5" (
    call npm run test:planetf1
) else if "%choice%"=="6" (
    call npm run test:starsports:cricket
) else if "%choice%"=="7" (
    call npm run test:starsports:football
) else if "%choice%"=="8" (
    call npm run test:starsports:tennis
) else if "%choice%"=="9" (
    call npm run test:starsports:nfl
) else if "%choice%"=="10" (
    call npm run test:vodacom:comprehensive
) else if "%choice%"=="11" (
    call npm run test:vodacom:quick
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Test Complete!
echo ========================================
echo.
pause
