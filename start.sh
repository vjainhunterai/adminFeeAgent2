#!/bin/bash
# hunterAI AdminFee Automation - Start Script
# Starts both backend (FastAPI) and frontend (React) servers

echo "============================================="
echo "  hunterAI AdminFee Automation"
echo "============================================="
echo ""

# Start backend
echo "Starting backend API server on port 8000..."
cd "$(dirname "$0")"
python run_backend.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Start frontend
echo "Starting frontend dev server on port 3000..."
cd frontend
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "============================================="
echo "  Backend API:  http://localhost:8000"
echo "  Frontend App: http://localhost:3000"
echo "  API Docs:     http://localhost:8000/docs"
echo "============================================="
echo ""
echo "Press Ctrl+C to stop both servers"

# Trap Ctrl+C to kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
