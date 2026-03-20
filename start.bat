@echo off
REM =============================================
REM  hunterAI GPO AdminFee Reconciliation Agent
REM  Windows Startup Script
REM =============================================

echo.
echo =============================================
echo   hunterAI GPO AdminFee Reconciliation Agent
echo =============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10+ from https://www.python.org
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM Install Python dependencies
echo [1/4] Installing Python dependencies...
pip install -r backend\requirements.txt --quiet

REM Install Node dependencies
echo [2/4] Installing frontend dependencies...
cd frontend
call npm install --silent
cd ..

REM Start backend in a new window
echo [3/4] Starting Backend API on port 8000...
start "hunterAI Backend" cmd /k "cd /d %~dp0 && python run_backend.py"

REM Wait for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
echo [4/4] Starting Frontend on port 3000...
start "hunterAI Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo =============================================
echo   Backend API:  http://localhost:8000
echo   Frontend App: http://localhost:3000
echo   API Docs:     http://localhost:8000/docs
echo =============================================
echo.
echo Both servers started in separate windows.
echo Close those windows to stop the servers.
echo.
pause
