@echo off
echo ==================================================
echo QuantaAI HFT - Ultra-Fast Venv Setup using UV
echo ==================================================
echo.

:: Check if uv is installed, if not, install it via pip (global) or standalone
where uv >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] 'uv' not found. Installing 'uv' via pip...
    pip install uv
)



echo [*] Creating native virtual environment instantly with UV...
uv venv venv

echo [*] Activating environment...
call venv\Scripts\activate.bat

echo [*] Resolving and installing dependencies via UV (Rust powered)...
uv pip install -r requirements.txt

echo.
echo ==================================================
echo [SUCCESS] "Duniya ka Best Venu" installed!
echo To run the backend, just execute:
echo call venv\Scripts\activate.bat
echo uvicorn main:app --reload
echo ==================================================

