@echo off
echo Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in your PATH.
    echo Please install it from https://nodejs.org/
    pause
    exit /b
)

echo Installing dependencies (if missing)...
if not exist node_modules (
    call npm install
)

echo Starting Backend Server...
node index.js
pause
