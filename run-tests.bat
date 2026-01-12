@echo off
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
