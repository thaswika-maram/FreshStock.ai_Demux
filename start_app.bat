@echo off
title FreshStock AI - E-Grocery Stock Planning Launcher
echo ===================================================
echo     Starting FreshStock AI Full-Stack App
echo ===================================================
echo.

echo [1/2] Launching FastAPI ML Backend on http://127.0.0.1:8000 ...
start "FreshStock Backend (FastAPI)" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Launching React Vite Frontend on http://localhost:5173 ...
cd frontend
start "FreshStock Frontend (Vite)" cmd /k "npm.cmd run dev"

echo.
echo ===================================================
echo   Both servers are starting!
echo   - Web App UI:  http://localhost:5173
echo   - Backend API: http://127.0.0.1:8000/docs
echo ===================================================
timeout /t 3 >nul
start http://localhost:5173
