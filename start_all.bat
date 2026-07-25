@echo off
echo =======================================================
echo          Starting Quanta AI - All Systems Go!
echo =======================================================

echo [1] Starting Python Backend (FastAPI)...
start "Python Backend" cmd /k "npm run backend"

timeout /t 2 >nul

echo [2] Starting Rust AI Supervisor Backend...
start "Rust Backend" cmd /k "cd backend_rust && cargo run"

timeout /t 2 >nul

echo [3] Starting Rust Data Collector...
start "Rust Collector" cmd /k "cd backend_rust_collector && cargo run"

timeout /t 2 >nul

echo [4] Starting Frontend (Tauri Desktop App)...
start "Tauri App" cmd /k "bun run tauri dev"

echo.
echo All backend, collector, and frontend services have been launched in separate windows!
echo You can close this window now.
